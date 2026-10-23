import type { Result } from "@/lib/api";
import { lakh } from "@/lib/format";
import { Comparables } from "@/components/Comparables";

// The "why this number" waterfall (DESIGN.md §5.6), expanding in place. The
// arithmetic must visibly tie to max_bid — a dealer will check it with a
// calculator. Motion (rows animating in) is added in Phase 8; this is the
// static, correct version.
export function WhyPanel({ result }: { result: Result }) {
  const b = result.breakdown;
  if (!b || result.max_bid == null) return null;

  // Tie the waterfall at display precision. Lakh shows 2 decimals (₹1,000
  // granularity), so rounding each line independently can leave a visible
  // ₹1,000 gap against max bid. We round every line to 2dp and let the
  // discretionary target-margin line absorb the sub-₹1,000 residual, so the
  // column the dealer checks with a calculator always sums exactly to max bid.
  const d = (x: number) => Math.round(x * 100) / 100;
  const predicted = d(b.predicted_retail);
  const refurb = d(b.refurb);
  const holding = d(b.holding);
  const fees = d(b.fees);
  const maxBid = d(result.max_bid);
  const margin = d(predicted - refurb - holding - fees - maxBid);

  const deductions = [
    { label: `Refurb (grade ${gradeFromSubtitle(result.subtitle)})`, value: refurb },
    { label: `Holding (${Math.round(result.predicted_days_to_sell)} days)`, value: holding },
    { label: "Fees", value: fees },
    { label: "Your target margin", value: margin },
  ];

  return (
    <div className="mt-4 rounded-[calc(var(--radius)/1.6)] border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-4">
      <dl className="flex flex-col gap-2 text-sm">
        <Row label="Predicted retail" value={lakh(predicted)} />
        {deductions.map((row) => (
          <Row key={row.label} label={row.label} value={`−${lakh(row.value)}`} muted />
        ))}
        <div className="my-1 border-t border-[hsl(var(--border))]" />
        <div className="tabular flex items-center justify-between text-base font-semibold">
          <dt>Max bid</dt>
          <dd>{lakh(maxBid)}</dd>
        </div>
      </dl>

      <Comparables comparables={result.comparables} />
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="tabular flex items-center justify-between">
      <dt className="text-[hsl(var(--muted-foreground))]">{label}</dt>
      <dd className={muted ? "text-[hsl(var(--muted-foreground))]" : "text-[hsl(var(--foreground))]"}>
        {value}
      </dd>
    </div>
  );
}

// The grade lives in the subtitle ("… · Grade C · …"); pull it for the refurb label.
function gradeFromSubtitle(subtitle: string): string {
  const m = subtitle.match(/Grade\s+([ABC])/);
  return m ? m[1] : "—";
}
