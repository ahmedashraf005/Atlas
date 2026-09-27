import { expect, it } from "vitest";
import {
  addDays,
  addHours,
  addMonthsUtc,
  DAY_MS,
  HOUR_MS,
  isAtOrAfter,
  isBefore,
  maxDate,
} from "@/domain/time";
import { fixedClock } from "@/lib/clock";
import { deepFreeze, NOW } from "./helpers/fixtures";

it("adds and compares instants without mutation", () => {
  const d = deepFreeze(new Date(NOW));
  expect(addHours(d, 2).getTime() - d.getTime()).toBe(2 * HOUR_MS);
  expect(addDays(d, -3).getTime() - d.getTime()).toBe(-3 * DAY_MS);
  expect(isBefore(d, addDays(d, 1))).toBe(true);
  expect(isBefore(d, d)).toBe(false);
  expect(isAtOrAfter(d, d)).toBe(true);
  expect(isAtOrAfter(d, addHours(d, 1))).toBe(false);
  expect(maxDate(d, addDays(d, 1))).toEqual(addDays(d, 1));
  expect(maxDate(addDays(d, 1), d)).toEqual(addDays(d, 1));
  expect(maxDate(d, d)).not.toBe(d);
  expect(d).toEqual(NOW);
});
it.each([
  ["2025-01-31T10:30:00Z", 1, "2025-02-28T10:30:00Z"],
  ["2024-01-31T10:30:00Z", 1, "2024-02-29T10:30:00Z"],
  ["2026-12-31T10:30:00Z", 2, "2027-02-28T10:30:00Z"],
  ["2026-03-31T10:30:00Z", -1, "2026-02-28T10:30:00Z"],
  ["2026-09-25T10:30:00Z", 0, "2026-09-25T10:30:00Z"],
])("clamps %s + %s months", (input, months, expected) =>
  expect(addMonthsUtc(new Date(input as string), months as number)).toEqual(
    new Date(expected as string),
  ));
it("rejects invalid month maths and clocks", () => {
  expect(() => addMonthsUtc(NOW, 0.5)).toThrow();
  expect(() => addMonthsUtc(new Date("invalid"), 1)).toThrow();
  expect(() => fixedClock("invalid")).toThrow("Invalid fixed clock instant");
});
