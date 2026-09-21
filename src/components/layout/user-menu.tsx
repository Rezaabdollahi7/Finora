"use client";

import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Account menu.
 *
 * Finora is a self-hosted household deployment with no authentication until
 * Sprint 8 (see docs/ARCHITECTURE.md), and household members arrive in Sprint
 * 7, so this is the menu shell: the trigger, the surface and the settings
 * link. Sign-out is disabled rather than absent, so the affordance exists
 * without pretending to work.
 */
function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="منوی کاربر">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-accent-foreground">
            <User className="size-4" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>خانوار</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            تنظیمات
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <LogOut />
          خروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { UserMenu };
