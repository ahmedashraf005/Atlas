import { expect, test } from "./fixtures";

test("landing offers five personas and seller entry", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('form button[type="submit"]')).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: /Investor #B-081 · Palmgate Family Office/ }),
  ).toBeVisible();
  await expect(page.getByText("Current", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: /Holder #S-214/ }).click();
  await expect(page).toHaveURL("/holdings");
});
test("discover filters and company navigation", async ({ page }) => {
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "Discover", exact: true })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(4);
  await page.getByLabel("Open listings only").check();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("row")).toHaveCount(2);
  await page.getByRole("link", { name: "Falaj Robotics" }).click();
  await expect(page).toHaveURL("/companies/falaj-robotics");
});
test("Falaj page, document and exit slider", async ({ page }) => {
  await page.goto("/companies/falaj-robotics");
  await expect(page.getByText("AED 42.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("AED 34.20–36.10", { exact: true }).first()).toBeVisible();
  await expect(
    page
      .getByRole("img", { name: /6 Atlas trades/ })
      .locator("svg")
      .first(),
  ).toBeVisible();
  await expect(page.locator("#listings tbody tr")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Respond" })).toBeVisible();
  await expect(page.getByText("Access approved")).toBeVisible();
  const ordinary = page.getByText("Ordinary", { exact: true }).first();
  await expect(ordinary).toBeVisible();
  const exitSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Value at exit", exact: true }) });
  const perShare = exitSection
    .getByText("Ordinary", { exact: true })
    .locator("..")
    .locator("span")
    .last();
  const previous = await perShare.innerText();
  await page.getByRole("slider", { name: "Exit valuation" }).press("ArrowRight");
  await expect(perShare).not.toHaveText(previous);
  await page.getByRole("link", { name: /FY2025 audited financials/ }).click();
  await expect(page.getByText("AED 38.2M")).toBeVisible();
  await expect(page.getByText(/Watermarked for Investor #B-081/)).toBeVisible();
});
test("buyer B Wadi access is denied automatically", async ({ page }) => {
  await page.goto("/discover");
  await page.getByRole("combobox", { name: "View as" }).click();
  await page.getByRole("option", { name: "Buyer B · Investor #B-117", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "View as" })).toContainText("Buyer B");
  await page.goto("/companies/wadi-ledger");
  await page.getByRole("button", { name: "Request access" }).first().click();
  const submit = page.getByRole("button", { name: "Accept NDA and request access" });
  await expect(submit).toBeDisabled();
  await page.getByText("I agree to the NDA (version v1)").click();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText("Awaiting company approval", { exact: true })).toBeVisible();
  await expect(page.getByText("Access not granted")).toBeVisible({ timeout: 15000 });
});
test("buyer B Qamra access and redacted question", async ({ page }) => {
  await page.goto("/discover");
  await page.getByRole("combobox", { name: "View as" }).click();
  await page.getByRole("option", { name: "Buyer B · Investor #B-117", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "View as" })).toContainText("Buyer B");
  await page.goto("/companies/qamra-health");
  await page.getByRole("button", { name: "Request access" }).first().click();
  await page.getByText("I agree to the NDA (version v1)").click();
  await page.getByRole("button", { name: "Accept NDA and request access" }).click();
  await expect(page.getByText("Access approved")).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("Ask the company a question").fill("Please call +971 50 123 4567");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText(/Contact details were removed/)).toBeVisible();
  await expect(page.getByText(/\[phone removed\]/)).toBeVisible();
});
test("company fits mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/companies/falaj-robotics");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("company and discovery work in dark theme", async ({ page }) => {
  await page.goto("/companies/falaj-robotics");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("img", { name: /6 Atlas trades/ })).toBeVisible();
  await expect(page.locator("#listings tbody tr")).toHaveCount(3);
  await page.goto("/discover");
  await expect(page.getByRole("row")).toHaveCount(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/companies/falaj-robotics");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
