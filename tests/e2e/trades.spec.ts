import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function persona(page: Page, role: "buyer_b" | "company_admin" | "operator") {
  await page.goto("/");
  await page
    .getByRole("button", {
      name:
        role === "buyer_b"
          ? /Investor #B-117/
          : role === "company_admin"
            ? /Company · Falaj Robotics CFO/
            : /Operator · Atlas Compliance/,
    })
    .click();
  await expect(page).toHaveURL(
    role === "buyer_b" ? "/discover" : role === "company_admin" ? "/company" : "/ops",
  );
}
async function room(page: Page) {
  await page.goto("/trades");
  await page.getByRole("link", { name: "T-1042", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Trade T-1042", exact: true })).toBeVisible();
}
async function confirm(page: Page, title: string, label: string) {
  await page
    .getByRole("alertdialog", { name: title, exact: true })
    .getByRole("button", { name: label, exact: true })
    .click();
}
async function passkey(page: Page, button: string) {
  await page.getByRole("button", { name: button, exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText(/Simulated step-up check/)).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm with passkey", exact: true }).click();
  await expect(dialog.getByText("Verifying passkey…", { exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);
}

test("Buyer B completes the full trade with autopilot, step-up and a watermarked certificate", async ({
  page,
}) => {
  test.setTimeout(90000);
  await persona(page, "buyer_b");
  await room(page);
  await expect(page.getByRole("main").getByText("Company deciding", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Locked payment instructions")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Locked", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Locked payment instructions")).toContainText("ESC-T-1042");
  await expect(page.getByLabel("Locked payment instructions")).toContainText("(fictional)");
  await passkey(page, "I've sent the wire");
  await expect(
    page.getByText("Wire marked as sent. The escrow agent confirms receipt next.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByText("Settled", { exact: true })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator('[data-step][data-state="done"]')).toHaveCount(6);
  await expect(
    page.locator('[data-step="released"]').getByText(/Tariq Mansour.*auto-pilot/),
  ).toBeVisible();
  await expect(
    page.locator('[data-step="released"]').getByText(/Noor Khalil.*auto-pilot/),
  ).toBeVisible();
  await page.getByRole("link", { name: "View completion certificate", exact: true }).click();
  await expect(page.getByText(/Watermarked for Investor #B-117/)).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Escrow ESC-T-1042 released.");
});
test("company admin acts manually with autopilot off", async ({ page }) => {
  await persona(page, "company_admin");
  await page.getByRole("button", { name: "Auto-pilot on", exact: true }).click();
  await room(page);
  await page.getByRole("button", { name: "Waive", exact: true }).click();
  await confirm(page, "Waive the right of first refusal?", "Waive");
  await expect(page.getByRole("main").getByText("Awaiting funds", { exact: true })).toBeVisible();
  await expect(page.getByText("Right of first refusal waived.", { exact: true })).toBeVisible();
  await expect(page.getByText(/Waived · Hana Saleh · Falaj Robotics · CFO/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Messages", exact: true })).toHaveCount(0);
});
test("operator supplies the distinct second approval after autopilot", async ({ page }) => {
  test.setTimeout(90000);
  await persona(page, "buyer_b");
  await room(page);
  await expect(page.getByLabel("Locked payment instructions")).toBeVisible({ timeout: 30000 });
  await passkey(page, "I've sent the wire");
  await expect(
    page.getByText("Waiting on Falaj Robotics to update the share register.", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Auto-pilot on", exact: true }).click();
  await persona(page, "company_admin");
  await room(page);
  await page.getByRole("button", { name: "Upload register extract", exact: true }).click();
  await confirm(page, "Upload the register extract?", "Upload register extract");
  await persona(page, "operator");
  await room(page);
  await expect(page.getByRole("main").getByText("Awaiting release", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Auto-pilot off", exact: true }).click();
  await expect(
    page.locator('[data-step="released"]').getByText(/Tariq Mansour.*auto-pilot/),
  ).toBeVisible();
  await passkey(page, "Approve release (2 of 2)");
  await expect(page.getByRole("main").getByText("Settled", { exact: true })).toBeVisible();
  await expect(page.getByText(/Noor Khalil · Atlas compliance/)).toBeVisible();
});
test("Buyer A's counter path opens a new trade with the buyer's signing action", async ({
  page,
}) => {
  await page.goto("/bids");
  await page.getByRole("button", { name: "Accept AED 35.50", exact: true }).click();
  await confirm(page, "Accept the counter?", "Accept counter");
  await expect(
    page.getByRole("heading", { name: "Counter on L-2019 · Falaj Robotics", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Past", exact: true }).click();
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: "L-2019", exact: true }) });
  await expect(row.getByRole("link", { name: "Open trade", exact: true })).toBeVisible({
    timeout: 15000,
  });
  await row.getByRole("link", { name: "Open trade", exact: true }).click();
  await expect(
    page.getByRole("main").getByText("Awaiting signatures", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign agreement", exact: true })).toBeVisible();
});
test("messages show payment warnings and remove contact details", async ({ page }) => {
  await persona(page, "buyer_b");
  await room(page);
  await page.getByLabel("Message", { exact: true }).fill("Please wire to my new account");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText(
      "Atlas never changes payment details by message. Use only the locked instructions on this page.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Message", { exact: true }).fill("email me at x@y.com");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("email me at [email removed]", { exact: true })).toBeVisible();
  await expect(page.getByText("Contact details removed", { exact: true })).toBeVisible();
});
for (const theme of ["light", "dark"] as const)
  test(`trade room and documents fit 390px in ${theme} theme`, async ({ page }) => {
    await persona(page, "buyer_b");
    await room(page);
    if (theme === "dark")
      await page.getByRole("button", { name: "Switch to dark theme", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "Next step", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const next = await page.getByRole("heading", { name: "Next step", exact: true }).boundingBox(),
      parties = await page.getByRole("heading", { name: "Parties", exact: true }).boundingBox();
    expect(next && parties && next.y < parties.y).toBeTruthy();
    await page.getByRole("link", { name: /Share transfer agreement/i }).click();
    await expect(page.getByText(/Watermarked for Investor #B-117/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
