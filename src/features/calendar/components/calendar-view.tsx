"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/common/money";
import { addJalaliMonths, jalaliMonthGrid, jalaliMonthLabel } from "@/utils/date";
import { DayPanel } from "@/features/calendar/components/day-panel";
import { MonthGrid } from "@/features/calendar/components/month-grid";
import type { CalendarMonth } from "@/features/calendar/types";

/**
 * The financial calendar (tasks 4.6–4.8).
 *
 * Stepping a month fetches only that month rather than reloading the page,
 * because paging through a calendar is something people do quickly and a
 * full navigation per step feels broken. The grid itself is computed on the
 * client from the same pure function the server would use, so only the
 * events travel.
 *
 * The arrows point the way the months go in RTL: the previous month is to
 * the right of the next one.
 */
export function CalendarView({
  initial,
  nowIso,
}: {
  initial: CalendarMonth;
  /** The server's "now", so today's marker matches the rendered statuses. */
  nowIso: string;
}) {
  const now = React.useMemo(() => new Date(nowIso), [nowIso]);
  const [month, setMonth] = React.useState({
    year: initial.year,
    month: initial.month,
  });
  const [selected, setSelected] = React.useState<string | null>(null);

  /*
   * Months are cached rather than swapped into one piece of state.
   *
   * The obvious shape — a `data` state that an effect overwrites on every
   * month change — means setting state synchronously inside an effect, which
   * cascades an extra render and which React's compiler rejects outright.
   * A cache keyed by month lets the rendered month be *derived*: the effect
   * only fetches what is missing, and stepping back to a month already seen
   * is instant.
   */
  const key = (value: { year: number; month: number }) =>
    `${value.year}-${value.month}`;

  const [cache, setCache] = React.useState<Record<string, CalendarMonth>>({
    [key(initial)]: initial,
  });

  const data = cache[key(month)];
  const loading = data === undefined;

  React.useEffect(() => {
    const cacheKey = key(month);
    if (cache[cacheKey]) return;

    const controller = new AbortController();

    fetch(`/api/calendar?year=${month.year}&month=${month.month}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { month?: CalendarMonth } | null) => {
        if (payload?.month) {
          setCache((current) => ({ ...current, [cacheKey]: payload.month! }));
        }
      })
      .catch(() => null);

    return () => {
      controller.abort();
    };
  }, [month, cache]);

  const weeks = React.useMemo(() => jalaliMonthGrid(month, now), [month, now]);

  // The selected day defaults to today when today is in view, and to the
  // first of the month otherwise — a calendar with nothing selected has an
  // empty panel beside it for no reason.
  const selectedIso =
    selected ??
    weeks
      .flat()
      .find((day) => day.isToday && day.inMonth)
      ?.instant.toISOString() ??
    weeks
      .flat()
      .find((day) => day.inMonth)!
      .instant.toISOString();

  const step = (delta: number) => {
    setMonth((current) => addJalaliMonths(current, delta));
    setSelected(null);
  };

  const isCurrentMonth = month.year === initial.year && month.month === initial.month;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card variant="featured" className="reveal gap-6 p-6 lg:col-span-3">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>{jalaliMonthLabel(month)}</CardTitle>
            <CardDescription>
              {loading ? "در حال بارگذاری…" : "سررسید اقساط و پرداخت‌های این ماه"}
            </CardDescription>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {/* Right arrow steps back: that is the way the past lies in RTL. */}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="ماه قبل"
              onClick={() => {
                step(-1);
              }}
            >
              <ChevronRight />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isCurrentMonth}
              onClick={() => {
                setMonth({ year: initial.year, month: initial.month });
                setSelected(null);
              }}
            >
              امروز
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="ماه بعد"
              onClick={() => {
                step(1);
              }}
            >
              <ChevronLeft />
            </Button>
          </div>
        </CardHeader>

        <MonthGrid
          weeks={weeks}
          days={data?.days ?? {}}
          selected={selectedIso}
          onSelect={setSelected}
        />

        <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border pt-4 text-caption">
          <span className="text-muted-foreground">مجموع این ماه</span>
          {loading ? (
            <Skeleton className="h-5 w-32" />
          ) : (
            <Money rial={data?.total ?? "0"} className="font-medium" />
          )}
        </div>
      </Card>

      <div className="reveal lg:col-span-2" style={{ "--i": 1 } as React.CSSProperties}>
        <DayPanel date={new Date(selectedIso)} day={data?.days[selectedIso]} />
      </div>
    </div>
  );
}
