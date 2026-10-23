import { useReducedMotion } from "@/hooks/useReducedMotion";

// reactbits-style ambient background — a single subtle, slow, low-contrast
// aurora behind the search bar. Desktop only (hidden < sm) for battery and
// legibility (DESIGN.md §7); reduced motion → nothing. Pure CSS drift, no
// WebGL dependency. Tokenised to the brand blue.
export function AuroraBackground() {
  const reduced = useReducedMotion();
  if (reduced) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[190px] w-[1040px] max-w-[135%] -translate-x-1/2 -translate-y-1/2 overflow-hidden sm:block"
    >
      <div className="dc-aurora dc-aurora-a" />
      <div className="dc-aurora dc-aurora-b" />
    </div>
  );
}
