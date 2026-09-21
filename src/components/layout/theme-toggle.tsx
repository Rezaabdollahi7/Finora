"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

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

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="تغییر پوسته">
          {/*
            The server cannot know the resolved theme, so the icon is chosen
            by CSS from the .dark class next-themes writes onto <html> before
            hydration. Deciding it in an effect instead would either flash the
            wrong icon or trip React's rule against setState-in-effect.
          */}
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
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
              setTheme(option.value);
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
