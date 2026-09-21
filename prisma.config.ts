import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma 7 no longer reads env() from schema.prisma, and does not load
    // .env by itself — hence the dotenv import above.
    url: process.env["DATABASE_URL"],
  },
});
