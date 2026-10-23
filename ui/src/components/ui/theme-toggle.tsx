import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Dark-mode toggle in the toggles.dev pill-switch idiom, rewritten to our
// tokens (no origin palette). The knob slides track-to-track; the active-side
// icon is the brand blue. Motion here is a sub-200ms affordance on a control,
// not content motion — reduced-motion users still get an instant state change
// because transitions on transform are harmless and the track is tokenised.
export function ThemeToggle() {
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Toggle dark mode"
      onClick={() => setDark((d) => !d)}
      className={cn(
        "relative inline-flex h-8 w-14 items-center rounded-full border border-[hsl(var(--border))] px-1",
        "bg-[hsl(var(--muted))] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]",
      )}
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--card))] shadow-[var(--shadow-resting)] transition-transform",
          dark ? "translate-x-6" : "translate-x-0",
        )}
      >
        {dark ? (
          <Moon className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-[hsl(var(--caution))]" />
        )}
      </span>
    </button>
  );
}
