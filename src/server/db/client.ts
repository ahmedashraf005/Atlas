import "server-only";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import { migrate as neonMigrate } from "drizzle-orm/neon-serverless/migrator";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { migrate as pgliteMigrate } from "drizzle-orm/pglite/migrator";
import { getServerEnv } from "@/env";
import * as schema from "@/server/db/schema";

export type Db =
  | ReturnType<typeof pgliteDrizzle<typeof schema>>
  | ReturnType<typeof neonDrizzle<typeof schema>>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Database = Db | Tx;
const directories = new Map<string, Promise<Db>>();
let instance: Promise<Db> | undefined;
export async function connectDatabase(url: string, migrateNeon = false): Promise<Db> {
  if (url.startsWith("pglite://")) {
    const rawDirectory = url.slice("pglite://".length);
    const directory = rawDirectory === "memory" ? "memory" : resolve(rawDirectory);
    const existing = directory === "memory" ? undefined : directories.get(directory);
    if (existing) return existing;
    const pending = (async () => {
      if (directory !== "memory") await mkdir(dirname(resolve(directory)), { recursive: true });
      const client = new PGlite(directory === "memory" ? undefined : directory);
      const db = pgliteDrizzle(client, { schema, casing: "snake_case" });
      await pgliteMigrate(db, { migrationsFolder: "drizzle" });
      return db;
    })();
    if (directory !== "memory") directories.set(directory, pending);
    return pending;
  }
  neonConfig.webSocketConstructor = WebSocket;
  // Node functions reuse this pool; checked-out connections are released by Drizzle.
  // Keep the pool small and retire idle connections quickly on warm instances.
  const pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  const db = neonDrizzle(pool, { schema, casing: "snake_case" });
  if (migrateNeon) await neonMigrate(db, { migrationsFolder: "drizzle" });
  return db;
}
export function getDb(): Promise<Db> {
  instance ??= connectDatabase(getServerEnv().DATABASE_URL);
  return instance;
}
export async function closeDatabase(db: Db): Promise<void> {
  if (db.$client instanceof PGlite) await db.$client.close();
  else await db.$client.end();
}
