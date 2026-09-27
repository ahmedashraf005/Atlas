import { describe, expect, it } from "vitest";
import {
  deadlineTone,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  formatRelative,
  formatShares,
} from "@/lib/format";

describe("money uses bigint arithmetic, including beyond Number precision", () => {
  it.each([
    [3850n, "AED", "perShare", "AED 38.50"],
    [5n, "AED", "perShare", "AED 0.05"],
    [46200000n, "AED", "total", "AED 462,000"],
    [46200050n, "AED", "total", "AED 462,001"],
    [46200049n, "AED", "total", "AED 462,000"],
    [0n, "AED", "total", "AED 0"],
    [-120000n, "USD", "total", "-USD 1,200"],
    [-120050n, "USD", "total", "-USD 1,201"],
    [123456789012345678n, "AED", "perShare", "AED 1,234,567,890,123,456.78"],
    [-5n, "USD", "perShare", "-USD 0.05"],
  ] as const)("formats %s %s %s", (minor, currency, mode, expected) =>
    expect(formatMoney(minor, currency, mode)).toBe(expected));
  it("defaults to whole totals", () => expect(formatMoney(46200000n, "AED")).toBe("AED 462,000"));
  it.each([
    [40000000000n, "AED", "AED 400M"],
    [120000000000n, "AED", "AED 1.2B"],
    [125000000000n, "AED", "AED 1.3B"],
    [95000000n, "AED", "AED 950K"],
    [99900n, "USD", "USD 999"],
    [-125000000000n, "USD", "-USD 1.3B"],
    [0n, "AED", "AED 0"],
  ] as const)("compacts %s %s", (minor, currency, expected) =>
    expect(formatMoneyCompact(minor, currency)).toBe(expected));
});

it.each([
  [12000n, "table", "12,000 sh"],
  [12000n, "prose", "12,000 shares"],
  [1n, "prose", "1 share"],
] as const)("formats shares %s %s", (qty, style, result) =>
  expect(formatShares(qty, style)).toBe(result));

it.each([
  ["2026-09-25T10:30:00Z", "25 Sep 2026"],
  ["2026-09-25T21:30:00Z", "26 Sep 2026"],
])("formats Dubai date %s", (iso, expected) => expect(formatDate(new Date(iso))).toBe(expected));
it.each([
  ["2026-09-25T10:30:00Z", "25 Sep 2026, 14:30 GST"],
  ["2026-01-05T20:05:00Z", "6 Jan 2026, 00:05 GST"],
])("formats Dubai time %s", (iso, expected) =>
  expect(formatDateTime(new Date(iso))).toBe(expected));

const now = new Date("2026-09-25T10:30:00Z");
const minute = 60000;
const hour = 60 * minute;
const day = 24 * hour;
it.each([
  [5 * day + 3 * hour, "in 5 days"],
  [20 * hour + 59 * minute, "in 20h"],
  [45 * minute, "in 45 min"],
  [30000, "in under a minute"],
  [0, "now"],
  [-2 * hour, "2h ago"],
  [-3 * day, "3 days ago"],
  [-10000, "just now"],
  [hour, "in 1h"],
  [minute, "in 1 min"],
  [48 * hour, "in 2 days"],
  [-minute, "1 min ago"],
  [-hour, "1h ago"],
  [-48 * hour, "2 days ago"],
  [48 * hour - 1, "in 47h"],
  [hour - 1, "in 59 min"],
  [minute - 1, "in under a minute"],
  [1, "in under a minute"],
  [-1, "just now"],
])("relative bucket %s", (offset, expected) =>
  expect(formatRelative(new Date(now.getTime() + Number(offset)), now)).toBe(expected));

it.each([
  [47 * hour, "warning"],
  [48 * hour, "neutral"],
  [0, "danger"],
  [-1, "danger"],
  [1, "warning"],
])("deadline tone %s", (offset, expected) =>
  expect(deadlineTone(new Date(now.getTime() + Number(offset)), now)).toBe(expected));
