"use client";

import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  InlineStack,
  Layout,
  Page,
  Select,
  Spinner,
  Text,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

// Le composant Modal n'est chargé que si le merchant déclenche un cancel
// (vue gestion uniquement). La vue configurator (cas le plus fréquent en
// première visite) ne paye pas ce coût de bundle initial → meilleur LCP.
const CancelSubscriptionModal = dynamic(
  () =>
    import("./_components/cancel-subscription-modal").then(
      (m) => m.CancelSubscriptionModal
    ),
  { ssr: false }
);
import {
  ADDON_IA_PRICE_EUR,
  CHANNEL_OPTIONS,
  PRODUCT_TIERS,
  type ChannelCount,
  type ProductTier,
  formatProductsLabel,
  getPriceEur,
} from "./_pricing";
import { useEmbeddedFetch } from "../_components/use-embedded-fetch";

type CurrentSub = {
  active: boolean;
  subscriptionId?: string;
  planKey?: string;
  priceAmount?: number;
  currency?: string;
  status?: string;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  testMode?: boolean;
};

const STATUS_TONE: Record<string, "success" | "warning" | "critical" | "info"> = {
  ACTIVE: "success",
  PENDING: "info",
  FROZEN: "warning",
  CANCELLED: "critical",
  EXPIRED: "critical",
  DECLINED: "critical",
};

function formatDateLabel(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Page de souscription / gestion Shopify Billing.
 *
 * Au mount, on appelle /api/v1/billing/shopify/current pour savoir si le
 * merchant a déjà une subscription active :
 *  - Sub active → vue gestion (statut, prix, période, bouton Annuler)
 *  - Pas de sub → vue configurator (choix tier × channels × IA + Souscrire)
 *
 * Le cancel passe par une Modal App Bridge de confirmation (convention BFS
 * pour les actions destructives).
 */
export default function EmbeddedBillingPage() {
  const fetchApi = useEmbeddedFetch();
  const shopify = useAppBridge();

  const [loading, setLoading] = useState(true);
  const [currentSub, setCurrentSub] = useState<CurrentSub | null>(null);

  const [tier, setTier] = useState<ProductTier>(500);
  const [channels, setChannels] = useState<ChannelCount>(2);
  const [addonIA, setAddonIA] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const monthlyPriceEur = useMemo(
    () => getPriceEur({ productTier: tier, channels, addonIA }),
    [tier, channels, addonIA]
  );

  const showToast = useCallback(
    (message: string, isError = false) => {
      try {
        shopify.toast.show(message, { isError, duration: 6000 });
      } catch {
        if (process.env.NODE_ENV !== "production") {
          console[isError ? "error" : "log"]("[billing]", message);
        }
      }
    },
    [shopify]
  );

  const refetchCurrent = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchApi("/api/v1/billing/shopify/current");
      if (response.status === 409) {
        // Pas d'Account encore lié — comportement géré par le subscribe ;
        // ici on traite comme "pas de sub" et on affiche le configurator.
        setCurrentSub({ active: false });
        return;
      }
      if (!response.ok) {
        showToast(`Erreur ${response.status} en chargeant l'abonnement`, true);
        setCurrentSub({ active: false });
        return;
      }
      const body = (await response.json()) as CurrentSub;
      setCurrentSub(body);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur réseau", true);
      setCurrentSub({ active: false });
    } finally {
      setLoading(false);
    }
  }, [fetchApi, showToast]);

  useEffect(() => {
    void refetchCurrent();
  }, [refetchCurrent]);

  const tierOptions = PRODUCT_TIERS.map((t) => ({
    label: formatProductsLabel(t),
    value: String(t),
  }));
  const channelOptions = CHANNEL_OPTIONS.map((c) => ({
    label: `${c} canal${c > 1 ? "x" : ""} d'export`,
    value: String(c),
  }));

  const handleSubscribe = async () => {
    setSubmitting(true);
    try {
      const response = await fetchApi("/api/v1/billing/shopify/subscribe", {
        method: "POST",
        body: JSON.stringify({ tier, channels, addonIA }),
      });
      if (response.status === 409) {
        const body = await response.json().catch(() => null);
        if (body?.code === "NO_ACCOUNT_FOR_SHOP") {
          showToast(
            "Aucun compte FeedPlug n'est encore lié à votre boutique. Rechargez l'app dans quelques secondes.",
            true
          );
          return;
        }
        showToast(body?.message || "Connexion Shopify manquante", true);
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        showToast(body?.message || `Erreur ${response.status}`, true);
        return;
      }
      const body = (await response.json()) as { confirmationUrl: string };
      if (!body.confirmationUrl) {
        showToast("Réponse Shopify invalide (confirmationUrl manquant)", true);
        return;
      }
      // BFS : `open(url, '_top')` escape l'iframe vers la page confirmation
      // Shopify Billing. Après approbation, /return réinjecte le merchant.
      open(body.confirmationUrl, "_top");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur réseau", true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const response = await fetchApi("/api/v1/billing/shopify/cancel", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        showToast(body?.message || `Erreur ${response.status}`, true);
        return;
      }
      showToast("Abonnement annulé. Vous gardez l'accès jusqu'à la fin de la période.");
      setCancelModalOpen(false);
      await refetchCurrent();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur réseau", true);
    } finally {
      setCancelling(false);
    }
  };

  // === Vue gestion (sub active) ===
  if (loading) {
    return (
      <Page backAction={{ content: "Accueil", url: "/embedded" }}>
        <TitleBar title="Facturation" />
        <Box paddingBlock="800">
          <InlineStack align="center">
            <Spinner accessibilityLabel="Chargement de l'abonnement" size="large" />
          </InlineStack>
        </Box>
      </Page>
    );
  }

  if (currentSub?.active) {
    const tone = STATUS_TONE[currentSub.status || ""] || "info";
    return (
      <Page
        backAction={{ content: "Accueil", url: "/embedded" }}
        subtitle="Gestion de votre abonnement Shopify Billing"
      >
        <TitleBar title="Abonnement actif" />
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">
                    Plan {currentSub.planKey || "FeedPlug"}
                  </Text>
                  <InlineStack gap="200">
                    {currentSub.testMode ? (
                      <Badge tone="attention">Test mode</Badge>
                    ) : null}
                    <Badge tone={tone}>{currentSub.status || "—"}</Badge>
                  </InlineStack>
                </InlineStack>

                <Divider />

                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Montant mensuel
                    </Text>
                    <Text variant="bodyMd" as="p">
                      {currentSub.priceAmount?.toFixed(2)} {currentSub.currency}
                    </Text>
                  </InlineStack>
                  {currentSub.trialEndsAt ? (
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Fin de la période d'essai
                      </Text>
                      <Text variant="bodyMd" as="p">
                        {formatDateLabel(currentSub.trialEndsAt)}
                      </Text>
                    </InlineStack>
                  ) : null}
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Prochain renouvellement
                    </Text>
                    <Text variant="bodyMd" as="p">
                      {formatDateLabel(currentSub.currentPeriodEnd)}
                    </Text>
                  </InlineStack>
                </BlockStack>

                <Divider />

                <InlineStack align="space-between" blockAlign="center" wrap>
                  <Text variant="bodySm" as="p" tone="subdued">
                    L'annulation prend effet à la fin de la période en cours.
                  </Text>
                  <Button
                    variant="primary"
                    tone="critical"
                    onClick={() => setCancelModalOpen(true)}
                  >
                    Annuler l'abonnement
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {cancelModalOpen ? (
          <CancelSubscriptionModal
            open={cancelModalOpen}
            onClose={() => setCancelModalOpen(false)}
            onConfirm={handleCancel}
            planLabel={currentSub.planKey}
            periodEndLabel={formatDateLabel(currentSub.currentPeriodEnd)}
            cancelling={cancelling}
          />
        ) : null}
      </Page>
    );
  }

  // === Vue configurator (pas de sub) ===
  return (
    <Page
      backAction={{ content: "Accueil", url: "/embedded" }}
      subtitle="Facturation gérée par Shopify Payments — aucune carte à saisir"
    >
      <TitleBar title="Choisir un plan" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Text variant="headingMd" as="h2">
                Configurez votre plan
              </Text>

              <Select
                label="Volume de produits à synchroniser"
                helpText="Choisissez la tranche correspondant à votre catalogue actif."
                options={tierOptions}
                value={String(tier)}
                onChange={(value) => setTier(Number(value) as ProductTier)}
              />

              <Select
                label="Nombre de canaux d'export"
                helpText="1 canal = Google Shopping seul. Ajoutez Bing, Amazon, etc."
                options={channelOptions}
                value={String(channels)}
                onChange={(value) => setChannels(Number(value) as ChannelCount)}
              />

              <Checkbox
                label={`Pack IA : optimisation titres + génération images (+${ADDON_IA_PRICE_EUR} € HT/mois)`}
                helpText="Recommandé si vous avez des descriptions courtes ou des images sans fond uniforme."
                checked={addonIA}
                onChange={(checked) => setAddonIA(checked)}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3">
                  Récapitulatif
                </Text>
                <Badge tone="success">Sans engagement</Badge>
              </InlineStack>

              <Divider />

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Volume
                  </Text>
                  <Text variant="bodyMd" as="p">
                    {formatProductsLabel(tier)}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Canaux
                  </Text>
                  <Text variant="bodyMd" as="p">
                    {channels} canal{channels > 1 ? "x" : ""}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Pack IA
                  </Text>
                  <Text variant="bodyMd" as="p">
                    {addonIA ? "Inclus" : "Non inclus"}
                  </Text>
                </InlineStack>
              </BlockStack>

              <Divider />

              <InlineStack align="space-between" blockAlign="center">
                <Text variant="bodyMd" as="p">
                  Total mensuel HT
                </Text>
                <Text variant="headingLg" as="p">
                  {monthlyPriceEur} €
                </Text>
              </InlineStack>

              <Box paddingBlockStart="200">
                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={submitting}
                  onClick={handleSubscribe}
                >
                  Souscrire via Shopify
                </Button>
              </Box>

              <Text variant="bodySm" as="p" tone="subdued" alignment="center">
                Vous serez redirigé vers la page de confirmation Shopify pour
                approuver le débit récurrent.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
