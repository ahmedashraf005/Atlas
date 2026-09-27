import { type Machine, sources } from "@/domain/machine";
export function toMermaid<
  S extends string,
  E extends string,
  T extends { status: S; version: number; id: string },
  C extends { now: Date },
>(m: Machine<S, E, T, C>): string {
  const edges = new Set<string>();
  for (const row of m.rows)
    for (const from of sources(row.from)) edges.add(`  ${from} --> ${row.to}: ${row.event}`);
  return [
    "stateDiagram-v2",
    `  [*] --> ${m.initial}`,
    ...edges,
    ...m.terminal.map((s) => `  ${s} --> [*]`),
  ].join("\n");
}
