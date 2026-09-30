import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { PersonaKey } from "@/config/personas";
import { fairValueBand } from "@/domain/pricing";
import { systemClock } from "@/lib/clock";
import { acceptCounterDef } from "@/server/actions/bids";
import { type ActionDef, executeAction } from "@/server/actions/pipeline";
import * as actions from "@/server/actions/trades";
import { verifySandboxChain } from "@/server/audit";
import { sandboxClock } from "@/server/clock";
import { closeDatabase, type Db } from "@/server/db/client";
import { messageThreads } from "@/server/db/schema";
import { getCompanyConsoleModel } from "@/server/read/consoles";
import { getTradeDocumentModel, getTradeRoomModel, getTradesModel } from "@/server/read/trades";
import { refreshSandbox } from "@/server/refresh";
import * as audit from "@/server/repositories/audit";
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as documents from "@/server/repositories/documents";
import * as escrow from "@/server/repositories/escrow";
import * as holdings from "@/server/repositories/holdings";
import * as jobs from "@/server/repositories/jobs";
import * as messages from "@/server/repositories/messages";
import * as prints from "@/server/repositories/prints";
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
  await ensureSandbox(db, sid, "buyer_b");
  await settings({ autopilot: false });
});
async function settings(changes: Parameters<typeof sandboxes.save>[2]) {
  await db.transaction((tx) => sandboxes.save(tx, sid, changes));
}
async function viewer(per: PersonaKey = "buyer_b"): Promise<Viewer> {
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
async function act<S extends z.ZodType, T>(per: PersonaKey, def: ActionDef<S, T>, input: unknown) {
  await settings({ persona: per });
  return executeAction(def, input, {
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
async function trade(ref = "T-1042") {
  const row = (await trades.visibleRows(db, sid, (await viewer("operator")).actor)).find(
    (t) => t.ref === ref,
  );
  if (!row) throw Error("trade");
  return row;
}
async function jump(ms: number) {
  await settings({ clockOffsetMs: ms });
  return refreshSandbox(db, sid);
}
async function doAction(per: PersonaKey, def: ActionDef<z.ZodType, actions.TradeData>) {
  const result = await act(per, def, { tradeId: (await trade()).id });
  expect(result.status).toBe("success");
  return result;
}
async function funded() {
  await doAction("company_admin", actions.waiveDef);
  await doAction("buyer_b", actions.markWireSentDef);
  await doAction("operator", actions.confirmFundsDef);
}
function code(result: { status: string; error?: { code: string } }) {
  return result.error?.code;
}

it("catch-up schedules the seeded trade once, due in 5s, and preserves the cheap read path", async () => {
  await settings({ autopilot: true });
  const t = await trade();
  expect(await jobs.list(db, sid)).toHaveLength(0);
  expect(await refreshSandbox(db, sid)).toMatchObject({ changed: true, pendingJobs: 1 });
  expect(await jobs.list(db, sid)).toMatchObject([
    { entity: "trade", entityId: t.id, event: "WAIVE", dueAt: new Date(T0.getTime() + 5000) },
  ]);
  const transaction = vi.spyOn(db, "transaction");
  expect(await refreshSandbox(db, sid)).toEqual({ changed: false, pendingJobs: 1 });
  expect(transaction).not.toHaveBeenCalled();
  transaction.mockRestore();
  expect((await jobs.list(db, sid)).filter((j) => j.entity === "bid")).toEqual([]);
});
it("catch-up obeys company persona, switching and autopilot off", async () => {
  await settings({ persona: "company_admin", autopilot: true });
  expect(await refreshSandbox(db, sid)).toEqual({ changed: false, pendingJobs: 0 });
  expect(await jobs.list(db, sid)).toHaveLength(0);
  await settings({ persona: "buyer_b", autopilot: false });
  await refreshSandbox(db, sid);
  expect(await jobs.list(db, sid)).toHaveLength(0);
  await settings({ autopilot: true });
  await refreshSandbox(db, sid);
  expect(await jobs.list(db, sid)).toHaveLength(1);
  await settings({ persona: "company_admin" });
  await jump(6000);
  expect((await trade()).status).toBe("RofrPending");
  expect(await jobs.list(db, sid)).toHaveLength(1);
  await settings({ persona: "buyer_b" });
  await refreshSandbox(db, sid);
  expect((await trade()).status).toBe("AwaitingFunds");
});
it("unrelated personas never move Buyer B's seeded trade or its fair-value band", async () => {
  sid = await resetSandbox(db, sid, "buyer_a");
  const target = await trade();
  await settings({ clockOffsetMs: 10 * 60 * 1000 });
  await refreshSandbox(db, sid);
  expect((await trades.find(db, sid, target.id))?.status).toBe("RofrPending");
  expect((await jobs.list(db, sid)).filter((j) => j.entityId === target.id)).toEqual([]);
  const falaj = (await companies.list(db, sid)).find((c) => c.slug === "falaj-robotics");
  if (!falaj) throw Error("Falaj missing");
  expect(
    fairValueBand({
      trades: (await prints.list(db, sid)).filter((p) => p.companyId === falaj.id),
      now: new Date(T0.getTime() + 10 * 60 * 1000),
      fallbackMinor: null,
    }),
  ).toMatchObject({
    method: "trades",
    lowMinor: 3420n,
    midMinor: 3580n,
    highMinor: 3610n,
    tradeCount: 6,
  });
  await settings({ persona: "company_admin" });
  await refreshSandbox(db, sid);
  expect((await getCompanyConsoleModel(await viewer("company_admin"), db))?.decisions).toHaveLength(
    2,
  );
  await settings({ persona: "operator" });
  await refreshSandbox(db, sid);
  expect((await trades.find(db, sid, target.id))?.status).toBe("RofrPending");
});
it("a queued job stays pending after switching to an unrelated persona", async () => {
  await settings({ autopilot: true });
  await refreshSandbox(db, sid);
  expect((await jobs.list(db, sid)).map((j) => j.event)).toEqual(["WAIVE"]);
  await settings({ persona: "buyer_a" });
  await jump(6000);
  expect((await trade()).status).toBe("RofrPending");
  expect((await jobs.list(db, sid)).map((j) => j.event)).toEqual(["WAIVE"]);
  await settings({ persona: "buyer_b" });
  await refreshSandbox(db, sid);
  expect((await trade()).status).toBe("AwaitingFunds");
});
it("Buyer A's counter grows into a settled trade through involved auto-pilot parties", async () => {
  await settings({ persona: "buyer_a", autopilot: true });
  const buyer = await users.forPersona(db, sid, "buyer_a");
  const counter = (await bids.forBuyer(db, sid, buyer.id)).find((b) => b.status === "Countered");
  if (!counter) throw Error("Counter missing");
  expect((await act("buyer_a", acceptCounterDef, { bidId: counter.id })).status).toBe("success");
  await jump(3000);
  const created = (await trades.forBuyer(db, sid, buyer.id)).find((t) => t.bidId === counter.id);
  if (!created) throw Error("Trade missing");
  expect(created.status).toBe("AwaitingDocs");
  expect((await act("buyer_a", actions.signDef, { tradeId: created.id })).status).toBe("success");
  await jump(8000);
  await jump(14000);
  expect((await trades.find(db, sid, created.id))?.status).toBe("AwaitingFunds");
  expect((await act("buyer_a", actions.markWireSentDef, { tradeId: created.id })).status).toBe(
    "success",
  );
  await jump(28000);
  expect((await trades.find(db, sid, created.id))?.status).toBe("Settled");
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
it("the action refresh step reconciles missing trade jobs", async () => {
  await settings({ autopilot: true });
  const t = await trade();
  expect(
    (
      await act("buyer_b", actions.sendMessageDef, {
        tradeId: t.id,
        body: "Checking the timeline.",
      })
    ).status,
  ).toBe("success");
  expect(
    (await jobs.list(db, sid)).filter((j) => j.entityId === t.id && j.event === "WAIVE"),
  ).toHaveLength(1);
});
it("trades list values and visibility for all personas", async () => {
  for (const [per, expected] of [
    ["buyer_a", ["T-1036"]],
    ["buyer_b", ["T-1042"]],
    ["seller", []],
    ["company_admin", ["T-1042", "T-1036"]],
    ["operator", ["T-1042", "T-1036"]],
  ] as const) {
    const model = await getTradesModel(await viewer(per), db);
    expect(model.rows.map((r) => r.ref)).toEqual(expected);
    expect(model.rows.some((r) => r.yourMove)).toBe(per === "company_admin");
  }
  const a = await getTradesModel(await viewer("buyer_a"), db),
    b = await getTradesModel(await viewer(), db);
  expect(a.rows[0]).toMatchObject({
    completed: true,
    badge: { text: "Settled" },
    counterparty: "Karim Nasser",
  });
  expect(b.rows[0]).toMatchObject({
    completed: false,
    quantity: "2,500 sh",
    price: "AED 36.00",
    total: "AED 90,000",
    badge: { text: "Company deciding" },
    deadline: new Date(T0.getTime() + 26 * 86400000).toISOString(),
  });
});
it("buyer B's seeded room has exact summary, identities, snapshot history and waiting copy", async () => {
  await settings({ autopilot: true });
  const t = await trade(),
    model = await getTradeRoomModel(await viewer(), t.id, db);
  expect(model?.summary).toEqual({
    quantity: "2,500 sh",
    price: "AED 36.00",
    total: "AED 90,000",
    escrowRef: "ESC-T-1042",
  });
  expect(model?.parties).toEqual({
    seller: "Karim Nasser · Holder #S-198",
    buyer: "Omar Qasim · Investor #B-117",
    company: "Falaj Robotics · ROFR 30 days",
  });
  expect(model?.timeline.map((s) => s.state)).toEqual([
    "done",
    "done",
    "current",
    "upcoming",
    "upcoming",
    "upcoming",
  ]);
  expect(model?.timeline[2]).toMatchObject({
    waiting: "Falaj Robotics",
    deadline: t.rofrDeadline?.toISOString(),
  });
  expect(model?.nextStep.helper).toBe("Usually a few seconds in this demo.");
  expect(model?.nextStep.actions).toEqual([]);
  expect(JSON.stringify(model)).not.toContain("reserve");
});
it("company admin waives with the human actor recorded and cannot read messages", async () => {
  const t = await trade(),
    before = await getTradeRoomModel(await viewer("company_admin"), t.id, db);
  expect(before?.nextStep.actions.map((a) => [a.label, a.variant])).toEqual([
    ["Waive", "primary"],
    ["Buy at AED 36.00", "secondary"],
    ["Refuse transfer", "link"],
  ]);
  await doAction("company_admin", actions.waiveDef);
  expect((await trade()).status).toBe("AwaitingFunds");
  const model = await getTradeRoomModel(await viewer("company_admin"), t.id, db);
  expect(model?.timeline[2]?.details[0]).toContain("Waived · Hana Saleh · Falaj Robotics · CFO");
  expect(model?.timeline[2]?.details[0]).not.toContain("auto-pilot");
  expect(model?.messages).toBeNull();
});
it("autopilot settles after the human wire, with two approvers, escrow and watermarked documents", async () => {
  await settings({ autopilot: true });
  const t = await trade();
  await refreshSandbox(db, sid);
  await jump(5000);
  expect((await trade()).status).toBe("AwaitingFunds");
  expect((await jobs.list(db, sid)).some((j) => j.event === "MARK_WIRE_SENT")).toBe(false);
  await doAction("buyer_b", actions.markWireSentDef);
  await jump(18000);
  const settled = await trade();
  expect(settled.status).toBe("Settled");
  expect(new Set(settled.releaseApprovals).size).toBe(2);
  const model = await getTradeRoomModel(await viewer(), t.id, db);
  expect(model?.timeline.every((s) => s.state === "done")).toBe(true);
  for (const key of ["rofr", "funds", "register", "released"])
    expect(model?.timeline.find((s) => s.key === key)?.details.join(" ")).toContain(
      " (auto-pilot)",
    );
  expect(model?.timeline[5]?.details).toHaveLength(2);
  expect(model?.escrow.held).toMatch(/^Released to seller AED 90,000 on /);
  expect((await escrow.forTrade(db, sid, t.id)).map((e) => e.kind)).toEqual([
    "wire_sent",
    "funded",
    "released",
  ]);
  const certificate = model?.documents.find((d) => d.kind === "completion_certificate");
  if (!certificate) throw Error("certificate");
  const doc = await getTradeDocumentModel(await viewer(), t.id, certificate.id, db);
  expect(doc?.watermark.handle).toBe("Investor #B-117");
  expect(doc?.paragraphs.join(" ")).toContain("Tariq Mansour");
  expect(doc?.paragraphs.join(" ")).toContain("Noor Khalil");
  if (!model) throw Error("room");
  const reg = model.documents.find((d) => d.kind === "register_extract");
  if (!reg) throw Error("register");
  const register = await getTradeDocumentModel(await viewer(), t.id, reg.id, db);
  expect(register?.rows.map((r) => r.slice(2))).toEqual([
    ["8,000 sh", "5,500 sh"],
    ["0 sh", "2,500 sh"],
  ]);
  const previous = await trade("T-1036"),
    previousRegister = (await documents.forTrade(db, sid, previous.id)).find(
      (d) => d.kind === "register_extract",
    );
  if (!previousRegister) throw Error("previous register");
  const snapshot = await getTradeDocumentModel(
    await viewer("buyer_a"),
    previous.id,
    previousRegister.id,
    db,
  );
  expect(snapshot?.rows.map((r) => r.slice(2))).toEqual([
    ["12,000 sh", "8,000 sh"],
    ["0 sh", "4,000 sh"],
  ]);
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
it("exercise mode buys through the company instead of the buyer", async () => {
  await settings({ autopilot: true, rofrMode: "exercise" });
  await refreshSandbox(db, sid);
  await jump(5000);
  expect((await trade()).status).toBe("RofrExercised");
  const model = await getTradeRoomModel(await viewer(), (await trade()).id, db);
  expect(model?.nextStep.text).toBe(
    "Falaj Robotics bought the shares at AED 36.00 under its right of first refusal.",
  );
  expect(model?.timeline.at(-1)?.tone).toBe("neutral");
  expect(model?.timeline.some((s) => s.key === "funds")).toBe(false);
});
it("four-eyes offers the other operator and rejects repeat approval", async () => {
  await funded();
  await doAction("company_admin", actions.uploadRegisterDef);
  await doAction("operator", actions.approveReleaseDef);
  const t = await trade(),
    model = await getTradeRoomModel(await viewer("operator"), t.id, db);
  expect(model?.nextStep.text).toBe("Waiting for a second operator to approve.");
  expect(model?.nextStep.actions).toEqual([]);
  expect(model?.yourMove).toBe(false);
  const repeat = await act("operator", actions.approveReleaseDef, { tradeId: t.id });
  expect(repeat).toMatchObject({
    status: "error",
    error: { code: "GUARD_FAILED", message: "A second operator must approve the release." },
  });
});
it("redacts messages, preserves payment warnings, creates one thread and enforces participants", async () => {
  const t = await trade();
  const redacted = await act("buyer_b", actions.sendMessageDef, {
    tradeId: t.id,
    body: "email me at x@y.com",
  });
  expect(redacted).toMatchObject({
    status: "success",
    data: { message: "Contact details were removed. Keep conversations on Atlas." },
  });
  await act("buyer_b", actions.sendMessageDef, { tradeId: t.id, body: "Please use my new IBAN" });
  await act("operator", actions.sendMessageDef, {
    tradeId: t.id,
    body: "Use only the locked instructions.",
  });
  const stored = await messages.forTrade(db, sid, t.id);
  expect(stored[0]).toMatchObject({ bodyRedacted: "email me at [email removed]", flagged: true });
  expect(stored).toHaveLength(3);
  expect((await getTradeRoomModel(await viewer(), t.id, db))?.messages?.[1]?.paymentWarning).toBe(
    true,
  );
  expect(
    await db
      .select()
      .from(messageThreads)
      .where(and(eq(messageThreads.sandboxId, sid), eq(messageThreads.tradeId, t.id))),
  ).toHaveLength(1);
  expect(
    code(await act("buyer_a", actions.sendMessageDef, { tradeId: t.id, body: "Not a party" })),
  ).toBe("FORBIDDEN");
  expect(
    code(
      await act("company_admin", actions.sendMessageDef, {
        tradeId: t.id,
        body: "Not a participant",
      }),
    ),
  ).toBe("FORBIDDEN");
  expect((await getTradeRoomModel(await viewer("company_admin"), t.id, db))?.messages).toBeNull();
  expect((await getTradeRoomModel(await viewer("operator"), t.id, db))?.messages).toHaveLength(3);
  expect(JSON.stringify(await audit.forTrade(db, sid, t.id))).not.toContain("x@y.com");
});
it("limits messages to ten per minute", async () => {
  const t = await trade();
  for (let i = 0; i < 10; i++)
    expect(
      (await act("buyer_b", actions.sendMessageDef, { tradeId: t.id, body: `Update ${i}` })).status,
    ).toBe("success");
  expect(
    code(await act("buyer_b", actions.sendMessageDef, { tradeId: t.id, body: "One more" })),
  ).toBe("RATE_LIMITED");
});
it("disputes resume or refund and release the reserved shares", async () => {
  await funded();
  const t = await trade(),
    original = await holdings.find(db, sid, t.holdingId);
  expect(
    (await act("buyer_b", actions.raiseDisputeDef, { tradeId: t.id, reason: "Register mismatch" }))
      .status,
  ).toBe("success");
  expect((await trade()).status).toBe("Disputed");
  expect(
    (await getTradeRoomModel(await viewer("operator"), t.id, db))?.nextStep.actions.map(
      (a) => a.key,
    ),
  ).toEqual(["resolveContinue", "resolveCancel"]);
  await doAction("operator", actions.resolveContinueDef);
  expect((await trade()).status).toBe("Funded");
  await act("buyer_b", actions.raiseDisputeDef, { tradeId: t.id, reason: "Still incorrect" });
  expect(
    (await act("operator", actions.resolveCancelDef, { tradeId: t.id, reason: "Refund approved" }))
      .status,
  ).toBe("success");
  expect((await trade()).status).toBe("Cancelled");
  expect((await escrow.forTrade(db, sid, t.id)).at(-1)?.kind).toBe("refunded");
  expect((await holdings.find(db, sid, t.holdingId))?.reservedQty).toBe(
    (original?.reservedQty ?? 0n) - 2500n,
  );
  expect(
    (await getTradeRoomModel(await viewer(), t.id, db))?.timeline.at(-1)?.details[0],
  ).toContain("Cancelled after Atlas reviewed a dispute");
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
it("room and documents hide unrelated, unknown, malformed and other sandbox ids", async () => {
  const t = await trade(),
    doc = (await documents.forTrade(db, sid, t.id))[0];
  if (!doc) throw Error("doc");
  expect(await getTradeRoomModel(await viewer("buyer_a"), t.id, db)).toBeNull();
  expect(await getTradeDocumentModel(await viewer("buyer_a"), t.id, doc.id, db)).toBeNull();
  for (const id of [v7(), "demo-id"]) {
    expect(await getTradeRoomModel(await viewer(), id, db)).toBeNull();
    expect(await getTradeDocumentModel(await viewer(), t.id, id, db)).toBeNull();
  }
  expect(
    (await getTradeDocumentModel(await viewer("company_admin"), t.id, doc.id, db))?.paragraphs.join(
      " ",
    ),
  ).toContain("Signed by Karim Nasser");
  const otherSid = v7();
  await ensureSandbox(db, otherSid, "buyer_b");
  const other = (await trades.list(db, otherSid))[0];
  if (!other) throw Error("other");
  expect(await getTradeRoomModel(await viewer(), other.id, db)).toBeNull();
});
it("every trade schema is strict and rejects injected event or actor fields", async () => {
  const id = (await trade()).id;
  for (const def of [
    actions.signDef,
    actions.waiveDef,
    actions.exerciseDef,
    actions.markWireSentDef,
    actions.confirmFundsDef,
    actions.uploadRegisterDef,
    actions.approveReleaseDef,
    actions.resolveContinueDef,
  ])
    expect(code(await act("buyer_b", def, { tradeId: id, event: "EXERCISE" }))).toBe("VALIDATION");
  for (const def of [
    actions.refuseDef,
    actions.raiseDisputeDef,
    actions.resolveCancelDef,
    actions.cancelDef,
  ])
    expect(
      code(await act("operator", def, { tradeId: id, reason: "Test", actor: "operator_second" })),
    ).toBe("VALIDATION");
  expect(
    code(
      await act("buyer_b", actions.sendMessageDef, {
        tradeId: id,
        body: "Hello",
        event: "CONFIRM_FUNDS",
      }),
    ),
  ).toBe("VALIDATION");
});
it("new counter-path trade offers the buyer sign step and lets counterparties complete it", async () => {
  await settings({ autopilot: true, persona: "buyer_a" });
  const a = await viewer("buyer_a"),
    bid = (await bids.forBuyer(db, sid, a.user.id)).find((b) => b.status === "Countered");
  if (!bid) throw Error("bid");
  expect((await act("buyer_a", acceptCounterDef, { bidId: bid.id })).status).toBe("success");
  await jump(3000);
  const made = (await trades.forBuyer(db, sid, a.user.id)).find((t) => t.status === "AwaitingDocs");
  if (!made) throw Error("new trade");
  const room = await getTradeRoomModel(await viewer("buyer_a"), made.id, db);
  expect(room?.nextStep.actions[0]?.key).toBe("sign");
  expect((await act("buyer_a", actions.signDef, { tradeId: made.id })).status).toBe("success");
  await jump(12000);
  expect((await trades.find(db, sid, made.id))?.status).toBe("AwaitingFunds");
  await act("buyer_a", actions.markWireSentDef, { tradeId: made.id });
  await jump(25000);
  expect((await trades.find(db, sid, made.id))?.status).toBe("Settled");
  expect(
    (await getTradeRoomModel(await viewer("buyer_a"), made.id, db))?.timeline.every(
      (s) => s.state === "done",
    ),
  ).toBe(true);
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
