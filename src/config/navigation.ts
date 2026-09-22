import {
  ArrowLeftRight,
  CalendarDays,
  ChartColumn,
  Gem,
  Landmark,
  LayoutDashboard,
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
    href: "/goals",
    label: "اهداف",
    description: "اهداف مالی و پیشرفت آن‌ها",
    icon: Target,
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
    href: "/settings",
    label: "تنظیمات",
    description: "تنظیمات برنامه و ترجیحات نمایش",
    icon: Settings,
  },
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
