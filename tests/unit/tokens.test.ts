import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import json from "../../docs/design/tokens.json";
import { generateTokensCss, parseTokens, resolveColor } from "../../scripts/lib/tokens";

const tokens = parseTokens(json);
const css = generateTokensCss(tokens);
it("generated CSS is byte-for-byte current and deterministic", () => {
  expect(css).toBe(readFileSync("src/styles/tokens.css", "utf8"));
  expect(generateTokensCss(parseTokens(json))).toBe(css);
  expect(css).toContain("--color-*: initial;");
});
it("every colour resolves in both themes; chart alias remains a CSS variable", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const token of tokens.color.tokens)
      expect(resolveColor(tokens, token.name, theme)).toMatch(/^#[a-fA-F0-9]{6}$/);
  }
  expect(css.match(/--chart-above: var\(--info\);/g)).toHaveLength(2);
});
it("emits all ten utilities and tabular figures", () => {
  const styles = [
    "display",
    "heading-1",
    "heading-2",
    "title",
    "body",
    "body-sm",
    "label",
    "figure-lg",
    "figure",
    "mono",
  ];
  expect(css.match(/@utility /g)).toHaveLength(10);
  for (const style of styles) expect(css).toContain(`@utility type-${style} {`);
  for (const style of ["figure-lg", "figure"])
    expect(css.match(new RegExp(`@utility type-${style} \\{([^}]+)\\}`))?.[1]).toContain(
      "font-variant-numeric: tabular-nums;",
    );
});
it.each([
  { name: "broken-dark", value: { dark: "#000000" } },
  { name: "missing-dark", value: { light: "#000000" } },
  { name: "broken-alias", value: "{absent}" },
  { name: "paper", value: "#000000" },
  { name: "bad_name", value: "#000000" },
  { name: "bad-hex", value: "#xyzxyz" },
])("rejects malformed $name and identifies it", (token) =>
  expect(() =>
    parseTokens({ ...json, color: { ...json.color, tokens: [...json.color.tokens, token] } }),
  ).toThrow(token.name));
it("supports plain hex fallbacks and rejects alias cycles", () => {
  const fallback = parseTokens({
    ...json,
    color: { tokens: [{ name: "fallback", value: "#112233" }] },
  });
  expect(resolveColor(fallback, "fallback", "dark")).toBe("#112233");
  expect(() =>
    parseTokens({
      ...json,
      color: {
        tokens: [
          { name: "cycle-a", value: "{cycle-b}" },
          { name: "cycle-b", value: "{cycle-a}" },
        ],
      },
    }),
  ).toThrow("cycle-a");
});

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
}

describe.each(["light", "dark"] as const)("WCAG 2.1 contrast in %s", (theme) => {
  const L = (name: string) => luminance(resolveColor(tokens, name, theme));
  const textPairs = [
    "ink/paper",
    "ink/surface",
    "ink/surface-sunken",
    "ink-muted/paper",
    "ink-muted/surface",
    "ink-muted/surface-sunken",
    "on-green/atlas-green",
    "atlas-green/surface",
    "brass/surface",
    "brass/brass-soft",
    "ink/brass-soft",
    "info/info-soft",
    "success/success-soft",
    "warning/warning-soft",
    "danger/danger-soft",
    "ink/atlas-green-soft",
    "ink/chart-band",
    "paper/danger",
  ];
  const controlPairs = [
    "line-strong/surface",
    "focus-ring/paper",
    "focus-ring/surface",
    "chart-above/surface",
    "chart-below/surface",
  ];
  it.each([
    ...textPairs.map((pair) => ({ pair, minimum: 4.5 })),
    ...controlPairs.map((pair) => ({ pair, minimum: 3 })),
  ])("$pair ≥ $minimum", ({ pair, minimum }) => {
    const [a = "", b = ""] = pair.split("/");
    const ratio = (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
    expect(ratio, `${pair} (${theme}): ${ratio.toFixed(4)}:1`).toBeGreaterThanOrEqual(minimum);
  });
  it("chart colours differ in lightness", () => {
    const delta = Math.abs(L("chart-above") - L("chart-below"));
    expect(
      delta,
      `chart-above/chart-below (${theme}): luminance delta ${delta}`,
    ).toBeGreaterThanOrEqual(0.05);
  });
});
