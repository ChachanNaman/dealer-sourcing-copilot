import { Brain, Calculator, ScrollText, ShieldCheck } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";

// First-run orientation for a new visitor: what this is, how to read a card,
// and the one principle that makes it trustworthy.
const STEPS = [
  {
    icon: Brain,
    title: "1 · You describe it, AI understands it",
    body: "Type in plain English. An LLM turns your words into search filters — and only filters. It is never allowed to produce a price.",
  },
  {
    icon: Calculator,
    title: "2 · A model prices every match",
    body: "A machine-learning model predicts each car's resale price and how fast it'll sell. A cost formula then subtracts refurb, holding, fees and your margin to get the max bid you shouldn't cross.",
  },
  {
    icon: ShieldCheck,
    title: "3 · It refuses when unsure",
    body: "If too few similar cars have sold before, it shows no price at all — just the observed range. A tool that admits what it doesn't know is one you can trust with real money.",
  },
  {
    icon: ScrollText,
    title: "4 · You stay in control",
    body: "Set your own economics with the sliders and watch every bid re-rank live. Nothing is ever bid automatically — you confirm.",
  },
];

export function HowItWorks({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="How it works">
      <div className="flex flex-col gap-6">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          A sourcing co-pilot for used-car dealers. It finds auction cars that
          match what you want and tells you the most you should bid on each —
          with the full reasoning behind every number.
        </p>

        <div className="flex flex-col gap-5">
          {STEPS.map((s) => (
            <div key={s.title} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)]">
                <s.icon className="h-4 w-4 text-[hsl(var(--primary))]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                  {s.title}
                </h3>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[calc(var(--radius)/1.6)] border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-4">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            The principle
          </p>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            The AI parses language. A model computes the number. Rules make the
            decision. The dealer confirms it.
          </p>
        </div>

        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          All data is synthetic — no real inventory was used. Try a chip below
          the search bar to see it in action; open "Why this number" on any card
          to see the full breakdown.
        </p>
      </div>
    </Sheet>
  );
}
