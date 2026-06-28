"use client";

import { useState } from "react";
import Link from "next/link";
import { getFeedplugApiBaseUrl } from "@/config/api";
import { formatPrice, type SearchItem } from "@/lib/comparator-api";

interface AssistResponse {
  recommendation: SearchItem | null;
  reasoning: string;
  source: "ai" | "rule" | "none";
}

export default function AssistPanel({ country }: { country: string }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssistResponse | null>(null);
  const [error, setError] = useState(false);

  async function ask() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setResult(null);
    setError(false);
    try {
      const res = await fetch(`${getFeedplugApiBaseUrl()}/comparator/assist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q, country }),
      });
      if (!res.ok) throw new Error("assist failed");
      setResult((await res.json()) as AssistResponse);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const rec = result?.recommendation;
  const recMerchants = rec ? (rec.merchantCount <= 1 ? "1 marchand" : `${rec.merchantCount} marchands`) : "";

  return (
    <section className="mt-4 rounded-xl border border-steel/20 bg-steel-soft p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="inline-flex items-center gap-2 font-display text-fs-15 font-semibold text-steel-hover">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
            <path d="M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4l1.4-1.4m10-10 1.4-1.4" />
          </svg>
          Aide-moi à choisir
        </span>
        <span className="text-fs-12 text-steel-hover/70">décris ton besoin et ton budget</span>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask();
          }}
          placeholder="ex : une cafetière à grains autour de 230 € pour deux"
          className="h-11 flex-1 rounded-lg border border-steel/25 bg-surface px-3.5 text-fs-14 text-ink shadow-xs outline-none transition duration-base ease-ds placeholder:text-ink-4 focus:border-steel focus:ring-2 focus:ring-steel/30"
          aria-label="Décris ton besoin"
        />
        <button
          type="button"
          onClick={ask}
          disabled={loading || !query.trim()}
          className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg bg-steel px-5 text-fs-14 font-semibold text-white transition duration-base ease-ds hover:bg-steel-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-steel focus-visible:ring-offset-2"
        >
          {loading ? "…" : "Recommander"}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-fs-13 text-ink-3">Désolé, je n&apos;ai pas pu répondre. Réessaie.</p>
      )}

      {result && !rec && <p className="mt-3 text-fs-14 text-ink-2">{result.reasoning}</p>}

      {rec && (
        <Link
          href={`/comparateur/produit/${rec.id}?country=${country}`}
          className="mt-3 flex items-center gap-3 rounded-lg border border-steel/20 bg-surface p-3 shadow-xs transition duration-base ease-ds hover:border-steel/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-steel focus-visible:ring-offset-2"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-paper-2">
            {rec.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={rec.imageUrl} alt={rec.title} className="h-full w-full object-contain p-1" />
            ) : (
              <span className="font-mono text-fs-12 text-ink-4">—</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-fs-14 font-semibold text-ink">{rec.title}</p>
            <p className="line-clamp-2 text-fs-12 text-ink-3">{result?.reasoning}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-fs-15 font-bold text-ink">
              {formatPrice(rec.lowestPrice, rec.currency)}
            </p>
            <p className="text-fs-12 text-ink-3">{recMerchants}</p>
          </div>
        </Link>
      )}
    </section>
  );
}
