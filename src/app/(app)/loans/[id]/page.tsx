import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { accountFiltersSchema } from "@/features/accounts/schemas";
import { listAccounts } from "@/features/accounts/server/account-service";
import { listCategoryTree } from "@/features/categories/server/category-service";
import { getLoan } from "@/features/loans/server/loan-service";
import { LoanDetail } from "@/features/loans/components/loan-detail";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const loan = await getLoan(id);

  return { title: loan?.name ?? "وام" };
}

export default async function LoanDetailPage({ params }: Props) {
  const { id } = await params;
  const now = new Date();

  const [loan, accounts, categories] = await Promise.all([
    getLoan(id, now),
    listAccounts(accountFiltersSchema.parse({})),
    listCategoryTree({ includeArchived: false }),
  ]);

  if (!loan) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={loan.name}
        description={loan.provider}
        actions={
          <Button variant="ghost" asChild>
            <Link href="/loans">
              {/* The arrow points the way "back" goes in RTL: to the right. */}
              <ArrowRight />
              همه وام‌ها
            </Link>
          </Button>
        }
      />
      <LoanDetail loan={loan} accounts={accounts} categories={categories} now={now} />
    </div>
  );
}
