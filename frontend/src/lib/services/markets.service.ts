import { apiClient } from "@/lib/api";

export interface MarketLocale {
  id: string;
  localeCode: string;
  languageCode: string;
  countryCode: string;
  isDefault: boolean;
  isRequiredLaunch: boolean;
  translationMode: string;
}

export interface MarketDestination {
  id: string;
  marketLocaleId: string | null;
  platformKey: string;
  currencyCode: string;
  externalScopeType: string;
  externalScopeId: string | null;
  externalScopeLabel: string | null;
  slug: string;
  status: string;
  isPrimary: boolean;
  config: Record<string, unknown>;
}

export interface MarketChannel {
  id: string;
  platformKey: string;
  label: string;
  platformAccountId: string | null;
  platformAccountName: string | null;
  platformAccountExternalId: string | null;
  platformAccountStatus: string | null;
  status: string;
  isEnabled: boolean;
  settings: Record<string, unknown>;
  destinations: MarketDestination[];
}

export interface MarketReadiness {
  status: "draft" | "in_progress" | "ready" | "action_required" | string;
  localeCount: number;
  channelCount: number;
  destinationCount: number;
  readyChannels: number;
  missingConnections: number;
}

export interface Market {
  id: string;
  code: string;
  name: string;
  status: string;
  sourceMarketId: string | null;
  countryCodes: string[];
  defaultCurrencyCode: string;
  pricingPolicy: Record<string, unknown>;
  shippingPolicy: Record<string, unknown>;
  taxPolicy: Record<string, unknown>;
  contentStrategy: Record<string, unknown>;
  publicationDefaults: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  locales: MarketLocale[];
  channels: MarketChannel[];
  readiness: MarketReadiness;
}

export interface CreateMarketPayload {
  code: string;
  name?: string;
  sourceMarketId?: string | null;
  countryCodes?: string[];
  defaultCurrencyCode?: string;
  status?: string;
  locales?: Array<{
    localeCode: string;
    languageCode?: string;
    countryCode?: string;
    isDefault?: boolean;
    isRequiredLaunch?: boolean;
    translationMode?: string;
  }>;
  channels?: Array<
    | string
    | {
        platformKey: string;
        platformAccountId?: string | null;
        status?: string;
        isEnabled?: boolean;
        settingsJson?: Record<string, unknown>;
      }
  >;
}

export async function getMarkets(): Promise<Market[]> {
  const response = await apiClient.get<{ markets?: Market[] }>("/markets");
  return response.data?.markets ?? [];
}

export async function createMarket(payload: CreateMarketPayload): Promise<Market | null> {
  const response = await apiClient.post<{ market?: Market }>("/markets", payload);
  return response.data?.market ?? null;
}

// ─── Translation preview ─────────────────────────────────────────────

export interface MarketPreviewProduct {
  id: string;
  sku: string | null;
  brand: string | null;
  imageUrl: string | null;
  url: string | null;
  price: number | null;
  currency: string | null;
}

export interface MarketPreviewLocale {
  id: string;
  localeCode: string;
  languageCode: string;
  countryCode: string;
  translationMode: string;
  isDefault: boolean;
}

export interface MarketPreviewResponse {
  market: { id: string; code: string; name: string };
  locale: MarketPreviewLocale;
  product: MarketPreviewProduct;
  source: { title: string; descriptionText: string };
  translated: { title: string; descriptionText: string };
  meta: {
    mode: "translate" | "source" | "manual";
    sourceLanguage: string;
    targetLanguage: string;
    cached: boolean;
    provider: string | null;
    cost: number;
    tokensUsed: number;
  };
  warnings: string[];
}

export async function previewMarketProduct(
  marketId: string,
  productId: string,
  options: { localeId?: string; refresh?: boolean } = {},
): Promise<MarketPreviewResponse> {
  const params = new URLSearchParams({ productId });
  if (options.localeId) params.set("localeId", options.localeId);
  if (options.refresh) params.set("refresh", "1");
  const response = await apiClient.get<MarketPreviewResponse>(
    `/markets/${marketId}/preview?${params.toString()}`,
  );
  if (!response.data) {
    throw new Error("Réponse vide du backend pour la prévisualisation marché.");
  }
  return response.data;
}
