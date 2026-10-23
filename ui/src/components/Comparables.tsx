import type { Comparable } from "@/lib/api";
import { lakh } from "@/lib/format";

// Compact comparable-sales rows shown under the waterfall (DESIGN.md §5.6).
// Each is a real historical sale the bid is anchored to.
export function Comparables({ comparables }: { comparables: Comparable[] }) {
  if (!comparables.length) return null;
  return (
    <div className="mt-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        Comparable sales
      </div>
      <ul className="flex flex-col divide-y divide-[hsl(var(--border))]">
        {comparables.map((c, i) => (
          <li
            key={i}
            className="tabular flex items-center justify-between gap-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate text-[hsl(var(--muted-foreground))]">
              {c.title}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="font-medium text-[hsl(var(--foreground))]">
                {lakh(c.sold_at)}
              </span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {c.days_to_sell}d
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
