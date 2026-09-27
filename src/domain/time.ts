export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
export function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * HOUR_MS);
}
export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}
export function addMonthsUtc(d: Date, months: number): Date {
  if (!Number.isInteger(months) || !Number.isFinite(d.getTime()))
    throw new RangeError("Use a valid date and whole months.");
  const result = new Date(d.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const end = new Date(result.getTime());
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  result.setUTCDate(Math.min(day, end.getUTCDate()));
  return result;
}
export const isBefore = (a: Date, b: Date): boolean => a.getTime() < b.getTime();
export const isAtOrAfter = (a: Date, b: Date): boolean => a.getTime() >= b.getTime();
export const maxDate = (a: Date, b: Date): Date => new Date(Math.max(a.getTime(), b.getTime()));
