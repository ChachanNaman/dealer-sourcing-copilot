import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Native range input restyled to our tokens. Accessible by default; the track
// fill uses the brand blue via a gradient computed from the value. No library,
// no origin palette.
interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (v: number) => void;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  className,
  ...props
}: SliderProps) {
  const fillPct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={cn("dc-slider w-full", className)}
      style={{
        background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${fillPct}%, hsl(var(--muted)) ${fillPct}%, hsl(var(--muted)) 100%)`,
      }}
      {...props}
    />
  );
}
