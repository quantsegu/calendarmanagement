import { NextResponse } from "next/server";
import { syncCalendarSource } from "@/lib/calendar-sync";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const { imported } = await syncCalendarSource(id);
    return NextResponse.json({ ok: true, imported });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
