"use client";

import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Select,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEmbeddedFetch } from "../_components/use-embedded-fetch";

type StoreLocation = {
  id?: string;
  storeCode: string;
  name?: string | null;
  address?: string | null;
  isActive?: boolean;
};

type InventoryRow = {
  storeCode: string;
  offerId: string;
  quantity: number;
  availability: string | null;
  price: number | null;
  salePrice: number | null;
  pickupMethod: string | null;
  pickupSla: string | null;
  updatedAt: string;
};

type FeedUrlPayload = {
  feedId: string;
  globalUrl: string;
  perStoreUrls: { storeCode: string; url: string }[];
  stores: number;
};

const CSV_TEMPLATE = `storeCode,offerId,quantity,availability,price,salePrice,pickupMethod,pickupSla
STORE_PARIS_01,SKU-001,12,in stock,49.90,,buy,same day
STORE_PARIS_01,SKU-002,0,out of stock,,,reserve,next day
`;

const AVAILABILITIES = ["in stock", "out of stock", "limited availability", "on display to order"];
const PICKUP_METHODS = ["buy", "reserve", "ship to store", "not supported"];
const PICKUP_SLAS = ["same day", "next day", "2-day", "3-day", "4-day", "5-day", "6-day", "7-day", "multi-week"];

function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === "," || c === ";" || c === "\t") {
        row.push(cell);
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (cell.length > 0 || row.length > 0) {
          row.push(cell);
          out.push(row);
          row = [];
          cell = "";
        }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim().length > 0));
}

type CsvPreview = {
  rows: Partial<InventoryRow>[];
  errors: { line: number; reason: string }[];
};

function parsePreview(text: string, knownStoreCodes: Set<string>): CsvPreview {
  const matrix = parseCsv(text);
  if (matrix.length === 0) return { rows: [], errors: [{ line: 0, reason: "Fichier vide" }] };
  const header = matrix[0].map((c) => c.trim().replace(/^﻿/, ""));
  const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const idx = {
    storeCode: col("storeCode"),
    offerId: col("offerId"),
    quantity: col("quantity"),
    availability: col("availability"),
    price: col("price"),
    salePrice: col("salePrice"),
    pickupMethod: col("pickupMethod"),
    pickupSla: col("pickupSla"),
  };
  if (idx.storeCode === -1 || idx.offerId === -1 || idx.quantity === -1) {
    return { rows: [], errors: [{ line: 1, reason: "Colonnes obligatoires manquantes : storeCode, offerId, quantity" }] };
  }
  const rows: Partial<InventoryRow>[] = [];
  const errors: { line: number; reason: string }[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i];
    const line = i + 1;
    const storeCode = (r[idx.storeCode] || "").trim();
    const offerId = (r[idx.offerId] || "").trim();
    const qty = Number((r[idx.quantity] || "").trim());
    if (!storeCode || !offerId) {
      errors.push({ line, reason: "storeCode ou offerId vide" });
      continue;
    }
    if (!knownStoreCodes.has(storeCode)) {
      errors.push({ line, reason: `Magasin "${storeCode}" inconnu` });
      continue;
    }
    if (!Number.isFinite(qty) || qty < 0) {
      errors.push({ line, reason: `Quantité invalide` });
      continue;
    }
    const availability = idx.availability !== -1 ? (r[idx.availability] || "").trim().toLowerCase() || null : null;
    if (availability && !AVAILABILITIES.includes(availability)) {
      errors.push({ line, reason: `availability invalide` });
      continue;
    }
    const pickupMethod = idx.pickupMethod !== -1 ? (r[idx.pickupMethod] || "").trim().toLowerCase() || null : null;
    if (pickupMethod && !PICKUP_METHODS.includes(pickupMethod)) {
      errors.push({ line, reason: `pickupMethod invalide` });
      continue;
    }
    const pickupSla = idx.pickupSla !== -1 ? (r[idx.pickupSla] || "").trim().toLowerCase() || null : null;
    if (pickupSla && !PICKUP_SLAS.includes(pickupSla)) {
      errors.push({ line, reason: `pickupSla invalide` });
      continue;
    }
    const price = idx.price !== -1 && (r[idx.price] || "").trim() ? Number(r[idx.price]) : null;
    const salePrice = idx.salePrice !== -1 && (r[idx.salePrice] || "").trim() ? Number(r[idx.salePrice]) : null;
    if ((price != null && !Number.isFinite(price)) || (salePrice != null && !Number.isFinite(salePrice))) {
      errors.push({ line, reason: "Prix invalide" });
      continue;
    }
    rows.push({ storeCode, offerId, quantity: qty, availability, price, salePrice, pickupMethod, pickupSla });
  }
  return { rows, errors };
}

/**
 * Local Inventory Ads dans l'embedded Shopify.
 *
 * Pour les merchants Shopify multi-magasins : gérer les emplacements physiques
 * et l'inventaire local sans quitter Shopify Admin.
 *
 * Pourquoi cette page existe pour BFS : un reviewer Shopify s'attend à ce que
 * chaque feature merchant soit accessible depuis l'embedded. Avoir LIA
 * uniquement sur app.feedplug.com dégrade l'expérience.
 */
export default function EmbeddedLiaPage() {
  const fetchApi = useEmbeddedFetch();
  const shopify = useAppBridge();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [feedUrl, setFeedUrl] = useState<FeedUrlPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStore, setFilterStore] = useState("");
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [storeForm, setStoreForm] = useState({ storeCode: "", name: "", address: "" });
  const [savingStore, setSavingStore] = useState(false);

  const knownStoreCodes = useMemo(() => new Set(stores.map((s) => s.storeCode)), [stores]);

  const toast = useCallback(
    (message: string, isError = false) => {
      try {
        shopify.toast.show(message, { isError, duration: 5000 });
      } catch {
        if (process.env.NODE_ENV !== "production") console[isError ? "error" : "log"]("[lia]", message);
      }
    },
    [shopify]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [storesRes, invRes, feedRes] = await Promise.all([
        fetchApi("/platforms/lia/stores"),
        fetchApi(filterStore ? `/platforms/lia/inventory?storeCode=${encodeURIComponent(filterStore)}` : "/platforms/lia/inventory"),
        fetchApi("/platforms/lia/feed-url"),
      ]);
      if (storesRes.ok) {
        const body = (await storesRes.json()) as { stores: StoreLocation[] };
        setStores(body.stores || []);
      }
      if (invRes.ok) {
        const body = (await invRes.json()) as { inventory: InventoryRow[] };
        setInventory(body.inventory || []);
      }
      if (feedRes.ok) {
        setFeedUrl((await feedRes.json()) as FeedUrlPayload);
      } else if (feedRes.status === 404) {
        setFeedUrl(null);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur de chargement", true);
    } finally {
      setLoading(false);
    }
  }, [fetchApi, filterStore, toast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCreateStore = async () => {
    if (!storeForm.storeCode.trim()) return;
    setSavingStore(true);
    try {
      const res = await fetchApi("/platforms/lia/stores", {
        method: "POST",
        body: JSON.stringify(storeForm),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast(body?.message || `Erreur ${res.status}`, true);
        return;
      }
      toast(`Magasin ${storeForm.storeCode} ajouté`);
      setStoreForm({ storeCode: "", name: "", address: "" });
      await loadAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur réseau", true);
    } finally {
      setSavingStore(false);
    }
  };

  const handleDeleteStore = async (storeCode: string) => {
    try {
      const res = await fetchApi(`/platforms/lia/stores/${encodeURIComponent(storeCode)}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast(body?.message || `Erreur ${res.status}`, true);
        return;
      }
      toast(`Magasin ${storeCode} désactivé`);
      await loadAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur réseau", true);
    }
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    setPreview(parsePreview(text, knownStoreCodes));
  };

  const handleImport = async () => {
    if (!preview || preview.rows.length === 0) return;
    setUploading(true);
    try {
      const res = await fetchApi("/platforms/lia/inventory", {
        method: "POST",
        body: JSON.stringify({ rows: preview.rows }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast(body?.message || `Erreur ${res.status}`, true);
        return;
      }
      const body = (await res.json()) as { message: string };
      toast(body.message);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur réseau", true);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteInventoryRow = async (storeCode: string, offerId: string) => {
    try {
      const res = await fetchApi(
        `/platforms/lia/inventory/${encodeURIComponent(storeCode)}/${encodeURIComponent(offerId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast(body?.message || `Erreur ${res.status}`, true);
        return;
      }
      setInventory((curr) => curr.filter((r) => !(r.storeCode === storeCode && r.offerId === offerId)));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur réseau", true);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feedplug-lia-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("URL copiée");
    } catch {
      toast("Copie impossible — utilisez Cmd+C manuellement", true);
    }
  };

  if (loading) {
    return (
      <Page>
        <TitleBar title="Local Inventory" />
        <Box paddingBlock="800">
          <InlineStack align="center">
            <Spinner accessibilityLabel="Chargement" size="large" />
          </InlineStack>
        </Box>
      </Page>
    );
  }

  return (
    <Page subtitle="Gérez vos magasins physiques et l'inventaire local pour Google Local Inventory Ads.">
      <TitleBar title="Local Inventory" />
      <Layout>
        {/* === Banner explicatif === */}
        <Layout.Section>
          <Banner tone="info">
            <p>
              Les Local Inventory Ads de Google Shopping permettent de mettre en avant la disponibilité produit
              dans vos magasins physiques. Configurez vos points de vente, importez l&apos;inventaire par magasin,
              puis ajoutez le flux dans Google Merchant Center.
            </p>
          </Banner>
        </Layout.Section>

        {/* === Stores === */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Magasins ({stores.length})
              </Text>
              <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
                <TextField
                  label="Code magasin"
                  value={storeForm.storeCode}
                  onChange={(v) => setStoreForm({ ...storeForm, storeCode: v })}
                  autoComplete="off"
                  helpText="Identifiant Google Business Profile (ex: STORE_PARIS_01)"
                />
                <TextField
                  label="Nom (optionnel)"
                  value={storeForm.name}
                  onChange={(v) => setStoreForm({ ...storeForm, name: v })}
                  autoComplete="off"
                />
                <TextField
                  label="Adresse (optionnel)"
                  value={storeForm.address}
                  onChange={(v) => setStoreForm({ ...storeForm, address: v })}
                  autoComplete="off"
                />
              </InlineGrid>
              <InlineStack>
                <Button
                  variant="primary"
                  onClick={handleCreateStore}
                  loading={savingStore}
                  disabled={!storeForm.storeCode.trim()}
                >
                  Ajouter le magasin
                </Button>
              </InlineStack>

              {stores.length === 0 ? (
                <EmptyState heading="Aucun magasin pour l'instant" image="/embedded-empty.svg">
                  <p>
                    Ajoutez au moins un magasin pour démarrer. Le <strong>code magasin</strong> doit correspondre
                    à votre fiche Google Business Profile.
                  </p>
                </EmptyState>
              ) : (
                <BlockStack gap="0">
                  {stores.map((s) => (
                    <Box key={s.storeCode} padding="300" borderBlockStartWidth="025" borderColor="border">
                      <InlineStack align="space-between" blockAlign="center" wrap>
                        <BlockStack gap="100">
                          <Text variant="bodyMd" as="span" fontWeight="semibold">
                            {s.storeCode}
                          </Text>
                          {s.name || s.address ? (
                            <Text variant="bodySm" as="span" tone="subdued">
                              {[s.name, s.address].filter(Boolean).join(" · ")}
                            </Text>
                          ) : null}
                        </BlockStack>
                        <Button tone="critical" variant="plain" onClick={() => void handleDeleteStore(s.storeCode)}>
                          Désactiver
                        </Button>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* === Inventory Upload === */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Importer l&apos;inventaire (CSV)
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Colonnes attendues : <code>storeCode, offerId, quantity, availability, price, salePrice, pickupMethod, pickupSla</code>.
              </Text>
              <InlineStack gap="300" wrap>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  disabled={stores.length === 0 || uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onFile(file);
                  }}
                />
                <Button onClick={downloadTemplate}>Télécharger un modèle</Button>
              </InlineStack>

              {preview ? (
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <Text variant="bodyMd" as="span">
                      <strong>{preview.rows.length}</strong> ligne(s) prête(s)
                      {preview.errors.length > 0 ? (
                        <Text variant="bodyMd" as="span" tone="critical">
                          {" · "}
                          {preview.errors.length} erreur(s) ignorée(s)
                        </Text>
                      ) : null}
                    </Text>
                    <Button
                      variant="primary"
                      onClick={() => void handleImport()}
                      loading={uploading}
                      disabled={preview.rows.length === 0}
                    >
                      Importer
                    </Button>
                  </InlineStack>
                </Box>
              ) : null}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* === Inventory table === */}
        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <InlineStack align="space-between" blockAlign="center" wrap>
                <Text variant="headingMd" as="h2">
                  Inventaire actuel ({inventory.length})
                </Text>
                <Box minWidth="220px">
                  <Select
                    label=""
                    labelHidden
                    options={[
                      { label: "Tous les magasins", value: "" },
                      ...stores.map((s) => ({ label: s.storeCode, value: s.storeCode })),
                    ]}
                    value={filterStore}
                    onChange={setFilterStore}
                  />
                </Box>
              </InlineStack>
            </Box>
            {inventory.length === 0 ? (
              <Box padding="800">
                <EmptyState heading="Aucune ligne d'inventaire pour l'instant" image="/embedded-empty.svg">
                  <p>Importez un CSV pour démarrer le suivi de stock magasin par magasin.</p>
                </EmptyState>
              </Box>
            ) : (
              <IndexTable
                resourceName={{ singular: "ligne", plural: "lignes" }}
                itemCount={inventory.length}
                selectable={false}
                headings={[
                  { title: "Magasin" },
                  { title: "Produit" },
                  { title: "Quantité", alignment: "end" },
                  { title: "Disponibilité" },
                  { title: "Prix", alignment: "end" },
                  { title: "Retrait" },
                  { title: "" },
                ]}
              >
                {inventory.map((row) => (
                  <IndexTable.Row
                    id={`${row.storeCode}::${row.offerId}`}
                    key={`${row.storeCode}::${row.offerId}`}
                    position={0}
                  >
                    <IndexTable.Cell>{row.storeCode}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodySm" as="span" fontWeight="medium">
                        {row.offerId}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{row.quantity}</IndexTable.Cell>
                    <IndexTable.Cell>{row.availability || "—"}</IndexTable.Cell>
                    <IndexTable.Cell>
                      {row.price != null ? (
                        <>
                          {row.price.toFixed(2)} €
                          {row.salePrice != null ? ` / ${row.salePrice.toFixed(2)} €` : ""}
                        </>
                      ) : (
                        "—"
                      )}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {row.pickupMethod || "—"}
                      {row.pickupSla ? ` · ${row.pickupSla}` : ""}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Button
                        variant="plain"
                        tone="critical"
                        onClick={() => void handleDeleteInventoryRow(row.storeCode, row.offerId)}
                      >
                        Supprimer
                      </Button>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>

        {/* === Feed URL === */}
        {feedUrl ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  URL du flux pour Google Merchant Center
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Collez cette URL dans Google Merchant Center → Feeds → Add primary feed (Scheduled fetch, quotidien).
                </Text>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <Badge tone="info">Global</Badge>
                    <Box minWidth="0" maxWidth="540px">
                      <Text variant="bodySm" as="span" truncate>
                        {feedUrl.globalUrl}
                      </Text>
                    </Box>
                    <Button onClick={() => void copyToClipboard(feedUrl.globalUrl)}>Copier</Button>
                  </InlineStack>
                </Box>
                {feedUrl.perStoreUrls.length > 0 ? (
                  <BlockStack gap="200">
                    {feedUrl.perStoreUrls.map((s) => (
                      <Box key={s.storeCode} padding="300" background="bg-surface-secondary" borderRadius="200">
                        <InlineStack align="space-between" blockAlign="center" wrap>
                          <Badge>{s.storeCode}</Badge>
                          <Box minWidth="0" maxWidth="540px">
                            <Text variant="bodySm" as="span" truncate>
                              {s.url}
                            </Text>
                          </Box>
                          <Button onClick={() => void copyToClipboard(s.url)}>Copier</Button>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                ) : null}
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : (
          <Layout.Section>
            <Banner tone="warning">
              <p>
                Aucun flux actif sur ce compte. Synchronisez d&apos;abord votre catalogue depuis la page Catalogue.
              </p>
            </Banner>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
