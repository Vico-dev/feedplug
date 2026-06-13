/**
 * Types partagés entre le dashboard standalone (/[locale]/(dashboard)/...)
 * et l'embedded Shopify Admin (/embedded/...).
 *
 * Pourquoi un fichier partagé : éviter les divergences silencieuses entre les
 * deux UIs quand un champ évolue côté backend. La règle simple :
 *  - Champs renvoyés par les endpoints `/api/v1/...` → ici
 *  - Helpers de formatage (prix, dates, status) → formatters.ts
 *  - UI components → restent séparés (shadcn dans le dashboard, Polaris
 *    dans l'embedded — BFS exige Polaris, mélange impossible)
 *
 * Sources de vérité backend :
 *  - FeedSource / Feed / FeedItem  ← prisma/schema.prisma (modèles éponymes)
 *  - ChannelStats / ProductRow / CategoryRow / DashboardData  ← server-minimal.js
 *    routes /api/v1/performance/dashboard
 */

// ============================================================
// Sources / Feeds (catalogue ingestion)
// ============================================================

export interface FeedSource {
  id: string;
  name: string;
  connector: string;
  configJson: Record<string, unknown>;
  defaultFreq: string;
  status: string;
  lastRunAt: string | null;
  createdAt: string;
}

export interface FeedLatestRun {
  status?: string | null;
  totalFetched?: number | null;
  totalInserted?: number | null;
  totalUpdated?: number | null;
  totalSkipped?: number | null;
  errorMessage?: string | null;
  finishedAt?: string | null;
}

export interface Feed {
  id: string;
  name: string;
  sourceId: string;
  frequency: string;
  status: string;
  mappingJson?: Record<string, string>;
  latestRun?: FeedLatestRun | null;
  createdAt: string;
}

/** Vue allégée d'un FeedItem destinée aux overviews (embedded /sources, dashboard list). */
export interface FeedItemSummary {
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
}

// ============================================================
// Performance (par canal, top produits, par catégorie)
// ============================================================

export interface ChannelStats {
  channel: string;
  impressions: number;
  clicks: number;
  cost: number;
  revenue: number;
  roas: number;
  productCount: number;
}

export interface ProductRow {
  itemId: string;
  title: string;
  sku: string | null;
  channel: string;
  channelScore: number;
  metrics: Record<string, unknown>;
}

export interface CategoryRow {
  category: string;
  channel: string;
  cost: number;
  revenue: number;
  roas: number;
  productCount: number;
}

export interface DashboardData {
  byChannel: ChannelStats[];
  topProducts: ProductRow[];
  byCategory: CategoryRow[];
}

// ============================================================
// Embedded (Shopify-specific endpoints)
// ============================================================

export interface ShopifySourceOverview {
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
}
