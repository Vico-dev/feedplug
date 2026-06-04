"use client";

import {
  Badge,
  BlockStack,
  Box,
  Card,
  EmptyState,
  IndexTable,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Spinner,
  Text,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEmbeddedFetch } from "../_components/use-embedded-fetch";
import type {
  ChannelStats,
  DashboardData,
  ProductRow,
} from "@/lib/shopify/types";
import {
  channelLabel,
  formatNumber,
  formatPrice,
  formatPriceCompact,
  formatRoas,
} from "@/lib/shopify/formatters";

type StatTone = "success" | "critical" | "subdued";

function roasTone(roas: number | null | undefined): StatTone {
  if (roas == null || !Number.isFinite(roas)) return "subdued";
  if (roas >= 1) return "success";
  if (roas >= 0.5) return "subdued";
  return "critical";
}

function safeNumber(metrics: Record<string, unknown>, key: string): number | null {
  const v = metrics?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Vue performance embedded — agrégats par canal + top produits.
 *
 * Réutilise l'endpoint /api/v1/performance/dashboard du dashboard standalone
 * (auth mixte JWT/session token). Les types DashboardData/ChannelStats/ProductRow
 * sont partagés via lib/shopify/types.ts → si le backend ajoute un champ, les
 * deux UIs le voient automatiquement.
 *
 * Pourquoi cette page existe pour BFS : un reviewer Shopify s'attend à voir
 * des KPI live dans l'embedded admin (sinon "incomplete embedded experience").
 * On expose le minimum vital : ROAS + revenus + clics par canal + top produits.
 * La vue analytique fine reste sur app.feedplug.com (lien en bas de page).
 */
export default function EmbeddedPerformancePage() {
  const fetchApi = useEmbeddedFetch();
  const shopify = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  const showToast = useCallback(
    (message: string, isError = false) => {
      try {
        shopify.toast.show(message, { isError, duration: 5000 });
      } catch {
        if (process.env.NODE_ENV !== "production") {
          console[isError ? "error" : "log"]("[performance]", message);
        }
      }
    },
    [shopify]
  );

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchApi("/api/v1/performance/dashboard");
      if (response.status === 409) {
        setData({ byChannel: [], topProducts: [], byCategory: [] });
        return;
      }
      if (!response.ok) {
        showToast(`Erreur ${response.status} en chargeant les performances`, true);
        return;
      }
      const body = (await response.json()) as DashboardData;
      setData(body);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur réseau", true);
    } finally {
      setLoading(false);
    }
  }, [fetchApi, showToast]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const totals = useMemo(() => {
    const channels = data?.byChannel ?? [];
    const impressions = channels.reduce((s, c) => s + (c.impressions || 0), 0);
    const clicks = channels.reduce((s, c) => s + (c.clicks || 0), 0);
    const cost = channels.reduce((s, c) => s + (c.cost || 0), 0);
    const revenue = channels.reduce((s, c) => s + (c.revenue || 0), 0);
    const roas = cost > 0 ? revenue / cost : null;
    return { impressions, clicks, cost, revenue, roas };
  }, [data]);

  // === Loading ===
  if (loading) {
    return (
      <Page>
        <TitleBar title="Performance" />
        <Box paddingBlock="800">
          <InlineStack align="center">
            <Spinner accessibilityLabel="Chargement des performances" size="large" />
          </InlineStack>
        </Box>
      </Page>
    );
  }

  const hasData = data && data.byChannel.length > 0;

  if (!hasData) {
    return (
      <Page>
        <TitleBar title="Performance" />
        <Box paddingBlock="800">
          <EmptyState
            heading="Aucune donnée de performance pour l'instant"
            action={{ content: "Synchroniser le catalogue", url: "/embedded/sources" }}
            secondaryAction={{
              content: "Connecter Google Ads sur app.feedplug.com",
              url: "https://app.feedplug.com/fr/sources",
              external: true,
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              Les performances apparaissent dès que vous connectez un canal
              publicitaire (Google Ads, Meta Ads, Amazon). FeedPlug agrège les
              impressions, clics, revenus et ROAS par produit synchronisé.
            </p>
          </EmptyState>
        </Box>
      </Page>
    );
  }

  return (
    <Page subtitle="Agrégats sur les 30 derniers jours">
      <TitleBar title="Performance" />
      <Layout>
        <Layout.Section>
          <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
            <StatCard
              label="Impressions"
              value={formatNumber(totals.impressions)}
            />
            <StatCard label="Clics" value={formatNumber(totals.clicks)} />
            <StatCard label="Revenus" value={formatPriceCompact(totals.revenue)} />
            <StatCard
              label="ROAS"
              value={formatRoas(totals.roas)}
              tone={roasTone(totals.roas)}
            />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <Text variant="headingSm" as="h2">
                Performance par canal
              </Text>
            </Box>
            <ChannelTable channels={data.byChannel} />
          </Card>
        </Layout.Section>

        {data.topProducts.length > 0 ? (
          <Layout.Section>
            <Card padding="0">
              <Box padding="400">
                <Text variant="headingSm" as="h2">
                  Top produits
                </Text>
              </Box>
              <TopProductsTable products={data.topProducts.slice(0, 10)} />
            </Card>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Box paddingBlock="400">
            <Text variant="bodySm" as="p" tone="subdued" alignment="center">
              Analyse complète (séries temporelles, comparatifs, segmentation)
              disponible sur{" "}
              <a
                href="https://app.feedplug.com/fr/performance"
                target="_blank"
                rel="noopener noreferrer"
              >
                app.feedplug.com/performance
              </a>
              .
            </Text>
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: StatTone;
}) {
  const polarisTone = tone === "success" || tone === "critical" ? tone : undefined;
  return (
    <Card>
      <BlockStack gap="100">
        <Text variant="bodySm" as="p" tone="subdued">
          {label}
        </Text>
        <Text variant="headingLg" as="p" tone={polarisTone}>
          {value}
        </Text>
      </BlockStack>
    </Card>
  );
}

function ChannelTable({ channels }: { channels: ChannelStats[] }) {
  return (
    <IndexTable
      resourceName={{ singular: "canal", plural: "canaux" }}
      itemCount={channels.length}
      selectable={false}
      headings={[
        { title: "Canal" },
        { title: "Impressions", alignment: "end" },
        { title: "Clics", alignment: "end" },
        { title: "Coût", alignment: "end" },
        { title: "Revenus", alignment: "end" },
        { title: "ROAS", alignment: "end" },
        { title: "Produits", alignment: "end" },
      ]}
    >
      {channels.map((c, index) => (
        <IndexTable.Row id={c.channel} key={c.channel} position={index}>
          <IndexTable.Cell>
            <Text variant="bodyMd" as="span" fontWeight="semibold">
              {channelLabel(c.channel)}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" as="span" alignment="end">
              {formatNumber(c.impressions)}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" as="span" alignment="end">
              {formatNumber(c.clicks)}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" as="span" alignment="end">
              {formatPrice(c.cost)}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" as="span" alignment="end">
              {formatPrice(c.revenue)}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            {(() => {
              const t = roasTone(c.roas);
              const badgeTone =
                t === "success" || t === "critical" ? t : undefined;
              return <Badge tone={badgeTone}>{formatRoas(c.roas)}</Badge>;
            })()}
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" as="span" alignment="end">
              {formatNumber(c.productCount)}
            </Text>
          </IndexTable.Cell>
        </IndexTable.Row>
      ))}
    </IndexTable>
  );
}

function TopProductsTable({ products }: { products: ProductRow[] }) {
  return (
    <IndexTable
      resourceName={{ singular: "produit", plural: "produits" }}
      itemCount={products.length}
      selectable={false}
      headings={[
        { title: "Produit" },
        { title: "Canal" },
        { title: "Score" },
        { title: "Revenus", alignment: "end" },
        { title: "Coût", alignment: "end" },
      ]}
    >
      {products.map((p, index) => {
        const revenue = safeNumber(p.metrics || {}, "revenue") ??
          safeNumber(p.metrics || {}, "conversions_value");
        const cost = safeNumber(p.metrics || {}, "cost") ?? safeNumber(p.metrics || {}, "spend");
        return (
          <IndexTable.Row id={p.itemId} key={p.itemId} position={index}>
            <IndexTable.Cell>
              <BlockStack gap="050">
                <Text variant="bodyMd" as="span" fontWeight="semibold">
                  {p.title || "Sans titre"}
                </Text>
                {p.sku ? (
                  <Text variant="bodySm" as="span" tone="subdued">
                    SKU {p.sku}
                  </Text>
                ) : null}
              </BlockStack>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodyMd" as="span" tone="subdued">
                {channelLabel(p.channel)}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodyMd" as="span">
                {p.channelScore != null ? Math.round(p.channelScore) : "—"}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodyMd" as="span" alignment="end">
                {formatPrice(revenue)}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodyMd" as="span" alignment="end">
                {formatPrice(cost)}
              </Text>
            </IndexTable.Cell>
          </IndexTable.Row>
        );
      })}
    </IndexTable>
  );
}
