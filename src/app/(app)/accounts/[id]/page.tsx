import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { ACCOUNT_TYPE_LABELS } from "@/features/accounts/types";
import { getAccount } from "@/features/accounts/server/account-service";
import { AccountDetail } from "@/features/accounts/components/account-detail";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const account = await getAccount(id);

  return { title: account?.name ?? "حساب" };
}

export default async function AccountDetailPage({ params }: Props) {
  const { id } = await params;
  const account = await getAccount(id);

  if (!account) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={account.name}
        description={ACCOUNT_TYPE_LABELS[account.type]}
        actions={
          <Button variant="ghost" asChild>
            <Link href="/accounts">
              {/* The arrow points the way "back" goes in RTL: to the right. */}
              <ArrowRight />
              همه حساب‌ها
            </Link>
          </Button>
        }
      />
      <AccountDetail account={account} />
    </div>
  );
}
