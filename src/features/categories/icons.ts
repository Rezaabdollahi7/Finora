import {
  Briefcase,
  Car,
  CircleDollarSign,
  Clapperboard,
  Cpu,
  Croissant,
  Droplet,
  Flame,
  Fuel,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  Landmark,
  Lightbulb,
  Megaphone,
  Plane,
  Receipt,
  Server,
  Shirt,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * The icons a category may use.
 *
 * A fixed map rather than a free-text icon name: the database stores a key,
 * and an unknown key falls back to a generic tag instead of crashing the
 * render. One icon library throughout (design system §47).
 */
export const CATEGORY_ICONS = {
  tag: Tag,
  food: UtensilsCrossed,
  groceries: ShoppingBasket,
  restaurant: UtensilsCrossed,
  fastfood: Croissant,
  transport: Car,
  fuel: Fuel,
  taxi: Car,
  maintenance: Wrench,
  housing: Home,
  rent: Home,
  electricity: Lightbulb,
  water: Droplet,
  gas: Flame,
  personal: Sparkles,
  clothing: Shirt,
  entertainment: Clapperboard,
  health: HeartPulse,
  education: GraduationCap,
  travel: Plane,
  phone: Smartphone,
  shopping: ShoppingCart,
  gift: Gift,
  business: Briefcase,
  server: Server,
  software: Cpu,
  advertising: Megaphone,
  salary: HandCoins,
  investment: Landmark,
  bill: Receipt,
  other: CircleDollarSign,
} as const satisfies Record<string, LucideIcon>;

export type CategoryIconKey = keyof typeof CATEGORY_ICONS;

// Typed as a non-empty tuple so z.enum can consume it directly.
export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS) as [
  CategoryIconKey,
  ...CategoryIconKey[],
];

/** Resolve a stored key, falling back to a generic tag for anything unknown. */
export function categoryIcon(key: string | null | undefined): LucideIcon {
  if (key && key in CATEGORY_ICONS) {
    return CATEGORY_ICONS[key as CategoryIconKey];
  }

  return CATEGORY_ICONS.tag;
}
