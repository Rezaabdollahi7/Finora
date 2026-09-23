"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Money } from "@/components/common/money";
import BalanceCanvas from "@/features/dashboard/components/balance-canvas";
import { CardLink } from "@/features/dashboard/components/bento";
import { DeltaChip } from "@/features/dashboard/components/delta-chip";

/**
 * The headline card: how much money the household has across its accounts
 * right now (task 2.2), over a 3D bank card that leans toward the pointer.
 *
 * The figure is plain DOM on top of the scene, so it is read, selected and
 * announced like any other text; the scene is decoration behind it. The
 * card tracks the pointer into a ref — never state — so moving the mouse
 * re-renders nothing.
 */
export function BalanceHero({
  balance,
  previous,
  className,
}: {
  balance: string;
  previous: string;
  className?: string;
}) {
  const pointer = React.useRef<{ x: number; y: number } | null>(null);

  return (
    <section
      aria-labelledby="balance-title"
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        pointer.current = {
          x: ((event.clientX - box.left) / box.width) * 2 - 1,
          y: ((event.clientY - box.top) / box.height) * 2 - 1,
        };
      }}
      onPointerLeave={() => {
        pointer.current = { x: 0, y: 0 };
      }}
      className={cn(
        "relative isolate flex min-h-104 flex-col overflow-hidden rounded-2xl",
        "bg-(image:--gradient-brand) text-primary-foreground shadow-floating",
        className,
      )}
    >
      {/* Soft light across the top of the gradient, so the pearl card has
          something to glow against. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-2/3 bg-radial-[at_50%_20%] from-primary-foreground/25 to-transparent to-70%"
      />

      <div className="flex items-start justify-between gap-4 p-6">
        <h2
          id="balance-title"
          className="inline-flex h-9 items-center rounded-full bg-primary-foreground/15 px-4 text-body font-medium backdrop-blur-sm"
        >
          موجودی کل
        </h2>
        <CardLink href="/accounts" label="همه حساب‌ها" />
      </div>

      <div className="relative -mt-4 min-h-56 flex-1">
        <BalanceCanvas pointer={pointer} className="absolute inset-0" />
      </div>

      <div className="flex flex-col gap-3 p-6 pt-0">
        <Money
          rial={balance}
          className="text-display font-light tracking-tight"
          unitClassName="text-primary-foreground/75"
        />
        <DeltaChip
          value={balance}
          previous={previous}
          goodWhen="up"
          onInk
          fallback="موجودی همه حساب‌های فعال، همین حالا"
        />
      </div>
    </section>
  );
}
