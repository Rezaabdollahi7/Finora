"use client";

import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

/**
 * Calm and actionable, never the raw error (design system §37): the real one
 * is logged by Next.js on the server, and `error.message` is redacted in
 * production builds anyway.
 */
export default function AssetsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="دارایی‌ها بارگذاری نشد"
      description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
      action={
        <Button onClick={reset}>
          <RotateCw />
          تلاش دوباره
        </Button>
      }
    />
  );
}
