import { apiClient } from '@/lib/api';

import { API_BASE_URL } from '@/lib/api';
const API_BASE = API_BASE_URL;

export interface FeedSource {
  id: string;
  name: string;
  connector: string;
  configJson?: Record<string, unknown>;
  defaultFreq: string;
  status: string;
  lastRunAt: string | null;
}

export interface Feed {
  id: string;
  name: string;
  sourceId: string;
  frequency: string;
  status: string;
  mappingJson?: Record<string, string>;
  latestRun?: {
    status?: string | null;
    totalFetched?: number | null;
    totalInserted?: number | null;
    totalUpdated?: number | null;
    totalSkipped?: number | null;
    errorMessage?: string | null;
    finishedAt?: string | null;
  } | null;
  source: FeedSource;
  createdAt: string;
  updatedAt?: string;
}

export interface FeedAuditIssue {
  key: string;
  label: string;
  severity: 'high' | 'medium' | 'low';
  affectedProducts: number;
  affectedRate: number;
  impact: string;
  recommendation: string;
}

export interface FeedAudit {
  feedId: string;
  generatedAt: string;
  summary: {
    totalProducts: number;
    sampleSize: number;
    averageProductScore: number;
    coverageRate: number;
    approvalReadyRate: number;
  };
  score: number;
  potentialScore: number;
  estimatedAdditionalApprovedProducts: number;
  estimatedVisibilityLiftPct: number;
  scoreBreakdown: {
    dataCoverage: number;
    productQuality: number;
    channelReadiness: number;
  };
  topIssues: FeedAuditIssue[];
  methodology: {
    scoring: string;
    estimation: string;
  };
}

export async function getFeeds(): Promise<Feed[]> {
  const res = await apiClient.get<Feed[]>('/ingestion/feeds');
  return res.data ?? [];
}

export async function getFeedAudit(feedId: string): Promise<FeedAudit> {
  const res = await apiClient.get<FeedAudit>(`/ingestion/feeds/${feedId}/audit`);
  if (!res.data) {
    throw new Error('Audit indisponible');
  }
  return res.data;
}

/** Canaux Amazon supportés pour l'export */
export const AMAZON_EXPORT_CHANNELS = [
  { channelKey: 'amazon_fr', label: 'Amazon FR' },
  { channelKey: 'amazon_uk', label: 'Amazon UK' },
  { channelKey: 'amazon_de', label: 'Amazon DE' },
  { channelKey: 'amazon_it', label: 'Amazon IT' },
  { channelKey: 'amazon_es', label: 'Amazon ES' },
] as const;

/**
 * Télécharge le flux au format CSV (Google Merchant Center).
 * Ouvre le blob en téléchargement dans le navigateur.
 */
export async function exportFeedAsCsv(feedId: string, filename?: string): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'gmc', undefined, filename);
}

export async function exportFeedAsCsvForDestination(
  feedId: string,
  destinationId: string,
  filename?: string
): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'gmc', undefined, filename, destinationId);
}

/**
 * Télécharge le flux au format CSV pour un canal Amazon (ex. amazon_fr, amazon_uk).
 */
export async function exportFeedAsCsvAmazon(
  feedId: string,
  channel: (typeof AMAZON_EXPORT_CHANNELS)[number]['channelKey'],
  filename?: string,
  destinationId?: string
): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'amazon', channel, filename, destinationId);
}

export async function exportFeedAsCsvAmazonForDestination(
  feedId: string,
  destinationId: string,
  channel: (typeof AMAZON_EXPORT_CHANNELS)[number]['channelKey'] = 'amazon_fr',
  filename?: string
): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'amazon', channel, filename, destinationId);
}

/**
 * Télécharge le flux au format CSV Cdiscount Pro.
 */
export async function exportFeedAsCsvCdiscount(feedId: string, filename?: string): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'cdiscount', undefined, filename);
}

/**
 * Télécharge le flux au format CSV Rakuten.
 */
export async function exportFeedAsCsvRakuten(feedId: string, filename?: string): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'rakuten', undefined, filename);
}

/**
 * Télécharge le flux au format CSV Meta (Facebook / Instagram Catalogue).
 */
export async function exportFeedAsCsvMeta(feedId: string, filename?: string): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'meta', undefined, filename);
}

/**
 * Télécharge le flux au format JSON (ChatGPT Product Feed Spec) ou CSV pour ChatGPT.
 */
export async function exportFeedAsChatGPT(
  feedId: string,
  format: 'json' | 'csv' = 'json',
  filename?: string
): Promise<void> {
  return exportFeedForPlatform(feedId, 'chatgpt', format, undefined, filename);
}

/**
 * Télécharge le flux au format CSV Bing / Microsoft Merchant Center.
 */
export async function exportFeedAsCsvBing(feedId: string, filename?: string): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'bing', undefined, filename);
}

/**
 * Télécharge le flux au format CSV Pinterest (catalogue).
 */
export async function exportFeedAsCsvPinterest(feedId: string, filename?: string): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'pinterest', undefined, filename);
}

/**
 * Télécharge le flux au format CSV TikTok (catalogue / Data Feed).
 */
export async function exportFeedAsCsvTikTok(feedId: string, filename?: string): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'tiktok', undefined, filename);
}

/**
 * Télécharge le flux au format CSV Snapchat (Catalog Ads).
 */
export async function exportFeedAsCsvSnapchat(feedId: string, filename?: string): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'snapchat', undefined, filename);
}

/**
 * Télécharge le flux au format CSV Yandex Market.
 */
export async function exportFeedAsCsvYandex(feedId: string, filename?: string): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'yandex', undefined, filename);
}

/**
 * Télécharge le flux au format CSV Baidu (marché chinois).
 */
export async function exportFeedAsCsvBaidu(feedId: string, filename?: string): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'baidu', undefined, filename);
}

/**
 * Télécharge le flux au format CSV Perplexity (Merchant / Buy with Pro).
 */
export async function exportFeedAsCsvPerplexity(feedId: string, filename?: string): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'perplexity', undefined, filename);
}

/**
 * Télécharge le flux au format CSV Google Gemini (Shopping / Merchant).
 */
export async function exportFeedAsCsvGemini(feedId: string, filename?: string): Promise<void> {
  return exportFeedAsCsvForPlatform(feedId, 'gemini', undefined, filename);
}

export type ExportPlatform = 'gmc' | 'meta' | 'amazon' | 'cdiscount' | 'rakuten' | 'chatgpt' | 'bing' | 'pinterest' | 'tiktok' | 'snapchat' | 'yandex' | 'baidu' | 'perplexity' | 'gemini';

async function exportFeedAsCsvForPlatform(
  feedId: string,
  platform: ExportPlatform,
  channel?: string,
  filename?: string,
  destinationId?: string
): Promise<void> {
  return exportFeedForPlatform(feedId, platform, 'csv', channel, filename, destinationId);
}

async function exportFeedForPlatform(
  feedId: string,
  platform: ExportPlatform,
  format: 'csv' | 'json',
  channel?: string,
  filename?: string,
  destinationId?: string
): Promise<void> {
  let url = `${API_BASE}/ingestion/feeds/${feedId}/export?format=${format}&platform=${platform}`;
  if (channel) {
    url += `&channel=${encodeURIComponent(channel)}`;
  }
  if (destinationId) {
    url += `&destinationId=${encodeURIComponent(destinationId)}`;
  }
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const text = await response.text();
    let message = 'Export impossible';
    try {
      const json = JSON.parse(text);
      message = json.message || message;
    } catch {
      message = text?.slice(0, 200) || message;
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  const match = disposition && disposition.match(/filename="?([^";]+)"?/);
  const defaultName = `feed-${platform}-${feedId}.${format}`;
  const name = filename || (match ? match[1] : defaultName);

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
