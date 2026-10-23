import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Static muted block. No pulse/shimmer in Phase 6 (that motion lands in
// Phase 8); it reads as a placeholder purely by shape and tone.
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[calc(var(--radius)/1.6)] bg-[hsl(var(--muted))]", className)}
      {...props}
    />
  );
}
