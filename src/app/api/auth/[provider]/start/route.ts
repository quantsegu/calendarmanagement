import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { encodeOAuthState, type OAuthStartProvider } from "@/lib/oauth-state";
import { nonceCookieHeader } from "@/lib/oauth-cookies";
import { googleAuthorizeUrl, microsoftAuthorizeUrl, zohoAuthorizeUrl } from "@/lib/oauth-flow";

export const runtime = "nodejs";

const PROVIDERS = new Set(["google", "microsoft", "zoho"]);

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const provider = (await ctx.params).provider.toLowerCase();
  if (!PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const url = new URL(req.url);
  const name = url.searchParams.get("name")?.trim() || "Calendar";
  const color = url.searchParams.get("color")?.trim() || "#6366f1";
  const calendarId = url.searchParams.get("calendarId")?.trim() || null;
  const zohoCalendarUid = url.searchParams.get("zohoCalendarUid")?.trim() || null;

  const nonce = randomBytes(24).toString("hex");
  const state = encodeOAuthState({
    v: 1,
    provider: provider.toUpperCase() as OAuthStartProvider,
    name,
    color,
    calendarId,
    zohoCalendarUid,
    nonce,
  });

  let target: string;
  try {
    if (provider === "google") target = googleAuthorizeUrl(state);
    else if (provider === "microsoft") target = microsoftAuthorizeUrl(state);
    else target = zohoAuthorizeUrl(state);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "OAuth is not configured" },
      { status: 503 },
    );
  }

  const res = NextResponse.redirect(target);
  res.headers.append("Set-Cookie", nonceCookieHeader(nonce));
  return res;
}
