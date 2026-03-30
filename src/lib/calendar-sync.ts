import { prisma } from "@/lib/prisma";
import { getSyncRange } from "@/lib/sync-range";
import { syncIcalSource } from "@/lib/ical-sync";
import { syncGoogleSource } from "@/lib/providers/google-calendar";
import { syncMicrosoftSource } from "@/lib/providers/microsoft-calendar";
import { syncZohoSource } from "@/lib/providers/zoho-calendar";

export async function syncCalendarSource(sourceId: string) {
  const source = await prisma.calendarSource.findUnique({ where: { id: sourceId } });
  if (!source) {
    throw new Error("Calendar source not found");
  }

  const { rangeStart, rangeEnd } = getSyncRange();

  switch (source.kind) {
    case "ICAL":
      return syncIcalSource(source, rangeStart, rangeEnd);
    case "GOOGLE":
      return syncGoogleSource(source, rangeStart, rangeEnd);
    case "MICROSOFT":
      return syncMicrosoftSource(source, rangeStart, rangeEnd);
    case "ZOHO":
      return syncZohoSource(source, rangeStart, rangeEnd);
    default: {
      const k: never = source.kind;
      throw new Error(`Unsupported calendar kind: ${String(k)}`);
    }
  }
}

export async function syncAllSources() {
  const sources = await prisma.calendarSource.findMany({ select: { id: true } });
  const results: { id: string; ok: boolean; error?: string; imported?: number }[] = [];
  for (const s of sources) {
    try {
      const { imported } = await syncCalendarSource(s.id);
      results.push({ id: s.id, ok: true, imported });
    } catch (e) {
      results.push({
        id: s.id,
        ok: false,
        error: e instanceof Error ? e.message : "Sync failed",
      });
    }
  }
  return results;
}
