import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", undefined);
  vi.stubEnv("SESSION_SECRET", undefined);
  vi.stubEnv("ATLAS_DEV_UI", undefined);
});
afterEach(() => vi.unstubAllEnvs());

it("parses valid server environment lazily and caches it", async () => {
  const { getServerEnv } = await import("@/env");
  vi.stubEnv("DATABASE_URL", "postgres://user:secret@example.test/db");
  vi.stubEnv("SESSION_SECRET", "x".repeat(32));
  const env = getServerEnv();
  expect(env).toEqual({
    DATABASE_URL: "postgres://user:secret@example.test/db",
    SESSION_SECRET: "x".repeat(32),
  });
  vi.stubEnv("SESSION_SECRET", "invalid");
  expect(getServerEnv()).toBe(env);
});
it("names invalid variables without disclosing values", async () => {
  vi.stubEnv("DATABASE_URL", "postgres://user:private-value@example.test/db");
  const { getServerEnv } = await import("@/env");
  expect(getServerEnv).toThrow("Invalid environment: SESSION_SECRET");
  try {
    getServerEnv();
  } catch (error) {
    expect(String(error)).not.toContain("private-value");
    expect(String(error)).not.toContain("DATABASE_URL");
  }
});
it("lists both invalid names", async () => {
  const { getServerEnv } = await import("@/env");
  expect(getServerEnv).toThrow("Invalid environment: DATABASE_URL, SESSION_SECRET");
});
it("flags default to false without server env", async () => {
  const { getFlags } = await import("@/env");
  expect(getFlags()).toEqual({ devUi: false });
});
it("flag 1 is true and cached", async () => {
  vi.stubEnv("ATLAS_DEV_UI", "1");
  const { getFlags } = await import("@/env");
  const flags = getFlags();
  expect(flags).toEqual({ devUi: true });
  vi.stubEnv("ATLAS_DEV_UI", "0");
  expect(getFlags()).toBe(flags);
});
it("invalid flag is rejected without disclosing the value", async () => {
  vi.stubEnv("ATLAS_DEV_UI", "invalid-secret");
  const { getFlags } = await import("@/env");
  expect(getFlags).toThrow(/^Invalid environment: ATLAS_DEV_UI$/);
});

it.each([
  "pglite://memory",
  "pglite://.pglite/dev",
  "postgresql://user:password@example.test/atlas",
])("accepts database driver URL %s", async (url) => {
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv("SESSION_SECRET", "x".repeat(32));
  const { getServerEnv } = await import("@/env");
  expect(getServerEnv().DATABASE_URL).toBe(url);
});
it.each([
  "https://example.test/db",
  "pglite://",
  "postgres://",
  "invalid-secret",
])("rejects unsupported or empty database URLs without leaking them", async (url) => {
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv("SESSION_SECRET", "x".repeat(32));
  const { getServerEnv } = await import("@/env");
  expect(getServerEnv).toThrow("Invalid environment: DATABASE_URL");
});
