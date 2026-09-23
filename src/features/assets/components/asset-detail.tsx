import { Archive } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-body text-muted-foreground">{label}</dt>
      <dd className="text-body font-medium">{children}</dd>
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

      <Card variant="ink" padding="large" className="gap-2">
        <span className="flex items-center gap-3 text-body text-ink-surface-muted">
          <Icon className="size-[18px]" />
          ارزش فعلی
        </span>
        <Money
          rial={asset.currentValue}
          className="text-h1 sm:text-display"
          unit={false}
        />
        <span className="text-caption text-ink-surface-subtle">تومان</span>
        <ProfitLoss
          rial={asset.profitLoss}
          ratio={asset.returnRatio}
          className="mt-2"
          surface="ink"
        />
      </Card>

      <AssetActions asset={asset} />

      <Card variant="featured">
        <dl>
          <Field label="نوع دارایی">{ASSET_TYPE_LABELS[asset.type]}</Field>
          <Field label="مالک">
            <OwnerBadge owner={asset.owner} />
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
