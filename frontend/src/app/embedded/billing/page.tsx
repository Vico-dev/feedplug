"use client";

import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  InlineStack,
  Layout,
  List,
  Page,
  Spinner,
  Text,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

// Le composant Modal n'est chargé que si le merchant déclenche un cancel
// (vue gestion uniquement). La vue grille de plans (cas le plus fréquent en
// première visite) ne paye pas ce coût de bundle initial.
const CancelSubscriptionModal = dynamic(
  () =>
    import("./_components/cancel-subscription-modal").then(
      (m) => m.CancelSubscriptionModal
    ),
  { ssr: false }
);
import { SHOPIFY_PLANS, type ShopifyPlanHandle } from "./_shopify-plans";
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
 * Page de souscription / gestion Shopify Managed Pricing.
 *
 * Au mount, on appelle /billing/shopify/current pour savoir si le merchant a
 * déjà une subscription active :
 *  - Sub active → vue gestion (statut, prix, période, bouton Annuler)
 *  - Pas de sub → grille de 4 plans (Starter / Pro / Business / Premium)
 *
 * Le clic "Choisir ce plan" appelle /billing/shopify/subscribe qui renvoie
 * une URL Shopify Admin Managed Pricing. On ouvre cette URL en top-level
 * (escape iframe) ; Shopify gère la confirmation et nous envoie un webhook
 * app_subscriptions/update à l'approbation.
 */
export default function EmbeddedBillingPage() {
  const fetchApi = useEmbeddedFetch();
  const shopify = useAppBridge();

  const [loading, setLoading] = useState(true);
  const [currentSub, setCurrentSub] = useState<CurrentSub | null>(null);
  const [submitting, setSubmitting] = useState<ShopifyPlanHandle | null>(null);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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
      const response = await fetchApi("/billing/shopify/current");
      if (response.status === 409) {
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

  const handleSubscribe = async (planHandle: ShopifyPlanHandle) => {
    setSubmitting(planHandle);
    try {
      const response = await fetchApi("/billing/shopify/subscribe", {
        method: "POST",
        body: JSON.stringify({ plan: planHandle }),
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
      // BFS : `open(url, '_top')` escape l'iframe vers la page Managed Pricing
      // de Shopify Admin. Après approbation, Shopify envoie le webhook et le
      // merchant revient sur l'app.
      open(body.confirmationUrl, "_top");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur réseau", true);
    } finally {
      setSubmitting(null);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const response = await fetchApi("/billing/shopify/cancel", {
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
        subtitle="Gestion de votre abonnement Shopify"
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
                        Fin de la période d&apos;essai
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
                    L&apos;annulation prend effet à la fin de la période en cours.
                  </Text>
                  <Button
                    variant="primary"
                    tone="critical"
                    onClick={() => setCancelModalOpen(true)}
                  >
                    Annuler l&apos;abonnement
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

  // === Grille de 4 plans (pas de sub) ===
  return (
    <Page
      backAction={{ content: "Accueil", url: "/embedded" }}
      subtitle="Facturation gérée par Shopify Payments — aucune carte à saisir"
    >
      <TitleBar title="Choisir un plan" />
      <Layout>
        <Layout.Section>
          <Text variant="bodyMd" as="p" tone="subdued">
            14 jours d&apos;essai gratuit sur tous les plans. Aucun engagement, vous pouvez
            changer ou annuler à tout moment depuis cet écran.
          </Text>
        </Layout.Section>

        {SHOPIFY_PLANS.map((plan) => (
          <Layout.Section key={plan.handle} variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="start">
                  <BlockStack gap="100">
                    <Text variant="headingLg" as="h2">
                      {plan.name}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {plan.tagline}
                    </Text>
                  </BlockStack>
                  {plan.recommended ? (
                    <Badge tone="success">Recommandé</Badge>
                  ) : null}
                </InlineStack>

                <InlineStack gap="100" blockAlign="end">
                  <Text variant="heading2xl" as="p">
                    {plan.priceEur} €
                  </Text>
                  <Box paddingBlockEnd="100">
                    <Text variant="bodyMd" as="p" tone="subdued">
                      / mois HT
                    </Text>
                  </Box>
                </InlineStack>

                <Divider />

                <List type="bullet">
                  {plan.features.map((feature) => (
                    <List.Item key={feature}>{feature}</List.Item>
                  ))}
                </List>

                <Box paddingBlockStart="200">
                  <Button
                    variant={plan.recommended ? "primary" : "secondary"}
                    size="large"
                    fullWidth
                    loading={submitting === plan.handle}
                    disabled={submitting !== null && submitting !== plan.handle}
                    onClick={() => handleSubscribe(plan.handle)}
                  >
                    Choisir {plan.name}
                  </Button>
                </Box>

                <Text variant="bodySm" as="p" tone="subdued" alignment="center">
                  {plan.trialDays} jours d&apos;essai · annulation à tout moment
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        ))}
      </Layout>
    </Page>
  );
}
