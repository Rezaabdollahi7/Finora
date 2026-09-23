import {
  ArrowLeftRight,
  BookOpen,
  CalendarDays,
  ChartColumn,
  Gem,
  TrendingUp,
  Landmark,
  LayoutDashboard,
  Users,
  Repeat,
  PiggyBank,
  Settings,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  /** Route path. Also the key used to match the active item. */
  href: string;
  /** Persian label shown in navigation. */
  label: string;
  /** Sentence shown as the page description under the title. */
  description: string;
  icon: LucideIcon;
};

/**
 * The application's primary sections, in the order they appear in the
 * sidebar and the mobile navigation.
 *
 * This is the single source of truth for navigation: the sidebar, the mobile
 * bar and each page's header all read from it, so a route cannot exist in one
 * place and be missing from another.
 */
export const mainNavigation: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "داشبورد",
    description: "نمای کلی وضعیت مالی شما",
    icon: LayoutDashboard,
  },
  {
    href: "/accounts",
    label: "حساب‌ها",
    description: "حساب‌های بانکی، نقد و کیف پول",
    icon: Wallet,
  },
  {
    href: "/transactions",
    label: "تراکنش‌ها",
    description: "درآمدها، هزینه‌ها و انتقال‌ها",
    icon: ArrowLeftRight,
  },
  {
    href: "/assets",
    label: "دارایی‌ها",
    description: "طلا، ارز، خودرو و سرمایه‌گذاری‌ها",
    icon: Gem,
  },
  {
    href: "/loans",
    label: "وام‌ها",
    description: "وام‌ها، اقساط و تاریخچه پرداخت",
    icon: Landmark,
  },
  {
    href: "/recurring",
    label: "پرداخت‌های دوره‌ای",
    description: "اجاره، اشتراک‌ها و قبض‌های تکرارشونده",
    icon: Repeat,
  },
  {
    href: "/budgets",
    label: "بودجه‌ها",
    description: "بودجه ماهانه و پیشرفت هر دسته",
    icon: PiggyBank,
  },
  {
    href: "/household",
    label: "خانواده",
    description: "درآمد، خرج و سهم هر نفر در خانه",
    icon: Users,
  },
  {
    href: "/goals",
    label: "اهداف",
    description: "اهداف مالی و پیشرفت آن‌ها",
    icon: Target,
  },
  {
    href: "/forecast",
    label: "پیش‌بینی",
    description: "جریان نقدی ماه‌های پیش‌رو و هشدار کسری",
    icon: TrendingUp,
  },
  {
    href: "/calendar",
    label: "تقویم",
    description: "رویدادهای مالی در تقویم شمسی",
    icon: CalendarDays,
  },
  {
    href: "/reports",
    label: "گزارش‌ها",
    description: "گزارش درآمد، هزینه، بدهی و ارزش خالص",
    icon: ChartColumn,
  },
  {
    href: "/guide",
    label: "راهنما",
    description: "امکانات برنامه و اینکه از کجا شروع کنید",
    icon: BookOpen,
  },
  {
    href: "/settings",
    label: "تنظیمات",
    description: "تنظیمات برنامه و ترجیحات نمایش",
    icon: Settings,
  },
] as const;

/**
 * The sidebar's grouping of {@link mainNavigation}: what a household checks
 * daily, what it owns and owes, what it plans, and the household itself.
 *
 * Groups hold hrefs rather than copies of the items, so the list above stays
 * the single source of truth; a test checks that every item appears in
 * exactly one group, so a new route cannot go missing from the sidebar.
 */
export const navigationGroups: readonly { label: string; hrefs: readonly string[] }[] =
  [
    {
      label: "روزانه",
      hrefs: ["/dashboard", "/transactions", "/accounts", "/calendar"],
    },
    { label: "دارایی و بدهی", hrefs: ["/assets", "/loans", "/recurring"] },
    { label: "برنامه‌ریزی", hrefs: ["/budgets", "/goals", "/forecast", "/reports"] },
    { label: "خانه", hrefs: ["/household", "/settings", "/guide"] },
  ] as const;

/** {@link navigationGroups} resolved to their items, in order. */
export function groupedNavigation(): { label: string; items: NavItem[] }[] {
  return navigationGroups.map((group) => ({
    label: group.label,
    items: group.hrefs
      .map((href) => mainNavigation.find((item) => item.href === href))
      .filter((item): item is NavItem => item !== undefined),
  }));
}

/**
 * The four sections the phone dock carries; everything else is one tap away
 * behind its "more" button.
 */
export const dockHrefs = [
  "/dashboard",
  "/transactions",
  "/accounts",
  "/calendar",
] as const;

/**
 * Resolve the navigation entry for a pathname.
 *
 * Matches nested routes too, so /accounts/<id> still highlights "حساب‌ها",
 * while keeping /accounts distinct from a hypothetical /accounts-archive.
 */
export function findNavItem(pathname: string): NavItem | undefined {
  return mainNavigation.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

/**
 * Same as {@link findNavItem} but throws when nothing matches.
 *
 * Page files call this at module scope, so a route that exists on disk
 * without an entry here fails the build rather than rendering a page with no
 * title. That is what keeps this file honest as the single source of truth.
 */
export function requireNavItem(href: string): NavItem {
  const item = findNavItem(href);

  if (!item) {
    throw new Error(
      `No navigation entry for "${href}". Add it to mainNavigation in src/config/navigation.ts.`,
    );
  }

  return item;
}
