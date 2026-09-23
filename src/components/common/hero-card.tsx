import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Money } from "@/components/common/money";
import { LogoMark } from "@/components/layout/logo-mark";

/**
 * The headline card at the top of a section (docs/DESIGN_SYSTEM.md §0.13):
 * one figure the page is about, on the brand gradient, with the handful of
 * numbers that explain it beside it.
 *
 * It replaces the flat ink summary card every list and detail page used to
 * hand-roll, so the pages read as one family with the dashboard's balance
 * hero. Decoration is CSS only — a watermark of the section's icon, two soft
 * lights that drift, a sheen along the top — and stops under reduced motion.
 *
 * The card re-points the semantic tokens for everything inside it
 * (`.hero-surface` in globals.css): primary becomes white, danger and
 * success become their light steps, borders become white hairlines. A
 * progress bar or a profit figure dropped in as a child therefore reads on
 * blue without knowing it is on blue.
 */

export type HeroStat = {
  label: string;
  /** Rial, rendered as Toman. Omit and pass `content` for anything else. */
  rial?: string;
  content?: React.ReactNode;
  /** Danger styling for a figure that is bad news (overdue, over budget). */
  alert?: boolean;
};

function HeroCard({
  label,
  icon: Icon,
  value,
  negative = false,
  meta,
  stats,
  action,
  children,
  className,
}: {
  label: string;
  icon?: LucideIcon;
  /** The headline figure, in Rial. */
  value: string;
  /** Show the figure in the danger step, for a total that is a shortfall. */
  negative?: boolean;
  /** One line under the figure: a count, a cadence, a date. */
  meta?: React.ReactNode;
  stats?: HeroStat[];
  /** Top-end slot: a round link or a small button. */
  action?: React.ReactNode;
  /** Below the figure: a progress bar, a warning line. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "hero-surface reveal relative isolate overflow-hidden rounded-2xl p-6 sm:p-8",
        "bg-(image:--gradient-brand) text-on-brand shadow-floating",
        className,
      )}
    >
      {/* Decoration: two drifting lights, a sheen and a watermark. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <span className="hero-orb hero-orb-1" />
        <span className="hero-orb hero-orb-2" />
        <span className="absolute inset-x-0 top-0 h-px bg-linear-to-l from-transparent via-on-brand/60 to-transparent" />
        {Icon ? (
          <Icon
            className="absolute -end-10 -top-14 size-60 -rotate-12 text-on-brand/10"
            strokeWidth={1.25}
          />
        ) : (
          <LogoMark className="absolute -end-6 -top-16 h-64 w-auto -rotate-12 text-on-brand/10" />
        )}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="inline-flex h-9 w-fit items-center gap-2 rounded-full bg-on-brand/15 px-4 text-body font-medium">
              {Icon ? <Icon aria-hidden className="size-4" /> : null}
              {label}
            </h2>
            {action ? <div className="lg:hidden">{action}</div> : null}
          </div>
          {/*
            The figure steps down on a phone; at the display size a
            thirteen-digit total spills out of a 390px card.
          */}
          <Money
            rial={value}
            className={cn(
              "text-h1 font-light tracking-tight sm:text-display",
              negative && "text-danger",
            )}
            unitClassName="text-on-brand/70"
          />
          {meta ? (
            <div className="flex flex-wrap items-center gap-2 text-caption text-on-brand/75">
              {meta}
            </div>
          ) : null}
          {children}
        </div>

        {stats?.length || action ? (
          <div className="flex flex-col gap-3 lg:items-end">
            {action ? <div className="hidden lg:block">{action}</div> : null}
            {stats?.length ? (
              <ul
                className={cn(
                  "grid gap-2",
                  stats.length > 1 ? "grid-cols-2" : "grid-cols-1",
                  stats.length > 2 && "sm:grid-cols-3",
                  // An odd one out on a phone spans the row instead of
                  // sitting alone beside a gap.
                  "max-sm:[&>li:last-child:nth-child(odd)]:col-span-2",
                )}
              >
                {stats.map((stat) => (
                  <li
                    key={stat.label}
                    className={cn(
                      "flex min-w-0 flex-col gap-0.5 rounded-lg bg-on-brand/12 px-4 py-3",
                      "ring-1 ring-on-brand/15 ring-inset",
                      stat.alert && "bg-danger/20 ring-danger/40",
                    )}
                  >
                    <span className="truncate text-caption text-on-brand/70">
                      {stat.label}
                    </span>
                    {stat.rial !== undefined ? (
                      <Money
                        rial={stat.rial}
                        className={cn(
                          "truncate text-body-lg font-medium",
                          stat.alert && "text-danger",
                        )}
                        unit={false}
                      />
                    ) : (
                      <span className="truncate text-body-lg font-medium">
                        {stat.content}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export { HeroCard };
