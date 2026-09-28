import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function seller(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Holder #S-214/ }).click();
  await expect(page).toHaveURL("/holdings");
}
async function openListing(page: Page) {
  await page.locator("#your-listings").getByRole("link", { name: "L-2031", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Listing L-2031", exact: true })).toBeVisible();
}
async function composer(page: Page) {
  await page.goto("/companies/falaj-robotics");
  const row = page
    .locator("#listings tbody tr")
    .filter({ has: page.getByText("L-2031", { exact: true }) });
  await row.getByRole("link", { name: "Bid", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Place a bid", exact: true })).toBeVisible();
}
async function confirm(page: Page, title: string, label: string) {
  const d = page.getByRole("alertdialog", { name: title, exact: true });
  await expect(d).toBeVisible();
  await d.getByRole("button", { name: label, exact: true }).click();
}
test("buyer submits a binding bid, amends and withdraws", async ({ page }) => {
  await composer(page);
  await page.getByLabel("Price per share (AED)").fill("35.50");
  await page.getByLabel("Quantity", { exact: true }).fill("5000");
  await expect(page.getByText("Within the fair-value band", { exact: true })).toBeVisible();
  await expect(page.getByText(/Total:.*AED 177,500/)).toBeVisible();
  await page.getByRole("button", { name: "Review bid", exact: true }).click();
  await confirm(page, "Submit a binding bid?", "Submit bid");
  await expect(page).toHaveURL("/bids");
  await expect(page.getByText("In the window", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Amend", exact: true }).click();
  await page.getByLabel("Price per share (AED)").fill("35.60");
  await page.getByRole("button", { name: "Update bid", exact: true }).click();
  await confirm(page, "Update your bid?", "Update bid");
  await expect(page).toHaveURL("/bids");
  await expect(page.getByRole("cell", { name: "AED 35.60", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Amend", exact: true }).click();
  await page.getByRole("button", { name: "Withdraw bid", exact: true }).click();
  await confirm(page, "Withdraw your bid on L-2031?", "Withdraw bid");
  await expect(page).toHaveURL("/bids");
  await page.getByRole("tab", { name: "Past", exact: true }).click();
  await expect(page.getByText("Withdrawn", { exact: true })).toBeVisible();
});
test("buyer accepts the seed counter and simulated seller creates a trade without reload", async ({
  page,
}) => {
  await page.goto("/bids");
  await expect(page.getByText(/Holder #S-102 countered your AED 34.00 bid/)).toBeVisible();
  await page.getByRole("button", { name: "Accept AED 35.50", exact: true }).click();
  await confirm(page, "Accept the counter?", "Accept counter");
  await expect(
    page.getByRole("heading", { name: "Counter on L-2019 · Falaj Robotics", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Counter accepted at AED 35.50", { exact: true })).toHaveCount(0, {
    timeout: 15000,
  });
  await page.getByRole("tab", { name: "Past", exact: true }).click();
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: "L-2019", exact: true }) });
  await expect(row.getByText("Accepted · 3,000 sh", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(row.getByRole("link", { name: "Open trade", exact: true })).toBeVisible();
});
test("seller reviews sealed bids, counters and accepts the recomputed allocation", async ({
  page,
}) => {
  await seller(page);
  await openListing(page);
  await expect(page.getByText(/2 bids received/)).toBeVisible();
  await expect(page.getByText("AED 35.20", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Investor #B-204", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "+7 days", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bids", exact: true })).toBeVisible();
  const d = page
    .getByRole("row")
    .filter({ has: page.getByText("Investor #B-352", { exact: true }) });
  await d.getByRole("button", { name: "Counter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Counter Investor #B-352's bid", exact: true });
  await dialog.getByLabel("Price per share (AED)").fill("35.00");
  await dialog.getByRole("button", { name: "Send counter", exact: true }).click();
  await expect(d.getByText("Counter accepted at AED 35.00", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await page
    .getByRole("checkbox", { name: "Select bid from Investor #B-204", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Select bid from Investor #B-352", exact: true })
    .check();
  await expect(page.getByText("Proceeds AED 421,200", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Investor #B-204: 6,000 sh at AED 35.20", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Investor #B-352: 6,000 sh at AED 35.00", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Accept selected bids", exact: true }).click();
  await confirm(page, "Accept 2 bids?", "Accept bids");
  await expect(page.getByRole("heading", { name: "Trades", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^T-\d+$/ })).toHaveCount(2);
  await expect(page.getByRole("cell", { name: /Saffron Secondaries Fund I/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Harbour Row Capital/ })).toBeVisible();
});
test("toolbar and listing use the same competing-bid action", async ({ page }) => {
  await seller(page);
  await page.getByRole("button", { name: "More demo controls", exact: true }).click();
  await page.getByRole("menuitem", { name: "Simulate competing bid", exact: true }).click();
  await expect(
    page.getByText("A simulated investor placed a sealed bid on L-2031.", { exact: true }),
  ).toBeVisible();
  await openListing(page);
  await expect(page.getByText(/3 bids received/)).toBeVisible();
  await page.getByRole("button", { name: "Simulate competing bid", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Every simulated investor has already bid on L-2031.",
  );
  await expect(page.getByText("AED 36.87", { exact: true })).toHaveCount(0);
});
for (const theme of ["light", "dark"] as const)
  test(`composer and ladder fit mobile in ${theme} theme`, async ({ page }) => {
    await composer(page);
    if (theme === "dark")
      await page.getByRole("button", { name: "Switch to dark theme", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Price per share (AED)").fill("35.50");
    await expect(page.getByRole("button", { name: "Review bid", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("combobox", { name: "View as" }).click();
    await page.getByRole("option", { name: "Seller · Holder #S-214", exact: true }).click();
    await expect(page).toHaveURL("/holdings");
    await openListing(page);
    await page.getByRole("button", { name: "+7 days", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "Select bid from Investor #B-204", exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const table = page.getByRole("table");
    expect(
      await table.evaluate(
        (e) =>
          e.parentElement !== null && e.parentElement.scrollWidth > e.parentElement.clientWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("checkbox", { name: "Select bid from Investor #B-204", exact: true })
      .check();
    await expect(page.getByText("Proceeds AED 211,200", { exact: true })).toBeVisible();
  });
