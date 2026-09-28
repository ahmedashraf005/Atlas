import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { PersonaKey } from "@/config/personas";
import { systemClock } from "@/lib/clock";
import {
  createHoldingDef,
  createListingDef,
  resubmitHoldingDef,
  withdrawListingDef,
} from "@/server/actions/holdings";
import { executeAction } from "@/server/actions/pipeline";
import { readChain, verifySandboxChain } from "@/server/audit";
import { closeDatabase, type Db } from "@/server/db/client";
import { transferPolicies } from "@/server/db/schema";
import { getCreateListingModel } from "@/server/read/create-listing";
import { getHoldingsModel } from "@/server/read/holdings";
import { refreshSandbox } from "@/server/refresh";
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as holdings from "@/server/repositories/holdings";
import * as jobs from "@/server/repositories/jobs";
import * as listings from "@/server/repositories/listings";
import * as sandboxes from "@/server/repositories/sandboxes";
import * as users from "@/server/repositories/users";
import { ensureSandbox } from "@/server/sandbox";
import { runTransition } from "@/server/transitions";
import type { Viewer } from "@/server/viewer";
import { createTestDb } from "../helpers/db";

const T0 = new Date("2026-09-28T10:00:00Z");
let db: Db, sid: string, now: Date;
beforeAll(async () => {
  db = await createTestDb();
  vi.spyOn(systemClock, "now").mockImplementation(() => new Date(now));
}, 20000);
afterAll(async () => {
  await closeDatabase(db);
  vi.restoreAllMocks();
});
beforeEach(async () => {
  now = new Date(T0);
  sid = v7();
  await ensureSandbox(db, sid, "seller");
});
const session = () => ({
  sid,
  per: "seller" as const,
  iss: "atlas" as const,
  aud: "atlas-demo" as const,
  iat: T0.getTime() / 1000,
  exp: T0.getTime() / 1000 + 604800,
});
async function viewer(per: PersonaKey = "seller"): Promise<Viewer> {
  const u = await users.forPersona(db, sid, per);
  return {
    sandboxId: sid,
    persona: per,
    user: {
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      subtitle: u.subtitle,
      role: u.role,
    },
    actor: users.toActor(u),
    now: new Date(now),
    clock: systemClock,
    autopilot: true,
    rofrMode: "waive",
    pendingJobs: 0,
  };
}
async function facts(slug = "wadi-ledger") {
  const c = (await companies.list(db, sid)).find((c) => c.slug === slug);
  if (!c) throw new Error("missing company");
  const cl = (await companies.classes(db, sid, c.id)).find((c) => c.kind === "ordinary");
  const u = await users.forPersona(db, sid, "seller"),
    h = (await holdings.forOwner(db, sid, u.id)).find((h) => h.companyId === c.id);
  if (!cl || !h) throw new Error("missing holding");
  return { c, cl, h };
}
async function create(slug = "wadi-ledger", overrides: Record<string, unknown> = {}) {
  const { h } = await facts(slug);
  return executeAction(
    createListingDef,
    {
      holdingId: h.id,
      quantity: "5000",
      minFill: "2000",
      reservePrice: "3.00",
      windowDays: 5,
      confirmedOwnership: true,
      clientRequestId: v7(),
      ...overrides,
    },
    { db, session: session() },
  );
}
function errorCode(result: { status: string; error?: { code: string } }) {
  expect(result.status).toBe("error");
  return result.error?.code;
}
it("shows exact seller holdings, eligibility, reference prices and owned listing", async () => {
  const m = await getHoldingsModel(await viewer(), db);
  expect(m.cards.map((c) => c.company)).toEqual(["Falaj Robotics", "Wadi Ledger", "Qamra Health"]);
  expect(m.cards[0]?.eligibility.message).toBe("You can sell up to 3,000 shares now.");
  expect(m.cards[0]?.eligibility.terms.map((t) => t.value)).toEqual([
    "15,000 shares (50%)",
    "12,000 shares",
    "1,000 shares",
    "30 days",
  ]);
  expect(m.cards[0]?.quantities.map((q) => q.value)).toEqual([
    "30,000 sh",
    "12,000 sh",
    "0 sh",
    "18,000 sh",
  ]);
  expect(m.cards[0]?.market?.reference).toBe("Fair value AED 34.20–36.10 · Last trade AED 35.80");
  expect(m.cards[0]?.market?.demand).toBe("4 buyers have mandates matching Falaj Robotics");
  expect(m.cards[1]?.eligibility.message).toBe("You can sell up to 10,000 shares now.");
  expect(m.cards[1]?.market?.reference).toBe("Fair value USD 2.95–3.30 · Last trade USD 3.30");
  expect(m.cards[1]?.market?.demand).toBe("2 buyers have mandates matching Wadi Ledger");
  expect(m.cards[2]?.eligibility.failures).toEqual([
    "Lock-up ends 30 Dec 2026.",
    "Sales are paused until 8 Oct 2026 (Series B fundraising).",
  ]);
  expect(m.cards[2]?.market?.reference).toBe("Estimate AED 18.50 from the last round");
  expect(m.cards[2]?.market?.demand).toBe("1 buyer has mandates matching Qamra Health");
  expect(m.listings[0]).toMatchObject({
    ref: "L-2031",
    reserve: "AED 34.00",
    bids: "2 sealed",
    action: { kind: "withdraw" },
  });
  expect(() => JSON.stringify(m)).not.toThrow();
});
it("uses shared price visibility for shareholders and hides operator-only prints", async () => {
  const { c } = await facts("falaj-robotics");
  await db
    .update(transferPolicies)
    .set({ priceVisibility: "operator" })
    .where(and(eq(transferPolicies.sandboxId, sid), eq(transferPolicies.companyId, c.id)));
  const m = await getHoldingsModel(await viewer(), db);
  expect(m.cards[0]?.market?.reference).toBe("Estimate AED 42.00 from the last round");
  expect(m.cards[0]?.market?.last).toBe("Not disclosed");
  const form = await getCreateListingModel(
    await viewer(),
    (await facts("falaj-robotics")).h.id,
    db,
  );
  expect(form?.band?.midMinor).toBe("4200");
});
it("validates holding input by field and permits sellers only", async () => {
  const { c, cl } = await facts(),
    falaj = await facts("falaj-robotics");
  const base = {
    companyId: c.id,
    shareClassId: cl.id,
    quantity: "1000",
    acquiredOn: "2024-01-01",
    evidence: "share_certificate",
  };
  for (const [patch, field] of [
    [{ shareClassId: falaj.cl.id }, "shareClassId"],
    [{ quantity: "7000001" }, "quantity"],
    [{ acquiredOn: "2026-09-29" }, "acquiredOn"],
    [{ quantity: "1.5" }, "quantity"],
    [{ acquiredOn: "2026-02-30" }, "acquiredOn"],
  ] as const) {
    const r = await executeAction(
      createHoldingDef,
      { ...base, ...patch },
      { db, session: session() },
    );
    expect(errorCode(r)).toBe("VALIDATION");
    if (r.status === "error") expect(r.error.issues?.some((i) => i.field === field)).toBe(true);
  }
  expect(await holdings.list(db, sid)).toHaveLength(6);
  await db.transaction((tx) => sandboxes.save(tx, sid, { persona: "company_admin" }));
  expect(
    errorCode(
      await executeAction(
        createHoldingDef,
        { ...base, companyId: falaj.c.id, shareClassId: falaj.cl.id },
        { db, session: session() },
      ),
    ),
  ).toBe("FORBIDDEN");
});
it("submits a holding and simulated company verifies it at three seconds", async () => {
  const { c, cl } = await facts(),
    r = await executeAction(
      createHoldingDef,
      {
        companyId: c.id,
        shareClassId: cl.id,
        quantity: "1000",
        acquiredOn: "2024-01-01",
        evidence: "cap_table_extract",
      },
      { db, session: session() },
    );
  expect(r.status).toBe("success");
  if (r.status !== "success") return;
  expect((await holdings.find(db, sid, r.data.holdingId))?.status).toBe("PendingCompany");
  const pending = (await jobs.list(db, sid)).filter(
      (j) => j.entity === "holding" && j.entityId === r.data.holdingId,
    ),
    admin = (await users.list(db, sid)).find((u) => u.handle === "Wadi Ledger · CFO");
  expect(pending).toHaveLength(1);
  expect(pending[0]).toMatchObject({ event: "VERIFY", partyUserId: admin?.id });
  now = new Date(T0.getTime() + 3000);
  await refreshSandbox(db, sid);
  expect((await holdings.find(db, sid, r.data.holdingId))?.status).toBe("Verified");
  expect((await readChain(db, sid)).at(-1)).toMatchObject({ actorId: admin?.id, simulated: true });
  expect(await verifySandboxChain(db, sid)).toMatchObject({ ok: true });
});
it("creates, reserves and approves a Wadi listing; validates later attempts", async () => {
  const { h } = await facts(),
    r = await create();
  expect(r.status).toBe("success");
  if (r.status !== "success") return;
  expect(r.data.ref).toBe("L-3001");
  expect((await listings.find(db, sid, r.data.listingId))?.status).toBe("InReview");
  expect((await holdings.find(db, sid, h.id))?.reservedQty).toBe(5000n);
  const admin = (await users.list(db, sid)).find(
    (u) => u.handle === "Atlas compliance · second approver",
  );
  expect((await (await jobs.list(db, sid)).filter((j) => j.status === "pending"))[0]).toMatchObject(
    {
      event: "APPROVE",
      partyUserId: admin?.id,
    },
  );
  now = new Date(T0.getTime() + 3000);
  await refreshSandbox(db, sid);
  expect(await listings.find(db, sid, r.data.listingId)).toMatchObject({
    status: "Live",
    windowClosesAt: new Date(now.getTime() + 5 * 86400000),
  });
  const tooMuch = await create("wadi-ledger", { quantity: "5001" });
  expect(errorCode(tooMuch)).toBe("POLICY_BLOCKED");
  if (tooMuch.status === "error")
    expect(tooMuch.error.failures?.map((f) => f.code)).toContain("QUANTITY_ABOVE_MAX");
  const tooSmall = await create("wadi-ledger", { minFill: "1000" });
  expect(errorCode(tooSmall)).toBe("POLICY_BLOCKED");
  if (tooSmall.status === "error")
    expect(tooSmall.error.failures?.map((f) => f.code)).toContain("MIN_FILL_BELOW_MIN_LOT");
  const badPrice = await create("wadi-ledger", { reservePrice: "3.005" });
  expect(errorCode(badPrice)).toBe("VALIDATION");
  if (badPrice.status === "error") expect(badPrice.error.issues?.[0]?.field).toBe("reservePrice");
  expect(await listings.list(db, sid)).toHaveLength(5);
  expect(await verifySandboxChain(db, sid)).toMatchObject({ ok: true });
});
it("counts reserved shares toward Falaj's yearly cap", async () => {
  expect(
    (await create("falaj-robotics", { quantity: "3000", minFill: "1000", reservePrice: "34.00" }))
      .status,
  ).toBe("success");
  const r = await create("falaj-robotics", {
    quantity: "1000",
    minFill: "1000",
    reservePrice: "34.00",
  });
  expect(errorCode(r)).toBe("POLICY_BLOCKED");
  if (r.status === "error")
    expect(r.error.failures?.map((f) => f.code)).toContain("YEARLY_CAP_REACHED");
  expect(await holdings.committedQty(db, sid, (await facts("falaj-robotics")).h.id, now)).toBe(
    15000n,
  );
});
it("rolls back a Qamra attempt with exactly lockup and blackout failures", async () => {
  const before = await readChain(db, sid),
    r = await create("qamra-health", { quantity: "1000", minFill: "500", reservePrice: "18.50" });
  expect(errorCode(r)).toBe("POLICY_BLOCKED");
  if (r.status === "error")
    expect(r.error.failures?.map((f) => f.code)).toEqual(["LOCKUP_ACTIVE", "BLACKOUT_ACTIVE"]);
  expect(await listings.list(db, sid)).toHaveLength(4);
  expect(await readChain(db, sid)).toEqual(before);
  expect((await sandboxes.find(db, sid))?.nextRef).toBe(3000);
});
it("serializes concurrent duplicate requests into one listing and reservation", async () => {
  const clientRequestId = v7(),
    [a, b] = await Promise.all([
      create("wadi-ledger", { clientRequestId }),
      create("wadi-ledger", { clientRequestId }),
    ]);
  expect(a.status).toBe("success");
  expect(b).toEqual(a);
  expect(await listings.list(db, sid)).toHaveLength(5);
  expect((await holdings.find(db, sid, (await facts()).h.id))?.reservedQty).toBe(5000n);
  expect((await readChain(db, sid)).filter((e) => e.action === "listing.create")).toHaveLength(1);
});
it("withdraws L-2031, rejects its bids, releases all shares and surfaces a repeated withdrawal", async () => {
  const l = (await listings.forSeller(db, sid, (await viewer()).user.id))[0];
  if (!l) throw new Error("missing listing");
  const r = await executeAction(
    withdrawListingDef,
    { listingId: l.id },
    { db, session: session() },
  );
  expect(r.status).toBe("success");
  expect((await listings.find(db, sid, l.id))?.status).toBe("Withdrawn");
  expect(
    (await bids.list(db, sid)).filter((b) => b.listingId === l.id).map((b) => b.status),
  ).toEqual(["Rejected", "Rejected"]);
  expect((await holdings.find(db, sid, l.holdingId))?.reservedQty).toBe(0n);
  expect(await readChain(db, sid)).toHaveLength(4);
  expect(await verifySandboxChain(db, sid)).toMatchObject({ ok: true });
  const again = await executeAction(
    withdrawListingDef,
    { listingId: l.id },
    { db, session: session() },
  );
  expect(errorCode(again)).toBe("INVALID_TRANSITION");
});
it("isolates ownership and roles on listing actions and loaders", async () => {
  const seller = await viewer(),
    other = (await holdings.list(db, sid)).find((h) => h.ownerId !== seller.user.id);
  if (!other) throw new Error("missing other holding");
  expect(errorCode(await create("wadi-ledger", { holdingId: other.id }))).toBe("NOT_FOUND");
  expect(await getCreateListingModel(seller, other.id, db)).toBeNull();
  expect(await getCreateListingModel(seller, v7(), db)).toBeNull();
  expect(await getCreateListingModel(seller, "not-a-uuid", db)).toBeNull();
  await db.transaction((tx) => sandboxes.save(tx, sid, { persona: "buyer_a" }));
  expect(errorCode(await create())).toBe("FORBIDDEN");
  const otherSid = v7();
  await ensureSandbox(db, otherSid, "seller");
  const foreign = (await holdings.list(db, otherSid))[0];
  if (!foreign) throw new Error("missing foreign holding");
  expect(await getCreateListingModel(seller, foreign.id, db)).toBeNull();
});
it("keeps form models serializable and renders blocked and fully committed holdings", async () => {
  const seller = await viewer(),
    { h } = await facts();
  const form = await getCreateListingModel(seller, h.id, db);
  expect(form).toMatchObject({
    maxSellable: "10000",
    minLot: "2000",
    eligible: true,
    band: { midMinor: "310" },
  });
  expect(() => JSON.stringify(form)).not.toThrow();
  const q = await getCreateListingModel(seller, (await facts("qamra-health")).h.id, db);
  expect(q?.eligible).toBe(false);
  expect(q?.failures).toHaveLength(2);
  expect((await create("wadi-ledger", { quantity: "10000" })).status).toBe("success");
  const m = await getHoldingsModel(seller, db),
    card = m.cards.find((c) => c.id === h.id);
  expect(card?.eligible).toBe(false);
  expect(card?.eligibility.failures).toContain(
    "All shares in this holding are already listed or sold.",
  );
  const noHoldings = await getHoldingsModel(await viewer("operator"), db);
  expect(noHoldings.cards).toEqual([]);
  expect(noHoldings.listings).toEqual([]);
  expect(noHoldings.canAdd).toBe(false);
});
it("resubmits a rejected holding through its domain transition", async () => {
  const { c, cl } = await facts(),
    created = await executeAction(
      createHoldingDef,
      {
        companyId: c.id,
        shareClassId: cl.id,
        quantity: "1000",
        acquiredOn: "2024-01-01",
        evidence: "share_certificate",
      },
      { db, session: session() },
    );
  if (created.status !== "success") throw new Error("create failed");
  const personaUserId = (await viewer()).user.id;
  const admin = (await users.list(db, sid)).find((u) => u.handle === "Wadi Ledger · CFO");
  if (!admin) throw new Error("missing admin");
  await db.transaction(async (tx) => {
    const sandbox = await sandboxes.lockSandbox(tx, sid);
    const r = await runTransition(
      {
        tx,
        sandbox,
        actor: users.toActor(admin),
        now,
        personaUserId,
        depth: 0,
      },
      "holding",
      created.data.holdingId,
      "REJECT",
      { reason: "Register details don't match." },
    );
    expect(r.ok).toBe(true);
  });
  const card = (await getHoldingsModel(await viewer(), db)).cards.find(
    (c) => c.id === created.data.holdingId,
  );
  expect(card).toMatchObject({
    status: "Rejected",
    rejectionReason: "Register details don't match.",
    market: null,
  });
  expect(
    (
      await executeAction(
        resubmitHoldingDef,
        { holdingId: created.data.holdingId },
        { db, session: session() },
      )
    ).status,
  ).toBe("success");
  expect((await holdings.find(db, sid, created.data.holdingId))?.status).toBe("PendingCompany");
  expect(await verifySandboxChain(db, sid)).toMatchObject({ ok: true });
});
it("only the first needs-action listing receives a primary review action", async () => {
  const seller = await viewer(),
    own = (await listings.forSeller(db, sid, seller.user.id))[0];
  if (!own) throw new Error("missing listing");
  await db.transaction((tx) =>
    listings.insert(tx, sid, { ...listings.toListing(own), id: v7(), status: "Closed" }, "L-4001"),
  );
  await db.transaction((tx) =>
    listings.insert(
      tx,
      sid,
      { ...listings.toListing(own), id: v7(), status: "Negotiating" },
      "L-4002",
    ),
  );
  const m = await getHoldingsModel(seller, db);
  expect(m.addPrimary).toBe(false);
  expect(m.listings.filter((l) => l.action?.primary)).toHaveLength(1);
  expect(m.listings.slice(0, 2).every((l) => l.action?.kind === "review")).toBe(true);
});
it("uses only the current user's holdings for every persona", async () => {
  const buyer = await viewer("buyer_a"),
    m = await getHoldingsModel(buyer, db);
  expect(m.cards).toHaveLength(1);
  expect(m.cards[0]?.quantities[0]?.value).toBe("4,000 sh");
  expect(m.canAdd).toBe(false);
  expect(m.cards[0]?.eligible).toBe(false);
});
