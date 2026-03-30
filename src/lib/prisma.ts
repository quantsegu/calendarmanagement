import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL?.trim();
  // During builds (Docker/CI), `DATABASE_URL` may be missing; we still need a valid
  // adapter instance so PrismaClient construction doesn't throw.
  // Actual queries will still require a real Postgres connection at runtime.
  const safeDbUrl =
    dbUrl || "postgresql://postgres:postgres@localhost:5432/postgres?schema=public";
  return new PrismaClient({
    adapter: new PrismaPg(safeDbUrl),
  });
}

function prismaClientIsCurrent(client: PrismaClient): boolean {
  return (
    typeof (client as unknown as { manualCalendarItem?: { findMany?: unknown } }).manualCalendarItem?.findMany ===
    "function"
  );
}

function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && prismaClientIsCurrent(existing)) {
    return existing;
  }
  const created = createPrismaClient();
  globalForPrisma.prisma = created;
  return created;
}

export const prisma = getPrisma();
