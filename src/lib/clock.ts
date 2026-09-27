export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(at: Date | string): Clock {
  const instant = new Date(at).getTime();
  if (!Number.isFinite(instant)) throw new Error("Invalid fixed clock instant");
  return { now: () => new Date(instant) };
}
