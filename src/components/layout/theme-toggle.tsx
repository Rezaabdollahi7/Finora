"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { DURATION, EASE_EMPHASIZED } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const options = [
  { value: "light", label: "روشن", icon: Sun },
  { value: "dark", label: "تیره", icon: Moon },
  { value: "system", label: "سیستم", icon: Monitor },
] as const;

type ThemeChoice = (typeof options)[number]["value"];

function resolve(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Theme switcher (§0.7).
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
  const { theme, setTheme } = useTheme();
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  function apply(choice: ThemeChoice) {
    const root = document.documentElement;
    const resolved = resolve(choice);

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="glass"
          size="icon-lg"
          aria-label="تغییر پوسته"
          className="relative overflow-hidden"
        >
          {/*
            The server cannot know the resolved theme, so the icon is chosen
            by CSS from the .dark class next-themes writes onto <html> before
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
      </DropdownMenuTrigger>
      {/*
        Radix only mounts the content once opened, which is always after
        hydration, so reading `theme` here cannot cause a mismatch.
      */}
      <DropdownMenuContent align="end" className="min-w-40">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => {
              // One frame for the menu to close, so the snapshot the reveal
              // grows over is the page, not the open menu.
              requestAnimationFrame(() => {
                choose(option.value);
              });
            }}
            className={
              theme === option.value
                ? "bg-primary-soft text-accent-foreground"
                : undefined
            }
          >
            <option.icon />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ThemeToggle };
