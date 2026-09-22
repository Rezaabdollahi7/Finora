"use client";

import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

/** Calm and actionable, never the raw error (§37). */
export default function RecurringError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="پرداخت‌های دوره‌ای بارگذاری نشد"
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
