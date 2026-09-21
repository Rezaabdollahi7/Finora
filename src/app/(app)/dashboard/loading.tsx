import { Skeleton } from "@/components/ui/skeleton";
import { SummaryCardsSkeleton } from "@/features/dashboard/components/summary-cards";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-8 w-48" />
      <SummaryCardsSkeleton />
      <div className="grid gap-6 xl:grid-cols-5">
        <Skeleton className="h-96 w-full rounded-xl xl:col-span-3" />
        <Skeleton className="h-96 w-full rounded-xl xl:col-span-2" />
      </div>
    </div>
  );
}
