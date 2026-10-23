import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { Result } from "@/lib/api";
import { lakh, pct, rupeeFromLakh } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The centrepiece, DESIGN.md §5.4. Static in Phase 6: the max-bid figure is
// the largest element but stays plain here (NumberTicker lands in Phase 8), and
// rank #1 gets no beam yet. "Why this number" expands a plain inline breakdown
// whose arithmetic ties to max bid — Phase 7 replaces it with the animated
// waterfall + comparables drawer.
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
    <article className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-soft)]">
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
        <div className="tabular mt-1 min-w-[6ch] text-[2.5rem] font-semibold leading-none text-[hsl(var(--foreground))]">
          {result.max_bid != null ? lakh(result.max_bid) : "—"}
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
              headroom {positiveHeadroom ? "+" : ""}
              {rupeeFromLakh(result.headroom)}
            </span>
          )}
        </div>
      </div>

      {!high && (
        <p className="mt-3 text-xs text-[hsl(var(--caution))]">
          based on {result.comparables.length} comparable sales
        </p>
      )}

      {/* stat row */}
      <div className="mt-5 grid grid-cols-3 gap-2">
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

      {showWhy && result.breakdown && result.max_bid != null && (
        <WhyBreakdown result={result} />
      )}
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

// Plain inline breakdown — Phase 6 placeholder for the Phase 7 animated
// waterfall. The arithmetic ties exactly to max bid.
function WhyBreakdown({ result }: { result: Result }) {
  const b = result.breakdown!;
  const rows = [
    { label: "Predicted retail", value: b.predicted_retail, sign: "" },
    { label: "Refurb", value: -b.refurb, sign: "−" },
    { label: "Holding", value: -b.holding, sign: "−" },
    { label: "Fees", value: -b.fees, sign: "−" },
    { label: "Your target margin", value: -b.target_margin, sign: "−" },
  ];
  return (
    <div className="mt-4 rounded-[calc(var(--radius)/1.6)] border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-4">
      <dl className="flex flex-col gap-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="tabular flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">{r.label}</dt>
            <dd className="text-[hsl(var(--foreground))]">
              {r.sign}
              {lakh(Math.abs(r.value))}
            </dd>
          </div>
        ))}
        <div className="my-1 border-t border-[hsl(var(--border))]" />
        <div className="tabular flex items-center justify-between font-semibold">
          <dt>Max bid</dt>
          <dd>{lakh(result.max_bid!)}</dd>
        </div>
      </dl>
    </div>
  );
}
