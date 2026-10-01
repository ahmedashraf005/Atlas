import { expect, test } from "./fixtures";

function sandboxTime(value: string): number {
  const match = value.match(/(\d{1,2}) (\w{3}) (\d{4}), (\d{2}):(\d{2}) GST/);
  if (!match) throw Error("Sandbox time missing");
  return Date.parse(`${match[1]} ${match[2]} ${match[3]} ${match[4]}:${match[5]}:00 GMT+0400`);
}

test("Buyer A's idle sandbox leaves Buyer B's ROFR decision for the company", async ({ page }) => {
  test.setTimeout(100000);
  await page.goto("/discover");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page
    .getByRole("alertdialog", { name: "Reset the demo?" })
    .getByRole("button", { name: "Reset demo" })
    .click();
  await expect(page).toHaveURL("/discover");
  await page.waitForTimeout(45000);
  await page.getByRole("combobox", { name: "View as" }).click();
  await page.getByRole("option", { name: "Company · Falaj Robotics CFO" }).click();
  await expect(page).toHaveURL("/company");
  await expect(page.getByText("Decisions waiting", { exact: true }).locator("..")).toContainText(
    "2",
  );
  await expect(page.getByText("Right of first refusal · T-1042")).toBeVisible();
});

for (const width of [1054, 1280])
  test(`toolbar shows every control at ${width}px and advances seven days`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1054 ? 743 : 800 });
    await page.goto("/discover");
    const select = page.getByRole("combobox", { name: "View as" });
    await expect(select).toBeVisible();
    expect(await select.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(
      220,
    );
    await expect(page.getByRole("button", { name: "More demo controls" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Auto-pilot on", exact: true })).toBeVisible();
    const before = sandboxTime((await page.getByText(/^Sandbox time /).textContent()) ?? "");
    if (width < 1440) {
      await page.getByRole("button", { name: "Time", exact: true }).click();
      await page.getByRole("menuitem", { name: "+7 days" }).click();
    } else await page.getByRole("button", { name: "+7 days", exact: true }).click();
    await expect
      .poll(
        async () =>
          sandboxTime((await page.getByText(/^Sandbox time /).textContent()) ?? "") - before,
      )
      .toBe(7 * 86400000);
    await expect(page.getByRole("main")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

for (const width of [1054, 1440])
  test(`four state diagrams fit their cards and open full size at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/under-the-hood");
    for (const label of ["Holding", "Listing", "Bid", "Trade"]) {
      await page.getByRole("tab", { name: label, exact: true }).click();
      const image = page.getByRole("img", { name: `${label} state machine` });
      const svg = image.locator("svg[data-layout-ready]");
      await expect(svg).toBeVisible({ timeout: 20000 });
      const box = await svg.boundingBox(),
        card = await image.boundingBox();
      expect(box).not.toBeNull();
      expect(card).not.toBeNull();
      if (box && card) {
        expect(box.x).toBeGreaterThanOrEqual(card.x - 1);
        expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width + 1);
      }
      await image.locator("..").getByRole("button", { name: "Open full size" }).click();
      const dialog = page.getByRole("dialog", { name: `${label} state machine` });
      await expect(dialog.locator("svg[data-layout-ready]")).toBeVisible();
      const scroller = dialog.getByRole("region", { name: `${label} state machine full size` });
      expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0);
      if (label === "Trade")
        expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      await dialog.getByRole("button", { name: "Close" }).click();
    }
  });

test("security demonstrations switch to the right persona and destination", async ({ page }) => {
  const cases = [
    ["Fake holdings", "Company", "/company", "Falaj Robotics"],
    ["Double-selling", "Seller", "/holdings", "Holdings"],
    ["Wash trades", "Buyer A", "/companies/falaj-robotics", "Falaj Robotics"],
    ["Bid leakage", "Seller", /\/listings\//, "Listing L-2031"],
    ["Wire fraud", "Buyer B", /\/trades\//, "Trade T-1042"],
    ["Buyer default", "Buyer B", /\/trades\//, "Trade T-1042"],
    ["Account takeover", "Buyer B", /\/trades\//, "Trade T-1042"],
    ["Insider abuse", "Operator", "/ops/audit", "Audit log"],
  ] as const;
  for (const [threat, role, destination, heading] of cases) {
    await page.goto("/under-the-hood");
    await page
      .getByRole("row")
      .filter({ hasText: threat })
      .getByRole("button", { name: `See it as ${role}` })
      .click();
    await expect(page).toHaveURL(destination);
    await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
  }
  await page.goto("/under-the-hood");
  await expect(page.getByRole("row").filter({ hasText: "Shill bidding" })).toContainText(
    "Rule enforced in createBid",
  );
});

test("health checks the database without minting a session", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["set-cookie"]).toBeUndefined();
});
