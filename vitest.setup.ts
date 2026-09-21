/**
 * Next.js loads .env by itself; Vitest does not. Integration tests need
 * DATABASE_URL, so load it the same way prisma.config.ts does.
 */
import "dotenv/config";
