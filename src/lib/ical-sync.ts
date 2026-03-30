import { prisma } from "@/lib/prisma";
import type { CalendarSource } from "@/generated/prisma";

type IcalModule = typeof import("node-ical");

type VEventLike = {
  rrule?: unknown;
  start?: unknown;
  end?: unknown;
  summary?: unknown;
  location?: unknown;
  uid?: unknown;
  status?: string;
};

function toDate(d: unknown): Date | null {
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  return null;
}

function collectInstances(ical: IcalModule, ev: VEventLike, rangeStart: Date, rangeEnd: Date) {
  const instances: { start: Date; end: Date; summary: unknown; location: unknown }[] = [];
  if (ev.rrule) {
    const expanded = ical.expandRecurringEvent(ev as Parameters<IcalModule["expandRecurringEvent"]>[0], {
      from: rangeStart,
      to: rangeEnd,
      expandOngoing: true,
    });
    for (const inst of expanded) {
      const s = toDate(inst.start);
      const e = toDate(inst.end);
      if (s && e && e > s) {
        instances.push({
          start: s,
          end: e,
          summary: inst.summary,
          location: ev.location,
        });
      }
    }
    return instances;
  }
  const s = toDate(ev.start);
  const e = toDate(ev.end);
  if (s && e && e > s) {
    instances.push({
      start: s,
      end: e,
      summary: ev.summary,
      location: ev.location,
    });
  }
  return instances;
}

export async function syncIcalSource(source: CalendarSource, rangeStart: Date, rangeEnd: Date) {
  const ical = (await import("node-ical")).default as IcalModule;

  if (!source.icalUrl?.trim()) {
    throw new Error("ICS URL missing");
  }

  let data: Record<string, unknown>;
  try {
    const res = await fetch(source.icalUrl, { signal: AbortSignal.timeout(25_000) });
    if (!res.ok) {
      throw new Error(`Calendar HTTP ${res.status}`);
    }
    const text = await res.text();
    data = (await ical.async.parseICS(text)) as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch calendar";
    throw new Error(msg);
  }

  const rows: {
    uid: string;
    title: string;
    startUtc: Date;
    endUtc: Date;
    location: string | null;
    isBusy: boolean;
  }[] = [];

  for (const key of Object.keys(data)) {
    const comp = data[key];
    if (!comp || typeof comp !== "object") continue;
    const t = comp as { type?: string };
    if (t.type !== "VEVENT") continue;
    const ev = t as VEventLike;
    if (ev.status === "CANCELLED") continue;

    const uidBase = String(ev.uid ?? key);
    const instances = collectInstances(ical, ev, rangeStart, rangeEnd);
    let i = 0;
    for (const inst of instances) {
      const uid = instances.length > 1 ? `${uidBase}#${i++}` : uidBase;
      const title =
        typeof inst.summary === "string"
          ? inst.summary
          : inst.summary && typeof inst.summary === "object" && "val" in inst.summary
            ? String((inst.summary as { val: string }).val)
            : "Busy";
      const loc =
        inst.location == null
          ? null
          : typeof inst.location === "string"
            ? inst.location
            : String(inst.location);
      rows.push({
        uid,
        title: title.slice(0, 500),
        startUtc: inst.start,
        endUtc: inst.end,
        location: loc ? loc.slice(0, 1000) : null,
        isBusy: true,
      });
    }
  }

  await prisma.$transaction([
    prisma.cachedEvent.deleteMany({ where: { sourceId: source.id } }),
    prisma.cachedEvent.createMany({
      data: rows.map((r) => ({ ...r, sourceId: source.id })),
    }),
  ]);

  return { imported: rows.length };
}
