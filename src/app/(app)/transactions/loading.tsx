import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-11 w-72 rounded-full" />
        <Skeleton className="h-11 w-56 rounded-md" />
        <Skeleton className="ms-auto h-11 w-36 rounded-md" />
      </div>
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="hidden h-96 w-full rounded-lg md:block" />
    </div>
  );
}
