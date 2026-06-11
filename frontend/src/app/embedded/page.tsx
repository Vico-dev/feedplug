"use client";

import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Layout,
  Link,
  List,
  Page,
  Spinner,
  Text,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useEmbeddedFetch } from "./_components/use-embedded-fetch";

type CurrentSub = {
  active: boolean;
  planKey?: string;
  priceAmount?: number;
  currency?: string;
  status?: string;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  testMode?: boolean;
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
 * Page d'accueil de l'app embedded FeedPlug dans Shopify Admin.
 *
 * Affiche selon l'état de la subscription :
 *  - Sub active → bandeau "Plan X actif" + bouton "Gérer mon abonnement"
 *    (raccourci "Manage subscription" requis BFS).
 *  - Pas de sub → grille onboarding 3 étapes + CTA "Choisir un plan".
 *
 * Convention BFS : le titre + actions principales passent par TitleBar App
 * Bridge (visible dans la barre Shopify Admin au-dessus de l'iframe). Le bouton
 * "Manage subscription" est visible dès la home pour faciliter l'accès au
 * billing depuis n'importe quel point d'entrée Shopify Admin.
 */
export default function EmbeddedHomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopify = useAppBridge();
  const fetchApi = useEmbeddedFetch();

  const [currentSub, setCurrentSub] = useState<CurrentSub | null>(null);
  const [subLoaded, setSubLoaded] = useState(false);

  const refetchSub = useCallback(async () => {
    try {
      const response = await fetchApi("/billing/shopify/current");
      if (response.ok) {
        const body = (await response.json()) as CurrentSub;
        setCurrentSub(body);
      } else {
        setCurrentSub({ active: false });
      }
    } catch {
      setCurrentSub({ active: false });
    } finally {
      setSubLoaded(true);
    }
  }, [fetchApi]);

  useEffect(() => {
    void refetchSub();
  }, [refetchSub]);

  useEffect(() => {
    const returnTo = searchParams.get("returnTo");
    if (returnTo && returnTo.startsWith("/embedded")) {
      router.replace(returnTo);
      return;
    }
    if (searchParams.get("billing") === "ok") {
      try {
        shopify.toast.show("Abonnement Shopify confirmé. Bienvenue sur FeedPlug.", {
          duration: 6000,
        });
      } catch {
        // Bridge non disponible, on continue sans toast
      }
      const cleaned = new URLSearchParams(searchParams.toString());
      cleaned.delete("billing");
      const qs = cleaned.toString();
      router.replace(`/embedded${qs ? `?${qs}` : ""}`);
    }
  }, [searchParams, shopify, router]);

  const subActive = currentSub?.active === true;
  const titleBarCta = subActive ? "Gérer mon abonnement" : "Choisir un plan";

  return (
    <Page subtitle="Préparez Google Shopping, Bing et Amazon depuis Shopify Admin.">
      <TitleBar title="FeedPlug">
        <button
          variant="primary"
          onClick={() => router.push("/embedded/billing")}
        >
          {titleBarCta}
        </button>
        <a
          href="https://feedplug.com/docs"
          target="_blank"
          rel="noopener noreferrer"
        >
          Documentation
        </a>
      </TitleBar>
      <Layout>
        {/* Bandeau état de l'abonnement */}
        <Layout.Section>
          {!subLoaded ? (
            <Card>
              <InlineStack align="center" blockAlign="center" gap="300">
                <Spinner accessibilityLabel="Chargement de l'abonnement" size="small" />
                <Text variant="bodySm" as="span" tone="subdued">
                  Chargement de votre abonnement…
                </Text>
              </InlineStack>
            </Card>
          ) : subActive ? (
            <Card>
              <InlineStack align="space-between" blockAlign="center" wrap>
                <InlineStack gap="300" blockAlign="center" wrap>
                  <Badge tone="success">{currentSub?.status || "ACTIVE"}</Badge>
                  <BlockStack gap="050">
                    <Text variant="headingMd" as="h2">
                      Plan {currentSub?.planKey || "FeedPlug"} actif
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {currentSub?.trialEndsAt
                        ? `Fin de l'essai : ${formatDateLabel(currentSub.trialEndsAt)} · `
                        : ""}
                      Prochain renouvellement : {formatDateLabel(currentSub?.currentPeriodEnd)}
                    </Text>
                  </BlockStack>
                </InlineStack>
                <Button onClick={() => router.push("/embedded/billing")}>
                  Gérer mon abonnement
                </Button>
              </InlineStack>
            </Card>
          ) : (
            <Card>
              <InlineStack align="space-between" blockAlign="center" wrap>
                <BlockStack gap="050">
                  <Text variant="headingMd" as="h2">
                    Aucun abonnement actif
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">
                    Choisissez un plan pour activer la synchronisation automatique
                    de votre catalogue vers les canaux marketing.
                  </Text>
                </BlockStack>
                <Button variant="primary" onClick={() => router.push("/embedded/billing")}>
                  Choisir un plan
                </Button>
              </InlineStack>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Bienvenue dans FeedPlug
              </Text>
              <Text variant="bodyMd" as="p">
                FeedPlug connecte votre catalogue Shopify à Google Shopping, Microsoft Bing
                Shopping et Amazon Seller depuis une seule interface. Les mises à jour
                catalogue sont déclenchées par Shopify en temps réel (webhooks products/*),
                avec une relance manuelle toujours disponible.
              </Text>
              <InlineStack gap="300" wrap>
                <Button variant="primary" onClick={() => router.push(subActive ? "/embedded/diagnostic" : "/embedded/billing")}>
                  {subActive ? "Voir mon diagnostic qualité" : "Choisir un plan"}
                </Button>
                <Button onClick={() => router.push("/embedded/channels")}>
                  Configurer mes canaux
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">
                3 étapes pour démarrer
              </Text>
              <List type="number">
                <List.Item>Choisir votre plan (de 100 à 50 000 produits)</List.Item>
                <List.Item>Configurer vos canaux d&apos;export (Google Merchant, Bing, Amazon)</List.Item>
                <List.Item>Corriger les erreurs détectées par le diagnostic qualité</List.Item>
              </List>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">
                Fonctionnalités incluses
              </Text>
              <InlineStack gap="400" wrap>
                <Box minWidth="200px">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Sync temps réel
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Webhooks Shopify products/create|update|delete : vos
                      modifications partent vers Google en quelques secondes.
                    </Text>
                  </BlockStack>
                </Box>
                <Box minWidth="200px">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Diagnostic qualité
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Liste des produits qui seront rejetés par Google Merchant
                      et raisons précises, en un clic depuis Shopify Admin.
                    </Text>
                  </BlockStack>
                </Box>
                <Box minWidth="200px">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Mapping intelligent
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Catégorisation Google + attributs requis automatiquement remplis.
                    </Text>
                  </BlockStack>
                </Box>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Box paddingBlock="400">
            <Text variant="bodySm" as="p" tone="subdued" alignment="center">
              Besoin d&apos;aide ?{" "}
              <Link url="mailto:support@feedplug.com">support@feedplug.com</Link>
            </Text>
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
