import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures";

const widths = [1054, 1120, 1280, 1440] as const;

async function labelIsBelowTitle(link: Locator) {
  return link.locator("span.flex-col > span").evaluateAll((nodes) => {
    const [title, label] = nodes;
    if (!title || !label) return false;
    return label.getBoundingClientRect().top >= title.getBoundingClientRect().bottom;
  });
}

test("persona select stays clear of Time and More at laptop and desktop widths", async ({
  page,
}) => {
  await page.goto("/discover");
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    const trigger = page.getByRole("combobox", { name: "View as" });
    await expect(trigger).toHaveAttribute(
      "title",
      "Buyer A · Investor #B-081 · Palmgate Family Office",
    );
    const triggerBox = await trigger.boundingBox();
    const timeBox = await page
      .getByRole("button", { name: width < 1280 ? "Time" : "+1 day", exact: true })
      .boundingBox();
    const moreBox = await page.getByRole("button", { name: "More demo controls" }).boundingBox();
    expect(triggerBox, `persona trigger at ${width}px`).not.toBeNull();
    expect(timeBox, `time control at ${width}px`).not.toBeNull();
    expect(moreBox, `More control at ${width}px`).not.toBeNull();
    if (triggerBox && timeBox && moreBox) {
      expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(timeBox.x + 1);
      expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(moreBox.x + 1);
    }
  }
  await page.getByRole("combobox", { name: "View as" }).click();
  await expect(
    page.getByRole("option", { name: "Buyer A · Investor #B-081 · Palmgate Family Office" }),
  ).toBeVisible();
});

test("fair-value figure fits its card at laptop and desktop widths", async ({ page }) => {
  await page.goto("/companies/falaj-robotics");
  const figure = page.getByText("Fair-value band · ordinary shares").locator("..");
  const value = figure.locator(".type-figure-lg");
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await value.evaluate((element) => element.scrollWidth <= element.clientWidth),
      `fair-value figure at ${width}px`,
    ).toBe(true);
  }
});

test("info-pack and trade document labels stay below their titles", async ({ page }) => {
  await page.goto("/companies/falaj-robotics");
  const infoRow = page.getByRole("link", { name: /FY2025 audited financials/ });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await expect
      .poll(() => labelIsBelowTitle(infoRow), { message: `info-pack row at ${width}px` })
      .toBe(true);
  }
  await page.goto("/trades");
  await page.getByRole("tab", { name: "Completed" }).click();
  await page.getByRole("link", { name: "T-1036" }).click();
  const tradeRow = page.getByRole("link", { name: /Share transfer agreement/ });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await expect
      .poll(() => labelIsBelowTitle(tradeRow), { message: `trade document row at ${width}px` })
      .toBe(true);
  }
});
