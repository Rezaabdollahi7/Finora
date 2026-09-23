import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the real layout's shape so nothing jumps when the data arrives
 * (design system §36) — six week rows, because the month grid always has
 * six.
 */
export default function CalendarLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-6 w-72" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 rounded-xl border border-border p-6 lg:col-span-3">
          <Skeleton className="h-7 w-40" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-md sm:h-20" />
            ))}
          </div>
        </div>
        <Skeleton className="h-80 w-full rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}
