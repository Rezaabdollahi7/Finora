import { handleApiError } from "@/lib/api";
import { formatPercent } from "@/utils/number";
import { reportFiltersSchema } from "@/features/reports/schemas";
import { getReports } from "@/features/reports/server/report-service";
import { toCsvBundle, tomanCell, type CsvTable } from "@/features/reports/csv";
import type { BucketDto, ReportsDto } from "@/features/reports/types";

/**
 * GET /api/reports/export — the report on screen, as CSV (task 8.10).
 *
 * The same query string the page is reading, so "export what I am looking
 * at" is true rather than approximately true. One file with every section
 * rather than six downloads.
 *
 * CSV rather than a generated XLSX or PDF: the roadmap asks not to add a
 * dependency where the browser is enough, and between this and the print
 * stylesheet both other formats are one keystroke away in any spreadsheet or
 * browser.
 */

const percent = (ratio: number | null) =>
  ratio === null ? "—" : formatPercent(ratio, { digits: "latin", fractionDigits: 1 });

function bucketTable(name: string, buckets: BucketDto[]): CsvTable {
  return {
    name,
    headers: ["عنوان", "مبلغ (تومان)", "سهم"],
    rows: buckets.map((bucket) => [
      bucket.label,
      tomanCell(bucket.amount),
      percent(bucket.share),
    ]),
  };
}

function tablesFor(reports: ReportsDto): CsvTable[] {
  return [
    {
      name: `گزارش ${reports.from.label} تا ${reports.to.label}`,
      headers: [
        "ماه",
        "درآمد (تومان)",
        "هزینه (تومان)",
        "پس‌انداز (تومان)",
        "نرخ پس‌انداز",
        "بازپرداخت بدهی (تومان)",
        "سرمایه‌گذاری (تومان)",
        "ارزش خالص (تومان)",
      ],
      rows: reports.series.map((point) => [
        point.label,
        tomanCell(point.income),
        tomanCell(point.expenses),
        tomanCell(point.savings),
        percent(point.savingsRate),
        tomanCell(point.debtPayments),
        tomanCell(point.investments),
        tomanCell(point.netWorth),
      ]),
    },
    bucketTable("درآمد بر اساس مالک", reports.income.byOwner),
    bucketTable("درآمد بر اساس منبع", reports.income.byCategory),
    bucketTable("درآمد بر اساس حساب", reports.income.byAccount),
    bucketTable("هزینه بر اساس دسته", reports.expenses.byCategory),
    bucketTable("هزینه بر اساس مالک", reports.expenses.byOwner),
    bucketTable("هزینه بر اساس حساب", reports.expenses.byAccount),
    {
      name: "بدهی‌ها",
      headers: ["عنوان", "مبلغ (تومان)"],
      rows: [
        ["مبلغ وام‌ها", tomanCell(reports.debt.originalDebt)],
        ["بازپرداخت‌شده", tomanCell(reports.debt.paidDebt)],
        ["مانده بدهی", tomanCell(reports.debt.remainingDebt)],
        ["قسط ماهانه", tomanCell(reports.debt.monthlyBurden)],
      ],
    },
    {
      name: "دارایی‌ها",
      headers: ["عنوان", "مبلغ (تومان)"],
      rows: [
        ["ارزش کل", tomanCell(reports.assets.totalValue)],
        ["بهای خرید", tomanCell(reports.assets.totalCost)],
        ["سود/زیان", tomanCell(reports.assets.profitAndLoss)],
      ],
    },
    bucketTable("ترکیب دارایی‌ها", reports.assets.allocation),
    {
      name: "تحلیل دسته‌ها",
      headers: [
        "دسته",
        "مجموع بازه (تومان)",
        "سهم",
        "ماه قبل (تومان)",
        "تغییر",
        "بودجه (تومان)",
      ],
      rows: reports.categories.map((observation) => [
        observation.categoryName,
        tomanCell(observation.amount),
        percent(observation.share),
        tomanCell(observation.previous),
        observation.trend,
        observation.budget ? tomanCell(observation.budget) : "—",
      ]),
    },
  ];
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters = reportFiltersSchema.parse({
      fromMonth: params.get("from") ?? undefined,
      toMonth: params.get("to") ?? undefined,
      owner: params.get("owner") ?? undefined,
      accountId: params.get("accountId") ?? undefined,
      categoryId: params.get("categoryId") ?? undefined,
    });

    const reports = await getReports(filters);
    const csv = toCsvBundle(tablesFor(reports));

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        // An ASCII fallback plus the real Persian name: a browser that
        // cannot read RFC 5987 still gets a usable filename rather than
        // "download".
        "Content-Disposition": `attachment; filename="finora-report.csv"; filename*=UTF-8''${encodeURIComponent(
          `گزارش-${reports.from.label}-تا-${reports.to.label}.csv`,
        )}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
