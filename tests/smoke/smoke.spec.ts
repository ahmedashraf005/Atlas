import { expect, test } from "@playwright/test";

test("post-deploy read-mostly product and security smoke", async ({ page }) => {
  const errors: string[] = [],
    checks: Promise<void>[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || /Content Security Policy/i.test(m.text())) errors.push(m.text());
  });
  await page.exposeBinding("smokeCspViolation", (_source, detail: string) => errors.push(detail));
  await page.addInitScript(() =>
    window.addEventListener("securitypolicyviolation", (event) =>
      (window as unknown as { smokeCspViolation: (s: string) => void }).smokeCspViolation(
        event.effectiveDirective,
      ),
    ),
  );
  page.on("response", (r) => {
    if (r.request().resourceType() === "document")
      checks.push(
        (async () => {
          expect(r.headers()["content-security-policy"]).toContain("'strict-dynamic'");
          expect(r.headers()["x-robots-tag"]).toBe("noindex, nofollow");
        })(),
      );
  });
  const health = await page.request.get("/api/health");
  expect(health.ok()).toBe(true);
  expect(await health.json()).toEqual({ ok: true });
  expect(health.headers()["cache-control"]).toContain("no-store");
  expect(health.headers()["set-cookie"]).toBeUndefined();
  const landing = await page.goto("/");
  expect(landing?.headers()).toMatchObject({
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
  });
  await expect(
    page.getByRole("heading", { level: 1, name: "Private shares, settled properly." }),
  ).toBeVisible();
  await page
    .getByRole("button")
    .filter({ hasText: "Investor #B-081 · Palmgate Family Office" })
    .click();
  await expect(page).toHaveURL("/discover");
  await page.goto("/companies/falaj-robotics");
  await expect(
    page
      .getByText("Last round price", { exact: true })
      .locator("..")
      .getByText("AED 42.00", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /6 Atlas trades/ }).locator("svg")).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "L-2031" })
    .getByRole("link", { name: "Bid", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Place a bid", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "View as" }).click();
  await page.getByRole("option", { name: "Operator · Atlas compliance", exact: true }).click();
  await expect(page).toHaveURL("/ops");
  await page.goto("/ops/audit");
  await page.getByRole("button", { name: "Verify chain", exact: true }).click();
  await expect(page.getByText(/^Chain verified/).first()).toBeVisible();
  await page.goto("/under-the-hood");
  await page.getByRole("tab", { name: "Trade", exact: true }).click();
  await expect(page.getByRole("img", { name: "Trade state machine" }).locator("svg")).toBeVisible({
    timeout: 20000,
  });
  await Promise.all(checks);
  expect(errors).toEqual([]);
});
