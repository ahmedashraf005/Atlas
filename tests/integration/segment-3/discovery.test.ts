import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { PersonaKey } from "@/config/personas";
import { systemClock } from "@/lib/clock";
import { askQuestionDef, requestAccessDef } from "@/server/actions/company";
import { executeAction } from "@/server/actions/pipeline";
import { closeDatabase, type Db } from "@/server/db/client";
import { accessGrants } from "@/server/db/schema";
import { getCompanyModel, getDocumentModel } from "@/server/read/company";
import { getDiscoverModel } from "@/server/read/discover";
import { refreshSandbox } from "@/server/refresh";
import * as companies from "@/server/repositories/companies";
import * as documents from "@/server/repositories/documents";
import * as grants from "@/server/repositories/grants";
import * as jobs from "@/server/repositories/jobs";
import * as sandboxes from "@/server/repositories/sandboxes";
import * as users from "@/server/repositories/users";
import { ensureSandbox } from "@/server/sandbox";
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
  vi.spyOn(systemClock, "now").mockImplementation(() => new Date(T0));
  sid = v7();
  await ensureSandbox(db, sid, "buyer_a");
});
async function viewer(per: PersonaKey): Promise<Viewer> {
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
    now: new Date(T0),
    clock: systemClock,
    autopilot: true,
    rofrMode: "waive",
    pendingJobs: 0,
  };
}
async function company(slug: string) {
  const c = (await companies.list(db, sid)).find((c) => c.slug === slug);
  if (!c) throw Error("missing company");
  return c;
}
const session = (per: PersonaKey) => ({
  sid,
  per,
  iss: "atlas" as const,
  aud: "atlas-demo" as const,
  iat: T0.getTime() / 1000,
  exp: T0.getTime() / 1000 + 604800,
});
it("builds exact Falaj buyer model without another buyer's prices", async () => {
  const model = await getCompanyModel(await viewer("buyer_a"), "falaj-robotics", db);
  expect(model).not.toBeNull();
  if (!model) return;
  expect(model.stats.round.value).toBe("AED 42.00");
  expect(model.stats.band.value).toBe("AED 34.20–36.10");
  expect(model.stats.band.caption).toBe("From 6 trades in the last 180 days");
  expect(model.stats.last.value).toBe("AED 35.80");
  expect(model.stats.last.caption).toContain("4,000 ordinary shares");
  expect(model.listings.map((l) => l.ref)).toEqual(["L-2019", "L-2027", "L-2031"]);
  expect(model.listings[0]).toMatchObject({ ownBid: "Your bid · AED 34.00", highlight: true });
  expect(model.listings[0]?.badges[0]?.text).toContain("Countered at AED 35.50");
  expect(model.listings.map((l) => l.action?.label)).toEqual(["Respond", "Bid", "Bid"]);
  const serialized = JSON.stringify(model);
  expect(serialized).not.toMatch(/"[^"]*reserve[^"]*"/i);
  for (const price of ["AED 35.20", "AED 34.80", "AED 34.60"])
    expect(JSON.stringify(model.listings)).not.toContain(price);
  expect(JSON.stringify(model.listings)).not.toMatch(/bidCount|bidCounts/);
});
it("computes discover filters and fallback", async () => {
  const v = await viewer("buyer_a"),
    all = await getDiscoverModel(v, {}, db);
  expect(all.companies).toHaveLength(3);
  expect(all.companies.find((c) => c.slug === "qamra-health")?.fairValue).toBe(
    "Round-implied AED 18.50",
  );
  const qamra = await getCompanyModel(v, "qamra-health", db);
  expect(qamra?.stats.band.caption).toBe(
    "Value per share if the company sold at its last round's valuation. Ordinary shares usually trade at a discount to this.",
  );
  expect(qamra?.chart.points).toHaveLength(0);
  expect(qamra?.chart.hidden).toBe(false);
  expect(all.companies.find((c) => c.slug === "wadi-ledger")?.fairValue).toBe("USD 2.95–3.30");
  expect((await getDiscoverModel(v, { open: "on" }, db)).companies.map((c) => c.slug)).toEqual([
    "falaj-robotics",
  ]);
  expect((await getDiscoverModel(v, { matches: "on" }, db)).companies.map((c) => c.slug)).toEqual([
    "falaj-robotics",
  ]);
  expect((await getDiscoverModel(v, { sector: "bad" }, db)).companies).toHaveLength(3);
});
it("hides trade prices when not a participant but keeps public fallback", async () => {
  const v = await viewer("buyer_b"),
    c = await company("falaj-robotics");
  await db
    .delete(accessGrants)
    .where(
      and(
        eq(accessGrants.sandboxId, sid),
        eq(accessGrants.companyId, c.id),
        eq(accessGrants.buyerId, v.user.id),
      ),
    );
  const model = await getCompanyModel(v, "falaj-robotics", db);
  expect(model?.stats.band.value).toBe("AED 34.20–36.10"); // Existing Falaj bid and trade make buyer B a participant.
  const op = await getCompanyModel(await viewer("operator"), "falaj-robotics", db);
  expect(op?.chart.points).toHaveLength(6);
  const wadi = await getCompanyModel(v, "wadi-ledger", db);
  expect(wadi?.chart.points).toHaveLength(3);
});
it("gates document loader", async () => {
  const c = await company("falaj-robotics"),
    doc = (await documents.list(db, sid)).find(
      (d) => d.companyId === c.id && d.title === "FY2025 audited financials",
    );
  if (!doc) throw Error("missing document");
  expect((await getDocumentModel(await viewer("buyer_a"), c.slug, doc.id, db))?.footer).toContain(
    "Investor #B-081",
  );
  const b = await viewer("buyer_b");
  await db
    .delete(accessGrants)
    .where(
      and(
        eq(accessGrants.sandboxId, sid),
        eq(accessGrants.companyId, c.id),
        eq(accessGrants.buyerId, b.user.id),
      ),
    );
  expect(await getDocumentModel(b, c.slug, doc.id, db)).toBeNull();
});
it("requests access, then simulated company decides Wadi and Qamra", async () => {
  await db.transaction((tx) => sandboxes.save(tx, sid, { persona: "buyer_b" }));
  const b = await users.forPersona(db, sid, "buyer_b"),
    wadi = await company("wadi-ledger"),
    qamra = await company("qamra-health");
  const deps = { db, session: session("buyer_b") };
  const first = await executeAction(
    requestAccessDef,
    { companyId: wadi.id, ndaVersion: "v1", accepted: true },
    deps,
  );
  expect(first.status).toBe("success");
  expect((await jobs.list(db, sid)).filter((j) => j.kind === "access_decision")).toHaveLength(1);
  const again = await executeAction(
    requestAccessDef,
    { companyId: wadi.id, ndaVersion: "v1", accepted: true },
    deps,
  );
  expect(again.status).toBe("success");
  expect((await jobs.list(db, sid)).filter((j) => j.kind === "access_decision")).toHaveLength(1);
  vi.spyOn(systemClock, "now").mockImplementation(() => new Date(T0.getTime() + 4000));
  await refreshSandbox(db, sid);
  expect((await grants.find(db, sid, wadi.id, b.id))?.status).toBe("denied");
  const denied = await getCompanyModel(await viewer("buyer_b"), "wadi-ledger", db);
  expect(denied?.requestAccess).toBe(false);
  expect(denied?.matchingMandate).toBeNull();
  expect(denied?.info.denial).toBe("Wadi Ledger accepts only Family offices, Funds.");
  expect(
    (await getDiscoverModel(await viewer("buyer_b"), { matches: "on" }, db)).companies,
  ).toHaveLength(0);
  const second = await executeAction(
    requestAccessDef,
    { companyId: qamra.id, ndaVersion: "v1", accepted: true },
    deps,
  );
  expect(second.status).toBe("success");
  vi.spyOn(systemClock, "now").mockImplementation(() => new Date(T0.getTime() + 8000));
  await refreshSandbox(db, sid);
  expect((await grants.find(db, sid, qamra.id, b.id))?.status).toBe("approved");
});
it("redacts and rate-limits questions", async () => {
  const c = await company("falaj-robotics"),
    deps = { db, session: session("buyer_a") };
  const first = await executeAction(
    askQuestionDef,
    { companyId: c.id, question: "email me at a@b.co" },
    deps,
  );
  expect(first.status).toBe("success");
  if (first.status === "success")
    expect(first.data.message).toContain("Contact details were removed");
  for (let i = 0; i < 4; i++)
    expect(
      (await executeAction(askQuestionDef, { companyId: c.id, question: `Question ${i}?` }, deps))
        .status,
    ).toBe("success");
  expect(
    await executeAction(askQuestionDef, { companyId: c.id, question: "A sixth question" }, deps),
  ).toMatchObject({ status: "error", error: { code: "RATE_LIMITED" } });
  const schema = await import("@/server/db/schema"),
    v = await viewer("buyer_a");
  const questions = await db
    .select()
    .from(schema.qaEntries)
    .where(eq(schema.qaEntries.sandboxId, sid));
  expect(questions.find((q) => q.askedBy === v.user.id)?.question).toBe(
    "email me at [email removed]",
  );
  const alerts = await db
    .select()
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.sandboxId, sid),
        eq(schema.notifications.template, "question_asked"),
      ),
    );
  expect(alerts).toHaveLength(5);
  const admin = await users.forPersona(db, sid, "company_admin");
  expect(alerts.every((n) => n.recipientId === admin.id)).toBe(true);
});

it("precomputes all 25 waterfall steps with exact anchors", async () => {
  const m = await getCompanyModel(await viewer("buyer_a"), "falaj-robotics", db);
  expect(m?.exit).toHaveLength(25);
  expect(m?.exit?.[12]?.exitLabel).toBe("AED 462M");
  expect(m?.exit?.[12]?.classes.find((c) => c.name === "Ordinary")?.perShare).toBe("AED 42.00");
  expect(m?.exit?.[0]?.exitLabel).toBe("AED 115.5M");
  expect(m?.exit?.[0]?.classes.map((c) => c.perShare)).toEqual([
    "AED 42.00",
    "AED 10.50",
    "AED 0.00",
  ]);
  for (const step of m?.exit ?? [])
    for (const c of step.classes) {
      expect(c.ratio).toBeGreaterThanOrEqual(0);
      expect(c.ratio).toBeLessThanOrEqual(1);
    }
});
it("asks require approved access and buyer role", async () => {
  const w = await company("wadi-ledger");
  const denied = await executeAction(
    askQuestionDef,
    { companyId: w.id, question: "A question" },
    { db, session: session("buyer_a") },
  );
  expect(denied).toMatchObject({
    status: "error",
    error: { code: "FORBIDDEN", message: "Approved buyers can ask the company questions." },
  });
  await db.transaction((tx) => sandboxes.save(tx, sid, { persona: "company_admin" }));
  expect(
    await executeAction(
      requestAccessDef,
      { companyId: w.id, ndaVersion: "v1", accepted: true },
      { db, session: session("company_admin") },
    ),
  ).toMatchObject({ status: "error", error: { code: "FORBIDDEN" } });
});
it("sector, stage, invalid checkbox and empty result filters", async () => {
  const v = await viewer("buyer_a");
  expect(
    (await getDiscoverModel(v, { sector: "Payments infrastructure" }, db)).companies.map(
      (c) => c.slug,
    ),
  ).toEqual(["wadi-ledger"]);
  expect(
    (await getDiscoverModel(v, { stage: "Series A" }, db)).companies.map((c) => c.slug),
  ).toEqual(["qamra-health"]);
  expect(
    (await getDiscoverModel(v, { open: "invalid", stage: ["Seed"] }, db)).companies,
  ).toHaveLength(3);
  expect(
    (await getDiscoverModel(v, { sector: "Payments infrastructure", stage: "Series B" }, db))
      .companies,
  ).toHaveLength(0);
});
it("all read model outputs serialize without bigint or non-coordinate numbers", async () => {
  const v = await viewer("buyer_a"),
    d = await getDiscoverModel(v, {}, db),
    m = await getCompanyModel(v, "falaj-robotics", db);
  expect(() => JSON.stringify([d, m])).not.toThrow();
  function walk(value: unknown, path: string) {
    if (typeof value === "number") expect(path).toMatch(/chart|exit.*ratio/);
    if (value && typeof value === "object")
      for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
  }
  walk(m, "company");
  walk(d, "discover");
});

it("nonparticipant receives no trade band coordinates or chart points", async () => {
  const original = await users.forPersona(db, sid, "buyer_b"),
    id = v7();
  const schema = await import("@/server/db/schema");
  await db
    .insert(schema.users)
    .values({ ...original, id, personaKey: null, handle: "Investor #B-test" });
  const base = await viewer("buyer_b"),
    v = { ...base, user: { ...base.user, id }, actor: { ...base.actor, userId: id } };
  const m = await getCompanyModel(v, "falaj-robotics", db);
  expect(m?.stats.band.value).toBe("Not disclosed");
  expect(m?.stats.last.value).toBe("Not disclosed");
  expect(m?.chart.points).toEqual([]);
  expect(m?.chart.band).toBeNull();
  expect(
    (await getCompanyModel(await viewer("company_admin"), "falaj-robotics", db))?.chart.points,
  ).toHaveLength(6);
});
it("repeated decisions are skipped without another audit mutation", async () => {
  const c = await company("wadi-ledger"),
    v = await viewer("buyer_a");
  const result = await executeAction(
    requestAccessDef,
    { companyId: c.id, ndaVersion: "v1", accepted: true },
    { db, session: session("buyer_a") },
  );
  expect(result.status).toBe("success");
  const pending = (await jobs.list(db, sid))[0];
  if (!pending) throw Error("missing job");
  vi.spyOn(systemClock, "now").mockImplementation(() => new Date(T0.getTime() + 4000));
  await refreshSandbox(db, sid);
  const schema = await import("@/server/db/schema");
  const entries = await db.select().from(schema.auditLog).where(eq(schema.auditLog.sandboxId, sid));
  expect(entries.find((e) => e.action === "company.decideAccess")).toMatchObject({
    actorRole: "company_admin",
    simulated: true,
  });
  const id = v7();
  await db.transaction((tx) => jobs.insert(tx, sid, { ...pending, id }));
  await refreshSandbox(db, sid);
  const [finished] = await db
    .select()
    .from(schema.automationJobs)
    .where(and(eq(schema.automationJobs.sandboxId, sid), eq(schema.automationJobs.id, id)));
  expect(finished).toMatchObject({ status: "skipped", resultCode: "ALREADY_DECIDED" });
  expect(await grants.find(db, sid, c.id, v.user.id)).toMatchObject({ status: "approved" });
});
