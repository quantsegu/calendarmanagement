import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const sources = await prisma.calendarSource.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { events: true } } },
  });
  return NextResponse.json(
    sources.map((s) => ({
      id: s.id,
      kind: s.kind,
      name: s.name,
      icalUrl: s.icalUrl,
      color: s.color,
      eventCount: s._count.events,
      accountHint: s.accountHint,
      calendarId: s.calendarId,
    })),
  );
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    kind?: string;
    name?: string;
    icalUrl?: string;
    color?: string;
  };
  if (body.kind !== "ICAL") {
    return NextResponse.json({ error: "Use OAuth connect for Google, Microsoft, and Zoho" }, { status: 400 });
  }
  const name = body.name?.trim();
  const icalUrl = body.icalUrl?.trim();
  if (!name || !icalUrl) {
    return NextResponse.json({ error: "name and icalUrl are required" }, { status: 400 });
  }
  try {
    new URL(icalUrl);
  } catch {
    return NextResponse.json({ error: "icalUrl must be a valid URL" }, { status: 400 });
  }
  const source = await prisma.calendarSource.create({
    data: {
      kind: "ICAL",
      name,
      icalUrl,
      color: body.color?.trim() || "#6366f1",
    },
  });
  return NextResponse.json({
    id: source.id,
    kind: source.kind,
    name: source.name,
    icalUrl: source.icalUrl,
    color: source.color,
    eventCount: 0,
    accountHint: null,
    calendarId: null,
  });
}
