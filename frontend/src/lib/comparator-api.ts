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

export interface CategoryPageResponse {
  category: { id: string; slug: string; labelfr: string; labelen: string | null; icon: string | null };
  items: SearchItem[];
  total: number;
  limit: number;
  offset: number;
  country: string;
}

// Page rayon (catégorie) : produits d'une catégorie de la taxonomie. Public (sans auth).
export function getCategory(
  slug: string,
  country: string,
  params: { limit?: number; offset?: number } = {},
): Promise<CategoryPageResponse | null> {
  const qs = new URLSearchParams({ country });
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  return apiGet<CategoryPageResponse>(`/category/${encodeURIComponent(slug)}?${qs.toString()}`);
}

// Feed public « bons plans » (plus fortes baisses, sans login). Public via apiGet.
export interface DealItem {
  id: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  lowestPrice: number | null;
  currency: string | null;
  merchantCount: number;
  pctVs30d: number | null;
  rrpDropPct: number | null;
  dropScore: number;
}

export interface DealsResponse {
  items: DealItem[];
  total: number;
  limit: number;
  offset: number;
  country: string;
}

export function getPublicDeals(params: {
  country?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<DealsResponse | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGet<DealsResponse>(`/deals${suffix}`);
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

// ─────────────────────────────────────────────────────────────────────────────
// Compte CONSO (magic-link) — fetches AUTHENTIFIÉS côté client.
// Cookie cmp_session (HttpOnly) posé par le backend : tout passe par `credentials:'include'`
// et vise directement l'origine backend (le proxy /feedplug-api est dédié à l'auth B2B
// bearer et ne relaie pas ce cookie). En cross-origin prod, le cookie doit être
// SameSite=None;Secure (voir cookieOptions backend) ; en local (même host, ports
// différents) SameSite=Lax suffit.
// ─────────────────────────────────────────────────────────────────────────────

export interface ComparatorAccount {
  id: string;
  email: string;
  countryCode: string;
  locale: string;
  marketingOptIn?: boolean;
  firstName?: string | null;
}

export interface ComparatorProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  countryCode: string;
  locale: string;
  marketingOptIn: boolean;
}

// Champs éditables du profil (PATCH partiel : on n'envoie que ce qui change).
export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  countryCode?: string;
  marketingOptIn?: boolean;
}

export interface ComparatorCategory {
  id: string;
  slug: string;
  labelfr: string;
  labelen: string | null;
  icon: string | null;
}

export interface WatchlistItem {
  id: string;
  groupId: string;
  country: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  priceAtAdd: number | null;
  currentPrice: number | null;
  currency: string | null;
  dropPct: number | null;
  addedAt: string;
}

export interface PersonalFeedItem {
  id: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  categoryId: string;
  lowestPrice: number | null;
  currency: string | null;
  merchantCount: number;
  pctVs30d: number | null;
  rrpDropPct: number | null;
  dropScore: number;
}

function accountUrl(path: string): string {
  return `${getConfiguredBackendOrigin()}/api/v1/comparator${path}`;
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(accountUrl(path), {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (res.status === 401) {
    const err = new Error("unauthenticated") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`request failed (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function requestMagicLink(email: string, locale = "fr"): Promise<{ message: string }> {
  return authFetch("/account/magic-link", {
    method: "POST",
    body: JSON.stringify({ email, locale }),
  });
}

export function verifyMagicLink(token: string, country = "FR", locale = "fr"): Promise<{ user: ComparatorAccount }> {
  return authFetch("/account/verify", {
    method: "POST",
    body: JSON.stringify({ token, country, locale }),
  });
}

export function logout(): Promise<{ message: string }> {
  return authFetch("/account/logout", { method: "POST" });
}

export function getMe(): Promise<ComparatorAccount> {
  return authFetch("/account/me");
}

export function getProfile(): Promise<ComparatorProfile> {
  return authFetch("/account/profile");
}

export function updateProfile(patch: ProfileUpdate): Promise<ComparatorProfile> {
  return authFetch("/account/profile", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteAccount(): Promise<{ message: string }> {
  return authFetch("/account", { method: "DELETE" });
}

export function getCategories(): Promise<{ categories: ComparatorCategory[] }> {
  return authFetch("/categories");
}

export function getInterests(): Promise<{ categoryIds: string[] }> {
  return authFetch("/account/interests");
}

export function setInterests(categoryIds: string[]): Promise<{ categoryIds: string[] }> {
  return authFetch("/account/interests", {
    method: "PUT",
    body: JSON.stringify({ categoryIds }),
  });
}

export function getWatchlist(): Promise<{ items: WatchlistItem[] }> {
  return authFetch("/account/watchlist");
}

export function addWatch(groupId: string, country: string): Promise<{ ok: boolean; created: boolean }> {
  return authFetch("/account/watchlist", {
    method: "POST",
    body: JSON.stringify({ groupId, country }),
  });
}

export function removeWatch(groupId: string, country?: string): Promise<{ ok: boolean }> {
  const qs = country ? `?country=${encodeURIComponent(country)}` : "";
  return authFetch(`/account/watchlist/${encodeURIComponent(groupId)}${qs}`, { method: "DELETE" });
}

export function getPersonalFeed(params: { country?: string; limit?: number; offset?: number } = {}): Promise<{
  items: PersonalFeedItem[];
  total: number;
  limit: number;
  offset: number;
  country: string;
}> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetch(`/account/feed${suffix}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding enrichi : socio-démo (RGPD, optionnel + consenti) + affinité marques + reco.
// ─────────────────────────────────────────────────────────────────────────────

export interface ComparatorDemographics {
  agerange: string | null;
  gender: string | null;
  region: string | null;
  household: string | null;
  budgetrange: string | null;
  consentAt: string | null;
}

// Payload PUT : tous les champs optionnels. `consent` (booléen) pose/retire le consentement.
export interface ComparatorDemographicsInput {
  agerange?: string | null;
  gender?: string | null;
  region?: string | null;
  household?: string | null;
  budgetrange?: string | null;
  consent?: boolean;
}

export interface RecommendationItem {
  id: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  categoryId: string;
  lowestPrice: number | null;
  currency: string | null;
  merchantCount: number;
  rrpDropPct: number | null;
  affinityBonus: number;
}

export function getDemographics(): Promise<{ demographics: ComparatorDemographics }> {
  return authFetch("/account/profile-demographics");
}

export function setDemographics(input: ComparatorDemographicsInput): Promise<{ demographics: ComparatorDemographics }> {
  return authFetch("/account/profile-demographics", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function getFavoriteBrands(): Promise<{ brands: string[] }> {
  return authFetch("/account/brands");
}

export function setFavoriteBrands(brands: string[]): Promise<{ brands: string[] }> {
  return authFetch("/account/brands", {
    method: "PUT",
    body: JSON.stringify({ brands }),
  });
}

export function getRecommendations(params: { country?: string; limit?: number } = {}): Promise<{
  items: RecommendationItem[];
  country: string;
}> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetch(`/account/recommendations${suffix}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cashback — wallet conso (ledger CashbackTransaction alimenté par le poll AWIN).
// ─────────────────────────────────────────────────────────────────────────────

export interface CashbackWallet {
  pending: number;
  available: number;
  paid: number;
  lifetime: number;
  currency: string;
}

export interface CashbackTransactionItem {
  id: string;
  merchantname: string | null;
  cashbackamount: number | null;
  currency: string | null;
  status: string;
  occurredat: string | null;
  createdat: string;
}

export interface CashbackResponse {
  wallet: CashbackWallet;
  transactions: CashbackTransactionItem[];
  payoutThreshold: number;
  payoutAvailable: boolean;
}

export function getCashback(): Promise<CashbackResponse> {
  return authFetch("/account/cashback");
}
