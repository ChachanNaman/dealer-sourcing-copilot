import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// Right-side slide-over. Phase 6 renders it in its open position with a
// backdrop (no transition yet — the slide motion is added in Phase 8). On
// mobile it docks to the bottom as a sheet, per DESIGN.md §7.
interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-[hsl(var(--foreground)/0.4)]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label={title}
        className={cn(
          "absolute bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] shadow-[var(--shadow-card)]",
          "flex flex-col",
          // desktop: right rail; mobile: bottom sheet
          "inset-x-0 bottom-0 max-h-[85vh] rounded-t-[var(--radius)]",
          "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[380px] sm:rounded-none sm:rounded-l-[var(--radius)]",
        )}
      >
        <header className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
          <h2 className="text-lg">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <footer className="border-t border-[hsl(var(--border))] px-5 py-4">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}
