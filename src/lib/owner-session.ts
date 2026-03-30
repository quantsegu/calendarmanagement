import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

export const OWNER_COOKIE = "cal_owner";

function jwtSecretKey() {
  const s = process.env.SESSION_SECRET?.trim();
  const p = process.env.APP_PASSWORD?.trim();
  const raw = s || p;
  if (!raw) {
    if (process.env.NODE_ENV === "development") {
      return new TextEncoder().encode("cal-dev-only-insecure-key");
    }
    return new TextEncoder().encode("__set_APP_PASSWORD_or_SESSION_SECRET__");
  }
  return new TextEncoder().encode(raw);
}

/** Local dev without APP_PASSWORD: no gate (still use OAuth as before). */
export function ownerAuthBypassed() {
  return process.env.NODE_ENV === "development" && !process.env.APP_PASSWORD?.trim();
}

export async function createOwnerJwt(): Promise<string> {
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(jwtSecretKey());
}

export async function verifyOwnerJwt(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, jwtSecretKey());
    return true;
  } catch {
    return false;
  }
}

export async function isOwnerRequest(req: NextRequest): Promise<boolean> {
  if (ownerAuthBypassed()) return true;
  return verifyOwnerJwt(req.cookies.get(OWNER_COOKIE)?.value);
}
