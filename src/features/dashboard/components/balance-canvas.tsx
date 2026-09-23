"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { BalanceScene } from "@/features/dashboard/components/balance-scene";

/**
 * The canvas that hosts the balance card's 3D scene.
 *
 * Loaded on demand (see balance-hero.tsx), so three.js never weighs on the
 * first paint of any page. It is decoration: aria-hidden, pointer-events
 * handled by the card around it, and if WebGL is unavailable it quietly
 * renders nothing and the card keeps its gradient.
 *
 * Every observer and the scene itself are torn down on unmount.
 */
export default function BalanceCanvas({
  pointer,
  className,
}: {
  /** Written by the card on pointer move, read here on every frame. */
  pointer: React.RefObject<{ x: number; y: number } | null>;
  className?: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let scene: BalanceScene | null = null;
    let cancelled = false;
    let visible = false;
    let pointerFrame = 0;

    const sync = () => {
      scene?.setRunning(visible && document.visibilityState === "visible");
    };

    const resize = new ResizeObserver(([entry]) => {
      if (!entry) return;
      scene?.resize(entry.contentRect.width, entry.contentRect.height);
    });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });

    // Feed the pointer to the scene once per frame rather than per event.
    const followPointer = () => {
      const value = pointer.current;
      if (value) scene?.point(value.x, value.y);
      pointerFrame = requestAnimationFrame(followPointer);
    };

    void import("@/features/dashboard/components/balance-scene")
      .then(({ createBalanceScene }) => {
        if (cancelled) return;
        scene = createBalanceScene(canvas, { animate: !motion.matches });
        scene.resize(canvas.clientWidth, canvas.clientHeight);
        resize.observe(canvas);
        intersection.observe(canvas);
        if (!motion.matches) pointerFrame = requestAnimationFrame(followPointer);
      })
      .catch(() => {
        // No WebGL, or the chunk failed to load: the card stands on its own.
        if (!cancelled) setFailed(true);
      });

    document.addEventListener("visibilitychange", sync);

    return () => {
      cancelled = true;
      cancelAnimationFrame(pointerFrame);
      document.removeEventListener("visibilitychange", sync);
      resize.disconnect();
      intersection.disconnect();
      scene?.dispose();
    };
  }, [pointer]);

  if (failed) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none size-full animate-in fade-in", className)}
    />
  );
}
