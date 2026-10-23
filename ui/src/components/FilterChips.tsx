import { X } from "lucide-react";
import type { Filters } from "@/lib/api";
import { lakh } from "@/lib/format";

// Renders the LLM-parsed filters as human-readable chips — the "it understood
// me" moment (DESIGN.md §5.2). Each chip removes its own filter field and the
// list re-ranks. Never raw JSON.

// A removable chip maps to a key the parent nulls out. `model:<name>` removes a
// single model from the list; every other key nulls that whole field.
interface Chip {
  key: string;
  label: string;
}

function chipsFromFilters(f: Filters): Chip[] {
  const chips: Chip[] = [];
  if (f.body_type) chips.push({ key: "body_type", label: cap(f.body_type) });
  for (const m of f.models) chips.push({ key: `model:${m}`, label: m });
  // Budget filters the auction reserve, not the bid — label it so a dealer
  // doesn't read "under ₹5L" next to a higher max-bid as a contradiction.
  if (f.max_price_lakh != null)
    chips.push({ key: "max_price_lakh", label: `reserve under ${lakh(f.max_price_lakh)}` });
  if (f.min_price_lakh != null)
    chips.push({ key: "min_price_lakh", label: `reserve over ${lakh(f.min_price_lakh)}` });
  if (f.max_km != null)
    chips.push({ key: "max_km", label: `under ${f.max_km.toLocaleString("en-IN")} km` });
  if (f.min_year != null) chips.push({ key: "min_year", label: `${f.min_year} or newer` });
  if (f.city) chips.push({ key: "city", label: f.city });
  if (f.fuel) chips.push({ key: "fuel", label: cap(f.fuel) });
  if (f.transmission) chips.push({ key: "transmission", label: cap(f.transmission) });
  if (f.grade_min) chips.push({ key: "grade_min", label: `grade ${f.grade_min}+` });
  if (f.max_days_to_sell != null)
    chips.push({ key: "max_days_to_sell", label: `sells in ≤ ${f.max_days_to_sell} days` });
  return chips;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface FilterChipsProps {
  filters: Filters;
  onRemove: (key: string) => void;
}

export function FilterChips({ filters, onRemove }: FilterChipsProps) {
  const chips = chipsFromFilters(filters);
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[hsl(var(--muted-foreground))]">Understood as</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip.key)}
          aria-label={`Remove filter: ${chip.label}`}
          className="group inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary)/0.1)] py-1 pl-3 pr-2 text-xs font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary)/0.18)]"
        >
          {chip.label}
          <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}
