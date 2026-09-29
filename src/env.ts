import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().refine((value) => {
    if (/^pglite:\/\/[^\s]+$/.test(value)) return true;
    if (!/^postgres(?:ql)?:\/\//.test(value) || /\s/.test(value)) return false;
    try {
      return Boolean(new URL(value).hostname);
    } catch {
      return false;
    }
  }),
  SESSION_SECRET: z.string().min(32),
});
const flagsSchema = z.object({ ATLAS_DEV_UI: z.enum(["0", "1"]).default("0") });
let serverEnv: z.infer<typeof serverSchema> | undefined;
let flags: { devUi: boolean } | undefined;

export function getServerEnv(): { DATABASE_URL: string; SESSION_SECRET: string } {
  if (serverEnv) return serverEnv;
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path[0]))];
    throw new Error(`Invalid environment: ${names.join(", ")}`);
  }
  serverEnv = result.data;
  return serverEnv;
}

export function getFlags(): { devUi: boolean } {
  if (process.env.NODE_ENV === "production") return { devUi: false };
  if (flags) return flags;
  const result = flagsSchema.safeParse(process.env);
  if (!result.success) throw new Error("Invalid environment: ATLAS_DEV_UI");
  flags = { devUi: result.data.ATLAS_DEV_UI === "1" };
  return flags;
}

export function getPublicRepoUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_REPO_URL;
  if (!raw) return null;
  const result = z
    .url()
    .refine((v) => /^https?:\/\//.test(v))
    .safeParse(raw);
  if (!result.success) throw new Error("Invalid environment: NEXT_PUBLIC_REPO_URL");
  return result.data.replace(/\/$/, "");
}
