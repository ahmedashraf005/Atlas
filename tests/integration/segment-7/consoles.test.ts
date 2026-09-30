import { and, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { PersonaKey } from "@/config/personas";
import { systemClock } from "@/lib/clock";
import * as auditActions from "@/server/actions/audit";
import { requestAccessDef } from "@/server/actions/company";
import * as companyActions from "@/server/actions/company-console";
import { createHoldingDef, createListingDef } from "@/server/actions/holdings";
import * as opsActions from "@/server/actions/ops";
import { type ActionDef, executeAction } from "@/server/actions/pipeline";
import { updatePolicyDef } from "@/server/actions/policy";
import * as tradeActions from "@/server/actions/trades";
import { appendAudit, verifySandboxChain } from "@/server/audit";
import { sandboxClock } from "@/server/clock";
import { closeDatabase, type Db } from "@/server/db/client";
import { accessGrants } from "@/server/db/schema";
import { getAuditModel } from "@/server/read/audit";
import { getCompanyModel } from "@/server/read/company";
import { getCompanyConsoleModel, getOpsConsoleModel } from "@/server/read/consoles";
import { getHoldingsModel } from "@/server/read/holdings";
import { getPolicyModel } from "@/server/read/policy";
import { refreshSandbox } from "@/server/refresh";
import * as audit from "@/server/repositories/audit";
import * as companies from "@/server/repositories/companies";
import * as grants from "@/server/repositories/grants";
import * as holdings from "@/server/repositories/holdings";
import * as listings from "@/server/repositories/listings";
import * as notifications from "@/server/repositories/notifications";
import * as qa from "@/server/repositories/qa";
import * as sandboxes from "@/server/repositories/sandboxes";
import * as trades from "@/server/repositories/trades";
import * as users from "@/server/repositories/users";
import { ensureSandbox, resetSandbox } from "@/server/sandbox";
import type { Viewer } from "@/server/viewer";
import { createTestDb } from "../helpers/db";

const T0 = new Date("2026-09-28T10:00:00Z");
let db: Db, sid: string;
beforeAll(async () => {
  vi.spyOn(systemClock, "now").mockImplementation(() => new Date(T0));
  db = await createTestDb();
}, 20000);
afterAll(async () => {
  await closeDatabase(db);
  vi.restoreAllMocks();
});
beforeEach(async () => {
  sid = v7();
  await ensureSandbox(db, sid, "company_admin");
  await settings({ autopilot: false });
});
async function settings(changes: Parameters<typeof sandboxes.save>[2]) {
  await db.transaction((tx) => sandboxes.save(tx, sid, changes));
}
async function viewer(per: PersonaKey = "company_admin"): Promise<Viewer> {
  const user = await users.forPersona(db, sid, per),
    sandbox = await sandboxes.find(db, sid);
  if (!sandbox) throw Error("sandbox");
  const clock = sandboxClock(sandbox);
  return {
    sandboxId: sid,
    persona: per,
    user,
    actor: users.toActor(user),
    now: clock.now(),
    clock,
    autopilot: sandbox.autopilot,
    rofrMode: sandbox.rofrMode,
    pendingJobs: 0,
  };
}
async function act<S extends z.ZodType, T>(per: PersonaKey, def: ActionDef<S, T>, raw: unknown) {
  await settings({ persona: per });
  return executeAction(def, raw, {
    db,
    session: {
      sid,
      per,
      iss: "atlas",
      aud: "atlas-demo",
      iat: T0.getTime() / 1000,
      exp: T0.getTime() / 1000 + 604800,
    },
  });
}
async function company(slug = "falaj-robotics") {
  const c = (await companies.list(db, sid)).find((c) => c.slug === slug);
  if (!c) throw Error("company");
  return c;
}
async function listing() {
  const h = (await holdings.forOwner(db, sid, (await viewer("seller")).user.id)).find(
    (h) => h.companyId !== "" && h.quantity === 10000n,
  );
  if (!h) throw Error("holding");
  const result = await act("seller", createListingDef, {
    holdingId: h.id,
    quantity: "3000",
    minFill: "2000",
    reservePrice: "3.00",
    windowDays: 5,
    confirmedOwnership: true,
    clientRequestId: v7(),
  });
  expect(result.status).toBe("success");
  if (result.status !== "success") throw Error("listing");
  return result.data;
}
async function trade() {
  const t = (await trades.visibleRows(db, sid, (await viewer("operator")).actor)).find(
    (t) => t.ref === "T-1042",
  );
  if (!t) throw Error("trade");
  return t;
}
async function policyInput() {
  const m = await getPolicyModel(await viewer(), db);
  if (!m) throw Error("policy");
  return { companyId: m.companyId, policy: m.initial };
}
const errorCode = (r: { status: string; error?: { code: string } }) => r.error?.code;
it("company seed queue and figures are exact, private activity snapshots excluded", async () => {
  await settings({ autopilot: true });
  const model = await getCompanyConsoleModel(await viewer(), db);
  expect(model?.figures.map((f) => f.value)).toEqual(["2", "2", "1", "AED 528,600"]);
  expect(model?.figures[3]?.caption).toBe("6 trades");
  expect(model?.decisions.map((d) => [d.kind, d.title])).toEqual([
    ["rofr", "Right of first refusal · T-1042"],
    ["question", "Question from Investor #B-204"],
  ]);
  expect(model?.decisions[1]?.detail).toBe("When will the FY2026 audited accounts be available?");
  expect(JSON.stringify(model)).not.toContain("reserve");
  expect(model?.autopilot).toBe(true);
  for (const per of ["buyer_a", "seller", "operator"] as const) {
    expect(await getCompanyConsoleModel(await viewer(per), db)).toBeNull();
    expect(await getPolicyModel(await viewer(per), db)).toBeNull();
  }
  expect(await getOpsConsoleModel(await viewer(), db)).toBeNull();
  expect(await getAuditModel(await viewer(), {}, db)).toBeNull();
});
it("holding verification and rejection use transitions, required reason and notify the seller", async () => {
  const c = await company(),
    cls = (await companies.classes(db, sid, c.id)).find((c) => c.kind === "ordinary");
  if (!cls) throw Error("class");
  async function create() {
    const r = await act("seller", createHoldingDef, {
      companyId: c.id,
      shareClassId: cls?.id,
      quantity: "5000",
      acquiredOn: "2020-01-01",
      evidence: "share_certificate",
    });
    expect(r.status).toBe("success");
    if (r.status !== "success") throw Error("holding");
    return r.data.holdingId;
  }
  const first = await create();
  expect(
    (await getCompanyConsoleModel(await viewer(), db))?.decisions.some((d) => d.id === first),
  ).toBe(true);
  expect(
    (await act("company_admin", companyActions.verifyHoldingDef, { holdingId: first })).status,
  ).toBe("success");
  expect((await holdings.find(db, sid, first))?.status).toBe("Verified");
  const second = await create();
  expect(
    errorCode(
      await act("company_admin", companyActions.rejectHoldingDef, {
        holdingId: second,
        reason: " ",
      }),
    ),
  ).toBe("VALIDATION");
  expect(
    (
      await act("company_admin", companyActions.rejectHoldingDef, {
        holdingId: second,
        reason: "Not on our register",
      })
    ).status,
  ).toBe("success");
  expect((await holdings.find(db, sid, second))?.rejectionReason).toBe("Not on our register");
  expect(
    (await getHoldingsModel(await viewer("seller"), db)).cards.find((h) => h.id === second),
  ).toMatchObject({ status: "Rejected", rejectionReason: "Not on our register" });
  expect((await audit.list(db, sid)).map((e) => e.action)).toContain("holding.VERIFY");
});
it("manual access decisions share automatic policy logic, notify, and prevent repeated decisions", async () => {
  const c = await company(),
    b = await viewer("buyer_b");
  await db
    .delete(accessGrants)
    .where(
      and(
        eq(accessGrants.sandboxId, sid),
        eq(accessGrants.buyerId, b.user.id),
        eq(accessGrants.companyId, c.id),
      ),
    );
  const request = { companyId: c.id, ndaVersion: "v1", accepted: true };
  expect((await act("buyer_b", requestAccessDef, request)).status).toBe("success");
  const m = await getCompanyConsoleModel(await viewer(), db);
  expect(m?.decisions.find((d) => d.kind === "access")).toMatchObject({
    policyOk: true,
    buyerId: b.user.id,
  });
  const input = { companyId: c.id, buyerId: b.user.id, decision: "approve" };
  expect((await act("company_admin", companyActions.decideAccessDef, input)).status).toBe(
    "success",
  );
  expect((await grants.find(db, sid, c.id, b.user.id))?.status).toBe("approved");
  expect(
    (await notifications.list(db, sid)).some(
      (n) => n.recipientId === b.user.id && n.template === "access_approved",
    ),
  ).toBe(true);
  expect(errorCode(await act("company_admin", companyActions.decideAccessDef, input))).toBe(
    "GUARD_FAILED",
  );
  await db
    .delete(accessGrants)
    .where(
      and(
        eq(accessGrants.sandboxId, sid),
        eq(accessGrants.buyerId, b.user.id),
        eq(accessGrants.companyId, c.id),
      ),
    );
  await act("buyer_b", requestAccessDef, request);
  const p = await policyInput();
  p.policy.allowedBuyerTypes = ["fund"];
  expect((await act("company_admin", updatePolicyDef, p)).status).toBe("success");
  expect(
    (await getCompanyConsoleModel(await viewer(), db))?.decisions.find((d) => d.kind === "access")
      ?.policyOk,
  ).toBe(false);
  expect(errorCode(await act("company_admin", companyActions.decideAccessDef, input))).toBe(
    "POLICY_BLOCKED",
  );
  expect(
    (await act("company_admin", companyActions.decideAccessDef, { ...input, decision: "deny" }))
      .status,
  ).toBe("success");
  expect((await grants.find(db, sid, c.id, b.user.id))?.status).toBe("denied");
  expect(errorCode(await act("buyer_b", companyActions.decideAccessDef, input))).toBe("FORBIDDEN");
});
it("answers are redacted, audited and visible to approved buyers; asker notified", async () => {
  const q = (await qa.list(db, sid)).find((q) => q.answer === null);
  if (!q) throw Error("question");
  expect(
    (
      await act("company_admin", companyActions.answerQuestionDef, {
        questionId: q.id,
        answer: "call 050 123 4567",
      })
    ).status,
  ).toBe("success");
  expect((await qa.list(db, sid)).find((row) => row.id === q.id)?.answer).toBe(
    "call [phone removed]",
  );
  expect(
    JSON.stringify(await getCompanyModel(await viewer("buyer_a"), "falaj-robotics", db)),
  ).toContain("call [phone removed]");
  expect(
    (await notifications.list(db, sid)).some(
      (n) => n.recipientId === q.askedBy && n.template === "question_answered",
    ),
  ).toBe(true);
  expect(JSON.stringify(await audit.list(db, sid))).not.toContain("050 123 4567");
  expect(
    errorCode(
      await act("company_admin", companyActions.answerQuestionDef, {
        questionId: q.id,
        answer: "Again",
      }),
    ),
  ).toBe("GUARD_FAILED");
});
it("policy bounds, strictness, role, sandbox restriction validation and before/after are enforced", async () => {
  const p = await policyInput(),
    before = await companies.policy(db, sid, p.companyId),
    t = await trade();
  p.policy.minLot = "500";
  expect((await act("company_admin", updatePolicyDef, p)).status).toBe("success");
  expect(JSON.stringify(await getHoldingsModel(await viewer("seller"), db))).toContain(
    "500 shares",
  );
  const e = (await audit.list(db, sid)).find((e) => e.action === "policy.update");
  if (!e) throw Error("entry");
  expect(e.before).toMatchObject({ minLot: "1000n", rofrDays: 30 });
  expect(e.after).toMatchObject({ minLot: "500n", rofrDays: 30 });
  const a = e.before as Record<string, unknown>,
    b = e.after as Record<string, unknown>;
  expect(Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))).toEqual(
    expect.arrayContaining(["minLot", "version"]),
  );
  p.policy.blackoutWindows = [{ start: "2026-09-27", end: "2026-10-02", label: "Demo round" }];
  expect((await act("company_admin", updatePolicyDef, p)).status).toBe("success");
  expect(JSON.stringify(await getHoldingsModel(await viewer("seller"), db))).toContain(
    "Sales are paused",
  );
  expect((await trade()).rofrDeadline).toEqual(t.rofrDeadline);
  expect(before.minLot).toBe(1000n);
  for (const policy of [
    { ...p.policy, rofrDays: 0 },
    { ...p.policy, minLot: "100001" },
    { ...p.policy, allowedBuyerTypes: [] },
    {
      ...p.policy,
      blackoutWindows: [{ start: "2026-10-01", end: "2026-09-30", label: "Invalid" }],
    },
  ])
    expect(errorCode(await act("company_admin", updatePolicyDef, { ...p, policy }))).toBe(
      "VALIDATION",
    );
  expect(errorCode(await act("buyer_a", updatePolicyDef, p))).toBe("FORBIDDEN");
  expect(errorCode(await act("company_admin", updatePolicyDef, { ...p, event: "UPDATE" }))).toBe(
    "VALIDATION",
  );
  expect(
    errorCode(
      await act("company_admin", updatePolicyDef, {
        ...p,
        policy: { ...p.policy, blockedOrgIds: [v7()] },
      }),
    ),
  ).toBe("VALIDATION");
});
it("operator rechecks reservations correctly, approves or rejects with shares released", async () => {
  const first = await listing();
  const model = await getOpsConsoleModel(await viewer("operator"), db);
  expect(model?.review[0]).toMatchObject({ ref: first.ref, policyOk: true, reserve: "USD 3.00" });
  expect(
    (await act("operator", opsActions.approveListingDef, { listingId: first.listingId })).status,
  ).toBe("success");
  expect((await listings.find(db, sid, first.listingId))?.status).toBe("Live");
  const second = await listing(),
    l = await listings.find(db, sid, second.listingId);
  if (!l) throw Error("listing");
  const h = await holdings.find(db, sid, l.holdingId);
  expect(
    errorCode(await act("operator", opsActions.rejectListingDef, { listingId: l.id, reason: "" })),
  ).toBe("VALIDATION");
  expect(
    (
      await act("operator", opsActions.rejectListingDef, {
        listingId: l.id,
        reason: "Evidence incomplete",
      })
    ).status,
  ).toBe("success");
  expect((await listings.find(db, sid, l.id))?.rejectionReason).toBe("Evidence incomplete");
  expect((await holdings.find(db, sid, l.holdingId))?.reservedQty).toBe(
    (h?.reservedQty ?? 0n) - l.quantity,
  );
  expect(errorCode(await act("seller", opsActions.approveListingDef, { listingId: l.id }))).toBe(
    "FORBIDDEN",
  );
});
it("operator money, escrow, disputes, and redaction/payment queues follow trade state", async () => {
  const t = await trade();
  expect(
    (await getOpsConsoleModel(await viewer("operator"), db))?.figures.map((f) => f.value),
  ).toEqual(["0", "0", "0", "AED 0"]);
  await act("company_admin", tradeActions.waiveDef, { tradeId: t.id });
  await act("buyer_b", tradeActions.markWireSentDef, { tradeId: t.id });
  expect((await getOpsConsoleModel(await viewer("operator"), db))?.money[0]?.state).toBe(
    "Confirm funds",
  );
  await act("operator", tradeActions.confirmFundsDef, { tradeId: t.id });
  expect(
    (await getCompanyConsoleModel(await viewer(), db))?.decisions.some(
      (d) => d.kind === "register",
    ),
  ).toBe(true);
  expect((await getOpsConsoleModel(await viewer("operator"), db))?.figures[3]?.value).toBe(
    "AED 90,000",
  );
  await act("company_admin", tradeActions.uploadRegisterDef, { tradeId: t.id });
  expect((await getOpsConsoleModel(await viewer("operator"), db))?.money[0]?.state).toBe(
    "Approvals 0 of 2",
  );
  await act("operator", tradeActions.approveReleaseDef, { tradeId: t.id });
  expect((await getOpsConsoleModel(await viewer("operator"), db))?.money[0]?.approved).toBe(true);
  await act("buyer_b", tradeActions.raiseDisputeDef, {
    tradeId: t.id,
    reason: "Share register mismatch",
  });
  await act("buyer_b", tradeActions.sendMessageDef, {
    tradeId: t.id,
    body: "Use my new IBAN, email x@y.com",
  });
  const model = await getOpsConsoleModel(await viewer("operator"), db);
  expect(model?.disputes[0]?.reason).toBe("Share register mismatch");
  expect(model?.figures[2]?.value).toBe("1");
  expect(model?.flagged[0]).toMatchObject({ payment: true, contact: true, trade: "T-1042" });
  expect(model?.flagged[0]?.excerpt).not.toContain("x@y.com");
});
it("audit verification, tamper detection at midpoint, operator-only tool and reset", async () => {
  const q = (await qa.list(db, sid)).find((q) => q.answer === null);
  if (!q) throw Error("q");
  await act("company_admin", companyActions.answerQuestionDef, {
    questionId: q.id,
    answer: "Available next quarter.",
  });
  expect((await act("operator", auditActions.verifyDef, {})).status).toBe("success");
  expect((await getAuditModel(await viewer("operator"), {}, db))?.verified).toBe(true);
  expect(errorCode(await act("buyer_a", auditActions.tamperDef, {}))).toBe("FORBIDDEN");
  const count = (await audit.list(db, sid)).length;
  expect((await act("operator", auditActions.tamperDef, {})).status).toBe("success");
  expect(await verifySandboxChain(db, sid)).toEqual({
    ok: false,
    brokenAtSeq: Math.ceil(count / 2),
    reason: "HASH_MISMATCH",
  });
  const model = await getAuditModel(await viewer("operator"), {}, db);
  expect(model?.status).toContain("an entry was changed after it was written");
  expect(model?.entries.find((e) => e.changed)?.seq).toBe(String(Math.ceil(count / 2)));
  expect(await act("operator", auditActions.verifyDef, {})).toMatchObject({
    status: "success",
    data: { verified: false },
  });
  sid = await resetSandbox(db, sid, "operator");
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
it("audit filters, valid paging, checkpoint truncation and gap/link mismatch explanations", async () => {
  const c = await company(),
    q = (await qa.list(db, sid)).find((q) => q.answer === null);
  if (!q) throw Error("q");
  await act("company_admin", companyActions.answerQuestionDef, {
    questionId: q.id,
    answer: "Next quarter.",
  });
  const v = await viewer("operator");
  expect(
    (await getAuditModel(v, { action: "answer", entity: "company", page: "garbage" }, db))?.entries,
  ).toHaveLength(1);
  expect((await getAuditModel(v, { action: "missing" }, db))?.entries).toHaveLength(0);
  expect((await getAuditModel(v, { page: "999" }, db))?.page).toBe("1");
  expect((await getAuditModel(v, { entity: "invalid" }, db))?.entries).toHaveLength(2);
  await db.execute(sql`DELETE FROM audit_log WHERE sandbox_id = ${sid} AND seq = 2`);
  expect((await getAuditModel(v, {}, db))?.status).toContain("entries were removed from the end");
  expect(c.name).toBe("Falaj Robotics");
});
it("all actions reject cross-sandbox ids and foreign company administrators", async () => {
  const other = v7();
  await ensureSandbox(db, other, "company_admin");
  const q = (await qa.list(db, other)).find((q) => q.answer === null);
  if (!q) throw Error("q");
  expect(
    errorCode(
      await act("company_admin", companyActions.answerQuestionDef, {
        questionId: q.id,
        answer: "No",
      }),
    ),
  ).toBe("NOT_FOUND");
  const c = await company("wadi-ledger"),
    b = await viewer("buyer_b");
  expect(
    errorCode(
      await act("company_admin", companyActions.decideAccessDef, {
        companyId: c.id,
        buyerId: b.user.id,
        decision: "deny",
      }),
    ),
  ).toBe("FORBIDDEN");
  const p = await policyInput();
  expect(errorCode(await act("company_admin", updatePolicyDef, { ...p, companyId: c.id }))).toBe(
    "FORBIDDEN",
  );
});
it("auto access job remains identical after shared-service extraction", async () => {
  const c = await company("wadi-ledger");
  await settings({ autopilot: true });
  expect(
    (await act("buyer_b", requestAccessDef, { companyId: c.id, ndaVersion: "v1", accepted: true }))
      .status,
  ).toBe("success");
  await settings({ clockOffsetMs: 3000 });
  await refreshSandbox(db, sid);
  expect((await grants.find(db, sid, c.id, (await viewer("buyer_b")).user.id))?.status).toBe(
    "denied",
  );
  expect(
    (await audit.list(db, sid)).find((e) => e.action === "company.decideAccess")?.simulated,
  ).toBe(true);
});

it("audit paginates 50 rows with stable filters and canonical expanded diffs", async () => {
  const actor = (await viewer("operator")).actor;
  await db.transaction(async (tx) => {
    const sandbox = await sandboxes.lockSandbox(tx, sid);
    for (let i = 0; i < 52; i++)
      await appendAudit(
        { tx, sandbox, actor, now: T0, personaUserId: actor.userId, depth: 0 },
        {
          action: "sandbox.toggleAutopilot",
          entity: "sandbox",
          entityId: sid,
          before: { autopilot: false },
          after: { autopilot: true },
        },
      );
  });
  const v = await viewer("operator"),
    first = await getAuditModel(v, { entity: "sandbox", action: "toggle" }, db),
    second = await getAuditModel(v, { entity: "sandbox", action: "toggle", page: "2" }, db);
  expect(first?.entries).toHaveLength(50);
  expect(first?.previous).toBeNull();
  expect(first?.next).toContain("page=2");
  expect(second?.entries).toHaveLength(2);
  expect(second?.next).toBeNull();
  expect(second?.previous).toContain("page=1");
  expect(first?.entries[0]?.diff).toEqual([{ field: "autopilot", from: "false", to: "true" }]);
  expect(second?.verified).toBe(true);
});
it("audit explains broken links, sequence gaps and a checkpoint-only mismatch", async () => {
  const entry = (await audit.list(db, sid))[0];
  if (!entry) throw Error("seed");
  const v = await viewer("operator");
  await db.execute(
    sql`UPDATE audit_log SET prev_hash = 'wrong' WHERE sandbox_id = ${sid} AND seq = 1`,
  );
  expect((await getAuditModel(v, {}, db))?.status).toContain(
    "an entry's link to the previous one doesn't match",
  );
  await db.execute(
    sql`UPDATE audit_log SET prev_hash = ${entry.prevHash}, seq = 2 WHERE sandbox_id = ${sid} AND seq = 1`,
  );
  expect((await getAuditModel(v, {}, db))?.status).toContain("an entry is missing");
  await db.execute(sql`UPDATE audit_log SET seq = 1 WHERE sandbox_id = ${sid} AND seq = 2`);
  await settings({ auditHeadHash: "wrong" });
  const model = await getAuditModel(v, {}, db);
  expect(model?.status).toContain("entries were removed from the end");
  expect(model?.entries.some((e) => e.changed)).toBe(false);
});
it("malformed share lots return field validation instead of throwing during bigint conversion", async () => {
  const p = await policyInput(),
    before = (await audit.list(db, sid)).length;
  for (const minLot of ["abc", "1.5", "", "-1", "1000000", "9".repeat(10000)]) {
    const result = await act("company_admin", updatePolicyDef, {
      ...p,
      policy: { ...p.policy, minLot },
    });
    expect(result).toMatchObject({
      status: "error",
      error: { code: "VALIDATION", issues: [{ field: "policy.minLot" }] },
    });
  }
  expect((await audit.list(db, sid)).length).toBe(before);
});
