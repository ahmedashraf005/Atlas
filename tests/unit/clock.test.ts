import { expect, it } from "vitest";
import { fixedClock, systemClock } from "@/lib/clock";

it("fixed clock returns equal instants as distinct mutable objects", () => {
  const source = new Date("2026-09-25T10:30:00Z");
  const clock = fixedClock(source);
  const a = clock.now();
  const b = clock.now();
  expect(a).toEqual(b);
  expect(a).not.toBe(b);
  a.setFullYear(2000);
  source.setFullYear(2001);
  expect(clock.now().toISOString()).toBe("2026-09-25T10:30:00.000Z");
  expect(fixedClock("2026-09-25T10:30:00Z").now()).toEqual(b);
});
it("system clock returns a Date", () => expect(systemClock.now()).toBeInstanceOf(Date));
