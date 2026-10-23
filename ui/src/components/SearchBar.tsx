import { ArrowRight, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// Rotating placeholder cycles real dealer phrasings (DESIGN.md §5.2). The
// rotation is a placeholder-text swap, not content motion, and it pauses once
// the user starts typing. Example chips below fill-and-submit — these chips
// are the demo, so they must return good results.
const PLACEHOLDERS = [
  "hatchbacks under 5 lakh, under 60k km near Pune, flip in 3 weeks",
  "Creta or Seltos, automatic, Bengaluru, fast mover",
  "cheap grade A sedans I can turn in 2 weeks",
];

const EXAMPLE_CHIPS = [
  "hatchbacks under 5 lakh under 60k km near Pune",
  "diesel SUVs under 15L that I can flip in 3 weeks",
  "Honda City or Hyundai Verna sedans in Bengaluru",
  "automatic SUVs under 16 lakh in Mumbai",
  // Surfaces low-confidence refusal cards (thin-data sedans like the Skoda
  // Rapid in a small market) alongside priced results — the honesty screen,
  // one click away for a demo.
  "sedans under 10 lakh in Nashik",
];

interface SearchBarProps {
  onSubmit: (query: string) => void;
  loading: boolean;
}

export function SearchBar({ onSubmit, loading }: SearchBarProps) {
  const [value, setValue] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const typing = value.length > 0;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typing) return;
    const id = setInterval(
      () => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length),
      3800,
    );
    return () => clearInterval(id);
  }, [typing]);

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  };

  const fillAndSubmit = (chip: string) => {
    setValue(chip);
    submit(chip);
  };

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex items-center gap-2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 shadow-[var(--shadow-soft)] focus-within:ring-2 focus-within:ring-[hsl(var(--ring))]"
      >
        <Search className="h-5 w-5 shrink-0 text-[hsl(var(--muted-foreground))]" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={PLACEHOLDERS[placeholderIdx]}
          aria-label="Describe what you want to source"
          className="h-14 w-full min-w-0 bg-transparent text-base text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none"
        />
        {/* Icon-only on mobile so a long typed query stays readable; full
            label on sm+. */}
        <Button type="submit" size="md" disabled={loading} className="shrink-0 px-3 sm:px-4">
          <span className="hidden sm:inline">{loading ? "Searching…" : "Search"}</span>
          <ArrowRight className="h-5 w-5 sm:hidden" />
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLE_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => fillAndSubmit(chip)}
            disabled={loading}
            className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--primary)/0.06)] hover:text-[hsl(var(--primary))] disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
