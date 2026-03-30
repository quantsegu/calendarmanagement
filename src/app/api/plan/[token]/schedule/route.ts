import { NextResponse } from "next/server";
import { getSchedulePayload, validateShareToken } from "@/lib/schedule-data";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const valid = await validateShareToken(token);
  if (!valid) {
    return NextResponse.json({ error: "Invalid or expired planner link" }, { status: 404 });
  }

  const url = new URL(req.url);
  const fromQ = url.searchParams.get("from");
  const toQ = url.searchParams.get("to");
  const now = new Date();
  const rangeStart = fromQ ? new Date(fromQ) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rangeEnd = toQ
    ? new Date(toQ)
    : new Date(rangeStart.getTime() + 14 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeEnd <= rangeStart) {
    return NextResponse.json({ error: "Invalid from/to range" }, { status: 400 });
  }

  try {
    const payload = await getSchedulePayload(rangeStart, rangeEnd);
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[api/plan/.../schedule]", e);
    const message = e instanceof Error ? e.message : "Schedule failed";
    return NextResponse.json(
      {
        error: "Could not load schedule",
        detail: message,
        hint:
          message.includes("no such table") || message.includes("ManualCalendarItem")
            ? "Run: npx prisma migrate dev"
            : undefined,
      },
      { status: 500 },
    );
  }
}
