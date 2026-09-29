import { expect, test } from "./fixtures";

const showcaseUrl = `http://localhost:${Number(process.env.E2E_PORT ?? 3100) + 2}/dev/ui`;

test("landing enters the demo", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Private shares, settled properly." }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Enter the demo" }).click();
  await expect(page).toHaveURL("/discover");
});

test("showcase includes all eleven sections in both themes", async ({ page }) => {
  await page.goto(showcaseUrl);
  const figureColumns = await page
    .locator("#figures .grid")
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" "));
  expect(figureColumns).toHaveLength(4);
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await page.getByRole("button", { name: "Switch to dark theme" }).click();
    for (const title of [
      "Colours",
      "Typography",
      "Buttons",
      "Status and verification",
      "Formatting",
      "Deadlines",
      "Figures",
      "Table",
      "Form controls",
      "Overlays",
      "Empty and loading",
    ]) {
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    }
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  }
});

test("theme toggles without reload and persists server-rendered on reload", async ({ page }) => {
  await page.goto("/discover");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const response = await page.reload();
  expect(await response?.text()).toContain('data-theme="dark"');
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("six security headers and no powered-by header", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response?.headers();
  expect(headers).toMatchObject({
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
    "cross-origin-opener-policy": "same-origin",
    "x-robots-tag": "noindex, nofollow",
  });
  expect(headers).not.toHaveProperty("x-powered-by");
});

test("unknown route renders the standalone 404", async ({ page }) => {
  const response = await page.goto("/nope");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to the start" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("navigation", { name: "Main", exact: true })).toHaveCount(0);
});

test("mobile sheet navigation and demo controls work without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/discover");
  await expect(
    page.getByRole("navigation", { name: "Main", exact: true, includeHidden: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Mobile" })
    .getByRole("link", { name: "My bids" })
    .click();
  await expect(page).toHaveURL("/bids");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Demo controls" }).click();
  await expect(page.getByRole("menuitem", { name: "+1 day", exact: true })).toBeEnabled();
  await expect(page.getByRole("menuitem", { name: "Buyer A" })).toBeEnabled();
  await expect(
    page.getByRole("menuitem", { name: "Simulate competing bid", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await page.goto(showcaseUrl);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("first Tab reaches skip link and activation focuses main", async ({ page }) => {
  await page.goto("/discover");
  await expect(page.getByRole("navigation", { name: "Main", exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("day controls are enabled and keyboard focusable", async ({ page }) => {
  await page.goto("/discover");
  const control = page.getByRole("button", { name: "+1 day", exact: true });
  await expect(control).toBeEnabled();
  await control.focus();
  await expect(control).toBeFocused();
});

test("confirmation starts on cancel; overlays and form controls are usable", async ({ page }) => {
  await page.goto(showcaseUrl);
  await page.getByRole("button", { name: "Confirm example", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Primary example confirmed.")).toBeVisible();
  await page.getByRole("button", { name: "Danger example", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Open dialog", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Example dialog" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open sheet", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Example sheet" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Select example", exact: true }).click();
  await expect(page.getByText("Menu example selected.")).toBeVisible();
  await page.getByLabel("Include completed examples").check();
  await expect(page.getByLabel("Include completed examples")).toBeChecked();
  await page.getByRole("combobox", { name: "Share class" }).click();
  await page.getByRole("option", { name: "Preferred", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Share class" })).toHaveText("Preferred");
  await page.getByRole("tab", { name: "Details" }).click();
  await expect(page.getByText("An alternate tab panel.")).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  for (const kind of ["Success", "Info", "Error"]) {
    await page.getByRole("button", { name: `${kind} toast`, exact: true }).click();
    await expect(page.getByText(`${kind} example`, { exact: true })).toBeVisible();
  }
});

test("Tailwind colour keywords survive the Atlas palette reset", async ({ page }) => {
  await page.goto(showcaseUrl);
  const computed = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "bg-transparent text-current border-transparent border";
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const result = {
      background: style.backgroundColor,
      border: style.borderColor,
      colour: style.color,
      body: getComputedStyle(document.body).color,
    };
    probe.remove();
    return result;
  });
  expect(computed.background).toBe("rgba(0, 0, 0, 0)");
  expect(computed.border).toBe("rgba(0, 0, 0, 0)");
  expect(computed.colour).toBe(computed.body);
});
