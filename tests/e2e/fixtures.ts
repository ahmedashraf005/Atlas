import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      // Chromium reports an expected document 404 as a network diagnostic, not a JS console.error call.
      // Keep this exception scoped to the deliberately tested /nope document; JS calls have arguments.
      const expectedNotFound =
        message.args().length === 0 &&
        message.location().url ===
          `http://localhost:${Number(process.env.E2E_PORT ?? 3100)}/nope` &&
        message.text() ===
          "Failed to load resource: the server responded with a status of 404 (Not Found)";
      if (message.type() === "error" && !expectedNotFound)
        errors.push(`console.error: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    await use(page);
    expect(errors, "Browser console and page errors").toEqual([]);
  },
});
export { expect };
