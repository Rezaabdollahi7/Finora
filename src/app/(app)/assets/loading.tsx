import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the real layout's shape and spacing so nothing jumps when the data
 * arrives (design system §36).
 */
export default function AssetsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-6 w-72" />
      </div>
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-11 w-72 rounded-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-44 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
