"use client";

import { cn } from "@/lib/utils";
import { compactToman } from "@/components/charts/chart-primitives";
import { JALALI_WEEKDAYS, type JalaliCalendarDay } from "@/utils/date";
import { toPersianDigits } from "@/utils/digits";
import type { CalendarDayEvents } from "@/features/calendar/types";

/**
 * A Jalali month as a grid (task 4.6).
 *
 * Saturday first, because the Persian week does. The grid itself needs no
 * direction handling: it sits inside the page's RTL flow, so the first
 * column lands on the right on its own — which is what rule G.6 means by
 * designing for RTL rather than flipping afterwards.
 *
 * A day with something owed carries a dot and, where there is room, the
 * amount. The dot is what makes the month scannable at arm's length; the
 * amount is what makes it useful once you are looking. On a phone only the
 * dot survives, because a five-figure sum in a 44px cell is unreadable.
 */
export function MonthGrid({
  weeks,
  days,
  selected,
  onSelect,
}: {
  weeks: JalaliCalendarDay[][];
  /** Keyed by each day's midnight-Tehran instant. */
  days: Record<string, CalendarDayEvents>;
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-2">
        {JALALI_WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="text-center text-caption font-medium text-muted-foreground"
          >
            {/* Two letters on a phone: "شنبه" and "چهارشنبه" cannot both fit. */}
            <span className="sm:hidden">{weekday.slice(0, 1)}</span>
            <span className="hidden sm:inline">{weekday}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => {
          const iso = day.instant.toISOString();
          const entry = days[iso];
          const owed = entry ? BigInt(entry.unpaidTotal) : 0n;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => {
                onSelect(iso);
              }}
              aria-pressed={selected === iso}
              aria-label={`${toPersianDigits(day.date.day)} ${JALALI_WEEKDAYS[day.weekday]}${entry ? ` — ${toPersianDigits(entry.events.length)} پرداخت` : ""}`}
              className={cn(
                "flex min-h-14 flex-col items-center gap-1 rounded-md border border-transparent p-1.5",
                "transition-colors duration-150 ease-out sm:min-h-20 sm:items-start sm:p-2",
                "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                !day.inMonth && "opacity-40",
                day.isWeekend && day.inMonth && "bg-muted/40",
                day.isToday && "border-primary",
                selected === iso && "bg-primary-soft",
              )}
            >
              <span
                className={cn(
                  "tabular flex size-6 items-center justify-center rounded-full text-caption",
                  day.isToday && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {toPersianDigits(day.date.day)}
              </span>

              {entry ? (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full sm:hidden",
                      owed > 0n ? "bg-danger" : "bg-success",
                    )}
                  />
                  <span
                    className={cn(
                      "tabular hidden w-full truncate text-start text-caption sm:block",
                      owed > 0n ? "text-danger" : "text-success",
                    )}
                    dir="ltr"
                  >
                    {compactToman(entry.total)}
                  </span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
