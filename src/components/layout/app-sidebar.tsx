import { Brand } from "@/components/layout/brand";
import { NavLinks } from "@/components/layout/nav-links";

/**
 * Desktop sidebar: a rounded, softly-filled navigation container rather than
 * a bordered rail (design system §26).
 *
 * It is the first child of the shell's flex row, so it sits on the inline
 * start — the right-hand side in Persian — without any direction-specific
 * positioning.
 */
function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 p-4 lg:block">
      <div className="flex h-full flex-col gap-8 rounded-xl bg-card p-4 shadow-sm">
        <Brand className="px-2 pt-2" />
        <NavLinks className="flex-1 overflow-y-auto" />
      </div>
    </aside>
  );
}

export { AppSidebar };
