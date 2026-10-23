import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

// magicui-style NumberTicker, rewritten with a plain RAF loop (no new dep).
// Counts up from 0 to `value` exactly once on arrival, 600ms, ease-out — never
// on loop, never on scroll. If the value changes later (economics re-compute)
// it snaps, it does not re-run, per DESIGN.md §4/§6. Reduced motion → instant.
interface NumberTickerProps {
  value: number;
  format: (n: number) => string;
  durationMs?: number;
  className?: string;
}

export function NumberTicker({ value, format, durationMs = 600, className }: NumberTickerProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const animated = useRef(false);

  useEffect(() => {
    if (reduced || animated.current) {
      setDisplay(value); // instant on reduced motion, or snap on later changes
      return;
    }
    animated.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced, durationMs]);

  return <span className={cn("tabular", className)}>{format(display)}</span>;
}
