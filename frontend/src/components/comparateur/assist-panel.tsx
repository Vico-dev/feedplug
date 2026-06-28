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

  return (
    <section className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-center gap-2">
        <span className="text-base font-medium text-blue-800">Aide-moi à choisir</span>
        <span className="text-xs text-blue-700">décris ton besoin et ton budget</span>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask();
          }}
          placeholder="ex : une cafetière à grains autour de 230 € pour deux"
          className="h-10 flex-1 rounded-lg border border-blue-200 bg-white px-3 text-sm"
          aria-label="Décris ton besoin"
        />
        <button
          type="button"
          onClick={ask}
          disabled={loading || !query.trim()}
          className="h-10 whitespace-nowrap rounded-lg border border-blue-300 bg-white px-4 text-sm text-blue-800 hover:bg-blue-100 disabled:opacity-50"
        >
          {loading ? "…" : "Recommander"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-gray-500">Désolé, je n&apos;ai pas pu répondre. Réessaie.</p>}

      {result && !rec && (
        <p className="mt-3 text-sm text-gray-600">{result.reasoning}</p>
      )}

      {rec && (
        <Link
          href={`/comparateur/produit/${rec.id}?country=${country}`}
          className="mt-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-white p-3 hover:border-blue-300"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-50">
            {rec.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={rec.imageUrl} alt={rec.title} className="h-full w-full object-contain" />
            ) : (
              <span className="text-gray-300">—</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-medium text-gray-900">{rec.title}</p>
            <p className="line-clamp-2 text-xs text-gray-600">{result?.reasoning}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-medium text-gray-900">{formatPrice(rec.lowestPrice, rec.currency)}</p>
            <p className="text-xs text-gray-500">{rec.merchantCount} marchands</p>
          </div>
        </Link>
      )}
    </section>
  );
}
