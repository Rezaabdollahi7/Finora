import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client";
import type { CategoryKind } from "../src/generated/prisma/enums";

/**
 * Seed the default category tree (task 1.7).
 *
 * Idempotent: every category is matched on its name within its parent, so
 * running the seed twice changes nothing and running it against a database
 * that already has transactions cannot orphan them.
 *
 *   npm run db:seed
 */

type Child = { name: string; icon: string };
type Root = { name: string; kind: CategoryKind; icon: string; children: Child[] };

const CATEGORIES: Root[] = [
  {
    name: "خوراک",
    kind: "EXPENSE",
    icon: "food",
    children: [
      { name: "خواربار", icon: "groceries" },
      { name: "رستوران", icon: "restaurant" },
      { name: "فست‌فود", icon: "fastfood" },
    ],
  },
  {
    name: "حمل‌ونقل",
    kind: "EXPENSE",
    icon: "transport",
    children: [
      { name: "سوخت", icon: "fuel" },
      { name: "تاکسی", icon: "taxi" },
      { name: "تعمیرات", icon: "maintenance" },
    ],
  },
  {
    name: "مسکن",
    kind: "EXPENSE",
    icon: "housing",
    children: [
      { name: "اجاره", icon: "rent" },
      { name: "برق", icon: "electricity" },
      { name: "آب", icon: "water" },
      { name: "گاز", icon: "gas" },
    ],
  },
  {
    // Added in Sprint 4. Paying a loan instalment creates an expense, and
    // without a category for it every repayment would land in "بدون دسته"
    // and the expense breakdown would say the household spent nothing on
    // debt.
    name: "وام و اقساط",
    kind: "EXPENSE",
    icon: "loan",
    children: [
      { name: "قسط وام", icon: "installment" },
      { name: "کارمزد و دیرکرد", icon: "bill" },
    ],
  },
  {
    name: "شخصی",
    kind: "EXPENSE",
    icon: "personal",
    children: [
      { name: "پوشاک", icon: "clothing" },
      { name: "سرگرمی", icon: "entertainment" },
      { name: "سایر", icon: "other" },
    ],
  },
  {
    name: "کسب‌وکار",
    kind: "EXPENSE",
    icon: "business",
    children: [
      { name: "سرور", icon: "server" },
      { name: "نرم‌افزار", icon: "software" },
      { name: "تبلیغات", icon: "advertising" },
      { name: "سایر", icon: "other" },
    ],
  },
  {
    name: "درآمد",
    kind: "INCOME",
    icon: "salary",
    children: [
      { name: "حقوق", icon: "salary" },
      { name: "پروژه", icon: "business" },
      { name: "سرمایه‌گذاری", icon: "investment" },
      { name: "سایر", icon: "other" },
    ],
  },
];

const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  let created = 0;
  let kept = 0;

  for (const [rootIndex, root] of CATEGORIES.entries()) {
    const existingRoot = await prisma.category.findFirst({
      where: { name: root.name, kind: root.kind, parentId: null },
    });

    const parent =
      existingRoot ??
      (await prisma.category.create({
        data: {
          name: root.name,
          kind: root.kind,
          icon: root.icon,
          sortOrder: rootIndex,
        },
      }));

    if (existingRoot) {
      kept += 1;
    } else {
      created += 1;
    }

    for (const [childIndex, child] of root.children.entries()) {
      const existingChild = await prisma.category.findFirst({
        where: { name: child.name, parentId: parent.id },
      });

      if (existingChild) {
        kept += 1;
        continue;
      }

      await prisma.category.create({
        data: {
          name: child.name,
          kind: root.kind,
          parentId: parent.id,
          icon: child.icon,
          sortOrder: childIndex,
        },
      });
      created += 1;
    }
  }

  console.log(`Categories seeded: ${created} created, ${kept} already present.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
