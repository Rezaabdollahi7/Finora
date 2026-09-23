import { Archive } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { HeroCard } from "@/components/common/hero-card";
import { Money } from "@/components/common/money";
import { formatJalaliDate } from "@/utils/date";
import { formatQuantity } from "@/utils/quantity";
import { OwnerBadge } from "@/features/accounts/components/owner-badge";
import { ASSET_TYPE_ICONS } from "@/features/assets/format";
import { AssetActions } from "@/features/assets/components/asset-actions";
import { ProfitLoss } from "@/features/assets/components/profit-loss";
import { ValuationHistory } from "@/features/assets/components/valuation-history";
import {
  ASSET_TYPE_LABELS,
  type AssetDto,
  type AssetValuationDto,
} from "@/features/assets/types";

/**
 * One fact of the record as a small tile (§0.13), the same shape as
 * FactGrid's, kept local so the conditional rows above can stay inline.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted px-4 py-3">
      <dt className="truncate text-caption text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-body font-medium break-words">{children}</dd>
    </div>
  );
}

/** One asset in full: what it is worth, what it cost, and how it got here. */
export function AssetDetail({
  asset,
  valuations,
}: {
  asset: AssetDto;
  valuations: AssetValuationDto[];
}) {
  const Icon = ASSET_TYPE_ICONS[asset.type];
  const perUnit = asset.unit !== null;

  return (
    <div className="space-y-6">
      {!asset.isActive ? (
        <Alert variant="warning">
          <Archive />
          <AlertTitle>این دارایی بایگانی شده است</AlertTitle>
          <AlertDescription>
            تاریخچهٔ قیمت‌های آن حفظ شده است، اما در ارزش خالص و سبد دارایی‌ها شمرده
            نمی‌شود.
          </AlertDescription>
        </Alert>
      ) : null}

      <HeroCard label="ارزش فعلی" icon={Icon} value={asset.currentValue}>
        <ProfitLoss
          rial={asset.profitLoss}
          ratio={asset.returnRatio}
          className="mt-1"
          surface="ink"
        />
      </HeroCard>

      <AssetActions asset={asset} />

      <Card variant="featured" className="reveal gap-5 p-6">
        <h2 className="text-h4">مشخصات</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="نوع دارایی">{ASSET_TYPE_LABELS[asset.type]}</Field>
          <Field label="مالک">
            <OwnerBadge owner={asset.owner} always />
          </Field>
          {perUnit ? (
            <>
              <Field label="مقدار">
                {/*
                  The number is its own isolated run: a Latin numeral between
                  Persian words is reordered by the bidi algorithm, which puts
                  the unit before the figure.
                */}
                <span className="flex items-center gap-1">
                  <span className="tabular" dir="ltr">
                    {formatQuantity(BigInt(asset.quantity))}
                  </span>
                  <span>{asset.unit}</span>
                </span>
              </Field>
              <Field label="قیمت خرید هر واحد">
                <Money rial={asset.purchaseUnitPrice} />
              </Field>
              <Field label="قیمت فعلی هر واحد">
                <Money rial={asset.currentUnitPrice} />
              </Field>
            </>
          ) : null}
          <Field label={perUnit ? "بهای تمام‌شده" : "ارزش خرید"}>
            <Money rial={asset.purchaseTotal} />
          </Field>
          <Field label="تاریخ خرید">
            {formatJalaliDate(new Date(asset.purchaseDate))}
          </Field>
          <Field label="آخرین قیمت‌گذاری">
            {asset.lastValuedAt
              ? formatJalaliDate(new Date(asset.lastValuedAt))
              : "ثبت نشده"}
          </Field>
          {asset.notes ? <Field label="یادداشت">{asset.notes}</Field> : null}
        </dl>
      </Card>

      <ValuationHistory asset={asset} valuations={valuations} />
    </div>
  );
}
