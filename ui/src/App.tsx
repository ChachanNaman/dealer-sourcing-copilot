import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import {
  DEFAULT_CONFIG,
  recommend,
  type Config,
  type Filters,
  type RecommendResponse,
  type Result,
} from "@/lib/api";
import { Header } from "@/components/Header";
import { SearchBar } from "@/components/SearchBar";
import { FilterChips } from "@/components/FilterChips";
import { EconomicsPanel } from "@/components/EconomicsPanel";
import { ResultCard } from "@/components/ResultCard";
import { LowConfidenceCard } from "@/components/LowConfidenceCard";
import { SkippedSummary } from "@/components/SkippedSummary";
import { Loading } from "@/components/states/Loading";
import { Clarify } from "@/components/states/Clarify";

function withoutFilter(filters: Filters, key: string): Filters {
  if (key.startsWith("model:")) {
    const name = key.slice("model:".length);
    return { ...filters, models: filters.models.filter((m) => m !== name) };
  }
  return { ...filters, [key]: null };
}

export default function App() {
  const [query, setQuery] = useState<string | null>(null);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [activeFilters, setActiveFilters] = useState<Filters | null>(null);
  const [response, setResponse] = useState<RecommendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [economicsOpen, setEconomicsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (q: string, cfg: Config, filters?: Filters) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await recommend(q, { config: cfg, filters, signal: controller.signal });
      setResponse(res);
      setActiveFilters(res.filters);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError("Couldn't reach the pricing API. Is it running on :8000?");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // Fresh query — let the LLM parse it.
  const onSubmit = (q: string) => {
    setQuery(q);
    setActiveFilters(null);
    run(q, config);
  };

  // Economics change — re-run the current query/filters with the new config.
  useEffect(() => {
    if (!query) return;
    run(query, config, activeFilters ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Chip removal — edit the filters directly and re-rank (skips the LLM).
  const onRemoveChip = (key: string) => {
    const base = activeFilters ?? response?.filters;
    if (!base || !query) return;
    run(query, config, withoutFilter(base, key));
  };

  const onPlaceBid = (r: Result) => {
    toast("Place bid is a demo stub", {
      description: `Nothing was submitted for ${r.title}. No endpoint mutates auction state.`,
    });
  };

  const hasResults = response && response.results.length > 0;
  const lowConf = response?.low_confidence_results ?? [];

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Toaster position="bottom-center" />
      <Header onOpenEconomics={() => setEconomicsOpen(true)} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-2xl sm:text-[1.75rem]">
            Which of today&apos;s auctions should you bid on?
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">
            Describe what you want in plain English. We parse it, price every match,
            and show the ceiling you shouldn&apos;t cross — with the reasoning behind it.
          </p>
          <div className="mt-6">
            <SearchBar onSubmit={onSubmit} loading={loading} />
          </div>
        </section>

        <section className="mt-10">
          {loading && <Loading />}

          {!loading && error && (
            <div className="mx-auto max-w-md rounded-[var(--radius)] border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.06)] p-5 text-center text-sm text-[hsl(var(--danger))]">
              {error}
            </div>
          )}

          {!loading && !error && response && response.clarification && query && (
            <Clarify
              question={response.clarification}
              originalQuery={query}
              onAnswer={onSubmit}
              loading={loading}
            />
          )}

          {!loading && !error && response && !response.clarification && (
            <div className="flex flex-col gap-5">
              <FilterChips filters={response.filters} onRemove={onRemoveChip} />

              {hasResults && (
                <>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    {response.results.length} cars worth bidding on
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {response.results.map((r, i) => (
                      <ResultCard
                        key={r.listing_id}
                        result={r}
                        rank={i + 1}
                        onPlaceBid={onPlaceBid}
                      />
                    ))}
                  </div>
                </>
              )}

              {lowConf.length > 0 && (
                <div className="flex flex-col gap-4">
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    Matched, but we won&apos;t price these — too little comparable data
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {lowConf.map((r) => (
                      <LowConfidenceCard key={r.listing_id} result={r} />
                    ))}
                  </div>
                </div>
              )}

              {!hasResults && lowConf.length === 0 && (
                <div className="mx-auto max-w-md rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  No cars matched with positive headroom at your current economics.
                </div>
              )}

              <SkippedSummary skipped={response.skipped} />
            </div>
          )}
        </section>
      </main>

      <EconomicsPanel
        open={economicsOpen}
        onClose={() => setEconomicsOpen(false)}
        onConfigChange={setConfig}
      />
    </div>
  );
}
