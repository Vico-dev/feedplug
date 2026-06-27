"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Database,
  Layers,
  Zap,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Loader2,
  Calendar,
  Package,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  TrendingUp,
  Target,
} from "lucide-react";
import { API_BASE_URL, authFetch, apiClient } from "@/lib/api";
import {
  PageLayout,
  PageHeader,
  PageCard,
  PageLoading,
  PageError,
  PageButtonSecondary,
} from "@/components/layout";
import { getLocalePrefixFromPathname } from "@/lib/locale-navigation";
const API_URL = API_BASE_URL;

interface DashboardData {
  sources: { total: number; active: number };
  feeds: { total: number; active: number };
  totalProducts: number;
  avgScore: number;
  lastImportAt: string | null;
  scoreEvolution: { date: string; avgScore: number | null }[];
  runsSuccessRate: number | null;
  enrichment: { optimizedTitles: number; optimizedDescriptions: number };
  recentRuns: {
    status: string;
    totalfetched: number;
    totalinserted: number;
    totalupdated?: number;
    errormessage: string | null;
    finishedat: string | null;
    avgscoreafter?: number | null;
    feedname: string;
  }[];
}

// Issue remonté par /ingestion/catalogue/score (compte entier, sans feedId).
// count = volume réel de produits concernés ; smartView = filtre catalogue ciblé.
interface CatalogueIssue {
  key: string;
  label: string;
  count: number;
  recommendation: string;
  impact?: string;
  smartView?: string | null;
  priority?: "high" | "medium" | "low";
}

interface CatalogueScore {
  globalScore: number;
  totalProducts: number;
  topIssues?: CatalogueIssue[];
}

// Causes qui bloquent réellement la diffusion Google (produit non éligible).
// Sert à chiffrer la douleur « X produits ne passeront pas sur Google ».
const BLOCKING_ISSUE_KEYS = new Set(["missing_category", "missing_image"]);

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const [data, setData] = useState<DashboardData | null>(null);
  const [catalogueScore, setCatalogueScore] = useState<CatalogueScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const localePrefix = getLocalePrefixFromPathname(pathname);

  // Score catalogue agrégé sur tout le compte (même endpoint que le workbench, sans feedId).
  // Fournit les volumes de produits par cause (topIssues) pour héroïser la douleur.
  const fetchCatalogueScore = useCallback(async () => {
    try {
      const response = await apiClient.get<CatalogueScore>("/ingestion/catalogue/score");
      setCatalogueScore(response.data ?? null);
    } catch {
      // Non bloquant : si l'audit échoue, le dashboard reste fonctionnel sans le hero douleur.
      setCatalogueScore(null);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch(`${API_URL}/dashboard/overview`);
      if (res.status === 401) {
        setError(t("dashboardPage.errorAuth"));
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || t("dashboardPage.errorLoad"));
      setData(json);
      void fetchCatalogueScore();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("dashboardPage.errorGeneric");
      // "Failed to fetch" = blocage CORS ou réseau (pas de réponse reçue du backend)
      setError(msg === "Failed to fetch" ? t("dashboardPage.errorNetwork") : msg);
    } finally {
      setLoading(false);
    }
  }, [t, fetchCatalogueScore]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return "var(--success)";
    if (score >= 50) return "var(--warning)";
    return "var(--danger)";
  };

  const formatLastImport = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return `Aujourd'hui à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <PageLayout>
        <PageLoading message={t("dashboardPage.loading")} style={{ paddingTop: 80 }} />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <PageError message={error} onRetry={fetchDashboard} style={{ marginTop: 80 }} />
      </PageLayout>
    );
  }

  const d = data!;
  const hasEvolution = d.scoreEvolution && d.scoreEvolution.length > 1;
  const evolutionTrend = hasEvolution
    ? (d.scoreEvolution[d.scoreEvolution.length - 1]?.avgScore ?? 0) -
      (d.scoreEvolution[0]?.avgScore ?? 0)
    : 0;

  // ---- Douleur chiffrée (P0-2 / P0-4) ----
  // Toutes les valeurs viennent de topIssues (compteurs RÉELS du backend). Aucun chiffre inventé.
  const topIssues = catalogueScore?.topIssues ?? [];
  const issueCount = (key: string) => topIssues.find((i) => i.key === key)?.count ?? 0;
  const missingCategory = issueCount("missing_category");
  const missingImage = issueCount("missing_image");
  // Produits bloqués = ceux concernés par au moins une cause bloquante (catégorie OU image).
  // On ne peut pas dédupliquer côté front (les compteurs sont par cause) → borne basse = max,
  // borne haute = somme. On retient le max comme estimation prudente et honnête.
  const blockedNow = Math.max(missingCategory, missingImage);
  // Causes bloquantes triées par volume, pour l'affichage « 2-3 causes principales ».
  const blockingIssues = topIssues
    .filter((i) => BLOCKING_ISSUE_KEYS.has(i.key) && i.count > 0)
    .sort((a, b) => b.count - a.count);
  // Top causes (toutes, bloquantes ou non) pour le détail du diagnostic.
  const sortedIssues = [...topIssues].filter((i) => i.count > 0).sort((a, b) => b.count - a.count);
  // Projection avant/après : en corrigeant les 2 causes bloquantes principales, combien resteraient bloqués ?
  const topTwoBlocking = blockingIssues.slice(0, 2);
  // Reste bloqué = produits encore concernés par une cause bloquante NON traitée.
  const remainingBlocking = blockingIssues.slice(2);
  const stillBlocked = remainingBlocking.length > 0 ? Math.max(...remainingBlocking.map((i) => i.count)) : 0;
  const wouldBeFixed = Math.max(0, blockedNow - stillBlocked);
  const hasPain = blockedNow > 0 && d.totalProducts > 0;

  // État vide : compte neuf sans aucune source → on guide vers la première
  // action utile au lieu d'un dashboard à zéro (score 0/100 anxiogène).
  if (d.sources.total === 0 && d.totalProducts === 0) {
    return (
      <PageLayout>
        <PageHeader title={t("nav.dashboard")} subtitle={t("dashboardPage.subtitle")} />
        <PageCard>
          <div style={{ textAlign: "center", padding: "48px 24px", maxWidth: 460, margin: "0 auto" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "var(--r-md)",
                backgroundColor: "var(--accent-bg)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <Database style={{ width: 28, height: 28 }} />
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--ink)", margin: "0 0 8px" }}>
              Connectez votre première source
            </h2>
            <p style={{ fontSize: 14, color: "var(--ink-3)", margin: "0 0 24px", lineHeight: 1.6 }}>
              Importez votre catalogue depuis Shopify, un fichier CSV ou une URL. Vous verrez
              aussitôt le score qualité de vos produits et pourrez les optimiser.
            </p>
            <a
              href={`${localePrefix}/sources`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "14px 24px",
                backgroundColor: "var(--accent)",
                color: "#fff",
                borderRadius: "var(--r-md)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              Connecter une source
              <ArrowRight style={{ width: 18, height: 18 }} />
            </a>
          </div>
        </PageCard>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title={t("nav.dashboard")}
        subtitle={t("dashboardPage.subtitle")}
        actions={
          <PageButtonSecondary onClick={fetchDashboard}>
            <RefreshCw style={{ width: 14, height: 14 }} />
            {t("common.refresh")}
          </PageButtonSecondary>
        }
      />

      {/* HERO douleur (P0-2) — révèle le chiffre anxiogène avant tout KPI d'activité.
          Données 100% réelles issues de topIssues (/ingestion/catalogue/score). */}
      {hasPain && (
        <div
          style={{
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-lg, 16px)",
            backgroundColor: "var(--danger-bg, #fef2f2)",
            padding: "28px",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
            <div style={{ minWidth: 0, flex: "1 1 320px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <ShieldAlert style={{ width: 18, height: 18, color: "var(--danger)" }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--danger)" }}>
                  Diagnostic catalogue
                </span>
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, lineHeight: 1.15, color: "var(--ink)", margin: "0 0 8px" }}>
                <span style={{ color: "var(--danger)" }}>{blockedNow.toLocaleString()}</span>{" "}
                produit{blockedNow > 1 ? "s" : ""} ne passeront pas sur Google
              </p>
              <p style={{ fontSize: 14, color: "var(--ink-3)", margin: 0, lineHeight: 1.6, maxWidth: 520 }}>
                Sur {d.totalProducts.toLocaleString()} produits, ces fiches sont bloquées avant
                diffusion. Voici les causes principales à corriger :
              </p>

              {/* 2-3 causes : Cause → Conséquence Google → Action (P1 diagnostic en clair) */}
              {sortedIssues.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: "8px" }}>
                  {sortedIssues.slice(0, 3).map((issue) => (
                    <li
                      key={issue.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        backgroundColor: "white",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--r-md)",
                        padding: "10px 12px",
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          minWidth: 36,
                          textAlign: "center",
                          fontSize: 13,
                          fontWeight: 700,
                          color: BLOCKING_ISSUE_KEYS.has(issue.key) ? "var(--danger)" : "var(--warning)",
                        }}
                      >
                        {issue.count.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
                        <strong style={{ color: "var(--ink)" }}>{issue.label}</strong>
                        {issue.impact ? ` — ${issue.impact}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* CTA unique → catalogue filtré sur les produits à corriger */}
              <a
                href={`${localePrefix}/catalogue?smartView=to_fix`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 20,
                  padding: "13px 22px",
                  backgroundColor: "var(--danger)",
                  color: "#fff",
                  borderRadius: "var(--r-md)",
                  textDecoration: "none",
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                Voir le détail
                <ArrowRight style={{ width: 18, height: 18 }} />
              </a>
            </div>

            {/* Encart « Potentiel » (P0-4) : avant/après honnête basé sur les compteurs réels. */}
            {wouldBeFixed > 0 && topTwoBlocking.length > 0 && (
              <div
                style={{
                  flex: "1 1 260px",
                  maxWidth: 360,
                  backgroundColor: "white",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-md)",
                  padding: "20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <TrendingUp style={{ width: 16, height: 16, color: "var(--success)" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                    Potentiel catalogue
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: "var(--danger)", lineHeight: 1 }}>
                    {blockedNow.toLocaleString()}
                  </span>
                  <ArrowRight style={{ width: 18, height: 18, color: "var(--ink-4)" }} />
                  <span style={{ fontSize: 28, fontWeight: 700, color: "var(--success)", lineHeight: 1 }}>
                    {stillBlocked.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink-3)" }}>bloqués</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "12px 0 0", lineHeight: 1.6 }}>
                  En corrigeant{" "}
                  {topTwoBlocking.map((i, idx) => (
                    <span key={i.key}>
                      {idx > 0 ? " et " : ""}
                      <strong style={{ color: "var(--ink-2)" }}>{i.label.toLowerCase()}</strong>
                    </span>
                  ))}
                  ,{" "}
                  <strong style={{ color: "var(--success)" }}>+{wouldBeFixed.toLocaleString()}</strong> produit
                  {wouldBeFixed > 1 ? "s" : ""} redeviendraient diffusables.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPIs principaux — grille style flux */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        {/* Dernier import */}
        <PageCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "48px",
                  height: "48px",
                  backgroundColor: "var(--accent-bg)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <Calendar style={{ width: "24px", height: "24px", color: "var(--accent)" }} />
              </div>
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.015em", margin: 0 }}>
                  {t("dashboardPage.lastImport")}
                </h3>
                <p style={{ fontSize: "14px", color: "var(--ink-3)", margin: 0 }}>{t("dashboardPage.sourceSync")}</p>
              </div>
            </div>
          </div>
          <p style={{ fontSize: "15px", fontWeight: "500", color: "var(--ink)", margin: 0 }}>
            {formatLastImport(d.lastImportAt)}
          </p>
        </PageCard>

        {/* Nombre total de produits */}
        <PageCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "48px",
                  height: "48px",
                  backgroundColor: "var(--success-soft)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <Package style={{ width: "24px", height: "24px", color: "var(--success)" }} />
              </div>
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.015em", margin: 0 }}>
                  {t("dashboardPage.productsImported")}
                </h3>
                <p style={{ fontSize: "14px", color: "var(--ink-3)", margin: 0 }}>{t("dashboardPage.totalCatalogue")}</p>
              </div>
            </div>
            <p style={{ fontSize: "32px", fontWeight: "400", color: "var(--ink)", margin: 0, lineHeight: 1 }}>
              {d.totalProducts.toLocaleString()}
            </p>
          </div>
        </PageCard>

        {/* Score moyen + tendance */}
        <PageCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "48px",
                  height: "48px",
                  backgroundColor: "var(--warning-soft)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <Zap style={{ width: "24px", height: "24px", color: "var(--warning)" }} />
              </div>
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.015em", margin: 0 }}>
                  {t("dashboardPage.avgScore")}
                </h3>
                <p style={{ fontSize: "14px", color: "var(--ink-3)", margin: 0 }}>
                  {d.avgScore >= 70 ? t("dashboardPage.good") : d.avgScore >= 50 ? t("dashboardPage.toImprove") : t("dashboardPage.toOptimize")}
                </p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "32px", fontWeight: "600", color: getScoreColor(d.avgScore), margin: 0, lineHeight: 1 }}>
                {d.avgScore}/100
              </p>
              {hasEvolution && evolutionTrend !== 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      color: evolutionTrend > 0 ? "var(--success)" : "var(--danger)",
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    {evolutionTrend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {evolutionTrend > 0 ? "+" : ""}
                    {evolutionTrend} {t("dashboardPage.evolution30d")}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--ink-4)" }}>
                    {t("dashboardPage.trendBasedOnSyncs")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </PageCard>

        {/* Taux de succès synchros */}
        <PageCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "48px",
                  height: "48px",
                  backgroundColor: "var(--paper-2)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <Activity style={{ width: "24px", height: "24px", color: "var(--ink-2)" }} />
              </div>
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.015em", margin: 0 }}>
                  {t("dashboardPage.successfulSyncs")}
                </h3>
                <p style={{ fontSize: "14px", color: "var(--ink-3)", margin: 0 }}>{t("dashboardPage.last10Runs")}</p>
              </div>
            </div>
            <p style={{ fontSize: "32px", fontWeight: "400", color: "var(--ink)", margin: 0, lineHeight: 1 }}>
              {d.runsSuccessRate != null ? `${d.runsSuccessRate}%` : "—"}
            </p>
          </div>
        </PageCard>
      </div>

      {/* Score moyen + Évolution sur 30j + Enrichissement */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "32px" }}>
        {/* Graphique évolution du score */}
        <PageCard>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <BarChart3 style={{ width: "20px", height: "20px", color: "var(--ink-3)" }} />
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em", margin: 0 }}>
                {t("dashboardPage.scoreEvolutionTitle")}
              </h2>
            </div>
            <p style={{ fontSize: "12px", color: "var(--ink-3)", margin: 0 }}>
              {t("dashboardPage.evolutionChartHint")}
            </p>
          </div>
          {hasEvolution ? (
            <ScoreEvolutionChart data={d.scoreEvolution} />
          ) : (
            <div
              style={{
                height: "160px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink-4)",
                fontSize: "13px",
                backgroundColor: "var(--paper-2)",
                borderRadius: "var(--r-md)",
              }}
            >
              {t("dashboardPage.evolutionAfterSyncs")}
            </div>
          )}
        </PageCard>

        {/* Enrichissement IA */}
        <PageCard>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <Sparkles style={{ width: "20px", height: "20px", color: "var(--accent)" }} />
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em", margin: 0 }}>
              {t("dashboardPage.enrichmentIA")}
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ padding: "16px", backgroundColor: "var(--accent-bg)", borderRadius: "var(--r-md)", textAlign: "center" }}>
              <p style={{ fontSize: "28px", fontWeight: "600", color: "var(--accent)", margin: "0 0 4px" }}>
                {d.enrichment.optimizedTitles}
              </p>
              <p style={{ fontSize: "12px", color: "var(--ink-3)", margin: 0 }}>{t("dashboardPage.titlesOptimized")}</p>
            </div>
            <div style={{ padding: "16px", backgroundColor: "var(--success-soft)", borderRadius: "var(--r-md)", textAlign: "center" }}>
              <p style={{ fontSize: "28px", fontWeight: "600", color: "var(--success)", margin: "0 0 4px" }}>
                {d.enrichment.optimizedDescriptions}
              </p>
              <p style={{ fontSize: "12px", color: "var(--ink-3)", margin: 0 }}>{t("dashboardPage.descriptionsEnriched")}</p>
            </div>
          </div>
          {d.totalProducts > 0 && (
            <div style={{ marginTop: "16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  color: "var(--ink-3)",
                  marginBottom: "6px",
                }}
              >
                <span>{t("dashboardPage.titleCoverage")}</span>
                <span>{Math.round((d.enrichment.optimizedTitles / d.totalProducts) * 100)}%</span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "6px",
                  backgroundColor: "var(--line)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.round((d.enrichment.optimizedTitles / d.totalProducts) * 100))}%`,
                    height: "6px",
                    backgroundColor: "var(--accent)",
                    borderRadius: "var(--r-md)",
                  }}
                />
              </div>
            </div>
          )}
        </PageCard>
      </div>

      {/* Sources / Flux résumé + Actions rapides */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "32px" }}>
        <PageCard>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em", margin: "0 0 16px" }}>
            {t("dashboardPage.summary")}
          </h2>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Database style={{ width: "18px", height: "18px", color: "var(--ink-3)" }} />
              <span style={{ fontSize: "14px", color: "var(--ink-2)" }}>
                <strong>{d.sources.active}</strong>/{d.sources.total} {t("dashboardPage.sourcesCount")}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Layers style={{ width: "18px", height: "18px", color: "var(--ink-3)" }} />
              <span style={{ fontSize: "14px", color: "var(--ink-2)" }}>
                <strong>{d.feeds.active}</strong>/{d.feeds.total} {t("dashboardPage.feedsCount")}
              </span>
            </div>
          </div>
        </PageCard>

        {/* Actions rapides — style flux */}
        <PageCard>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em", margin: "0 0 16px" }}>
            {t("dashboardPage.quickActions")}
          </h2>
          <div style={{ display: "grid", gap: "12px" }}>
            <a
              href={`${localePrefix}/catalogue?smartView=to_fix`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-md)",
                textDecoration: "none",
                color: "var(--ink-2)",
                cursor: "pointer",
                backgroundColor: "white",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Target style={{ width: "18px", height: "18px", color: "var(--danger)" }} />
                <span style={{ fontSize: "14px" }}>Corriger les produits bloqués</span>
              </div>
              <ArrowRight style={{ width: "16px", height: "16px", color: "var(--ink-4)" }} />
            </a>
            <a
              href={`${localePrefix}/sources`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-md)",
                textDecoration: "none",
                color: "var(--ink-2)",
                cursor: "pointer",
                backgroundColor: "white",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Database style={{ width: "18px", height: "18px", color: "var(--ink-3)" }} />
                <span style={{ fontSize: "14px" }}>{t("dashboardPage.addSource")}</span>
              </div>
              <ArrowRight style={{ width: "16px", height: "16px", color: "var(--ink-4)" }} />
            </a>
            <a
              href={`${localePrefix}/optimiser`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-md)",
                textDecoration: "none",
                color: "var(--ink-2)",
                cursor: "pointer",
                backgroundColor: "white",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Sparkles style={{ width: "18px", height: "18px", color: "var(--accent)" }} />
                <span style={{ fontSize: "14px" }}>{t("dashboardPage.optimizeWithIA")}</span>
              </div>
              <ArrowRight style={{ width: "16px", height: "16px", color: "var(--ink-4)" }} />
            </a>
            <a
              href={`${localePrefix}/flux`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-md)",
                textDecoration: "none",
                color: "var(--ink-2)",
                cursor: "pointer",
                backgroundColor: "white",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Layers style={{ width: "18px", height: "18px", color: "var(--ink-3)" }} />
                <span style={{ fontSize: "14px" }}>{t("dashboardPage.exportFeed")}</span>
              </div>
              <ArrowRight style={{ width: "16px", height: "16px", color: "var(--ink-4)" }} />
            </a>
          </div>
        </PageCard>
      </div>

      {/* Dernières synchros — style flux */}
      {d.recentRuns.length > 0 && (
        <PageCard>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em", margin: "0 0 16px" }}>
            Dernières synchronisations
          </h2>
          <div style={{ display: "grid", gap: "8px" }}>
            {d.recentRuns.map((run, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  border: "1px solid var(--paper-2)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {run.status === "SUCCESS" ? (
                    <CheckCircle style={{ width: "16px", height: "16px", color: "var(--success)" }} />
                  ) : run.status === "FAILED" ? (
                    <AlertCircle style={{ width: "16px", height: "16px", color: "var(--danger)" }} />
                  ) : (
                    <Loader2 style={{ width: "16px", height: "16px", color: "var(--warning)" }} />
                  )}
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: "500", color: "var(--ink)", margin: 0 }}>
                      {run.feedname}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--ink-3)", margin: 0 }}>
                      {run.totalinserted} insérés, {run.totalfetched} récupérés
                      {run.errormessage && ` — ${run.errormessage.substring(0, 60)}`}
                      {run.avgscoreafter != null && ` · Score: ${run.avgscoreafter}`}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: "11px", color: "var(--ink-4)" }}>
                  {run.finishedat
                    ? new Date(run.finishedat).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </PageCard>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </PageLayout>
  );
}

function ScoreEvolutionChart({ data }: { data: { date: string; avgScore: number | null }[] }) {
  const points = data.filter((d) => d.avgScore != null) as { date: string; avgScore: number }[];
  if (points.length === 0) return null;

  const scores = points.map((p) => p.avgScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const width = 400;
  const height = 140;
  const padding = { top: 10, right: 10, bottom: 24, left: 32 };

  const xScale = (i: number) => padding.left + (i / Math.max(1, points.length - 1)) * (width - padding.left - padding.right);
  const yScale = (score: number) =>
    padding.top + height - padding.top - padding.bottom - ((score - min) / range) * (height - padding.top - padding.bottom);

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(p.avgScore)}`)
    .join(" ");

  return (
    <div style={{ width: "100%", overflow: "auto" }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        <path
          d={pathD}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(p.avgScore)}
            r="3"
            fill="var(--accent)"
          />
        ))}
        <text x={padding.left} y={height - 6} style={{ fontSize: "10px", fill: "var(--ink-4)" }}>
          {min}
        </text>
        <text x={width - padding.right - 24} y={height - 6} style={{ fontSize: "10px", fill: "var(--ink-4)" }}>
          {max}
        </text>
      </svg>
    </div>
  );
}
