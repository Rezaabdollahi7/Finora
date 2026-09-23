import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { accountFiltersSchema } from "@/features/accounts/schemas";
import { listAccounts } from "@/features/accounts/server/account-service";
import { listCategoryTree } from "@/features/categories/server/category-service";
import { getRecurringPayment } from "@/features/recurring/server/recurring-service";
import { cadenceLabel } from "@/features/recurring/components/recurring-card";
import { RecurringDetail } from "@/features/recurring/components/recurring-detail";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const payment = await getRecurringPayment(id);

  return { title: payment?.name ?? "پرداخت دوره‌ای" };
}

export default async function RecurringDetailPage({ params }: Props) {
  const { id } = await params;
  const now = new Date();

  const [payment, accounts, categories] = await Promise.all([
    getRecurringPayment(id, now),
    listAccounts(accountFiltersSchema.parse({})),
    listCategoryTree({ includeArchived: false }),
  ]);

  if (!payment) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={payment.name}
        description={cadenceLabel(payment)}
        actions={
          <Button variant="ghost" asChild>
            <Link href="/recurring">
              {/* The arrow points the way "back" goes in RTL: to the right. */}
              <ArrowRight />
              همه پرداخت‌ها
            </Link>
          </Button>
        }
      />
      <RecurringDetail
        payment={payment}
        accounts={accounts}
        categories={categories}
        now={now}
      />
    </div>
  );
}
