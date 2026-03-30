import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function makeToken() {
  return randomBytes(24).toString("base64url");
}

export async function GET() {
  const links = await prisma.shareLink.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(links);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { label?: string };
  const link = await prisma.shareLink.create({
    data: {
      token: makeToken(),
      label: body.label?.trim() || null,
    },
  });
  return NextResponse.json(link);
}
