import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isOwnerRequest } from "@/lib/owner-session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/plan/")) {
    return NextResponse.next();
  }
  if (pathname === "/login") {
    return NextResponse.next();
  }
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") {
    return NextResponse.next();
  }
  if (/^\/api\/auth\/[^/]+\/callback$/.test(pathname)) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/plan/")) {
    return NextResponse.next();
  }
  if (pathname === "/docs") {
    return NextResponse.next();
  }
  if (pathname === "/api/openapi") {
    return NextResponse.next();
  }

  const ok = await isOwnerRequest(request);
  if (!ok) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
