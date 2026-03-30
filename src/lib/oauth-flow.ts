import { prisma } from "@/lib/prisma";
import { fetchZohoCalendars } from "@/lib/providers/zoho-calendar";
import {
  getAppBaseUrl,
  googleOAuth,
  microsoftOAuth,
  oauthRedirectUri,
  zohoOAuth,
} from "@/lib/oauth-config";
import type { OAuthStateV1 } from "@/lib/oauth-state";

export function googleAuthorizeUrl(state: string) {
  const p = new URLSearchParams({
    client_id: googleOAuth.clientId,
    redirect_uri: oauthRedirectUri("google"),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export function microsoftAuthorizeUrl(state: string) {
  const p = new URLSearchParams({
    client_id: microsoftOAuth.clientId,
    redirect_uri: oauthRedirectUri("microsoft"),
    response_type: "code",
    scope: "offline_access Calendars.Read",
    state,
  });
  return `https://login.microsoftonline.com/${microsoftOAuth.tenant}/oauth2/v2.0/authorize?${p.toString()}`;
}

export function zohoAuthorizeUrl(state: string) {
  const p = new URLSearchParams({
    client_id: zohoOAuth.clientId,
    redirect_uri: oauthRedirectUri("zoho"),
    response_type: "code",
    scope: "ZohoCalendar.calendar.READ,ZohoCalendar.event.READ",
    access_type: "offline",
    state,
  });
  return `https://${zohoOAuth.accountsHost}/oauth/v2/auth?${p.toString()}`;
}

function emailFromGoogleIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    const json = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as { email?: string };
    return json.email ?? null;
  } catch {
    return null;
  }
}

async function microsoftAccountHint(accessToken: string): Promise<string | null> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return j.mail ?? j.userPrincipalName ?? null;
}

export async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  id_token?: string;
}> {
  const body = new URLSearchParams({
    code,
    client_id: googleOAuth.clientId,
    client_secret: googleOAuth.clientSecret,
    redirect_uri: oauthRedirectUri("google"),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(json.error ?? "Google token exchange failed");
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in,
    id_token: json.id_token,
  };
}

export async function exchangeMicrosoftCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}> {
  const body = new URLSearchParams({
    code,
    client_id: microsoftOAuth.clientId,
    client_secret: microsoftOAuth.clientSecret,
    redirect_uri: oauthRedirectUri("microsoft"),
    grant_type: "authorization_code",
    scope: "offline_access Calendars.Read",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${microsoftOAuth.tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(json.error ?? "Microsoft token exchange failed");
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in,
  };
}

export async function exchangeZohoCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}> {
  const body = new URLSearchParams({
    code,
    client_id: zohoOAuth.clientId,
    client_secret: zohoOAuth.clientSecret,
    redirect_uri: oauthRedirectUri("zoho"),
    grant_type: "authorization_code",
  });
  const res = await fetch(`https://${zohoOAuth.accountsHost}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(json.error ?? "Zoho token exchange failed");
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in,
  };
}

/** Google/Microsoft use seconds; Zoho may return milliseconds. */
function expiresAtFromOAuth(expiresIn: number | undefined) {
  const exp = typeof expiresIn === "number" ? expiresIn : 3600;
  const ttlMs = exp > 1_000_000 ? exp : exp * 1000;
  return new Date(Date.now() + ttlMs);
}

export async function persistOAuthCalendarSource(
  state: OAuthStateV1,
  tokens: { access_token: string; refresh_token: string; expires_in?: number; id_token?: string },
) {
  let accountHint: string | null = null;
  let calendarId: string | null = state.calendarId?.trim() || null;
  let zohoUid = state.zohoCalendarUid?.trim() || null;

  if (state.provider === "GOOGLE") {
    accountHint = emailFromGoogleIdToken(tokens.id_token);
    if (!calendarId) calendarId = "primary";
  }

  if (state.provider === "MICROSOFT") {
    accountHint = await microsoftAccountHint(tokens.access_token);
  }

  if (state.provider === "ZOHO") {
    if (!zohoUid) {
      const cals = await fetchZohoCalendars(tokens.access_token);
      if (cals.length === 0) {
        throw new Error("No Zoho calendars found for this account");
      }
      zohoUid = cals[0]!.uid;
    }
    calendarId = zohoUid;
  }

  await prisma.calendarSource.create({
    data: {
      kind: state.provider,
      name: state.name.slice(0, 200),
      color: state.color.slice(0, 32),
      icalUrl: null,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      accessTokenExpiresAt: expiresAtFromOAuth(tokens.expires_in),
      calendarId,
      accountHint,
    },
  });
}

export function oauthErrorRedirect(message: string) {
  const base = getAppBaseUrl();
  const u = new URL("/", base);
  u.searchParams.set("oauth", "error");
  u.searchParams.set("message", message.slice(0, 300));
  return u.toString();
}

export function oauthSuccessRedirect() {
  return `${getAppBaseUrl()}/?oauth=connected`;
}
