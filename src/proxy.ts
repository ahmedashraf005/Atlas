import { type NextRequest, NextResponse } from "next/server";
import { v7 } from "uuid";
import { getFlags } from "@/env";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "@/server/session";

export async function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/dev/ui" &&
    process.env.NODE_ENV === "production" &&
    !getFlags().devUi
  )
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await verifySession(token))) return NextResponse.next();
  const nextToken = await signSession({ sid: v7(), per: "buyer_a" });
  request.cookies.set(SESSION_COOKIE, nextToken);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(SESSION_COOKIE, nextToken, sessionCookieOptions);
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|robots.txt|.*\\..*).*)"],
};
