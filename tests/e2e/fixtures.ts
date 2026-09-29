import { test as base, expect, type Page } from "@playwright/test";

export async function watchBrowserPage(page: Page) {
  const errors: string[] = [],
    checks: Promise<void>[] = [];
  await page.exposeBinding("atlasReportCspViolation", (_source, detail: string) => {
    errors.push(`CSP violation: ${detail}`);
  });
  await page.addInitScript(() => {
    window.addEventListener("securitypolicyviolation", (event) => {
      (
        window as unknown as { atlasReportCspViolation: (detail: string) => void }
      ).atlasReportCspViolation(`${event.effectiveDirective}: ${event.blockedURI}`);
    });
  });
  page.on("response", (response) => {
    if (response.request().resourceType() === "document")
      checks.push(
        (async () => {
          const headers = response.headers();
          expect(headers["content-security-policy"], `CSP on ${response.url()}`).toContain(
            "'strict-dynamic'",
          );
          expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
        })(),
      );
  });
  page.on("console", (message) => {
    // Chromium's exact argument-free /nope 404 diagnostic is expected; JS errors are not.
    const expectedNotFound =
      message.args().length === 0 &&
      message.location().url === `http://localhost:${Number(process.env.E2E_PORT ?? 3100)}/nope` &&
      message.text() ===
        "Failed to load resource: the server responded with a status of 404 (Not Found)";
    if (
      (message.type() === "error" || /Content Security Policy/i.test(message.text())) &&
      !expectedNotFound
    )
      errors.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return async () => {
    await Promise.all(checks);
    expect(errors, "Browser console, page errors and CSP violations").toEqual([]);
  };
}
export const test = base.extend({
  page: async ({ page }, use) => {
    const verify = await watchBrowserPage(page);
    await use(page);
    await verify();
  },
});
export { expect };
