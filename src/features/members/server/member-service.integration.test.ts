import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { resetLedger } from "@test/reset";
import { createAccountSchema } from "@/features/accounts/schemas";
import {
  createAccount,
  updateAccount,
} from "@/features/accounts/server/account-service";
import {
  assertOwner,
  countOwnedRecords,
  createMember,
  deleteMember,
  listMembers,
  updateMember,
} from "@/features/members/server/member-service";

beforeEach(async () => {
  await resetLedger();
  // These suites are about the members table itself, so start from nobody
  // rather than the fixtures' two people.
  await prisma.member.deleteMany();
});

afterAll(async () => {
  await resetLedger();
  await prisma.$disconnect();
});

describe("members", () => {
  it("starts with nobody: no name is built in", async () => {
    expect(await listMembers()).toEqual([]);
  });

  it("adds people under the names the household chooses, in order", async () => {
    await createMember({ name: "سارا" });
    await createMember({ name: "امید" });

    expect((await listMembers()).map((member) => member.name)).toEqual([
      "سارا",
      "امید",
    ]);
  });

  it("refuses two people with the same name", async () => {
    await createMember({ name: "سارا" });

    await expect(createMember({ name: "سارا" })).rejects.toMatchObject({
      code: "MEMBER_NAME_TAKEN",
    });
  });

  it("renames without touching what the person owns", async () => {
    const member = await createMember({ name: "سارا" });
    const account = await createAccount(
      createAccountSchema.parse({ name: "ملی", type: "BANK", owner: member.id }),
    );

    await updateMember(member.id, { name: "سارا جان" });

    expect((await listMembers())[0]!.name).toBe("سارا جان");
    expect(
      (await prisma.account.findUnique({ where: { id: account.id } }))!.owner,
    ).toBe(member.id);
  });

  it("deletes a member who owns nothing", async () => {
    const member = await createMember({ name: "سارا" });

    await deleteMember(member.id);

    expect(await listMembers()).toEqual([]);
  });

  it("refuses to delete a member who still owns records", async () => {
    const member = await createMember({ name: "سارا" });
    await createAccount(
      createAccountSchema.parse({ name: "ملی", type: "BANK", owner: member.id }),
    );

    expect(await countOwnedRecords(member.id)).toBe(1);
    await expect(deleteMember(member.id)).rejects.toMatchObject({
      code: "MEMBER_IN_USE",
    });
    expect(await listMembers()).toHaveLength(1);
  });
});

describe("assertOwner", () => {
  it("accepts the household and any member", async () => {
    const member = await createMember({ name: "سارا" });

    await expect(assertOwner("SHARED")).resolves.toBeUndefined();
    await expect(assertOwner(member.id)).resolves.toBeUndefined();
  });

  it("refuses an owner who is nobody, on create and on update", async () => {
    await expect(assertOwner("GHOST")).rejects.toMatchObject({ code: "UNKNOWN_OWNER" });

    await expect(
      createAccount(
        createAccountSchema.parse({ name: "ملی", type: "BANK", owner: "GHOST" }),
      ),
    ).rejects.toMatchObject({ code: "UNKNOWN_OWNER", status: 422 });

    const account = await createAccount(
      createAccountSchema.parse({ name: "ملی", type: "BANK", owner: "SHARED" }),
    );
    await expect(updateAccount(account.id, { owner: "GHOST" })).rejects.toMatchObject({
      code: "UNKNOWN_OWNER",
    });
  });
});
