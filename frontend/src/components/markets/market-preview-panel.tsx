"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe2, Languages, RefreshCw, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  previewMarketProduct,
  type Market,
  type MarketLocale,
  type MarketPreviewResponse,
} from "@/lib/services/markets.service";
import { PageButtonPrimary, PageButtonSecondary, PageCard } from "@/components/layout";

interface FeedOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  title: string;
  sku?: string | null;
  brand?: string | null;
}

interface MarketPreviewPanelProps {
  markets: Market[];
  /** Default market preselected (e.g. the one the user just created). */
  defaultMarketId?: string;
}

/**
 * Prévisualisation traduite d'un produit pour un marché.
 *
 * Flow utilisateur :
 *   1. Choisir un marché parmi ceux qui ont au moins une locale.
 *   2. (optionnel) Choisir une locale si le marché en a plusieurs.
 *   3. Choisir un flux (les flux ingérés du compte).
 *   4. Choisir un produit du flux (paginé côté backend, on prend les 50
 *      premiers pour la v1).
 *   5. Cliquer sur « Prévisualiser » — affichage côte à côte source vs
 *      version traduite, plus un bouton « Régénérer » pour bypass cache.
 */
export function MarketPreviewPanel({ markets, defaultMarketId }: MarketPreviewPanelProps) {
  const eligibleMarkets = useMemo(
    () => markets.filter((market) => Array.isArray(market.locales) && market.locales.length > 0),
    [markets],
  );

  const [selectedMarketId, setSelectedMarketId] = useState<string>(
    () => defaultMarketId || eligibleMarkets[0]?.id || "",
  );
  const selectedMarket = useMemo(
    () => eligibleMarkets.find((m) => m.id === selectedMarketId) || null,
    [eligibleMarkets, selectedMarketId],
  );
  const locales: MarketLocale[] = selectedMarket?.locales || [];
  const defaultLocaleId = useMemo(
    () => locales.find((l) => l.isDefault)?.id || locales[0]?.id || "",
    [locales],
  );
  const [selectedLocaleId, setSelectedLocaleId] = useState<string>(defaultLocaleId);
  useEffect(() => setSelectedLocaleId(defaultLocaleId), [defaultLocaleId]);

  const [feeds, setFeeds] = useState<FeedOption[]>([]);
  const [feedsLoading, setFeedsLoading] = useState(false);
  const [feedsError, setFeedsError] = useState<string | null>(null);
  const [selectedFeedId, setSelectedFeedId] = useState<string>("");

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const [preview, setPreview] = useState<MarketPreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Charge les flux une fois au mount.
  useEffect(() => {
    let cancelled = false;
    setFeedsLoading(true);
    setFeedsError(null);
    apiClient
      .get<FeedOption[] | { feeds?: FeedOption[] }>("/ingestion/feeds")
      .then((response) => {
        if (cancelled) return;
        const list = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.feeds)
            ? response.data!.feeds
            : [];
        setFeeds(list);
        if (list.length > 0) setSelectedFeedId((current) => current || list[0].id);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFeedsError(err instanceof Error ? err.message : "Impossible de charger les flux.");
      })
      .finally(() => {
        if (!cancelled) setFeedsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Charge les produits dès qu'on a un flux sélectionné.
  useEffect(() => {
    if (!selectedFeedId) {
      setProducts([]);
      setSelectedProductId("");
      return;
    }
    let cancelled = false;
    setProductsLoading(true);
    setProductsError(null);
    apiClient
      .get<{ items?: ProductOption[]; total?: number }>(
        `/ingestion/feeds/${selectedFeedId}/items?limit=50&offset=0`,
      )
      .then((response) => {
        if (cancelled) return;
        const items = Array.isArray(response.data?.items) ? response.data!.items : [];
        setProducts(items);
        setSelectedProductId((current) => {
          if (current && items.some((item) => item.id === current)) return current;
          return items[0]?.id || "";
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setProductsError(err instanceof Error ? err.message : "Impossible de charger les produits.");
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFeedId]);

  const canPreview = !!selectedMarketId && !!selectedLocaleId && !!selectedProductId && !previewing;

  const runPreview = useCallback(
    async (refresh = false) => {
      if (!selectedMarketId || !selectedProductId) return;
      setPreviewing(true);
      setPreviewError(null);
      try {
        const result = await previewMarketProduct(selectedMarketId, selectedProductId, {
          localeId: selectedLocaleId || undefined,
          refresh,
        });
        setPreview(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur lors de la prévisualisation.";
        setPreviewError(message);
      } finally {
        setPreviewing(false);
      }
    },
    [selectedMarketId, selectedLocaleId, selectedProductId],
  );

  if (eligibleMarkets.length === 0) {
    return (
      <PageCard style={{ padding: 24, background: "var(--paper-2)", border: "1px dashed var(--line-strong)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Globe2 size={20} style={{ color: "var(--ink-3)" }} />
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}>
            Crée un marché avec au moins une langue pour activer la prévisualisation traduite.
          </p>
        </div>
      </PageCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid var(--line)",
              backgroundColor: "var(--surface)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: "var(--accent)" }} />
            <Languages size={12} /> Aperçu traduit
          </div>
          <h2
            style={{
              margin: "12px 0 4px",
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
            }}
          >
            Comment vos produits sortiront sur ce marché
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)", maxWidth: 640 }}>
            Sélectionnez un marché, un flux, puis un produit pour voir la version traduite générée
            par l&apos;IA. Le résultat est mis en cache — utilisez « Régénérer » pour forcer un nouvel appel.
          </p>
        </div>
      </div>

      {/* Selectors */}
      <PageCard style={{ padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <SelectField
            label="Marché"
            value={selectedMarketId}
            onChange={setSelectedMarketId}
            disabled={previewing}
            options={eligibleMarkets.map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))}
          />
          <SelectField
            label="Langue"
            value={selectedLocaleId}
            onChange={setSelectedLocaleId}
            disabled={previewing || locales.length <= 1}
            options={locales.map((l) => ({
              value: l.id,
              label: `${l.localeCode}${l.isDefault ? " (défaut)" : ""}`,
            }))}
          />
          <SelectField
            label={`Flux${feedsLoading ? " · chargement…" : ""}`}
            value={selectedFeedId}
            onChange={setSelectedFeedId}
            disabled={previewing || feedsLoading || feeds.length === 0}
            options={feeds.map((f) => ({ value: f.id, label: f.name }))}
            placeholder={feedsError ? feedsError : feeds.length === 0 ? "Aucun flux disponible" : undefined}
          />
          <SelectField
            label={`Produit${productsLoading ? " · chargement…" : ""}`}
            value={selectedProductId}
            onChange={setSelectedProductId}
            disabled={previewing || productsLoading || products.length === 0}
            options={products.map((p) => ({
              value: p.id,
              label: p.sku ? `${p.title} · ${p.sku}` : p.title,
            }))}
            placeholder={
              productsError
                ? productsError
                : !selectedFeedId
                  ? "Choisissez un flux"
                  : products.length === 0
                    ? "Aucun produit dans ce flux"
                    : undefined
            }
          />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <PageButtonPrimary type="button" onClick={() => void runPreview(false)} disabled={!canPreview}>
            <Sparkles size={16} />
            {previewing ? "Génération…" : "Prévisualiser"}
          </PageButtonPrimary>
          {preview && (
            <PageButtonSecondary
              type="button"
              onClick={() => void runPreview(true)}
              disabled={previewing}
              title="Bypass le cache AICache et force un nouvel appel Gemini"
            >
              <RefreshCw size={16} />
              Régénérer
            </PageButtonSecondary>
          )}
        </div>

        {previewError && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--danger)" }}>{previewError}</p>
        )}
      </PageCard>

      {/* Result */}
      {preview && <PreviewResult preview={preview} />}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  placeholder?: string;
}

function SelectField({ label, value, onChange, options, disabled, placeholder }: SelectFieldProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
        }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        style={{
          minHeight: 40,
          padding: "0 12px",
          borderRadius: "var(--r-md)",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          color: "var(--ink)",
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          appearance: "none",
        }}
      >
        {options.length === 0 && (
          <option value="" disabled>
            {placeholder || "—"}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreviewResult({ preview }: { preview: MarketPreviewResponse }) {
  const showImage = !!preview.product.imageUrl;
  return (
    <PageCard style={{ padding: 0, overflow: "hidden" }}>
      {/* Meta row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 20px",
          background: "var(--paper-2)",
          borderBottom: "1px solid var(--line)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--ink-3)",
          letterSpacing: "0.04em",
          flexWrap: "wrap",
        }}
      >
        <span>
          {preview.market.code} · {preview.locale.localeCode} · mode {preview.meta.mode}
        </span>
        <span>
          {preview.meta.cached ? "Depuis le cache" : "Appel Gemini frais"}
          {preview.meta.tokensUsed > 0 ? ` · ~${preview.meta.tokensUsed} tokens` : ""}
        </span>
      </div>

      {preview.warnings && preview.warnings.length > 0 && (
        <div
          style={{
            padding: "10px 20px",
            borderBottom: "1px solid var(--line)",
            background: "var(--warning-bg)",
            color: "var(--warning)",
            fontSize: 13,
          }}
        >
          {preview.warnings.map((w, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : "4px 0 0" }}>
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      {/* Side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--line)" }}>
        <PreviewSide
          eyebrow={`Source · ${preview.meta.sourceLanguage.toUpperCase()}`}
          title={preview.source.title}
          descriptionText={preview.source.descriptionText}
          imageUrl={showImage ? preview.product.imageUrl : null}
          brand={preview.product.brand}
          sku={preview.product.sku}
          price={preview.product.price}
          currency={preview.product.currency}
        />
        <PreviewSide
          eyebrow={`Traduit · ${preview.locale.localeCode.toUpperCase()}`}
          title={preview.translated.title}
          descriptionText={preview.translated.descriptionText}
          imageUrl={showImage ? preview.product.imageUrl : null}
          brand={preview.product.brand}
          sku={preview.product.sku}
          price={preview.product.price}
          currency={preview.product.currency}
          accent
        />
      </div>
    </PageCard>
  );
}

interface PreviewSideProps {
  eyebrow: string;
  title: string;
  descriptionText: string;
  imageUrl: string | null;
  brand: string | null;
  sku: string | null;
  price: number | null;
  currency: string | null;
  accent?: boolean;
}

function PreviewSide({ eyebrow, title, descriptionText, imageUrl, brand, sku, price, currency, accent }: PreviewSideProps) {
  return (
    <div style={{ padding: 22, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 14, minHeight: 240 }}>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: accent ? "var(--accent)" : "var(--ink-3)",
        }}
      >
        {eyebrow}
      </p>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          style={{
            width: "100%",
            maxHeight: 180,
            objectFit: "contain",
            borderRadius: "var(--r-md)",
            background: "var(--paper-2)",
          }}
        />
      )}

      <h3
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.015em",
          color: "var(--ink)",
        }}
      >
        {title || "—"}
      </h3>

      {(brand || sku) && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
          {[brand, sku].filter(Boolean).join(" · ")}
        </p>
      )}

      {descriptionText && (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}>
          {descriptionText}
        </p>
      )}

      {price != null && (
        <p style={{ margin: "auto 0 0", fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink)" }}>
          {price.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {currency || ""}
        </p>
      )}
    </div>
  );
}
