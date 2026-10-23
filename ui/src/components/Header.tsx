import { Circle, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Left: our own wordmark (NOT CARS24's) + an honest "synthetic data" pill.
// Right: economics opener + dark toggle. The open-circle mark echoes the
// rebranded CARS24 logo language without lifting their asset.
export function Header({ onOpenEconomics }: { onOpenEconomics: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.85)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <Circle className="h-5 w-5 shrink-0 text-[hsl(var(--primary))]" strokeWidth={2.5} />
            <span className="whitespace-nowrap text-base font-semibold tracking-tight sm:text-lg">
              Dealer Co-pilot
            </span>
          </div>
          {/* Honesty marker — must show at every breakpoint; the phone is the
              first surface this gets opened on. */}
          <Badge variant="neutral" className="shrink-0 whitespace-nowrap">
            synthetic data
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onOpenEconomics}>
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Economics</span>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
