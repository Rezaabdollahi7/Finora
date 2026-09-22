"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CircleAlert, PartyPopper, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Money } from "@/components/common/money";
import { formatJalaliDate } from "@/utils/date";
import type {
  Notification,
  NotificationSeverity,
} from "@/features/notifications/notifications";

const SEVERITY_STYLE: Record<
  NotificationSeverity,
  { icon: typeof Bell; className: string; label: string }
> = {
  CRITICAL: { icon: TriangleAlert, className: "text-danger", label: "فوری" },
  WARNING: { icon: CircleAlert, className: "text-warning", label: "هشدار" },
  INFO: { icon: PartyPopper, className: "text-success", label: "خبر خوب" },
};

type Payload = {
  notifications: Notification[];
  counts: Record<NotificationSeverity, number>;
};

/**
 * The notification centre (task 8.11).
 *
 * The first payload arrives as a prop from the layout, which is a server
 * component: the badge is then correct on first paint with no flash, and
 * `router.refresh()` after paying an instalment updates it without a reload.
 * The App Router keeps the layout between navigations, so this is one read
 * per full load rather than one per page.
 *
 * Opening it re-fetches, because nothing here is stored — "what should I be
 * told" is only ever true at the moment it is asked, and a list opened ten
 * minutes into a session should not be ten minutes stale.
 */
export function NotificationBell({ initial }: { initial: Payload }) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [fetched, setFetched] = React.useState<Payload | null>(null);
  const [seen, setSeen] = React.useState(initial);

  /*
    Adjusting state while rendering, rather than syncing it in an effect.
    The prop is the truth until the popover is opened; once the layout sends
    a newer one — which `router.refresh()` does after paying an instalment —
    whatever was fetched is stale and goes. An effect here would re-render
    twice for the same result, and the React Compiler rejects it outright.
  */
  if (seen !== initial) {
    setSeen(initial);
    setFetched(null);
  }

  const payload = fetched ?? initial;

  async function load() {
    setPending(true);

    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;

      setFetched((await response.json()) as Payload);
    } catch {
      // A notification list that cannot refresh is not worth an error
      // dialog; the bell keeps showing what it last knew.
    } finally {
      setPending(false);
    }
  }

  const urgent = payload.counts.CRITICAL + payload.counts.WARNING;
  const total = payload.notifications.length;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            total === 0 ? "اعلان‌ها" : `اعلان‌ها، ${total.toLocaleString("fa-IR")} مورد`
          }
        >
          <Bell />
          {urgent > 0 ? (
            <span
              className={cn(
                "absolute end-1.5 top-1.5 size-2 rounded-full",
                payload.counts.CRITICAL > 0 ? "bg-danger" : "bg-warning",
              )}
              aria-hidden
            />
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="text-body font-semibold">
            اعلان‌ها
            {pending ? (
              <span className="ms-2 text-caption font-normal text-muted-foreground">
                در حال به‌روزرسانی…
              </span>
            ) : null}
          </span>
          {total > 0 ? (
            <span className="tabular text-caption text-muted-foreground">
              {total.toLocaleString("fa-IR")} مورد
            </span>
          ) : null}
        </div>

        {total === 0 ? (
          <p className="px-4 py-8 text-center text-body text-muted-foreground">
            چیزی برای اطلاع نیست. همه‌چیز مرتب است.
          </p>
        ) : (
          <ul className="max-h-[60dvh] divide-y divide-border overflow-y-auto">
            {payload.notifications.map((notification) => {
              const style = SEVERITY_STYLE[notification.severity];
              const Icon = style.icon;

              return (
                <li key={notification.id}>
                  <Link
                    href={notification.href}
                    className="flex gap-3 px-4 py-3 transition-colors hover:bg-primary-subtle"
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    <Icon className={cn("mt-0.5 size-4 shrink-0", style.className)} />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-body">{notification.title}</span>
                      <span className="flex flex-wrap items-baseline gap-2 text-caption text-muted-foreground">
                        {/* The severity in words, for a reader who cannot
                            separate the icon's colours (§59.3). */}
                        <span className={style.className}>{style.label}</span>
                        {notification.amount ? (
                          <Money rial={notification.amount} />
                        ) : null}
                        {notification.date ? (
                          <span>
                            {formatJalaliDate(new Date(notification.date), {
                              style: "medium",
                            })}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
