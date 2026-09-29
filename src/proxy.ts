import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { v7 } from "uuid";
import { contentSecurityPolicy } from "@/lib/csp";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "@/server/session";
export async function proxy(request: NextRequest) {
  const nonce = randomBytes(18).toString("base64"),
    csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  let nextToken: string | null = null;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) {
    nextToken = await signSession({ sid: v7(), per: "buyer_a" });
    request.cookies.set(SESSION_COOKIE, nextToken);
    headers.set("cookie", request.cookies.toString());
  }
  const response =
    request.nextUrl.pathname === "/dev/ui" && process.env.NODE_ENV === "production"
      ? NextResponse.rewrite(new URL("/_not-found", request.url), {
          status: 404,
          request: { headers },
        })
      : NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  if (nextToken) response.cookies.set(SESSION_COOKIE, nextToken, sessionCookieOptions);
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|robots.txt|.*\\..*).*)"],
};
