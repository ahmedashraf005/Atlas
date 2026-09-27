import { expect, it } from "vitest";
import { toMermaid } from "@/domain/mermaid";
import { tradeMachine } from "@/domain/trade";

it("generates deterministic unique expanded state edges", () => {
  const text = toMermaid(tradeMachine);
  expect(text.startsWith("stateDiagram-v2\n")).toBe(true);
  for (const line of [
    "  RofrPending --> AwaitingFunds: WAIVE",
    "  [*] --> AwaitingDocs",
    "  Settled --> [*]",
    "  Funded --> Disputed: RAISE_DISPUTE",
    "  TransferPending --> Disputed: RAISE_DISPUTE",
  ])
    expect(text).toContain(line);
  expect(new Set(text.split("\n")).size).toBe(text.split("\n").length);
  expect(toMermaid(tradeMachine)).toBe(text);
});
