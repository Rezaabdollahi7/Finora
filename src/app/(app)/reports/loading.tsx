import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the real layout so nothing jumps when the data arrives (§36). */
export default function ReportsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-6 w-80" />
      </div>
      <Skeleton className="h-52 w-full rounded-2xl bg-primary-muted" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-11 w-full max-w-lg rounded-full" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
