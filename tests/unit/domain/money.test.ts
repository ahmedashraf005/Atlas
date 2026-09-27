import fc from "fast-check";
import { expect, it } from "vitest";
import {
  applyBps,
  diffBps,
  divRoundHalfAway,
  maxBigint,
  minBigint,
  parseMoneyInput,
  parseSharesInput,
  sumBigint,
  totalValue,
} from "@/domain/money";
import { formatMoney } from "@/lib/format";

it.each([
  ["38.5", 3850n],
  ["38.50", 3850n],
  ["1,240,000", 124000000n],
  ["1240000.00", 124000000n],
  ["0.01", 1n],
  [" 1,000.01 ", 100001n],
  ["999999999999999.99", 99999999999999999n],
])("parses money %s", (input, value) =>
  expect(parseMoneyInput(input as string)).toEqual({ ok: true, value }));
it.each([
  "",
  "abc",
  "-5",
  "38.505",
  "1,24,000",
  "0",
  "1e6",
  "AED 5",
  "+5",
  "1,000,00",
  "1.",
  ".5",
  "0.00",
  "1000000000000000",
  "0000000000000001",
  "1 000",
  "Infinity",
])("rejects money %s", (input) =>
  expect(parseMoneyInput(input)).toMatchObject({
    ok: false,
    error: { code: "VALIDATION", issues: [{ field: "price" }] },
  }));
it.each([
  ["12,000", 12000n],
  ["1", 1n],
  [" 12 ", 12n],
])("parses shares %s", (input, value) =>
  expect(parseSharesInput(input as string)).toEqual({ ok: true, value }));
it.each([
  "12.5",
  "0",
  "-1",
  "1,24",
  "1e3",
  "1.00",
  "1000000000000000",
  "",
])("rejects shares %s", (input) =>
  expect(parseSharesInput(input)).toMatchObject({ ok: false, error: { code: "VALIDATION" } }));
it("uses bigint and signed half-away rounding", () => {
  expect(totalValue(3850n, 12000n)).toBe(46200000n);
  expect(sumBigint([])).toBe(0n);
  expect(sumBigint([1n, -2n, 4n])).toBe(3n);
  expect(minBigint(1n, 2n)).toBe(1n);
  expect(minBigint(2n, 1n)).toBe(1n);
  expect(maxBigint(1n, 2n)).toBe(2n);
  expect(maxBigint(2n, 1n)).toBe(2n);
  expect(divRoundHalfAway(5n, 2n)).toBe(3n);
  expect(divRoundHalfAway(-5n, 2n)).toBe(-3n);
  expect(divRoundHalfAway(4n, 3n)).toBe(1n);
  expect(divRoundHalfAway(0n, 3n)).toBe(0n);
  expect(applyBps(1n, 5000)).toBe(1n);
  expect(applyBps(-1n, 5000)).toBe(-1n);
  expect(applyBps(100n, -5000)).toBe(-50n);
  expect(diffBps(3850n, 3500n)).toBe(1000);
  expect(diffBps(3150n, 3500n)).toBe(-1000);
  expect(diffBps(3501n, 3500n)).toBe(3);
  expect(() => divRoundHalfAway(1n, 0n)).toThrow();
  expect(() => divRoundHalfAway(1n, -1n)).toThrow();
  expect(() => applyBps(1n, 1.5)).toThrow();
  expect(() => diffBps(1n, 0n)).toThrow();
  expect(() => diffBps(1n, -1n)).toThrow();
  expect(() => diffBps(10n ** 30n, 1n)).toThrow();
});
it("round-trips positive formatted per-share money", () =>
  fc.assert(
    fc.property(fc.bigInt({ min: 1n, max: 99999999999999999n }), (minor) => {
      expect(parseMoneyInput(formatMoney(minor, "AED", "perShare").slice(4))).toEqual({
        ok: true,
        value: minor,
      });
    }),
    { numRuns: 200 },
  ));
