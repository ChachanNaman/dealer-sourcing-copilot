import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import {
  DEFAULT_CONFIG,
  recommend,
  type Config,
  type RecommendResponse,
  type Result,
} from "@/lib/api";
import { Header } from "@/components/Header";
import { SearchBar } from "@/components/SearchBar";
import { FilterChips } from "@/components/FilterChips";
import { EconomicsPanel } from "@/components/EconomicsPanel";
import { ResultCard } from "@/components/ResultCard";
import { Loading } from "@/components/states/Loading";

export default function App() {
  const [query, setQuery] = useState<string | null>(null);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [response, setResponse] = useState<RecommendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [economicsOpen, setEconomicsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (q: string, cfg: Config) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await recommend(q, cfg, controller.signal);
      setResponse(res);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError("Couldn't reach the pricing API. Is it running on :8000?");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const onSubmit = (q: string) => {
    setQuery(q);
    run(q, config);
  };

  // Economics changes re-run the current query with the new config.
  useEffect(() => {
    if (query) run(query, config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const onPlaceBid = (r: Result) => {
    toast("Place bid is a demo stub", {
      description: `Nothing was submitted for ${r.title}. No endpoint mutates auction state.`,
    });
  };

  const hasResults = response && response.results.length > 0;

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

          {!loading && !error && response && (
            <div className="flex flex-col gap-5">
              <FilterChips filters={response.filters} />

              {response.clarification && (
                <div className="mx-auto max-w-md rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-center">
                  <p className="text-sm text-[hsl(var(--foreground))]">
                    {response.clarification}
                  </p>
                </div>
              )}

              {hasResults && (
                <>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    {response.results.length} cars worth bidding on
                    {(response.skipped.low_confidence > 0 ||
                      response.skipped.no_headroom > 0) && (
                      <>
                        {" · "}
                        {response.skipped.no_headroom} skipped for no margin
                        {response.skipped.low_confidence > 0 &&
                          `, ${response.skipped.low_confidence} for thin data`}
                      </>
                    )}
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

              {!hasResults && !response.clarification && (
                <div className="mx-auto max-w-md rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  No cars matched with positive headroom at your current economics.
                </div>
              )}
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
