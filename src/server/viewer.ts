import "server-only";
import { cache } from "react";
import type { PersonaKey } from "@/config/personas";
import type { Actor, Role } from "@/domain/roles";
import type { Clock } from "@/lib/clock";
import { sandboxClock } from "@/server/clock";
import { getDb } from "@/server/db/client";
import { UnauthenticatedError } from "@/server/errors";
import { refreshSandbox } from "@/server/refresh";
import * as sandboxes from "@/server/repositories/sandboxes";
import * as users from "@/server/repositories/users";
import { ensureSandbox, touchSandbox } from "@/server/sandbox";
import { readSession } from "@/server/session";
export interface Viewer {
  sandboxId: string;
  persona: PersonaKey;
  user: { id: string; handle: string; displayName: string; subtitle: string; role: Role };
  actor: Actor;
  now: Date;
  clock: Clock;
  autopilot: boolean;
  rofrMode: "waive" | "exercise";
  pendingJobs: number;
}
export const getViewer = cache(async (): Promise<Viewer> => {
  const session = await readSession();
  if (!session) throw new UnauthenticatedError();
  const db = await getDb();
  await ensureSandbox(db, session.sid, session.per);
  await touchSandbox(db, session.sid);
  const refreshed = await refreshSandbox(db, session.sid);
  const sandbox = await sandboxes.find(db, session.sid);
  if (!sandbox) throw new UnauthenticatedError();
  const user = await users.forPersona(db, session.sid, sandbox.persona),
    clock = sandboxClock(sandbox);
  return {
    sandboxId: session.sid,
    persona: sandbox.persona,
    user: {
      id: user.id,
      handle: user.handle,
      displayName: user.displayName,
      subtitle: user.subtitle,
      role: user.role,
    },
    actor: users.toActor(user),
    now: clock.now(),
    clock,
    autopilot: sandbox.autopilot,
    rofrMode: sandbox.rofrMode,
    pendingJobs: refreshed.pendingJobs,
  };
});
