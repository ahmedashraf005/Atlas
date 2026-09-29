import { globSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { MACHINES } from "@/domain/machines";
import { ACTION_LABELS, describeAction, describeActor, diffSnapshot } from "@/lib/audit-display";
import { INVESTOR_LABELS, VISIBILITY_LABELS } from "@/lib/policy-display";

it("labels every machine event and every non-transition audit action in the server", () => {
  const actions = Object.entries(MACHINES).flatMap(([kind, m]) =>
    m.events.map((event) => `${kind}.${event}`),
  );
  for (const file of globSync("src/server/**/*.ts")) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(
      /(?:action|name):\s*["']((?:holding|listing|bid|trade|company|policy|sandbox|audit|demo|notifications)\.[^"']+)["']/g,
    ))
      actions.push(match[1] as string);
    for (const match of source.matchAll(/(?:eventAction|reasonAction)\(\s*["']([^"']+)["']/g))
      actions.push(match[1]?.includes(".") ? match[1] : `trade.${match[1]}`);
    // Demo helpers pass the action as an argument rather than as a draft property.
    for (const match of source.matchAll(/auditChange\(\s*ctx,\s*["']([^"']+)["']/g))
      actions.push(match[1] as string);
  }
  expect(actions).toContain("sandbox.advanceClock");
  for (const action of actions) {
    expect(ACTION_LABELS, action).toHaveProperty(action.replaceAll(".", "\\."));
    expect(describeAction(action)).not.toContain(" · ");
  }
});
it("uses sentence case for unknown action strings", () => {
  expect(describeAction("listing.NEW_EVENT")).toBe("Listing · New event");
  expect(describeAction("company.newEvent")).toBe("Company · New event");
  expect(describeAction("unknown")).toBe("Unknown · ");
  expect(describeAction("")).toBe(" · ");
  expect(describeAction("toString")).toBe("ToString · ");
});
it("describes human, simulated, missing and system actors", () => {
  const users = [{ id: "a", displayName: "Noor Khalil", handle: "Atlas compliance" }];
  const entry = { actorId: "a", actorRole: "operator" as const, simulated: false };
  expect(describeActor(entry, users)).toBe("Noor Khalil · Atlas compliance");
  expect(describeActor({ ...entry, simulated: true }, users)).toBe(
    "Noor Khalil · Atlas compliance (auto-pilot)",
  );
  expect(describeActor({ ...entry, actorId: "missing" }, users)).toBe("Unknown actor");
  expect(describeActor({ ...entry, actorRole: "system" }, users)).toBe("Atlas (deadline)");
});
it("diffs canonical top-level snapshots and ignores version", () => {
  expect(
    diffSnapshot(
      { quantity: "100n", version: 1, status: "PendingCompany" },
      { quantity: "100n", version: 2, status: "Verified" },
    ),
  ).toEqual([{ field: "status", from: '"PendingCompany"', to: '"Verified"' }]);
  expect(diffSnapshot({ gone: true }, { added: ["x", 2] })).toEqual([
    { field: "added", from: "—", to: '["x",2]' },
    { field: "gone", from: "true", to: "—" },
  ]);
  expect(diffSnapshot(null, { at: "2026-09-28T10:00:00.000Z" })).toEqual([
    { field: "at", from: "—", to: '"2026-09-28T10:00:00.000Z"' },
    { field: "value", from: "null", to: "—" },
  ]);
  expect(diffSnapshot([1], [2])).toEqual([{ field: "value", from: "[1]", to: "[2]" }]);
  expect(diffSnapshot("a", "b")).toEqual([{ field: "value", from: '"a"', to: '"b"' }]);
  expect(diffSnapshot({}, {})).toEqual([]);
});
it("labels every investor type and visibility option", () => {
  expect(Object.values(INVESTOR_LABELS)).toEqual([
    "Family offices",
    "High-net-worth individuals",
    "Funds",
    "Angel syndicates",
  ]);
  expect(Object.values(VISIBILITY_LABELS)).toEqual([
    "Operators and your company only",
    "Participants in your company",
    "All verified members",
  ]);
});
