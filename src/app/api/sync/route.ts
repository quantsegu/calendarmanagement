import { NextResponse } from "next/server";
import { syncAllSources } from "@/lib/calendar-sync";

export const runtime = "nodejs";

export async function POST() {
  const results = await syncAllSources();
  return NextResponse.json({ results });
}
