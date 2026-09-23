import { describe, expect, it } from "vitest";

import { readQueryCount } from "@/lib/prisma";
import { absoluteJalaliMonth, jalaliMonthOf } from "@/utils/date";
import { getReports } from "@/features/reports/server/report-service";
import { getNotifications } from "@/features/notifications/server/notification-service";
import { getHouseholdMonth } from "@/features/household/server/household-service";
import { getForecast } from "@/features/forecast/server/forecast-service";
import { reportFiltersSchema } from "@/features/reports/schemas";

/**
 * Task 8.17: the aggregate reads must not scale with the range.
 *
 * Each of these is measured twice — once over a short window and once over a
 * long one — and the assertion is that the query count does not move. A
 * report that ran one query per month would pass every correctness test and
 * still be unusable at two years.
 */

const NOW = new Date();
const MONTH = absoluteJalaliMonth(jalaliMonthOf(NOW));

async function count(run: () => Promise<unknown>): Promise<number> {
  const before = readQueryCount();
  await run();
  return readQueryCount() - before;
}

describe("the aggregate reads are flat in the size of the window", () => {
  it("a report costs the same over 24 months as over 1", async () => {
    const short = await count(() =>
      getReports(reportFiltersSchema.parse({ fromMonth: MONTH, toMonth: MONTH }), NOW),
    );
    const long = await count(() =>
      getReports(
        reportFiltersSchema.parse({ fromMonth: MONTH - 23, toMonth: MONTH }),
        NOW,
      ),
    );

    expect(long).toBe(short);
  });

  it("a forecast costs the same over 12 months as over 1", async () => {
    const short = await count(() => getForecast(1, NOW));
    const long = await count(() => getForecast(12, NOW));

    expect(long).toBe(short);
  });
});

describe("the aggregate reads are bounded", () => {
  it("the household month is a fixed handful of queries", async () => {
    expect(await count(() => getHouseholdMonth(MONTH, NOW))).toBeLessThanOrEqual(20);
  });

  it("the notification centre is a fixed handful of queries", async () => {
    expect(await count(() => getNotifications(NOW))).toBeLessThanOrEqual(30);
  });

  it("a report is a fixed handful of queries", async () => {
    expect(
      await count(() =>
        getReports(
          reportFiltersSchema.parse({ fromMonth: MONTH - 5, toMonth: MONTH }),
          NOW,
        ),
      ),
    ).toBeLessThanOrEqual(25);
  });
});
