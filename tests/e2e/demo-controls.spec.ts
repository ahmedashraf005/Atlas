import { expect, test, watchBrowserPage } from "./fixtures";

async function switchTo(page: import("@playwright/test").Page, label: string) {
  await page.getByRole("combobox", { name: "View as" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}
const timeText = (page: import("@playwright/test").Page) => page.getByText(/^Sandbox time /);
function parseTime(text: string): number {
  const match = text.match(/(\d{1,2}) (\w{3}) (\d{4}), (\d{2}):(\d{2}) GST/);
  if (!match) throw new Error(`Invalid time: ${text}`);
  return Date.parse(`${match[1]} ${match[2]} ${match[3]} ${match[4]}:${match[5]}:00 GMT+0400`);
}
test("first visit sets an httpOnly signed session and buyer viewer card", async ({
  page,
  context,
}) => {
  await page.goto("/discover");
  const cookie = (await context.cookies()).find((c) => c.name === "atlas_session");
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/", secure: true });
  expect(cookie?.value.split(".")).toHaveLength(3);
  const nav = page.getByRole("navigation", { name: "Main", exact: true });
  await expect(nav.getByText("Signed in as buyer")).toBeVisible();
  await expect(nav.getByText("Investor #B-081", { exact: true })).toBeVisible();
});
test("persona switching changes home, viewer card and role navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/discover");
  const select = page.getByRole("combobox", { name: "View as" });
  expect(
    await select
      .locator('[data-slot="select-value"]')
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(32);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await switchTo(page, "Seller · Holder #S-214");
  await expect(page).toHaveURL("/holdings");
  const nav = page.getByRole("navigation", { name: "Main", exact: true });
  await expect(nav.getByText("Holder #S-214", { exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Holdings", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Trades", exact: true })).toBeVisible();
  await switchTo(page, "Operator · Atlas compliance");
  await expect(page).toHaveURL("/ops");
  await expect(nav.getByRole("link", { name: "Console", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Audit log", exact: true })).toBeVisible();
  await switchTo(page, "Company admin · Falaj Robotics");
  await expect(page).toHaveURL("/company");
});
test("+1, +7 and +30 days advance sandbox time exactly", async ({ page }) => {
  await page.goto("/discover");
  let previous = parseTime(await timeText(page).innerText());
  for (const days of [1, 7, 30]) {
    await page
      .getByRole("button", { name: `+${days} ${days === 1 ? "day" : "days"}`, exact: true })
      .click();
    await expect
      .poll(async () => parseTime(await timeText(page).innerText()) - previous)
      .toBe(days * 86400000);
    previous = parseTime(await timeText(page).innerText());
  }
});
test("auto-pilot and ROFR mode persist across reload", async ({ page }) => {
  await page.goto("/discover");
  await page.getByRole("button", { name: "Auto-pilot on", exact: true }).click();
  await expect(page.getByRole("button", { name: "Auto-pilot off", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Auto-pilot off", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "More demo controls" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Company exercises ROFR" }).click();
  await page.reload();
  await page.getByRole("button", { name: "More demo controls" }).click();
  await expect(
    page.getByRole("menuitemcheckbox", { name: "Company exercises ROFR" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Auto-pilot off", exact: true }).click();
  await expect(page.getByRole("button", { name: "Auto-pilot on", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
test("reset confirms, clears clock offset, keeps persona and replaces session", async ({
  page,
  context,
}) => {
  await page.goto("/discover");
  await switchTo(page, "Seller · Holder #S-214");
  await page.getByRole("button", { name: "+30 days", exact: true }).click();
  await expect
    .poll(async () => parseTime(await timeText(page).innerText()) - Date.now())
    .toBeGreaterThan(29 * 86400000);
  const before = (await context.cookies()).find((c) => c.name === "atlas_session")?.value;
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("alertdialog", { name: "Reset the demo?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect
    .poll(async () => (await context.cookies()).find((c) => c.name === "atlas_session")?.value)
    .not.toBe(before);
  await expect(page).toHaveURL("/holdings");
  await expect
    .poll(async () => Math.abs(parseTime(await timeText(page).innerText()) - Date.now()))
    .toBeLessThan(120000);
  await expect(
    page
      .getByRole("navigation", { name: "Main", exact: true })
      .getByText("Holder #S-214", { exact: true }),
  ).toBeVisible();
});
test("separate browser contexts keep persona and time isolated", async ({ page, browser }) => {
  await page.goto("/discover");
  const other = await browser.newContext();
  try {
    const second = await other.newPage();
    const verifySecond = await watchBrowserPage(second);
    await second.goto("/discover");
    const original = parseTime(await timeText(second).innerText());
    await switchTo(page, "Seller · Holder #S-214");
    await page.getByRole("button", { name: "+1 day", exact: true }).click();
    await second.reload();
    await expect(
      second
        .getByRole("navigation", { name: "Main", exact: true })
        .getByText("Investor #B-081", { exact: true }),
    ).toBeVisible();
    expect(parseTime(await timeText(second).innerText())).toBe(original);
    expect((await other.cookies()).find((c) => c.name === "atlas_session")?.value).not.toBe(
      (await page.context().cookies()).find((c) => c.name === "atlas_session")?.value,
    );
    await verifySecond();
  } finally {
    await other.close();
  }
});
test("mobile demo controls support persona, autopilot, clock and reset", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/discover");
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("menuitem", { name: "Seller · Holder #S-214", exact: true }).click();
  await expect(page).toHaveURL("/holdings");
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("menuitem", { name: "Auto-pilot on", exact: true }).click();
  await page.getByRole("button", { name: "Demo controls" }).click();
  await expect(page.getByRole("menuitem", { name: "Auto-pilot off", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "+1 day", exact: true }).click();
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("menuitem", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("alertdialog", { name: "Reset the demo?" })).toBeVisible();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
