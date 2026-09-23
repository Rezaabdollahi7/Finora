import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the real layout so nothing jumps when the data arrives (§36). */
export default function HouseholdLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-6 w-72" />
      </div>
      <Skeleton className="h-52 w-full rounded-2xl bg-primary-muted" />
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-11 w-56 rounded-full" />
        <Skeleton className="h-10 w-48 rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
