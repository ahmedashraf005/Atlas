import { globSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { contentSecurityPolicy } from "@/lib/csp";
import { NOTIFICATION_TEXTS, notificationText } from "@/lib/notification-text";
import { allowedNextPath, readTourStep, TOUR_STEPS } from "@/lib/tour";

it("notification wording covers literal and domain-generated templates, without financial details", () => {
  const templates = new Set<string>();
  for (const file of [...globSync("src/server/**/*.ts"), ...globSync("src/domain/**/*.ts")]) {
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(/template:\s*["']([^"']+)["']/g)) templates.add(m[1] as string);
    for (const m of source.matchAll(
      /notify\([^\n]*,[\s]*["']([^"']+)["']\)|notices\(t,\s*["']([^"']+)["']\)|notifyAdmins\([^\n]*,[\s]*["']([^"']+)["']\)/g,
    ))
      templates.add((m[1] ?? m[2] ?? m[3]) as string);
  }
  templates.add("access_approved");
  templates.add("access_denied");
  expect(templates).toContain("rofr_notice");
  expect(templates).toContain("settled");
  expect(templates).toContain("question_asked");
  for (const template of templates)
    expect(Object.hasOwn(NOTIFICATION_TEXTS, template), template).toBe(true);
  for (const template of Object.keys(NOTIFICATION_TEXTS)) {
    const text = notificationText(template, "T-1042", "trade");
    expect(text).not.toMatch(/AED|USD|price|amount|\d+[.,]\d+/);
    expect(text).not.toContain("Update on");
  }
  expect(notificationText("settled", "T-1042", "trade")).toBe("T-1042 settled");
  expect(notificationText("countered", "L-2019", "bid")).toBe(
    "The seller countered your bid on L-2019",
  );
  expect(notificationText("unknown", "", "trade")).toBe("Update on trade");
  expect(notificationText("toString", "", "bid")).toBe("Update on bid");
});
it("allows tour destinations and real internal routes, rejects open redirects and unknown paths", () => {
  for (const step of TOUR_STEPS) expect(allowedNextPath(step.href)).toBe(step.href);
  const id = "01900000-1111-7222-8333-000000000001";
  for (const path of [
    "/discover",
    "/portfolio",
    "/company/policy",
    `/trades/${id}`,
    `/listings/${id}`,
    `/listings/${id}/bid`,
  ])
    expect(allowedNextPath(path)).toBe(path);
  for (const path of [
    undefined,
    null,
    42,
    "//evil.com",
    "https://evil.com",
    "/api/foo",
    "/unknown",
    "/discover?next=https://evil.com",
    "/companies/foo/bar",
    "/companies/a.b",
    "/\\evil.com",
    `/trades/${id}/bid`,
    "/ops%2faudit",
    "/discover\n",
  ])
    expect(allowedNextPath(path)).toBeNull();
});
it("reads persisted tour indices defensively", () => {
  for (const v of [null, "null", "{}", "[]", "true", '"1"', "garbage", "-1", "8", "1.2"])
    expect(readTourStep(v)).toBeNull();
  expect(readTourStep("0")).toBe(0);
  expect(readTourStep("7")).toBe(7);
});
it("builds production CSP with nonce and development-only eval", () => {
  const production = contentSecurityPolicy("testNonce", false);
  expect(production).toContain("'nonce-testNonce' 'strict-dynamic'");
  expect(production).toContain("style-src 'self' 'unsafe-inline'");
  expect(production).toContain("upgrade-insecure-requests");
  expect(production).not.toContain("unsafe-eval");
  const development = contentSecurityPolicy("devNonce", true);
  expect(development).toContain("unsafe-eval");
  expect(development).not.toContain("upgrade-insecure-requests");
});
