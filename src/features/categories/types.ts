import type { CategoryKind } from "@/generated/prisma/enums";

export type { CategoryKind };

export type CategoryDto = {
  id: string;
  name: string;
  kind: CategoryKind;
  parentId: string | null;
  parentName: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  /** How many transactions are filed under this category. */
  transactionCount: number;
};

/** A parent with its children, which is how the picker and the list render. */
export type CategoryTreeNode = CategoryDto & { children: CategoryDto[] };

export const CATEGORY_KINDS = [
  "INCOME",
  "EXPENSE",
] as const satisfies readonly CategoryKind[];

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  INCOME: "درآمد",
  EXPENSE: "هزینه",
};

/** The deepest a category tree may go: a parent groups, a child classifies. */
export const MAX_CATEGORY_DEPTH = 2;
