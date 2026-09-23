import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the real layout so nothing jumps when the data arrives (§36). */
export default function GoalsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-6 w-72" />
      </div>
      <Skeleton className="h-52 w-full rounded-2xl bg-primary-muted" />
      <Skeleton className="h-11 w-72 rounded-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-52 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
