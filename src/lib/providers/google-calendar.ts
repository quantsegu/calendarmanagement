import type { CalendarSource } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { googleOAuth } from "@/lib/oauth-config";

type GEvent = {
  id?: string;
  summary?: string;
  location?: string;
  status?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
};

type GList = { items?: GEvent[]; nextPageToken?: string };

export async function ensureGoogleAccessToken(source: CalendarSource): Promise<string> {
  if (
    source.accessToken &&
    source.accessTokenExpiresAt &&
    source.accessTokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    return source.accessToken;
  }
  if (!source.refreshToken) {
    throw new Error("Google calendar not connected (missing refresh token)");
  }

  const body = new URLSearchParams({
    client_id: googleOAuth.clientId,
    client_secret: googleOAuth.clientSecret,
    refresh_token: source.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error ?? `Google token refresh failed (${res.status})`);
  }
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
  await prisma.calendarSource.update({
    where: { id: source.id },
    data: {
      accessToken: json.access_token,
      accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
    },
  });
  return json.access_token;
}

function parseGoogleDate(start: GEvent["start"], end: GEvent["end"]): { start: Date; end: Date } | null {
  if (!start || !end) return null;
  if (start.date && end.date) {
    const s = new Date(`${start.date}T00:00:00.000Z`);
    const endExclusive = new Date(`${end.date}T00:00:00.000Z`);
    const e = new Date(endExclusive.getTime() - 1);
    if (e >= s) return { start: s, end: e };
  }
  if (start.dateTime && end.dateTime) {
    const s = new Date(start.dateTime);
    const e = new Date(end.dateTime);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e > s) return { start: s, end: e };
  }
  return null;
}

export async function syncGoogleSource(source: CalendarSource, rangeStart: Date, rangeEnd: Date) {
  const calId = source.calendarId?.trim() || "primary";
  const access = await ensureGoogleAccessToken(source);

  const rows: {
    uid: string;
    title: string;
    startUtc: Date;
    endUtc: Date;
    location: string | null;
    isBusy: boolean;
  }[] = [];

  let pageToken: string | undefined;
  for (;;) {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
    );
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", rangeStart.toISOString());
    url.searchParams.set("timeMax", rangeEnd.toISOString());
    url.searchParams.set("maxResults", "2500");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Google Calendar API ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = (await res.json()) as GList;
    for (const ev of data.items ?? []) {
      if (ev.status === "cancelled") continue;
      const id = ev.id ?? "";
      if (!id) continue;
      const dr = parseGoogleDate(ev.start, ev.end);
      if (!dr) continue;
      rows.push({
        uid: id,
        title: (ev.summary ?? "Busy").slice(0, 500),
        startUtc: dr.start,
        endUtc: dr.end,
        location: ev.location ? ev.location.slice(0, 1000) : null,
        isBusy: true,
      });
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  await prisma.$transaction([
    prisma.cachedEvent.deleteMany({ where: { sourceId: source.id } }),
    prisma.cachedEvent.createMany({
      data: rows.map((r) => ({ ...r, sourceId: source.id })),
    }),
  ]);

  return { imported: rows.length };
}
