import { useEffect, useRef, useState } from "react";
import type { Config } from "@/lib/api";
import { DEFAULT_CONFIG } from "@/lib/api";
import { Sheet } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";

// Four dealer-economics controls (DESIGN.md §5.3 / PRD US4). Changes debounce
// 250ms, then push a new Config up so the parent re-fetches and the bids move
// while the panel stays open. Refurb is a single multiplier scaling the
// per-grade defaults, keeping it to four controls.
interface EconomicsPanelProps {
  open: boolean;
  onClose: () => void;
  onConfigChange: (config: Config) => void;
}

const BASE_REFURB = DEFAULT_CONFIG.grade_refurb;

export function EconomicsPanel({ open, onClose, onConfigChange }: EconomicsPanelProps) {
  const [marginPct, setMarginPct] = useState(DEFAULT_CONFIG.target_margin * 100);
  const [holdingRupees, setHoldingRupees] = useState(DEFAULT_CONFIG.holding_per_day * 100_000);
  const [feesPct, setFeesPct] = useState(DEFAULT_CONFIG.fees * 100);
  const [refurbMult, setRefurbMult] = useState(1);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const id = setTimeout(() => {
      onConfigChange({
        target_margin: marginPct / 100,
        holding_per_day: holdingRupees / 100_000,
        fees: feesPct / 100,
        grade_refurb: {
          A: BASE_REFURB.A * refurbMult,
          B: BASE_REFURB.B * refurbMult,
          C: BASE_REFURB.C * refurbMult,
        },
      });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marginPct, holdingRupees, feesPct, refurbMult]);

  return (
    <Sheet open={open} onClose={onClose} title="Your economics">
      <div className="flex flex-col gap-7">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          These are your assumptions, not generic ones. Bids re-rank as you change them.
        </p>

        <Control
          label="Target margin"
          value={`${marginPct.toFixed(1)}%`}
          min={5}
          max={20}
          step={0.5}
          raw={marginPct}
          onChange={setMarginPct}
        />
        <Control
          label="Holding cost"
          value={`₹${Math.round(holdingRupees)}/day`}
          min={50}
          max={300}
          step={10}
          raw={holdingRupees}
          onChange={setHoldingRupees}
        />
        <Control
          label="Auction + transfer fees"
          value={`${feesPct.toFixed(1)}%`}
          min={0.5}
          max={3}
          step={0.1}
          raw={feesPct}
          onChange={setFeesPct}
        />
        <Control
          label="Refurb multiplier"
          value={`×${refurbMult.toFixed(1)}`}
          hint="scales grade A/B/C refurb (1.4% / 3.2% / 6.5%)"
          min={0.5}
          max={2}
          step={0.1}
          raw={refurbMult}
          onChange={setRefurbMult}
        />
      </div>
    </Sheet>
  );
}

function Control({
  label,
  value,
  hint,
  min,
  max,
  step,
  raw,
  onChange,
}: {
  label: string;
  value: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  raw: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</label>
        <span className="tabular text-sm font-semibold text-[hsl(var(--primary))]">{value}</span>
      </div>
      <Slider value={raw} min={min} max={max} step={step} onValueChange={onChange} />
      {hint && <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>}
    </div>
  );
}
