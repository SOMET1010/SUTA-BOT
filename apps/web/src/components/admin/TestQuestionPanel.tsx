"use client";

import { useState, type FormEvent } from "react";

interface SearchResult {
  title: string;
  content: string;
  source: string;
  score: number;
}

export function TestQuestionPanel() {
  const [question, setQuestion] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch("/api/tools/search-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? "Échec de la recherche.");
        return;
      }
      setResults(body.results);
    } catch {
      setError("Je rencontre momentanément une difficulté technique. Vous pouvez réessayer.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="font-medium">Tester une question</h2>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ex : Comment bénéficier de ce programme ?"
          className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-brand-text placeholder:text-brand-text/40 focus:border-brand-secondary focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || question.trim().length === 0}
          className="rounded-full bg-brand-secondary px-5 py-2 text-sm font-medium text-brand-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Recherche..." : "Rechercher"}
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {results && results.length === 0 && (
        <p className="text-sm text-brand-text/60">
          Aucun résultat — SUTA indiquerait qu&apos;il ne dispose pas de cette information (section 58).
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="flex flex-col gap-3">
          {results.map((result, index) => (
            <li key={index} className="rounded-xl bg-black/20 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between text-xs text-brand-text/50">
                <span>{result.source}</span>
                <span>score : {result.score.toFixed(3)}</span>
              </div>
              <p className="text-brand-text/80">{result.content}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
