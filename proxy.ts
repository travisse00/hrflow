import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/**
 * First gate only: "is there a valid, unexpired session cookie?"
 * It does NOT check roles or whether the account is still active; that needs the
 * database, so it happens server-side in requireUser() and in every action/service.
 */
export async function proxy(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const loginUrl = new URL("/", request.url); // login is the home page
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/employees/:path*",
    "/departments/:path*",
    "/attendance/:path*",
    "/leave/:path*",
    "/messages/:path*",
  ],
};