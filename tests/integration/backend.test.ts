import { and, eq, getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { v7 } from "uuid";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import type { PersonaKey } from "@/config/personas";
import { allocate } from "@/domain/allocation";
import { createListing } from "@/domain/listing";
import { evaluateBuyer, evaluateSellerEligibility } from "@/domain/policy";
import { fairValueBand, fallbackPriceForClass } from "@/domain/pricing";
import { err, ok } from "@/domain/result";
import { systemClock } from "@/lib/clock";
import { executeAction } from "@/server/actions/pipeline";
import { appendAudit, readChain, verifySandboxChain } from "@/server/audit";
import { registerJobHandler, scheduleAutomation } from "@/server/automation";
import { closeDatabase, type Db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { ConflictError } from "@/server/errors";
import { refreshSandbox } from "@/server/refresh";
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as holdings from "@/server/repositories/holdings";
import * as jobs from "@/server/repositories/jobs";
import * as listings from "@/server/repositories/listings";
import * as mandates from "@/server/repositories/mandates";
import * as sandboxes from "@/server/repositories/sandboxes";
import * as trades from "@/server/repositories/trades";
import * as users from "@/server/repositories/users";
import { ensureSandbox, lockSandbox, resetSandbox, touchSandbox } from "@/server/sandbox";
import type { SessionClaims } from "@/server/session";
import { runTransition, type TxContext } from "@/server/transitions";
import { createTestDb } from "./helpers/db";

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
  await ensureSandbox(db, sid, "seller");
  await db.transaction((tx) => sandboxes.save(tx, sid, { autopilot: false }));
});
const session = (per: PersonaKey = "seller"): SessionClaims => ({
  sid,
  per,
  iss: "atlas",
  aud: "atlas-demo",
  iat: T0.getTime() / 1000,
  exp: T0.getTime() / 1000 + 604800,
});
async function context<T>(handle: string, fn: (ctx: TxContext) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const sandbox = await lockSandbox(tx, sid),
      user = (await users.list(tx, sid)).find((u) => u.handle === handle);
    if (!user) throw new Error("Fixture user missing");
    const persona = await users.forPersona(tx, sid, sandbox.persona);
    return fn({
      tx,
      sandbox,
      actor: users.toActor(user),
      now: new Date(T0.getTime() + sandbox.clockOffsetMs),
      personaUserId: persona.id,
      depth: 0,
    });
  });
}
async function advance(ms: number) {
  await db.transaction(async (tx) => {
    const s = await lockSandbox(tx, sid);
    await sandboxes.save(tx, sid, { clockOffsetMs: s.clockOffsetMs + ms });
  });
  return refreshSandbox(db, sid);
}
async function listingByRef(ref: string) {
  const [row] = await db
    .select()
    .from(schema.listings)
    .where(and(eq(schema.listings.sandboxId, sid), eq(schema.listings.ref, ref)));
  if (!row) throw new Error("Listing missing");
  return row;
}
async function tradeByRef(ref: string) {
  const [row] = await db
    .select()
    .from(schema.trades)
    .where(and(eq(schema.trades.sandboxId, sid), eq(schema.trades.ref, ref)));
  if (!row) throw new Error("Trade missing");
  return row;
}
async function submitWadi() {
  return context("Holder #S-214", async (ctx) => {
    const company = (await companies.list(ctx.tx, sid)).find((c) => c.slug === "wadi-ledger");
    if (!company) throw new Error("Company missing");
    const holding = (await holdings.list(ctx.tx, sid)).find(
      (h) => h.ownerId === ctx.actor.userId && h.companyId === company.id,
    );
    if (!holding) throw new Error("Holding missing");
    const created = createListing(
      {
        holding,
        quantity: 2000n,
        minFill: 2000n,
        reservePriceMinor: 310n,
        windowDays: 3,
        currency: "USD",
      },
      { id: v7(), now: ctx.now, actor: ctx.actor },
    );
    if (!created.ok) throw new Error("Creation failed");
    await listings.insert(ctx.tx, sid, created.value, "L-3001");
    const result = await runTransition(ctx, "listing", created.value.id, "SUBMIT", {});
    expect(result.ok).toBe(true);
    return created.value.id;
  });
}
it("migrations create all 23 tables with snake_case columns", async () => {
  const tables = await db.execute(
    sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`,
  );
  expect(tables.rows).toHaveLength(23);
  const cols = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name='holdings'`,
  );
  expect(cols.rows).toContainEqual({ column_name: "reserved_qty" });
});
it("seed counts, derived bands, policy failures, demand and trusted audit match the specification", async () => {
  const counts: Record<string, number> = {
    sandboxes: 1,
    organizations: 10,
    users: 13,
    beneficial_owners: 1,
    companies: 3,
    share_classes: 8,
    transfer_policies: 3,
    holdings: 6,
    listings: 4,
    bids: 7,
    trades: 2,
    trade_prints: 10,
    access_grants: 7,
    qa_entries: 3,
    mandates: 5,
    documents: 7,
    message_threads: 0,
    messages: 0,
    notifications: 2,
    escrow_events: 3,
    automation_jobs: 0,
    audit_log: 1,
    rate_limits: 0,
  };
  for (const table of Object.values(schema).filter((v) => is(v, PgTable))) {
    const name = getTableName(table),
      predicate = name === "sandboxes" ? sql`id=${sid}` : sql`sandbox_id=${sid}`;
    const result = await db.execute(
      sql`SELECT COUNT(*)::int AS count FROM ${table} WHERE ${predicate}`,
    );
    expect(result.rows[0]?.count, name).toBe(counts[name]);
  }
  const all = await companies.list(db, sid),
    seller = await users.forPersona(db, sid, "seller");
  for (const c of all) {
    const classes = await companies.classes(db, sid, c.id),
      ordinary = classes.find((s) => s.kind === "ordinary");
    if (!ordinary) throw new Error("Ordinary missing");
    const prints = (
      await db.select().from(schema.tradePrints).where(eq(schema.tradePrints.sandboxId, sid))
    ).filter((p) => p.companyId === c.id);
    const fallback = fallbackPriceForClass({
      company: companies.toCompany(c),
      classes,
      shareClassId: ordinary.id,
    });
    const band = fairValueBand({ trades: prints, now: T0, fallbackMinor: fallback });
    expect(band).toMatchObject(
      c.slug === "falaj-robotics"
        ? { method: "trades", lowMinor: 3420n, midMinor: 3580n, highMinor: 3610n, tradeCount: 6 }
        : c.slug === "wadi-ledger"
          ? { method: "trades", lowMinor: 295n, midMinor: 310n, highMinor: 330n }
          : { method: "waterfall", midMinor: 1850n },
    );
    expect(await mandates.demandCount(db, sid, c.id)).toBe(
      c.slug === "falaj-robotics" ? 4 : c.slug === "wadi-ledger" ? 2 : 1,
    );
    const holding = (await holdings.list(db, sid)).find(
      (h) => h.ownerId === seller.id && h.companyId === c.id,
    );
    if (!holding) throw new Error("Holding missing");
    const policy = await companies.policy(db, sid, c.id);
    const eligibility = evaluateSellerEligibility({
      policy,
      holding,
      soldInLast12Months: await holdings.committedQty(db, sid, holding.id, T0),
      now: T0,
    });
    if (c.slug === "qamra-health")
      expect(eligibility.failures.map((f) => f.code)).toEqual(["LOCKUP_ACTIVE", "BLACKOUT_ACTIVE"]);
    else
      expect(eligibility).toMatchObject({
        ok: true,
        maxSellable: c.slug === "falaj-robotics" ? 3000n : 10000n,
      });
    const b = await users.forPersona(db, sid, "buyer_b");
    if (!b.orgId || !b.investorType) throw new Error("Buyer missing");
    if (c.slug === "wadi-ledger")
      expect(
        evaluateBuyer({
          policy,
          buyer: {
            userId: b.id,
            orgId: b.orgId,
            investorType: b.investorType,
            kycStatus: b.kycStatus,
            professionalVerified: b.professionalVerified,
          },
        }).failures.map((f) => f.code),
      ).toEqual(["BUYER_TYPE_NOT_ALLOWED"]);
    if (c.slug === "falaj-robotics")
      expect(
        evaluateBuyer({
          policy,
          buyer: {
            userId: v7(),
            orgId: policy.blockedOrgIds[0] ?? "",
            investorType: "fund",
            kycStatus: "verified",
            professionalVerified: true,
          },
        }).failures.map((f) => f.code),
      ).toEqual(["BUYER_BLOCKED"]);
  }
  expect(await readChain(db, sid)).toHaveLength(1);
  expect(await verifySandboxChain(db, sid)).toEqual({ ok: true, count: 1 });
});
it("concurrent first requests seed once; reset cascades; old sandboxes purge on insert", async () => {
  const newSid = v7();
  await Promise.all(Array.from({ length: 8 }, () => ensureSandbox(db, newSid, "buyer_a")));
  expect(await users.list(db, newSid)).toHaveLength(13);
  expect(await readChain(db, newSid)).toHaveLength(1);
  await db.transaction(async (tx) => {
    await lockSandbox(tx, newSid);
    await sandboxes.save(tx, newSid, { lastSeenAt: new Date(T0.getTime() - 8 * 86400000) });
  });
  await ensureSandbox(db, v7(), "buyer_a");
  expect(await sandboxes.find(db, newSid)).toBeNull();
  const seller = await users.forPersona(db, sid, "seller");
  const trade = await tradeByRef("T-1042");
  await db.transaction(async (tx) => {
    await lockSandbox(tx, sid);
    const threadId = v7();
    await tx
      .insert(schema.messageThreads)
      .values({ id: threadId, sandboxId: sid, tradeId: trade.id, createdAt: T0 });
    await tx.insert(schema.messages).values({
      id: v7(),
      sandboxId: sid,
      threadId,
      senderId: seller.id,
      bodyRedacted: "Transfer update",
      flagged: false,
      found: [],
      createdAt: T0,
    });
    await jobs.insert(tx, sid, {
      id: v7(),
      sandboxId: sid,
      kind: "cascade_fixture",
      entity: "trade",
      entityId: trade.id,
      partyUserId: seller.id,
      status: "pending",
      createdAt: T0,
      dueAt: T0,
    });
    await tx
      .insert(schema.rateLimits)
      .values({ sandboxId: sid, key: "cascade_fixture", windowStart: T0, count: 1 });
  });
  for (const table of Object.values(schema).filter((v) => is(v, PgTable))) {
    const name = getTableName(table);
    const result = await db.execute(
      sql`SELECT COUNT(*)::int AS count FROM ${table} WHERE ${name === "sandboxes" ? sql`id=${sid}` : sql`sandbox_id=${sid}`}`,
    );
    expect(result.rows[0]?.count, name).toBeGreaterThan(0);
  }
  const newId = await resetSandbox(db, sid, "seller");
  expect((await sandboxes.find(db, newId))?.persona).toBe("seller");
  for (const table of Object.values(schema).filter((v) => is(v, PgTable))) {
    const name = getTableName(table);
    const result = await db.execute(
      sql`SELECT COUNT(*)::int AS count FROM ${table} WHERE ${name === "sandboxes" ? sql`id=${sid}` : sql`sandbox_id=${sid}`}`,
    );
    expect(result.rows[0]?.count, name).toBe(0);
  }
});
it("holding checks reject over-reservation; bid idempotency and active uniqueness are enforced", async () => {
  const h = (await holdings.list(db, sid))[0];
  if (!h) throw new Error("Holding missing");
  await expect(
    db
      .update(schema.holdings)
      .set({ reservedQty: h.quantity + 1n })
      .where(eq(schema.holdings.id, h.id)),
  ).rejects.toThrow();
  const b = (await bids.list(db, sid)).find((b) => b.status === "Submitted");
  if (!b) throw new Error("Bid missing");
  await expect(db.insert(schema.bids).values({ ...b, id: v7() })).rejects.toThrow();
  await expect(
    db.insert(schema.bids).values({ ...b, id: v7(), idempotencyKey: v7() }),
  ).rejects.toThrow();
  await db.insert(schema.bids).values({ ...b, id: v7(), idempotencyKey: v7(), status: "Rejected" });
});
it("submission reserves shares; unauthorized approval writes nothing; stale saves conflict", async () => {
  const id = await submitWadi(),
    l = await listings.find(db, sid, id);
  if (!l) throw new Error("Listing missing");
  expect((await holdings.find(db, sid, l.holdingId))?.reservedQty).toBe(2000n);
  const before = (await readChain(db, sid)).length;
  const denied = await context("Investor #B-081", (ctx) =>
    runTransition(ctx, "listing", id, "APPROVE", {}),
  );
  expect(denied).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  expect((await listings.find(db, sid, id))?.status).toBe("InReview");
  expect(await readChain(db, sid)).toHaveLength(before);
  await expect(
    context("Holder #S-214", (ctx) => listings.save(ctx.tx, l, l.version - 1)),
  ).rejects.toBeInstanceOf(ConflictError);
});
it("withdraw rejects both bids, releases shares and writes one audit per transition", async () => {
  const l = await listingByRef("L-2031");
  await context("Holder #S-214", async (ctx) =>
    expect((await runTransition(ctx, "listing", l.id, "WITHDRAW", {})).ok).toBe(true),
  );
  expect(
    (await bids.list(db, sid)).filter((b) => b.listingId === l.id).map((b) => b.status),
  ).toEqual(["Rejected", "Rejected"]);
  expect((await holdings.find(db, sid, l.holdingId))?.reservedQty).toBe(0n);
  expect(await readChain(db, sid)).toHaveLength(4);
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
async function fullTradePath() {
  const t = await tradeByRef("T-1042");
  for (const [handle, event] of [
    ["Falaj Robotics · CFO", "WAIVE"],
    ["Investor #B-117", "MARK_WIRE_SENT"],
    ["Atlas compliance · second approver", "CONFIRM_FUNDS"],
    ["Falaj Robotics · CFO", "UPLOAD_REGISTER"],
    ["Atlas compliance · second approver", "APPROVE_RELEASE"],
    ["Atlas compliance", "APPROVE_RELEASE"],
  ] as const)
    expect(
      (await context(handle, (ctx) => runTransition(ctx, "trade", t.id, event, {}))).ok,
      event,
    ).toBe(true);
  return t;
}
it("full manual trade settles holdings, prints, escrow, documents, recipients and audit", async () => {
  const t = await fullTradePath();
  expect((await trades.find(db, sid, t.id))?.status).toBe("Settled");
  expect(await holdings.find(db, sid, t.holdingId)).toMatchObject({
    soldQty: 6500n,
    reservedQty: 5500n,
  });
  expect((await holdings.list(db, sid)).find((h) => h.ownerId === t.buyerId)).toMatchObject({
    quantity: 2500n,
    status: "Verified",
  });
  const prints = await db
    .select()
    .from(schema.tradePrints)
    .where(and(eq(schema.tradePrints.sandboxId, sid), eq(schema.tradePrints.tradeId, t.id)));
  expect(prints).toHaveLength(1);
  const escrow = await db
    .select()
    .from(schema.escrowEvents)
    .where(and(eq(schema.escrowEvents.sandboxId, sid), eq(schema.escrowEvents.tradeId, t.id)));
  expect(escrow.map((e) => e.kind)).toEqual(["wire_sent", "funded", "released"]);
  expect(escrow.every((e) => e.amountMinor === 9000000n)).toBe(true);
  const docs = await db
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.sandboxId, sid), eq(schema.documents.tradeId, t.id)));
  expect(docs.map((d) => d.kind)).toEqual([
    "transfer_agreement",
    "register_extract",
    "completion_certificate",
  ]);
  const ns = await db
    .select()
    .from(schema.notifications)
    .where(and(eq(schema.notifications.sandboxId, sid), eq(schema.notifications.entityId, t.id)));
  expect(ns.find((n) => n.template === "funds_due")?.recipientId).toBe(t.buyerId);
  expect(ns.find((n) => n.template === "rofr_waived")?.recipientId).toBe(t.sellerId);
  const admin = await users.forPersona(db, sid, "company_admin");
  expect(ns.find((n) => n.template === "register_update_due")?.recipientId).toBe(admin.id);
  expect(ns.filter((n) => n.template === "wire_sent")).toHaveLength(2);
  expect(
    ns
      .filter((n) => n.template === "settled")
      .map((n) => n.recipientId)
      .sort(),
  ).toEqual([t.sellerId, t.buyerId].sort());
  expect(await verifySandboxChain(db, sid)).toEqual({ ok: true, count: 7 });
});
it("deadline jumps use effective times and subsequently default the buyer", async () => {
  await advance(30 * 86400000);
  for (const ref of ["L-2031", "L-2027", "L-2019"])
    expect((await listingByRef(ref)).status).toBe("Expired");
  const counter = (await bids.list(db, sid)).find((b) => b.counterPriceMinor !== null);
  expect(counter?.counterOutcome).toBe("lapsed");
  const t = await tradeByRef("T-1042");
  expect(t).toMatchObject({
    status: "AwaitingFunds",
    fundingDeadline: new Date(T0.getTime() + 31 * 86400000),
  });
  expect(
    (await holdings.find(db, sid, (await listingByRef("L-2031")).holdingId))?.reservedQty,
  ).toBe(0n);
  await advance(7 * 86400000);
  expect(await trades.find(db, sid, t.id)).toMatchObject({
    status: "Cancelled",
    cancelReason: "buyer_default",
  });
  expect((await holdings.find(db, sid, t.holdingId))?.reservedQty).toBe(0n);
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
it.each([
  "seller",
  "operator",
] as const)("auto-pilot approves a submitted listing for persona %s using the second operator", async (persona) => {
  await db.transaction((tx) => sandboxes.save(tx, sid, { autopilot: true, persona }));
  const id = await submitWadi();
  const pending = await jobs.list(db, sid);
  expect(pending).toHaveLength(1);
  expect(pending[0]?.event).toBe("APPROVE");
  await advance(3000);
  expect((await listings.find(db, sid, id))?.status).toBe("Live");
  const entry = (await readChain(db, sid)).at(-1),
    second = (await users.list(db, sid)).find((u) => u.simulatedOnly && u.role === "operator");
  expect(entry).toMatchObject({ actorId: second?.id, simulated: true, action: "listing.APPROVE" });
});
it("buyer persona must send the wire, then simulated actors settle with two different approvals", async () => {
  await db.transaction((tx) => sandboxes.save(tx, sid, { autopilot: true, persona: "buyer_b" }));
  const t = await tradeByRef("T-1042");
  expect(
    (await context("Falaj Robotics · CFO", (ctx) => runTransition(ctx, "trade", t.id, "WAIVE", {})))
      .ok,
  ).toBe(true);
  expect(await jobs.list(db, sid)).toHaveLength(0);
  expect(
    (
      await context("Investor #B-117", (ctx) =>
        runTransition(ctx, "trade", t.id, "MARK_WIRE_SENT", {}),
      )
    ).ok,
  ).toBe(true);
  expect((await jobs.list(db, sid)).map((j) => j.event)).toEqual(["CONFIRM_FUNDS"]);
  await advance(13000);
  const next = await trades.find(db, sid, t.id);
  expect(next?.status).toBe("Settled");
  expect(new Set(next?.releaseApprovals).size).toBe(2);
  expect(
    (await readChain(db, sid))
      .filter((a) => a.action === "trade.APPROVE_RELEASE")
      .every((a) => a.simulated),
  ).toBe(true);
});
it("off keeps jobs pending, persona switch pauses their jobs, and on executes them", async () => {
  await db.transaction((tx) => sandboxes.save(tx, sid, { autopilot: true }));
  const id = await submitWadi();
  await db.transaction((tx) => sandboxes.save(tx, sid, { autopilot: false }));
  await advance(3000);
  expect(await jobs.list(db, sid)).toHaveLength(1);
  // A company verification job demonstrates switching to its concrete persona user.
  const admin = await users.forPersona(db, sid, "company_admin");
  await db.transaction(async (tx) => {
    await lockSandbox(tx, sid);
    await jobs.insert(tx, sid, {
      id: v7(),
      sandboxId: sid,
      kind: "unknown",
      entity: "listing",
      entityId: id,
      event: null,
      partyUserId: admin.id,
      status: "pending",
      createdAt: T0,
      dueAt: T0,
    });
    await sandboxes.save(tx, sid, { autopilot: true, persona: "company_admin" });
  });
  const result = await refreshSandbox(db, sid);
  expect(result.pendingJobs).toBe(0);
  expect(await jobs.list(db, sid)).toHaveLength(1);
  await db.transaction((tx) => sandboxes.save(tx, sid, { persona: "seller" }));
  await refreshSandbox(db, sid);
  const remaining = await jobs.list(db, sid);
  expect(remaining.filter((j) => j.entity === "listing")).toHaveLength(0);
  expect(remaining).toMatchObject([
    { entity: "trade", event: "WAIVE", entityId: (await tradeByRef("T-1042")).id },
  ]);
  const unknown = await db
    .select()
    .from(schema.automationJobs)
    .where(
      and(eq(schema.automationJobs.sandboxId, sid), eq(schema.automationJobs.kind, "unknown")),
    );
  expect(unknown[0]).toMatchObject({ status: "skipped", resultCode: "UNKNOWN_KIND" });
});
it("actions validate, rollback domain errors, redact internal errors, map conflicts and reject bigint", async () => {
  const def = {
    name: "test",
    input: z.object({ value: z.string() }),
    handler: async () => ok({ value: "ok" }),
  };
  expect(await executeAction(def, { value: "x" }, { db, session: null })).toMatchObject({
    status: "error",
    error: { code: "UNAUTHENTICATED" },
  });
  expect(await executeAction(def, { value: 12 }, { db, session: session() })).toMatchObject({
    status: "error",
    error: { code: "VALIDATION", issues: [{ field: "value" }] },
  });
  const failed = await executeAction(
    {
      ...def,
      handler: async (ctx) => {
        await sandboxes.save(ctx.tx, sid, { clockOffsetMs: 999 });
        await appendAudit(ctx, {
          action: "test",
          entity: "sandbox",
          entityId: sid,
          before: null,
          after: {},
        });
        return err({ code: "GUARD_FAILED" as const, message: "Blocked" });
      },
    },
    { value: "x" },
    { db, session: session() },
  );
  expect(failed).toMatchObject({ status: "error", error: { code: "GUARD_FAILED" } });
  expect((await sandboxes.find(db, sid))?.clockOffsetMs).toBe(0);
  expect(await readChain(db, sid)).toHaveLength(1);
  const conflict = await executeAction(
    {
      ...def,
      handler: async () => {
        throw new ConflictError();
      },
    },
    { value: "x" },
    { db, session: session() },
  );
  expect(conflict).toMatchObject({ error: { code: "CONFLICT" } });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const internal = await executeAction(
    {
      ...def,
      handler: async () => {
        throw new Error("secret detail");
      },
    },
    { value: "x" },
    { db, session: session() },
  );
  expect(internal).toMatchObject({
    status: "error",
    error: { code: "INTERNAL", ref: expect.any(String) },
  });
  expect(JSON.stringify(internal)).not.toContain("secret detail");
  expect(log.mock.calls.flat().join(" ")).not.toContain("secret detail");
  log.mockRestore();
  await expect(
    executeAction(
      { ...def, handler: async () => ok({ quantity: 1n }) },
      { value: "x" },
      { db, session: session() },
    ),
  ).rejects.toThrow("bigint");
});
it("the 61st action in a fixed real-time window is rate limited", async () => {
  const def = { name: "limited", input: z.object({}), handler: async () => ok({}) };
  for (let i = 0; i < 60; i++)
    expect((await executeAction(def, {}, { db, session: session() })).status).toBe("success");
  expect(await executeAction(def, {}, { db, session: session() })).toMatchObject({
    status: "error",
    error: { code: "RATE_LIMITED" },
  });
});
it("sandbox isolation conceals foreign listing ids without writes", async () => {
  const other = v7();
  await ensureSandbox(db, other, "seller");
  const foreign = (await listings.list(db, other))[0];
  if (!foreign) throw new Error("Foreign missing");
  const result = await context("Holder #S-214", (ctx) =>
    runTransition(ctx, "listing", foreign.id, "WITHDRAW", {}),
  );
  expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  expect(await readChain(db, sid)).toHaveLength(1);
  expect(await readChain(db, other)).toHaveLength(1);
  const buyer = await users.forPersona(db, sid, "buyer_a"),
    own = await listingByRef("L-2031");
  expect(
    await listings.findForViewer(db, { sandboxId: sid, actor: users.toActor(buyer) }, own.id),
  ).not.toHaveProperty("reservePriceMinor");
});
it("audit detects raw tampering at the exact sequence and tail truncation using its checkpoint", async () => {
  await fullTradePath();
  const chain = await readChain(db, sid);
  await db.execute(
    sql`UPDATE audit_log SET "after"='{"tampered":true}'::jsonb WHERE sandbox_id=${sid} AND seq=3`,
  );
  expect(await verifySandboxChain(db, sid)).toMatchObject({ ok: false, brokenAtSeq: 3 });
  await db.execute(
    sql`UPDATE audit_log SET "after"=${JSON.stringify(chain[2]?.after)}::jsonb WHERE sandbox_id=${sid} AND seq=3`,
  );
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
  await db.execute(sql`DELETE FROM audit_log WHERE sandbox_id=${sid} AND seq=7`);
  expect(await verifySandboxChain(db, sid)).toMatchObject({ ok: false, brokenAtSeq: 7 });
});

it("allocation creates authoritative-price trades and signing creates the transfer agreement", async () => {
  const l = await listingByRef("L-2019"),
    b = (await bids.list(db, sid)).find((b) => b.listingId === l.id);
  if (!b) throw new Error("Bid missing");
  await context("Investor #B-081", async (ctx) =>
    expect((await runTransition(ctx, "bid", b.id, "ACCEPT_COUNTER", {})).ok).toBe(true),
  );
  const updated = await bids.find(db, sid, b.id);
  if (!updated) throw new Error("Bid missing");
  const result = await context("Holder #S-102", (ctx) =>
    runTransition(ctx, "listing", l.id, "ALLOCATE", {
      allocation: allocate(l.quantity, [updated]),
    }),
  );
  expect(result.ok).toBe(true);
  const created = (await trades.list(db, sid)).find((t) => t.listingId === l.id);
  expect(created).toMatchObject({ priceMinor: 3550n, quantity: 3000n, status: "AwaitingDocs" });
  if (!created) throw new Error("Trade missing");
  await context("Holder #S-102", (ctx) =>
    runTransition(ctx, "trade", created.id, "SELLER_SIGN", {}),
  );
  await context("Investor #B-081", (ctx) =>
    runTransition(ctx, "trade", created.id, "BUYER_SIGN", {}),
  );
  expect(
    (
      await db
        .select()
        .from(schema.documents)
        .where(and(eq(schema.documents.sandboxId, sid), eq(schema.documents.tradeId, created.id)))
    ).map((d) => d.kind),
  ).toEqual(["transfer_agreement"]);
});

it("backup promotion creates a replacement trade and releases the unfilled remainder", async () => {
  const t = await tradeByRef("T-1042"),
    old = (await bids.list(db, sid)).find(
      (b) => b.listingId === t.listingId && b.status === "Rejected",
    );
  if (!old) throw new Error("Bid missing");
  const backup = {
    ...old,
    id: v7(),
    idempotencyKey: v7(),
    status: "Submitted" as const,
    quantity: 2000n,
    version: 1,
    rejectionReason: null,
  };
  await context("Holder #S-198", async (ctx) => {
    await bids.insert(ctx.tx, sid, backup);
    expect((await runTransition(ctx, "bid", backup.id, "KEEP_AS_BACKUP", {})).ok).toBe(true);
    await trades.save(ctx.tx, { ...t, backupBidId: backup.id, version: t.version + 1 }, t.version);
  });
  expect(
    (
      await context("Falaj Robotics · CFO", (ctx) =>
        runTransition(ctx, "trade", t.id, "REFUSE", { reason: "Transfer refused" }),
      )
    ).ok,
  ).toBe(true);
  expect(await bids.find(db, sid, backup.id)).toMatchObject({
    status: "Accepted",
    allocatedQty: 2000n,
  });
  expect((await holdings.find(db, sid, t.holdingId))?.reservedQty).toBe(7500n);
  const replacement = (await trades.list(db, sid)).find((r) => r.bidId === backup.id);
  expect(replacement).toMatchObject({ quantity: 2000n, status: "AwaitingDocs", priceMinor: 3450n });
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
it("funded cancellation refunds escrow and releases the holding", async () => {
  const t = await tradeByRef("T-1042");
  for (const [handle, event] of [
    ["Falaj Robotics · CFO", "WAIVE"],
    ["Investor #B-117", "MARK_WIRE_SENT"],
    ["Atlas compliance", "CONFIRM_FUNDS"],
  ] as const)
    expect((await context(handle, (ctx) => runTransition(ctx, "trade", t.id, event, {}))).ok).toBe(
      true,
    );
  expect(
    (
      await context("Atlas compliance", (ctx) =>
        runTransition(ctx, "trade", t.id, "CANCEL_BY_OPERATOR", { reason: "Settlement cancelled" }),
      )
    ).ok,
  ).toBe(true);
  const events = await db
    .select()
    .from(schema.escrowEvents)
    .where(and(eq(schema.escrowEvents.sandboxId, sid), eq(schema.escrowEvents.tradeId, t.id)));
  expect(events.map((e) => e.kind)).toEqual(["wire_sent", "funded", "refunded"]);
  expect(events[2]?.amountMinor).toBe(9000000n);
  expect((await holdings.find(db, sid, t.holdingId))?.reservedQty).toBe(5500n);
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
it("automation scheduling deduplicates, and moved-state jobs skip without a second transition", async () => {
  await db.transaction((tx) => sandboxes.save(tx, sid, { autopilot: true }));
  const id = await submitWadi();
  await context("Holder #S-214", async (ctx) => {
    const listing = await listings.find(ctx.tx, sid, id);
    if (!listing) throw new Error("Listing missing");
    await scheduleAutomation(ctx, "listing", listing);
  });
  expect(await jobs.list(db, sid)).toHaveLength(1);
  await context("Atlas compliance", (ctx) => runTransition(ctx, "listing", id, "APPROVE", {}));
  const before = (await readChain(db, sid)).length;
  await advance(3000);
  expect(await readChain(db, sid)).toHaveLength(before);
  const done = await db
    .select()
    .from(schema.automationJobs)
    .where(and(eq(schema.automationJobs.sandboxId, sid), eq(schema.automationJobs.entityId, id)));
  expect(done[0]).toMatchObject({ status: "skipped", resultCode: "INVALID_TRANSITION" });
});
it("registered custom job errors roll back their writes and audit before being marked skipped", async () => {
  const target = await tradeByRef("T-1042");
  registerJobHandler("test_rollback", async (ctx) => {
    await sandboxes.save(ctx.tx, sid, { rofrMode: "exercise" });
    await appendAudit(ctx, {
      action: "test.custom",
      entity: "sandbox",
      entityId: sid,
      before: {},
      after: {},
    });
    return err({ code: "GUARD_FAILED", message: "Blocked" });
  });
  await db.transaction(async (tx) => {
    await lockSandbox(tx, sid);
    const admin = await users.forPersona(tx, sid, "company_admin");
    await sandboxes.save(tx, sid, { autopilot: true });
    await jobs.insert(tx, sid, {
      id: v7(),
      sandboxId: sid,
      kind: "test_rollback",
      entity: "trade",
      entityId: target.id,
      event: null,
      partyUserId: admin.id,
      status: "pending",
      createdAt: T0,
      dueAt: T0,
    });
  });
  await refreshSandbox(db, sid);
  expect((await sandboxes.find(db, sid))?.rofrMode).toBe("waive");
  expect(await readChain(db, sid)).toHaveLength(1);
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
it("touch throttles last_seen writes and refresh avoids a write transaction when nothing is due", async () => {
  const transaction = vi.spyOn(db, "transaction");
  await refreshSandbox(db, sid);
  await touchSandbox(db, sid);
  expect(transaction).not.toHaveBeenCalled();
  transaction.mockRestore();
  await db.transaction((tx) =>
    sandboxes.save(tx, sid, { lastSeenAt: new Date(T0.getTime() - 61000) }),
  );
  await touchSandbox(db, sid);
  expect((await sandboxes.find(db, sid))?.lastSeenAt).toEqual(T0);
});

it("concurrent audit appends and verification use a consistent trusted snapshot", async () => {
  const checks = await Promise.all(
    Array.from({ length: 6 }, async (_, index) => {
      await context("Holder #S-214", (ctx) =>
        appendAudit(ctx, {
          action: `test.concurrent.${index}`,
          entity: "sandbox",
          entityId: sid,
          before: {},
          after: { index },
        }),
      );
      return verifySandboxChain(db, sid);
    }),
  );
  expect(checks.every((c) => c.ok)).toBe(true);
  expect(await verifySandboxChain(db, sid)).toEqual({ ok: true, count: 7 });
});
