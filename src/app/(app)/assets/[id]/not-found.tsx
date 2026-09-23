import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

export default function AssetNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="دارایی پیدا نشد"
      description="این دارایی وجود ندارد یا حذف شده است."
      action={
        <Button asChild>
          <Link href="/assets">بازگشت به دارایی‌ها</Link>
        </Button>
      }
    />
  );
}
