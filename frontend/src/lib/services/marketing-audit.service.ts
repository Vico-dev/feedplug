import { apiClient } from '@/lib/api';
import { API_BASE_URL } from '@/lib/api';

export type MarketingAuditConnector = 'SHOPIFY' | 'PRESTASHOP' | 'GMC' | 'CSV' | 'OTHER';
export type MarketingAuditChannel = 'google_shopping' | 'meta_ads' | 'amazon' | 'marketplaces' | 'chatgpt';
export type MarketingAuditDataLevel = 'low' | 'medium' | 'high';
export type MarketingAuditSyncMode = 'manual' | 'scheduled' | 'automatic';
export type MarketingAuditGmcStatus = 'not_used' | 'warnings' | 'many_disapprovals' | 'healthy';

export interface MarketingAuditCoverage {
  title: number;
  description: number;
  image: number;
  brand: number;
  category: number;
  identifier: number;
  price: number;
  url: number;
  availability: number;
}

export interface MarketingAuditRequest {
  firstName: string;
  lastName: string;
  jobTitle: string;
  phone?: string;
  company: string;
  email: string;
  locale: string;
  connectorType: MarketingAuditConnector;
  cmsUsed?: string;
  shopUrl?: string;
  merchantId?: string;
  catalogSize: number;
  targetChannels: MarketingAuditChannel[];
  goal?: string;
  captchaToken?: string;
  companyWebsite?: string;
  formStartedAt?: number;
  gmcDiagnostics?: {
    issueCount?: number;
    disapprovalRate?: number;
  };
}

export interface MarketingAuditIssue {
  key: string;
  label: string;
  severity: 'high' | 'medium' | 'low';
  affectedProducts: number;
  affectedRate: number;
  impact: string;
  recommendation: string;
}

export interface MarketingAuditReport {
  score: number;
  potentialScore: number;
  estimatedAdditionalApprovedProducts: number;
  estimatedVisibilityLiftPct: number;
  scoreBand?: {
    label: string;
    description: string;
  };
  summary: {
    totalProducts: number;
    sampleSize: number;
    averageProductScore: number;
    coverageRate: number;
    approvalReadyRate: number;
  };
  scoreBreakdown: {
    dataCoverage: number;
    productQuality: number;
    channelReadiness: number;
  };
  connectorType: MarketingAuditConnector;
  targetChannels: MarketingAuditChannel[];
  auditPillars?: Array<{
    key: string;
    label: string;
    score: number;
    detail: string;
  }>;
  coverage: MarketingAuditCoverage;
  gmcDiagnostics: {
    disapprovalRate: number;
    issueCount: number;
    diagnosticsScore: number;
  };
  topIssues: MarketingAuditIssue[];
  opportunities: Array<{
    label: string;
    value: string | number;
    detail: string;
  }>;
  methodology: {
    scoring: string;
    estimation: string;
  };
  sampleProducts?: Array<{
    before: {
      title: string;
      description: string;
      imageUrl: string | null;
      issues: string[];
    };
    after: {
      title: string;
      description: string;
      attributes: Array<{ label: string; value: string }>;
      imageUrl?: string;
    } | null;
  }>;
}

export interface MarketingAudit {
  id: string;
  shareToken: string;
  shareUrl: string;
  email: string;
  company: string;
  locale: string;
  connectorType: MarketingAuditConnector;
  cmsUsed?: string;
  shopUrl?: string;
  merchantId?: string;
  catalogSize: number;
  targetChannels: MarketingAuditChannel[];
  report?: MarketingAuditReport | null;
  status?: string;
  input?: MarketingAuditRequest & {
    shopifyConnection?: { shop?: string; connectedAt?: string };
    gmcConnection?: { merchantId?: string; email?: string; connectedAt?: string };
  };
  createdAt: string;
}

export async function createMarketingAudit(payload: MarketingAuditRequest): Promise<MarketingAudit> {
  const response = await apiClient.post<{ audit: MarketingAudit }>('/marketing/audits', payload);
  if (!response.data?.audit) {
    throw new Error('Audit indisponible');
  }
  return response.data.audit;
}

export async function getMarketingAudit(shareToken: string) {
  const response = await apiClient.get<{ audit: MarketingAudit & { input?: MarketingAuditRequest; updatedAt?: string } }>(`/marketing/audits/${shareToken}`);
  if (!response.data?.audit) {
    throw new Error('Audit introuvable');
  }
  return response.data.audit;
}

export async function getMarketingAuditGmcAuthUrl(shareToken: string): Promise<string> {
  const response = await apiClient.get<{ authUrl: string }>(`/marketing/audits/${shareToken}/platforms/gmc/auth-url`);
  if (!response.data?.authUrl) {
    throw new Error('Connexion GMC indisponible');
  }
  return response.data.authUrl;
}

export async function getMarketingAuditShopifyAuthUrl(shareToken: string, shop: string): Promise<string> {
  const response = await apiClient.post<{ url: string }>(`/marketing/audits/${shareToken}/connectors/shopify/connect`, { shop });
  if (!response.data?.url) {
    throw new Error('Connexion Shopify indisponible');
  }
  return response.data.url;
}

export async function connectMarketingAuditPrestashop(shareToken: string, payload: { shopUrl: string; apiKey: string }) {
  const response = await apiClient.post<{ success: boolean; message?: string }>(`/marketing/audits/${shareToken}/connectors/prestashop/connect`, payload);
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'Connexion PrestaShop indisponible');
  }
  return response.data;
}

export async function connectMarketingAuditFile(shareToken: string, payload: { feedUrl: string }) {
  const response = await apiClient.post<{ success: boolean; message?: string }>(`/marketing/audits/${shareToken}/connectors/file/connect`, payload);
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'Connexion flux indisponible');
  }
  return response.data;
}

export function getMarketingAuditPdfUrl(shareToken: string): string {
  return `${API_BASE_URL.replace(/\/+$/, '')}/marketing/audits/${encodeURIComponent(shareToken)}/pdf`;
}
