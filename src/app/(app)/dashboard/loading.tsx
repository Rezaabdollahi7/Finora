import { Skeleton } from "@/components/ui/skeleton";
import { SummaryCardsSkeleton } from "@/features/dashboard/components/summary-cards";

/** Mirrors the real grid, so nothing jumps when the data arrives (§36). */
export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-8 w-48" />
      <SummaryCardsSkeleton />
      <div className="grid gap-6 xl:grid-cols-5">
        {[3, 2, 2, 3, 3, 2].map((span, index) => (
          <Skeleton
            key={index}
            className={`h-80 w-full rounded-xl ${span === 3 ? "xl:col-span-3" : "xl:col-span-2"}`}
          />
        ))}
      </div>
    </div>
  );
}
