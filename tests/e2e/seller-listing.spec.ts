import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function seller(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Holder #S-214/ }).click();
  await expect(page).toHaveURL("/holdings");
}
const card = (page: Page, company: string) =>
  page.getByRole("region", { name: `${company} holding`, exact: true });
async function wadiForm(page: Page) {
  await card(page, "Wadi Ledger").getByRole("link", { name: "List shares", exact: true }).click();
  await expect(page.getByRole("heading", { name: "List shares", exact: true })).toBeVisible();
}
test("seller holdings show eligibility, policy reasons and demand", async ({ page }) => {
  await seller(page);
  await expect(page.getByRole("region", { name: /holding$/ })).toHaveCount(3);
  await expect(
    card(page, "Falaj Robotics").getByText("You can sell up to 3,000 shares now."),
  ).toBeVisible();
  await expect(card(page, "Falaj Robotics").getByText("15,000 shares (50%)")).toBeVisible();
  await expect(
    card(page, "Falaj Robotics").getByText("Fair value AED 34.20–36.10 · Last trade AED 35.80"),
  ).toBeVisible();
  await expect(
    card(page, "Qamra Health").getByText("You can't list these shares yet."),
  ).toBeVisible();
  await expect(card(page, "Qamra Health").locator("li")).toHaveCount(2);
  await expect(
    card(page, "Falaj Robotics").getByText("4 buyers have mandates matching Falaj Robotics"),
  ).toBeVisible();
  await expect(
    card(page, "Wadi Ledger").getByText("2 buyers have mandates matching Wadi Ledger"),
  ).toBeVisible();
  await expect(
    card(page, "Qamra Health").getByText("1 buyer has a mandate matching Qamra Health"),
  ).toBeVisible();
  await expect(page.locator("#your-listings tbody tr")).toHaveCount(1);
  await expect(page.locator("#your-listings").getByText("AED 34.00")).toBeVisible();
  await expect(page.locator("#your-listings").getByText("2 sealed")).toBeVisible();
});
test("add holding is verified automatically without reloading", async ({ page }) => {
  await seller(page);
  await page.getByRole("button", { name: "Add holding", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a holding" });
  await expect(dialog.getByRole("combobox", { name: "Share class", exact: true })).toBeDisabled();
  await dialog.getByRole("combobox", { name: "Company", exact: true }).click();
  await page.getByRole("option", { name: "Wadi Ledger", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Share class", exact: true }).click();
  await page.getByRole("option", { name: "Ordinary", exact: true }).click();
  await dialog.getByLabel("Number of shares").fill("1000");
  await dialog.getByLabel("Date acquired").fill("2024-01-01");
  await dialog.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page.getByText("Awaiting company verification", { exact: true })).toBeVisible();
  await expect(card(page, "Wadi Ledger")).toHaveCount(2);
  await expect(page.getByText("Verified by Wadi Ledger", { exact: true })).toHaveCount(2, {
    timeout: 15000,
  });
});
test("creates a listing through review, auto-approval and confirmed withdrawal", async ({
  page,
}) => {
  await seller(page);
  await wadiForm(page);
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("10000");
  await expect(page.getByLabel("Minimum fill", { exact: true })).toHaveValue("2000");
  await page.getByLabel("Reserve price per share").fill("3.00");
  await expect(page.getByText(/At your reserve:.*USD 30,000/)).toBeVisible();
  await page.getByLabel("Quantity", { exact: true }).fill("5000");
  await expect(page.getByText(/At your reserve:.*USD 15,000/)).toBeVisible();
  await page.getByRole("button", { name: "Review listing", exact: true }).click();
  await expect(page.getByText("5 days after approval")).toBeVisible();
  await expect(page.getByText("USD 15,000", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit for review" })).toBeDisabled();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("5000");
  await page.getByRole("button", { name: "Review listing", exact: true }).click();
  await page
    .getByText("I confirm I own these shares and they are free of any other claim.")
    .click();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page).toHaveURL("/holdings");
  await expect(page.getByText("Listing L-3001 submitted for review.")).toBeVisible();
  const row = page
    .locator("#your-listings tbody tr")
    .filter({ has: page.getByRole("link", { name: "L-3001", exact: true }) });
  await expect(row.getByText("Awaiting Atlas review", { exact: true })).toBeVisible();
  await expect(row.getByText("Live", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(row.getByText(/Closes .*in [45] days/)).toBeVisible();
  await row.getByRole("button", { name: "Withdraw", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "Withdraw L-3001?" });
  await expect(confirm.getByText(/your 5,000 shares become available again/)).toBeVisible();
  await confirm.getByRole("button", { name: "Withdraw listing", exact: true }).click();
  await expect(row.getByText("Withdrawn", { exact: true })).toBeVisible();
  const available = card(page, "Wadi Ledger")
    .locator("dl > div")
    .filter({ has: page.getByText("Not listed", { exact: true }) });
  await expect(available).toContainText("10,000 sh");
});
test("client validation blocks malformed reserve", async ({ page }) => {
  await seller(page);
  await wadiForm(page);
  await page.getByLabel("Reserve price per share").fill("abc");
  await page.getByRole("button", { name: "Review listing", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Enter an amount like 3.00" }),
  ).toContainText("Enter an amount like 3.00 (up to two decimal places).");
  await expect(page.getByRole("heading", { name: "Listing details", exact: true })).toBeVisible();
  await expect(page.getByText("At your reserve: —")).toBeVisible();
});
test("Qamra blocks listing on direct route", async ({ page }) => {
  await seller(page);
  const qamra = card(page, "Qamra Health");
  await expect(qamra.getByRole("link", { name: "List shares", exact: true })).toHaveCount(0);
  const id = await qamra.getAttribute("data-holding-id");
  expect(id).toBeTruthy();
  await page.goto(`/holdings/${id}/list`);
  await expect(page.getByText(/Sales are paused until/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to holdings" })).toBeVisible();
});
test("seller pages work in both themes on mobile without page scroll", async ({ page }) => {
  await seller(page);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await wadiForm(page);
  await expect(page.getByRole("heading", { name: "Market context", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/holdings");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await wadiForm(page);
  await page.getByLabel("Reserve price per share").fill("3.00");
  await page.getByRole("button", { name: "Review listing", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
