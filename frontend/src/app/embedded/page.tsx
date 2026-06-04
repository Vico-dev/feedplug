"use client";

import {
  BlockStack,
  Box,
  Card,
  InlineStack,
  Layout,
  Link,
  List,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Page d'accueil de l'app embedded FeedPlug dans Shopify Admin.
 *
 * Première impression destinée à un merchant qui vient d'installer FeedPlug
 * depuis l'App Store : titre clair, value prop en 2 phrases, prochaine étape
 * actionable. Pas de bullshit marketing — on est dans Shopify Admin, le
 * merchant cherche à comprendre l'app et passer à l'action.
 *
 * Convention BFS : le titre + actions principales passent par TitleBar App
 * Bridge (visible dans la barre Shopify Admin au-dessus de l'iframe) plutôt
 * que par les props de Polaris Page (qui resterait à l'intérieur de l'iframe).
 */
export default function EmbeddedHomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopify = useAppBridge();

  // Le retour /api/v1/billing/shopify/return ajoute ?billing=ok à l'URL
  // de l'embedded admin une fois la subscription Shopify approuvée.
  // On affiche un Toast de confirmation et on nettoie le query param pour
  // éviter de le re-afficher au prochain mount.
  useEffect(() => {
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

  return (
    <Page
      subtitle="Synchronisez votre catalogue Shopify vers Google Shopping, Bing et Amazon"
    >
      <TitleBar title="FeedPlug">
        <button
          variant="primary"
          onClick={() => router.push("/embedded/billing")}
        >
          Choisir un plan
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
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Bienvenue dans FeedPlug
              </Text>
              <Text variant="bodyMd" as="p">
                FeedPlug pousse automatiquement votre catalogue Shopify vers les principaux canaux
                marketing : Google Shopping (GMC), Microsoft Bing Shopping et Amazon Seller. Aucun
                fichier CSV à générer, pas de cron à configurer — l'app détecte les changements et
                synchronise en continu.
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Votre boutique est déjà connectée. Sélectionnez un plan pour démarrer.
              </Text>
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
                <List.Item>Choisir votre plan (tranches de 100 à 50 000 produits)</List.Item>
                <List.Item>Connecter vos canaux d'export (Google Merchant, Bing, Amazon)</List.Item>
                <List.Item>Activer la synchronisation automatique</List.Item>
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
                      Sync continue
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Détection des changements en temps réel via webhooks Shopify
                    </Text>
                  </BlockStack>
                </Box>
                <Box minWidth="200px">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Mapping intelligent
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Catégorisation Google + attributs requis automatiquement remplis
                    </Text>
                  </BlockStack>
                </Box>
                <Box minWidth="200px">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Score qualité
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Diagnostic + correctifs des erreurs Google Merchant
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
              Besoin d'aide ?{" "}
              <Link url="mailto:support@feedplug.com">support@feedplug.com</Link>
            </Text>
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
