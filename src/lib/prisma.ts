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

/*
 * Query counter.
 *
 * Off unless PRISMA_QUERY_COUNTER=1, so production pays nothing for it. It
 * exists so "the dashboard aggregates efficiently" (task 2.10) can be a
 * failing test rather than a claim in a comment: a test asserts the number
 * of round trips is bounded and does not grow with the number of months or
 * accounts, which is what an accidental N+1 would break.
 */
const countingEnabled = process.env["PRISMA_QUERY_COUNTER"] === "1";

let queryCount = 0;

export function readQueryCount(): number {
  return queryCount;
}

export function resetQueryCount(): void {
  queryCount = 0;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env["DATABASE_URL"];

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env before starting the application.",
    );
  }

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

  if (!countingEnabled) return client;

  // $extends returns a structurally different client; the extension only
  // counts and delegates, so the surface the application uses is unchanged.
  return client.$extends({
    query: {
      $allOperations({ query, args }) {
        queryCount += 1;
        return query(args);
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
