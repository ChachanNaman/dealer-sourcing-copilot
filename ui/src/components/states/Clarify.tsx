import { MessageCircleQuestion } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// DESIGN.md §5.7 — a conversation, not a validation error. The system asks one
// short question; the answer is appended to the original query and re-submitted.
interface ClarifyProps {
  question: string;
  originalQuery: string;
  onAnswer: (combinedQuery: string) => void;
  loading: boolean;
}

export function Clarify({ question, originalQuery, onAnswer, loading }: ClarifyProps) {
  const [answer, setAnswer] = useState("");

  const submit = () => {
    const trimmed = answer.trim();
    if (!trimmed || loading) return;
    onAnswer(`${originalQuery} ${trimmed}`.trim());
  };

  return (
    <div className="mx-auto max-w-lg rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-center shadow-[var(--shadow-soft)]">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)]">
        <MessageCircleQuestion className="h-5 w-5 text-[hsl(var(--primary))]" />
      </div>
      <p className="mt-4 text-base text-[hsl(var(--foreground))]">{question}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-5 flex items-center gap-2"
      >
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          autoFocus
          placeholder="e.g. under 6 lakh, in Pune"
          aria-label="Answer the question"
          className="h-11 w-full min-w-0 rounded-[calc(var(--radius)/1.6)] border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? "…" : "Answer"}
        </Button>
      </form>
    </div>
  );
}
