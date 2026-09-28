import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { PersonaKey } from "@/config/personas";
import { systemClock } from "@/lib/clock";
import {
  acceptCounterDef,
  amendBidDef,
  declineCounterDef,
  submitBidDef,
  withdrawBidDef,
} from "@/server/actions/bids";
import { simulateCompetingBidDef } from "@/server/actions/demo";
import { createListingDef } from "@/server/actions/holdings";
import { allocateDef, counterDef, declineAllDef } from "@/server/actions/listings";
import { type ActionDef, executeAction } from "@/server/actions/pipeline";
import { readChain, verifySandboxChain } from "@/server/audit";
import { getJobHandler, scheduleAutomation } from "@/server/automation";
import { sandboxClock } from "@/server/clock";
import { closeDatabase, type Db } from "@/server/db/client";
import { accessGrants, users as userTable } from "@/server/db/schema";
import { getBidComposerModel, getMyBidsModel } from "@/server/read/bids";
import { getCompanyModel } from "@/server/read/company";
import { getListingModel } from "@/server/read/listing";
import { refreshSandbox } from "@/server/refresh";
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as grants from "@/server/repositories/grants";
import * as holdings from "@/server/repositories/holdings";
import * as jobs from "@/server/repositories/jobs";
import * as listings from "@/server/repositories/listings";
import * as notifications from "@/server/repositories/notifications";
import { closeRecord } from "@/server/repositories/parties";
import * as sandboxes from "@/server/repositories/sandboxes";
import * as trades from "@/server/repositories/trades";
import * as users from "@/server/repositories/users";
import { ensureSandbox } from "@/server/sandbox";
import { runTransition, type TxContext } from "@/server/transitions";
import type { Viewer } from "@/server/viewer";
import { createTestDb } from "../helpers/db";

const T0 = new Date("2026-09-28T10:00:00Z"),
  DAY = 86400000;
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
  await ensureSandbox(db, sid, "buyer_a");
  await settings({ autopilot: false });
});
async function settings(changes: Parameters<typeof sandboxes.save>[2]) {
  await db.transaction((tx) => sandboxes.save(tx, sid, changes));
}
async function viewer(per: PersonaKey = "buyer_a"): Promise<Viewer> {
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
async function listing(ref = "L-2031") {
  const l = (await listings.listWithRefs(db, sid)).find((l) => l.ref === ref);
  if (!l) throw Error("listing");
  return l;
}
async function submit(ref = "L-2031", extra: Record<string, unknown> = {}) {
  return act("buyer_a", submitBidDef, {
    listingId: (await listing(ref)).id,
    price: "35.50",
    quantity: "5000",
    minFill: "2000",
    rationale: "Long term",
    idempotencyKey: v7(),
    ...extra,
  });
}
async function jump(ms: number) {
  await settings({ clockOffsetMs: ms });
  return refreshSandbox(db, sid);
}
async function asUser<T>(userId: string, fn: (ctx: TxContext) => Promise<T>) {
  return db.transaction(async (tx) => {
    const sandbox = await sandboxes.lockSandbox(tx, sid),
      user = await users.find(tx, sid, userId),
      persona = await users.forPersona(tx, sid, sandbox.persona);
    if (!user) throw Error("user");
    return fn({
      tx,
      sandbox,
      actor: users.toActor(user, true),
      personaUserId: persona.id,
      now: sandboxClock(sandbox).now(),
      depth: 0,
    });
  });
}
function code(result: { status: string; error?: { code: string } }) {
  expect(result.status).toBe("error");
  return result.error?.code;
}
it("submits idempotently, sets the deadline and sends an amount-free notification", async () => {
  const l = await listing(),
    key = v7(),
    input = { idempotencyKey: key },
    r = await submit("L-2031", input);
  expect(r.status).toBe("success");
  if (r.status !== "success") return;
  const b = await bids.find(db, sid, r.data.bidId);
  expect(b).toMatchObject({
    status: "Submitted",
    priceMinor: 3550n,
    quantity: 5000n,
    minFill: 2000n,
  });
  expect(b?.expiresAt).toEqual(new Date((l.windowClosesAt?.getTime() ?? 0) + 14 * DAY));
  const count = (await readChain(db, sid)).length;
  expect(await submit("L-2031", input)).toEqual(r);
  expect((await readChain(db, sid)).length).toBe(count);
  expect(code(await submit())).toBe("DUPLICATE_BID");
  const n = (await notifications.list(db, sid)).find((n) => n.template === "bid_received");
  expect(n?.recipientId).toBe(l.sellerId);
  expect(JSON.stringify(n)).not.toContain("35.50");
  expect((await readChain(db, sid)).at(-1)?.action).toBe("bid.create");
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
it("validates minimums, closed windows, grants, buyer policy and related parties", async () => {
  const r = await submit("L-2031", { quantity: "1000" });
  expect(code(r)).toBe("VALIDATION");
  if (r.status === "error")
    expect(r.error.issues?.[0]?.message).toBe("Minimum for this listing is 2,000 sh.");
  expect(code(await submit("L-2019"))).toBe("BID_WINDOW_CLOSED");
  const l = await listing("L-2027"),
    d = (await users.list(db, sid)).find((u) => u.handle === "Investor #B-352");
  if (!d) throw Error("d");
  const self = await asUser(d.id, (ctx) =>
    submitBidDef.handler(ctx, {
      listingId: l.id,
      price: "35",
      quantity: "5500",
      minFill: "5500",
      rationale: "",
      idempotencyKey: v7(),
    }),
  );
  expect(self.ok).toBe(false);
  if (!self.ok) expect(self.error.code).toBe("SELF_DEALING");
  const buyer = await users.forPersona(db, sid, "buyer_a");
  await db
    .delete(accessGrants)
    .where(and(eq(accessGrants.sandboxId, sid), eq(accessGrants.buyerId, buyer.id)));
  expect(code(await submit())).toBe("FORBIDDEN");
  const seller = await users.forPersona(db, sid, "seller"),
    wadi = (await companies.list(db, sid)).find((c) => c.slug === "wadi-ledger"),
    h = (await holdings.forOwner(db, sid, seller.id)).find((h) => h.companyId === wadi?.id);
  if (!wadi || !h) throw Error("wadi");
  const made = await act("seller", createListingDef, {
    holdingId: h.id,
    quantity: "5000",
    minFill: "2000",
    reservePrice: "3",
    windowDays: 5,
    confirmedOwnership: true,
    clientRequestId: v7(),
  });
  if (made.status !== "success") throw Error("create");
  const op = await users.forPersona(db, sid, "operator");
  await asUser(op.id, (ctx) => runTransition(ctx, "listing", made.data.listingId, "APPROVE", {}));
  const b = await users.forPersona(db, sid, "buyer_b");
  await db.transaction((tx) =>
    grants.insert(tx, sid, {
      id: v7(),
      companyId: wadi.id,
      buyerId: b.id,
      status: "approved",
      ndaVersion: "v1",
      requestedAt: T0,
    }),
  );
  const policy = await act("buyer_b", submitBidDef, {
    listingId: made.data.listingId,
    price: "3",
    quantity: "5000",
    minFill: "2000",
    rationale: "",
    idempotencyKey: v7(),
  });
  expect(code(policy)).toBe("POLICY_BLOCKED");
  if (policy.status === "error")
    expect(policy.error.failures?.map((f) => f.code)).toEqual(["BUYER_TYPE_NOT_ALLOWED"]);
});
it("amends and withdraws while live, and rejects amendments after close", async () => {
  const made = await submit();
  if (made.status !== "success") throw Error("submit");
  const id = made.data.bidId;
  expect(
    (
      await act("buyer_a", amendBidDef, {
        bidId: id,
        price: "35.60",
        quantity: "5000",
        minFill: "2000",
        rationale: "Updated",
      })
    ).status,
  ).toBe("success");
  expect((await bids.find(db, sid, id))?.priceMinor).toBe(3560n);
  expect((await act("buyer_a", withdrawBidDef, { bidId: id })).status).toBe("success");
  expect((await bids.find(db, sid, id))?.status).toBe("Withdrawn");
  const again = await submit();
  if (again.status !== "success") throw Error("again");
  await jump(7 * DAY);
  expect(
    code(
      await act("buyer_a", amendBidDef, {
        bidId: again.data.bidId,
        price: "35.70",
        quantity: "5000",
        minFill: "2000",
        rationale: "",
      }),
    ),
  ).toBe("GUARD_FAILED");
  expect(code(await act("buyer_a", withdrawBidDef, { bidId: again.data.bidId }))).toBe(
    "GUARD_FAILED",
  );
});
it("keeps live bids sealed and reveals the ranked ladder after close", async () => {
  const l = await listing(),
    live = await getListingModel(await viewer("seller"), l.id, db);
  expect(live?.bidLabel).toBe("2 sealed");
  const json = JSON.stringify(live);
  for (const secret of ["AED 35.20", "AED 34.80", "Investor #B-204", "Investor #B-352"])
    expect(json).not.toContain(secret);
  await settings({ persona: "seller" });
  await jump(7 * DAY);
  const closed = await getListingModel(await viewer("seller"), l.id, db);
  expect(
    closed?.ladder?.map((b) => [b.handle, b.price, b.certainty, b.bandLabel, b.total]),
  ).toEqual([
    ["Investor #B-204", "AED 35.20", "New on Atlas", "Within band", "AED 211,200"],
    ["Investor #B-352", "AED 34.80", "New on Atlas", "Within band", "AED 417,600"],
  ]);
});
it("counters in the required order and rolls back guard failures", async () => {
  await settings({ persona: "seller" });
  await jump(7 * DAY);
  const l = await listing(),
    all = await bids.forListing(db, sid, l.id),
    d = all.find((b) => b.priceMinor === 3480n);
  if (!d) throw Error("d");
  const before = (await readChain(db, sid)).length;
  expect(
    code(await act("seller", counterDef, { listingId: l.id, bidId: d.id, price: "34.80" })),
  ).toBe("GUARD_FAILED");
  expect((await readChain(db, sid)).length).toBe(before);
  expect(
    (await act("seller", counterDef, { listingId: l.id, bidId: d.id, price: "35" })).status,
  ).toBe("success");
  expect(await bids.find(db, sid, d.id)).toMatchObject({
    status: "Countered",
    counterPriceMinor: 3500n,
  });
  expect(await listings.find(db, sid, l.id)).toMatchObject({
    status: "Negotiating",
    countersSent: 1,
  });
});
it("limits the fourth counter without weakening the machine", async () => {
  const a = await submit();
  expect(a.status).toBe("success");
  expect(
    (await act("seller", simulateCompetingBidDef, { listingId: (await listing()).id })).status,
  ).toBe("success");
  await jump(7 * DAY);
  const l = await listing(),
    all = await bids.forListing(db, sid, l.id);
  for (const b of all.slice(0, 3))
    expect(
      (await act("seller", counterDef, { listingId: l.id, bidId: b.id, price: "40" })).status,
    ).toBe("success");
  const fourth = all[3];
  if (!fourth) throw Error("fourth");
  expect(
    code(await act("seller", counterDef, { listingId: l.id, bidId: fourth.id, price: "40" })),
  ).toBe("GUARD_FAILED");
  expect((await listings.find(db, sid, l.id))?.countersSent).toBe(3);
});
it("recomputes full allocation, rejects extra quantities and creates two trades", async () => {
  await settings({ persona: "seller" });
  await jump(7 * DAY);
  const l = await listing(),
    all = await bids.forListing(db, sid, l.id),
    input = { listingId: l.id, bidIds: all.map((b) => b.id), backupBidId: null };
  expect(code(await act("seller", allocateDef, { ...input, quantity: "999" }))).toBe("VALIDATION");
  expect((await act("seller", allocateDef, input)).status).toBe("success");
  expect(
    (await trades.forListing(db, sid, l.id)).map((t) => [t.quantity, t.priceMinor, t.status]),
  ).toEqual([
    [6000n, 3520n, "AwaitingDocs"],
    [6000n, 3480n, "AwaitingDocs"],
  ]);
  expect(await listings.find(db, sid, l.id)).toMatchObject({ status: "Allocated" });
  expect(
    (await bids.forListing(db, sid, l.id)).every(
      (b) => b.status === "Accepted" && b.allocatedQty === 6000n,
    ),
  ).toBe(true);
  expect((await holdings.find(db, sid, l.holdingId))?.reservedQty).toBe(12000n);
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
it("assigns backup to the lowest priced trade and releases the remainder", async () => {
  const a = await submit();
  if (a.status !== "success") throw Error("a");
  await settings({ persona: "seller" });
  await jump(7 * DAY);
  const l = await listing(),
    all = await bids.forListing(db, sid, l.id),
    c = all.find((b) => b.priceMinor === 3520n),
    d = all.find((b) => b.priceMinor === 3480n);
  if (!c || !d) throw Error("bids");
  expect(
    (
      await act("seller", allocateDef, {
        listingId: l.id,
        bidIds: [c.id, a.data.bidId],
        backupBidId: d.id,
      })
    ).status,
  ).toBe("success");
  const ts = await trades.forListing(db, sid, l.id);
  expect(ts.find((t) => t.bidId === c.id)).toMatchObject({ quantity: 6000n, backupBidId: d.id });
  expect(ts.find((t) => t.bidId === a.data.bidId)).toMatchObject({
    quantity: 5000n,
    backupBidId: null,
  });
  expect((await bids.find(db, sid, d.id))?.status).toBe("Backup");
  expect((await holdings.find(db, sid, l.holdingId))?.reservedQty).toBe(11000n);
  expect((await readChain(db, sid)).some((e) => e.action === "trade.setBackup")).toBe(true);
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
it("declines every bid and releases shares", async () => {
  await settings({ persona: "seller" });
  await jump(7 * DAY);
  const l = await listing();
  expect((await act("seller", declineAllDef, { listingId: l.id })).status).toBe("success");
  expect((await listings.find(db, sid, l.id))?.status).toBe("Expired");
  expect((await bids.forListing(db, sid, l.id)).every((b) => b.status === "Rejected")).toBe(true);
  expect((await holdings.find(db, sid, l.holdingId))?.reservedQty).toBe(0n);
});
it("simulated seller allocates eligible bids and keeps the best remaining backup", async () => {
  await settings({ autopilot: true });
  const a = await submit();
  if (a.status !== "success") throw Error("a");
  await jump(7 * DAY);
  const l = await listing(),
    ts = await trades.forListing(db, sid, l.id);
  expect(ts.map((t) => [t.quantity, t.priceMinor])).toEqual([
    [5000n, 3550n],
    [6000n, 3520n],
  ]);
  const d = (await bids.forListing(db, sid, l.id)).find((b) => b.priceMinor === 3480n);
  expect(d?.status).toBe("Backup");
  expect(ts.find((t) => t.priceMinor === 3520n)?.backupBidId).toBe(d?.id);
  const entry = (await readChain(db, sid)).find(
    (e) => e.action === "listing.ALLOCATE" && e.entityId === l.id,
  );
  expect(entry).toMatchObject({ actorId: l.sellerId, simulated: true });
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
it.each([
  true,
  false,
])("completes L-2019 counter response (accept=%s) with simulated seller", async (accept) => {
  await settings({ autopilot: true });
  const l = await listing("L-2019"),
    a = (await bids.forListing(db, sid, l.id))[0];
  if (!a) throw Error("a");
  expect(
    (await act("buyer_a", accept ? acceptCounterDef : declineCounterDef, { bidId: a.id })).status,
  ).toBe("success");
  expect(
    (await jobs.list(db, sid)).filter((j) => j.kind === "seller_decide" && j.entityId === l.id),
  ).toHaveLength(1);
  await jump(3000);
  expect((await listings.find(db, sid, l.id))?.status).toBe(accept ? "Allocated" : "Expired");
  if (accept)
    expect((await trades.forListing(db, sid, l.id))[0]).toMatchObject({
      buyerId: a.buyerId,
      quantity: 3000n,
      priceMinor: 3550n,
    });
  else {
    expect((await bids.find(db, sid, a.id))?.status).toBe("Rejected");
    expect((await holdings.find(db, sid, l.holdingId))?.reservedQty).toBe(0n);
  }
});
it("simulated buyer accepts a counter while the owning seller stays human", async () => {
  await settings({ persona: "seller", autopilot: true });
  await jump(7 * DAY);
  const l = await listing(),
    d = (await bids.forListing(db, sid, l.id)).find((b) => b.priceMinor === 3480n);
  if (!d) throw Error("d");
  await act("seller", counterDef, { listingId: l.id, bidId: d.id, price: "35" });
  await jump(7 * DAY + 5000);
  expect(await bids.find(db, sid, d.id)).toMatchObject({
    status: "Submitted",
    counterOutcome: "accepted",
    priceMinor: 3500n,
  });
  expect((await listings.find(db, sid, l.id))?.status).toBe("Negotiating");
  expect(
    (await jobs.list(db, sid)).some((j) => j.kind === "seller_decide" && j.entityId === l.id),
  ).toBe(false);
});
it("simulates a deterministic sealed bid and targets the soonest listing for an uninvested buyer", async () => {
  const l = await listing();
  const r = await act("seller", simulateCompetingBidDef, {});
  expect(r.status).toBe("success");
  const all = await bids.forListing(db, sid, l.id),
    e = (await users.list(db, sid)).find((u) => u.handle === "Investor #B-409");
  expect(all.find((b) => b.buyerId === e?.id)).toMatchObject({
    priceMinor: 3687n,
    quantity: 12000n,
    minFill: 6000n,
  });
  expect(all).toHaveLength(3);
  expect(code(await act("seller", simulateCompetingBidDef, {}))).toBe("VALIDATION");
  const buyer = await act("buyer_a", simulateCompetingBidDef, {});
  if (buyer.status !== "success") throw Error("buyer");
  expect(buyer.data.ref).toBe("L-2027");
  expect(JSON.stringify(buyer)).not.toContain("price");
});
it("keeps composer public, hides inaccessible prices and enforces listing access", async () => {
  const l = await listing(),
    composer = await getBidComposerModel(await viewer(), l.id, db);
  expect(JSON.stringify(composer)).not.toMatch(/reserve/i);
  expect(composer?.market.fairValue).toBe("AED 34.20–36.10");
  expect((await getListingModel(await viewer(), l.id, db))?.redirect).toBe(`/listings/${l.id}/bid`);
  expect(
    await getListingModel(await viewer("seller"), (await listing("L-2027")).id, db),
  ).toBeNull();
  expect((await getListingModel(await viewer("operator"), l.id, db))?.editable).toBe(false);
  await settings({ persona: "seller" });
  await jump(7 * DAY);
  const op = await getListingModel(await viewer("operator"), l.id, db);
  expect(op?.ladder?.every((b) => !b.canCounter && !b.selectable)).toBe(true);
  expect((await getListingModel(await viewer("company_admin"), l.id, db))?.redirect).toBe(
    "/companies/falaj-robotics",
  );
  expect((await getBidComposerModel(await viewer("seller"), l.id, db))?.blocked).toEqual([
    "Only buyers can bid.",
  ]);
});
it("shows the seed counter, past trade, close record and fixed company ordering", async () => {
  const m = await getMyBidsModel(await viewer(), db);
  expect(m.counters[0]?.counter?.description).toContain(
    "Holder #S-102 countered your AED 34.00 bid at AED 35.50 for 3,000 sh (total AED 106,500)",
  );
  expect(m.rows.find((r) => !r.active)?.badges[0]?.text).toBe("Accepted · 4,000 sh");
  expect(m.rows.find((r) => !r.active)?.action?.label).toBe("Open trade");
  expect(await closeRecord(db, sid, (await viewer()).user.id)).toEqual({ settled: 1, total: 1 });
  expect(
    (await getCompanyModel(await viewer(), "falaj-robotics", db))?.listings.map((l) => l.ref),
  ).toEqual(["L-2019", "L-2027", "L-2031"]);
});

it("does not run the seller's pending job when that seller becomes the persona", async () => {
  await settings({ persona: "buyer_a", autopilot: true });
  await jump(5 * DAY);
  const l = await listing();
  expect(
    (await jobs.list(db, sid)).filter((j) => j.kind === "seller_decide" && j.entityId === l.id),
  ).toHaveLength(1);
  await settings({ persona: "seller" });
  await jump(5 * DAY + 5000);
  expect((await listings.find(db, sid, l.id))?.status).toBe("Closed");
  expect((await jobs.list(db, sid)).some((j) => j.entityId === l.id)).toBe(true);
  await settings({ persona: "buyer_a", autopilot: false });
  await refreshSandbox(db, sid);
  expect((await listings.find(db, sid, l.id))?.status).toBe("Closed");
  await settings({ autopilot: true });
  await refreshSandbox(db, sid);
  expect((await listings.find(db, sid, l.id))?.status).toBe("Allocated");
});
it("custom seller handler skips decided listings and pending counters, and counters a near-reserve bid", async () => {
  const handler = getJobHandler("seller_decide");
  if (!handler) throw Error("handler");
  const enqueue = async (ref: string) => {
    const l = await listing(ref);
    await db.transaction((tx) =>
      jobs.insert(tx, sid, {
        id: v7(),
        sandboxId: sid,
        dueAt: T0,
        kind: "seller_decide",
        entity: "listing",
        entityId: l.id,
        event: "DECIDE",
        partyUserId: l.sellerId,
        status: "pending",
        resultCode: null,
        createdAt: T0,
        executedAt: null,
      }),
    );
    const job = (await jobs.list(db, sid)).find((j) => j.entityId === l.id);
    if (!job) throw Error("job");
    return { l, job };
  };
  const allocated = await enqueue("L-2008");
  expect(await asUser(allocated.l.sellerId, (ctx) => handler(ctx, allocated.job))).toEqual({
    status: "skipped",
    code: "ALREADY_DECIDED",
  });
  const countered = await enqueue("L-2019");
  expect(await asUser(countered.l.sellerId, (ctx) => handler(ctx, countered.job))).toEqual({
    status: "skipped",
    code: "AWAITING_COUNTER",
  });
  await settings({ persona: "seller" });
  await jump(7 * DAY);
  const l = await listing();
  await db.transaction(async (tx) => {
    const prev = await listings.getForUpdate(tx, sid, l.id);
    if (!prev) throw Error("listing");
    await listings.save(
      tx,
      { ...prev, reservePriceMinor: 3550n, version: prev.version + 1 },
      prev.version,
    );
  });
  const near = await enqueue("L-2031");
  const r = await asUser(l.sellerId, (ctx) => handler(ctx, near.job));
  expect("ok" in r && r.ok).toBe(true);
  const all = await bids.forListing(db, sid, l.id);
  expect(all.find((b) => b.priceMinor === 3520n)).toMatchObject({
    status: "Countered",
    counterPriceMinor: 3550n,
  });
});
it("deduplicates seller jobs after repeated scheduling", async () => {
  await settings({ autopilot: true });
  const l = await listing("L-2019"),
    b = (await bids.forListing(db, sid, l.id))[0];
  if (!b) throw Error("bid");
  await act("buyer_a", acceptCounterDef, { bidId: b.id });
  const next = await bids.find(db, sid, b.id);
  if (!next) throw Error("bid");
  await asUser(b.buyerId, (ctx) => scheduleAutomation(ctx, "bid", next));
  expect(
    (await jobs.list(db, sid)).filter((j) => j.kind === "seller_decide" && j.entityId === l.id),
  ).toHaveLength(1);
});
it("keeps grants and trade visibility server-side and returns useful competing-bid errors", async () => {
  const l = await listing(),
    buyer = await users.forPersona(db, sid, "buyer_a");
  await db
    .delete(accessGrants)
    .where(
      and(
        eq(accessGrants.sandboxId, sid),
        eq(accessGrants.companyId, l.companyId),
        eq(accessGrants.buyerId, buyer.id),
      ),
    );
  const denied = await getBidComposerModel(await viewer(), l.id, db);
  expect(denied?.blocked).toEqual(["Request access to Falaj Robotics first."]);
  const b = await users.forPersona(db, sid, "buyer_b"),
    company = (await companies.list(db, sid)).find((c) => c.slug === "qamra-health");
  if (!company) throw Error("company");
  const g = await grants.find(db, sid, l.companyId, b.id);
  if (!g) throw Error("grant");
  await db
    .delete(accessGrants)
    .where(and(eq(accessGrants.sandboxId, sid), eq(accessGrants.id, g.id)));
  // A denied company projection cannot leak prices even though the gate prevents bidding.
  expect((await getBidComposerModel(await viewer("buyer_b"), l.id, db))?.market.lastTrade).toBe(
    "AED 35.80",
  );
  const id = v7();
  await db.insert(userTable).values({ ...b, id, personaKey: null, handle: "Investor #B-test-5" });
  const base = await viewer("buyer_b");
  const hidden = await getBidComposerModel(
    { ...base, user: { ...base.user, id }, actor: { ...base.actor, userId: id } },
    l.id,
    db,
  );
  expect(hidden?.market.lastTrade).toBe("Not disclosed");
  expect(hidden?.band).toMatchObject({ low: "4200", mid: "4200", high: "4200", estimate: true });
  expect(JSON.stringify(hidden)).not.toContain("3580");
  expect(await getBidComposerModel(await viewer(), v7(), db)).toBeNull();
  expect(await getListingModel(await viewer("seller"), v7(), db)).toBeNull();
  const otherSid = v7();
  await ensureSandbox(db, otherSid, "buyer_a");
  const other = (await listings.list(db, otherSid))[0];
  if (!other) throw Error("other");
  expect(
    code(
      await act("buyer_a", submitBidDef, {
        listingId: other.id,
        price: "35",
        quantity: "5000",
        minFill: "2000",
        idempotencyKey: "retry-key",
        rationale: "",
      }),
    ),
  ).toBe("NOT_FOUND");
  const result = await act("seller", simulateCompetingBidDef, { listingId: v7() });
  expect(code(result)).toBe("VALIDATION");
  if (result.status === "error")
    expect(result.error.message).toBe("There's no live listing to bid on right now.");
});
it("rejects invalid selected bids and backs up only an unallocated submitted bid", async () => {
  await settings({ persona: "seller" });
  await jump(7 * DAY);
  const l = await listing(),
    all = await bids.forListing(db, sid, l.id),
    id = all[0]?.id;
  if (!id) throw Error("bid");
  for (const input of [
    { bidIds: [], backupBidId: null },
    { bidIds: [id, id], backupBidId: null },
    { bidIds: [v7()], backupBidId: null },
    { bidIds: [id], backupBidId: id },
    { bidIds: [id], backupBidId: v7() },
  ]) {
    const before = (await readChain(db, sid)).length;
    expect(code(await act("seller", allocateDef, { listingId: l.id, ...input }))).toBe(
      "VALIDATION",
    );
    expect((await readChain(db, sid)).length).toBe(before);
    expect(await trades.forListing(db, sid, l.id)).toHaveLength(0);
  }
});
it("rate limits submission and accepts non-UUID idempotency keys", async () => {
  const input = { idempotencyKey: "retry-key" };
  for (let i = 0; i < 10; i++) expect((await submit("L-2031", input)).status).toBe("success");
  expect(code(await submit("L-2031", input))).toBe("RATE_LIMITED");
});
