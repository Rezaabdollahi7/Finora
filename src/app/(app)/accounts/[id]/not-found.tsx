import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

export default function AccountNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="حساب پیدا نشد"
      description="این حساب وجود ندارد یا حذف شده است."
      action={
        <Button asChild>
          <Link href="/accounts">بازگشت به حساب‌ها</Link>
        </Button>
      }
    />
  );
}
