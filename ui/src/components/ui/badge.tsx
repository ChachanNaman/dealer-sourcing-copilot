import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Fully-rounded pill, per the extracted 9999px radius. Variants map to our
// semantic tokens — never a raw colour.
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
        primary: "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]",
        profit: "bg-[hsl(var(--profit)/0.12)] text-[hsl(var(--profit))]",
        caution: "bg-[hsl(var(--caution)/0.12)] text-[hsl(var(--caution))]",
        danger: "bg-[hsl(var(--danger)/0.12)] text-[hsl(var(--danger))]",
        unknown: "bg-[hsl(var(--unknown)/0.14)] text-[hsl(var(--unknown))]",
      },
      size: {
        sm: "px-2 py-0.5",
        md: "px-3 py-1",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}
