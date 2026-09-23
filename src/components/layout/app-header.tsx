import { cn } from "@/lib/utils";
import { formatJalaliDate } from "@/utils/date";
import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { greetingForHour, hourInZone } from "@/components/layout/greeting";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { getNotifications } from "@/features/notifications/server/notification-service";

/**
 * Application header: a floating glass bar rather than a ruled strip.
 *
 * Sticky, so the notification bell, theme switcher and account menu stay
 * reachable while a long transaction list scrolls; it is the one surface
 * besides the sidebar and dock that blurs what passes beneath it. On a
 * desktop the inline start greets the household with today's Jalali date;
 * below `lg`, where the sidebar that carries it is hidden, it carries the
 * brand instead.
 *
 * The notifications are read here rather than in the bell so the badge is
 * right on first paint. The App Router keeps a layout between navigations,
 * so this is one read per full load, not one per page.
 */
async function AppHeader() {
  const notifications = await getNotifications();
  const now = new Date();

  return (
    <header className="sticky top-0 z-30 px-4 pt-3 sm:px-6 lg:px-8 lg:pt-4">
      <div
        className={cn(
          "flex h-16 items-center justify-between gap-4 rounded-full ps-3 pe-2.5 sm:ps-5",
          "border border-card-edge bg-glass glass-edge backdrop-blur-xl dark:border-border",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Brand className="lg:hidden" showTagline={false} />
          <div className="hidden min-w-0 flex-col lg:flex">
            <span className="truncate text-body-lg font-medium">
              {greetingForHour(hourInZone(now))}
            </span>
            <span className="truncate text-caption text-muted-foreground">
              امروز {formatJalaliDate(now, { style: "full" })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <NotificationBell initial={notifications} />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

export { AppHeader };
