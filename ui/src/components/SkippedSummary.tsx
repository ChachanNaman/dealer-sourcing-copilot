import { useState } from "react";
import type { Skipped } from "@/lib/api";

// DESIGN.md §5.8 — quiet, muted, below the list. Makes it clear the system did
// the work across the whole inventory, not that it only found a handful. Click
// to reveal the breakdown.
export function SkippedSummary({ skipped }: { skipped: Skipped }) {
  const [open, setOpen] = useState(false);
  const total = skipped.no_headroom + skipped.low_confidence + skipped.beyond_top;
  if (total === 0) return null;

  const lines = [
    skipped.beyond_top > 0 && `${skipped.beyond_top} more priced below the top 20`,
    skipped.no_headroom > 0 &&
      `${skipped.no_headroom} skipped: no margin at your current economics`,
    skipped.low_confidence > 0 &&
      `${skipped.low_confidence} skipped: not enough comparable data to price`,
  ].filter(Boolean) as string[];

  return (
    <div className="mt-2 text-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-[hsl(var(--muted-foreground))] underline-offset-4 hover:underline"
      >
        {total} more cars considered
      </button>
      {open && (
        <ul className="mx-auto mt-3 flex max-w-md flex-col gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
