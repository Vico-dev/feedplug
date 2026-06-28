import { getBackendApiBaseUrl, getConfiguredBackendOrigin } from "@/config/api";

export interface ComparatorOffer {
  offerId: string;
  merchant: string;
  price: number | null;
  currency: string | null;
  inStock: boolean;
  visitUrl: string;
  bestValue: boolean;
}

export interface PriceSignals {
  current: number;
  min90: number;
  max90: number;
  isAtLowest: boolean;
  pctVs30d: number | null;
  points: number;
}

export interface ComparatorProductResponse {
  product: {
    id: string;
    title: string;
    brand: string | null;
    imageUrl: string | null;
    gtin: string | null;
    category: string | null;
  };
  country: string;
  offers: ComparatorOffer[];
  signals: PriceSignals | null;
  indexable: boolean;
}

export interface SearchItem {
  id: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  lowestPrice: number | null;
  currency: string | null;
  merchantCount: number;
}

export interface SearchResponse {
  items: SearchItem[];
  total: number;
  limit: number;
  offset: number;
  country: string;
}

export interface PriceHistoryPoint {
  date: string;
  lowestPrice: number;
  currency: string | null;
}

export interface PriceHistoryResponse {
  country: string;
  points: PriceHistoryPoint[];
  signals: PriceSignals | null;
}

async function apiGet<T>(path: string, revalidate = 300): Promise<T | null> {
  try {
    const res = await fetch(`${getBackendApiBaseUrl()}/comparator${path}`, {
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function searchProducts(params: {
  q?: string;
  country?: string;
  brand?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<SearchResponse | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  return apiGet<SearchResponse>(`/products/search?${qs.toString()}`);
}

export function getProduct(id: string, country: string): Promise<ComparatorProductResponse | null> {
  return apiGet<ComparatorProductResponse>(`/products/${encodeURIComponent(id)}?country=${country}`, 600);
}

export function getPriceHistory(id: string, country: string): Promise<PriceHistoryResponse | null> {
  return apiGet<PriceHistoryResponse>(`/products/${encodeURIComponent(id)}/price-history?country=${country}`);
}

// Lien sortant tracké : navigation top-level directe vers le backend (302 -> deep link marchand).
export function buildVisitUrl(offerId: string, country: string): string {
  return `${getConfiguredBackendOrigin()}/api/v1/comparator/visit/${encodeURIComponent(offerId)}?country=${country}`;
}

const CURRENCY_SYMBOL: Record<string, string> = { EUR: "€", GBP: "£", USD: "$", CHF: "CHF" };

export function formatPrice(value: number | null, currency: string | null): string {
  if (value == null) return "—";
  const sym = currency ? CURRENCY_SYMBOL[currency] ?? currency : "";
  return `${value.toLocaleString("fr-FR")} ${sym}`.trim();
}
