const COOKIE = "calendar_oauth_nonce";

export function nonceCookieHeader(nonce: string) {
  return `${COOKIE}=${encodeURIComponent(nonce)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`;
}

export function clearNonceCookieHeader() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readNonceFromRequest(req: Request): string | undefined {
  const raw = req.headers.get("cookie") ?? "";
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(`${COOKIE}=`)) {
      return decodeURIComponent(p.slice(COOKIE.length + 1));
    }
  }
  return undefined;
}
