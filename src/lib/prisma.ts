import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client singleton.
 *
 * Prisma 7 talks to PostgreSQL through a driver adapter rather than a bundled
 * native query engine, so the adapter is constructed here and owns the
 * connection pool.
 *
 * Next.js clears the module registry on every hot reload in development, so
 * creating the client at module scope would open a fresh pool on each edit
 * until PostgreSQL refuses further connections. Caching it on globalThis
 * survives the reload; in production the module is evaluated once and the
 * cache is skipped.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env["DATABASE_URL"];

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env before starting the application.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
