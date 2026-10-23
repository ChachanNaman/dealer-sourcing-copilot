import { Skeleton } from "@/components/ui/skeleton";

// Skeleton cards matching ResultCard's exact geometry (DESIGN.md §5.9) — a
// spinner would be wrong here. Static blocks in Phase 6; shimmer in Phase 8.
function SkeletonCard() {
  return (
    <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Skeleton className="h-6 w-8 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>
      <div className="mt-5 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-20 rounded-[calc(var(--radius)/1.6)]" />
      </div>
    </div>
  );
}

export function Loading({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
