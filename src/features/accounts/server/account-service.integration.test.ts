import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppRuleError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { resetLedger } from "@test/reset";
import {
  archiveAccount,
  createAccount,
  getAccount,
  listAccounts,
  restoreAccount,
  updateAccount,
} from "@/features/accounts/server/account-service";
import {
  accountFiltersSchema,
  createAccountSchema,
  updateAccountSchema,
} from "@/features/accounts/schemas";

/**
 * Exercised against a real PostgreSQL database rather than a mock: the rules
 * being tested here are partly enforced by the schema, and a mocked client
 * would happily accept things the database would reject.
 */

const defaults = accountFiltersSchema.parse({});

async function makeAccount(overrides: Partial<Record<string, unknown>> = {}) {
  return createAccount(
    createAccountSchema.parse({
      name: "حساب آزمایشی",
      type: "BANK",
      owner: "SHARED",
      initialBalance: "0",
      ...overrides,
    }),
  );
}

/** Transactions reference accounts, so they have to go first. */
async function clearLedger() {
  await resetLedger();
}

beforeEach(clearLedger);
afterEach(clearLedger);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createAccount", () => {
  it("stores the opening balance as Rial, converted from the Toman the user typed", async () => {
    const account = await makeAccount({ initialBalance: "125,400,000" });

    expect(account.initialBalance).toBe("1254000000");

    const row = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    expect(row.initialBalance).toBe(1_254_000_000n);
  });

  it("accepts Persian digits in the amount", async () => {
    const account = await makeAccount({ initialBalance: "۱۲۵٬۴۰۰" });
    expect(account.initialBalance).toBe("1254000");
  });

  it("defaults to an active IRR account with a zero balance", async () => {
    const account = await createAccount(
      createAccountSchema.parse({ name: "نقد", type: "CASH", owner: "REZA" }),
    );

    expect(account).toMatchObject({
      currency: "IRR",
      initialBalance: "0",
      balance: "0",
      transactionCount: 0,
      isActive: true,
    });
  });

  it("allows a negative opening balance, for an account already overdrawn", async () => {
    const account = await makeAccount({ initialBalance: "-500,000" });
    expect(account.initialBalance).toBe("-5000000");
  });

  it("trims the name", async () => {
    const account = await makeAccount({ name: "  بانک ملت  " });
    expect(account.name).toBe("بانک ملت");
  });

  it("rejects an empty name, an unknown type and an unreadable amount", async () => {
    expect(() =>
      createAccountSchema.parse({ name: "   ", type: "BANK", owner: "REZA" }),
    ).toThrow();
    expect(() =>
      createAccountSchema.parse({ name: "x", type: "CRYPTO", owner: "REZA" }),
    ).toThrow();
    expect(() =>
      createAccountSchema.parse({
        name: "x",
        type: "BANK",
        owner: "REZA",
        initialBalance: "abc",
      }),
    ).toThrow();
  });

  it("rejects a currency other than IRR, rather than storing a total it cannot add up", async () => {
    expect(() =>
      createAccountSchema.parse({
        name: "x",
        type: "BANK",
        owner: "REZA",
        currency: "USD",
      }),
    ).toThrow();
  });
});

describe("balance", () => {
  it("equals the opening balance while no transactions exist", async () => {
    const account = await makeAccount({ initialBalance: "42,850,000" });

    expect(account.balance).toBe(account.initialBalance);
    expect(account.balance).toBe("428500000");
  });

  it("stays exact at magnitudes a float would round", async () => {
    // 900,719,925,474,099.3 Toman is MAX_SAFE_INTEGER + 2 Rial.
    const account = await makeAccount({ initialBalance: "900719925474099.3" });

    expect(account.balance).toBe("9007199254740993");
    expect(BigInt(account.balance)).toBe(9_007_199_254_740_993n);
  });
});

describe("listAccounts", () => {
  it("hides archived accounts unless asked for them", async () => {
    const kept = await makeAccount({ name: "فعال" });
    const gone = await makeAccount({ name: "بایگانی" });
    await archiveAccount(gone.id);

    const active = await listAccounts(defaults);
    expect(active.map((a) => a.id)).toEqual([kept.id]);

    const all = await listAccounts(
      accountFiltersSchema.parse({ includeArchived: true }),
    );
    expect(all.map((a) => a.id).sort()).toEqual([kept.id, gone.id].sort());
  });

  it('treats the string "false" as false, not as a truthy string', async () => {
    const gone = await makeAccount();
    await archiveAccount(gone.id);

    const filters = accountFiltersSchema.parse({ includeArchived: "false" });
    expect(filters.includeArchived).toBe(false);
    expect(await listAccounts(filters)).toHaveLength(0);
  });

  it("filters by owner and by type", async () => {
    const reza = await makeAccount({ name: "رضا", owner: "REZA", type: "BANK" });
    await makeAccount({ name: "یگانه", owner: "YEGANEH", type: "CASH" });

    const byOwner = await listAccounts(accountFiltersSchema.parse({ owner: "REZA" }));
    expect(byOwner.map((a) => a.id)).toEqual([reza.id]);

    const byType = await listAccounts(accountFiltersSchema.parse({ type: "CASH" }));
    expect(byType.map((a) => a.name)).toEqual(["یگانه"]);
  });

  it("orders active accounts above archived ones", async () => {
    const older = await makeAccount({ name: "قدیمی" });
    await archiveAccount(older.id);
    const newer = await makeAccount({ name: "جدید" });

    const all = await listAccounts(
      accountFiltersSchema.parse({ includeArchived: true }),
    );
    expect(all.map((a) => a.name)).toEqual(["جدید", "قدیمی"]);
    void newer;
  });
});

describe("getAccount", () => {
  it("returns null for an unknown id instead of throwing", async () => {
    expect(await getAccount("does-not-exist")).toBeNull();
  });

  it("returns an archived account, so its history stays reachable", async () => {
    const account = await makeAccount();
    await archiveAccount(account.id);

    expect(await getAccount(account.id)).toMatchObject({ isActive: false });
  });
});

describe("updateAccount", () => {
  it("applies a partial change and leaves the rest alone", async () => {
    const account = await makeAccount({ name: "قبلی", initialBalance: "1,000" });
    const updated = await updateAccount(
      account.id,
      updateAccountSchema.parse({ name: "بعدی" }),
    );

    expect(updated.name).toBe("بعدی");
    expect(updated.initialBalance).toBe(account.initialBalance);
    expect(updated.type).toBe(account.type);
  });

  it("converts an edited opening balance from Toman to Rial", async () => {
    const account = await makeAccount();
    const updated = await updateAccount(
      account.id,
      updateAccountSchema.parse({ initialBalance: "2,500" }),
    );

    expect(updated.initialBalance).toBe("25000");
  });

  it("rejects an empty update", () => {
    expect(() => updateAccountSchema.parse({})).toThrow();
  });

  it("refuses to edit an archived account", async () => {
    const account = await makeAccount();
    await archiveAccount(account.id);

    await expect(
      updateAccount(account.id, updateAccountSchema.parse({ name: "x" })),
    ).rejects.toMatchObject({ code: "ACCOUNT_ARCHIVED", status: 409 });
  });

  it("reports a missing account as 404, not 500", async () => {
    await expect(
      updateAccount("nope", updateAccountSchema.parse({ name: "x" })),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("archive and restore", () => {
  it("archives instead of deleting, so the row survives", async () => {
    const account = await makeAccount();
    const archived = await archiveAccount(account.id);

    expect(archived.isActive).toBe(false);
    expect(
      await prisma.account.findUnique({ where: { id: account.id } }),
    ).not.toBeNull();
  });

  it("round-trips through restore", async () => {
    const account = await makeAccount();
    await archiveAccount(account.id);

    expect((await restoreAccount(account.id)).isActive).toBe(true);
  });

  it("rejects archiving twice and restoring an active account", async () => {
    const account = await makeAccount();
    await archiveAccount(account.id);

    await expect(archiveAccount(account.id)).rejects.toBeInstanceOf(AppRuleError);
    await restoreAccount(account.id);
    await expect(restoreAccount(account.id)).rejects.toMatchObject({
      code: "ALREADY_ACTIVE",
    });
  });

  it("preserves the balance across archive and restore", async () => {
    const account = await makeAccount({ initialBalance: "7,000" });

    expect((await archiveAccount(account.id)).balance).toBe("70000");
    expect((await restoreAccount(account.id)).balance).toBe("70000");
  });
});
