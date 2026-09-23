"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";

import { SPRING_SURFACE } from "@/lib/motion";

/**
 * A grid or list whose items animate when a filter changes what is in it
 * (§0.7): leaving cards shrink away, new ones grow in, and the rest slide to
 * their new places instead of jumping.
 *
 * The first render does not animate through Motion — the items take the CSS
 * `.reveal` stagger instead, which runs on the server-rendered HTML before
 * any script — so a page never waits for hydration to show its cards.
 *
 * Children must be keyed; each becomes one `<li>`.
 */
function AnimatedList({
  className,
  itemClassName = "flex min-w-0 flex-col",
  children,
}: {
  className?: string;
  itemClassName?: string;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children).filter(React.isValidElement);

  return (
    <ul className={className}>
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((child, index) => (
          <motion.li
            key={child.key}
            layout
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={SPRING_SURFACE}
            className={`reveal ${itemClassName}`}
            style={{ "--i": index } as React.CSSProperties}
          >
            {child}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

/** Stagger index for a `.reveal` element outside an AnimatedList. */
function revealAt(index: number): React.CSSProperties {
  return { "--i": index } as React.CSSProperties;
}

export { AnimatedList, revealAt };
