import "server-only";
import { v7 } from "uuid";
import type { z } from "zod";
import type { DomainError } from "@/domain/errors";
import type { Result } from "@/domain/result";
import { sandboxClock } from "@/server/clock";
import { type Db, getDb } from "@/server/db/client";
import { type ActionError, ConflictError, NotFoundError, RollbackError } from "@/server/errors";
import { rateLimit } from "@/server/ratelimit";
import { refreshInTransaction } from "@/server/refresh";
import * as users from "@/server/repositories/users";
import { ensureSandbox, lockSandbox } from "@/server/sandbox";
import type { SessionClaims } from "@/server/session";
import type { TxContext } from "@/server/transitions";

export type { ActionError, ActionErrorCode } from "@/server/errors";
export type ActionState<T> =
  | { status: "idle" }
  | { status: "success"; data: T; message?: string }
  | { status: "error"; error: ActionError };
export interface ActionDef<S extends z.ZodType, T> {
  name: string;
  input: S;
  rateLimit?: { max: number; windowSeconds: number };
  revalidate?: string[] | ((data: T) => string[]);
  handler: (ctx: TxContext, input: z.infer<S>) => Promise<Result<T, DomainError | ActionError>>;
}
function containsBigint(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value === "bigint") return true;
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (value instanceof Map) return [...value.entries()].some((v) => containsBigint(v, seen));
  if (value instanceof Set) return [...value.values()].some((v) => containsBigint(v, seen));
  return Object.values(value).some((v) => containsBigint(v, seen));
}
export class ClientSerializationError extends Error {
  constructor() {
    super("Action data contains bigint");
    this.name = "ClientSerializationError";
  }
}
export async function executeAction<S extends z.ZodType, T>(
  def: ActionDef<S, T>,
  raw: unknown,
  deps: { db: Db; session: SessionClaims | null },
): Promise<ActionState<T>> {
  const { db, session } = deps;
  if (!session)
    return {
      status: "error",
      error: { code: "UNAUTHENTICATED", message: "Your demo session expired. Reload the page." },
    };
  // Next adds reserved action references to progressive-enhancement forms.
  const parsed = def.input.safeParse(
    raw instanceof FormData
      ? Object.fromEntries([...raw.entries()].filter(([key]) => !key.startsWith("$ACTION_")))
      : raw,
  );
  if (!parsed.success)
    return {
      status: "error",
      error: {
        code: "VALIDATION",
        message: "Check the highlighted fields.",
        issues: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
    };
  try {
    await ensureSandbox(db, session.sid, session.per);
    if (
      !(await rateLimit(db, session.sid, def.name, def.rateLimit ?? { max: 60, windowSeconds: 60 }))
    )
      return {
        status: "error",
        error: { code: "RATE_LIMITED", message: "Too many requests. Wait a minute and try again." },
      };
    const data = await db.transaction(async (tx) => {
      const sandbox = await lockSandbox(tx, session.sid);
      await refreshInTransaction(tx, sandbox);
      const user = await users.forPersona(tx, session.sid, sandbox.persona);
      const ctx: TxContext = {
        tx,
        sandbox,
        actor: users.toActor(user),
        now: sandboxClock(sandbox).now(),
        personaUserId: user.id,
        depth: 0,
      };
      const result = await def.handler(ctx, parsed.data);
      if (!result.ok) throw new RollbackError(result.error);
      if (process.env.NODE_ENV !== "production" && containsBigint(result.value))
        throw new ClientSerializationError();
      return result.value;
    });
    return { status: "success", data };
  } catch (error) {
    if (error instanceof ClientSerializationError) throw error;
    if (error instanceof RollbackError) return { status: "error", error: error.error };
    if (error instanceof ConflictError)
      return {
        status: "error",
        error: {
          code: "CONFLICT",
          message: "Someone else changed this a moment ago. Refresh and try again.",
        },
      };
    if (error instanceof NotFoundError)
      return { status: "error", error: { code: "NOT_FOUND", message: "Not found." } };
    const ref = v7().slice(-8);
    console.error("[action]", def.name, ref, error instanceof Error ? error.name : "UnknownError");
    return {
      status: "error",
      error: { code: "INTERNAL", message: "Something went wrong. Try again.", ref },
    };
  }
}
export function defineAction<S extends z.ZodType, T>(
  def: ActionDef<S, T>,
): (prev: ActionState<T>, input: z.input<S> | FormData) => Promise<ActionState<T>> {
  return async (_prev, input) => {
    const { readSession } = await import("@/server/session");
    const { revalidatePath } = await import("next/cache");
    const result = await executeAction(def, input, {
      db: await getDb(),
      session: await readSession(),
    });
    if (result.status === "success")
      for (const path of typeof def.revalidate === "function"
        ? def.revalidate(result.data)
        : (def.revalidate ?? []))
        revalidatePath(path);
    return result;
  };
}
