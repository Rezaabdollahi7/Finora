"use client";

import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

export default function TransactionsError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="تراکنش‌ها بارگذاری نشد"
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
