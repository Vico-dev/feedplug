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
} from "lucide-react";
import { API_BASE_URL, authFetch } from "@/lib/api";
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

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const localePrefix = getLocalePrefixFromPathname(pathname);

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("dashboardPage.errorGeneric");
      // "Failed to fetch" = blocage CORS ou réseau (pas de réponse reçue du backend)
      setError(msg === "Failed to fetch" ? t("dashboardPage.errorNetwork") : msg);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return "#16a34a";
    if (score >= 50) return "#d97706";
    return "#dc2626";
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
                  backgroundColor: "#f0f9ff",
                  borderRadius: "2px",
                }}
              >
                <Calendar style={{ width: "24px", height: "24px", color: "#0ea5e9" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "300", color: "#0a0a0a", margin: 0 }}>
                  {t("dashboardPage.lastImport")}
                </h3>
                <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>{t("dashboardPage.sourceSync")}</p>
              </div>
            </div>
          </div>
          <p style={{ fontSize: "15px", fontWeight: "500", color: "#111827", margin: 0 }}>
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
                  backgroundColor: "#f0fdf4",
                  borderRadius: "2px",
                }}
              >
                <Package style={{ width: "24px", height: "24px", color: "#16a34a" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "300", color: "#0a0a0a", margin: 0 }}>
                  {t("dashboardPage.productsImported")}
                </h3>
                <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>{t("dashboardPage.totalCatalogue")}</p>
              </div>
            </div>
            <p style={{ fontSize: "32px", fontWeight: "400", color: "#0a0a0a", margin: 0, lineHeight: 1 }}>
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
                  backgroundColor: "#fef3c7",
                  borderRadius: "2px",
                }}
              >
                <Zap style={{ width: "24px", height: "24px", color: "#d97706" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "300", color: "#0a0a0a", margin: 0 }}>
                  {t("dashboardPage.avgScore")}
                </h3>
                <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
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
                      color: evolutionTrend > 0 ? "#16a34a" : "#dc2626",
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    {evolutionTrend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {evolutionTrend > 0 ? "+" : ""}
                    {evolutionTrend} {t("dashboardPage.evolution30d")}
                  </span>
                  <span style={{ fontSize: "10px", color: "#9ca3af" }}>
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
                  backgroundColor: "#f3f4f6",
                  borderRadius: "2px",
                }}
              >
                <Activity style={{ width: "24px", height: "24px", color: "#4a4a4a" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "300", color: "#0a0a0a", margin: 0 }}>
                  {t("dashboardPage.successfulSyncs")}
                </h3>
                <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>{t("dashboardPage.last10Runs")}</p>
              </div>
            </div>
            <p style={{ fontSize: "32px", fontWeight: "400", color: "#0a0a0a", margin: 0, lineHeight: 1 }}>
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
              <BarChart3 style={{ width: "20px", height: "20px", color: "#6b7280" }} />
              <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: 0 }}>
                {t("dashboardPage.scoreEvolutionTitle")}
              </h2>
            </div>
            <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
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
                color: "#9ca3af",
                fontSize: "13px",
                backgroundColor: "#f9fafb",
                borderRadius: "2px",
              }}
            >
              {t("dashboardPage.evolutionAfterSyncs")}
            </div>
          )}
        </PageCard>

        {/* Enrichissement IA */}
        <PageCard>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <Sparkles style={{ width: "20px", height: "20px", color: "#0ea5e9" }} />
            <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: 0 }}>
              {t("dashboardPage.enrichmentIA")}
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ padding: "16px", backgroundColor: "#f0f9ff", borderRadius: "2px", textAlign: "center" }}>
              <p style={{ fontSize: "28px", fontWeight: "600", color: "#0ea5e9", margin: "0 0 4px" }}>
                {d.enrichment.optimizedTitles}
              </p>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{t("dashboardPage.titlesOptimized")}</p>
            </div>
            <div style={{ padding: "16px", backgroundColor: "#f0fdf4", borderRadius: "2px", textAlign: "center" }}>
              <p style={{ fontSize: "28px", fontWeight: "600", color: "#16a34a", margin: "0 0 4px" }}>
                {d.enrichment.optimizedDescriptions}
              </p>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{t("dashboardPage.descriptionsEnriched")}</p>
            </div>
          </div>
          {d.totalProducts > 0 && (
            <div style={{ marginTop: "16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  color: "#6b7280",
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
                  backgroundColor: "#e5e7eb",
                  borderRadius: "2px",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.round((d.enrichment.optimizedTitles / d.totalProducts) * 100))}%`,
                    height: "6px",
                    backgroundColor: "#0ea5e9",
                    borderRadius: "2px",
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
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: "0 0 16px" }}>
            {t("dashboardPage.summary")}
          </h2>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Database style={{ width: "18px", height: "18px", color: "#6b7280" }} />
              <span style={{ fontSize: "14px", color: "#374151" }}>
                <strong>{d.sources.active}</strong>/{d.sources.total} {t("dashboardPage.sourcesCount")}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Layers style={{ width: "18px", height: "18px", color: "#6b7280" }} />
              <span style={{ fontSize: "14px", color: "#374151" }}>
                <strong>{d.feeds.active}</strong>/{d.feeds.total} {t("dashboardPage.feedsCount")}
              </span>
            </div>
          </div>
        </PageCard>

        {/* Actions rapides — style flux */}
        <PageCard>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: "0 0 16px" }}>
            {t("dashboardPage.quickActions")}
          </h2>
          <div style={{ display: "grid", gap: "12px" }}>
            <a
              href={`${localePrefix}/sources`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px",
                border: "1px solid #e5e7eb",
                borderRadius: "2px",
                textDecoration: "none",
                color: "#374151",
                cursor: "pointer",
                backgroundColor: "white",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Database style={{ width: "18px", height: "18px", color: "#6b7280" }} />
                <span style={{ fontSize: "14px" }}>{t("dashboardPage.addSource")}</span>
              </div>
              <ArrowRight style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
            </a>
            <a
              href={`${localePrefix}/optimiser`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px",
                border: "1px solid #e5e7eb",
                borderRadius: "2px",
                textDecoration: "none",
                color: "#374151",
                cursor: "pointer",
                backgroundColor: "white",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Sparkles style={{ width: "18px", height: "18px", color: "#0ea5e9" }} />
                <span style={{ fontSize: "14px" }}>{t("dashboardPage.optimizeWithIA")}</span>
              </div>
              <ArrowRight style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
            </a>
            <a
              href={`${localePrefix}/flux`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px",
                border: "1px solid #e5e7eb",
                borderRadius: "2px",
                textDecoration: "none",
                color: "#374151",
                cursor: "pointer",
                backgroundColor: "white",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Layers style={{ width: "18px", height: "18px", color: "#6b7280" }} />
                <span style={{ fontSize: "14px" }}>{t("dashboardPage.exportFeed")}</span>
              </div>
              <ArrowRight style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
            </a>
          </div>
        </PageCard>
      </div>

      {/* Dernières synchros — style flux */}
      {d.recentRuns.length > 0 && (
        <PageCard>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: "0 0 16px" }}>
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
                  border: "1px solid #f3f4f6",
                  borderRadius: "2px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {run.status === "SUCCESS" ? (
                    <CheckCircle style={{ width: "16px", height: "16px", color: "#16a34a" }} />
                  ) : run.status === "FAILED" ? (
                    <AlertCircle style={{ width: "16px", height: "16px", color: "#dc2626" }} />
                  ) : (
                    <Loader2 style={{ width: "16px", height: "16px", color: "#d97706" }} />
                  )}
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: "500", color: "#111827", margin: 0 }}>
                      {run.feedname}
                    </p>
                    <p style={{ fontSize: "11px", color: "#6b7280", margin: 0 }}>
                      {run.totalinserted} insérés, {run.totalfetched} récupérés
                      {run.errormessage && ` — ${run.errormessage.substring(0, 60)}`}
                      {run.avgscoreafter != null && ` · Score: ${run.avgscoreafter}`}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>
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
          stroke="#0ea5e9"
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
            fill="#0ea5e9"
          />
        ))}
        <text x={padding.left} y={height - 6} style={{ fontSize: "10px", fill: "#9ca3af" }}>
          {min}
        </text>
        <text x={width - padding.right - 24} y={height - 6} style={{ fontSize: "10px", fill: "#9ca3af" }}>
          {max}
        </text>
      </svg>
    </div>
  );
}
