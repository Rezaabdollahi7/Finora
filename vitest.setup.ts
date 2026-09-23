/**
 * Next.js loads .env by itself; Vitest does not. Integration tests need
 * DATABASE_URL, so load it the same way prisma.config.ts does.
 */
import "dotenv/config";

/**
 * Make the Prisma client count its queries, so the dashboard performance
 * tests can assert the number of round trips instead of trusting a comment.
 */
process.env["PRISMA_QUERY_COUNTER"] = "1";
