import { type NextRequest, NextResponse } from "next/server";
import { getFlags } from "@/env";

// Return the status before the app loading boundary starts streaming its shell.
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && !getFlags().devUi) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/dev/ui" };
