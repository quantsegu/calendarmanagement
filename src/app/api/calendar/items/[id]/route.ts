import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeManualItem } from "@/lib/manual-calendar-item";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const HEX = /^#[0-9A-Fa-f]{6}$/;

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const row = await prisma.manualCalendarItem.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(serializeManualItem(row));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = await prisma.manualCalendarItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }
  const o = raw as Record<string, unknown>;

  let title = existing.title;
  if (o.title !== undefined) {
    if (typeof o.title !== "string" || !o.title.trim()) {
      return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    }
    title = o.title.trim().slice(0, 500);
  }

  let startUtc = existing.startUtc;
  if (o.startUtc !== undefined) {
    if (typeof o.startUtc !== "string") {
      return NextResponse.json({ error: "startUtc must be an ISO string" }, { status: 400 });
    }
    const d = new Date(o.startUtc);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid startUtc" }, { status: 400 });
    }
    startUtc = d;
  }

  let endUtc = existing.endUtc;
  if (o.endUtc !== undefined) {
    if (typeof o.endUtc !== "string") {
      return NextResponse.json({ error: "endUtc must be an ISO string" }, { status: 400 });
    }
    const d = new Date(o.endUtc);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid endUtc" }, { status: 400 });
    }
    endUtc = d;
  }

  if (endUtc <= startUtc) {
    return NextResponse.json({ error: "endUtc must be after startUtc" }, { status: 400 });
  }

  let location = existing.location;
  if (o.location !== undefined) {
    location =
      typeof o.location === "string" && o.location.trim() ? o.location.trim().slice(0, 1000) : null;
  }

  let description = existing.description;
  if (o.description !== undefined) {
    description =
      typeof o.description === "string" && o.description.trim()
        ? o.description.trim().slice(0, 5000)
        : null;
  }

  let isBusy = existing.isBusy;
  if (o.isBusy !== undefined) {
    isBusy = Boolean(o.isBusy);
  }

  let color = existing.color;
  if (o.color !== undefined && typeof o.color === "string") {
    const c = o.color.trim();
    if (HEX.test(c)) color = c;
  }

  const row = await prisma.manualCalendarItem.update({
    where: { id },
    data: {
      title,
      startUtc,
      endUtc,
      location,
      description,
      isBusy,
      color,
    },
  });

  return NextResponse.json(serializeManualItem(row));
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await prisma.manualCalendarItem.deleteMany({ where: { id } });
  if (r.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
