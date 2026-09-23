import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Money } from "@/components/common/money";
import { sumRial } from "@/utils/money";
import { BUDGET_ALERT_KINDS } from "@/features/budgets/tracking";
import { BUDGET_ALERT_STYLE } from "@/features/budgets/format";
import type { BudgetAlertDto } from "@/features/budgets/types";
import type { BudgetAlertKind } from "@/features/budgets/tracking";

/**
 * This month's alerts (task 5.10).
 *
 * One block per kind, not per category. A household that is over on four
 * budgets does not need four warnings: every card below already carries its
 * own state, and stacking a full-width alert for each pushed the budgets
 * themselves off the first screen — which is the opposite of what an alert
 * is for.
 *
 * So each kind names its categories on one line and gives the total, and the
 * cards carry the detail. The cash shortfall stays its own block because it
 * belongs to no category and has no card to fall back to.
 */
export function BudgetAlerts({ alerts }: { alerts: BudgetAlertDto[] }) {
  if (alerts.length === 0) return null;

  const byKind = BUDGET_ALERT_KINDS.map((kind) => ({
    kind,
    items: alerts.filter((alert) => alert.kind === kind),
  })).filter((group) => group.items.length > 0);

  return (
    <ul className="space-y-3">
      {byKind.map(({ kind, items }) => {
        const style = BUDGET_ALERT_STYLE[kind];
        const Icon = style.icon;
        const total = sumRial(items.map((item) => BigInt(item.amount))).toString();

        return (
          <li key={kind}>
            <Alert variant={style.tone}>
              <Icon />
              <AlertTitle>{title(kind, items)}</AlertTitle>
              <AlertDescription>
                {/*
                  Each part is its own element: a neutral separator between
                  Persian text and a number is reordered by the bidi
                  algorithm.
                */}
                <span className="flex flex-wrap items-baseline gap-2">
                  <span>{lead(kind, items.length)}</span>
                  <Money rial={total} className="font-medium" />
                </span>
              </AlertDescription>
            </Alert>
          </li>
        );
      })}
    </ul>
  );
}

/** The categories in a group, or the household for a shortfall. */
function title(kind: BudgetAlertKind, items: BudgetAlertDto[]): string {
  const names = items.map((item) => item.categoryName).join("، ");

  switch (kind) {
    case "NEAR_LIMIT":
      return items.length === 1
        ? `${names} به سقف بودجه نزدیک شده است`
        : `${names} به سقف بودجه نزدیک شده‌اند`;
    case "OVER_BUDGET":
      return items.length === 1
        ? `${names} از بودجه عبور کرده است`
        : `${names} از بودجه عبور کرده‌اند`;
    case "CASH_SHORTFALL":
      return "موجودی حساب‌ها کفاف پرداخت‌های این ماه را نمی‌دهد";
  }
}

/** What the figure beside the sentence means. */
function lead(kind: BudgetAlertKind, count: number): string {
  switch (kind) {
    case "NEAR_LIMIT":
      return count === 1 ? "باقی‌مانده تا پایان ماه" : "مجموع باقی‌مانده";
    case "OVER_BUDGET":
      return count === 1 ? "مبلغ بیش از بودجه" : "مجموع مبلغ بیش از بودجه";
    case "CASH_SHORTFALL":
      return "کسری";
  }
}
