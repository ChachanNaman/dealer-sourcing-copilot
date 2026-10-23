import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Card-entry blur + fade + 8px rise (DESIGN.md §6). `delay` drives the 40ms
// stagger; App caps the stagger at 8 cards so the list never feels slow.
// Reduced motion → render children with no animation.
interface BlurFadeProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function BlurFade({ children, delay = 0, className }: BlurFadeProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, filter: "blur(8px)", y: 8 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
