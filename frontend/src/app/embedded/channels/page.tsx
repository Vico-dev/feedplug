"use client";

import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Spinner,
  Text,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AMAZON_EXPORT_CHANNELS } from "@/lib/services/flux.service";
import { useEmbeddedFetch } from "../_components/use-embedded-fetch";
import { useEmbeddedT } from "../_locale";

type GmcStatus = {
  connected: boolean;
  merchantId?: string;
  merchantName?: string;
  email?: string;
  tokenExpired?: boolean;
  connectedAt?: string;
};

type GoogleAdsStatus = {
  connected: boolean;
  customerId?: string;
  email?: string;
  connectedAt?: string;
};

type AmazonStatus = {
  connected: boolean;
  sellerId?: string;
  tokenExpired?: boolean;
  connectedAt?: string;
};

type AmazonChannel = {
  id: string;
  channelkey: string;
  label: string;
  isactive: boolean;
};

type GmcSelectionPayload = {
  selectionId: string;
  email: string;
  merchants: Array<{
    merchantId: string;
    merchantName?: string;
    label?: string;
  }>;
};

type GmcSelectionState = GmcSelectionPayload & {
  selectedMerchantId: string;
};

type ChannelStatusTone = "success" | "warning" | "critical" | "info";

const CONNECTED_TONE: ChannelStatusTone = "success";
const DISCONNECTED_TONE: ChannelStatusTone = "warning";

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

function cleanMessage(raw: string | null, fallback: string): string {
  const value = String(raw || "").trim();
  return value || fallback;
}

function PlatformCard({
  title,
  badgeLabel,
  badgeTone,
  description,
  children,
}: {
  title: string;
  badgeLabel: string;
  badgeTone: ChannelStatusTone;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center" wrap>
          <BlockStack gap="100">
            <Text variant="headingMd" as="h2">
              {title}
            </Text>
            <Text variant="bodySm" as="p" tone="subdued">
              {description}
            </Text>
          </BlockStack>
          <Badge tone={badgeTone}>{badgeLabel}</Badge>
        </InlineStack>
        {children}
      </BlockStack>
    </Card>
  );
}

export default function EmbeddedChannelsPage() {
  const fetchApi = useEmbeddedFetch();
  const shopify = useAppBridge();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useEmbeddedT();

  const [loading, setLoading] = useState(true);
  const [noAccount, setNoAccount] = useState(false);

  const [gmcStatus, setGmcStatus] = useState<GmcStatus>({ connected: false });
  const [googleAdsStatus, setGoogleAdsStatus] = useState<GoogleAdsStatus>({ connected: false });
  const [amazonStatus, setAmazonStatus] = useState<AmazonStatus>({ connected: false });
  const [amazonChannels, setAmazonChannels] = useState<AmazonChannel[]>([]);
  const [gmcSelection, setGmcSelection] = useState<GmcSelectionState | null>(null);

  const [gmcLoading, setGmcLoading] = useState(false);
  const [googleAdsLoading, setGoogleAdsLoading] = useState(false);
  const [amazonLoading, setAmazonLoading] = useState(false);
  const [marketplaceLoadingKey, setMarketplaceLoadingKey] = useState<string | null>(null);
  const [selectionLoading, setSelectionLoading] = useState(false);

  const showToast = useCallback(
    (message: string, isError = false) => {
      try {
        shopify.toast.show(message, { isError, duration: 5000 });
      } catch {
        if (process.env.NODE_ENV !== "production") {
          console[isError ? "error" : "log"]("[embedded/channels]", message);
        }
      }
    },
    [shopify]
  );

  const cleanupQueryState = useCallback(() => {
    router.replace("/embedded/channels");
  }, [router]);

  const requestJson = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T | null> => {
      const response = await fetchApi(path, init);
      if (response.status === 409) {
        setNoAccount(true);
        return null;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Erreur ${response.status}`);
      }
      return (await response.json()) as T;
    },
    [fetchApi]
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setNoAccount(false);

    const [gmcResult, googleAdsResult, amazonResult, channelsResult] = await Promise.allSettled([
      requestJson<GmcStatus>("/platforms/gmc/status"),
      requestJson<GoogleAdsStatus>("/platforms/google-ads/status"),
      requestJson<AmazonStatus>("/platforms/amazon/status"),
      requestJson<{ channels: AmazonChannel[] }>("/platforms/amazon/channels"),
    ]);

    if (gmcResult.status === "fulfilled" && gmcResult.value) {
      setGmcStatus(gmcResult.value);
    } else if (gmcResult.status === "rejected") {
      setGmcStatus({ connected: false });
    }

    if (googleAdsResult.status === "fulfilled" && googleAdsResult.value) {
      setGoogleAdsStatus(googleAdsResult.value);
    } else if (googleAdsResult.status === "rejected") {
      setGoogleAdsStatus({ connected: false });
    }

    if (amazonResult.status === "fulfilled" && amazonResult.value) {
      setAmazonStatus(amazonResult.value);
    } else if (amazonResult.status === "rejected") {
      setAmazonStatus({ connected: false });
    }

    if (channelsResult.status === "fulfilled" && channelsResult.value) {
      setAmazonChannels(Array.isArray(channelsResult.value.channels) ? channelsResult.value.channels : []);
    } else if (channelsResult.status === "rejected") {
      setAmazonChannels([]);
    }

    setLoading(false);
  }, [requestJson]);

  const loadGmcSelection = useCallback(
    async (selectionId: string) => {
      if (!selectionId) return;
      try {
        const payload = await requestJson<GmcSelectionPayload>(`/platforms/gmc/selection/${encodeURIComponent(selectionId)}`);
        if (!payload) return;
        const merchants = Array.isArray(payload.merchants) ? payload.merchants : [];
        setGmcSelection({
          ...payload,
          merchants,
          selectedMerchantId: merchants[0]?.merchantId || "",
        });
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Impossible de charger la sélection Merchant Center.", true);
      }
    },
    [requestJson, showToast]
  );

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const gmc = searchParams.get("gmc");
    const amazon = searchParams.get("amazon");
    const googleAds = searchParams.get("google_ads");
    const selection = searchParams.get("selection");
    const reason = searchParams.get("reason");
    const message = searchParams.get("message");

    if (!gmc && !amazon && !googleAds) return;

    let shouldRefresh = false;
    let shouldCleanup = false;

    if (gmc === "connected") {
      showToast("Google Merchant Center connecté. Vous pouvez lancer vos exports depuis Shopify.", false);
      shouldRefresh = true;
      shouldCleanup = true;
    } else if (gmc === "error") {
      showToast(cleanMessage(message, "La connexion Google Merchant Center a échoué."), true);
      shouldCleanup = true;
    } else if (gmc === "select" && selection) {
      void loadGmcSelection(selection);
      shouldCleanup = true;
    }

    if (amazon === "connected") {
      showToast("Amazon connecté. Activez maintenant les marketplaces utiles pour votre boutique.", false);
      shouldRefresh = true;
      shouldCleanup = true;
    } else if (amazon === "error") {
      showToast(cleanMessage(reason, "La connexion Amazon a échoué."), true);
      shouldCleanup = true;
    }

    if (googleAds === "connected") {
      showToast("Google Ads connecté. Les données de performance pourront remonter dans l'app.", false);
      shouldRefresh = true;
      shouldCleanup = true;
    } else if (googleAds === "error") {
      showToast(cleanMessage(message, "La connexion Google Ads a échoué."), true);
      shouldCleanup = true;
    }

    if (shouldRefresh) {
      void refreshAll();
    }
    if (shouldCleanup) {
      cleanupQueryState();
    }
  }, [cleanupQueryState, loadGmcSelection, refreshAll, searchParams, showToast]);

  const handleConnectGmc = async () => {
    setGmcLoading(true);
    try {
      const payload = await requestJson<{ authUrl?: string }>(
        "/platforms/gmc/auth-url?locale=fr&surface=embedded&returnTo=%2Fembedded%2Fchannels"
      );
      if (!payload?.authUrl) {
        throw new Error("URL de connexion Google Merchant Center indisponible.");
      }
      open(payload.authUrl, "_top");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Connexion Google Merchant Center impossible.", true);
    } finally {
      setGmcLoading(false);
    }
  };

  const handleDisconnectGmc = async () => {
    if (typeof window !== "undefined" && !window.confirm("Déconnecter Google Merchant Center ?")) {
      return;
    }
    setGmcLoading(true);
    try {
      await requestJson("/platforms/gmc/disconnect", { method: "DELETE" });
      setGmcSelection(null);
      await refreshAll();
      showToast("Google Merchant Center déconnecté.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Déconnexion Google Merchant Center impossible.", true);
    } finally {
      setGmcLoading(false);
    }
  };

  const handleConfirmGmcSelection = async () => {
    if (!gmcSelection?.selectionId || !gmcSelection.selectedMerchantId) {
      showToast("Sélection Merchant Center invalide.", true);
      return;
    }
    setSelectionLoading(true);
    try {
      await requestJson("/platforms/gmc/select-merchant", {
        method: "POST",
        body: JSON.stringify({
          selectionId: gmcSelection.selectionId,
          merchantId: gmcSelection.selectedMerchantId,
        }),
      });
      setGmcSelection(null);
      await refreshAll();
      showToast("Merchant Center sélectionné. FeedPlug est prêt pour Google Shopping.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Impossible de finaliser la connexion Merchant Center.", true);
    } finally {
      setSelectionLoading(false);
    }
  };

  const handleConnectAmazon = async () => {
    setAmazonLoading(true);
    try {
      const payload = await requestJson<{ connectUrl?: string; message?: string }>(
        "/platforms/amazon/connect-init?surface=embedded&returnTo=%2Fembedded%2Fchannels"
      );
      if (!payload?.connectUrl) {
        throw new Error(payload?.message || "URL de connexion Amazon indisponible.");
      }
      open(payload.connectUrl, "_top");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Connexion Amazon impossible.", true);
    } finally {
      setAmazonLoading(false);
    }
  };

  const handleDisconnectAmazon = async () => {
    if (typeof window !== "undefined" && !window.confirm("Déconnecter Amazon Seller Central ?")) {
      return;
    }
    setAmazonLoading(true);
    try {
      await requestJson("/platforms/amazon/disconnect", { method: "DELETE" });
      await refreshAll();
      showToast("Amazon déconnecté.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Déconnexion Amazon impossible.", true);
    } finally {
      setAmazonLoading(false);
    }
  };

  const handleToggleAmazonChannel = async (channelKey: string, enabled: boolean) => {
    setMarketplaceLoadingKey(channelKey);
    try {
      if (enabled) {
        await requestJson("/platforms/amazon/channels", {
          method: "POST",
          body: JSON.stringify({ channelKey }),
        });
        showToast(`${channelKey.toUpperCase()} activé pour Amazon.`);
      } else {
        await requestJson(`/platforms/amazon/channels/${encodeURIComponent(channelKey)}`, {
          method: "DELETE",
        });
        showToast(`${channelKey.toUpperCase()} désactivé pour Amazon.`);
      }
      await refreshAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Impossible de modifier ce canal Amazon.", true);
    } finally {
      setMarketplaceLoadingKey(null);
    }
  };

  const handleConnectGoogleAds = async () => {
    setGoogleAdsLoading(true);
    try {
      const payload = await requestJson<{ authUrl?: string }>(
        "/platforms/google-ads/auth-url?surface=embedded&returnTo=%2Fembedded%2Fchannels"
      );
      if (!payload?.authUrl) {
        throw new Error("URL de connexion Google Ads indisponible.");
      }
      open(payload.authUrl, "_top");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Connexion Google Ads impossible.", true);
    } finally {
      setGoogleAdsLoading(false);
    }
  };

  const handleDisconnectGoogleAds = async () => {
    if (typeof window !== "undefined" && !window.confirm("Déconnecter Google Ads ?")) {
      return;
    }
    setGoogleAdsLoading(true);
    try {
      await requestJson("/platforms/google-ads/disconnect", { method: "DELETE" });
      await refreshAll();
      showToast("Google Ads déconnecté.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Déconnexion Google Ads impossible.", true);
    } finally {
      setGoogleAdsLoading(false);
    }
  };

  const connectedCount = useMemo(() => {
    return [gmcStatus.connected, amazonStatus.connected, googleAdsStatus.connected].filter(Boolean).length;
  }, [amazonStatus.connected, gmcStatus.connected, googleAdsStatus.connected]);

  if (loading) {
    return (
      <Page backAction={{ content: t("nav.home"), url: "/embedded" }}>
        <TitleBar title={t("nav.channels")} />
        <Box paddingBlock="800">
          <InlineStack align="center">
            <Spinner accessibilityLabel="Loading…" size="large" />
          </InlineStack>
        </Box>
      </Page>
    );
  }

  if (noAccount) {
    return (
      <Page backAction={{ content: t("nav.home"), url: "/embedded" }}>
        <TitleBar title={t("nav.channels")} />
        <Box paddingBlock="800">
          <EmptyState
            heading={t("sources.notConnected.heading")}
            action={{ content: t("diagnostic.reload"), onAction: () => void refreshAll() }}
            image="/embedded-empty.svg"
          >
            <p>{t("sources.notConnected.body")}</p>
          </EmptyState>
        </Box>
      </Page>
    );
  }

  return (
    <Page
      backAction={{ content: t("nav.home"), url: "/embedded" }}
      subtitle={t("channels.subtitle")}
    >
      <TitleBar title={t("nav.channels")}>
        <button variant="primary" onClick={() => void refreshAll()}>
          {t("diagnostic.reload")}
        </button>
      </TitleBar>

      <Layout>
        <Layout.Section>
          <Card>
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              <Box>
                <Text variant="bodySm" as="p" tone="subdued">
                  Connexions actives
                </Text>
                <Text variant="headingLg" as="p">
                  {connectedCount}/3
                </Text>
              </Box>
              <Box>
                <Text variant="bodySm" as="p" tone="subdued">
                  Marketplaces Amazon
                </Text>
                <Text variant="headingLg" as="p">
                  {amazonChannels.length}
                </Text>
              </Box>
              <Box>
                <Text variant="bodySm" as="p" tone="subdued">
                  Bing Shopping
                </Text>
                <Text variant="headingLg" as="p">
                  Prêt
                </Text>
              </Box>
            </InlineGrid>
          </Card>
        </Layout.Section>

        {gmcSelection ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text variant="headingMd" as="h2">
                    Choisir votre Merchant Center
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">
                    Plusieurs comptes Merchant Center ont été trouvés pour {gmcSelection.email || "ce compte Google"}.
                    Sélectionnez celui à utiliser pour FeedPlug.
                  </Text>
                </BlockStack>

                <BlockStack gap="200">
                  {gmcSelection.merchants.map((merchant) => {
                    const selected = gmcSelection.selectedMerchantId === merchant.merchantId;
                    return (
                      <Box
                        key={merchant.merchantId}
                        borderWidth="025"
                        borderColor="border"
                        borderRadius="200"
                        padding="300"
                      >
                        <InlineStack align="space-between" blockAlign="center" wrap>
                          <BlockStack gap="050">
                            <Text variant="bodyMd" as="p" fontWeight="semibold">
                              {merchant.merchantName || merchant.label || `Merchant Center ${merchant.merchantId}`}
                            </Text>
                            <Text variant="bodySm" as="p" tone="subdued">
                              ID {merchant.merchantId}
                            </Text>
                          </BlockStack>
                          <Button
                            variant={selected ? "primary" : undefined}
                            onClick={() =>
                              setGmcSelection((prev) =>
                                prev ? { ...prev, selectedMerchantId: merchant.merchantId } : prev
                              )
                            }
                          >
                            {selected ? "Sélectionné" : "Choisir"}
                          </Button>
                        </InlineStack>
                      </Box>
                    );
                  })}
                </BlockStack>

                <InlineStack gap="300" wrap>
                  <Button
                    variant="primary"
                    loading={selectionLoading}
                    onClick={() => void handleConfirmGmcSelection()}
                  >
                    Confirmer ce Merchant Center
                  </Button>
                  <Button onClick={() => setGmcSelection(null)}>Plus tard</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <PlatformCard
              title="Google Merchant Center"
              badgeLabel={gmcStatus.connected ? "Connecté" : "À connecter"}
              badgeTone={gmcStatus.connected ? CONNECTED_TONE : DISCONNECTED_TONE}
              description="Diffusez votre catalogue Shopify vers Google Shopping sans repasser par une interface externe."
            >
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" tone="subdued">
                  Merchant Center: {gmcStatus.connected ? (gmcStatus.merchantName || gmcStatus.merchantId || "Connecté") : "Non configuré"}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Compte Google: {gmcStatus.email || "—"}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Connecté le: {formatDateTime(gmcStatus.connectedAt)}
                </Text>
                {gmcStatus.tokenExpired ? (
                  <Badge tone="warning">Le token a expiré, reconnectez le compte Google.</Badge>
                ) : null}
                <InlineStack gap="300" wrap>
                  {gmcStatus.connected ? (
                    <Button tone="critical" loading={gmcLoading} onClick={() => void handleDisconnectGmc()}>
                      Déconnecter
                    </Button>
                  ) : (
                    <Button variant="primary" loading={gmcLoading} onClick={() => void handleConnectGmc()}>
                      Connecter GMC
                    </Button>
                  )}
                  <Button url="/embedded/sources">Voir le catalogue</Button>
                </InlineStack>
              </BlockStack>
            </PlatformCard>

            <PlatformCard
              title="Amazon Seller Central"
              badgeLabel={amazonStatus.connected ? "Connecté" : "À connecter"}
              badgeTone={amazonStatus.connected ? CONNECTED_TONE : DISCONNECTED_TONE}
              description="Connectez Seller Central puis activez les marketplaces Amazon utiles pour vos pushes."
            >
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" tone="subdued">
                  Seller ID: {amazonStatus.sellerId || "—"}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Connecté le: {formatDateTime(amazonStatus.connectedAt)}
                </Text>
                {amazonStatus.tokenExpired ? (
                  <Badge tone="warning">Le token Amazon a expiré, reconnectez Seller Central.</Badge>
                ) : null}
                <InlineStack gap="300" wrap>
                  {amazonStatus.connected ? (
                    <Button tone="critical" loading={amazonLoading} onClick={() => void handleDisconnectAmazon()}>
                      Déconnecter
                    </Button>
                  ) : (
                    <Button variant="primary" loading={amazonLoading} onClick={() => void handleConnectAmazon()}>
                      Connecter Amazon
                    </Button>
                  )}
                </InlineStack>

                <Box paddingBlockStart="200">
                  <Text variant="bodySm" as="p" tone="subdued">
                    Marketplaces actives
                  </Text>
                </Box>

                <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
                  {AMAZON_EXPORT_CHANNELS.map((channel) => {
                    const active = amazonChannels.some((entry) => entry.channelkey === channel.channelKey);
                    const isLoading = marketplaceLoadingKey === channel.channelKey;
                    return (
                      <Box key={channel.channelKey} borderWidth="025" borderColor="border" borderRadius="200" padding="300">
                        <InlineStack align="space-between" blockAlign="center" wrap>
                          <BlockStack gap="050">
                            <Text variant="bodyMd" as="p" fontWeight="semibold">
                              {channel.label}
                            </Text>
                            <Text variant="bodySm" as="p" tone="subdued">
                              {active ? "Push Amazon activé pour ce marché." : "Inactive pour le moment."}
                            </Text>
                          </BlockStack>
                          <Button
                            size="slim"
                            disabled={!amazonStatus.connected}
                            loading={isLoading}
                            onClick={() => void handleToggleAmazonChannel(channel.channelKey, !active)}
                          >
                            {active ? "Désactiver" : "Activer"}
                          </Button>
                        </InlineStack>
                      </Box>
                    );
                  })}
                </InlineGrid>
              </BlockStack>
            </PlatformCard>
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <PlatformCard
              title="Google Ads"
              badgeLabel={googleAdsStatus.connected ? "Connecté" : "À connecter"}
              badgeTone={googleAdsStatus.connected ? CONNECTED_TONE : DISCONNECTED_TONE}
              description="Ajoutez Google Ads pour remonter impressions, clics, revenus et ROAS dans FeedPlug."
            >
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" tone="subdued">
                  Customer ID: {googleAdsStatus.customerId || "—"}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Compte Google: {googleAdsStatus.email || "—"}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Connecté le: {formatDateTime(googleAdsStatus.connectedAt)}
                </Text>
                <InlineStack gap="300" wrap>
                  {googleAdsStatus.connected ? (
                    <Button tone="critical" loading={googleAdsLoading} onClick={() => void handleDisconnectGoogleAds()}>
                      Déconnecter
                    </Button>
                  ) : (
                    <Button variant="primary" loading={googleAdsLoading} onClick={() => void handleConnectGoogleAds()}>
                      Connecter Google Ads
                    </Button>
                  )}
                  <Button url="/embedded/performance">Voir la performance</Button>
                </InlineStack>
              </BlockStack>
            </PlatformCard>

            <PlatformCard
              title="Microsoft Bing Shopping"
              badgeLabel="Prêt"
              badgeTone="info"
              description="Le même catalogue Shopify peut être réutilisé pour Bing Shopping sans nouvelle connexion obligatoire dans FeedPlug."
            >
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" tone="subdued">
                  Aucun compte Bing n&apos;est nécessaire ici pour vérifier votre préparation catalogue dans Shopify Admin.
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Une fois votre catalogue propre, vous pourrez réutiliser ce travail pour vos exports Bing comme pour Google Shopping.
                </Text>
                <InlineStack gap="300" wrap>
                  <Button url="/embedded/sources">Vérifier le catalogue</Button>
                </InlineStack>
              </BlockStack>
            </PlatformCard>
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
