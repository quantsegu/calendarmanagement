import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createOwnerJwt, ownerAuthBypassed, OWNER_COOKIE } from "@/lib/owner-session";

export const runtime = "nodejs";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const password = body.password ?? "";

  if (ownerAuthBypassed()) {
    const token = await createOwnerJwt();
    const res = NextResponse.json({ ok: true, dev: true });
    res.cookies.set(OWNER_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  }

  const expected = process.env.APP_PASSWORD?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "APP_PASSWORD is not set. Add it to .env for personal access." },
      { status: 503 },
    );
  }

  if (!safeEqual(password, expected)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = await createOwnerJwt();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
