"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { DURATION, EASE_EMPHASIZED } from "@/lib/motion";
import { Button } from "@/components/ui/button";
type ThemeChoice = "light" | "dark";

/** The theme a click switches to: the opposite of what is on screen now. */
export function nextTheme(current: string | undefined): ThemeChoice {
  return current === "dark" ? "light" : "dark";
}

/**
 * Theme switcher (§0.7).
 *
 * One click, one change: light becomes dark and dark becomes light. Until
 * the first click the app follows the operating system (next-themes'
 * `system` default); a click pins the opposite of whatever is showing.
 *
 * The new theme grows out of the button as a circle until it covers the
 * screen. It is a view transition: the browser snapshots the page, the
 * theme class changes underneath, and the new snapshot is revealed through
 * an expanding clip-path — one compositor animation, however much of the
 * page changes colour.
 *
 * The class is written onto <html> inside the transition callback as well
 * as through next-themes, because next-themes applies it from an effect and
 * the snapshot must be taken after the change, not whenever React gets to
 * it. Without view-transition support, or with reduced motion, the theme
 * simply changes.
 */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  function apply(choice: ThemeChoice) {
    const root = document.documentElement;
    const resolved = choice;

    flushSync(() => {
      setTheme(choice);
    });
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.style.setProperty("color-scheme", resolved);
  }

  function choose(choice: ThemeChoice) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || typeof document.startViewTransition !== "function") {
      setTheme(choice);
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : 0;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transition = document.startViewTransition(() => {
      apply(choice);
    });

    void transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: DURATION.slow * 1000,
          easing: `cubic-bezier(${EASE_EMPHASIZED.join(",")})`,
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
  }

  return (
    <Button
      ref={triggerRef}
      variant="glass"
      size="icon-lg"
      aria-label="تغییر پوسته روشن و تیره"
      title="تغییر پوسته"
      className="relative overflow-hidden"
      onClick={() => {
        choose(nextTheme(resolvedTheme));
      }}
    >
      {/*
        The server cannot know the resolved theme, so the icon is chosen by
        CSS from the .dark class next-themes writes onto <html> before
        hydration. Both icons stay mounted and trade places with a turn,
        which the reveal then carries across the screen.
      */}
      <Sun
        className={cn(
          "transition-[rotate,scale,opacity] duration-500 ease-out",
          "dark:scale-0 dark:-rotate-90 dark:opacity-0",
        )}
      />
      <Moon
        className={cn(
          "absolute scale-0 rotate-90 opacity-0 transition-[rotate,scale,opacity] duration-500 ease-out",
          "dark:scale-100 dark:rotate-0 dark:opacity-100",
        )}
      />
    </Button>
  );
}

export { ThemeToggle };
