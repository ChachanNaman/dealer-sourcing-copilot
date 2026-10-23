import type { Filters } from "@/lib/api";
import { lakh } from "@/lib/format";

// Renders the LLM-parsed filters as human-readable chips — the "it understood
// me" moment (DESIGN.md §5.2). Never raw JSON. Phase 6 is display-only;
// remove-and-re-rank interaction lands in Phase 7 with the refetch flow.
function chipsFromFilters(f: Filters): string[] {
  const chips: string[] = [];
  if (f.body_type) chips.push(cap(f.body_type));
  if (f.models.length) chips.push(...f.models);
  if (f.max_price_lakh != null) chips.push(`under ${lakh(f.max_price_lakh)}`);
  if (f.min_price_lakh != null) chips.push(`over ${lakh(f.min_price_lakh)}`);
  if (f.max_km != null) chips.push(`under ${f.max_km.toLocaleString("en-IN")} km`);
  if (f.min_year != null) chips.push(`${f.min_year} or newer`);
  if (f.city) chips.push(f.city);
  if (f.fuel) chips.push(cap(f.fuel));
  if (f.transmission) chips.push(cap(f.transmission));
  if (f.grade_min) chips.push(`grade ${f.grade_min}+`);
  if (f.max_days_to_sell != null) chips.push(`sells in ≤ ${f.max_days_to_sell} days`);
  return chips;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function FilterChips({ filters }: { filters: Filters }) {
  const chips = chipsFromFilters(filters);
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[hsl(var(--muted-foreground))]">Understood as</span>
      {chips.map((chip) => (
        <span
          key={chip}
          className="inline-flex items-center rounded-full bg-[hsl(var(--primary)/0.1)] px-3 py-1 text-xs font-medium text-[hsl(var(--primary))]"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}
