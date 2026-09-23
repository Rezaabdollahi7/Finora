"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import {
  LayoutGroup,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

import { cn } from "@/lib/utils";
import { SPRING_PILL } from "@/lib/motion";
import {
  dockHrefs,
  findNavItem,
  mainNavigation,
  type NavItem,
} from "@/config/navigation";
import { MobileNav } from "@/components/layout/mobile-nav";

/**
 * The phone and tablet dock.
 *
 * A floating glass pill above the home indicator: the four sections a
 * household reaches for daily, and a fifth button that opens every other
 * section as a bottom sheet (rule G.10). Each target is 56px tall, well past
 * the 44px minimum of §46.
 *
 * The active section wears the same sliding gradient pill as the sidebar.
 * With a pointer — a tablet with a trackpad — the icons also magnify toward
 * the cursor like a desktop dock; that runs on motion values outside
 * React's render cycle, and touch never triggers it.
 */
function MobileDock() {
  const pathname = usePathname();
  const active = findNavItem(pathname);
  const pointerX = useMotionValue(Number.POSITIVE_INFINITY);

  const items = dockHrefs
    .map((href) => mainNavigation.find((item) => item.href === href))
    .filter((item): item is NavItem => item !== undefined);
  const activeInDock = items.some((item) => item.href === active?.href);

  return (
    <nav
      aria-label="پیمایش سریع"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 lg:hidden",
        // Keep the dock clear of the home indicator on iOS.
        "pb-[calc(env(safe-area-inset-bottom)+12px)]",
      )}
    >
      <LayoutGroup id="dock">
        <ul
          onPointerMove={(event) => {
            if (event.pointerType === "mouse") pointerX.set(event.clientX);
          }}
          onPointerLeave={() => {
            pointerX.set(Number.POSITIVE_INFINITY);
          }}
          className={cn(
            "grid w-full max-w-md grid-cols-5 gap-1 rounded-full p-1.5",
            "border border-card-edge bg-glass shadow-floating backdrop-blur-xl dark:border-border",
          )}
        >
          {items.map((item) => (
            <li key={item.href}>
              <DockLink
                item={item}
                active={active?.href === item.href}
                pointerX={pointerX}
              />
            </li>
          ))}
          <li>
            <MobileNav>
              <DockButton active={!activeInDock} pointerX={pointerX} />
            </MobileNav>
          </li>
        </ul>
      </LayoutGroup>
    </nav>
  );
}

const itemClass = (active: boolean) =>
  cn(
    "relative isolate flex h-14 w-full flex-col items-center justify-center gap-1 rounded-full",
    "text-caption leading-none font-medium transition-colors duration-150 active:scale-95",
    active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
  );

function ActivePill() {
  return (
    <motion.span
      layoutId="dock-pill"
      aria-hidden
      transition={SPRING_PILL}
      className="absolute inset-0 -z-10 rounded-full bg-(image:--gradient-brand) shadow-glow"
    />
  );
}

/** Scale an icon by how close the pointer is to it. */
function useMagnify(
  ref: React.RefObject<HTMLElement | null>,
  pointerX: MotionValue<number>,
) {
  const distance = useTransform(pointerX, (x) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !Number.isFinite(x)) return Number.POSITIVE_INFINITY;
    return x - (box.left + box.width / 2);
  });
  const target = useTransform(distance, [-120, 0, 120], [1, 1.3, 1], { clamp: true });

  return useSpring(target, { stiffness: 380, damping: 28 });
}

function DockLink({
  item,
  active,
  pointerX,
}: {
  item: NavItem;
  active: boolean;
  pointerX: MotionValue<number>;
}) {
  const ref = React.useRef<HTMLAnchorElement>(null);
  const scale = useMagnify(ref, pointerX);

  return (
    <Link
      ref={ref}
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={itemClass(active)}
    >
      {active ? <ActivePill /> : null}
      <motion.span style={{ scale }} className="origin-bottom">
        <item.icon aria-hidden className="size-5" />
      </motion.span>
      <span className="max-w-full truncate px-1">{item.label}</span>
    </Link>
  );
}

/**
 * The "more" button. Radix's trigger clones its child and passes the open
 * handler, ARIA state and its ref through these props, so they are
 * forwarded.
 */
function DockButton({
  active,
  pointerX,
  ref: forwardedRef,
  ...props
}: React.ComponentProps<"button"> & {
  active: boolean;
  pointerX: MotionValue<number>;
}) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const scale = useMagnify(ref, pointerX);

  // The trigger needs the element too, to return focus when the sheet closes.
  const setRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      ref.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  return (
    <button ref={setRef} type="button" className={itemClass(active)} {...props}>
      {active ? <ActivePill /> : null}
      <motion.span style={{ scale }} className="origin-bottom">
        <LayoutGrid aria-hidden className="size-5" />
      </motion.span>
      <span>بیشتر</span>
    </button>
  );
}

export { MobileDock };
