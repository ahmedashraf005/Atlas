import type { Effect, EntityKind } from "@/domain/effects";
import { forbiddenRole, guardFailed, invalidTransition } from "@/domain/errors";
import { err, ok, type Result } from "@/domain/result";
import type { Actor, ActorRole } from "@/domain/roles";
export interface Row<S extends string, E extends string, T, C> {
  from: S | readonly S[];
  event: E;
  to: S;
  roles: readonly ActorRole[];
  guard?: (entity: T, ctx: C) => true | string;
  apply?: (entity: T, ctx: C) => Partial<T>;
  effects?: (prev: T, next: T, ctx: C) => Effect[];
}
export interface Machine<
  S extends string,
  E extends string,
  T extends { status: S; version: number; id: string },
  C extends { now: Date },
> {
  name: EntityKind;
  initial: S;
  states: readonly S[];
  terminal: readonly S[];
  events: readonly E[];
  rows: readonly Row<S, E, T, C>[];
}
export function sources<S extends string>(from: S | readonly S[]): readonly S[] {
  return typeof from === "string" ? [from] : from;
}
export function defineMachine<
  S extends string,
  E extends string,
  T extends { status: S; version: number; id: string },
  C extends { now: Date },
>(m: Machine<S, E, T, C>): Machine<S, E, T, C> {
  if (!m.states.includes(m.initial)) throw new Error("Unknown initial state.");
  for (const terminal of m.terminal)
    if (!m.states.includes(terminal)) throw new Error(`Unknown terminal state: ${terminal}.`);
  for (const row of m.rows) {
    if (!m.states.includes(row.to) || sources(row.from).some((s) => !m.states.includes(s)))
      throw new Error("A row references an unknown state.");
    if (!m.events.includes(row.event)) throw new Error("A row references an unknown event.");
    if (sources(row.from).some((s) => m.terminal.includes(s)))
      throw new Error("A terminal state has an outgoing row.");
  }
  const seen = new Set<S>([m.initial]);
  const queue: S[] = [m.initial];
  for (const state of queue)
    for (const row of m.rows)
      if (sources(row.from).includes(state) && !seen.has(row.to)) {
        seen.add(row.to);
        queue.push(row.to);
      }
  for (const state of m.states)
    if (!seen.has(state)) throw new Error(`Unreachable state: ${state}.`);
  return m;
}
export function transition<
  S extends string,
  E extends string,
  T extends { status: S; version: number; id: string },
  C extends { now: Date },
>(
  m: Machine<S, E, T, C>,
  entity: T,
  event: E,
  actor: Actor,
  ctx: C,
): Result<{ next: T; effects: Effect[]; from: S; to: S }> {
  const matching = m.rows.filter(
    (r) => r.event === event && sources(r.from).includes(entity.status),
  );
  if (!matching.length) return err(invalidTransition(entity.status, event));
  const permitted = matching.filter((r) => r.roles.includes(actor.role));
  if (!permitted.length) return err(forbiddenRole());
  // The engine supplies the trusted actor, overriding any caller-supplied context actor.
  const context = { ...ctx, actor };
  let firstFailure: string | undefined;
  for (const row of permitted) {
    const passed = row.guard?.(entity, context) ?? true;
    if (passed !== true) {
      firstFailure ??= passed;
      continue;
    }
    const next = {
      ...entity,
      ...row.apply?.(entity, context),
      status: row.to,
      version: entity.version + 1,
    };
    const effects: Effect[] = [
      {
        type: "AUDIT",
        entity: m.name,
        entityId: entity.id,
        action: `${m.name}.${event}`,
        from: entity.status,
        to: row.to,
      },
      ...(row.effects?.(entity, next, context) ?? []),
    ];
    return ok({ next, effects, from: entity.status, to: row.to });
  }
  return err(guardFailed(firstFailure ?? "This action is not available."));
}
export function availableEvents<
  S extends string,
  E extends string,
  T extends { status: S; version: number; id: string },
  C extends { now: Date },
>(m: Machine<S, E, T, C>, entity: T, actor: Actor, ctx: C): E[] {
  const context = { ...ctx, actor };
  return m.events.filter((event) =>
    m.rows.some(
      (row) =>
        row.event === event &&
        sources(row.from).includes(entity.status) &&
        row.roles.includes(actor.role) &&
        (row.guard?.(entity, context) ?? true) === true,
    ),
  );
}
