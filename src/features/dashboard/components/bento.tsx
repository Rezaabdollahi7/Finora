"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

import { cn } from "@/lib/utils";
import { GSAP_EASE } from "@/lib/motion";
import { formatPercent } from "@/utils/number";

gsap.registerPlugin(useGSAP);

/**
 * The dashboard's bento grid and its entrance (docs/DESIGN_SYSTEM.md §0.9).
 *
 * The page arrives as a wave: cells rise and settle in reading order, then
 * the figures inside them draw — stacked bars grow from the inline start,
 * dials sweep, percentages count up. The motion says "this was just
 * computed for you" once, on load, and then the page holds still.
 *
 * Everything animated is found by data attribute inside this one GSAP
 * context, so the cards themselves stay server components and the context
 * reverts every tween when the grid unmounts:
 *
 *   data-bento-cell    a grid cell; rises into place
 *   data-grow          a bar segment; scales in from the inline start
 *   data-sweep         an SVG arc (pathLength = 1); draws in to its offset
 *   data-count         a percentage; counts up to its value (a ratio)
 *
 * Cells start hidden only where script runs and motion is welcome (the CSS
 * in globals.css keys off `scripting` and `prefers-reduced-motion`), so a
 * page without JavaScript, or for someone who asked for less motion, is
 * simply there.
 */
function BentoGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const scope = React.useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const cells = gsap.utils.toArray<HTMLElement>("[data-bento-cell]");
        const timeline = gsap.timeline({ defaults: { ease: GSAP_EASE } });

        timeline.fromTo(
          cells,
          // Opacity rather than autoAlpha: autoAlpha also sets `visibility`,
          // which the CSS failsafe cannot undo if the tween starts late.
          { opacity: 0, y: 36, scale: 0.97, transformPerspective: 900, rotateX: -8 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            rotateX: 0,
            duration: 1,
            stagger: { each: 0.07, grid: "auto", from: "start" },
            clearProps: "transform",
          },
        );

        const bars = gsap.utils.toArray<HTMLElement>("[data-grow]");
        const arcs = gsap.utils.toArray<SVGElement>("[data-sweep]");

        // Empty states render none of these; GSAP warns on an empty target.
        if (bars.length > 0)
          timeline.from(
            bars,
            {
              scaleX: 0,
              transformOrigin: "right center",
              duration: 1.1,
              stagger: 0.05,
              clearProps: "transform",
            },
            0.35,
          );

        // From empty to wherever the server drew the arc.
        if (arcs.length > 0) {
          timeline.from(
            arcs,
            { strokeDashoffset: 1, duration: 1.4, ease: "power3.out" },
            0.4,
          );
        }

        for (const element of gsap.utils.toArray<HTMLElement>("[data-count]")) {
          const target = Number(element.dataset["count"]);
          if (!Number.isFinite(target)) continue;

          const final = element.textContent;
          const counter = { value: 0 };
          timeline.to(
            counter,
            {
              value: target,
              duration: 1.3,
              ease: "power2.out",
              onUpdate: () => {
                element.textContent = formatPercent(counter.value, {
                  fractionDigits: 0,
                });
              },
              onComplete: () => {
                // End on exactly what the server rendered.
                element.textContent = final;
              },
            },
            0.4,
          );
        }
      });

      return () => {
        media.revert();
      };
    },
    { scope },
  );

  return (
    <div
      ref={scope}
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5 xl:grid-cols-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * One cell of the grid. `className` carries the column and row spans, so
 * the layout reads in one place — the page — rather than inside each card.
 * `min-w-0` because a grid item defaults to min-width:auto, and a chart's
 * measured width would otherwise push its track past the container.
 */
function BentoCell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-bento-cell className={cn("bento-cell flex min-w-0 flex-col", className)}>
      {children}
    </div>
  );
}

/**
 * The round "open" button in a card's corner, from the reference boards.
 * The arrow points up and toward the inline end: "go into this".
 */
function CardLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "group/link flex size-11 shrink-0 items-center justify-center rounded-full",
        "border border-card-edge bg-card-solid text-foreground shadow-sm dark:border-border",
        "transition-[background-color,color,box-shadow,scale] duration-200 ease-out",
        "hover:bg-primary hover:text-primary-foreground hover:shadow-glow active:scale-95",
        className,
      )}
    >
      <ArrowUpLeft
        aria-hidden
        className="size-[18px] transition-transform duration-200 ease-out group-hover/link:-translate-x-0.5 group-hover/link:-translate-y-0.5"
      />
    </Link>
  );
}

export { BentoGrid, BentoCell, CardLink };
