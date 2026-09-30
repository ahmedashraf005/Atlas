import "server-only";
import { z } from "zod";
import { verifyChain } from "@/domain/audit";
import { can } from "@/domain/authz";
import {
  describeAction,
  describeActor,
  diffSnapshot,
  displayAuditValue,
} from "@/lib/audit-display";
import { formatDateTime } from "@/lib/format";
import { type Db, getDb } from "@/server/db/client";
import { entityLinks } from "@/server/read/consoles";
import * as audit from "@/server/repositories/audit";
import * as sandboxes from "@/server/repositories/sandboxes";
import * as users from "@/server/repositories/users";
import type { Viewer } from "@/server/viewer";
export type AuditParams = Record<string, string | string[] | undefined>;
export async function getAuditModel(viewer: Viewer, params: AuditParams = {}, database?: Db) {
  if (!can(viewer.actor, "audit.view", { kind: "sandbox", sandboxId: viewer.sandboxId }).allowed)
    return null;
  const db = database ?? (await getDb());
  const page = z.coerce.number().int().min(1).max(100000).catch(1).parse(params.page);
  const entity = z
    .enum(["holding", "listing", "bid", "trade", "company", "sandbox"])
    .optional()
    .catch(undefined)
    .parse(params.entity);
  const action = z
    .string()
    .trim()
    .max(100)
    .catch("")
    .parse(params.action ?? "");
  const { entries, checkpoint, result } = await db.transaction(async (tx) => {
    const sandbox = await sandboxes.lockSandbox(tx, viewer.sandboxId),
      entries = await audit.list(tx, viewer.sandboxId);
    return {
      entries,
      checkpoint: { count: sandbox.auditHeadSeq, headHash: sandbox.auditHeadHash },
      result: verifyChain(entries, {
        count: sandbox.auditHeadSeq,
        headHash: sandbox.auditHeadHash,
      }),
    };
  });
  const [people, links] = await Promise.all([
    users.list(db, viewer.sandboxId),
    entityLinks(db, viewer),
  ]);
  const checkpointMismatch = !result.ok && verifyChain(entries).ok;
  const reason = result.ok
    ? ""
    : checkpointMismatch
      ? "entries were removed from the end"
      : {
          HASH_MISMATCH: "an entry was changed after it was written",
          PREV_HASH_MISMATCH: "an entry's link to the previous one doesn't match",
          SEQ_GAP: "an entry is missing",
        }[result.reason];
  const filtered = entries
    .filter(
      (e) =>
        (!entity || e.entity === entity) && e.action.toLowerCase().includes(action.toLowerCase()),
    )
    .reverse();
  const lastPage = Math.max(1, Math.ceil(filtered.length / 50)),
    currentPage = Math.min(page, lastPage);
  const query = (p: number) =>
    `/ops/audit?${new URLSearchParams({ page: String(p), ...(entity ? { entity } : {}), ...(action ? { action } : {}) })}`;
  return {
    verified: result.ok,
    count: String(entries.length),
    status: result.ok
      ? `Chain verified · ${result.count} entries · head ${checkpoint.headHash.slice(0, 12)}…`
      : `Chain broken at entry #${result.brokenAtSeq} · ${reason}`,
    filters: { entity: entity ?? "", action },
    page: String(currentPage),
    pages: String(lastPage),
    previous: currentPage > 1 ? query(currentPage - 1) : null,
    next: currentPage < lastPage ? query(currentPage + 1) : null,
    entries: filtered.slice((currentPage - 1) * 50, currentPage * 50).map((e) => ({
      seq: String(e.seq),
      at: formatDateTime(e.at),
      actor: describeActor(e, people),
      action: describeAction(e.action),
      entity:
        links.get(e.entityId)?.label ?? (e.entity === "sandbox" ? "Demo sandbox" : e.entityId),
      href: links.get(e.entityId)?.href ?? null,
      hash: e.hash,
      shortHash: e.hash.slice(0, 10),
      prevHash: e.prevHash,
      changed:
        !result.ok &&
        !checkpointMismatch &&
        result.reason === "HASH_MISMATCH" &&
        result.brokenAtSeq === e.seq,
      diff: diffSnapshot(e.before, e.after).map((d) => ({
        ...d,
        from: displayAuditValue(d.from),
        to: displayAuditValue(d.to),
      })),
    })),
  };
}
