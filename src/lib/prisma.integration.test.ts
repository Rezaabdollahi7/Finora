import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";

/**
 * Proves the whole data path really works: the generated client connects to
 * PostgreSQL, the migrated table exists, and a row survives a write/read
 * round trip. Requires DATABASE_URL to point at a migrated database.
 */
describe("prisma client", () => {
  const key = `sprint0-check-${Date.now()}`;

  afterAll(async () => {
    await prisma.appSetting.deleteMany({ where: { key } });
    await prisma.$disconnect();
  });

  it("connects to the database", async () => {
    const rows = await prisma.$queryRaw<[{ ok: number }]>`SELECT 1 AS ok`;
    expect(rows[0]?.ok).toBe(1);
  });

  it("writes and reads a row through the migrated schema", async () => {
    const created = await prisma.appSetting.create({
      data: { key, value: "ok" },
    });
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeInstanceOf(Date);

    const found = await prisma.appSetting.findUnique({ where: { key } });
    expect(found?.value).toBe("ok");
  });

  it("enforces the unique constraint on key", async () => {
    await expect(
      prisma.appSetting.create({ data: { key, value: "dup" } }),
    ).rejects.toThrow();
  });
});
