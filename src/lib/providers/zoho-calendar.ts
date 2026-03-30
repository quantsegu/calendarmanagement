import type { CalendarSource } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { oauthRedirectUri, zohoOAuth } from "@/lib/oauth-config";

type ZohoEvent = {
  uid?: string;
  title?: string;
  start?: string;
  end?: string;
  isallday?: boolean;
  dateandtime?: { start?: string; end?: string };
};

type ZohoList = { events?: ZohoEvent[] };

function zohoRangeParam(rangeStart: Date, rangeEnd: Date) {
  const fmt = (d: Date, allDay: boolean) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    if (allDay) return `${y}${m}${day}`;
    const h = String(d.getUTCHours()).padStart(2, "0");
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    const s = String(d.getUTCSeconds()).padStart(2, "0");
    return `${y}${m}${day}T${h}${min}${s}Z`;
  };
  return JSON.stringify({
    start: fmt(rangeStart, false),
    end: fmt(rangeEnd, false),
  });
}

function parseZohoCompact(dt: string): Date | null {
  if (!dt || dt.length < 8) return null;
  if (dt.length === 8) {
    const y = Number(dt.slice(0, 4));
    const mo = Number(dt.slice(4, 6)) - 1;
    const d = Number(dt.slice(6, 8));
    return new Date(Date.UTC(y, mo, d, 0, 0, 0));
  }
  const m = dt.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return new Date(
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6]),
    ),
  );
}

function zohoDateTimeToDate(s: string): Date | null {
  if (s.length >= 15 && s[8] === "T") {
    const base = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}`;
    const rest = s.slice(15);
    let iso = base;
    if (rest === "Z" || rest === "") iso += "Z";
    else if (/^[+-]\d{4}$/.test(rest)) iso += `${rest.slice(0, 3)}:${rest.slice(3)}`;
    else iso += rest;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseZohoCompact(s);
}

function parseZohoEvent(ev: ZohoEvent): { start: Date; end: Date } | null {
  if (ev.dateandtime?.start && ev.dateandtime?.end) {
    const s = zohoDateTimeToDate(ev.dateandtime.start);
    const e = zohoDateTimeToDate(ev.dateandtime.end);
    if (s && e && e > s) return { start: s, end: e };
  }
  if (ev.start && ev.end) {
    if (ev.isallday) {
      const s = parseZohoCompact(ev.start);
      const e = parseZohoCompact(ev.end);
      if (s && e) {
        const endDay = new Date(e);
        endDay.setUTCHours(23, 59, 59, 999);
        return { start: s, end: endDay };
      }
    }
    const s = parseZohoCompact(ev.start);
    const e = parseZohoCompact(ev.end);
    if (s && e && e > s) return { start: s, end: e };
  }
  return null;
}

export async function ensureZohoAccessToken(source: CalendarSource): Promise<string> {
  if (
    source.accessToken &&
    source.accessTokenExpiresAt &&
    source.accessTokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    return source.accessToken;
  }
  if (!source.refreshToken) {
    throw new Error("Zoho calendar not connected (missing refresh token)");
  }

  const host = zohoOAuth.accountsHost;
  const body = new URLSearchParams({
    refresh_token: source.refreshToken,
    grant_type: "refresh_token",
    client_id: zohoOAuth.clientId,
    client_secret: zohoOAuth.clientSecret,
    redirect_uri: oauthRedirectUri("zoho"),
  });
  const res = await fetch(`https://${host}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error ?? `Zoho token refresh failed (${res.status})`);
  }
  const exp = typeof json.expires_in === "number" ? json.expires_in : 3600;
  const expiresMs = exp > 1_000_000 ? exp : exp * 1000;
  await prisma.calendarSource.update({
    where: { id: source.id },
    data: {
      accessToken: json.access_token,
      accessTokenExpiresAt: new Date(Date.now() + expiresMs),
    },
  });
  return json.access_token;
}

export async function fetchZohoCalendars(accessToken: string): Promise<{ uid: string; name?: string }[]> {
  const res = await fetch("https://calendar.zoho.com/api/v1/calendars?category=all", {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Zoho list calendars ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { calendars?: { uid?: string; name?: string; category?: string }[] };
  const cals = data.calendars ?? [];
  const own = cals.filter((c) => c.uid && (c.category === "own" || !c.category));
  const list = own.length > 0 ? own : cals;
  return list.filter((c): c is { uid: string; name?: string } => Boolean(c.uid));
}

export async function syncZohoSource(source: CalendarSource, rangeStart: Date, rangeEnd: Date) {
  const calUid = source.calendarId?.trim();
  if (!calUid) {
    throw new Error("Zoho calendar uid missing; reconnect and pick a calendar");
  }

  const access = await ensureZohoAccessToken(source);
  const range = zohoRangeParam(rangeStart, rangeEnd);
  const url = `https://calendar.zoho.com/api/v1/calendars/${encodeURIComponent(calUid)}/events?range=${encodeURIComponent(
    range,
  )}&byinstance=true`;

  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${access}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Zoho events ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as ZohoList;

  const rows: {
    uid: string;
    title: string;
    startUtc: Date;
    endUtc: Date;
    location: string | null;
    isBusy: boolean;
  }[] = [];

  let i = 0;
  for (const ev of data.events ?? []) {
    const uid = ev.uid ?? `zoho-${i++}`;
    const dr = parseZohoEvent(ev);
    if (!dr) continue;
    rows.push({
      uid: String(uid).slice(0, 400),
      title: (ev.title ?? "Busy").slice(0, 500),
      startUtc: dr.start,
      endUtc: dr.end,
      location: null,
      isBusy: true,
    });
  }

  await prisma.$transaction([
    prisma.cachedEvent.deleteMany({ where: { sourceId: source.id } }),
    prisma.cachedEvent.createMany({
      data: rows.map((r) => ({ ...r, sourceId: source.id })),
    }),
  ]);

  return { imported: rows.length };
}
