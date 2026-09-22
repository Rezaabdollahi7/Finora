import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

export default function RecurringNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="پرداخت دوره‌ای پیدا نشد"
      description="این پرداخت وجود ندارد یا حذف شده است."
      action={
        <Button asChild>
          <Link href="/recurring">بازگشت به پرداخت‌های دوره‌ای</Link>
        </Button>
      }
    />
  );
}
