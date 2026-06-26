/**
 * Service partagé pour les connexions de plateformes (Google Merchant Center,
 * Amazon Seller Central, Google Ads). Mutualise les appels API entre la page
 * Flux et la page Channels du dashboard.
 *
 * Note routing : seul le flux Amazon renvoie l'OAuth vers le `returnTo` fourni
 * (ex. /channels). GMC et Google Ads redirigent côté backend vers /flux après
 * connexion — comportement existant inchangé.
 */
import { apiClient } from "@/lib/api";
import { AMAZON_EXPORT_CHANNELS } from "@/lib/services/flux.service";

export { AMAZON_EXPORT_CHANNELS };
export type AmazonChannelKey = (typeof AMAZON_EXPORT_CHANNELS)[number]["channelKey"];

// ── Types ──────────────────────────────────────────────────────────────────
export interface GmcStatus {
  connected: boolean;
  merchantId?: string;
  merchantName?: string;
  email?: string;
  tokenExpired?: boolean;
  connectedAt?: string;
}

export interface GmcLastPush {
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  createdAt?: string;
}

export interface GmcSelectionMerchant {
  merchantId: string;
  merchantName?: string;
  aggregatorId?: string;
  label?: string;
}

export interface GmcSelectionPayload {
  selectionId: string;
  email?: string;
  merchants: GmcSelectionMerchant[];
}

export interface GoogleAdsStatus {
  connected: boolean;
  customerId?: string;
  email?: string;
  connectedAt?: string;
}

export interface AmazonStatus {
  connected: boolean;
  sellerId?: string;
  tokenExpired?: boolean;
  connectedAt?: string;
}

export interface AmazonChannel {
  id: string;
  channelkey: string;
  label: string;
  isactive: boolean;
}

/**
 * Résultat de l'initialisation de connexion Amazon.
 * - `redirect` : URL à ouvrir pour lancer l'OAuth Seller Central.
 * - `soon` : Amazon SP-API pas encore activé côté infra (configured:false) →
 *   afficher un message neutre « arrive bientôt », pas une erreur.
 */
export type ConnectAmazonResult =
  | { kind: "redirect"; url: string }
  | { kind: "soon"; message: string };

const AMAZON_SOON_MESSAGE = "La connexion Amazon Seller Central arrive bientôt sur FeedPlug.";

// ── Google Merchant Center ───────────────────────────────────────────────────
export async function getGmcStatus(): Promise<GmcStatus> {
  const { data } = await apiClient.get<GmcStatus>("/platforms/gmc/status");
  return data ?? { connected: false };
}

export async function getGmcLastPush(): Promise<GmcLastPush | null> {
  const { data } = await apiClient.get<{ lastPush: GmcLastPush | null }>("/platforms/gmc/last-push");
  return data?.lastPush ?? null;
}

export async function getGmcAuthUrl(locale: string, returnTo?: string): Promise<string | null> {
  const suffix = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
  const { data } = await apiClient.get<{ authUrl?: string }>(
    `/platforms/gmc/auth-url?locale=${encodeURIComponent(locale)}${suffix}`
  );
  return data?.authUrl ?? null;
}

export async function disconnectGmc(): Promise<void> {
  await apiClient.delete("/platforms/gmc/disconnect");
}

export interface GmcSyncResult {
  message?: string;
  total?: number;
  succeeded?: number;
  failed?: number;
  reconnect?: boolean;
}

export async function syncGmc(): Promise<GmcSyncResult> {
  const { data } = await apiClient.post<GmcSyncResult>("/platforms/gmc/push");
  return data ?? {};
}

export async function getGmcSelection(selectionId: string): Promise<GmcSelectionPayload | null> {
  const { data } = await apiClient.get<GmcSelectionPayload>(
    `/platforms/gmc/selection/${encodeURIComponent(selectionId)}`
  );
  if (!data) return null;
  return { ...data, merchants: Array.isArray(data.merchants) ? data.merchants : [] };
}

export async function confirmGmcSelection(selectionId: string, merchantId: string): Promise<void> {
  await apiClient.post("/platforms/gmc/select-merchant", { selectionId, merchantId });
}

// ── Amazon Seller Central ────────────────────────────────────────────────────
export async function getAmazonStatus(): Promise<AmazonStatus> {
  const { data } = await apiClient.get<AmazonStatus>("/platforms/amazon/status");
  return data ?? { connected: false };
}

export async function getAmazonChannels(): Promise<AmazonChannel[]> {
  const { data } = await apiClient.get<{ channels: AmazonChannel[] }>("/platforms/amazon/channels");
  return Array.isArray(data?.channels) ? data.channels : [];
}

export async function connectAmazon(returnTo = "/channels"): Promise<ConnectAmazonResult> {
  const { data } = await apiClient.get<{ connectUrl?: string; configured?: boolean; message?: string }>(
    `/platforms/amazon/connect-init?returnTo=${encodeURIComponent(returnTo)}`
  );
  if (data?.connectUrl) {
    return { kind: "redirect", url: data.connectUrl };
  }
  // configured:false (ou pas d'URL) → SP-API non activé, message neutre.
  return { kind: "soon", message: data?.configured === false ? AMAZON_SOON_MESSAGE : data?.message || AMAZON_SOON_MESSAGE };
}

export async function disconnectAmazon(): Promise<void> {
  await apiClient.delete("/platforms/amazon/disconnect");
}

export async function toggleAmazonChannel(channelKey: string, enabled: boolean): Promise<void> {
  if (enabled) {
    await apiClient.post("/platforms/amazon/channels", { channelKey });
  } else {
    await apiClient.delete(`/platforms/amazon/channels/${encodeURIComponent(channelKey)}`);
  }
}

// ── Google Ads ───────────────────────────────────────────────────────────────
export async function getGoogleAdsStatus(): Promise<GoogleAdsStatus> {
  const { data } = await apiClient.get<GoogleAdsStatus>("/platforms/google-ads/status");
  return data ?? { connected: false };
}

export async function getGoogleAdsAuthUrl(returnTo?: string): Promise<string | null> {
  const suffix = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  const { data } = await apiClient.get<{ authUrl?: string }>(`/platforms/google-ads/auth-url${suffix}`);
  return data?.authUrl ?? null;
}

export async function disconnectGoogleAds(): Promise<void> {
  await apiClient.delete("/platforms/google-ads/disconnect");
}
