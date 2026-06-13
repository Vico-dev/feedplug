"use client";

import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
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
import { useEmbeddedLocale, useEmbeddedT } from "../_locale";

const LOCALE_TO_INTL: Record<"fr" | "en" | "es", string> = {
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
};

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
  originId: string | null;
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

function fieldLabel(
  field: string | null,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  const key = field || "unknown";
  const localized = t(`diagnostic.field.${key}`);
  // Si la clé n'existe pas, t() retourne la clé brute. Dans ce cas on tombe
  // sur la table FR pour les libellés legacy non traduits.
  if (localized.startsWith("diagnostic.field.")) {
    return FIELD_LABEL_FR[key] || field || "Other";
  }
  return localized;
}

function severityLabel(
  severity: string,
  t: (key: string) => string
): string {
  if (severity === "blocking") return t("diagnostic.severity.blocking");
  if (severity === "error") return t("diagnostic.severity.error");
  return t("diagnostic.severity.warning");
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
  const t = useEmbeddedT();
  const locale = useEmbeddedLocale();
  const intlLocale = LOCALE_TO_INTL[locale];
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosticOverview | null>(null);
  // Canaux cibles pour l'optim IA en masse. GMC coché par défaut car c'est
  // le seul canal avec push fonctionnel aujourd'hui ; les autres stockent
  // la version optimisée mais seront propagés quand les push seront prêts.
  const [optimPlatforms, setOptimPlatforms] = useState<Record<string, boolean>>({
    gmc: true,
    meta: false,
    amazon: false,
    tiktok: false,
  });
  const [optimizing, setOptimizing] = useState(false);

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
        showToast(`Error ${response.status}`, true);
        return;
      }
      const body = (await response.json()) as DiagnosticOverview;
      setData(body);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Network error", true);
    } finally {
      setLoading(false);
    }
  }, [fetchApi, showToast]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const handleOptimizeAll = useCallback(async () => {
    const platforms = Object.entries(optimPlatforms)
      .filter(([, on]) => on)
      .map(([key]) => key);
    if (platforms.length === 0) {
      showToast("Sélectionnez au moins un canal cible.", true);
      return;
    }
    setOptimizing(true);
    try {
      const response = await fetchApi("/embedded/products/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        showToast(body?.message || `Erreur ${response.status}`, true);
        return;
      }
      const count = body?.productCount ?? 0;
      const seconds = body?.estimatedSeconds ?? 0;
      showToast(
        `Optimisation IA lancée pour ${count} produit(s) sur ${platforms.length} canal(aux) — ~${seconds}s.`,
        false
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Échec lancement optimisation", true);
    } finally {
      setOptimizing(false);
    }
  }, [fetchApi, optimPlatforms, showToast]);

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
        <TitleBar title={t("diagnostic.title")} />
        <Box paddingBlock="800">
          <InlineStack align="center">
            <Spinner accessibilityLabel="Loading…" size="large" />
          </InlineStack>
        </Box>
      </Page>
    );
  }

  if (!data?.connected || summary.total === 0) {
    return (
      <Page>
        <TitleBar title={t("diagnostic.title")} />
        <Box paddingBlock="800">
          <EmptyState
            heading={t("diagnostic.empty.heading")}
            action={{ content: t("diagnostic.empty.action"), url: "/embedded/sources" }}
            image="/embedded-empty.svg"
          >
            <p>{t("diagnostic.empty.body")}</p>
          </EmptyState>
        </Box>
      </Page>
    );
  }

  return (
    <Page subtitle={t("diagnostic.subtitle", { total: summary.total.toLocaleString(intlLocale) })}>
      <TitleBar title={t("diagnostic.title")}>
        <button onClick={() => void refetch()}>{t("diagnostic.reload")}</button>
      </TitleBar>

      <Layout>
        {/* Résumé global */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
            <ScoreCard
              label={t("diagnostic.scoreCard.avg")}
              value={summary.avgScore != null ? `${summary.avgScore.toFixed(1)}/100` : "—"}
              tone={summary.avgScore != null && summary.avgScore < 60 ? "critical" : summary.avgScore != null && summary.avgScore < 80 ? "warning" : "success"}
            />
            <ScoreCard
              label={t("diagnostic.scoreCard.critical")}
              value={summary.buckets.critical.toLocaleString(intlLocale)}
              hint={t("diagnostic.scoreCard.criticalHint")}
              tone="critical"
            />
            <ScoreCard
              label={t("diagnostic.scoreCard.error")}
              value={summary.buckets.error.toLocaleString(intlLocale)}
              hint={t("diagnostic.scoreCard.errorHint")}
              tone="critical"
            />
            <ScoreCard
              label={t("diagnostic.scoreCard.ok")}
              value={summary.buckets.ok.toLocaleString(intlLocale)}
              hint={t("diagnostic.scoreCard.okHint", { percent: summary.okPercent })}
              tone="success"
            />
          </InlineGrid>
        </Layout.Section>

        {/* Action IA centrale : optim multi-canal en masse */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center" wrap>
                <BlockStack gap="100">
                  <Text variant="headingMd" as="h2">
                    Optimiser avec l&apos;IA FeedPlug
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">
                    Réécrivez titres et descriptions de tous vos produits selon les règles de chaque canal (limite caractères, ton, mots-clés). Stocké par canal : le bon contenu part vers le bon push.
                  </Text>
                </BlockStack>
              </InlineStack>
              <InlineGrid columns={{ xs: 2, md: 4 }} gap="300">
                <Checkbox
                  label="Google Shopping"
                  helpText="Titre 150 c. SEO"
                  checked={optimPlatforms.gmc}
                  onChange={(v) => setOptimPlatforms((p) => ({ ...p, gmc: v }))}
                />
                <Checkbox
                  label="Meta (Facebook/Instagram)"
                  helpText="200 c. accrocheur"
                  checked={optimPlatforms.meta}
                  onChange={(v) => setOptimPlatforms((p) => ({ ...p, meta: v }))}
                />
                <Checkbox
                  label="Amazon"
                  helpText="200 c. mots-clés A9"
                  checked={optimPlatforms.amazon}
                  onChange={(v) => setOptimPlatforms((p) => ({ ...p, amazon: v }))}
                />
                <Checkbox
                  label="TikTok Shop"
                  helpText="34 c. punchy"
                  checked={optimPlatforms.tiktok}
                  onChange={(v) => setOptimPlatforms((p) => ({ ...p, tiktok: v }))}
                />
              </InlineGrid>
              <InlineStack gap="300" blockAlign="center">
                <Button
                  variant="primary"
                  size="large"
                  loading={optimizing}
                  onClick={() => void handleOptimizeAll()}
                >
                  Optimiser tous les produits
                </Button>
                <Text variant="bodySm" as="p" tone="subdued">
                  Le push GMC est relancé automatiquement à la fin.
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Répartition visuelle */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingSm" as="h2">
                {t("diagnostic.distribution.heading")}
              </Text>
              <BlockStack gap="200">
                <DistributionRow
                  label={t("diagnostic.distribution.critical")}
                  value={summary.buckets.critical}
                  total={summary.total}
                  tone="critical"
                  intlLocale={intlLocale}
                />
                <DistributionRow
                  label={t("diagnostic.distribution.error")}
                  value={summary.buckets.error}
                  total={summary.total}
                  tone="critical"
                  intlLocale={intlLocale}
                />
                <DistributionRow
                  label={t("diagnostic.distribution.warning")}
                  value={summary.buckets.warning}
                  total={summary.total}
                  tone="warning"
                  intlLocale={intlLocale}
                />
                <DistributionRow
                  label={t("diagnostic.distribution.ok")}
                  value={summary.buckets.ok}
                  total={summary.total}
                  tone="success"
                  intlLocale={intlLocale}
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
                  {t("diagnostic.topReasons.heading", { count: data.topIssues.length })}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  {t("diagnostic.topReasons.body")}
                </Text>
                <BlockStack gap="200">
                  {data.topIssues.map((issue) => (
                    <InlineStack key={`${issue.field}-${issue.severity}`} align="space-between" blockAlign="center" wrap>
                      <InlineStack gap="200" blockAlign="center">
                        <Badge tone={SEVERITY_TONE[issue.severity] || "info"}>
                          {severityLabel(issue.severity, t)}
                        </Badge>
                        <Text variant="bodyMd" as="span" fontWeight="semibold">
                          {fieldLabel(issue.field, t)}
                        </Text>
                      </InlineStack>
                      <Text variant="bodyMd" as="span" tone="subdued">
                        {t("diagnostic.topReasons.products", {
                          count: issue.occurrences.toLocaleString(intlLocale),
                        })}
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
                  {t("diagnostic.worstProducts.heading")}
                </Text>
              </Box>
              <BlockStack gap="0">
                {data.worstProducts.map((product) => (
                  <WorstProductRow key={product.id} product={product} shop={data.shop || ""} t={t} />
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Box paddingBlock="400">
            <Text variant="bodySm" as="p" tone="subdued" alignment="center">
              {t("diagnostic.methodology")}
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
  intlLocale,
}: {
  label: string;
  value: number;
  total: number;
  tone: "success" | "critical" | "warning";
  intlLocale: string;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <BlockStack gap="100">
      <InlineStack align="space-between" blockAlign="center">
        <Text variant="bodyMd" as="span">
          {label}
        </Text>
        <Text variant="bodyMd" as="span" tone="subdued">
          {value.toLocaleString(intlLocale)} ({percent}%)
        </Text>
      </InlineStack>
      <ProgressBar progress={percent} tone={tone === "warning" ? "highlight" : tone === "critical" ? "critical" : "success"} size="small" />
    </BlockStack>
  );
}

function WorstProductRow({
  product,
  shop,
  t,
}: {
  product: WorstProduct;
  shop: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const shopHandle = shop.replace(/\.myshopify\.com$/i, "");
  // originId arrive du backend au format "Product/8765..." ou
  // "ProductVariant/N" (préfixe Shopify gid:// déjà strippé à l'ingestion).
  // Shopify Admin attend l'ID numérique seul. Fallback null si pas dispo
  // (legacy items pré-feature) → on cache le bouton plutôt que de renvoyer
  // sur la liste produits avec un UUID FeedPlug qui donnait une 404.
  const productAdminId = product.originId
    ? product.originId.replace(/^(Product|ProductVariant)\//i, "")
    : null;
  const shopifyAdminUrl = shopHandle && productAdminId
    ? `https://admin.shopify.com/store/${shopHandle}/products/${encodeURIComponent(productAdminId)}`
    : null;
  const scoreTone = product.qualityScore < 40 ? "critical" : product.qualityScore < 60 ? "critical" : "warning";

  return (
    <Box padding="400" borderBlockStartWidth="025" borderColor="border">
      <InlineStack align="space-between" blockAlign="start" gap="400" wrap={false}>
        <InlineStack gap="300" blockAlign="start" wrap={false}>
          <Thumbnail
            source={product.imageUrl || ""}
            alt={product.title || "Product"}
            size="small"
          />
          <BlockStack gap="100">
            <Text variant="bodyMd" as="span" fontWeight="semibold">
              {product.title || "Untitled"}
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
                    {`${fieldLabel(iss.field, t)} — ${iss.message || ""}`}
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
              {t("diagnostic.worstProducts.fix")}
            </Button>
          ) : null}
        </BlockStack>
      </InlineStack>
    </Box>
  );
}
