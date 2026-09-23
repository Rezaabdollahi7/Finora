import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the real bento, span for span, so nothing jumps when the data
 * arrives (§36). The spans are the page's own, in the same order.
 */
const CELLS = [
  {
    span: "md:col-span-6 xl:col-span-5 xl:row-span-2",
    height: "h-104 xl:h-full",
    tone: "brand",
  },
  { span: "md:col-span-6 xl:col-span-7", height: "h-80" },
  { span: "md:col-span-3 xl:col-span-3", height: "h-80" },
  { span: "md:col-span-3 xl:col-span-4", height: "h-80" },
  { span: "md:col-span-6 xl:col-span-8", height: "h-96" },
  { span: "md:col-span-6 xl:col-span-4", height: "h-96" },
  { span: "md:col-span-6 xl:col-span-7", height: "h-96" },
  { span: "md:col-span-6 xl:col-span-5", height: "h-96", tone: "ink" },
  { span: "md:col-span-6 xl:col-span-12", height: "h-64" },
] as const;

export default function DashboardLoading() {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5 xl:grid-cols-12"
      aria-busy
      aria-label="در حال بارگذاری داشبورد"
    >
      <div className="grid gap-8 md:col-span-6 xl:col-span-12 xl:grid-cols-12 xl:items-end xl:gap-10">
        <div className="flex flex-col gap-4 xl:col-span-5">
          <Skeleton className="h-7 w-44 rounded-full" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
        <div className="grid gap-6 sm:grid-cols-3 xl:col-span-7">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      {CELLS.map((cell, index) => (
        <Skeleton
          key={index}
          className={cn(
            "w-full rounded-2xl",
            cell.span,
            cell.height,
            "tone" in cell && cell.tone === "brand" && "bg-primary-muted",
            "tone" in cell && cell.tone === "ink" && "bg-ink-surface/20",
          )}
        />
      ))}
    </div>
  );
}
