import { CircleDashed } from "lucide-react";
import { useState } from "react";
import type { Result } from "@/lib/api";
import { lakh } from "@/lib/format";
import { Comparables } from "@/components/Comparables";

// DESIGN.md §5.5 — the honesty screen. Deliberately downgraded: muted surface,
// dashed ring, grey everything, NO bid figure anywhere, not even behind the
// "show anyway". It must not read as a normal card with a badge. Only the
// observed range of real sales is shown — the system declines rather than
// inventing a number it can't defend.
export function LowConfidenceCard({ result }: { result: Result }) {
  const [showComparables, setShowComparables] = useState(false);
  const [lo, hi] = result.observed_range ?? [null, null];

  return (
    <article className="rounded-[var(--radius)] border border-dashed border-[hsl(var(--unknown)/0.5)] bg-[hsl(var(--muted)/0.4)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg leading-tight text-[hsl(var(--muted-foreground))]">
            {result.title}
          </h3>
          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            {result.subtitle}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-[hsl(var(--unknown))]">
          <CircleDashed className="h-3.5 w-3.5" />
          not enough data
        </span>
      </div>

      <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
        Only {result.comparables.length} comparable{" "}
        {result.comparables.length === 1 ? "sale" : "sales"} on record. Not enough to
        price this confidently — so we won&apos;t show a bid.
      </p>

      {lo != null && hi != null && (
        <p className="tabular mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Observed range:{" "}
          <span className="font-medium text-[hsl(var(--foreground))]">
            {lakh(lo)} – {lakh(hi)}
          </span>
        </p>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowComparables((s) => !s)}
          className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
        >
          {showComparables ? "Hide the sales" : "Show anyway"}
        </button>
      </div>

      {showComparables && <Comparables comparables={result.comparables} />}
    </article>
  );
}
