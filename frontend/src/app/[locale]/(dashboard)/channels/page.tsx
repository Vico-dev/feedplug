"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle,
  Globe,
  Search,
  ShoppingCart,
  XCircle,
} from "lucide-react";
import {
  PageLayout,
  PageHeader,
  PageCard,
  PageButtonPrimary,
  PageButtonSecondary,
  PageButtonDanger,
  PageLoading,
  DashboardStatGrid,
  DashboardStatCard,
  StatusBadge,
} from "@/components/layout";
import {
  AMAZON_EXPORT_CHANNELS,
  getGmcStatus,
  getGmcLastPush,
  getGmcAuthUrl,
  disconnectGmc,
  syncGmc,
  getGmcSelection,
  confirmGmcSelection,
  getAmazonStatus,
  getAmazonChannels,
  connectAmazon,
  disconnectAmazon,
  toggleAmazonChannel,
  getGoogleAdsStatus,
  getGoogleAdsAuthUrl,
  disconnectGoogleAds,
  type GmcStatus,
  type GmcLastPush,
  type GmcSelectionPayload,
  type GoogleAdsStatus,
  type AmazonStatus,
  type AmazonChannel,
} from "@/lib/services/platforms.service";

type GmcSelectionState = GmcSelectionPayload & { selectedMerchantId: string };
type ToastType = "success" | "error" | "info";

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Carte plateforme : titre + badge de statut + description + contenu. */
function PlatformCard({
  title,
  connected,
  badgeConnected = "Connecté",
  badgeDisconnected = "À connecter",
  badgeVariant,
  description,
  icon,
  children,
}: {
  title: string;
  connected: boolean;
  badgeConnected?: string;
  badgeDisconnected?: string;
  badgeVariant?: "success" | "error" | "warning" | "neutral";
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageCard style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              flexShrink: 0,
              backgroundColor: connected ? "var(--accent-bg)" : "var(--paper-2)",
              color: connected ? "var(--accent)" : "var(--ink-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{title}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--ink-3)" }}>{description}</p>
          </div>
        </div>
        <StatusBadge variant={badgeVariant ?? (connected ? "success" : "warning")}>
          {connected ? badgeConnected : badgeDisconnected}
        </StatusBadge>
      </div>
      {children}
    </PageCard>
  );
}

const infoLine: React.CSSProperties = { margin: 0, fontSize: 13, color: "var(--ink-3)" };

export default function ChannelsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const channelsPath = `/${locale}/channels`;

  const [loading, setLoading] = useState(true);
  const [gmcStatus, setGmcStatus] = useState<GmcStatus>({ connected: false });
  const [gmcLastPush, setGmcLastPush] = useState<GmcLastPush | null>(null);
  const [googleAdsStatus, setGoogleAdsStatus] = useState<GoogleAdsStatus>({ connected: false });
  const [amazonStatus, setAmazonStatus] = useState<AmazonStatus>({ connected: false });
  const [amazonChannels, setAmazonChannels] = useState<AmazonChannel[]>([]);
  const [gmcSelection, setGmcSelection] = useState<GmcSelectionState | null>(null);

  const [gmcLoading, setGmcLoading] = useState(false);
  const [gmcSyncing, setGmcSyncing] = useState(false);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [googleAdsLoading, setGoogleAdsLoading] = useState(false);
  const [amazonLoading, setAmazonLoading] = useState(false);
  const [marketplaceLoadingKey, setMarketplaceLoadingKey] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    const [gmc, lastPush, ads, amazon, channels] = await Promise.allSettled([
      getGmcStatus(),
      getGmcLastPush(),
      getGoogleAdsStatus(),
      getAmazonStatus(),
      getAmazonChannels(),
    ]);
    setGmcStatus(gmc.status === "fulfilled" ? gmc.value : { connected: false });
    setGmcLastPush(lastPush.status === "fulfilled" ? lastPush.value : null);
    setGoogleAdsStatus(ads.status === "fulfilled" ? ads.value : { connected: false });
    setAmazonStatus(amazon.status === "fulfilled" ? amazon.value : { connected: false });
    setAmazonChannels(channels.status === "fulfilled" ? channels.value : []);
    setLoading(false);
  }, []);

  const loadGmcSelection = useCallback(
    async (selectionId: string) => {
      try {
        const payload = await getGmcSelection(selectionId);
        if (!payload) return;
        setGmcSelection({ ...payload, selectedMerchantId: payload.merchants[0]?.merchantId || "" });
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Impossible de charger la sélection Merchant Center.", "error");
      }
    },
    [showToast]
  );

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Retour des flux OAuth (?amazon=..., ?gmc=..., ?google_ads=...)
  useEffect(() => {
    const gmc = searchParams.get("gmc");
    const amazon = searchParams.get("amazon");
    const googleAds = searchParams.get("google_ads");
    const selection = searchParams.get("selection");
    const reason = searchParams.get("reason");
    if (!gmc && !amazon && !googleAds) return;

    let cleanup = false;
    if (gmc === "connected") {
      showToast("Google Merchant Center connecté.", "success");
      void refreshAll();
      cleanup = true;
    } else if (gmc === "error") {
      showToast("La connexion Google Merchant Center a échoué.", "error");
      cleanup = true;
    } else if (gmc === "select" && selection) {
      void loadGmcSelection(selection);
      cleanup = true;
    }
    if (amazon === "connected") {
      showToast("Amazon connecté. Activez les marketplaces utiles pour vos pushes.", "success");
      void refreshAll();
      cleanup = true;
    } else if (amazon === "error") {
      showToast("La connexion Amazon a échoué" + (reason ? ` (${reason}).` : "."), "error");
      cleanup = true;
    }
    if (googleAds === "connected") {
      showToast("Google Ads connecté.", "success");
      void refreshAll();
      cleanup = true;
    } else if (googleAds === "error") {
      showToast("La connexion Google Ads a échoué.", "error");
      cleanup = true;
    }
    if (cleanup) {
      router.replace(channelsPath);
    }
  }, [searchParams, showToast, refreshAll, loadGmcSelection, router, channelsPath]);

  // ── GMC ──
  const handleConnectGmc = async () => {
    setGmcLoading(true);
    try {
      const url = await getGmcAuthUrl(locale, channelsPath);
      if (!url) throw new Error("URL de connexion Google Merchant Center indisponible.");
      window.location.href = url;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Connexion Google Merchant Center impossible.", "error");
    } finally {
      setGmcLoading(false);
    }
  };

  const handleDisconnectGmc = async () => {
    if (typeof window !== "undefined" && !window.confirm("Déconnecter Google Merchant Center ?")) return;
    setGmcLoading(true);
    try {
      await disconnectGmc();
      setGmcSelection(null);
      await refreshAll();
      showToast("Google Merchant Center déconnecté.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Déconnexion impossible.", "error");
    } finally {
      setGmcLoading(false);
    }
  };

  const handleSyncGmc = async () => {
    setGmcSyncing(true);
    try {
      const result = await syncGmc();
      const failed = result.failed ?? 0;
      const succeeded = result.succeeded ?? 0;
      showToast(
        result.message || `Synchronisation terminée : ${succeeded} produits envoyés, ${failed} erreurs.`,
        failed > 0 && succeeded === 0 ? "error" : "success"
      );
      setGmcLastPush(await getGmcLastPush());
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Synchronisation Merchant Center impossible.", "error");
    } finally {
      setGmcSyncing(false);
    }
  };

  const handleConfirmGmcSelection = async () => {
    if (!gmcSelection?.selectionId || !gmcSelection.selectedMerchantId) {
      showToast("Sélection Merchant Center invalide.", "error");
      return;
    }
    setSelectionLoading(true);
    try {
      await confirmGmcSelection(gmcSelection.selectionId, gmcSelection.selectedMerchantId);
      setGmcSelection(null);
      await refreshAll();
      showToast("Merchant Center sélectionné. FeedPlug est prêt pour Google Shopping.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Impossible de finaliser la connexion.", "error");
    } finally {
      setSelectionLoading(false);
    }
  };

  // ── Amazon ──
  const handleConnectAmazon = async () => {
    setAmazonLoading(true);
    try {
      const result = await connectAmazon(channelsPath);
      if (result.kind === "redirect") {
        window.location.href = result.url;
        return;
      }
      // SP-API pas encore activé → message neutre, pas une erreur.
      showToast(result.message, "info");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Connexion Amazon impossible.";
      if (/oauth\s*non\s*configur/i.test(message)) {
        showToast("La connexion Amazon Seller Central arrive bientôt sur FeedPlug.", "info");
      } else {
        showToast(message, "error");
      }
    } finally {
      setAmazonLoading(false);
    }
  };

  const handleDisconnectAmazon = async () => {
    if (typeof window !== "undefined" && !window.confirm("Déconnecter Amazon Seller Central ?")) return;
    setAmazonLoading(true);
    try {
      await disconnectAmazon();
      await refreshAll();
      showToast("Amazon déconnecté.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Déconnexion Amazon impossible.", "error");
    } finally {
      setAmazonLoading(false);
    }
  };

  const handleToggleMarketplace = async (channelKey: string, enabled: boolean) => {
    setMarketplaceLoadingKey(channelKey);
    try {
      await toggleAmazonChannel(channelKey, enabled);
      showToast(`${channelKey.toUpperCase()} ${enabled ? "activé" : "désactivé"} pour Amazon.`, "success");
      await refreshAll();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Impossible de modifier ce canal Amazon.", "error");
    } finally {
      setMarketplaceLoadingKey(null);
    }
  };

  // ── Google Ads ──
  const handleConnectGoogleAds = async () => {
    setGoogleAdsLoading(true);
    try {
      const url = await getGoogleAdsAuthUrl(channelsPath);
      if (!url) throw new Error("URL de connexion Google Ads indisponible.");
      window.location.href = url;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Connexion Google Ads impossible.", "error");
    } finally {
      setGoogleAdsLoading(false);
    }
  };

  const handleDisconnectGoogleAds = async () => {
    if (typeof window !== "undefined" && !window.confirm("Déconnecter Google Ads ?")) return;
    setGoogleAdsLoading(true);
    try {
      await disconnectGoogleAds();
      await refreshAll();
      showToast("Google Ads déconnecté.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Déconnexion Google Ads impossible.", "error");
    } finally {
      setGoogleAdsLoading(false);
    }
  };

  const connectedCount = useMemo(
    () => [gmcStatus.connected, amazonStatus.connected, googleAdsStatus.connected].filter(Boolean).length,
    [gmcStatus.connected, amazonStatus.connected, googleAdsStatus.connected]
  );

  return (
    <PageLayout>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 100,
            padding: "14px 20px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            maxWidth: 460,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            backgroundColor:
              toast.type === "success" ? "var(--success-bg)" : toast.type === "error" ? "var(--danger-bg)" : "var(--accent-bg)",
            color: toast.type === "success" ? "var(--success)" : toast.type === "error" ? "var(--danger)" : "var(--accent-2)",
          }}
        >
          {toast.type === "success" ? (
            <CheckCircle style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
          ) : toast.type === "error" ? (
            <AlertCircle style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
          ) : (
            <Activity style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
          )}
          <span style={{ flex: 1, whiteSpace: "pre-line" }}>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, opacity: 0.6 }}
          >
            <XCircle style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}

      <PageHeader
        title="Canaux"
        subtitle="Connectez les destinations marketing vers lesquelles votre catalogue est diffusé."
        icon={Globe}
      />

      {loading ? (
        <PageLoading message="Chargement des connexions…" />
      ) : (
        <>
      <div style={{ marginBottom: 20 }}>
        <DashboardStatGrid>
          <DashboardStatCard icon={<Globe size={18} />} label="Connexions actives" value={`${connectedCount}/3`} accent="var(--accent)" />
          <DashboardStatCard
            icon={<ShoppingCart size={18} />}
            label="Marketplaces Amazon"
            value={amazonChannels.length}
            accent="var(--accent)"
          />
          <DashboardStatCard icon={<Search size={18} />} label="Bing Shopping" value="Prêt" />
        </DashboardStatGrid>
      </div>

      {gmcSelection && (
        <PageCard style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>Choisir votre Merchant Center</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
              Plusieurs comptes Merchant Center ont été trouvés pour {gmcSelection.email || "ce compte Google"}. Sélectionnez celui à
              utiliser pour FeedPlug.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {gmcSelection.merchants.map((merchant) => {
              const selected = gmcSelection.selectedMerchantId === merchant.merchantId;
              return (
                <div
                  key={merchant.merchantId}
                  style={{
                    border: `1px solid ${selected ? "var(--accent)" : "var(--line)"}`,
                    borderRadius: "var(--r-lg)",
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                      {merchant.merchantName || merchant.label || `Merchant Center ${merchant.merchantId}`}
                    </p>
                    <p style={{ ...infoLine, marginTop: 2 }}>ID {merchant.merchantId}</p>
                  </div>
                  {selected ? (
                    <PageButtonPrimary
                      onClick={() => setGmcSelection((prev) => (prev ? { ...prev, selectedMerchantId: merchant.merchantId } : prev))}
                    >
                      Sélectionné
                    </PageButtonPrimary>
                  ) : (
                    <PageButtonSecondary
                      onClick={() => setGmcSelection((prev) => (prev ? { ...prev, selectedMerchantId: merchant.merchantId } : prev))}
                    >
                      Choisir
                    </PageButtonSecondary>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <PageButtonPrimary disabled={selectionLoading} onClick={() => void handleConfirmGmcSelection()}>
              Confirmer ce Merchant Center
            </PageButtonPrimary>
            <PageButtonSecondary onClick={() => setGmcSelection(null)}>Plus tard</PageButtonSecondary>
          </div>
        </PageCard>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
        {/* Google Merchant Center */}
        <PlatformCard
          title="Google Merchant Center"
          connected={gmcStatus.connected}
          description="Diffusez votre catalogue vers Google Shopping sans repasser par une interface externe."
          icon={<Globe size={22} />}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={infoLine}>
              Merchant Center : {gmcStatus.connected ? gmcStatus.merchantName || gmcStatus.merchantId || "Connecté" : "Non configuré"}
            </p>
            <p style={infoLine}>Compte Google : {gmcStatus.email || "—"}</p>
            <p style={infoLine}>Connecté le : {formatDateTime(gmcStatus.connectedAt)}</p>
            {gmcStatus.connected && (
              <p style={infoLine}>
                Dernier envoi :{" "}
                {gmcLastPush
                  ? `${formatDateTime(gmcLastPush.createdAt)} — ${gmcLastPush.succeeded} produits envoyés${
                      gmcLastPush.failed > 0 ? `, ${gmcLastPush.failed} erreurs` : ""
                    }`
                  : "aucun pour le moment"}
              </p>
            )}
            {gmcStatus.tokenExpired && (
              <StatusBadge variant="warning">Le token a expiré, reconnectez le compte Google.</StatusBadge>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {gmcStatus.connected ? (
              <>
                <PageButtonPrimary disabled={gmcSyncing} onClick={() => void handleSyncGmc()}>
                  Synchroniser maintenant
                </PageButtonPrimary>
                <PageButtonDanger disabled={gmcLoading} onClick={() => void handleDisconnectGmc()}>
                  Déconnecter
                </PageButtonDanger>
              </>
            ) : (
              <PageButtonPrimary disabled={gmcLoading} onClick={() => void handleConnectGmc()}>
                Connecter GMC
              </PageButtonPrimary>
            )}
          </div>
        </PlatformCard>

        {/* Amazon Seller Central */}
        <PlatformCard
          title="Amazon Seller Central"
          connected={amazonStatus.connected}
          description="Connectez Seller Central puis activez les marketplaces Amazon utiles pour vos pushes."
          icon={<ShoppingCart size={22} />}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={infoLine}>Seller ID : {amazonStatus.sellerId || "—"}</p>
            <p style={infoLine}>Connecté le : {formatDateTime(amazonStatus.connectedAt)}</p>
            {amazonStatus.tokenExpired && (
              <StatusBadge variant="warning">Le token Amazon a expiré, reconnectez Seller Central.</StatusBadge>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {amazonStatus.connected ? (
              <PageButtonDanger disabled={amazonLoading} onClick={() => void handleDisconnectAmazon()}>
                Déconnecter
              </PageButtonDanger>
            ) : (
              <PageButtonPrimary disabled={amazonLoading} onClick={() => void handleConnectAmazon()}>
                Connecter Amazon
              </PageButtonPrimary>
            )}
          </div>

          <div>
            <p style={{ ...infoLine, marginBottom: 8 }}>Marketplaces actives</p>
            {amazonStatus.connected && amazonChannels.length === 0 && (
              <p style={{ ...infoLine, marginBottom: 8, color: "var(--warning)" }}>
                Activez au moins un marketplace pour pouvoir pousser vos produits.
              </p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              {AMAZON_EXPORT_CHANNELS.map((channel) => {
                const active = amazonChannels.some((entry) => entry.channelkey === channel.channelKey);
                const isLoading = marketplaceLoadingKey === channel.channelKey;
                return (
                  <div
                    key={channel.channelKey}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r-lg)",
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{channel.label}</p>
                      <p style={{ ...infoLine, fontSize: 12, marginTop: 2 }}>
                        {active ? "Push activé." : "Inactive."}
                      </p>
                    </div>
                    <PageButtonSecondary
                      disabled={!amazonStatus.connected || isLoading}
                      onClick={() => void handleToggleMarketplace(channel.channelKey, !active)}
                      style={{ minHeight: 32, fontSize: 13, padding: "0 12px" }}
                    >
                      {active ? "Désactiver" : "Activer"}
                    </PageButtonSecondary>
                  </div>
                );
              })}
            </div>
          </div>
        </PlatformCard>

        {/* Google Ads */}
        <PlatformCard
          title="Google Ads"
          connected={googleAdsStatus.connected}
          description="Ajoutez Google Ads pour remonter impressions, clics, revenus et ROAS dans FeedPlug."
          icon={<BarChart3 size={22} />}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={infoLine}>Customer ID : {googleAdsStatus.customerId || "—"}</p>
            <p style={infoLine}>Compte Google : {googleAdsStatus.email || "—"}</p>
            <p style={infoLine}>Connecté le : {formatDateTime(googleAdsStatus.connectedAt)}</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {googleAdsStatus.connected ? (
              <PageButtonDanger disabled={googleAdsLoading} onClick={() => void handleDisconnectGoogleAds()}>
                Déconnecter
              </PageButtonDanger>
            ) : (
              <PageButtonPrimary disabled={googleAdsLoading} onClick={() => void handleConnectGoogleAds()}>
                Connecter Google Ads
              </PageButtonPrimary>
            )}
          </div>
        </PlatformCard>

        {/* Microsoft Bing Shopping */}
        <PlatformCard
          title="Microsoft Bing Shopping"
          connected={false}
          badgeDisconnected="Prêt"
          badgeVariant="neutral"
          description="Le même catalogue peut être réutilisé pour Bing Shopping sans nouvelle connexion obligatoire dans FeedPlug."
          icon={<Search size={22} />}
        >
          <p style={infoLine}>
            Une fois votre catalogue propre, vous pourrez réutiliser ce travail pour vos exports Bing comme pour Google Shopping.
          </p>
        </PlatformCard>
      </div>
        </>
      )}
    </PageLayout>
  );
}
