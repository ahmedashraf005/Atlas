import { expect, it } from "vitest";
import {
  availableEvents,
  defineMachine,
  type Machine,
  sources,
  transition,
} from "@/domain/machine";
import { actor, deepFreeze, NOW, unwrap } from "./helpers/fixtures";

type State = "A" | "B" | "C";
type Event = "GO" | "NEXT";
interface Entity {
  id: string;
  status: State;
  version: number;
  value: number;
}
interface Context {
  now: Date;
  first: boolean;
  second: boolean;
}
const definition: Machine<State, Event, Entity, Context> = {
  name: "holding",
  initial: "A",
  states: ["A", "B", "C"],
  terminal: ["C"],
  events: ["GO", "NEXT"],
  rows: [
    {
      from: "A",
      event: "GO",
      to: "B",
      roles: ["seller"],
      guard: (_, c) => c.first || "First guard failed.",
      apply: () => ({ value: 1, status: "A", version: 999 }),
      effects: (e) => [{ type: "RESERVE_SHARES", holdingId: e.id, qty: 1n }],
    },
    {
      from: "A",
      event: "GO",
      to: "C",
      roles: ["seller"],
      guard: (_, c) => c.second || "Second guard failed.",
      apply: () => ({ value: 2 }),
    },
    { from: ["B"], event: "NEXT", to: "C", roles: ["buyer"] },
  ],
};
const m = defineMachine(definition),
  entity = deepFreeze<Entity>({ id: "h", status: "A", version: 5, value: 0 });
const ctx = { now: NOW, first: true, second: true };
it("uses the first passing guard and overrides apply status/version", () => {
  const r = unwrap(transition(m, entity, "GO", actor("seller"), ctx));
  expect(r).toEqual({
    next: { ...entity, status: "B", version: 6, value: 1 },
    from: "A",
    to: "B",
    effects: [
      { type: "AUDIT", entity: "holding", entityId: "h", action: "holding.GO", from: "A", to: "B" },
      { type: "RESERVE_SHARES", holdingId: "h", qty: 1n },
    ],
  });
  expect(
    unwrap(transition(m, entity, "GO", actor("seller"), { ...ctx, first: false })).next,
  ).toMatchObject({ status: "C", value: 2 });
  expect(entity).toEqual({ id: "h", status: "A", version: 5, value: 0 });
  expect(
    unwrap(transition(m, deepFreeze({ ...entity, status: "B" }), "NEXT", actor("buyer"), ctx))
      .effects,
  ).toEqual([
    { type: "AUDIT", entity: "holding", entityId: "h", action: "holding.NEXT", from: "B", to: "C" },
  ]);
});
it("enforces error precedence and first failure reason", () => {
  expect(transition(m, entity, "NEXT", actor("operator"), ctx)).toMatchObject({
    ok: false,
    error: { code: "INVALID_TRANSITION" },
  });
  expect(
    transition(m, entity, "GO", actor("buyer"), { ...ctx, first: false, second: false }),
  ).toMatchObject({ ok: false, error: { code: "FORBIDDEN_ROLE" } });
  expect(
    transition(m, entity, "GO", actor("seller"), { ...ctx, first: false, second: false }),
  ).toEqual({ ok: false, error: { code: "GUARD_FAILED", message: "First guard failed." } });
});
it("lists only available events without applying their effects", () => {
  expect(availableEvents(m, entity, actor("seller"), ctx)).toEqual(["GO"]);
  expect(availableEvents(m, entity, actor("buyer"), ctx)).toEqual([]);
  expect(
    availableEvents(m, entity, actor("seller"), { ...ctx, first: false, second: false }),
  ).toEqual([]);
  expect(availableEvents(m, deepFreeze({ ...entity, status: "B" }), actor("buyer"), ctx)).toEqual([
    "NEXT",
  ]);
  expect(sources(["A", "B"])).toEqual(["A", "B"]);
  expect(sources("A")).toEqual(["A"]);
});
it("rejects every invalid definition at definition time", () => {
  const first = definition.rows[0];
  if (!first) throw new Error("Missing fixture row");
  expect(() => defineMachine({ ...definition, initial: "unknown" as State })).toThrow("initial");
  expect(() => defineMachine({ ...definition, terminal: ["unknown" as State] })).toThrow(
    "terminal",
  );
  expect(() =>
    defineMachine({ ...definition, rows: [{ ...first, to: "unknown" as State }] }),
  ).toThrow("unknown state");
  expect(() =>
    defineMachine({
      ...definition,
      rows: [{ ...first, from: ["A", "unknown" as State] }],
    }),
  ).toThrow("unknown state");
  expect(() =>
    defineMachine({ ...definition, rows: [{ ...first, event: "unknown" as Event }] }),
  ).toThrow("unknown event");
  expect(() => defineMachine({ ...definition, terminal: ["A"] })).toThrow("outgoing");
  expect(() => defineMachine({ ...definition, rows: [] })).toThrow("Unreachable");
});
