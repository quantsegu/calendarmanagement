import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseItemBody, serializeManualItem } from "@/lib/manual-calendar-item";

export const runtime = "nodejs";

/**
 * GET /api/calendar/items?from=ISO&to=ISO
 * Lists manual calendar entries overlapping the range (defaults: 7 days ago → 1 year ahead).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fromQ = url.searchParams.get("from");
  const toQ = url.searchParams.get("to");
  const now = Date.now();
  const rangeStart = fromQ ? new Date(fromQ) : new Date(now - 7 * 86400000);
  const rangeEnd = toQ ? new Date(toQ) : new Date(now + 365 * 86400000);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeEnd <= rangeStart) {
    return NextResponse.json({ error: "Invalid from/to range" }, { status: 400 });
  }

  const rows = await prisma.manualCalendarItem.findMany({
    where: { startUtc: { lt: rangeEnd }, endUtc: { gt: rangeStart } },
    orderBy: { startUtc: "asc" },
    take: 2000,
  });

  return NextResponse.json({
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    items: rows.map(serializeManualItem),
  });
}

/**
 * POST /api/calendar/items
 * Body: { title, startUtc, endUtc, location?, description?, isBusy?, color? }
 */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = parseItemBody(raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const row = await prisma.manualCalendarItem.create({
    data: {
      title: parsed.title,
      startUtc: parsed.startUtc,
      endUtc: parsed.endUtc,
      location: parsed.location,
      description: parsed.description,
      isBusy: parsed.isBusy,
      color: parsed.color,
    },
  });

  return NextResponse.json(serializeManualItem(row), { status: 201 });
}
