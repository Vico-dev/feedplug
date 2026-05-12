"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  Package,
  RefreshCw,
  Link2,
  Unplug,
  Loader2,
} from "lucide-react";
import {
  DashboardSection,
  DashboardStatCard,
  DashboardStatGrid,
  PageButtonPrimary,
  PageButtonSecondary,
  PageCard,
  PageError,
  PageHeader,
  PageLayout,
  PageLoading,
} from "@/components/layout";
import { getLocalePrefixFromPathname } from "@/lib/locale-navigation";
import { apiClient } from "@/lib/api";

const CHANNEL_LABELS: Record<string, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  AMAZON: "Amazon",
};

interface ChannelStats {
  channel: string;
  impressions: number;
  clicks: number;
  cost: number;
  revenue: number;
  roas: number;
  productCount: number;
}

interface ProductRow {
  itemId: string;
  title: string;
  sku: string | null;
  channel: string;
  channelScore: number;
  metrics: Record<string, unknown>;
}

interface CategoryRow {
  category: string;
  channel: string;
  cost: number;
  revenue: number;
  roas: number;
  productCount: number;
}

interface DashboardData {
  byChannel: ChannelStats[];
  topProducts: ProductRow[];
  byCategory: CategoryRow[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

export default function PerformancePage() {
  const pathname = usePathname();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleAdsStatus, setGoogleAdsStatus] = useState<{ connected: boolean; customerId?: string; email?: string }>({ connected: false });
  const [googleAdsLoading, setGoogleAdsLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const localePrefix = getLocalePrefixFromPathname(pathname);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncSearch = () => setLocationSearch(window.location.search);
    syncSearch();
    window.addEventListener("popstate", syncSearch);
    return () => window.removeEventListener("popstate", syncSearch);
  }, []);

  const fetchGoogleAdsStatus = useCallback(async () => {
    try {
      const res = await apiClient.get<{ connected: boolean; customerId?: string; email?: string }>("/platforms/google-ads/status");
      setGoogleAdsStatus(res.data || { connected: false });
    } catch {
      setGoogleAdsStatus({ connected: false });
    }
  }, []);

  useEffect(() => {
    fetchGoogleAdsStatus();
  }, [fetchGoogleAdsStatus]);

  const connectGoogleAds = async () => {
    setGoogleAdsLoading(true);
    setConnectionMessage(null);
    try {
      const res = await apiClient.get<{ authUrl: string }>("/platforms/google-ads/auth-url");
      if (res.data?.authUrl) window.location.href = res.data.authUrl;
      else setConnectionMessage("URL d’autorisation indisponible.");
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Impossible de démarrer la connexion.";
      setConnectionMessage(msg);
    } finally {
      setGoogleAdsLoading(false);
    }
  };

  const disconnectGoogleAds = async () => {
    if (!confirm("Déconnecter Google Ads ?")) return;
    setGoogleAdsLoading(true);
    setConnectionMessage(null);
    try {
      await apiClient.delete("/platforms/google-ads/disconnect");
      setGoogleAdsStatus({ connected: false });
      setConnectionMessage("Google Ads déconnecté.");
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Erreur lors de la déconnexion.";
      setConnectionMessage(msg);
    } finally {
      setGoogleAdsLoading(false);
    }
  };

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<DashboardData>("/performance/dashboard");
      setData(res.data);
    } catch (err: unknown) {
      const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 0;
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : String(err);
      const detail = status === 401
        ? "Session expirée ou token invalide. Déconnectez-vous puis reconnectez-vous."
        : status === 403
          ? "Accès refusé (compte non associé au token)."
          : msg || "Impossible de charger les données.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncGoogleAds = async () => {
    setSyncLoading(true);
    setConnectionMessage(null);
    try {
      const res = await apiClient.post<{ ok: boolean; synced?: number; skipped?: number; errors?: string[] }>("/performance/sync/google-ads");
      const d = res.data;
      const msg = d?.errors?.length ? `Sync terminé avec des erreurs: ${d.errors.slice(0, 3).join("; ")}` : `Synchronisation terminée. ${d?.synced ?? 0} produits mis à jour.`;
      setConnectionMessage(msg);
      fetchDashboard();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Erreur lors de la synchronisation.";
      setConnectionMessage(msg);
    } finally {
      setSyncLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const searchParams = new URLSearchParams(locationSearch);
    const ga = searchParams.get("google_ads");
    const err = searchParams.get("error");
    if (ga === "connected") {
      setConnectionMessage("Google Ads connecté. Vous pouvez lancer une synchronisation.");
      fetchGoogleAdsStatus();
      fetchDashboard();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (err) {
      setConnectionMessage(err === "oauth_failed" ? `Connexion échouée: ${searchParams.get("message") || "erreur inconnue"}` : "Erreur de connexion.");
    }
  }, [locationSearch, fetchGoogleAdsStatus, fetchDashboard]);

  if (loading) {
    return (
      <PageLayout>
        <PageLoading message="Chargement des donnees de performance..." style={{ minHeight: "40vh" }} />
      </PageLayout>
    );
  }
  if (error) {
    return (
      <PageLayout>
        <PageError message={error} onRetry={fetchDashboard} />
      </PageLayout>
    );
  }

  const byChannel = data?.byChannel ?? [];
  const topProducts = data?.topProducts ?? [];
  const byCategory = data?.byCategory ?? [];
  const totals = byChannel.reduce(
    (acc, row) => {
      acc.cost += row.cost;
      acc.revenue += row.revenue;
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      return acc;
    },
    { cost: 0, revenue: 0, impressions: 0, clicks: 0 }
  );
  const globalRoas = totals.cost > 0 ? totals.revenue / totals.cost : 0;

  return (
    <PageLayout>
      <PageHeader
        title="Performance commerciale"
        subtitle="Analyse des performances par plateforme, par produit et par catégorie. ROAS, coûts et revenus."
        icon={BarChart3}
        actions={
          <PageButtonSecondary onClick={fetchDashboard}>
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </PageButtonSecondary>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <DashboardStatGrid>
          <DashboardStatCard
            icon={<TrendingUp size={20} />}
            label="Revenus attribues"
            value={formatCurrency(totals.revenue)}
            hint="Valeur remontee par les plateformes connectees"
            accent="var(--success)"
          />
          <DashboardStatCard
            icon={<BarChart3 size={20} />}
            label="ROAS moyen"
            value={globalRoas > 0 ? `${globalRoas.toFixed(2)}x` : "—"}
            hint={totals.cost > 0 ? `${formatCurrency(totals.cost)} investis` : "Aucune depense synchronisee"}
            accent="#2A6FE8"
          />
          <DashboardStatCard
            icon={<Package size={20} />}
            label="Produits suivis"
            value={byChannel.reduce((sum, row) => sum + row.productCount, 0)}
            hint="Produits relies a des donnees de performance"
            accent="var(--accent)"
          />
        </DashboardStatGrid>

        <DashboardSection title="Connexion Google Ads" description="Connectez Google Ads pour synchroniser les impressions, clics, depenses et revenus du catalogue.">
          <PageCard style={{ padding: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              {googleAdsStatus.connected ? (
                <>
                  <span style={{ fontSize: 14, color: "var(--app-text-muted)" }}>
                    Connecte {googleAdsStatus.customerId ? `(compte ${googleAdsStatus.customerId})` : ""} {googleAdsStatus.email ? `- ${googleAdsStatus.email}` : ""}
                  </span>
                  <PageButtonSecondary onClick={syncGoogleAds} disabled={syncLoading}>
                    {syncLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Synchroniser les donnees
                  </PageButtonSecondary>
                  <PageButtonSecondary onClick={disconnectGoogleAds} disabled={googleAdsLoading} style={{ color: "var(--app-danger)", borderColor: "#fecaca" }}>
                    {googleAdsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                    Deconnecter
                  </PageButtonSecondary>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 14, color: "var(--app-text-muted)", flex: "1 1 320px" }}>
                    Connectez votre compte Google Ads pour importer les metriques Shopping dans ce dashboard.
                  </span>
                  <PageButtonPrimary onClick={connectGoogleAds} disabled={googleAdsLoading}>
                    {googleAdsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    Connecter Google Ads
                  </PageButtonPrimary>
                </>
              )}
            </div>
            {connectionMessage && (
              <p
                style={{
                  margin: "14px 0 0",
                  fontSize: 14,
                  color:
                    connectionMessage.startsWith("Erreur") || connectionMessage.startsWith("Connexion échouée")
                      ? "var(--app-danger)"
                      : "var(--app-text-muted)",
                }}
              >
                {connectionMessage}
              </p>
            )}
          </PageCard>
        </DashboardSection>

        <DashboardSection title="Performance par plateforme" description="Lecture rapide des depenses, revenus et volumes par canal connecte.">
          {byChannel.length === 0 ? (
            <PageCard className="p-6 text-center text-gray-500">
              Aucune donnée de performance pour le moment. Connectez Google Ads ci-dessus puis lancez une synchronisation, ou configurez Meta Ads / Amazon Ads.
            </PageCard>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {byChannel.map((row) => (
                <PageCard key={row.channel} className="p-5">
                  <div className="mb-3 font-semibold text-gray-900">
                    {CHANNEL_LABELS[row.channel] ?? row.channel}
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dépenses</span>
                      <span className="font-medium">{formatCurrency(row.cost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Revenus</span>
                      <span className="font-medium text-green-600">{formatCurrency(row.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">ROAS</span>
                      <span className="font-medium">{row.roas > 0 ? `${row.roas.toFixed(2)}×` : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Impressions</span>
                      <span>{formatNumber(row.impressions)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Clics</span>
                      <span>{formatNumber(row.clicks)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Produits</span>
                      <span>{row.productCount}</span>
                    </div>
                  </dl>
                </PageCard>
              ))}
            </div>
          )}
        </DashboardSection>

        <DashboardSection title="Top produits" description="Produits avec le plus de revenus remontes par les plateformes.">
          {topProducts.length === 0 ? (
            <PageCard className="p-6 text-center text-gray-500">
              Aucun produit avec des métriques pour le moment.
            </PageCard>
          ) : (
            <PageCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Produit</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Plateforme</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Score</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Impressions</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Clics</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Coût</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Revenus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {topProducts.map((p) => {
                      const m = p.metrics as Record<string, number>;
                      const cost = Number(m?.cost ?? m?.spend ?? 0);
                      const revenue = Number(m?.revenue ?? m?.conversions_value ?? 0);
                      return (
                        <tr key={`${p.itemId}-${p.channel}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link href={`${localePrefix}/catalogue/${p.itemId}`} prefetch={false} className="font-medium text-blue-600 hover:underline">
                              {(p.title || p.sku || p.itemId).toString().slice(0, 50)}
                              {(p.title || "").length > 50 ? "…" : ""}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{CHANNEL_LABELS[p.channel] ?? p.channel}</td>
                          <td className="px-4 py-3 text-right">{p.channelScore}</td>
                          <td className="px-4 py-3 text-right">{formatNumber(Number(m?.impressions ?? 0))}</td>
                          <td className="px-4 py-3 text-right">{formatNumber(Number(m?.clicks ?? 0))}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(cost)}</td>
                          <td className="px-4 py-3 text-right text-green-600">{formatCurrency(revenue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </PageCard>
          )}
        </DashboardSection>

        <DashboardSection title="Performance par categorie" description="Vision categorie x plateforme pour identifier les segments a prioriser.">
          {byCategory.length === 0 ? (
            <PageCard className="p-6 text-center text-gray-500">
              Aucune donnée par catégorie. Les catégories proviennent du champ catalogue (google_product_category ou category).
            </PageCard>
          ) : (
            <PageCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Catégorie</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Plateforme</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Coût</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Revenus</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">ROAS</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Produits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {byCategory.map((r, i) => (
                      <tr key={`${r.category}-${r.channel}-${i}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{r.category}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{CHANNEL_LABELS[r.channel] ?? r.channel}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(r.cost)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{formatCurrency(r.revenue)}</td>
                        <td className="px-4 py-3 text-right">{r.roas > 0 ? `${r.roas.toFixed(2)}×` : "—"}</td>
                        <td className="px-4 py-3 text-right">{r.productCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PageCard>
          )}
        </DashboardSection>

        <p className="text-sm text-gray-500">
          Les données proviennent des synchronisations Google Ads, Meta Ads et Amazon. Utilisez le scoring par canal pour pondérer qualité et performance.
        </p>
      </div>
    </PageLayout>
  );
}
