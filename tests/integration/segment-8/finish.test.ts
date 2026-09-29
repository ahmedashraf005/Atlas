import { v7 } from "uuid";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { PersonaKey } from "@/config/personas";
import { systemClock } from "@/lib/clock";
import { switchPersonaDef } from "@/server/actions/demo";
import { markAllReadDef, markReadDef } from "@/server/actions/notifications";
import { executeAction } from "@/server/actions/pipeline";
import { verifySandboxChain } from "@/server/audit";
import { sandboxClock } from "@/server/clock";
import { closeDatabase, type Db } from "@/server/db/client";
import { getDiscoverModel } from "@/server/read/discover";
import { getNotificationsModel } from "@/server/read/notifications";
import { getPortfolioModel } from "@/server/read/portfolio";
import { getUnderTheHoodModel } from "@/server/read/under-the-hood";
import * as notifications from "@/server/repositories/notifications";
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
  sid = v7();
  await ensureSandbox(db, sid, "company_admin");
  await db.transaction((tx) => sandboxes.save(tx, sid, { autopilot: false }));
});
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
    autopilot: false,
    rofrMode: "waive",
    pendingJobs: 0,
  };
}
const session = (per: PersonaKey = "company_admin") => ({
  sid,
  per,
  iss: "atlas" as const,
  aud: "atlas-demo" as const,
  iat: 0,
  exp: 9999999999,
});
it("bell model includes only recipient's data, no amounts, and the authorised trade link", async () => {
  const model = await getNotificationsModel(await viewer(), db);
  expect(model.unread).toBe("1");
  expect(model.items).toHaveLength(1);
  expect(model.items[0]?.text).toBe("Decide on the right of first refusal for T-1042");
  expect(model.items[0]?.href).toMatch(/^\/trades\//);
  expect(JSON.stringify(model)).not.toMatch(/AED|priceMinor|quantity/);
  const other = await getNotificationsModel(await viewer("buyer_a"), db);
  expect(other.items[0]?.text).toBe("The seller countered your bid on L-2019");
  expect(other.items[0]?.href).toBe("/bids");
});
it("mark-read owns its row, is idempotent, audits and cannot accept other ids", async () => {
  const own = (await notifications.forRecipient(db, sid, (await viewer()).user.id))[0];
  if (!own) throw Error("notification");
  const result = await executeAction(markReadDef, { id: own.id }, { db, session: session() });
  expect(result.status).toBe("success");
  expect((await getNotificationsModel(await viewer(), db)).unread).toBe("0");
  const before = (await sandboxes.find(db, sid))?.auditHeadSeq;
  expect(
    (await executeAction(markReadDef, { id: own.id }, { db, session: session() })).status,
  ).toBe("success");
  expect((await sandboxes.find(db, sid))?.auditHeadSeq).toBe(before);
  const other = (await notifications.forRecipient(db, sid, (await viewer("buyer_a")).user.id))[0];
  if (!other) throw Error("other");
  const denied = await executeAction(markReadDef, { id: other.id }, { db, session: session() });
  expect(denied).toMatchObject({ status: "error", error: { code: "NOT_FOUND" } });
  expect(
    (await notifications.forRecipient(db, sid, (await viewer("buyer_a")).user.id))[0]?.readAt,
  ).toBeNull();
  expect((await verifySandboxChain(db, sid)).ok).toBe(true);
});
it("mark-all affects only viewer and caps newest items at eight", async () => {
  const u = (await viewer()).user.id;
  await db.transaction(async (tx) => {
    for (let i = 0; i < 10; i++)
      await notifications.insert(tx, sid, {
        id: v7(),
        recipientId: u,
        template: "rofr_notice",
        entity: "trade",
        entityId: v7(),
        createdAt: T0,
        readAt: null,
      });
  });
  const m = await getNotificationsModel(await viewer(), db);
  expect(m.unread).toBe("11");
  expect(m.items).toHaveLength(8);
  expect((await executeAction(markAllReadDef, {}, { db, session: session() })).status).toBe(
    "success",
  );
  expect((await getNotificationsModel(await viewer(), db)).unread).toBe("0");
  expect((await getNotificationsModel(await viewer("buyer_a"), db)).unread).toBe("1");
});
it("switchPersona validates the optional next path and preserves session identity", async () => {
  const r = await executeAction(
    switchPersonaDef,
    { persona: "seller", next: "/holdings" },
    { db, session: session() },
  );
  expect(r).toMatchObject({ status: "success", data: { sid, per: "seller", next: "/holdings" } });
  const external = await executeAction(
    switchPersonaDef,
    { persona: "buyer_a", next: "//evil.com" },
    { db, session: session() },
  );
  expect(external).toMatchObject({ status: "success", data: { next: null } });
  const bad = await executeAction(
    switchPersonaDef,
    { persona: "buyer_a", next: "/discover", actor: "operator" },
    { db, session: session() },
  );
  expect(bad).toMatchObject({ status: "error", error: { code: "VALIDATION" } });
});
it("portfolio shows Atlas purchases and diagram text comes from all machines", async () => {
  const rows = await getPortfolioModel(await viewer("buyer_a"), db);
  expect(rows).toMatchObject([
    {
      company: "Falaj Robotics",
      shareClass: "Ordinary",
      quantity: "4,000 sh",
      sources: [{ ref: "T-1036" }],
    },
  ]);
  expect(await getPortfolioModel(await viewer("seller"), db)).toEqual([]);
  const model = await getUnderTheHoodModel(await viewer(), db);
  expect(model.machines).toHaveLength(4);
  expect(model.machines.find((m) => m.kind === "trade")?.text).toContain("APPROVE_RELEASE");
  expect(model.steps).toHaveLength(11);
  expect(model.controls).toHaveLength(10);
});
it("mandate filter avoids native form-method names and preserves existing links", async () => {
  const buyer = await viewer("buyer_a");
  for (const raw of [{ matches: "on" }, { matchesMandates: "on" }]) {
    const model = await getDiscoverModel(buyer, raw, db);
    expect(model.companies.map((c) => c.name)).toEqual(["Falaj Robotics"]);
  }
});
it("notification ids from another sandbox remain not found", async () => {
  const a = (await getNotificationsModel(await viewer(), db)).items[0];
  if (!a) throw Error("notification");
  const other = v7();
  await ensureSandbox(db, other, "company_admin");
  expect(
    await executeAction(markReadDef, { id: a.id }, { db, session: { ...session(), sid: other } }),
  ).toMatchObject({ status: "error", error: { code: "NOT_FOUND" } });
});

it("progressive-enhancement forms strip only reserved framework fields before strict validation", async () => {
  const form = new FormData();
  form.set("persona", "seller");
  form.set("next", "/holdings");
  form.set("$ACTION_ID_demo", "framework-reference");
  form.set("$ACTION_REF_demo", "framework-binding");
  expect(await executeAction(switchPersonaDef, form, { db, session: session() })).toMatchObject({
    status: "success",
    data: { per: "seller", next: "/holdings" },
  });
  form.set("actor", "operator");
  expect(await executeAction(switchPersonaDef, form, { db, session: session() })).toMatchObject({
    status: "error",
    error: { code: "VALIDATION" },
  });
});
