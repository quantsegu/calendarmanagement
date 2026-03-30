import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.locationWindow.findMany({ orderBy: { startUtc: "asc" } });
  return NextResponse.json(
    rows.map((w) => ({
      id: w.id,
      label: w.label,
      address: w.address,
      startUtc: w.startUtc.toISOString(),
      endUtc: w.endUtc.toISOString(),
    })),
  );
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    label?: string;
    address?: string;
    startUtc?: string;
    endUtc?: string;
  };
  const label = body.label?.trim();
  const startUtc = body.startUtc ? new Date(body.startUtc) : null;
  const endUtc = body.endUtc ? new Date(body.endUtc) : null;
  if (!label || !startUtc || !endUtc || Number.isNaN(startUtc.getTime()) || Number.isNaN(endUtc.getTime())) {
    return NextResponse.json({ error: "label, startUtc, endUtc required" }, { status: 400 });
  }
  if (endUtc <= startUtc) {
    return NextResponse.json({ error: "endUtc must be after startUtc" }, { status: 400 });
  }
  const w = await prisma.locationWindow.create({
    data: {
      label,
      address: body.address?.trim() || null,
      startUtc,
      endUtc,
    },
  });
  return NextResponse.json({
    id: w.id,
    label: w.label,
    address: w.address,
    startUtc: w.startUtc.toISOString(),
    endUtc: w.endUtc.toISOString(),
  });
}
