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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Circle className="h-6 w-6 text-[hsl(var(--primary))]" strokeWidth={2.5} />
            <span className="text-lg font-semibold tracking-tight">Dealer Co-pilot</span>
          </div>
          <Badge variant="neutral" className="hidden sm:inline-flex">
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
