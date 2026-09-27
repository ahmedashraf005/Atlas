import "server-only";
import { type Clock, systemClock } from "@/lib/clock";
export function sandboxClock(sandbox: { clockOffsetMs: number }): Clock {
  return { now: () => new Date(systemClock.now().getTime() + sandbox.clockOffsetMs) };
}
