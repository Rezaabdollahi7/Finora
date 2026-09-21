import { Brand } from "@/components/layout/brand";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

/**
 * Application header.
 *
 * Sticky, so the theme switcher and account menu stay reachable while a long
 * transaction list scrolls. The brand only appears below `lg`, where the
 * sidebar that normally carries it is hidden.
 */
function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <MobileNav />
          <Brand className="lg:hidden" showTagline={false} />
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

export { AppHeader };
