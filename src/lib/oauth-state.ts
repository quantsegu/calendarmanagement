export type OAuthStartProvider = "GOOGLE" | "MICROSOFT" | "ZOHO";

export type OAuthStateV1 = {
  v: 1;
  provider: OAuthStartProvider;
  name: string;
  color: string;
  /** Google calendar id or Microsoft graph calendar id; omit for defaults */
  calendarId: string | null;
  /** Zoho calendar uid (optional; if omitted we pick first own calendar after auth) */
  zohoCalendarUid: string | null;
  nonce: string;
};

function b64urlEncode(json: string) {
  return Buffer.from(json, "utf8").toString("base64url");
}

function b64urlDecode(s: string) {
  return Buffer.from(s, "base64url").toString("utf8");
}

export function encodeOAuthState(payload: OAuthStateV1): string {
  return b64urlEncode(JSON.stringify(payload));
}

export function decodeOAuthState(param: string | null): OAuthStateV1 | null {
  if (!param) return null;
  try {
    const raw = b64urlDecode(param);
    const o = JSON.parse(raw) as OAuthStateV1;
    if (o?.v !== 1 || !o.provider || !o.nonce || typeof o.name !== "string") return null;
    return o;
  } catch {
    return null;
  }
}

