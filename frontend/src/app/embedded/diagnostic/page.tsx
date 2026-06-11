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
  ProgressBar,
  Spinner,
  Text,
  Thumbnail,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEmbeddedFetch } from "../_components/use-embedded-fetch";

type Buckets = {
  critical: number;
  error: number;
  warning: number;
  ok: number;
};

type TopIssue = {
  field: string;
  severity: string;
  occurrences: number;
};

type WorstProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  sku: string | null;
  url: string | null;
  qualityScore: number;
  topIssues: { field: string | null; severity: string; message: string }[];
};

type DiagnosticOverview = {
  connected: boolean;
  feedId?: string;
  shop?: string;
  totalItems: number;
  buckets: Buckets;
  averageScore: number | null;
  topIssues: TopIssue[];
  worstProducts: WorstProduct[];
};

const SEVERITY_TONE: Record<string, "critical" | "warning" | "info" | "attention"> = {
  blocking: "critical",
  critical: "critical",
  error: "critical",
  warning: "warning",
  info: "info",
};

// Lib des libellés humains pour les champs feed (alignés Google Merchant)
const FIELD_LABEL_FR: Record<string, string> = {
  id: "ID produit",
  title: "Titre",
  description: "Description",
  image: "Image principale",
  imageUrl: "Image principale",
  price: "Prix",
  availability: "Disponibilité",
  condition: "État",
  link: "Lien produit",
  url: "Lien produit",
  brand: "Marque",
  gtin: "GTIN / EAN",
  mpn: "Référence fabricant (MPN)",
  google_product_category: "Catégorie Google",
  product_type: "Type de produit",
  shipping: "Livraison",
  unknown: "Autre",
};

function fieldLabel(field: string | null): string {
  if (!field) return "Autre";
  return FIELD_LABEL_FR[field] || field;
}

/**
 * Vue diagnostic GMC — la valeur principale FeedPlug dans l'embedded admin.
 *
 * Affiche : combien de produits sont en état "rejet certain" (critical) /
 * "erreur" / "warning" / "OK", les top raisons (GTIN manquant, image, prix...)
 * et les 20 produits les plus problématiques avec un accès direct à Shopify
 * Admin pour les corriger.
 *
 * Pourquoi c'est crucial pour BFS : sans cette vue, l'app n'est qu'un
 * connecteur dans l'embedded. Le reviewer flag "incomplete embedded
 * experience" et le pricing 79€/mois paraît injustifié.
 */
export default function EmbeddedDiagnosticPage() {
  const fetchApi = useEmbeddedFetch();
  const shopify = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosticOverview | null>(null);

  const showToast = useCallback(
    (message: string, isError = false) => {
      try {
        shopify.toast.show(message, { isError, duration: 5000 });
      } catch {
        if (process.env.NODE_ENV !== "production") {
          console[isError ? "error" : "log"]("[diagnostic]", message);
        }
      }
    },
    [shopify]
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchApi("/embedded/diagnostic/overview");
      if (response.status === 409) {
        setData({
          connected: false,
          totalItems: 0,
          buckets: { critical: 0, error: 0, warning: 0, ok: 0 },
          averageScore: null,
          topIssues: [],
          worstProducts: [],
        });
        return;
      }
      if (!response.ok) {
        showToast(`Erreur ${response.status} en chargeant le diagnostic`, true);
        return;
      }
      const body = (await response.json()) as DiagnosticOverview;
      setData(body);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur réseau", true);
    } finally {
      setLoading(false);
    }
  }, [fetchApi, showToast]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const summary = useMemo(() => {
    const total = data?.totalItems ?? 0;
    const buckets = data?.buckets ?? { critical: 0, error: 0, warning: 0, ok: 0 };
    const needsFix = buckets.critical + buckets.error;
    return {
      total,
      buckets,
      needsFix,
      fixPercent: total > 0 ? Math.round((needsFix / total) * 100) : 0,
      okPercent: total > 0 ? Math.round((buckets.ok / total) * 100) : 0,
      avgScore: data?.averageScore ?? null,
    };
  }, [data]);

  if (loading) {
    return (
      <Page>
        <TitleBar title="Diagnostic" />
        <Box paddingBlock="800">
          <InlineStack align="center">
            <Spinner accessibilityLabel="Chargement du diagnostic" size="large" />
          </InlineStack>
        </Box>
      </Page>
    );
  }

  if (!data?.connected || summary.total === 0) {
    return (
      <Page>
        <TitleBar title="Diagnostic" />
        <Box paddingBlock="800">
          <EmptyState
            heading="Aucun produit analysé pour l'instant"
            action={{ content: "Synchroniser le catalogue", url: "/embedded/sources" }}
            image="/embedded-empty.svg"
          >
            <p>
              Le diagnostic qualité analyse chaque produit synchronisé selon les règles
              Google Merchant Center, Microsoft Bing et Amazon. Lancez une synchronisation
              du catalogue pour voir apparaître ici les erreurs à corriger avant publication.
            </p>
          </EmptyState>
        </Box>
      </Page>
    );
  }

  return (
    <Page subtitle={`${summary.total.toLocaleString("fr-FR")} produits analysés selon les règles Google Merchant Center`}>
      <TitleBar title="Diagnostic qualité">
        <button onClick={() => void refetch()}>Recharger</button>
      </TitleBar>

      <Layout>
        {/* Résumé global */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
            <ScoreCard
              label="Score moyen"
              value={summary.avgScore != null ? `${summary.avgScore.toFixed(1)}/100` : "—"}
              tone={summary.avgScore != null && summary.avgScore < 60 ? "critical" : summary.avgScore != null && summary.avgScore < 80 ? "warning" : "success"}
            />
            <ScoreCard
              label="À corriger en urgence"
              value={summary.buckets.critical.toLocaleString("fr-FR")}
              hint="Score < 40 — rejet Google certain"
              tone="critical"
            />
            <ScoreCard
              label="Erreurs"
              value={summary.buckets.error.toLocaleString("fr-FR")}
              hint="Score 40-59 — champ obligatoire manquant"
              tone="critical"
            />
            <ScoreCard
              label="Conformes"
              value={summary.buckets.ok.toLocaleString("fr-FR")}
              hint={`${summary.okPercent}% du catalogue`}
              tone="success"
            />
          </InlineGrid>
        </Layout.Section>

        {/* Répartition visuelle */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingSm" as="h2">
                Répartition par score
              </Text>
              <BlockStack gap="200">
                <DistributionRow
                  label="Critique (< 40)"
                  value={summary.buckets.critical}
                  total={summary.total}
                  tone="critical"
                />
                <DistributionRow
                  label="Erreurs (40-59)"
                  value={summary.buckets.error}
                  total={summary.total}
                  tone="critical"
                />
                <DistributionRow
                  label="Avertissements (60-79)"
                  value={summary.buckets.warning}
                  total={summary.total}
                  tone="warning"
                />
                <DistributionRow
                  label="Conformes (80+)"
                  value={summary.buckets.ok}
                  total={summary.total}
                  tone="success"
                />
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Top raisons */}
        {data.topIssues.length > 0 ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h2">
                  Top raisons de rejet ({data.topIssues.length})
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Corriger ces champs en masse via votre interface Shopify est le moyen le plus
                  rapide d'améliorer le score global.
                </Text>
                <BlockStack gap="200">
                  {data.topIssues.map((issue) => (
                    <InlineStack key={`${issue.field}-${issue.severity}`} align="space-between" blockAlign="center" wrap>
                      <InlineStack gap="200" blockAlign="center">
                        <Badge tone={SEVERITY_TONE[issue.severity] || "info"}>
                          {issue.severity === "blocking" ? "Bloquant" : issue.severity === "error" ? "Erreur" : "Warning"}
                        </Badge>
                        <Text variant="bodyMd" as="span" fontWeight="semibold">
                          {fieldLabel(issue.field)}
                        </Text>
                      </InlineStack>
                      <Text variant="bodyMd" as="span" tone="subdued">
                        {issue.occurrences.toLocaleString("fr-FR")} produits
                      </Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : null}

        {/* Top 20 produits à corriger */}
        {data.worstProducts.length > 0 ? (
          <Layout.Section>
            <Card padding="0">
              <Box padding="400">
                <Text variant="headingSm" as="h2">
                  20 produits à corriger en priorité
                </Text>
              </Box>
              <BlockStack gap="0">
                {data.worstProducts.map((product) => (
                  <WorstProductRow key={product.id} product={product} shop={data.shop || ""} />
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Box paddingBlock="400">
            <Text variant="bodySm" as="p" tone="subdued" alignment="center">
              Méthodologie : chaque produit est noté selon les règles officielles Google
              Merchant Center, Microsoft Bing Shopping et Amazon. Le score considère les
              champs obligatoires, la qualité de la description, des images et la
              cohérence des attributs structurés.
            </Text>
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function ScoreCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "critical" | "warning" | "info" | "subdued";
}) {
  const textTone = tone === "success" || tone === "critical" ? tone : undefined;
  return (
    <Card>
      <BlockStack gap="100">
        <Text variant="bodySm" as="p" tone="subdued">
          {label}
        </Text>
        <Text variant="headingLg" as="p" tone={textTone}>
          {value}
        </Text>
        {hint ? (
          <Text variant="bodySm" as="p" tone="subdued">
            {hint}
          </Text>
        ) : null}
      </BlockStack>
    </Card>
  );
}

function DistributionRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "success" | "critical" | "warning";
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <BlockStack gap="100">
      <InlineStack align="space-between" blockAlign="center">
        <Text variant="bodyMd" as="span">
          {label}
        </Text>
        <Text variant="bodyMd" as="span" tone="subdued">
          {value.toLocaleString("fr-FR")} ({percent}%)
        </Text>
      </InlineStack>
      <ProgressBar progress={percent} tone={tone === "warning" ? "highlight" : tone === "critical" ? "critical" : "success"} size="small" />
    </BlockStack>
  );
}

function WorstProductRow({ product, shop }: { product: WorstProduct; shop: string }) {
  const shopHandle = shop.replace(/\.myshopify\.com$/i, "");
  const shopifyAdminUrl = shopHandle
    ? `https://admin.shopify.com/store/${shopHandle}/products/${encodeURIComponent(product.id)}`
    : null;
  const scoreTone = product.qualityScore < 40 ? "critical" : product.qualityScore < 60 ? "critical" : "warning";

  return (
    <Box padding="400" borderBlockStartWidth="025" borderColor="border">
      <InlineStack align="space-between" blockAlign="start" gap="400" wrap={false}>
        <InlineStack gap="300" blockAlign="start" wrap={false}>
          <Thumbnail
            source={product.imageUrl || ""}
            alt={product.title || "Produit"}
            size="small"
          />
          <BlockStack gap="100">
            <Text variant="bodyMd" as="span" fontWeight="semibold">
              {product.title || "Sans titre"}
            </Text>
            {product.sku ? (
              <Text variant="bodySm" as="span" tone="subdued">
                SKU: {product.sku}
              </Text>
            ) : null}
            {product.topIssues.length > 0 ? (
              <InlineStack gap="100" wrap>
                {product.topIssues.map((iss, idx) => (
                  <Badge key={`${iss.field}-${idx}`} tone={SEVERITY_TONE[iss.severity] || "info"}>
                    {`${fieldLabel(iss.field)} — ${iss.message || "à corriger"}`}
                  </Badge>
                ))}
              </InlineStack>
            ) : null}
          </BlockStack>
        </InlineStack>
        <BlockStack gap="100" align="end">
          <Badge tone={scoreTone}>{`${product.qualityScore}/100`}</Badge>
          {shopifyAdminUrl ? (
            <Button url={shopifyAdminUrl} target="_top" size="slim">
              Corriger
            </Button>
          ) : null}
        </BlockStack>
      </InlineStack>
    </Box>
  );
}
