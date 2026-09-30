import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

for (const theme of ["light", "dark"] as const) {
  test(`all product surfaces have no serious or critical axe violations in ${theme}`, async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await context.addCookies([
      { name: "atlas_theme", value: theme, domain: "localhost", path: "/" },
    ]);
    async function scan(title: string) {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const dynamicTitles: Record<string, string> = {
        Company: "Falaj Robotics · Atlas",
        Listing: "Listing L-2031 · Atlas",
        "Trade room": "Trade T-1042 · Atlas",
      };
      await expect(page).toHaveTitle(
        dynamicTitles[title] ??
          (title === "Private shares, settled properly" ? title : `${title} · Atlas`),
      );
      if (title !== "Private shares, settled properly")
        await expect(page.getByRole("combobox", { name: "View as" })).toBeEnabled();
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
      ).toEqual([]);
    }
    await page.goto("/");
    await scan("Private shares, settled properly");
    await page
      .getByRole("button")
      .filter({ hasText: "Investor #B-081 · Palmgate Family Office" })
      .click();
    await scan("Discover");
    await page.goto("/companies/falaj-robotics");
    await scan("Company");
    const row = page.getByRole("row").filter({ hasText: "L-2031" });
    await row.getByRole("link", { name: "Bid", exact: true }).click();
    await scan("Place a bid");
    await page.goto("/bids");
    await scan("My bids");
    await page.goto("/");
    await page.getByRole("button").filter({ hasText: "Holder #S-214" }).click();
    await page.getByRole("button", { name: "Auto-pilot on", exact: true }).click();
    await scan("Holdings");
    await page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Wadi Ledger", exact: true }) })
      .getByRole("link", { name: "List shares", exact: true })
      .click();
    await scan("List shares");
    await page.goto("/holdings");
    await page
      .getByRole("row")
      .filter({ hasText: "L-2031" })
      .getByRole("link", { name: "L-2031", exact: true })
      .click();
    await page.getByRole("button", { name: "+7 days", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Bids", exact: true })).toBeVisible();
    await scan("Listing");
    // The earlier company auto-waiver can default after the ladder's seven-day clock jump.
    // Restore the seed before scanning the active trade and keep auto-pilot off during scans.
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.getByRole("button", { name: "Reset demo", exact: true }).click();
    await expect(page).toHaveURL("/holdings");
    await page.getByRole("button", { name: "Auto-pilot on", exact: true }).click();
    await expect(page.getByRole("button", { name: "Auto-pilot off", exact: true })).toBeEnabled();
    await page.goto("/");
    await page
      .getByRole("button")
      .filter({ hasText: "Buyer B · Investor #B-117 · Individual investor" })
      .click();
    await expect(page).toHaveURL("/discover");
    await page.goto("/trades");
    await page.getByRole("link", { name: "T-1042", exact: true }).click();
    await scan("Trade room");
    await page.goto("/");
    await page.getByRole("button").filter({ hasText: "Company · Falaj Robotics CFO" }).click();
    await scan("Company console");
    await page.goto("/company/policy");
    await scan("Transfer policy");
    await page.getByRole("button", { name: "Edit policy" }).click();
    await scan("Transfer policy");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.goto("/");
    await page.getByRole("button").filter({ hasText: "Operator · Atlas Compliance" }).click();
    await scan("Operations");
    await page.goto("/ops/audit");
    await scan("Audit log");
    await page.goto("/under-the-hood");
    await expect(
      page.getByRole("img", { name: "Holding state machine" }).locator("svg"),
    ).toBeVisible({ timeout: 20000 });
    await scan("Under the hood");
  });
}
