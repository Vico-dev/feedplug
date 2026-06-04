"use client";

import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Layout,
  Page,
  Spinner,
  Text,
  Thumbnail,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useEffect, useState } from "react";
import { useEmbeddedFetch } from "../_components/use-embedded-fetch";

type FeedItemSummary = {
  id: string;
  title: string;
  imageUrl: string | null;
  brand: string | null;
  sku: string | null;
  price: number | null;
  currency: string | null;
  inventory: number | null;
  url: string | null;
  updatedAt: string | null;
};

type SourceOverview = {
  connected: boolean;
  shop: string | null;
  shopName: string | null;
  feedId: string | null;
  feedStatus: string | null;
  sourceStatus: string | null;
  lastSyncAt: string | null;
  connectedAt: string | null;
  totalItems: number;
  items: FeedItemSummary[];
};

const SOURCE_STATUS_TONE: Record<string, "success" | "warning" | "critical" | "info"> = {
  ACTIVE: "success",
  INACTIVE: "warning",
  ERROR: "critical",
  PENDING: "info",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatPrice(price: number | null, currency: string | null): string {
  if (price == null) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency || ""}`.trim();
  }
}

/**
 * Vue catalogue Shopify embedded.
 *
 * Affiche l'état de la connexion Shopify + un aperçu des 20 derniers produits
 * synchronisés. Permet de déclencher une re-sync manuelle (utile après un
 * gros changement de catalogue côté Shopify, avant le prochain cron).
 *
 * Pourquoi cette page existe : BFS exige un embedded autonome. Sans une vraie
 * vue du catalogue dans Shopify Admin, le reviewer flag l'app comme
 * "incomplete embedded experience" (cause classique de rejet BFS).
 */
export default function EmbeddedSourcesPage() {
  const fetchApi = useEmbeddedFetch();
  const shopify = useAppBridge();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<SourceOverview | null>(null);
  const [syncing, setSyncing] = useState(false);

  const showToast = useCallback(
    (message: string, isError = false) => {
      try {
        shopify.toast.show(message, { isError, duration: 5000 });
      } catch {
        if (process.env.NODE_ENV !== "production") {
          console[isError ? "error" : "log"]("[sources]", message);
        }
      }
    },
    [shopify]
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchApi("/api/v1/embedded/sources/overview");
      if (response.status === 409) {
        // Pas d'Account encore lié : on retombe sur l'EmptyState "boutique non connectée"
        setOverview({
          connected: false,
          shop: null,
          shopName: null,
          feedId: null,
          feedStatus: null,
          sourceStatus: null,
          lastSyncAt: null,
          connectedAt: null,
          totalItems: 0,
          items: [],
        });
        return;
      }
      if (!response.ok) {
        showToast(`Erreur ${response.status} en chargeant le catalogue`, true);
        return;
      }
      const body = (await response.json()) as SourceOverview;
      setOverview(body);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur réseau", true);
    } finally {
      setLoading(false);
    }
  }, [fetchApi, showToast]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetchApi("/api/v1/embedded/sources/sync", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!response.ok && response.status !== 202) {
        const body = await response.json().catch(() => null);
        showToast(body?.message || `Erreur ${response.status}`, true);
        return;
      }
      showToast("Synchronisation déclenchée. Actualisation dans quelques secondes…");
      // Polling léger : on relit l'overview après 8s pour voir le nouveau lastSyncAt
      window.setTimeout(() => {
        void refetch();
      }, 8000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur réseau", true);
    } finally {
      setSyncing(false);
    }
  };

  // === Loading ===
  if (loading) {
    return (
      <Page>
        <TitleBar title="Catalogue" />
        <Box paddingBlock="800">
          <InlineStack align="center">
            <Spinner accessibilityLabel="Chargement du catalogue" size="large" />
          </InlineStack>
        </Box>
      </Page>
    );
  }

  // === Pas connecté ===
  if (!overview?.connected) {
    return (
      <Page>
        <TitleBar title="Catalogue" />
        <Box paddingBlock="800">
          <EmptyState
            heading="Aucune boutique connectée"
            action={{
              content: "Reconnecter Shopify",
              url: "/embedded",
            }}
            image="/embedded-empty.svg"
          >
            <p>
              Votre boutique Shopify n'apparaît pas comme connectée à FeedPlug.
              Cela peut arriver après une réinstallation de l'app. Rechargez
              l'app ou contactez le support.
            </p>
          </EmptyState>
        </Box>
      </Page>
    );
  }

  const tone = SOURCE_STATUS_TONE[overview.sourceStatus || ""] || "info";

  return (
    <Page>
      <TitleBar title="Catalogue">
        <button
          variant="primary"
          onClick={handleSync}
          loading={syncing ? "" : undefined}
        >
          Synchroniser maintenant
        </button>
      </TitleBar>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center" wrap>
                <BlockStack gap="100">
                  <Text variant="headingMd" as="h2">
                    {overview.shopName || overview.shop || "Boutique Shopify"}
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">
                    Connectée depuis le {formatDateTime(overview.connectedAt)}
                  </Text>
                </BlockStack>
                <Badge tone={tone}>{overview.sourceStatus || "—"}</Badge>
              </InlineStack>

              <InlineStack gap="600" wrap>
                <BlockStack gap="100">
                  <Text variant="bodySm" as="p" tone="subdued">
                    Produits synchronisés
                  </Text>
                  <Text variant="headingLg" as="p">
                    {overview.totalItems.toLocaleString("fr-FR")}
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text variant="bodySm" as="p" tone="subdued">
                    Dernière synchronisation
                  </Text>
                  <Text variant="bodyMd" as="p">
                    {formatDateTime(overview.lastSyncAt)}
                  </Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <Text variant="headingSm" as="h3">
                20 produits les plus récemment mis à jour
              </Text>
            </Box>
            <ProductsTable items={overview.items} />
            {overview.totalItems > overview.items.length ? (
              <Box padding="400">
                <Text variant="bodySm" as="p" tone="subdued" alignment="center">
                  Affichage des 20 derniers. Voir l'ensemble du catalogue ({" "}
                  {overview.totalItems.toLocaleString("fr-FR")} produits) sur{" "}
                  <Button variant="plain" url="https://app.feedplug.com/fr/catalogue" target="_blank">
                    app.feedplug.com
                  </Button>
                  .
                </Text>
              </Box>
            ) : null}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function ProductsTable({ items }: { items: FeedItemSummary[] }) {
  const resourceName = { singular: "produit", plural: "produits" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(items.map((i) => ({ id: i.id })));

  if (items.length === 0) {
    return (
      <Box padding="800">
        <EmptyState
          heading="Aucun produit synchronisé pour l'instant"
          image="/embedded-empty.svg"
        >
          <p>
            La première synchronisation peut prendre quelques minutes après
            l'install. Utilisez "Synchroniser maintenant" pour la déclencher
            immédiatement.
          </p>
        </EmptyState>
      </Box>
    );
  }

  return (
    <IndexTable
      resourceName={resourceName}
      itemCount={items.length}
      selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
      onSelectionChange={handleSelectionChange}
      headings={[
        { title: "Produit" },
        { title: "Marque" },
        { title: "SKU" },
        { title: "Prix", alignment: "end" },
        { title: "Stock", alignment: "end" },
        { title: "Mis à jour" },
      ]}
    >
      {items.map((item, index) => (
        <IndexTable.Row
          id={item.id}
          key={item.id}
          selected={selectedResources.includes(item.id)}
          position={index}
        >
          <IndexTable.Cell>
            <InlineStack gap="300" blockAlign="center" wrap={false}>
              <Thumbnail
                source={item.imageUrl || ""}
                alt={item.title || "Produit"}
                size="small"
              />
              <BlockStack gap="050">
                <Text variant="bodyMd" as="span" fontWeight="semibold">
                  {item.title || "Sans titre"}
                </Text>
                {item.url ? (
                  <Text variant="bodySm" as="span" tone="subdued">
                    {item.url}
                  </Text>
                ) : null}
              </BlockStack>
            </InlineStack>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" as="span" tone="subdued">
              {item.brand || "—"}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" as="span" tone="subdued">
              {item.sku || "—"}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" as="span" alignment="end">
              {formatPrice(item.price, item.currency)}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" as="span" alignment="end">
              {item.inventory != null ? item.inventory : "—"}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" as="span" tone="subdued">
              {formatDateTime(item.updatedAt)}
            </Text>
          </IndexTable.Cell>
        </IndexTable.Row>
      ))}
    </IndexTable>
  );
}
