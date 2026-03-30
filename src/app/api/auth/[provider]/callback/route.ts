import { NextResponse } from "next/server";
import { decodeOAuthState } from "@/lib/oauth-state";
import { clearNonceCookieHeader, readNonceFromRequest } from "@/lib/oauth-cookies";
import {
  exchangeGoogleCode,
  exchangeMicrosoftCode,
  exchangeZohoCode,
  oauthErrorRedirect,
  oauthSuccessRedirect,
  persistOAuthCalendarSource,
} from "@/lib/oauth-flow";

export const runtime = "nodejs";

const MAP: Record<string, "GOOGLE" | "MICROSOFT" | "ZOHO"> = {
  google: "GOOGLE",
  microsoft: "MICROSOFT",
  zoho: "ZOHO",
};

function redirectWithClearedCookies(target: string) {
  const res = NextResponse.redirect(target);
  res.headers.append("Set-Cookie", clearNonceCookieHeader());
  return res;
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const providerKey = (await ctx.params).provider.toLowerCase();
  const expected = MAP[providerKey];
  if (!expected) {
    return redirectWithClearedCookies(oauthErrorRedirect("Unknown provider"));
  }

  const url = new URL(req.url);
  const oauthErr = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (oauthErr) {
    return redirectWithClearedCookies(
      oauthErrorRedirect(url.searchParams.get("error_description") || oauthErr),
    );
  }
  if (!code) {
    return redirectWithClearedCookies(oauthErrorRedirect("Missing authorization code"));
  }

  const state = decodeOAuthState(stateParam);
  if (!state || state.provider !== expected) {
    return redirectWithClearedCookies(oauthErrorRedirect("Invalid OAuth state"));
  }

  const cookieNonce = readNonceFromRequest(req);
  if (!cookieNonce || cookieNonce !== state.nonce) {
    return redirectWithClearedCookies(oauthErrorRedirect("OAuth session expired — try again"));
  }

  try {
    const tokens =
      providerKey === "google"
        ? await exchangeGoogleCode(code)
        : providerKey === "microsoft"
          ? await exchangeMicrosoftCode(code)
          : await exchangeZohoCode(code);
    await persistOAuthCalendarSource(state, tokens);
  } catch (e) {
    return redirectWithClearedCookies(oauthErrorRedirect(e instanceof Error ? e.message : "OAuth failed"));
  }

  return redirectWithClearedCookies(oauthSuccessRedirect());
}
