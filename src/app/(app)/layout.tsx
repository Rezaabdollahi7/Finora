import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";

/**
 * Shell shared by every application section.
 *
 * The sidebar is the first child of the row, so it lands on the inline start
 * (the right in Persian) with no direction-specific positioning at all.
 *
 * Page padding follows the design system §12: 16px on mobile, 24px on tablet,
 * 32px on desktop.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        <MobileTabBar />
      </div>
    </div>
  );
}
