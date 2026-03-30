/**
 * Set in .env:
 * APP_BASE_URL=https://your.domain  (no trailing slash; used as OAuth redirect base)
 * GOOGLE_CLIENT_ID=  GOOGLE_CLIENT_SECRET=
 * MICROSOFT_CLIENT_ID=  MICROSOFT_CLIENT_SECRET=
 * ZOHO_CLIENT_ID=  ZOHO_CLIENT_SECRET=
 * ZOHO_ACCOUNTS_DOMAIN=accounts.zoho.com  (or .eu / .in / .com.au)
 */

export function getAppBaseUrl() {
  const u = process.env.APP_BASE_URL?.trim();
  if (!u) {
    throw new Error("APP_BASE_URL is not set (e.g. http://localhost:3000)");
  }
  return u.replace(/\/$/, "");
}

export function oauthRedirectUri(provider: "google" | "microsoft" | "zoho") {
  return `${getAppBaseUrl()}/api/auth/${provider}/callback`;
}

export const googleOAuth = {
  get clientId() {
    const v = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!v) throw new Error("GOOGLE_CLIENT_ID is not set");
    return v;
  },
  get clientSecret() {
    const v = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!v) throw new Error("GOOGLE_CLIENT_SECRET is not set");
    return v;
  },
};

export const microsoftOAuth = {
  get clientId() {
    const v = process.env.MICROSOFT_CLIENT_ID?.trim();
    if (!v) throw new Error("MICROSOFT_CLIENT_ID is not set");
    return v;
  },
  get clientSecret() {
    const v = process.env.MICROSOFT_CLIENT_SECRET?.trim();
    if (!v) throw new Error("MICROSOFT_CLIENT_SECRET is not set");
    return v;
  },
  tenant: process.env.MICROSOFT_TENANT_ID?.trim() || "common",
};

export const zohoOAuth = {
  get clientId() {
    const v = process.env.ZOHO_CLIENT_ID?.trim();
    if (!v) throw new Error("ZOHO_CLIENT_ID is not set");
    return v;
  },
  get clientSecret() {
    const v = process.env.ZOHO_CLIENT_SECRET?.trim();
    if (!v) throw new Error("ZOHO_CLIENT_SECRET is not set");
    return v;
  },
  get accountsHost() {
    return process.env.ZOHO_ACCOUNTS_DOMAIN?.trim() || "accounts.zoho.com";
  },
};
