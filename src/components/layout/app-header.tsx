import { Brand } from "@/components/layout/brand";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { getNotifications } from "@/features/notifications/server/notification-service";
import { UserMenu } from "@/components/layout/user-menu";

/**
 * Application header.
 *
 * Sticky, so the notification bell, theme switcher and account menu stay
 * reachable while a long transaction list scrolls. The brand only appears
 * below `lg`, where the sidebar that normally carries it is hidden.
 *
 * The notifications are read here rather than in the bell so the badge is
 * right on first paint. The App Router keeps a layout between navigations,
 * so this is one read per full load, not one per page.
 */
async function AppHeader() {
  const notifications = await getNotifications();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <MobileNav />
          <Brand className="lg:hidden" showTagline={false} />
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell initial={notifications} />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

export { AppHeader };
