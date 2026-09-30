import { validation } from "@/domain/errors";
import { err, ok, type Result } from "@/domain/result";

export type { Currency } from "@/lib/format";
export const totalValue = (priceMinor: bigint, qty: bigint): bigint => priceMinor * qty;
export function divRoundHalfAway(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new RangeError("The divisor must be positive.");
  const magnitude = n < 0n ? -n : n;
  const quotient = magnitude / d;
  const rounded = quotient + (2n * (magnitude % d) >= d ? 1n : 0n);
  return n < 0n ? -rounded : rounded;
}
export function applyBps(amountMinor: bigint, bps: number): bigint {
  if (!Number.isSafeInteger(bps)) throw new RangeError("Basis points must be a safe integer.");
  return divRoundHalfAway(amountMinor * BigInt(bps), 10_000n);
}
export function diffBps(value: bigint, reference: bigint): number {
  if (reference <= 0n) throw new RangeError("The reference must be positive.");
  const rounded = divRoundHalfAway((value - reference) * 10_000n, reference);
  // Only the dimensionless basis-point result becomes a number; money stays bigint.
  const result = +rounded.toString();
  if (!Number.isSafeInteger(result))
    throw new RangeError("The basis-point difference exceeds the safe integer range.");
  return result;
}
export const sumBigint = (values: readonly bigint[]): bigint => values.reduce((a, b) => a + b, 0n);
export const minBigint = (a: bigint, b: bigint): bigint => (a < b ? a : b);
export const maxBigint = (a: bigint, b: bigint): bigint => (a > b ? a : b);
const integer = "(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)";
function parse(input: string, money: boolean): Result<bigint> {
  const value = input.trim();
  const pattern = new RegExp(`^${integer}${money ? "(?:\\.[0-9]{1,2})?" : ""}$`);
  const [whole = "", decimals = ""] = value.replaceAll(",", "").split(".");
  const field = money ? "price" : "quantity";
  if (!pattern.test(value) || whole.length > 15)
    return err(
      validation([
        {
          field,
          message: money
            ? "Enter an amount like 3.00 (up to two decimal places)."
            : "Enter a positive whole share quantity with at most 15 digits.",
        },
      ]),
    );
  const amount =
    BigInt(whole) * (money ? 100n : 1n) + (money ? BigInt(decimals.padEnd(2, "0")) : 0n);
  return amount > 0n
    ? ok(amount)
    : err(
        validation([
          {
            field,
            message: money
              ? "Enter an amount like 3.00 (up to two decimal places)."
              : "The value must be greater than zero.",
          },
        ]),
      );
}
export const parseMoneyInput = (input: string): Result<bigint> => parse(input, true);
export const parseSharesInput = (input: string): Result<bigint> => parse(input, false);
