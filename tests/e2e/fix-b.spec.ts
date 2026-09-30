import { expect, test } from "./fixtures";

async function insideTable(page: import("@playwright/test").Page, selector: string) {
  const result = await page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const box = element.getBoundingClientRect();
      const container =
        element.closest('[data-slot="table-container"]') ?? element.closest(".overflow-x-auto");
      if (!container) return false;
      const visible = container.getBoundingClientRect();
      return box.left >= visible.left - 1 && box.right <= visible.right + 1;
    });
  expect(result, `${selector} stays in the unscrolled table viewport`).toBe(true);
}

test("laptop tables keep their actions in view", async ({ page }) => {
  await page.setViewportSize({ width: 1054, height: 743 });
  await page.goto("/discover");
  await insideTable(page, '[data-slot="table"] a:has-text("View")');
  await page.goto("/companies/falaj-robotics");
  await insideTable(page, '#listings a:has-text("Respond")');
  await page.goto("/bids");
  await page.getByRole("tab", { name: "Past" }).click();
  await insideTable(page, 'table a:has-text("Open trade")');
  await page.goto("/");
  await page.getByRole("button", { name: /Seller · Holder #S-214/ }).click();
  await page.getByRole("button", { name: "Auto-pilot on" }).click();
  await page.getByRole("button", { name: "Time" }).click();
  await page.getByRole("menuitem", { name: "+7 days" }).click();
  await page.locator("#your-listings").getByRole("link", { name: "L-2031" }).click();
  await expect(page).toHaveTitle("Listing L-2031 · Atlas");
  await expect(page.getByRole("heading", { name: "Bids", exact: true })).toBeVisible();
  await insideTable(page, 'table button:has-text("Counter")');
});

test("clear filters, page titles and document wording", async ({ page }) => {
  await page.goto("/discover");
  await page.getByLabel("Open listings only").check();
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("link", { name: "Clear", exact: true }).click();
  await expect(page.getByLabel("Open listings only")).not.toBeChecked();
  await page.goto("/companies/falaj-robotics");
  await expect(page).toHaveTitle("Falaj Robotics · Atlas");
  await expect(page.getByText("View only · watermarked").first()).toBeVisible();
  await page.getByRole("link", { name: /FY2025 audited financials/ }).click();
  await expect(page).toHaveTitle("FY2025 audited financials · Atlas");
  await expect(page.getByRole("heading", { name: "FY2025 audited financials" })).toHaveCount(1);
  await page.goto("/trades");
  await page.getByRole("tab", { name: "Completed" }).click();
  await page.getByRole("link", { name: "T-1036" }).click();
  await expect(page).toHaveTitle("Trade T-1036 · Atlas");
  await page.getByRole("link", { name: "Share transfer agreement" }).click();
  await expect(page).toHaveTitle("Share transfer agreement · Atlas");
  await page.goto("/nope");
  await expect(page.getByText(/private demo sandbox/)).toBeVisible();
});
