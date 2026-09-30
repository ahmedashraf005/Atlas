import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function persona(page: Page, role: "company_admin" | "operator" | "seller" | "buyer_a") {
  await page.goto("/");
  await page
    .getByRole("button", {
      name:
        role === "company_admin"
          ? /Falaj Robotics · CFO/
          : role === "operator"
            ? /Atlas compliance/
            : role === "seller"
              ? /Holder #S-214/
              : /Investor #B-081/,
    })
    .click();
  await expect(page).toHaveURL(
    role === "company_admin"
      ? "/company"
      : role === "operator"
        ? "/ops"
        : role === "seller"
          ? "/holdings"
          : "/discover",
  );
}
async function autopilotOff(page: Page) {
  await expect(page.getByRole("combobox", { name: "View as", exact: true })).toBeVisible();
  const on = page.getByRole("button", { name: "Auto-pilot on", exact: true });
  if (await on.count()) await on.click();
  await expect(page.getByRole("button", { name: "Auto-pilot off", exact: true })).toBeVisible();
}
test("company queue shows seeded decisions and publishes a redacted answer for approved buyers", async ({
  page,
}) => {
  await persona(page, "company_admin");
  await expect(page.getByText("Right of first refusal · T-1042", { exact: true })).toBeVisible();
  await expect(page.getByText("Question from Investor #B-204", { exact: true })).toBeVisible();
  await expect(page.getByText("AED 528,600", { exact: true })).toBeVisible();
  await page.getByLabel("Answer", { exact: true }).fill("call 050 123 4567");
  await page.getByRole("button", { name: "Publish answer", exact: true }).click();
  await expect(page.getByText("Question from Investor #B-204", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Contact details were removed. Answer published.", { exact: true }),
  ).toBeVisible();
  await persona(page, "buyer_a");
  await page.goto("/companies/falaj-robotics");
  await expect(page.getByText("call [phone removed]", { exact: true })).toBeVisible();
});
test("policy editing updates the company view and seller's minimum lot", async ({ page }) => {
  await persona(page, "company_admin");
  await page.goto("/company/policy");
  await page.getByRole("button", { name: "Edit policy", exact: true }).click();
  await page.getByLabel("Minimum lot (shares)").fill("500");
  await page.getByRole("button", { name: "Save policy", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Save the new transfer policy?" });
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Save policy", exact: true }).click();
  await expect(page.getByText("500 shares", { exact: true })).toBeVisible();
  await persona(page, "seller");
  await expect(
    page
      .getByRole("region", { name: "Falaj Robotics holding", exact: true })
      .getByText("500 shares", { exact: true }),
  ).toBeVisible();
});
test("operator reviews a seller listing with autopilot off and rejection reason is visible", async ({
  page,
}) => {
  await persona(page, "seller");
  await autopilotOff(page);
  const wadi = page.getByRole("region", { name: "Wadi Ledger holding", exact: true });
  await wadi.getByRole("link", { name: "List shares", exact: true }).click();
  await page.getByLabel("Reserve price per share").fill("3.00");
  await page.getByLabel("Quantity", { exact: true }).fill("3000");
  await page.getByRole("button", { name: "Review listing", exact: true }).click();
  await page
    .getByText("I confirm I own these shares and they are free of any other claim.")
    .click();
  await page.getByRole("button", { name: "Submit for review", exact: true }).click();
  await expect(page).toHaveURL("/holdings");
  await persona(page, "operator");
  const row = page
    .getByRole("heading", { name: "Listing review", exact: true })
    .locator("..")
    .locator("..")
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: "L-3001", exact: true }) });
  await expect(row.getByText("Policy check passed", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(row).toHaveCount(0);
  await persona(page, "seller");
  await expect(
    page
      .locator("#your-listings tbody tr")
      .filter({ has: page.getByRole("link", { name: "L-3001", exact: true }) })
      .getByText("Live", { exact: true }),
  ).toBeVisible();
  await wadi.getByRole("link", { name: "List shares", exact: true }).click();
  await page.getByLabel("Reserve price per share").fill("3.00");
  await page.getByLabel("Quantity", { exact: true }).fill("3000");
  await page.getByRole("button", { name: "Review listing", exact: true }).click();
  await page
    .getByText("I confirm I own these shares and they are free of any other claim.")
    .click();
  await page.getByRole("button", { name: "Submit for review", exact: true }).click();
  await expect(page).toHaveURL("/holdings");
  await persona(page, "operator");
  await page.getByRole("button", { name: "Reject listing", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Reject listing", exact: true });
  await expect(dialog.getByRole("button", { name: "Reject listing", exact: true })).toBeDisabled();
  await dialog.getByLabel("Reason").fill("Evidence incomplete");
  await dialog.getByRole("button", { name: "Reject listing", exact: true }).click();
  await persona(page, "seller");
  await expect(
    page.locator("#your-listings").getByText("Rejected by Atlas", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("#your-listings").getByText("Evidence incomplete", { exact: true }),
  ).toBeVisible();
});
test("audit verifies, detects tampering at the midpoint and resets to a clean chain", async ({
  page,
}) => {
  await persona(page, "operator");
  await autopilotOff(page);
  await page.goto("/ops/audit");
  await page.getByRole("button", { name: "Verify chain", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Chain verified" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Demo tools", exact: true }).click();
  await page.getByRole("menuitem", { name: "Tamper with an entry…", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Tamper with the audit log?", exact: true });
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Tamper with entry", exact: true }).click();
  await expect(page.getByText(/^Chain broken at entry #.*an entry was changed/)).toBeVisible();
  await expect(page.getByText("Changed after writing", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page
    .getByRole("alertdialog", { name: "Reset the demo?", exact: true })
    .getByRole("button", { name: "Reset demo", exact: true })
    .click();
  await expect(page).toHaveURL("/ops");
  await page.goto("/ops/audit");
  await expect(page.getByText(/^Chain verified · .*head /)).toBeVisible();
});
for (const theme of ["light", "dark"] as const)
  test(`company, policy, operations and audit fit mobile in ${theme}`, async ({ page }) => {
    await persona(page, "company_admin");
    await autopilotOff(page);
    if (theme === "dark")
      await page.getByRole("button", { name: "Switch to dark theme", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ["/company", "/company/policy"]) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.getByRole("button", { name: "Edit policy", exact: true }).click();
    await page.getByRole("button", { name: "Add blackout", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await persona(page, "operator");
    for (const route of ["/ops", "/ops/audit"]) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  });
