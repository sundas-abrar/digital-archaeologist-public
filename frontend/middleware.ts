import { NextRequest, NextResponse } from "next/server";

// If SITE_PASSWORD isn't set (e.g. local development), the gate is a
// no-op and the app behaves exactly as before.
const PASSWORD = process.env.SITE_PASSWORD || "";

export function middleware(request: NextRequest) {
  if (!PASSWORD) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/gate")) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("site_auth")?.value;
  if (cookie === PASSWORD) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  url.searchParams.set("next", request.nextUrl.pathname);
  if (cookie) {
    // A cookie was present but didn't match \u2014 that was a wrong guess,
    // not just a fresh visit.
    url.searchParams.set("error", "1");
  }
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
