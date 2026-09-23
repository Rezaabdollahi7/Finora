import "server-only";

import type { MemberModel } from "@/generated/prisma/models";
import { AppRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { CreateMemberInput, UpdateMemberInput } from "@/features/members/schemas";
import { SHARED_OWNER, type MemberDto, type Owner } from "@/features/members/types";

/**
 * Household members: who they are, and the integrity of every `owner`.
 *
 * `owner` is a text column holding "SHARED" or a member id (see the Member
 * model), so the database cannot enforce that it points at somebody. This
 * file does, from both ends: every write that sets an owner goes through
 * {@link assertOwner}, and a member who still owns anything cannot be
 * deleted.
 */

/** Bounded by the size of a family; nobody pages through their relatives. */
const MAX_MEMBERS = 12;

function toDto(member: MemberModel): MemberDto {
  return {
    id: member.id,
    name: member.name,
    createdAt: member.createdAt.toISOString(),
  };
}

export async function listMembers(): Promise<MemberDto[]> {
  const members = await prisma.member.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return members.map(toDto);
}

export async function createMember(input: CreateMemberInput): Promise<MemberDto> {
  const count = await prisma.member.count();

  if (count >= MAX_MEMBERS) {
    throw new ConflictError(
      `حداکثر ${MAX_MEMBERS.toLocaleString("fa-IR")} عضو می‌توان اضافه کرد.`,
      "MEMBER_LIMIT",
    );
  }

  await assertNameFree(input.name);

  return toDto(await prisma.member.create({ data: { name: input.name } }));
}

export async function updateMember(
  id: string,
  input: UpdateMemberInput,
): Promise<MemberDto> {
  await findOrThrow(id);
  await assertNameFree(input.name, id);

  return toDto(
    await prisma.member.update({ where: { id }, data: { name: input.name } }),
  );
}

/**
 * Remove a member who owns nothing.
 *
 * A member with records is refused rather than cascaded: deleting a person
 * must not delete their transactions (rule G.4), and quietly moving them to
 * the household would rewrite whose money it was. Renaming is always
 * possible, and is almost always what was meant.
 */
export async function deleteMember(id: string): Promise<void> {
  await findOrThrow(id);

  const owned = await countOwnedRecords(id);

  if (owned > 0) {
    throw new ConflictError(
      "این عضو هنوز حساب، تراکنش یا رکورد دیگری دارد و حذف نمی‌شود. می‌توانید نامش را تغییر دهید.",
      "MEMBER_IN_USE",
    );
  }

  await prisma.member.delete({ where: { id } });
}

/** How many records anywhere name this member as their owner. */
export async function countOwnedRecords(id: string): Promise<number> {
  const where = { owner: id };
  const counts = await Promise.all([
    prisma.account.count({ where }),
    prisma.transaction.count({ where }),
    prisma.asset.count({ where }),
    prisma.loan.count({ where }),
    prisma.recurringPayment.count({ where }),
    prisma.budget.count({ where }),
    prisma.goal.count({ where }),
  ]);

  return counts.reduce((sum, count) => sum + count, 0);
}

/**
 * Refuse an owner that is neither the household nor a member.
 *
 * Called by every service before it writes an `owner`, so a hand-written
 * request cannot file money under somebody who does not exist.
 */
export async function assertOwner(owner: Owner): Promise<void> {
  if (owner === SHARED_OWNER) return;

  const member = await prisma.member.findUnique({
    where: { id: owner },
    select: { id: true },
  });

  if (!member) {
    throw new AppRuleError("این عضو خانوار پیدا نشد.", "UNKNOWN_OWNER", 422);
  }
}

async function findOrThrow(id: string): Promise<MemberModel> {
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member) throw new NotFoundError("عضو پیدا نشد.");
  return member;
}

/** Two people with one name would be indistinguishable in every picker. */
async function assertNameFree(name: string, exceptId?: string): Promise<void> {
  const clash = await prisma.member.findFirst({
    where: { name, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });

  if (clash) {
    throw new ConflictError("عضوی با این نام وجود دارد.", "MEMBER_NAME_TAKEN");
  }
}
