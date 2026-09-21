import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { ASSET_TYPE_LABELS } from "@/features/assets/types";
import { getAsset, listValuations } from "@/features/assets/server/asset-service";
import { AssetDetail } from "@/features/assets/components/asset-detail";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const asset = await getAsset(id);

  return { title: asset?.name ?? "دارایی" };
}

export default async function AssetDetailPage({ params }: Props) {
  const { id } = await params;
  const [asset, valuations] = await Promise.all([getAsset(id), listValuations(id)]);

  if (!asset) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={asset.name}
        description={ASSET_TYPE_LABELS[asset.type]}
        actions={
          <Button variant="ghost" asChild>
            <Link href="/assets">
              {/* The arrow points the way "back" goes in RTL: to the right. */}
              <ArrowRight />
              همه دارایی‌ها
            </Link>
          </Button>
        }
      />
      <AssetDetail asset={asset} valuations={valuations} />
    </div>
  );
}
