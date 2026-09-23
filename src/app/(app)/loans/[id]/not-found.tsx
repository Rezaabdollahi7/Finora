import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

export default function LoanNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="وام پیدا نشد"
      description="این وام وجود ندارد یا حذف شده است."
      action={
        <Button asChild>
          <Link href="/loans">بازگشت به وام‌ها</Link>
        </Button>
      }
    />
  );
}
