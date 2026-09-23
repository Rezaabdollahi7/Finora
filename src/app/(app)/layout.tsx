import { cookies } from "next/headers";

import { AmbientBackground } from "@/components/layout/ambient-background";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileDock } from "@/components/layout/mobile-dock";
import { SIDEBAR_COOKIE, isSidebarCollapsed } from "@/components/layout/sidebar-state";

/**
 * Shell shared by every application section.
 *
 * The ambient light sits behind everything; the sidebar is the first child
 * of the row, so it lands on the inline start (the right in Persian) with no
 * direction-specific positioning at all. The sidebar's collapsed state is
 * read from its cookie here, so the server renders it at the right width.
 *
 * Page padding follows the design system §12: 16px on mobile, 24px on
 * tablet, 32px on desktop. Below `lg` the bottom padding clears the floating
 * dock, so the last card on a page is never hidden behind it.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const collapsed = isSidebarCollapsed(cookieStore.get(SIDEBAR_COOKIE)?.value);

  return (
    <div className="relative flex min-h-dvh">
      <AmbientBackground />
      <AppSidebar defaultCollapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 px-4 pt-6 pb-32 sm:px-6 lg:px-8 lg:pt-8 lg:pb-10">
          {children}
        </main>
        <MobileDock />
      </div>
    </div>
  );
}
