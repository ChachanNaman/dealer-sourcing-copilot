import { useReducedMotion } from "@/hooks/useReducedMotion";

// magicui-style BorderBeam, rewritten to our tokens and a CSS keyframe (no new
// dep). A single light travels the card's border. Used on rank #1 ONLY — a
// dealer scanning 20 cards does not want 20 animated borders (DESIGN.md §4).
// Reduced motion → nothing renders.
export function BorderBeam() {
  const reduced = useReducedMotion();
  if (reduced) return null;

  return (
    <div
      aria-hidden
      className="dc-border-beam pointer-events-none absolute inset-0 rounded-[var(--radius)]"
    />
  );
}
