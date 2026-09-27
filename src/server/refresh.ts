import "server-only";
import { dueBidEvent, dueListingEvent, dueTradeEvent, type SystemEvent } from "@/domain/deadlines";
import { SYSTEM_ACTOR } from "@/domain/roles";
import { getJobHandler, jobWillExecute } from "@/server/automation";
import { sandboxClock } from "@/server/clock";
import type { Database, Db, Tx } from "@/server/db/client";
import type { SandboxRow } from "@/server/db/schema";
import { RollbackError } from "@/server/errors";
import * as bids from "@/server/repositories/bids";
import * as jobs from "@/server/repositories/jobs";
import * as listings from "@/server/repositories/listings";
import * as sandboxes from "@/server/repositories/sandboxes";
import * as trades from "@/server/repositories/trades";
import * as users from "@/server/repositories/users";
import {
  allTradesTerminal,
  type EventOf,
  runTransition,
  type TxContext,
} from "@/server/transitions";

type DueItem =
  | { type: "system"; id: string; event: SystemEvent; at: Date }
  | { type: "job"; job: jobs.JobRow; at: Date };
async function dueItems(
  db: Database,
  sandbox: SandboxRow,
  personaUserId: string,
  now: Date,
): Promise<DueItem[]> {
  const items: DueItem[] = [];
  const allTrades = await trades.nonTerminal(db, sandbox.id);
  for (const listing of await listings.nonTerminal(db, sandbox.id)) {
    const event = dueListingEvent(listing, now, {
      allTradesTerminal: allTradesTerminal(allTrades.filter((t) => t.listingId === listing.id)),
    });
    if (event) items.push({ type: "system", id: listing.id, event, at: event.effectiveAt });
  }
  for (const bid of await bids.nonTerminal(db, sandbox.id)) {
    const event = dueBidEvent(bid, now);
    if (event) items.push({ type: "system", id: bid.id, event, at: event.effectiveAt });
  }
  for (const trade of allTrades) {
    const event = dueTradeEvent(trade, now);
    if (event) items.push({ type: "system", id: trade.id, event, at: event.effectiveAt });
  }
  for (const job of await jobs.due(db, sandbox.id, now))
    if (job.dueAt <= now && jobWillExecute(job, { autopilot: sandbox.autopilot, personaUserId }))
      items.push({ type: "job", job, at: job.dueAt });
  return items.sort((a, b) => {
    const time = a.at.getTime() - b.at.getTime();
    if (time) return time;
    if (a.type !== b.type) return a.type === "system" ? -1 : 1;
    const left = a.type === "system" ? a.id : a.job.id;
    const right = b.type === "system" ? b.id : b.job.id;
    return left.localeCompare(right);
  });
}
async function pendingCount(
  db: Database,
  sandbox: SandboxRow,
  personaUserId: string,
): Promise<number> {
  return (await jobs.list(db, sandbox.id)).filter((j) =>
    jobWillExecute(j, { autopilot: sandbox.autopilot, personaUserId }),
  ).length;
}
export async function refreshInTransaction(
  tx: Tx,
  sandbox: SandboxRow,
): Promise<{ changed: boolean; pendingJobs: number }> {
  const persona = await users.forPersona(tx, sandbox.id, sandbox.persona),
    now = sandboxClock(sandbox).now();
  let changed = false;
  for (let step = 0; step < 25; step++) {
    const item = (await dueItems(tx, sandbox, persona.id, now))[0];
    if (!item) break;
    const base: TxContext = {
      tx,
      sandbox,
      actor: SYSTEM_ACTOR(sandbox.id),
      now: item.at,
      personaUserId: persona.id,
      depth: 0,
    };
    if (item.type === "system") {
      const { event } = item;
      const result =
        event.kind === "listing"
          ? await runTransition(base, "listing", item.id, event.event, {})
          : event.kind === "bid"
            ? await runTransition(base, "bid", item.id, event.event, {})
            : await runTransition(base, "trade", item.id, event.event, {});
      if (!result.ok) throw new Error("Due system transition failed");
    } else {
      const job = item.job,
        user = await users.find(tx, sandbox.id, job.partyUserId);
      let code: string | null = null;
      if (!user) code = "NOT_FOUND";
      else {
        const ctx = { ...base, actor: users.toActor(user, true) };
        if (job.kind === "transition") {
          const result = await runTransition(
            ctx,
            job.entity,
            job.entityId,
            job.event as EventOf<typeof job.entity>,
            {},
          );
          if (!result.ok) code = result.error.code;
        } else {
          const handler = getJobHandler(job.kind);
          if (!handler) code = "UNKNOWN_KIND";
          else {
            try {
              await tx.transaction(async (nestedTx) => {
                const result = await handler({ ...ctx, tx: nestedTx }, job);
                if (!result.ok) throw new RollbackError(result.error);
              });
            } catch (error) {
              if (!(error instanceof RollbackError)) throw error;
              code = error.error.code;
              // Restore the in-memory checkpoint after the savepoint rollback too.
              const current = await sandboxes.find(tx, sandbox.id);
              if (current) Object.assign(sandbox, current);
            }
          }
        }
      }
      await jobs.finish(tx, sandbox.id, job.id, code ? "skipped" : "done", code, item.at);
    }
    changed = true;
  }
  return { changed, pendingJobs: await pendingCount(tx, sandbox, persona.id) };
}
export async function refreshSandbox(
  db: Db,
  sandboxId: string,
): Promise<{ changed: boolean; pendingJobs: number }> {
  const sandbox = await sandboxes.find(db, sandboxId);
  if (!sandbox) return { changed: false, pendingJobs: 0 };
  const persona = await users.forPersona(db, sandboxId, sandbox.persona);
  if (!(await dueItems(db, sandbox, persona.id, sandboxClock(sandbox).now())).length)
    return { changed: false, pendingJobs: await pendingCount(db, sandbox, persona.id) };
  return db.transaction(async (tx) =>
    refreshInTransaction(tx, await sandboxes.lockSandbox(tx, sandboxId)),
  );
}
