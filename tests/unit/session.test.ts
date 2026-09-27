import { SignJWT } from "jose";
import { v7 } from "uuid";
import { beforeAll, expect, it } from "vitest";
import { signSession, verifySession } from "@/server/session";

const now = new Date("2026-09-28T00:00:00Z"),
  sid = v7(),
  secret = "test-session-secret-with-at-least-32-characters";
beforeAll(() => {
  process.env.DATABASE_URL = "pglite://memory";
  process.env.SESSION_SECRET = secret;
});
it("signs and verifies the required claims", async () => {
  const claims = await verifySession(await signSession({ sid, per: "seller" }, now), now);
  expect(claims).toMatchObject({
    sid,
    per: "seller",
    iss: "atlas",
    aud: "atlas-demo",
    iat: now.getTime() / 1000,
    exp: now.getTime() / 1000 + 604800,
  });
});
it("rejects a tampered signature and garbage", async () => {
  const token = await signSession({ sid, per: "buyer_a" }, now);
  expect(await verifySession(`${token.slice(0, -10)}aaaaaaaaaa`, now)).toBeNull();
  expect(await verifySession("garbage", now)).toBeNull();
});
it("rejects expired, wrong-audience and malformed tokens", async () => {
  expect(
    await verifySession(
      await signSession({ sid, per: "seller" }, now),
      new Date(now.getTime() + 604800000),
    ),
  ).toBeNull();
  for (const payload of [
    { sid, per: "seller", aud: "other" },
    { sid: "invalid", per: "seller", aud: "atlas-demo" },
    { sid, per: "invalid", aud: "atlas-demo" },
  ]) {
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("atlas")
      .setIssuedAt(now.getTime() / 1000)
      .setExpirationTime(now.getTime() / 1000 + 1000)
      .sign(new TextEncoder().encode(secret));
    expect(await verifySession(token, now)).toBeNull();
  }
});
