import { prisma } from "@/lib/prisma";
import { buildScheduleSlots, type EventRow, type LocationRow } from "@/lib/timeline";

const MANUAL_SOURCE_NAME = "Manual";

export async function getSchedulePayload(rangeStart: Date, rangeEnd: Date) {
  const [rawEvents, windows, manualItems] = await Promise.all([
    prisma.cachedEvent.findMany({
      where: { startUtc: { lt: rangeEnd }, endUtc: { gt: rangeStart } },
      include: { source: true },
      orderBy: { startUtc: "asc" },
    }),
    prisma.locationWindow.findMany({
      where: { startUtc: { lt: rangeEnd }, endUtc: { gt: rangeStart } },
      orderBy: { startUtc: "asc" },
    }),
    prisma.manualCalendarItem.findMany({
      where: { startUtc: { lt: rangeEnd }, endUtc: { gt: rangeStart } },
      orderBy: { startUtc: "asc" },
    }),
  ]);

  const syncedRows: EventRow[] = rawEvents.map((e) => ({
    startUtc: e.startUtc,
    endUtc: e.endUtc,
    title: e.title,
    location: e.location,
    isBusy: e.isBusy,
    color: e.source.color,
    sourceName: e.source.name,
  }));

  const manualRows: EventRow[] = manualItems.map((m) => ({
    startUtc: m.startUtc,
    endUtc: m.endUtc,
    title: m.title,
    location: m.location,
    isBusy: m.isBusy,
    color: m.color,
    sourceName: MANUAL_SOURCE_NAME,
  }));

  const events: EventRow[] = [...syncedRows, ...manualRows];

  const locRows: LocationRow[] = windows.map((w) => ({
    startUtc: w.startUtc,
    endUtc: w.endUtc,
    label: w.label,
    address: w.address,
  }));

  const slots = buildScheduleSlots(rangeStart, rangeEnd, events, locRows);

  return {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    slots,
    events: [
      ...rawEvents.map((e) => ({
        id: e.id,
        kind: "synced" as const,
        title: e.title,
        startUtc: e.startUtc.toISOString(),
        endUtc: e.endUtc.toISOString(),
        location: e.location,
        sourceName: e.source.name,
        color: e.source.color,
      })),
      ...manualItems.map((m) => ({
        id: m.id,
        kind: "manual" as const,
        title: m.title,
        startUtc: m.startUtc.toISOString(),
        endUtc: m.endUtc.toISOString(),
        location: m.location,
        sourceName: MANUAL_SOURCE_NAME,
        color: m.color,
      })),
    ].sort((a, b) => a.startUtc.localeCompare(b.startUtc)),
    locationWindows: windows.map((w) => ({
      id: w.id,
      label: w.label,
      address: w.address,
      startUtc: w.startUtc.toISOString(),
      endUtc: w.endUtc.toISOString(),
    })),
  };
}

export async function validateShareToken(token: string) {
  return prisma.shareLink.findUnique({ where: { token } });
}
