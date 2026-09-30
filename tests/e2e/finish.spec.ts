import { expect, test } from "./fixtures";

for (const theme of ["light", "dark"] as const)
  for (const width of [1440, 390]) {
    test(`diagrams, portfolio and tour panel at ${width}px in ${theme}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await context.addCookies([
        { name: "atlas_theme", value: theme, domain: "localhost", path: "/" },
      ]);
      await page.goto("/under-the-hood");
      await expect(
        page.getByRole("img", { name: "Atlas architecture" }).locator("svg[data-layout-ready]"),
      ).toBeVisible({ timeout: 20000 });
      for (const label of ["Holding", "Listing", "Bid", "Trade"]) {
        await page.getByRole("tab", { name: label, exact: true }).click();
        await expect(
          page
            .getByRole("img", { name: `${label} state machine` })
            .locator("svg[data-layout-ready]"),
        ).toBeVisible({ timeout: 20000 });
        // The entire rendered SVG stays inside its card, including on mobile.
        expect(
          await page
            .getByRole("img", { name: `${label} state machine` })
            .locator("svg")
            .evaluate((element) => {
              const svg = element as SVGSVGElement,
                bounds = svg.getBBox(),
                viewport = svg.viewBox.baseVal,
                box = svg.getBoundingClientRect(),
                region = svg.closest('[role="img"]')?.getBoundingClientRect();
              return (
                region !== undefined &&
                box.left >= region.left - 1 &&
                box.right <= region.right + 1 &&
                box.width > 0 &&
                bounds.x >= viewport.x - 1 &&
                bounds.y >= viewport.y - 1 &&
                bounds.x + bounds.width <= viewport.x + viewport.width + 1 &&
                bounds.y + bounds.height <= viewport.y + viewport.height + 1
              );
            }),
        ).toBe(true);
      }
      const diagram = page.getByRole("img", { name: "Trade state machine" }),
        before = await diagram.innerHTML();
      await page
        .getByRole("button", { name: `Switch to ${theme === "light" ? "dark" : "light"} theme` })
        .click();
      await expect.poll(() => diagram.innerHTML()).not.toBe(before);
      await page.goto("/portfolio");
      await expect(page.getByRole("row").filter({ hasText: "Falaj Robotics" })).toContainText(
        "4,000 sh",
      );
      await expect(page.getByRole("link", { name: "T-1036" })).toBeVisible();
      await page.goto("/");
      await page.getByRole("button", { name: "Start guided tour" }).click();
      await expect(page.getByRole("region", { name: "Guided tour" })).toContainText("Step 1 of 8");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.keyboard.press("Escape");
      await expect(page.getByRole("region", { name: "Guided tour" })).toHaveCount(0);
    });
  }
test("guided tour navigates all eight steps with the right persona, persists and ends", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start guided tour" }).click();
  const panel = page.getByRole("region", { name: "Guided tour" });
  const steps = [
    ["/companies/falaj-robotics", "Investor #B-081"],
    ["/bids", "Investor #B-081"],
    ["/bids", "Investor #B-081"],
    ["/holdings", "Holder #S-214"],
    ["/company", "Falaj Robotics · CFO"],
    ["/ops", "Atlas compliance"],
    ["/ops/audit", "Atlas compliance"],
    ["/under-the-hood", "Atlas compliance"],
  ];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) throw Error("step");
    await expect(panel).toContainText(`Step ${i + 1} of 8`);
    if (i === 2) await expect(panel).toContainText("Accept the counter in step 2 first");
    await panel.getByRole("button", { name: "Take me there" }).click();
    await expect(page).toHaveURL(step[0] as string);
    await expect(page.getByRole("navigation", { name: "Main", exact: true })).toContainText(
      step[1] as string,
    );
    if (i < 7) await panel.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.reload();
  await expect(panel).toContainText("Step 8 of 8");
  await panel.getByRole("button", { name: "Back", exact: true }).click();
  await expect(panel.getByRole("heading")).toBeFocused();
  await panel.getByRole("button", { name: "End tour" }).click();
  await expect(panel).toHaveCount(0);
});
test("company notification opens its trade and marks only that item read", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button").filter({ hasText: "Company · Falaj Robotics CFO" }).click();
  const bell = page.getByRole("button", { name: "Notifications, 1 unread", exact: true });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(
    page.getByRole("menuitem", { name: /Decide on the right of first refusal for T-1042/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bell).toBeVisible();
  await bell.click();
  await page
    .getByRole("menuitem", { name: /Decide on the right of first refusal for T-1042/ })
    .click();
  await expect(page.getByRole("heading", { name: "Trade T-1042", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Notifications, 0 unread", exact: true }),
  ).toBeVisible();
});
test("CSP nonce changes per request, matches framework scripts, without permitting script eval", async ({
  page,
}) => {
  const first = await page.goto("/"),
    header = first?.headers()["content-security-policy"];
  const nonce = header?.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(header).not.toContain("unsafe-eval");
  const nonces = await page
    .locator("script[nonce]")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLScriptElement).nonce));
  expect(nonces.length).toBeGreaterThan(0);
  expect(new Set(nonces)).toEqual(new Set([nonce]));
  const second = await page.reload();
  expect(second?.headers()["content-security-policy"]).not.toBe(header);
});
