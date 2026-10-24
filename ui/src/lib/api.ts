// Typed fetch wrappers for the dealer-copilot API. Shapes mirror api/app/schemas.py.

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type BodyType = "hatchback" | "sedan" | "suv";
export type Confidence = "high" | "medium" | "low";

export interface Filters {
  body_type: BodyType | null;
  max_price_lakh: number | null;
  min_price_lakh: number | null;
  max_km: number | null;
  min_year: number | null;
  city: string | null;
  fuel: "petrol" | "diesel" | "cng" | null;
  transmission: "manual" | "automatic" | null;
  grade_min: "A" | "B" | "C" | null;
  max_days_to_sell: number | null;
  models: string[];
  clarification_needed: boolean;
  clarification_question: string | null;
}

export interface Config {
  target_margin: number;
  holding_per_day: number;
  fees: number;
  grade_refurb: Record<string, number>;
}

export interface Breakdown {
  predicted_retail: number;
  refurb: number;
  holding: number;
  fees: number;
  target_margin: number;
}

export interface Comparable {
  title: string;
  sold_at: number;
  days_to_sell: number;
}

export interface Result {
  listing_id: string;
  title: string;
  subtitle: string;
  reserve_price: number;
  max_bid: number | null;
  expected_margin: number | null;
  roi_pct: number | null;
  predicted_days_to_sell: number;
  confidence: Confidence;
  headroom: number | null;
  observed_range: [number, number] | null;
  reason: string | null;
  breakdown: Breakdown | null;
  comparables: Comparable[];
}

export interface Skipped {
  low_confidence: number;
  no_headroom: number;
  beyond_top: number;
}

export interface RecommendResponse {
  trace_id: string;
  filters: Filters;
  clarification: string | null;
  results: Result[];
  low_confidence_results: Result[];
  skipped: Skipped;
}

export const DEFAULT_CONFIG: Config = {
  target_margin: 0.09,
  holding_per_day: 0.0012,
  fees: 0.015,
  grade_refurb: { A: 0.014, B: 0.032, C: 0.065 },
};

interface RecommendOptions {
  config?: Config;
  // When supplied, the server skips the LLM and uses these filters directly —
  // used to re-rank after a dealer edits a filter chip.
  filters?: Filters;
  signal?: AbortSignal;
  // Called when a request fails transiently and we're about to retry — the
  // free-tier API cold-starts (~50s) after idle and 502s until it's up.
  onWaking?: () => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function recommend(
  query: string,
  { config = DEFAULT_CONFIG, filters, signal, onWaking }: RecommendOptions = {},
): Promise<RecommendResponse> {
  const body = JSON.stringify({ query, config, filters: filters ?? null });
  // Retry transient cold-start failures (network error / 502 / 503) for ~60s so
  // the first request after the server sleeps succeeds instead of erroring.
  const maxAttempts = 7;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal,
      });
      if (res.status === 502 || res.status === 503) throw new Error("server waking");
      if (!res.ok) throw new Error(`recommend failed: ${res.status} ${res.statusText}`);
      return res.json();
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
      if (attempt < maxAttempts - 1) {
        onWaking?.();
        await sleep(9000);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("recommend failed");
}

export async function health(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
