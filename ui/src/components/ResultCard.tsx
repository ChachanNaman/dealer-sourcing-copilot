import { AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { Result } from "@/lib/api";
import { lakh, pct, rupeeFromLakh } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";
import { NumberTicker } from "@/components/ui/number-ticker";
import { WhyPanel } from "@/components/WhyPanel";
import { cn } from "@/lib/utils";

// The centrepiece, DESIGN.md §5.4. "Why this number" expands the WhyPanel
// waterfall + comparables in place; the arithmetic ties to max_bid. Motion
// (NumberTicker on the figure, BorderBeam on rank #1) lands in Phase 8.
interface ResultCardProps {
  result: Result;
  rank: number;
  onPlaceBid: (r: Result) => void;
}

export function ResultCard({ result, rank, onPlaceBid }: ResultCardProps) {
  const [showWhy, setShowWhy] = useState(false);
  const high = result.confidence === "high";
  const positiveHeadroom = (result.headroom ?? 0) > 0;

  return (
    <article className="relative rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-soft)]">
      {rank === 1 && <BorderBeam />}
      {/* top row: rank + title + confidence */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full bg-[hsl(var(--primary)/0.1)] px-2 text-xs font-semibold text-[hsl(var(--primary))]">
            #{rank}
          </span>
          <div>
            <h3 className="text-lg leading-tight">{result.title}</h3>
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
              {result.subtitle}
            </p>
          </div>
        </div>
        <ConfidenceDot confidence={result.confidence} />
      </div>

      {/* max bid — the hero */}
      <div className="mt-5">
        <div className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Max bid
        </div>
        {/* min-width reserves the figure's space so an economics re-compute
            (₹4.94L → ₹5.05L) never shifts layout. */}
        <div className="mt-1 inline-block min-w-[5ch] text-[2.5rem] font-semibold leading-none text-[hsl(var(--foreground))]">
          {result.max_bid != null ? (
            <NumberTicker value={result.max_bid} format={lakh} />
          ) : (
            "—"
          )}
        </div>
        <div className="tabular mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[hsl(var(--muted-foreground))]">
          <span>reserve {lakh(result.reserve_price)}</span>
          <span aria-hidden>·</span>
          {result.headroom != null && (
            <span
              className={cn(
                "font-medium",
                positiveHeadroom
                  ? "text-[hsl(var(--profit))]"
                  : "text-[hsl(var(--muted-foreground))]",
              )}
            >
              {/* lakh (not rupee) so this row never mixes units — it sits
                  beside the lakh reserve and under the lakh max bid (DESIGN §3). */}
              headroom {positiveHeadroom ? "+" : "−"}
              {lakh(Math.abs(result.headroom))}
            </span>
          )}
        </div>
      </div>

      {!high && (
        <p className="mt-3 text-xs text-[hsl(var(--caution))]">
          based on {result.comparables.length} comparable sales
        </p>
      )}

      {/* stat row — 2+1 wrap under 640px, 3-up above (DESIGN §7) */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat
          label="margin"
          value={result.expected_margin != null ? rupeeFromLakh(result.expected_margin) : "—"}
        />
        <Stat label="ROI" value={result.roi_pct != null ? pct(result.roi_pct) : "—"} />
        <Stat label="days to sell" value={Math.round(result.predicted_days_to_sell).toString()} />
      </div>

      {/* footer */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowWhy((s) => !s)}
          className="inline-flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))]"
          aria-expanded={showWhy}
        >
          Why this number
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", showWhy && "rotate-180")}
          />
        </button>
        <Button variant="secondary" size="sm" onClick={() => onPlaceBid(result)}>
          Place bid
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {showWhy && <WhyPanel result={result} />}
      </AnimatePresence>
    </article>
  );
}

function ConfidenceDot({ confidence }: { confidence: Result["confidence"] }) {
  const high = confidence === "high";
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          high ? "bg-[hsl(var(--profit))]" : "bg-[hsl(var(--caution))]",
        )}
      />
      {high ? "high conf" : "medium conf"}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[calc(var(--radius)/1.6)] border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)] px-3 py-2">
      <div className="text-xs text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="tabular mt-0.5 text-sm font-semibold text-[hsl(var(--foreground))]">
        {value}
      </div>
    </div>
  );
}
