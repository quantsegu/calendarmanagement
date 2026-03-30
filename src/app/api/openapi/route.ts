import { NextResponse } from "next/server";
import openApiBase from "@/lib/openapi.json";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const doc = {
    ...(openApiBase as Record<string, unknown>),
    servers: [{ url: origin, description: "This deployment" }],
  };
  return NextResponse.json(doc);
}
