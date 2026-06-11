"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Link2 } from "lucide-react";
import { apiClient } from "@/lib/api";

interface PerStoreUrl {
  storeCode: string;
  url: string;
}

interface FeedUrlResponse {
  feedId: string;
  globalUrl: string;
  perStoreUrls: PerStoreUrl[];
  stores: number;
}

const panelStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "18px",
  border: "1px solid var(--app-border)",
  boxShadow: "var(--card-shadow)",
};

const urlBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 14px",
  borderRadius: 10,
  background: "var(--paper-2)",
  border: "1px solid var(--app-border)",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  wordBreak: "break-all",
};

const buttonSecondary: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--app-border)",
  background: "#fff",
  color: "var(--app-text)",
  cursor: "pointer",
  fontSize: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

/**
 * Affiche les URLs du flux Local Inventory Ads à copier dans Google Merchant
 * Center → Feeds → Add primary feed.
 *
 * Le merchant configure habituellement un seul flux LIA "global" (toutes les
 * stores) ; on expose aussi un flux par store pour les setups GMC plus
 * granulaires (un compte GMC par enseigne, etc.).
 */
export function FeedUrlPanel() {
  const [data, setData] = useState<FeedUrlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<FeedUrlResponse>("/platforms/lia/feed-url");
      setData(res.data);
    } catch (err: unknown) {
      const apiError = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = apiError.response?.status;
      const msg = apiError.response?.data?.message || apiError.message || "Erreur";
      if (status === 404) {
        setError("Aucun flux actif sur ce compte. Synchronisez d'abord votre catalogue depuis la page Flux.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyUrl = useCallback(async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // fallback : ouvrir un prompt
      window.prompt("Copiez l'URL ci-dessous", url);
    }
  }, []);

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Link2 size={20} />
        <h3 style={{ margin: 0, fontSize: "1.05rem" }}>URL du flux Local Inventory pour Google Merchant Center</h3>
      </div>
      <p style={{ color: "var(--app-text-secondary)", fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
        Copiez l&apos;URL ci-dessous dans Google Merchant Center → <strong>Feeds</strong> → <strong>Add primary feed</strong>{" "}
        en choisissant <em>Scheduled fetch</em> et fréquence quotidienne. Le flux est régénéré en temps réel à chaque hit
        et reflète automatiquement la dernière sync du catalogue et l&apos;inventaire local.
      </p>

      {loading ? (
        <p style={{ color: "var(--app-text-secondary)", fontSize: 14 }}>Chargement…</p>
      ) : error ? (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "rgb(185, 28, 28)",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      ) : data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Flux global (tous les magasins)</div>
            <div style={urlBoxStyle}>
              <span style={{ flex: 1 }}>{data.globalUrl}</span>
              <button
                style={buttonSecondary}
                onClick={() => void copyUrl("global", data.globalUrl)}
                aria-label="Copier l'URL du flux global"
              >
                <Copy size={12} /> {copiedKey === "global" ? "Copié" : "Copier"}
              </button>
              <a
                href={data.globalUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={buttonSecondary}
                aria-label="Ouvrir l'URL du flux global"
              >
                <ExternalLink size={12} /> Aperçu
              </a>
            </div>
          </div>

          {data.perStoreUrls.length > 0 ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Flux par magasin ({data.perStoreUrls.length})
              </div>
              <p style={{ fontSize: 12, color: "var(--app-text-secondary)", marginBottom: 8 }}>
                Optionnel : un flux séparé par magasin si vous gérez chaque enseigne dans son propre compte GMC.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.perStoreUrls.map((s) => (
                  <div key={s.storeCode} style={urlBoxStyle}>
                    <strong style={{ minWidth: 100, fontFamily: "var(--font-sans, sans-serif)" }}>{s.storeCode}</strong>
                    <span style={{ flex: 1 }}>{s.url}</span>
                    <button
                      style={buttonSecondary}
                      onClick={() => void copyUrl(s.storeCode, s.url)}
                      aria-label={`Copier l'URL du flux ${s.storeCode}`}
                    >
                      <Copy size={12} /> {copiedKey === s.storeCode ? "Copié" : "Copier"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
