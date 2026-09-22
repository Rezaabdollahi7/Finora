import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

export default function GoalNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="هدف پیدا نشد"
      description="این هدف وجود ندارد یا حذف شده است."
      action={
        <Button asChild>
          <Link href="/goals">بازگشت به اهداف</Link>
        </Button>
      }
    />
  );
}
