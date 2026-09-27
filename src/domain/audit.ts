import { createHash } from "node:crypto";
import { GENESIS_HASH } from "@/domain/constants";
import type { EntityKind } from "@/domain/effects";
import type { ActorRole } from "@/domain/roles";
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export interface AuditDraft {
  sandboxId: string;
  actorId: string;
  actorRole: ActorRole;
  simulated: boolean;
  action: string;
  entity: EntityKind | "sandbox" | "company";
  entityId: string;
  before: unknown;
  after: unknown;
  at: Date;
}
export interface AuditEntry extends Omit<AuditDraft, "before" | "after"> {
  seq: number;
  before: Json;
  after: Json;
  prevHash: string;
  hash: string;
}
function compareKeys(a: string, b: string): number {
  const left = Array.from(a, (c) => c.codePointAt(0) ?? 0),
    right = Array.from(b, (c) => c.codePointAt(0) ?? 0);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const delta = (left[i] ?? 0) - (right[i] ?? 0);
    if (delta) return delta;
  }
  return left.length - right.length;
}
export function canonicalJson(value: unknown): string {
  const path = new Set<object>();
  function encode(v: unknown): string {
    if (v === null) return "null";
    if (typeof v === "string" || typeof v === "boolean") return JSON.stringify(v);
    if (typeof v === "bigint") return JSON.stringify(`${v}n`);
    if (typeof v === "number") {
      if (!Number.isFinite(v)) throw new TypeError("Audit numbers must be finite.");
      return JSON.stringify(v);
    }
    if (v instanceof Date) return JSON.stringify(v.toISOString());
    if (typeof v !== "object") throw new TypeError("Unsupported audit value.");
    if (path.has(v)) throw new TypeError("Audit values cannot contain cycles.");
    path.add(v);
    try {
      if (Array.isArray(v)) return `[${Array.from(v, encode).join(",")}]`;
      if (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)
        throw new TypeError("Audit objects must be plain objects.");
      if (Object.getOwnPropertySymbols(v).length)
        throw new TypeError("Audit keys cannot be symbols.");
      const fields = Object.keys(v)
        .sort(compareKeys)
        .flatMap((key) => {
          const descriptor = Object.getOwnPropertyDescriptor(v, key);
          if (!descriptor || !("value" in descriptor))
            throw new TypeError("Audit objects cannot contain accessors.");
          return descriptor.value === undefined
            ? []
            : [`${JSON.stringify(key)}:${encode(descriptor.value)}`];
        });
      return `{${fields.join(",")}}`;
    } finally {
      path.delete(v);
    }
  }
  return encode(value);
}
function hashBody(prevHash: string, body: unknown): string {
  return createHash("sha256")
    .update(prevHash + canonicalJson(body))
    .digest("hex");
}
export function appendEntry(prev: AuditEntry | null, draft: AuditDraft): AuditEntry {
  if (prev && prev.sandboxId !== draft.sandboxId)
    throw new Error("An audit chain belongs to one sandbox.");
  const body = {
    ...draft,
    before: JSON.parse(canonicalJson(draft.before)) as Json,
    after: JSON.parse(canonicalJson(draft.after)) as Json,
    at: new Date(draft.at.getTime()),
    seq: prev ? prev.seq + 1 : 1,
  };
  const prevHash = prev?.hash ?? GENESIS_HASH;
  return { ...body, prevHash, hash: hashBody(prevHash, body) };
}
export function verifyChain(
  entries: readonly AuditEntry[],
  // A trusted checkpoint is necessary to distinguish truncation from a valid shorter chain.
  checkpoint?: { count: number; headHash: string },
):
  | { ok: true; count: number }
  | { ok: false; brokenAtSeq: number; reason: "SEQ_GAP" | "PREV_HASH_MISMATCH" | "HASH_MISMATCH" } {
  let previous = GENESIS_HASH;
  for (const [index, entry] of entries.entries()) {
    const seq = index + 1;
    if (entry.seq !== seq) return { ok: false, brokenAtSeq: seq, reason: "SEQ_GAP" };
    if (entry.prevHash !== previous)
      return { ok: false, brokenAtSeq: seq, reason: "PREV_HASH_MISMATCH" };
    const { hash, prevHash, ...body } = entry;
    try {
      if (hash !== hashBody(prevHash, body))
        return { ok: false, brokenAtSeq: seq, reason: "HASH_MISMATCH" };
    } catch {
      return { ok: false, brokenAtSeq: seq, reason: "HASH_MISMATCH" };
    }
    previous = hash;
  }
  if (checkpoint && entries.length !== checkpoint.count)
    return {
      ok: false,
      brokenAtSeq: Math.min(entries.length, checkpoint.count) + 1,
      reason: "SEQ_GAP",
    };
  if (checkpoint && previous !== checkpoint.headHash)
    return { ok: false, brokenAtSeq: Math.max(entries.length, 1), reason: "HASH_MISMATCH" };
  return { ok: true, count: entries.length };
}
