import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// Right-side slide-over (bottom sheet on mobile, DESIGN.md §7). beui-style
// motion preset: backdrop fades, panel slides in from the right (or up on
// mobile). Reduced motion → appears/leaves instantly.
interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-[hsl(var(--foreground)/0.4)]"
            onClick={onClose}
            aria-hidden
            initial={reduced ? false : { opacity: 0 }}
            animate={reduced ? {} : { opacity: 1 }}
            exit={reduced ? {} : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.aside
            role="dialog"
            aria-label={title}
            initial={reduced ? false : { x: "100%" }}
            animate={reduced ? {} : { x: 0 }}
            exit={reduced ? {} : { x: "100%" }}
            transition={{ duration: 0.28, ease }}
            className={cn(
              "absolute bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] shadow-[var(--shadow-card)]",
              "flex flex-col",
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
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
