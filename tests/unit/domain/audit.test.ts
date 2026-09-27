import fc from "fast-check";
import { expect, it } from "vitest";
import {
  type AuditDraft,
  type AuditEntry,
  appendEntry,
  canonicalJson,
  verifyChain,
} from "@/domain/audit";
import { GENESIS_HASH } from "@/domain/constants";
import { deepFreeze, NOW } from "./helpers/fixtures";

const draft = (o: Partial<AuditDraft> = {}): AuditDraft => ({
  sandboxId: "sandbox",
  actorId: "seller",
  actorRole: "seller",
  simulated: false,
  action: "listing.SUBMIT",
  entity: "listing",
  entityId: "listing",
  before: null,
  after: { quantity: 3850n },
  at: NOW,
  ...o,
});
const chain = (length = 3): AuditEntry[] => {
  const entries: AuditEntry[] = [];
  for (let i = 0; i < length; i++)
    entries.push(appendEntry(entries.at(-1) ?? null, draft({ entityId: String(i) })));
  return entries;
};
it("canonicalizes keys recursively, including numeric and Unicode code-point order", () => {
  expect(canonicalJson({ z: undefined, b: [1n, NOW, { z: 2, a: 1 }], a: true, n: null })).toBe(
    '{"a":true,"b":["1n","2026-09-25T10:30:00.000Z",{"a":1,"z":2}],"n":null}',
  );
  expect(canonicalJson({ "2": 2, "10": 10 })).toBe('{"10":10,"2":2}');
  expect(canonicalJson({ "\u{10000}": 1, "\uE000": 2 })).toBe('{"\uE000":2,"\u{10000}":1}');
  expect(canonicalJson("3850n")).toBe('"3850n"');
  expect(canonicalJson(-3850n)).toBe('"-3850n"');
  expect(canonicalJson(-0)).toBe("0");
  expect(canonicalJson(Object.create(null))).toBe("{}");
  const shared = { x: 1 };
  expect(canonicalJson([shared, shared])).toBe('[{"x":1},{"x":1}]');
});
it("rejects unsupported and cyclic values", () => {
  const circular: { self?: unknown } = {};
  circular.self = circular;
  const getter = Object.defineProperty({}, "x", { enumerable: true, get: () => 1 });
  for (const v of [
    undefined,
    () => 0,
    Symbol("x"),
    NaN,
    Infinity,
    -Infinity,
    circular,
    [undefined],
    new Array(1),
    new Map(),
    { [Symbol("x")]: 1 },
    getter,
    new Date("invalid"),
  ])
    expect(() => canonicalJson(v)).toThrow();
});
it("appends isolated canonical entries and verifies genesis, sequence, previous hash and body", () => {
  const d = deepFreeze(draft({ before: { price: 3850n, at: NOW } })),
    first = appendEntry(null, d);
  expect(first).toMatchObject({
    seq: 1,
    prevHash: GENESIS_HASH,
    before: { price: "3850n", at: "2026-09-25T10:30:00.000Z" },
    after: { quantity: "3850n" },
  });
  expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
  expect(first.at).not.toBe(NOW);
  expect(verifyChain(chain())).toEqual({ ok: true, count: 3 });
  expect(verifyChain([])).toEqual({ ok: true, count: 0 });
  expect(() => appendEntry(first, draft({ sandboxId: "other" }))).toThrow();
  const entries = chain();
  expect(verifyChain([{ ...(entries[0] as AuditEntry), seq: 2 }])).toEqual({
    ok: false,
    brokenAtSeq: 1,
    reason: "SEQ_GAP",
  });
  expect(verifyChain([{ ...(entries[0] as AuditEntry), prevHash: "bad" }])).toEqual({
    ok: false,
    brokenAtSeq: 1,
    reason: "PREV_HASH_MISMATCH",
  });
  expect(verifyChain([{ ...(entries[0] as AuditEntry), after: NaN }])).toEqual({
    ok: false,
    brokenAtSeq: 1,
    reason: "HASH_MISMATCH",
  });
});
it("detects changes to every single stored field at the changed sequence", () =>
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 12 }), fc.nat({ max: 100 }), (length, pick) => {
      const entries = chain(length),
        index = pick % length;
      const changes: Partial<AuditEntry>[] = [
        { seq: 999 },
        { prevHash: "a".repeat(64) },
        { hash: "f".repeat(64) },
        { sandboxId: "other" },
        { actorId: "other" },
        { actorRole: "buyer" },
        { simulated: true },
        { action: "other" },
        { entity: "company" },
        { entityId: "other" },
        { before: { x: 1 } },
        { after: { x: 1 } },
        { at: new Date(NOW.getTime() + 1) },
      ];
      for (const change of changes) {
        const changed = entries.map((e, i) => (i === index ? { ...e, ...change } : e));
        expect(verifyChain(changed)).toMatchObject({ ok: false, brokenAtSeq: index + 1 });
      }
    }),
    { numRuns: 200 },
  ));
it("detects every interior deletion and reordering at the first missing sequence", () =>
  fc.assert(
    fc.property(fc.integer({ min: 2, max: 12 }), fc.nat({ max: 100 }), (length, pick) => {
      const entries = chain(length),
        index = pick % (length - 1);
      expect(verifyChain(entries.filter((_, i) => i !== index))).toEqual({
        ok: false,
        brokenAtSeq: index + 1,
        reason: "SEQ_GAP",
      });
      const swapped = [...entries];
      [swapped[index], swapped[index + 1]] = [
        swapped[index + 1] as AuditEntry,
        swapped[index] as AuditEntry,
      ];
      expect(verifyChain(swapped)).toEqual({
        ok: false,
        brokenAtSeq: index + 1,
        reason: "SEQ_GAP",
      });
    }),
    { numRuns: 200 },
  ));
it("documents that a valid prefix needs an external trusted head to detect tail truncation", () => {
  const entries = chain();
  expect(verifyChain(entries.slice(0, -1))).toEqual({ ok: true, count: 2 });
  expect(entries.slice(0, -1).at(-1)?.hash).not.toBe(entries.at(-1)?.hash);
});
it("detects any deletion including the tail using a trusted checkpoint", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 12 }), fc.nat({ max: 100 }), (length, pick) => {
      const entries = chain(length);
      const head = entries.at(-1);
      if (!head) throw new Error("Missing head");
      const checkpoint = { count: length, headHash: head.hash };
      expect(verifyChain(entries, checkpoint)).toEqual({ ok: true, count: length });
      const index = pick % length;
      expect(
        verifyChain(
          entries.filter((_, i) => i !== index),
          checkpoint,
        ),
      ).toEqual({ ok: false, brokenAtSeq: index + 1, reason: "SEQ_GAP" });
    }),
    { numRuns: 200 },
  );
  const entries = chain();
  expect(verifyChain(entries, { count: entries.length, headHash: "f".repeat(64) })).toMatchObject({
    ok: false,
    reason: "HASH_MISMATCH",
    brokenAtSeq: 3,
  });
  expect(verifyChain(entries, { count: 2, headHash: "f".repeat(64) })).toMatchObject({
    ok: false,
    reason: "SEQ_GAP",
    brokenAtSeq: 3,
  });
  expect(verifyChain([], { count: 0, headHash: "f".repeat(64) })).toMatchObject({
    ok: false,
    reason: "HASH_MISMATCH",
    brokenAtSeq: 1,
  });
});
