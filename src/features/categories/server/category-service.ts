import "server-only";

import type { CategoryModel } from "@/generated/prisma/models";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type {
  CategoryFilters,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/features/categories/schemas";
import type { CategoryDto, CategoryTreeNode } from "@/features/categories/types";

/**
 * Category data access and rules (task 1.7).
 *
 * Two rules the database cannot express on its own live here, because both
 * need to read the intended parent:
 *
 *   - the tree is at most two levels deep
 *   - a child has the same kind as its parent
 */

type WithParent = CategoryModel & {
  parent: Pick<CategoryModel, "name"> | null;
  _count: { transactions: number };
};

const withParent = {
  parent: { select: { name: true } },
  _count: { select: { transactions: true } },
} as const;

function toDto(category: WithParent): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    kind: category.kind,
    parentId: category.parentId,
    parentName: category.parent?.name ?? null,
    icon: category.icon,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    transactionCount: category._count.transactions,
  };
}

export async function listCategories(filters: CategoryFilters): Promise<CategoryDto[]> {
  const categories = await prisma.category.findMany({
    where: {
      ...(filters.includeArchived ? {} : { isActive: true }),
      ...(filters.kind ? { kind: filters.kind } : {}),
    },
    include: withParent,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return categories.map(toDto);
}

/** The same set, nested one level, which is how the UI renders it. */
export async function listCategoryTree(
  filters: CategoryFilters,
): Promise<CategoryTreeNode[]> {
  const categories = await listCategories(filters);
  const roots = categories.filter((category) => category.parentId === null);

  return roots.map((root) => ({
    ...root,
    children: categories.filter((category) => category.parentId === root.id),
  }));
}

export async function getCategory(id: string): Promise<CategoryDto | null> {
  const category = await prisma.category.findUnique({
    where: { id },
    include: withParent,
  });
  return category ? toDto(category) : null;
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryDto> {
  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });

    if (!parent) throw new NotFoundError("دسته والد پیدا نشد.");

    if (parent.parentId !== null) {
      throw new ConflictError(
        "دسته‌بندی فقط دو سطح دارد؛ نمی‌توان زیرِ یک زیردسته، دسته ساخت.",
        "CATEGORY_TOO_DEEP",
      );
    }

    if (parent.kind !== input.kind) {
      throw new ConflictError(
        "نوع زیردسته باید با دسته والد یکی باشد.",
        "CATEGORY_KIND_MISMATCH",
      );
    }

    if (!parent.isActive) {
      throw new ConflictError("دسته والد بایگانی شده است.", "CATEGORY_PARENT_ARCHIVED");
    }
  }

  const category = await prisma.category.create({
    data: {
      name: input.name,
      kind: input.kind,
      parentId: input.parentId,
      icon: input.icon,
      sortOrder: input.sortOrder,
    },
    include: withParent,
  });

  return toDto(category);
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<CategoryDto> {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("دسته پیدا نشد.");

  const category = await prisma.category.update({
    where: { id },
    data: input,
    include: withParent,
  });

  return toDto(category);
}

/**
 * Archive a category.
 *
 * Never deleted: transactions keep pointing at it, and the report that reads
 * them has to keep saying what they were (rule G.4). Archiving a parent
 * archives its children too, so a child cannot be offered under a parent that
 * is no longer on the list.
 */
export async function archiveCategory(id: string): Promise<CategoryDto> {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("دسته پیدا نشد.");

  if (!existing.isActive) {
    throw new ConflictError("این دسته از قبل بایگانی شده است.", "ALREADY_ARCHIVED");
  }

  const category = await prisma.$transaction(async (tx) => {
    if (existing.parentId === null) {
      await tx.category.updateMany({
        where: { parentId: id },
        data: { isActive: false },
      });
    }

    return tx.category.update({
      where: { id },
      data: { isActive: false },
      include: withParent,
    });
  });

  return toDto(category);
}

/** Restore a category. A child cannot come back while its parent is archived. */
export async function restoreCategory(id: string): Promise<CategoryDto> {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { parent: true },
  });

  if (!existing) throw new NotFoundError("دسته پیدا نشد.");

  if (existing.isActive) {
    throw new ConflictError("این دسته بایگانی نشده است.", "ALREADY_ACTIVE");
  }

  if (existing.parent && !existing.parent.isActive) {
    throw new ConflictError(
      "ابتدا دسته والد را از بایگانی خارج کنید.",
      "CATEGORY_PARENT_ARCHIVED",
    );
  }

  const category = await prisma.category.update({
    where: { id },
    data: { isActive: true },
    include: withParent,
  });

  return toDto(category);
}
