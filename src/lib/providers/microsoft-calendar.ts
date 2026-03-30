import type { CalendarSource } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { microsoftOAuth } from "@/lib/oauth-config";

type MEvent = {
  id?: string;
  subject?: string;
  location?: { displayName?: string };
  showAs?: string;
  isCancelled?: boolean;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
};

type MList = { value?: MEvent[]; "@odata.nextLink"?: string };

export async function ensureMicrosoftAccessToken(source: CalendarSource): Promise<string> {
  if (
    source.accessToken &&
    source.accessTokenExpiresAt &&
    source.accessTokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    return source.accessToken;
  }
  if (!source.refreshToken) {
    throw new Error("Microsoft calendar not connected (missing refresh token)");
  }

  const tenant = microsoftOAuth.tenant;
  const body = new URLSearchParams({
    client_id: microsoftOAuth.clientId,
    client_secret: microsoftOAuth.clientSecret,
    refresh_token: source.refreshToken,
    grant_type: "refresh_token",
    scope: "offline_access Calendars.Read",
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error ?? `Microsoft token refresh failed (${res.status})`);
  }
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
  await prisma.calendarSource.update({
    where: { id: source.id },
    data: {
      accessToken: json.access_token,
      accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      ...(json.refresh_token ? { refreshToken: json.refresh_token } : {}),
    },
  });
  return json.access_token;
}

function parseMsDate(start: MEvent["start"], end: MEvent["end"]): { start: Date; end: Date } | null {
  if (!start?.dateTime || !end?.dateTime) return null;
  const s = new Date(start.dateTime);
  const e = new Date(end.dateTime);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) return null;
  return { start: s, end: e };
}

export async function syncMicrosoftSource(source: CalendarSource, rangeStart: Date, rangeEnd: Date) {
  const access = await ensureMicrosoftAccessToken(source);
  const calId = source.calendarId?.trim();

  const rows: {
    uid: string;
    title: string;
    startUtc: Date;
    endUtc: Date;
    location: string | null;
    isBusy: boolean;
  }[] = [];

  let next: string | undefined =
    calId && calId.length > 0
      ? `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calId)}/calendarView?startDateTime=${encodeURIComponent(
          rangeStart.toISOString(),
        )}&endDateTime=${encodeURIComponent(rangeEnd.toISOString())}&$orderby=start/dateTime&$top=100`
      : `https://graph.microsoft.com/v1.0/me/calendar/calendarView?startDateTime=${encodeURIComponent(
          rangeStart.toISOString(),
        )}&endDateTime=${encodeURIComponent(rangeEnd.toISOString())}&$orderby=start/dateTime&$top=100`;

  while (next) {
    const res = await fetch(next, {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Microsoft Graph ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = (await res.json()) as MList;
    for (const ev of data.value ?? []) {
      if (ev.isCancelled) continue;
      const id = ev.id ?? "";
      if (!id) continue;
      const dr = parseMsDate(ev.start, ev.end);
      if (!dr) continue;
      const busy = ev.showAs !== "free";
      rows.push({
        uid: id,
        title: (ev.subject ?? "Busy").slice(0, 500),
        startUtc: dr.start,
        endUtc: dr.end,
        location: ev.location?.displayName ? ev.location.displayName.slice(0, 1000) : null,
        isBusy: busy,
      });
    }
    next = data["@odata.nextLink"];
  }

  await prisma.$transaction([
    prisma.cachedEvent.deleteMany({ where: { sourceId: source.id } }),
    prisma.cachedEvent.createMany({
      data: rows.map((r) => ({ ...r, sourceId: source.id })),
    }),
  ]);

  return { imported: rows.length };
}
