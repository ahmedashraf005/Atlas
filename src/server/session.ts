import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";
import { type PersonaKey, personaSchema } from "@/config/personas";
import { getServerEnv } from "@/env";
import { systemClock } from "@/lib/clock";

export { PERSONAS, type PersonaKey, personaSchema } from "@/config/personas";

const claimsSchema = z.object({
  sid: z.uuid(),
  per: personaSchema,
  iss: z.literal("atlas"),
  aud: z.literal("atlas-demo"),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type SessionClaims = z.infer<typeof claimsSchema>;
export const SESSION_COOKIE = "atlas_session";
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60,
} as const;
const key = () => new TextEncoder().encode(getServerEnv().SESSION_SECRET);
export async function signSession(
  session: { sid: string; per: PersonaKey },
  now = systemClock.now(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("atlas")
    .setAudience("atlas-demo")
    .setIssuedAt(iat)
    .setExpirationTime(iat + sessionCookieOptions.maxAge)
    .sign(key());
}
export async function verifySession(
  token: string,
  now = systemClock.now(),
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      issuer: "atlas",
      audience: "atlas-demo",
      currentDate: now,
    });
    const parsed = claimsSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export async function readSession(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}
export async function writeSession(session: { sid: string; per: PersonaKey }): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await signSession(session), sessionCookieOptions);
}
