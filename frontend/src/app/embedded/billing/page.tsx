"use client";

import {
  Badge,
  Banner,
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
  Text,
} from "@shopify/polaris";
import { useMemo, useState } from "react";
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

/**
 * Page de souscription Shopify Billing.
 *
 * Flux :
 *  1. Merchant choisit tranche produits + canaux + add-on IA
 *  2. POST /api/v1/billing/shopify/subscribe (auth = session token Shopify)
 *  3. Backend appelle Shopify Billing API → renvoie confirmationUrl
 *  4. On redirige le top-level vers confirmationUrl (escape iframe nécessaire
 *     car la page de confirmation Shopify ne peut pas être affichée embedded)
 *  5. Après approbation, Shopify rappelle /return → marque sub ACTIVE → redirige
 *     vers admin embedded avec billing=ok
 */
export default function EmbeddedBillingPage() {
  const fetchApi = useEmbeddedFetch();
  const [tier, setTier] = useState<ProductTier>(500);
  const [channels, setChannels] = useState<ChannelCount>(2);
  const [addonIA, setAddonIA] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthlyPriceEur = useMemo(
    () => getPriceEur({ productTier: tier, channels, addonIA }),
    [tier, channels, addonIA]
  );

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
    setError(null);
    try {
      const response = await fetchApi("/api/v1/billing/shopify/subscribe", {
        method: "POST",
        body: JSON.stringify({ tier, channels, addonIA }),
      });
      if (response.status === 409) {
        const body = await response.json().catch(() => null);
        if (body?.code === "NO_ACCOUNT_FOR_SHOP") {
          setError(
            "Aucun compte FeedPlug n'est encore lié à votre boutique. Terminez d'abord la création de votre espace."
          );
          return;
        }
        setError(body?.message || "Connexion Shopify manquante");
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message || `Erreur ${response.status}`);
        return;
      }
      const body = (await response.json()) as { confirmationUrl: string };
      if (!body.confirmationUrl) {
        setError("Réponse Shopify invalide (confirmationUrl manquant)");
        return;
      }
      // L'écran de confirmation Shopify Billing ne peut pas être affiché dans
      // l'iframe (X-Frame-Options deny côté Shopify). On force un top-level
      // redirect ; après approbation, Shopify rappelle notre /return qui ramène
      // le merchant dans l'app embedded.
      if (typeof window !== "undefined") {
        if (window.top) {
          window.top.location.href = body.confirmationUrl;
        } else {
          window.location.href = body.confirmationUrl;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page
      title="Choisir un plan"
      backAction={{ content: "Accueil", url: "/embedded" }}
      subtitle="Facturation gérée par Shopify Payments — aucune carte à saisir"
    >
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        ) : null}

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
