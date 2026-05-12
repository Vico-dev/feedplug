/* eslint-disable @next/next/no-img-element */
"use client";

import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, usePathname } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { FaAmazon, FaMeta, FaGoogle } from 'react-icons/fa6';
import { apiClient } from '@/lib/api';
import { ArrowLeft, Save, Package, Edit2, X, Sparkles, ChevronLeft, ChevronRight, ZoomIn, History, RotateCcw, Undo2, CheckCircle, AlertCircle, ChevronDown, Globe, Power, PowerOff, Settings2 } from 'lucide-react';
import { ProductAiOptimizationModal } from '@/components/optimization/product-ai-optimization-modal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  PageLayout,
  PageError,
} from '@/components/layout';
import { getPreferredOptimizedPlatformContent, parseProductCustomFields } from '@/lib/optimized-product-content';
import { getLocalePrefixFromPathname } from '@/lib/locale-navigation';
import { cn } from '@/lib/utils';
import { ProductMappingGrid, ProductFieldWithSource, ProductDetailSkeleton } from '@/components/catalogue';
import type { FieldSource } from '@/components/catalogue';
import { Chart } from '@/components/ui/chart';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface FieldStatus {
  filled?: boolean;
  present?: boolean;
  weight?: number;
}

interface RecommendationItem {
  field?: string;
  message?: string;
}

interface QualityDetails {
  required?: Record<string, FieldStatus>;
  recommended?: Record<string, FieldStatus>;
  secondarySources?: Record<string, { filled: boolean; label?: string }>;
  missingFields?: string[];
  filledFields?: string[];
  compliance?: {
    required?: Record<string, FieldStatus>;
    recommended?: Record<string, FieldStatus>;
    issues?: RecommendationItem[];
  };
  issues?: RecommendationItem[];
  recommendations?: RecommendationItem[];
}

interface ProductScoreData {
  qualityScore?: number;
  performanceScore?: number;
  blocking?: boolean;
  dimensions?: Record<string, number>;
  qualityDetails?: QualityDetails;
}

interface FeedItem {
  imageurl?: string | null;
  additional_image_link?: string[] | string | null;
  customfields?: Record<string, unknown> | string | null;
  customFields?: Record<string, unknown>;
  _channelOverrides?: Record<string, boolean>;
  id: string;
  title: string;
  sku: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  inventory: number | null;
  url: string | null;
  imageUrl: string | null;
  additionalImages?: string[];
  descriptionText: string | null;
  descriptionHtml: string | null;
  gtin?: string | null;
  mpn?: string | null;
  condition?: string | null;
  productType?: string | null;
  googleProductCategory?: string | null;
  color?: string | null;
  size?: string | null;
  material?: string | null;
  pattern?: string | null;
  gender?: string | null;
  ageGroup?: string | null;
  availability?: string | null;
  itemGroupId?: string | null;
  createdAt: string;
  updatedAt: string;
  feed: {
    id: string;
    name: string;
    mappingJson?: Record<string, string>;
    mappingjson?: Record<string, string>;
    source: {
      id: string;
      name: string;
      connector: string;
    };
  };
  productScore?: ProductScoreData;
  // Tous les champs dynamiques du mapping
  [key: string]: unknown;
}

interface AmazonExportChannel {
  channelkey: string;
  label?: string | null;
}

interface ProductOutputSummary {
  google: {
    connected: boolean;
    merchantId?: string;
    email?: string;
  };
  amazon: {
    connected: boolean;
    sellerId?: string;
    channels: AmazonExportChannel[];
  };
}

interface ChannelCard {
  key: string;
  label: string;
  detail: string;
  statusLabel: 'Actif' | 'Désactivé' | 'Activer le canal';
  checked: boolean;
  toggleDisabled: boolean;
  helper?: string | null;
  actionLabel: string;
  actionVariant?: 'accent' | 'outline' | 'secondary';
  onAction: () => void;
}

interface ProductDestinationActivation {
  destinationId: string;
  destinationSlug: string;
  status: string;
  platformKey: string;
  platformLabel: string;
  marketId: string;
  marketCode: string;
  marketName: string;
  localeCode: string | null;
  languageCode?: string | null;
  countryCode?: string | null;
  currencyCode?: string | null;
  externalScopeLabel?: string | null;
  isEnabled: boolean;
  activationSource: 'destination' | 'legacy' | string;
  activationStatus: string;
  excludedReason?: string | null;
}

interface ProductDestinationActivationResponse {
  itemId: string;
  channelOverrides?: Record<string, boolean>;
  summary?: {
    totalDestinations: number;
    activeDestinations: number;
    marketCount: number;
  };
  destinations?: ProductDestinationActivation[];
}

function getDisplayFieldValue(value: unknown): string | number | null | undefined {
  if (value == null) return value as null | undefined;
  if (typeof value === 'string' || typeof value === 'number') return value;
  return String(value);
}

function toEditableTextValue(value: string | number | null): string {
  return value == null ? '' : String(value);
}

function getCustomFieldValue(source: unknown, field: string): unknown {
  if (!source || typeof source !== 'object') return undefined;
  const record = source as Record<string, unknown>;
  const customfields = record.customfields;
  if (!customfields || typeof customfields !== 'object') return undefined;
  return (customfields as Record<string, unknown>)[field];
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      message?: string;
      response?: { data?: { message?: string } };
    };
    return candidate.response?.data?.message || candidate.message || fallback;
  }
  return fallback;
}

function stripHtml(value: string | null | undefined): string {
  return (value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatEnrichmentValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => formatEnrichmentValue(entry))
      .filter((entry) => entry !== '—');
    return parts.length > 0 ? parts.join(', ') : '—';
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const parts = Object.entries(record)
      .map(([key, entry]) => {
        const formatted = formatEnrichmentValue(entry);
        if (formatted === '—') return null;
        return `${key}: ${formatted}`;
      })
      .filter((entry): entry is string => Boolean(entry));
    return parts.length > 0 ? parts.join(' | ') : '—';
  }
  return String(value);
}

function isLifestyleStorageUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^https:\/\/storage\.googleapis\.com\/[^/]+\/lifestyle\//.test(value.split('?')[0] || '');
}

function getChannelLogo(channelKey: string) {
  if (channelKey === 'google' || channelKey === 'gmc') {
    return <FaGoogle className="h-5 w-5 text-[#4285F4]" aria-hidden />;
  }
  if (channelKey === 'amazon') {
    return <FaAmazon className="h-5 w-5 text-[#111827]" aria-hidden />;
  }
  if (channelKey === 'meta') {
    return <FaMeta className="h-5 w-5 text-[#0866FF]" aria-hidden />;
  }
  return <Globe className="h-5 w-5 text-slate-500" aria-hidden />;
}

function normalizeProductScore(raw: ProductScoreData | null | undefined): ProductScoreData | null {
  if (!raw) return null;
  const compliance = raw.qualityDetails?.compliance;
  return {
    ...raw,
    qualityDetails: {
      ...raw.qualityDetails,
      required: raw.qualityDetails?.required ?? compliance?.required ?? {},
      recommended: raw.qualityDetails?.recommended ?? compliance?.recommended ?? {},
      issues: raw.qualityDetails?.issues ?? compliance?.issues ?? [],
      recommendations: raw.qualityDetails?.recommendations ?? [],
    },
  };
}

function getFieldStatusEntries(
  fields: Record<string, FieldStatus> | undefined,
  labels: Record<string, string>
): Array<{ field: string; label: string; ok: boolean }> {
  return Object.entries(fields ?? {}).map(([field, data]) => ({
    field,
    label: labels[field] || field,
    ok: data.present ?? data.filled ?? false,
  }));
}

function hasFieldValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

export default function ProductDetailPage() {
  const t = useTranslations('dashboard');
  const params = useParams();
  const pathname = usePathname();
  const localePrefix = getLocalePrefixFromPathname(pathname);
  const [item, setItem] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [productScore, setProductScore] = useState<ProductScoreData | null>(null);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const [showAiOptimizationModal, setShowAiOptimizationModal] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [enrichmentAnalysis, setEnrichmentAnalysis] = useState<{
    enrichments: Record<string, unknown>;
    alerts: Array<{ field: string; level: string; message: string; suggestion?: string }>;
    enrichedFieldsCount: number;
    alertsCount: number;
  } | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [fieldSources, setFieldSources] = useState<Record<string, FieldSource>>({});
  const [previewEnrichmentField, setPreviewEnrichmentField] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Array<{ id: string; source: string; createdAt: string; operationId?: string }>>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [restoringRevisionId, setRestoringRevisionId] = useState<string | null>(null);
  const [revertingToFeed, setRevertingToFeed] = useState(false);
  /** Préférences de diffusion par canal (chargées depuis item._channelOverrides). */
  const [channelOverrides, setChannelOverrides] = useState<Record<string, boolean>>({});
  /** Toast : { message, type: 'success' | 'error' } */
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [optimizerMenuOpen, setOptimizerMenuOpen] = useState(false);
  const [savingChannels, setSavingChannels] = useState(false);
  const [destinationActivations, setDestinationActivations] = useState<ProductDestinationActivation[]>([]);
  const [destinationActivationSummary, setDestinationActivationSummary] = useState<{ totalDestinations: number; activeDestinations: number; marketCount: number } | null>(null);
  const [loadingDestinationActivations, setLoadingDestinationActivations] = useState(false);
  const [savingDestinationId, setSavingDestinationId] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<{ itemId: string; history: Array<{ qualityScore: number; recordedAt: string }> } | null>(null);
  const [loadingScoreHistory, setLoadingScoreHistory] = useState(false);
  const [confirmRevertOpen, setConfirmRevertOpen] = useState(false);
  const [autoGenerateAiOnOpen, setAutoGenerateAiOnOpen] = useState(false);
  const [aiDestinationId, setAiDestinationId] = useState<string | null>(null);
  const [outputSummary, setOutputSummary] = useState<ProductOutputSummary>({
    google: { connected: false },
    amazon: { connected: false, channels: [] },
  });
  const supplementalDataTimeouts = useRef<number[]>([]);

  // Refs pour les champs
  const fieldRefs = {
    title: useRef<HTMLDivElement>(null),
    description: useRef<HTMLDivElement>(null),
    image: useRef<HTMLDivElement>(null),
    price: useRef<HTMLDivElement>(null),
    brand: useRef<HTMLDivElement>(null),
    sku: useRef<HTMLDivElement>(null),
    url: useRef<HTMLDivElement>(null),
    gtin: useRef<HTMLDivElement>(null),
    mpn: useRef<HTMLDivElement>(null),
    condition: useRef<HTMLDivElement>(null),
    google_product_category: useRef<HTMLDivElement>(null),
    product_type: useRef<HTMLDivElement>(null),
    availability: useRef<HTMLDivElement>(null),
  };
  // Refs pour les blocs (scroll depuis le scoring)
  const sectionRefs = {
    scoring: useRef<HTMLDivElement>(null),
    conformite: useRef<HTMLDivElement>(null),
    donnees: useRef<HTMLDivElement>(null),
    enrichissement: useRef<HTMLDivElement>(null),
    diffusion: useRef<HTMLDivElement>(null),
    historique: useRef<HTMLDivElement>(null),
  };
  
  // Champs éditables
  const [editedItem, setEditedItem] = useState<Partial<FeedItem>>({});

  const fetchEnrichmentAnalysis = useCallback(async () => {
    try {
      const response = await apiClient.get<{
        enrichments: Record<string, unknown>;
        alerts: Array<{ field: string; level: string; message: string; suggestion?: string }>;
        enrichedFieldsCount: number;
        alertsCount: number;
      }>(`/ingestion/items/${params.id}/enrichment-analysis`);
      setEnrichmentAnalysis(response.data);
    } catch (err) {
      console.warn('Analyse d\'enrichissement non disponible:', err);
      Sentry.captureException(err, { tags: { area: 'product.enrichment-analysis', itemId: String(params.id) } });
      setEnrichmentAnalysis(null);
    }
  }, [params.id]);

  const fetchRevisions = useCallback(async () => {
    if (!item?.id) return;
    try {
      setLoadingRevisions(true);
      const res = await apiClient.get<{ itemId: string; revisions: Array<{ id: string; source: string; createdAt: string; operationId?: string }> }>(
        `/ingestion/items/${params.id}/revisions`
      );
      setRevisions(res?.data?.revisions ?? []);
    } catch (err) {
      console.warn('Révisions non disponibles:', err);
      setRevisions([]);
    } finally {
      setLoadingRevisions(false);
    }
  }, [item?.id, params.id]);

  const fetchScoreHistory = useCallback(async () => {
    if (!params.id) return;
    try {
      setLoadingScoreHistory(true);
      const res = await apiClient.get<{ itemId: string; history: Array<{ qualityScore: number; recordedAt: string }> }>(
        `/ingestion/items/${params.id}/score-history`
      );
      setScoreHistory(res.data ?? null);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Score history non disponible:', err);
      }
      setScoreHistory(null);
    } finally {
      setLoadingScoreHistory(false);
    }
  }, [params.id]);

  const refreshSignedLifestyleUrls = useCallback(async (itemData: FeedItem) => {
    const customFields = parseProductCustomFields(itemData.customfields);
    const lifestyleRaw = (customFields._lifestyleImageUrls && typeof customFields._lifestyleImageUrls === 'object'
      ? customFields._lifestyleImageUrls
      : {}) as Record<string, unknown>;

    const urlsToRefresh = Array.from(
      new Set(
        [
          itemData.imageUrl,
          ...Object.values(lifestyleRaw).filter((value): value is string => typeof value === 'string' && value.length > 0),
        ].filter(isLifestyleStorageUrl)
      )
    );

    if (urlsToRefresh.length === 0) return itemData;

    const refreshedEntries = await Promise.all(
      urlsToRefresh.map(async (url) => {
        try {
          const response = await apiClient.post<{ url?: string }>('/enrichment/sign-lifestyle-url', { url });
          return [url, response.data?.url || url] as const;
        } catch {
          return [url, url] as const;
        }
      })
    );

    const signedMap = new Map(refreshedEntries);
    const nextCustomFields = { ...customFields };
    if (lifestyleRaw && Object.keys(lifestyleRaw).length > 0) {
      nextCustomFields._lifestyleImageUrls = Object.fromEntries(
        Object.entries(lifestyleRaw).map(([key, value]) => [
          key,
          typeof value === 'string' ? (signedMap.get(value) || value) : value,
        ])
      );
    }

    return {
      ...itemData,
      imageUrl: itemData.imageUrl && typeof itemData.imageUrl === 'string' ? (signedMap.get(itemData.imageUrl) || itemData.imageUrl) : itemData.imageUrl,
      customfields: nextCustomFields,
      customFields: nextCustomFields,
      _lifestyleImageUrls: nextCustomFields._lifestyleImageUrls as Record<string, string | null> | undefined,
    };
  }, []);

  const fetchOutputSummary = useCallback(async () => {
    try {
      const [googleResult, amazonResult, amazonChannelsResult] = await Promise.allSettled([
        apiClient.get<{ connected: boolean; merchantId?: string; email?: string }>('/platforms/gmc/status'),
        apiClient.get<{ connected?: boolean; sellerId?: string }>('/platforms/amazon/status'),
        apiClient.get<{ channels?: AmazonExportChannel[] }>('/platforms/amazon/channels'),
      ]);

      setOutputSummary({
        google: googleResult.status === 'fulfilled'
          ? {
              connected: !!googleResult.value.data?.connected,
              merchantId: googleResult.value.data?.merchantId,
              email: googleResult.value.data?.email,
            }
          : { connected: false },
        amazon: {
          connected: amazonResult.status === 'fulfilled' ? !!amazonResult.value.data?.connected : false,
          sellerId: amazonResult.status === 'fulfilled' ? amazonResult.value.data?.sellerId : undefined,
          channels:
            amazonChannelsResult.status === 'fulfilled' && Array.isArray(amazonChannelsResult.value.data?.channels)
              ? amazonChannelsResult.value.data.channels
              : [],
        },
      });
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Sorties non disponibles:', err);
      }
    }
  }, []);

  const fetchDestinationActivations = useCallback(async () => {
    try {
      setLoadingDestinationActivations(true);
      const response = await apiClient.get<ProductDestinationActivationResponse>(`/ingestion/items/${params.id}/destinations`);
      setDestinationActivations(Array.isArray(response.data?.destinations) ? response.data.destinations : []);
      setDestinationActivationSummary(response.data?.summary ?? null);
      if (response.data?.channelOverrides) {
        setChannelOverrides(response.data.channelOverrides);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Destinations produit non disponibles:', err);
      }
      setDestinationActivations([]);
      setDestinationActivationSummary(null);
    } finally {
      setLoadingDestinationActivations(false);
    }
  }, [params.id]);

  const clearSupplementalDataLoadQueue = useCallback(() => {
    supplementalDataTimeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    supplementalDataTimeouts.current = [];
  }, []);

  const scheduleSupplementalDataLoad = useCallback(() => {
    if (typeof window === 'undefined') return;
    clearSupplementalDataLoadQueue();
    const steps: Array<[() => void, number]> = [
      [() => { void fetchEnrichmentAnalysis(); }, 200],
      [() => { void fetchRevisions(); }, 450],
      [() => { void fetchScoreHistory(); }, 700],
      [() => { void fetchOutputSummary(); }, 900],
      [() => { void fetchDestinationActivations(); }, 1100],
    ];
    steps.forEach(([task, delay]) => {
      const timeoutId = window.setTimeout(task, delay);
      supplementalDataTimeouts.current.push(timeoutId);
    });
  }, [clearSupplementalDataLoadQueue, fetchDestinationActivations, fetchEnrichmentAnalysis, fetchOutputSummary, fetchRevisions, fetchScoreHistory]);

  useEffect(() => () => {
    clearSupplementalDataLoadQueue();
  }, [clearSupplementalDataLoadQueue]);

  const handleRestoreRevision = async (revisionId: string) => {
    if (!item?.id) return;
    try {
      setRestoringRevisionId(revisionId);
      await apiClient.post(`/ingestion/items/${params.id}/restore`, { revisionId });
      await fetchItem();
      await fetchRevisions();
      setError(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erreur lors de la restauration'));
      Sentry.captureException(err, { tags: { area: 'product.restore', itemId: item.id } });
    } finally {
      setRestoringRevisionId(null);
    }
  };

  const handleRevertToFeed = async () => {
    if (!item?.id) return;
    try {
      setRevertingToFeed(true);
      await apiClient.post(`/ingestion/items/${params.id}/revert-to-feed`);
      await fetchItem();
      await fetchRevisions();
      setConfirmRevertOpen(false);
      setError(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Aucune révision ingestion. Relancez une synchro du flux pour pouvoir revenir au flux.'));
      Sentry.captureException(err, { tags: { area: 'product.revert-to-feed', itemId: item.id } });
    } finally {
      setRevertingToFeed(false);
    }
  };

  const handleEnrich = async (fields?: string[]) => {
    try {
      setEnriching(true);
      const response = await apiClient.post<{
        enrichedFields?: string[];
        message?: string;
      }>(`/ingestion/items/${params.id}/enrich`, {
        applyEnrichments: true,
        ...(fields && fields.length > 0 ? { fields } : {}),
      });
      await fetchItem();
      await fetchEnrichmentAnalysis();
      const scoreRes = await apiClient.get<ProductScoreData>(`/ingestion/items/${params.id}/score`).catch(() => null);
      if (scoreRes?.data) setProductScore(normalizeProductScore(scoreRes.data));
      const prevScore = productScore?.qualityScore ?? 0;
      const newScore = scoreRes?.data?.qualityScore ?? prevScore;
      if (response.data.enrichedFields && response.data.enrichedFields.length > 0) {
        setToast({
          type: 'success',
          message: scoreRes?.data ? `Enrichissement appliqué. Score : ${newScore}/100` : `Champs complétés : ${response.data.enrichedFields.join(', ')}`,
        });
      }
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      console.error('Erreur enrichissement:', err);
      Sentry.captureException(err, { tags: { area: 'product.enrich', itemId: String(params.id) } });
      const errorMessage = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Erreur inconnue';
      setToast({ type: 'error', message: t('catalogue.enrichmentError', { msg: errorMessage }) });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setEnriching(false);
    }
  };

  const fetchItem = useCallback(async (): Promise<ProductScoreData | null> => {
    try {
      setLoading(true);
      setError(null);
      const [itemResponse, scoreResponse] = await Promise.all([
        apiClient.get<FeedItem>(`/ingestion/items/${params.id}`),
        apiClient.get<ProductScoreData>(`/ingestion/items/${params.id}/score`).catch((err) => {
          console.warn('Score non disponible pour ce produit, sera calculé automatiquement:', err);
          return null;
        })
      ]);
      const itemData = itemResponse.data;
      // S'assurer que price est un nombre
      if (itemData.price !== null && itemData.price !== undefined) {
        itemData.price = Number(itemData.price);
      }
      // S'assurer que inventory est un nombre
      if (itemData.inventory !== null && itemData.inventory !== undefined) {
        itemData.inventory = Number(itemData.inventory);
      }
      // Normaliser imageUrl (peut être imageurl en minuscules depuis la DB)
      itemData.imageUrl = itemData.imageUrl || itemData.imageurl || null;
      // Normaliser feed.mappingJson (peut être mappingjson en minuscules)
      if (itemData.feed) {
        // Parser mappingJson si c'est une string
        const rawMapping = itemData.feed.mappingJson || itemData.feed.mappingjson;
        if (typeof rawMapping === 'string') {
          try {
            itemData.feed.mappingJson = JSON.parse(rawMapping);
          } catch (e) {
            console.error('Erreur parsing mappingJson:', e);
            itemData.feed.mappingJson = {};
          }
        } else if (typeof rawMapping === 'object' && rawMapping !== null) {
          itemData.feed.mappingJson = rawMapping;
        } else {
          itemData.feed.mappingJson = {};
        }
        // S'assurer que mappingjson existe aussi (pour compatibilité)
        itemData.feed.mappingjson = itemData.feed.mappingJson;
      } else {
        console.warn('⚠️ itemData.feed est undefined ou null');
      }
      
      // Normaliser customfields (peut être une string JSON ou un objet)
      const customFields = parseProductCustomFields(itemData.customfields);
      itemData.customfields = customFields;
      itemData.customFields = customFields;
      Object.assign(itemData, customFields);
      // Normaliser additionalImages si absent (depuis additional_image_link, string CSV ou tableau)
      if (!itemData.additionalImages?.length && (itemData.additional_image_link != null || (itemData.customfields as Record<string, unknown>)?.additional_image_link != null)) {
        const raw = itemData.additional_image_link ?? (itemData.customfields as Record<string, unknown>)?.additional_image_link;
        itemData.additionalImages = Array.isArray(raw)
          ? (raw as string[]).filter(u => u && String(u).trim())
          : String(raw).split(',').map((u: string) => u.trim()).filter(Boolean);
      }
      
      const displayItem = await refreshSignedLifestyleUrls(itemData);
      setItem(displayItem);
      setEditedItem(displayItem);
      setChannelOverrides(displayItem._channelOverrides ?? {});
      scheduleSupplementalDataLoad();
      if (scoreResponse?.data) {
        const normalizedScore = normalizeProductScore(scoreResponse.data);
        setProductScore(normalizedScore);
        return normalizedScore;
      }
      setProductScore(null);
    } catch (err: unknown) {
      console.error('Error fetching item:', err);
      Sentry.captureException(err, { tags: { area: 'product.load', itemId: String(params.id) } });
      setError(getErrorMessage(err, 'Erreur lors du chargement du produit'));
    } finally {
      setLoading(false);
    }
    return null;
  }, [params.id, refreshSignedLifestyleUrls, scheduleSupplementalDataLoad]);

  useEffect(() => {
    void fetchItem();
  }, [fetchItem]);

  // Fonction pour ouvrir la visionneuse d'images
  const openImageViewer = (index: number) => {
    setCurrentImageIndex(index);
    setImageViewerOpen(true);
  };

  // Fonction pour fermer la visionneuse
  const closeImageViewer = () => {
    setImageViewerOpen(false);
  };

  // Liste complète des images (principale + supplémentaires + lifestyle) pour la visionneuse
  const allImagesForViewer = item ? (() => {
    const lifestyle = (item as { _lifestyleImageUrls?: Record<string, string | null> })._lifestyleImageUrls;
    const lifestyleUrls = lifestyle ? [...new Set(Object.values(lifestyle).filter((u): u is string => !!u && typeof u === 'string'))] : [];
    return [
      ...(item.imageUrl ? [item.imageUrl] : []),
      ...(item.additionalImages || []),
      ...lifestyleUrls
    ];
  })() : [];

  // Fonction pour naviguer dans la visionneuse
  const navigateImage = (direction: 'prev' | 'next') => {
    const allImages = allImagesForViewer;
    
    if (direction === 'prev') {
      setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
    } else {
      setCurrentImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
    }
  };

  // Fonction pour naviguer vers un champ
  const CATALOGUE_CONTEXT_KEY = 'feedplug_catalogue_context';

  const goBackToCatalogue = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(CATALOGUE_CONTEXT_KEY);
      const data = raw ? JSON.parse(raw) : {};
      const q = data.searchQuery ?? '';
      const url = q ? `${localePrefix}/catalogue?q=${encodeURIComponent(q)}` : `${localePrefix}/catalogue`;
      window.location.assign(url);
    } catch {
      window.location.assign(`${localePrefix}/catalogue`);
    }
  };

  const scrollToField = (fieldName: string) => {
    const fieldRef = fieldRefs[fieldName as keyof typeof fieldRefs];
    if (fieldRef?.current) {
      setHighlightedField(fieldName);
      fieldRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedField(null), 2000);
    }
  };

  const scrollToSection = (sectionId: keyof typeof sectionRefs) => {
    const ref = sectionRefs[sectionId];
    if (ref?.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Ouvre l'optimisation IA unifiée ou scroll vers Enrichissement pour les champs techniques. */
  const handleOptimizeField = (fieldKey: 'title' | 'description' | 'brand' | 'gtin' | 'mpn' | 'google_product_category') => {
    if (fieldKey === 'title' || fieldKey === 'description') {
      setAiDestinationId(null);
      setAutoGenerateAiOnOpen(false);
      setShowAiOptimizationModal(true);
      return;
    }
    setPreviewEnrichmentField(fieldKey);
    scrollToSection('enrichissement');
  };

  const handleSave = async () => {
    if (!item) return;
    try {
      setSaving(true);
      setError(null);
      await apiClient.put(`/ingestion/items/${item.id}`, editedItem);
      await fetchItem();
      setIsEditing(false);
      setToast({ type: 'success', message: t('common.modificationsSaved') });
      setTimeout(() => setToast(null), 4000);
    } catch (err: unknown) {
      console.error('Error saving item:', err);
      Sentry.captureException(err, { tags: { area: 'product.save', itemId: String(item?.id) } });
      const message = getErrorMessage(err, t('common.errorRecording'));
      setError(message);
      setToast({ type: 'error', message });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (item) {
      setEditedItem(item);
    }
    setIsEditing(false);
  };

  if (loading) {
    return <ProductDetailSkeleton />;
  }

  if (error && !item) {
    return (
      <PageLayout>
        <PageError message={error} onRetry={() => { setError(null); fetchItem(); }} />
        <Button variant="outline" onClick={goBackToCatalogue} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au catalogue
        </Button>
      </PageLayout>
    );
  }

  if (!item) {
    return null;
  }

  const getFieldSource = (fieldKey: string): FieldSource =>
    fieldSources[fieldKey] ?? (editedItem[fieldKey] !== undefined && editedItem[fieldKey] !== (item as Record<string, unknown>)[fieldKey] ? 'custom' : 'flux');

  const handleFieldSourceChange = (fieldKey: string, source: FieldSource) => {
    setFieldSources((prev) => ({ ...prev, [fieldKey]: source }));
    if (source === 'flux') {
      const fluxVal = (item as Record<string, unknown>)[fieldKey];
      setEditedItem((prev) => ({ ...prev, [fieldKey]: fluxVal ?? '' }));
    }
  };

  const globalScore = productScore?.qualityScore ?? 0;
  const isEligibleGoogle = !productScore?.blocking && globalScore >= 50;
  const scoreColor = globalScore >= 80 ? 'text-green-600' : globalScore >= 60 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = globalScore >= 80 ? 'bg-green-50 border-green-500' : globalScore >= 60 ? 'bg-amber-50 border-amber-500' : 'bg-red-50 border-red-500';
  const dimensions = productScore?.dimensions ?? {};

  const requiredChecklistEntries = getFieldStatusEntries(
    productScore?.qualityDetails?.required,
    { title: 'Titre', description: 'Description', image: 'Image', price: 'Prix', link: 'Lien produit', condition: 'Condition', availability: 'Disponibilité', id: 'ID' }
  ).map((entry) => ({ ...entry, required: true }));
  const recommendedChecklistEntries = getFieldStatusEntries(
    productScore?.qualityDetails?.recommended,
    { brand: 'Marque', gtin: 'GTIN', mpn: 'MPN', google_product_category: 'Catégorie Google' }
  ).map((entry) => ({ ...entry, required: false }));
  const checklistEntries = [...requiredChecklistEntries, ...recommendedChecklistEntries];
  const missingRequiredCount = requiredChecklistEntries.filter((entry) => !entry.ok).length;
  const missingRecommendedCount = recommendedChecklistEntries.filter((entry) => !entry.ok).length;
  const recommendationMessages = (productScore?.qualityDetails?.recommendations ?? productScore?.qualityDetails?.issues ?? []).slice(0, 6);
  const currentDescription = stripHtml(String(editedItem.descriptionText ?? item.descriptionText ?? item.descriptionHtml ?? ''));
  const optimizedContentInfo = item ? getPreferredOptimizedPlatformContent(item.customfields, 'gmc') : null;
  const effectiveDescription = stripHtml(optimizedContentInfo?.description ?? currentDescription);
  const descriptionPreview = effectiveDescription.length > 240 ? `${effectiveDescription.slice(0, 240)}…` : effectiveDescription;
  const optimizedHighlights = optimizedContentInfo?.highlights ?? [];
  const lifestyle = (item as { _lifestyleImageUrls?: Record<string, string | null> })._lifestyleImageUrls;
  const lifestyleUrls = lifestyle ? [...new Set(Object.values(lifestyle).filter((u): u is string => !!u && typeof u === 'string'))] : [];
  const galleryImages = [...(item.additionalImages || []), ...lifestyleUrls];
  const nextMilestone = globalScore < 70 ? 70 : globalScore < 80 ? 80 : 90;
  const scoreGap = Math.max(nextMilestone - globalScore, 0);
  const mappedFieldCount = Object.keys(item.feed?.mappingJson || item.feed?.mappingjson || {}).length;
  const enrichmentOpportunityCount = enrichmentAnalysis?.enrichedFieldsCount ?? 0;
  const enrichmentAlertsCount = enrichmentAnalysis?.alertsCount ?? 0;
  const technicalEnrichmentFields = ['brand', 'gtin', 'mpn', 'google_product_category', 'product_type', 'availability']
    .filter((field) => {
      if (!enrichmentAnalysis?.enrichments || !(field in enrichmentAnalysis.enrichments)) return false;
      const currentValue =
        field === 'google_product_category'
          ? (editedItem as Record<string, unknown>).google_product_category ?? editedItem.googleProductCategory ?? (item as Record<string, unknown>).google_product_category ?? item.googleProductCategory
          : (editedItem as Record<string, unknown>)[field] ?? (item as Record<string, unknown>)[field];
      return !hasFieldValue(currentValue);
    });
  const technicalEnrichmentLabels = technicalEnrichmentFields
    .map((field) => ({
      brand: 'marque',
      gtin: 'GTIN',
      mpn: 'MPN',
      google_product_category: 'catégorie Google',
      product_type: 'type produit',
      availability: 'disponibilité',
    }[field] || field))
    .slice(0, 3);
  const hasOptimizedMerchantCopy = Boolean(optimizedContentInfo?.title || optimizedContentInfo?.description);
  const needsMerchantCopy = !effectiveDescription || effectiveDescription.length < 240 || (!hasOptimizedMerchantCopy && (dimensions.seo ?? globalScore) < 70);
  const needsAiHighlights = optimizedHighlights.length === 0;
  const optimizedPlatformsRaw =
    item.customfields && typeof item.customfields === 'object' && (item.customfields as Record<string, unknown>).optimized && typeof (item.customfields as Record<string, unknown>).optimized === 'object'
      ? ((item.customfields as Record<string, unknown>).optimized as Record<string, unknown>)
      : {};
  const normalizedChannelKeys = Array.from(
    new Set(
      [
        ...Object.keys(channelOverrides || {}),
        ...Object.keys(optimizedPlatformsRaw || {}),
      ].map((key) => (key === 'gmc' ? 'google' : key))
    )
  );
  const defaultChannelKeys = ['google', 'amazon', 'meta'];
  const extraVisibleChannelKeys = normalizedChannelKeys.filter((key) => !defaultChannelKeys.includes(key));
  const missingBlockingCount = missingRequiredCount;

  const getChannelLabel = (channelKey: string) => ({
    google: 'Google Shopping',
    amazon: 'Amazon',
    meta: 'Meta',
    chatgpt: 'ChatGPT',
    bing: 'Bing',
    pinterest: 'Pinterest',
    tiktok: 'TikTok',
    snapchat: 'Snapchat',
    yandex: 'Yandex Market',
    baidu: 'Baidu',
    perplexity: 'Perplexity',
    gemini: 'Gemini',
    cdiscount: 'Cdiscount',
    rakuten: 'Rakuten',
  }[channelKey] || channelKey);

  const setChannelEnabled = async (channelKey: string, checked: boolean) => {
    const previousValue = channelOverrides[channelKey];
    setChannelOverrides((prev) => ({ ...prev, [channelKey]: checked }));
    try {
      setSavingChannels(true);
      await apiClient.patch(`/ingestion/items/${params.id}/channels`, { [channelKey]: checked });
      void fetchDestinationActivations();
    } catch {
      setToast({ type: 'error', message: t('catalogue.errorPreference') });
      setTimeout(() => setToast(null), 5000);
      setChannelOverrides((prev) => ({ ...prev, [channelKey]: previousValue ?? !checked }));
    } finally {
      setSavingChannels(false);
    }
  };

  const setDestinationEnabled = async (destinationId: string, checked: boolean) => {
    const previousDestinations = destinationActivations;
    setDestinationActivations((prev) =>
      prev.map((entry) => entry.destinationId === destinationId ? { ...entry, isEnabled: checked, activationSource: 'destination' } : entry)
    );
    try {
      setSavingDestinationId(destinationId);
      const response = await apiClient.patch<{ channelOverrides?: Record<string, boolean> }>(
        `/ingestion/items/${params.id}/destinations/${destinationId}`,
        { isEnabled: checked }
      );
      if (response.data?.channelOverrides) {
        setChannelOverrides(response.data.channelOverrides);
      }
      void fetchDestinationActivations();
    } catch {
      setToast({ type: 'error', message: "Erreur lors de la mise à jour du marché de diffusion." });
      setTimeout(() => setToast(null), 5000);
      setDestinationActivations(previousDestinations);
    } finally {
      setSavingDestinationId(null);
    }
  };

  const goToFlux = () => {
    if (typeof window === 'undefined') return;
    window.location.assign(`${localePrefix}/flux`);
  };

  const googleCanActivate = outputSummary.google.connected;
  const amazonCanActivate = outputSummary.amazon.connected && outputSummary.amazon.channels.length > 0;
  const metaCanActivate = true;
  const isGoogleActive = googleCanActivate && channelOverrides.google === true;
  const isAmazonActive = amazonCanActivate && channelOverrides.amazon === true;
  const isMetaActive = metaCanActivate && channelOverrides.meta === true;

  const channelCards: ChannelCard[] = [
    {
      key: 'google',
      label: 'Google Shopping',
      detail:
        isGoogleActive
          ? missingBlockingCount > 0
            ? 'Canal actif, mais la fiche doit encore corriger certains champs requis.'
            : `Connecté${outputSummary.google.email ? ` (${outputSummary.google.email})` : ''}. Le produit peut partir dans le flux.`
          : googleCanActivate
            ? 'Canal disponible sur ce compte. Active-le pour inclure ce produit dans la diffusion Google.'
            : 'Connecte Google Merchant Center dans Flux pour activer ce canal.',
      statusLabel:
        isGoogleActive
          ? 'Actif'
          : googleCanActivate
            ? 'Désactivé'
            : 'Activer le canal',
      checked: isGoogleActive,
      toggleDisabled: savingChannels || !googleCanActivate,
      actionLabel: isGoogleActive ? 'Désactiver' : googleCanActivate ? 'Activer' : 'Configurer dans Flux',
      actionVariant: isGoogleActive ? 'outline' : googleCanActivate ? 'accent' : 'secondary',
      onAction: () => {
        if (!googleCanActivate) {
          goToFlux();
          return;
        }
        void setChannelEnabled('google', !isGoogleActive);
      },
    },
    {
      key: 'amazon',
      label: 'Amazon',
      detail:
        isAmazonActive
          ? missingBlockingCount > 0
            ? `${outputSummary.amazon.channels.length} marketplace${outputSummary.amazon.channels.length > 1 ? 's' : ''} active${outputSummary.amazon.channels.length > 1 ? 's' : ''}. La fiche reste à finaliser avant diffusion.`
            : `${outputSummary.amazon.channels.length} marketplace${outputSummary.amazon.channels.length > 1 ? 's' : ''} active${outputSummary.amazon.channels.length > 1 ? 's' : ''}${outputSummary.amazon.sellerId ? ` (${outputSummary.amazon.sellerId})` : ''}.`
          : amazonCanActivate
            ? 'Canal disponible sur ce compte. Active-le pour diffuser ce produit sur Amazon.'
            : outputSummary.amazon.connected
              ? 'Compte Amazon connecté. Sélectionne maintenant au moins une marketplace dans Flux.'
              : 'Connecte Amazon puis sélectionne une marketplace pour activer ce canal.',
      statusLabel:
        isAmazonActive
          ? 'Actif'
          : amazonCanActivate
            ? 'Désactivé'
            : 'Activer le canal',
      checked: isAmazonActive,
      toggleDisabled: savingChannels || !amazonCanActivate,
      helper: outputSummary.amazon.channels.length > 0 ? outputSummary.amazon.channels.map((channel) => channel.label || channel.channelkey).join(', ') : null,
      actionLabel: isAmazonActive ? 'Désactiver' : amazonCanActivate ? 'Activer' : 'Configurer dans Flux',
      actionVariant: isAmazonActive ? 'outline' : amazonCanActivate ? 'accent' : 'secondary',
      onAction: () => {
        if (!amazonCanActivate) {
          goToFlux();
          return;
        }
        void setChannelEnabled('amazon', !isAmazonActive);
      },
    },
    {
      key: 'meta',
      label: 'Meta',
      detail:
        isMetaActive
          ? missingBlockingCount > 0
            ? 'Canal actif, mais la fiche doit encore corriger certains champs requis.'
            : optimizedPlatformsRaw.meta
              ? 'Canal actif avec un contenu Meta déjà préparé pour l’export.'
              : 'Canal activé. Prépare ensuite un export Meta depuis Flux.'
          : 'Canal disponible par défaut. Active-le quand tu veux préparer une sortie Meta.',
      statusLabel:
        isMetaActive
          ? 'Actif'
          : metaCanActivate
            ? 'Désactivé'
            : 'Activer le canal',
      checked: isMetaActive,
      toggleDisabled: savingChannels || !metaCanActivate,
      actionLabel: isMetaActive ? 'Désactiver' : 'Activer',
      actionVariant: isMetaActive ? 'outline' : 'accent',
      onAction: () => {
        void setChannelEnabled('meta', !isMetaActive);
      },
    },
    ...extraVisibleChannelKeys.map((channelKey): ChannelCard => ({
      key: channelKey,
      label: getChannelLabel(channelKey),
      detail:
        channelOverrides[channelKey] === true
          ? missingBlockingCount > 0
            ? 'Canal actif, mais des champs requis restent à corriger.'
            : 'Canal configuré pour cette fiche.'
          : 'Canal configuré sur le compte, mais désactivé pour cette fiche.',
      statusLabel: channelOverrides[channelKey] === true ? 'Actif' : 'Désactivé',
      checked: channelOverrides[channelKey] === true,
      toggleDisabled: savingChannels,
      helper: optimizedPlatformsRaw[channelKey] ? 'Contenu optimisé disponible' : null,
      actionLabel: channelOverrides[channelKey] === true ? 'Désactiver' : 'Activer',
      actionVariant: channelOverrides[channelKey] === true ? 'outline' : 'accent',
      onAction: () => {
        void setChannelEnabled(channelKey, channelOverrides[channelKey] !== true);
      },
    })),
  ];
  const activeOutputCount = channelCards.filter((channel) => channel.statusLabel === 'Actif').length;
  const destinationActivationGroups = Object.values(
    destinationActivations.reduce<Record<string, { marketId: string; marketName: string; marketCode: string; items: ProductDestinationActivation[] }>>((acc, entry) => {
      if (!acc[entry.marketId]) {
        acc[entry.marketId] = {
          marketId: entry.marketId,
          marketName: entry.marketName,
          marketCode: entry.marketCode,
          items: [],
        };
      }
      acc[entry.marketId].items.push(entry);
      return acc;
    }, {})
  )
    .sort((left, right) => left.marketName.localeCompare(right.marketName, 'fr'))
    .map((group) => ({
      ...group,
      items: [...group.items].sort((left, right) => {
        const leftKey = `${left.platformLabel}-${left.localeCode || ''}-${left.externalScopeLabel || ''}`;
        const rightKey = `${right.platformLabel}-${right.localeCode || ''}-${right.externalScopeLabel || ''}`;
        return leftKey.localeCompare(rightKey, 'fr');
      }),
    }));
  const totalDestinationCount = destinationActivationSummary?.totalDestinations ?? destinationActivations.length;
  const activeDestinationCount = destinationActivationSummary?.activeDestinations ?? destinationActivations.filter((entry) => entry.isEnabled).length;
  const destinationMarketCount = destinationActivationSummary?.marketCount ?? destinationActivationGroups.length;
  const aiDestinationOptions = destinationActivations
    .filter((entry) => ['gmc', 'amazon', 'meta', 'chatgpt'].includes(entry.platformKey))
    .sort((left, right) => {
      const leftKey = `${left.marketName}-${left.platformLabel}-${left.localeCode || ''}`;
      const rightKey = `${right.marketName}-${right.platformLabel}-${right.localeCode || ''}`;
      return leftKey.localeCompare(rightKey, 'fr');
    })
    .map((entry) => {
      const summary = [
        entry.localeCode ? `Langue ${entry.localeCode}` : null,
        entry.currencyCode ? `Devise ${entry.currencyCode}` : null,
        entry.externalScopeLabel || null,
      ].filter(Boolean).join(' · ');
      return {
        id: entry.destinationId,
        label: `${entry.platformLabel} · ${entry.marketName}${entry.localeCode ? ` · ${entry.localeCode}` : ''}`,
        platformKey: entry.platformKey as 'gmc' | 'amazon' | 'meta' | 'chatgpt',
        summary,
      };
    });
  const scoreFastTrackActions = [
    needsMerchantCopy
      ? {
          key: 'merchant-copy',
          title: effectiveDescription ? 'Optimiser le titre et la description' : 'Générer le texte marchand',
          detail: effectiveDescription
            ? 'Le contenu existe mais peut mieux soutenir le SEO, la compréhension produit et la conversion.'
            : 'Le produit manque encore de contexte éditorial. L’IA peut produire une base exploitable tout de suite.',
          impact: 'Fort impact',
          channel: 'IA texte',
          actionLabel: 'Tout optimiser avec l’IA',
          onClick: () => { setAiDestinationId(null); setAutoGenerateAiOnOpen(true); setShowAiOptimizationModal(true); },
        }
      : null,
    technicalEnrichmentFields.length > 0
      ? {
          key: 'technical-enrichment',
          title: `Compléter ${technicalEnrichmentFields.length} champ${technicalEnrichmentFields.length > 1 ? 's' : ''} technique${technicalEnrichmentFields.length > 1 ? 's' : ''}`,
          detail: `FeedPlug peut compléter automatiquement ${technicalEnrichmentLabels.join(', ')}${technicalEnrichmentFields.length > technicalEnrichmentLabels.length ? '…' : ''}.`,
          impact: technicalEnrichmentFields.length >= 2 ? 'Impact direct' : 'Gain rapide',
          channel: 'IA enrichissement',
          actionLabel: 'Compléter via IA',
          onClick: () => { void handleEnrich(technicalEnrichmentFields); },
        }
      : enrichmentOpportunityCount > 0
        ? {
            key: 'open-enrichment',
            title: 'Revoir les suggestions d’enrichissement',
            detail: 'Des champs peuvent encore être complétés automatiquement avant diffusion.',
            impact: 'Gain rapide',
            channel: 'IA enrichissement',
            actionLabel: 'Voir les suggestions',
            onClick: () => scrollToSection('enrichissement'),
          }
        : null,
    needsAiHighlights
      ? {
          key: 'highlights',
          title: 'Créer des highlights IA',
          detail: 'Ajoute des arguments de vente réutilisables sur les canaux de diffusion et dans la fiche.',
          impact: 'Gain additionnel',
          channel: 'IA diffusion',
          actionLabel: 'Générer les highlights',
          onClick: () => { setAiDestinationId(null); setAutoGenerateAiOnOpen(false); setShowAiOptimizationModal(true); },
        }
      : null,
  ].filter((entry): entry is {
    key: string;
    title: string;
    detail: string;
    impact: string;
    channel: string;
    actionLabel: string;
    onClick: () => void;
  } => !!entry);
  const primaryFastTrackAction = scoreFastTrackActions[0] ?? null;

  return (
    <PageLayout>
      <ConfirmDialog
        open={confirmRevertOpen}
        onOpenChange={setConfirmRevertOpen}
        title="Revenir au flux d'origine ?"
        description="Les modifications manuelles seront perdues et le produit reprendra les dernières valeurs importées depuis le flux."
        confirmLabel="Revenir au flux"
        destructive
        confirming={revertingToFeed}
        onConfirm={handleRevertToFeed}
      />
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed top-6 right-6 z-[100] flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg max-w-sm',
            toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          )}
        >
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sticky bar : actions uniquement */}
      <div className="sticky top-0 z-10 -mx-[var(--page-padding-x)] flex flex-wrap items-start justify-between gap-2 border-b border-border bg-background px-[var(--page-padding-x)] py-3 sm:items-center">
        <Button onClick={goBackToCatalogue} variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal text-left">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au catalogue
        </Button>
        <div className="flex flex-wrap items-stretch justify-end gap-2">
          {isEditing ? (
            <>
              <Button onClick={handleCancel} variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal text-left">
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving} size="sm" className="h-auto min-h-9 whitespace-normal text-left">
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </>
          ) : (
            <>
              <div className="relative z-20">
                <Button onClick={() => setOptimizerMenuOpen((o) => !o)} variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal text-left">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Optimiser <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </Button>
                {optimizerMenuOpen && (
                  <>
                    <div className="absolute right-0 top-full mt-1 min-w-[220px] rounded-md border border-border bg-background py-1 shadow-lg z-20">
                      <button type="button" className="w-full px-3 py-2 text-left text-sm leading-5 hover:bg-muted" onClick={() => { setAiDestinationId(null); setAutoGenerateAiOnOpen(true); setShowAiOptimizationModal(true); setOptimizerMenuOpen(false); }}>Tout optimiser avec l&apos;IA</button>
                      <button type="button" className="w-full px-3 py-2 text-left text-sm leading-5 hover:bg-muted" onClick={() => { setAiDestinationId(null); setAutoGenerateAiOnOpen(false); setShowAiOptimizationModal(true); setOptimizerMenuOpen(false); }}>Ouvrir l&apos;atelier IA</button>
                      <button type="button" className="w-full px-3 py-2 text-left text-sm leading-5 hover:bg-muted" onClick={() => { scrollToSection('enrichissement'); setOptimizerMenuOpen(false); }}>Aller à l&apos;enrichissement</button>
                      <button type="button" className="w-full px-3 py-2 text-left text-sm leading-5 hover:bg-muted" onClick={() => { void handleEnrich(); setOptimizerMenuOpen(false); }}>Compléter les champs techniques</button>
                    </div>
                    <div className="fixed inset-0 z-10" onClick={() => setOptimizerMenuOpen(false)} aria-hidden />
                  </>
                )}
              </div>
              <Button onClick={() => setIsEditing(true)} size="sm" className="h-auto min-h-9 whitespace-normal text-left">
                <Edit2 className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6 overflow-hidden border-border/80 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <CardContent className="p-0">
          <div className="grid gap-0 xl:grid-cols-[320px_1fr_320px]">
            <div className="border-b border-border bg-[#fafcfa] p-5 xl:border-b-0 xl:border-r">
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title || 'Produit'}
                    className="aspect-square w-full object-cover"
                    onClick={() => openImageViewer(0)}
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-muted">
                    <Package className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Button type="button" className="h-auto min-h-11 w-full whitespace-normal px-3 py-2 text-center leading-5" onClick={() => { setAiDestinationId(null); setAutoGenerateAiOnOpen(true); setShowAiOptimizationModal(true); }}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Tout optimiser avec l&apos;IA
                </Button>
                {item.imageUrl && (
                  <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal px-3 py-2 text-center leading-5" onClick={() => openImageViewer(0)}>
                    <ZoomIn className="mr-2 h-4 w-4" />
                    Voir l&apos;image
                  </Button>
                )}
              </div>
              {galleryImages.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Galerie produit</span>
                    <span>{galleryImages.length} visuel{galleryImages.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 2xl:grid-cols-4">
                    {galleryImages.slice(0, 4).map((img, idx) => (
                      <button
                        key={`${img}-${idx}`}
                        type="button"
                        className="overflow-hidden rounded-lg border border-border"
                        onClick={() => {
                          const viewerIndex = allImagesForViewer.indexOf(img);
                          setCurrentImageIndex(viewerIndex >= 0 ? viewerIndex : idx + 1);
                          setImageViewerOpen(true);
                        }}
                      >
                        <img src={img} alt={`${item.title || 'Produit'} ${idx + 2}`} className="aspect-square w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-5 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fiche produit</p>
                  <h1 className="text-2xl font-bold leading-tight text-foreground">{item.title || 'Sans titre'}</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(editedItem.availability ?? item.availability) && (
                    <Badge className={cn(
                      'border-0',
                      (editedItem.availability ?? item.availability) === 'in stock'
                        ? 'bg-green-100 text-green-800'
                        : (editedItem.availability ?? item.availability) === 'out of stock'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-muted text-muted-foreground'
                    )}>
                      {(editedItem.availability ?? item.availability) === 'in stock'
                        ? 'En stock'
                        : (editedItem.availability ?? item.availability) === 'out of stock'
                          ? 'Rupture'
                          : String(editedItem.availability ?? item.availability)}
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-background">
                    {isEligibleGoogle ? 'Prêt à diffuser' : 'À finaliser'}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {item.brand && <Badge variant="outline" className="bg-background">Marque : {item.brand}</Badge>}
                {item.sku && <Badge variant="outline" className="bg-background">SKU : {item.sku}</Badge>}
                {(editedItem.price ?? item.price) != null && (
                  <Badge variant="outline" className="bg-background">
                    Prix : {`${Number(editedItem.price ?? item.price).toFixed(2)} ${editedItem.currency ?? item.currency ?? 'EUR'}`}
                  </Badge>
                )}
                <Badge variant="outline" className="bg-background">
                  Stock : {(editedItem.inventory ?? item.inventory) != null ? String(editedItem.inventory ?? item.inventory) : 'Non renseigné'}
                </Badge>
                <Badge variant="outline" className="bg-background">
                  Visuels : {1 + galleryImages.length}
                </Badge>
              </div>

              {descriptionPreview && (
                <div className="rounded-xl border border-border/80 bg-[#fafcfa] p-4">
                  <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Résumé marchand</div>
                  <p className="text-sm leading-6 text-foreground">{descriptionPreview}</p>
                </div>
              )}

              {optimizedHighlights.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-emerald-700">Highlights IA</div>
                      <p className="text-sm text-emerald-900">
                        Arguments actuellement retenus pour la diffusion
                        {optimizedContentInfo ? ` (${optimizedContentInfo.platform.toUpperCase()})` : ''}.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => { setAiDestinationId(null); setAutoGenerateAiOnOpen(false); setShowAiOptimizationModal(true); }}>
                      Modifier
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {optimizedHighlights.slice(0, 6).map((highlight) => (
                      <div key={highlight} className="rounded-lg bg-white/80 px-3 py-2 text-sm text-foreground">
                        {highlight}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border bg-[#fbfcfb] p-6 xl:border-l xl:border-t-0">
              <div className="rounded-2xl border border-border/80 bg-background p-5 shadow-[0_8px_22px_rgba(15,23,42,0.03)]">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Cockpit produit</div>
                <div className={cn('mt-2 text-4xl font-bold', scoreColor)}>{globalScore}</div>
                <div className="text-sm text-muted-foreground">score produit / 100</div>
                <div className={cn('mt-3 inline-flex rounded-full px-3 py-1 text-sm font-medium', scoreBg)}>
                  {isEligibleGoogle ? 'Prêt à diffuser' : 'Corrections prioritaires requises'}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-[#fafcfa] px-3 py-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Blocages requis</div>
                    <div className="mt-1 text-lg font-semibold text-foreground">{missingRequiredCount}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-[#fafcfa] px-3 py-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">À enrichir</div>
                    <div className="mt-1 text-lg font-semibold text-foreground">{missingRecommendedCount}</div>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-border bg-[#fafcfa] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Prochaine action recommandée</div>
                      <p className="mt-1 text-sm text-foreground">
                        {scoreGap > 0
                          ? `Pour viser ${nextMilestone}/100, commence par les actions qui font le plus progresser cette fiche.`
                          : 'Le score est déjà solide. L’IA peut encore affiner la fiche et la diffusion.'}
                      </p>
                    </div>
                    <div className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                      {scoreGap > 0 ? `Cap +${scoreGap} pts` : 'Optimisation fine'}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {primaryFastTrackAction ? (
                      <div className="rounded-xl border border-border bg-background px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                            {primaryFastTrackAction.channel}
                          </span>
                          <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            {primaryFastTrackAction.impact}
                          </span>
                        </div>
                        <div className="mt-3 text-sm font-semibold text-foreground">{primaryFastTrackAction.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{primaryFastTrackAction.detail}</div>
                        <Button
                          type="button"
                          size="sm"
                          className="mt-3 h-auto min-h-11 w-full whitespace-normal px-3 py-2 text-left leading-5"
                          onClick={primaryFastTrackAction.onClick}
                          disabled={enriching && primaryFastTrackAction.key === 'technical-enrichment'}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          {primaryFastTrackAction.actionLabel}
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-900">
                        Les leviers IA principaux sont déjà exploités. Concentre-toi surtout sur les ajustements fins et la diffusion.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2">
                    <Button variant="outline" className="h-auto min-h-11 w-full whitespace-normal px-3 py-2 text-left leading-5" onClick={() => { setAiDestinationId(null); setAutoGenerateAiOnOpen(true); setShowAiOptimizationModal(true); }}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Tout optimiser avec l&apos;IA
                    </Button>
                    <Button variant="outline" className="h-auto min-h-11 w-full whitespace-normal px-3 py-2 text-left leading-5" onClick={() => { setIsEditing(true); scrollToSection('donnees'); }}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      Modifier manuellement les champs
                    </Button>
                    <Button variant="outline" className="h-auto min-h-11 w-full whitespace-normal px-3 py-2 text-left leading-5" onClick={() => scrollToSection('enrichissement')}>
                      Completer les champs techniques
                    </Button>
                  </div>
                  {!productScore && !loading && (
                    <Button
                      variant="outline"
                      className="mt-2 h-auto min-h-11 w-full whitespace-normal px-3 py-2 text-left leading-5"
                      onClick={async () => {
                        try {
                          const response = await apiClient.get<ProductScoreData>(`/ingestion/items/${params.id}/score`);
                          if (response?.data) setProductScore(normalizeProductScore(response.data));
                        } catch (err) {
                          Sentry.captureException(err, { tags: { area: 'product.score', itemId: String(params.id) } });
                          setToast({ type: 'error', message: t('catalogue.errorScore') });
                          setTimeout(() => setToast(null), 5000);
                        }
                      }}
                    >
                      Recalculer le score
                    </Button>
                  )}
                </div>

                <div className="mt-6">
                  <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Accès rapide</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { id: 'conformite' as const, label: 'Blocages et diffusion' },
                      { id: 'donnees' as const, label: 'Données' },
                      { id: 'enrichissement' as const, label: 'Enrichissement' },
                      { id: 'historique' as const, label: 'Historique' },
                    ].map(({ id, label }) => (
                      <Button key={id} type="button" variant="outline" size="sm" className="h-auto min-h-10 justify-start whitespace-normal px-3 py-2 text-left leading-5" onClick={() => scrollToSection(id)}>
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div ref={sectionRefs.conformite} className="mb-6">
        <Card className="border-border/80 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <CardHeader>
            <CardTitle className="text-lg">Blocages et diffusion</CardTitle>
            <CardDescription>Une seule zone pour voir ce qui bloque, où le produit peut partir, et quoi corriger ensuite.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-border/80 bg-[#fafcfa] p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Score</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">{globalScore}/100</div>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
                <div className="text-xs uppercase tracking-wide text-red-700">Requis manquants</div>
                <div className="mt-1 text-2xl font-semibold text-red-900">{missingRequiredCount}</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="text-xs uppercase tracking-wide text-amber-700">À enrichir</div>
                <div className="mt-1 text-2xl font-semibold text-amber-900">{missingRecommendedCount}</div>
              </div>
              <div className="rounded-xl border border-border/80 bg-[#fafcfa] p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Statut</div>
                <div className="mt-1 text-base font-semibold text-foreground">{isEligibleGoogle ? 'Prêt à diffuser' : 'À finaliser'}</div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
              <div className="space-y-4">
                <div className="rounded-xl border border-border/80 bg-[#fcfdfc] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
                  <div className="mb-3 text-sm font-semibold text-foreground">Checklist produit</div>
                  {productScore?.qualityDetails ? (
                    <div className="space-y-2">
                      {checklistEntries.map(({ field, label, ok, required }) => (
                        <button
                          key={field}
                          type="button"
                          onClick={() => !ok && scrollToField(field === 'description' ? 'description' : field === 'image' ? 'image' : field)}
                          className={cn(
                            'flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left transition-colors',
                            ok ? 'border-green-200 bg-green-50/60' : required ? 'border-red-200 bg-red-50/70 hover:bg-red-100/70' : 'border-amber-200 bg-amber-50/70 hover:bg-amber-100/70'
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={ok ? 'text-green-700' : required ? 'text-red-700' : 'text-amber-700'}>{ok ? '✓' : '•'}</span>
                            <span className="text-sm font-medium text-foreground break-words">{label}</span>
                            {required && <Badge variant="outline" className="text-[10px]">Requis</Badge>}
                          </span>
                          <span className="text-xs text-muted-foreground">{ok ? 'OK' : 'Voir le champ'}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Calculez le score pour afficher la checklist.</p>
                  )}
                </div>

                {recommendationMessages.length > 0 && (
                  <div className="rounded-xl border border-border/80 bg-[#fcfdfc] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
                    <div className="mb-3 text-sm font-semibold text-foreground">Alertes et conseils</div>
                    <div className="space-y-2">
                      {recommendationMessages.map((rec: RecommendationItem, idx: number) => (
                        <div key={idx} className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-[#fafcfa] px-3 py-2 text-sm">
                          <span className="text-foreground">{rec.message || ''}</span>
                          {typeof rec.field === 'string' && rec.field.length > 0 && (
                            <Button variant="ghost" size="sm" className="h-auto min-h-9 whitespace-normal px-2 py-1 text-left" onClick={() => scrollToField(String(rec.field))}>
                              Voir
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div ref={sectionRefs.diffusion} className="rounded-xl border border-border/80 bg-[#fcfdfc] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">Canaux de sortie</div>
                    <Badge variant="outline" className="bg-background">
                      {activeOutputCount} actif{activeOutputCount > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {channelCards.map((channel) => (
                      <div
                        key={channel.key}
                        className={cn(
                          'rounded-xl border p-4 transition-colors',
                          channel.statusLabel === 'Actif'
                            ? 'border-border/80 bg-[#fafcfa]'
                            : 'border-border/70 bg-slate-50/70 opacity-70 grayscale-[0.18]'
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white',
                              channel.statusLabel === 'Actif' ? 'border-border/80 shadow-sm' : 'border-border/60'
                            )}>
                              {getChannelLogo(channel.key)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-medium">{channel.label}</div>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[11px]',
                                    channel.statusLabel === 'Actif'
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : channel.statusLabel === 'Désactivé'
                                        ? 'border-slate-200 bg-slate-100 text-slate-600'
                                        : 'border-amber-200 bg-amber-50 text-amber-700'
                                  )}
                                >
                                  {channel.statusLabel}
                                </Badge>
                              </div>
                              <div className="mt-1 text-sm text-muted-foreground">{channel.detail}</div>
                              {channel.helper ? (
                                <div className="mt-2 text-xs text-muted-foreground">{channel.helper}</div>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {channel.statusLabel === 'Actif'
                                ? 'Diffusion active'
                                : channel.actionVariant === 'secondary'
                                  ? 'Configuration requise'
                                  : 'Action requise'}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={cn(
                                'min-w-[168px] h-11 px-4 font-semibold shadow-sm',
                                channel.actionVariant === 'accent' && 'border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700',
                                channel.actionVariant === 'secondary' && 'border-amber-500 bg-amber-500 text-white hover:border-amber-600 hover:bg-amber-600',
                                channel.actionVariant === 'outline' && 'border-slate-300 bg-white text-foreground hover:bg-slate-50'
                              )}
                              onClick={channel.onAction}
                              disabled={channel.toggleDisabled}
                            >
                              {channel.actionVariant === 'secondary' ? (
                                <Settings2 className="mr-2 h-4 w-4" />
                              ) : channel.statusLabel === 'Actif' ? (
                                <PowerOff className="mr-2 h-4 w-4" />
                              ) : (
                                <Power className="mr-2 h-4 w-4" />
                              )}
                              {channel.actionLabel}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-border/80 bg-white/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Diffusion par marche</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {loadingDestinationActivations
                            ? 'Chargement des marches actifs...'
                            : totalDestinationCount > 0
                              ? `${activeDestinationCount} destination${activeDestinationCount > 1 ? 's' : ''} active${activeDestinationCount > 1 ? 's' : ''} sur ${destinationMarketCount} marche${destinationMarketCount > 1 ? 's' : ''}.`
                              : 'Aucun marche actif n est encore configure pour piloter cette fiche plus finement.'}
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-background">
                        {totalDestinationCount > 0 ? `${activeDestinationCount}/${totalDestinationCount}` : '0'}
                      </Badge>
                    </div>

                    {totalDestinationCount > 0 ? (
                      <div className="mt-4 space-y-4">
                        {destinationActivationGroups.map((group) => {
                          const activeGroupCount = group.items.filter((entry) => entry.isEnabled).length;
                          return (
                            <div key={group.marketId} className="rounded-xl border border-border/70 bg-[#fafcfa] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="font-medium text-foreground">{group.marketName}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {activeGroupCount}/{group.items.length} destination{group.items.length > 1 ? 's' : ''} active{activeGroupCount > 1 ? 's' : ''}
                                  </div>
                                </div>
                                <Badge variant="outline" className="bg-white">
                                  {group.marketCode}
                                </Badge>
                              </div>

                              <div className="mt-3 space-y-2">
                                {group.items.map((destination) => {
                                  const targetSummary = [
                                    destination.localeCode ? `Langue ${destination.localeCode}` : null,
                                    destination.currencyCode ? `Devise ${destination.currencyCode}` : null,
                                    destination.externalScopeLabel || null,
                                  ].filter(Boolean).join(' · ');
                                  const statusLabel = destination.isEnabled ? 'Active' : 'Exclue';
                                  const sourceLabel = destination.activationSource === 'destination'
                                    ? 'Pilotage specifique sur ce marche.'
                                    : 'Herite du reglage global du canal.';
                                  return (
                                    <div
                                      key={destination.destinationId}
                                      className={cn(
                                        'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3 transition-colors',
                                        destination.isEnabled
                                          ? 'border-emerald-200 bg-emerald-50/50'
                                          : 'border-slate-200 bg-slate-50'
                                      )}
                                    >
                                      <div className="flex min-w-0 items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-white">
                                          {getChannelLogo(destination.platformKey)}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium text-foreground">{destination.platformLabel}</span>
                                            <Badge
                                              variant="outline"
                                              className={cn(
                                                'text-[11px]',
                                                destination.isEnabled
                                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                  : 'border-slate-200 bg-slate-100 text-slate-600'
                                              )}
                                            >
                                              {statusLabel}
                                            </Badge>
                                          </div>
                                          {targetSummary ? (
                                            <div className="mt-1 text-sm text-muted-foreground">{targetSummary}</div>
                                          ) : null}
                                          <div className="mt-1 text-xs text-muted-foreground">{sourceLabel}</div>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center justify-end gap-2">
                                        {['gmc', 'amazon', 'meta', 'chatgpt'].includes(destination.platformKey) && (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-10 px-4"
                                            onClick={() => {
                                              setAiDestinationId(destination.destinationId);
                                              setAutoGenerateAiOnOpen(false);
                                              setShowAiOptimizationModal(true);
                                            }}
                                          >
                                            Optimiser ce marche
                                          </Button>
                                        )}
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant={destination.isEnabled ? 'outline' : 'default'}
                                          className={cn(
                                            'min-w-[148px] h-10 px-4 font-semibold',
                                            !destination.isEnabled && 'bg-emerald-600 text-white hover:bg-emerald-700'
                                          )}
                                          disabled={Boolean(savingDestinationId)}
                                          onClick={() => void setDestinationEnabled(destination.destinationId, !destination.isEnabled)}
                                        >
                                          {savingDestinationId === destination.destinationId
                                            ? 'Mise a jour...'
                                            : destination.isEnabled
                                              ? 'Exclure ce marche'
                                              : 'Inclure ce marche'}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-[#fafcfa] px-4 py-3 text-sm text-muted-foreground">
                        Cree d abord un marche dans Flux pour activer une diffusion plus fine par pays, langue ou marketplace.
                      </div>
                    )}
                  </div>
                </div>

                <details className="rounded-xl border border-border/80 bg-[#fcfdfc] shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground flex items-center justify-between">
                    <span>Voir le détail du score</span>
                    <span className="text-xs text-muted-foreground">{globalScore}/100</span>
                  </summary>
                  <div className="space-y-4 border-t border-border px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        { dimKey: 'dataQuality', label: 'Données produit', scrollSection: 'donnees' as const, scrollField: null },
                        { dimKey: 'seo', label: 'SEO / Titre', scrollSection: null, scrollField: 'title' as const },
                        { dimKey: 'conversion', label: 'Images', scrollSection: null, scrollField: 'image' as const },
                        { dimKey: 'compliance', label: 'Conformité GMC', scrollSection: 'conformite' as const, scrollField: null },
                      ].map((dim) => {
                        const score = dimensions[dim.dimKey as keyof typeof dimensions] ?? (productScore?.qualityScore ?? 0);
                        const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
                        const bg = score >= 80 ? 'bg-green-50 border-green-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
                        const onClick = () => {
                          if (dim.scrollField) scrollToField(dim.scrollField);
                          else if (dim.scrollSection) scrollToSection(dim.scrollSection);
                        };
                        return (
                          <button
                            key={dim.dimKey}
                            type="button"
                            onClick={onClick}
                            className={cn('rounded-xl border p-4 text-left transition-colors hover:opacity-90', bg)}
                          >
                            <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">{dim.label}</span>
                            <span className={cn('text-2xl font-bold', color)}>{Math.round(Number(score))}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="rounded-xl border border-border/80 bg-[#fafcfa] p-4">
                      <h4 className="mb-2 text-sm font-semibold text-foreground">Évolution du score</h4>
                      {loadingScoreHistory ? (
                        <p className="text-sm text-muted-foreground">Chargement…</p>
                      ) : scoreHistory?.history && scoreHistory.history.length > 0 ? (
                        <Chart
                          data={scoreHistory.history.map((p) => ({
                            name: new Date(p.recordedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
                            value: p.qualityScore,
                          }))}
                          type="line"
                          height={180}
                          showGrid={true}
                          showTooltip={true}
                          colors={[globalScore >= 80 ? '#16a34a' : globalScore >= 60 ? '#d97706' : '#dc2626']}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Aucun historique pour l&apos;instant. Le score est enregistré à chaque optimisation.
                        </p>
                      )}
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ——— 4. Bloc Données produit (flux complet éditable) ——— */}
      <div ref={sectionRefs.donnees}>
      <Card className="mb-6 border-border/80 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <CardHeader>
          <CardTitle className="text-lg">Données produit</CardTitle>
          <CardDescription>
            Les champs essentiels sont visibles en premier. Le reste du mapping peut être consulté si besoin, sans alourdir la lecture.
          </CardDescription>
        </CardHeader>
      </Card>
      <div>
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/80 bg-[#fafcfa] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Champs mappés</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{mappedFieldCount}</div>
          <p className="mt-1 text-sm text-muted-foreground">Attributs déjà reçus depuis le flux marchand.</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="text-xs uppercase tracking-wide text-amber-700">Opportunités IA</div>
          <div className="mt-1 text-2xl font-semibold text-amber-900">{enrichmentOpportunityCount}</div>
          <p className="mt-1 text-sm text-amber-800">Champs que FeedPlug peut compléter automatiquement.</p>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
        {/* Image */}
        <Card 
          ref={fieldRefs.image} 
          className={cn(
            'border-border/80 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition-all',
            highlightedField === 'image' && 'border-amber-300 bg-amber-50/70 shadow-[0_0_0_1px_rgba(251,191,36,0.18)]'
          )}
        >
          <CardContent className="p-4">
            {item.imageUrl ? (
              <div className="space-y-3">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-auto w-full cursor-pointer rounded-sm"
                  onClick={() => openImageViewer(0)}
                />
                <Button
                  onClick={() => openImageViewer(0)}
                  size="sm"
                  variant="outline"
                  className="h-auto min-h-10 w-full whitespace-normal px-3 py-2 text-center leading-5 sm:w-auto"
                >
                  <ZoomIn className="w-3.5 h-3.5 mr-1" />
                  Agrandir
                </Button>
              </div>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-sm bg-[#fafcfa] text-muted-foreground">
                <Package className="w-12 h-12" />
              </div>
            )}

            {/* Images produit : supplémentaires + mises en situation (une seule galerie) */}
            {(() => {
              const lifestyle = (item as { _lifestyleImageUrls?: Record<string, string | null> })._lifestyleImageUrls;
              const lifestyleUrls = lifestyle ? [...new Set(Object.values(lifestyle).filter((u): u is string => !!u && typeof u === 'string'))] : [];
              const additional = item.additionalImages || [];
              const allProductImages = [...additional, ...lifestyleUrls];
              if (allProductImages.length === 0) return null;
              return (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold mb-3 text-foreground">
                    Images produit ({allProductImages.length})
                    {lifestyleUrls.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (dont {lifestyleUrls.length} mise{lifestyleUrls.length > 1 ? 's' : ''} en situation)
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    {allProductImages.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={idx < additional.length ? `${item.title} - Image ${idx + 2}` : `${item.title} - Mise en situation`}
                        className="w-full aspect-square object-cover rounded-sm cursor-pointer border"
                        onClick={() => {
                          const viewerIndex = allImagesForViewer.indexOf(img);
                          setCurrentImageIndex(viewerIndex >= 0 ? viewerIndex : idx + 1);
                          setImageViewerOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Informations produit */}
        <Card className="border-border/80 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <CardContent className="p-6">
            <CardTitle className="text-lg font-medium mb-5">
              Informations produit
            </CardTitle>
          
          <div className="grid gap-4">
            <ProductFieldWithSource
              label={t('fields.title')}
              fluxValue={item.title}
              value={editedItem.title}
              onChange={(v) => setEditedItem((prev) => ({ ...prev, title: toEditableTextValue(v) }))}
              source={getFieldSource('title')}
              onSourceChange={(s) => handleFieldSourceChange('title', s)}
              isEditing={isEditing}
              fieldRef={fieldRefs.title}
              highlighted={highlightedField === 'title'}
              onOptimize={() => handleOptimizeField('title')}
            />
            <ProductFieldWithSource
              label={t('fields.sku')}
              fluxValue={item.sku}
              value={editedItem.sku}
              onChange={(v) => setEditedItem((prev) => ({ ...prev, sku: toEditableTextValue(v) }))}
              source={getFieldSource('sku')}
              onSourceChange={(s) => handleFieldSourceChange('sku', s)}
              isEditing={isEditing}
              placeholder={t('common.notSet')}
              fieldRef={fieldRefs.sku}
              highlighted={highlightedField === 'sku'}
            />
            <ProductFieldWithSource
              label={t('fields.brand')}
              fluxValue={item.brand}
              value={editedItem.brand}
              onChange={(v) => setEditedItem((prev) => ({ ...prev, brand: toEditableTextValue(v) }))}
              source={getFieldSource('brand')}
              onSourceChange={(s) => handleFieldSourceChange('brand', s)}
              isEditing={isEditing}
              placeholder={t('common.notSet')}
              fieldRef={fieldRefs.brand}
              highlighted={highlightedField === 'brand'}
              onOptimize={() => handleOptimizeField('brand')}
            />
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <ProductFieldWithSource
                label={t('catalogue.price')}
                fluxValue={item.price != null ? item.price : null}
                value={editedItem.price}
                onChange={(v) => setEditedItem((prev) => ({ ...prev, price: v != null ? Number(v) : null }))}
                source={getFieldSource('price')}
                onSourceChange={(s) => handleFieldSourceChange('price', s)}
                isEditing={isEditing}
                type="number"
                placeholder={t('catalogue.placeholderPrice')}
                fieldRef={fieldRefs.price}
                highlighted={highlightedField === 'price'}
              />
              <ProductFieldWithSource
                label={t('fields.currency')}
                fluxValue={item.currency}
                value={editedItem.currency}
                onChange={(v) => setEditedItem((prev) => ({ ...prev, currency: toEditableTextValue(v) }))}
                source={getFieldSource('currency')}
                onSourceChange={(s) => handleFieldSourceChange('currency', s)}
                isEditing={isEditing}
                placeholder={t('catalogue.placeholderCurrency')}
              />
            </div>
            <ProductFieldWithSource
              label={t('fields.inventory')}
              fluxValue={item.inventory}
              value={editedItem.inventory}
              onChange={(v) => setEditedItem((prev) => ({ ...prev, inventory: v != null ? Number(v) : null }))}
              source={getFieldSource('inventory')}
              onSourceChange={(s) => handleFieldSourceChange('inventory', s)}
              isEditing={isEditing}
              type="number"
              placeholder={t('catalogue.placeholderStock')}
            />
            <ProductFieldWithSource
              label={t('fields.url')}
              fluxValue={item.url}
              value={editedItem.url}
              onChange={(v) => setEditedItem((prev) => ({ ...prev, url: toEditableTextValue(v) }))}
              source={getFieldSource('url')}
              onSourceChange={(s) => handleFieldSourceChange('url', s)}
              isEditing={isEditing}
              placeholder={t('catalogue.placeholderUrl')}
              fieldRef={fieldRefs.url}
              highlighted={highlightedField === 'url'}
            />
            <ProductFieldWithSource
              label={t('catalogue.description')}
              fluxValue={item.descriptionText}
              value={editedItem.descriptionText}
              onChange={(v) => setEditedItem((prev) => ({ ...prev, descriptionText: toEditableTextValue(v) }))}
              source={getFieldSource('descriptionText')}
              onSourceChange={(s) => handleFieldSourceChange('descriptionText', s)}
              isEditing={isEditing}
              type="textarea"
              placeholder={t('catalogue.placeholderDescription')}
              fieldRef={fieldRefs.description}
              highlighted={highlightedField === 'description'}
              onOptimize={() => handleOptimizeField('description')}
            />
            <details className="group pt-2 border-t border-border">
              <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground py-2">
                <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                Attributs avancés (GTIN, MPN, condition, catégorie…)
              </summary>
              <div className="grid gap-4 pt-2 pl-6">
            <ProductFieldWithSource
              label={t('catalogue.labelGtin')}
              fluxValue={item.gtin}
              value={editedItem.gtin}
              onChange={(v) => setEditedItem((prev) => ({ ...prev, gtin: toEditableTextValue(v) }))}
              source={getFieldSource('gtin')}
              onSourceChange={(s) => handleFieldSourceChange('gtin', s)}
              isEditing={isEditing}
              placeholder={t('common.notSet')}
              fieldRef={fieldRefs.gtin}
              highlighted={highlightedField === 'gtin'}
              onOptimize={() => handleOptimizeField('gtin')}
            />
            <ProductFieldWithSource
              label={t('catalogue.labelMpn')}
              fluxValue={item.mpn}
              value={editedItem.mpn}
              onChange={(v) => setEditedItem((prev) => ({ ...prev, mpn: toEditableTextValue(v) }))}
              source={getFieldSource('mpn')}
              onSourceChange={(s) => handleFieldSourceChange('mpn', s)}
              isEditing={isEditing}
              placeholder={t('common.notSet')}
              fieldRef={fieldRefs.mpn}
              highlighted={highlightedField === 'mpn'}
              onOptimize={() => handleOptimizeField('mpn')}
            />
            <ProductFieldWithSource
              label={t('catalogue.labelCondition')}
              fluxValue={item.condition}
              value={editedItem.condition}
              onChange={(v) => setEditedItem((prev) => ({ ...prev, condition: toEditableTextValue(v) }))}
              source={getFieldSource('condition')}
              onSourceChange={(s) => handleFieldSourceChange('condition', s)}
              isEditing={isEditing}
              fieldRef={fieldRefs.condition}
              highlighted={highlightedField === 'condition'}
              selectOptions={[
                { value: 'new', label: 'Neuf' },
                { value: 'refurbished', label: 'Reconditionné' },
                { value: 'used', label: 'Occasion' },
              ]}
              placeholder={t('common.notSet')}
            />
            <ProductFieldWithSource
              label={t('catalogue.labelCategory')}
              fluxValue={getDisplayFieldValue((item as Record<string, unknown>).google_product_category ?? item.googleProductCategory)}
              value={getDisplayFieldValue((editedItem as Record<string, unknown>).google_product_category ?? editedItem.googleProductCategory)}
              onChange={(v) => {
                const nextValue = toEditableTextValue(v);
                setEditedItem((prev) => ({ ...prev, google_product_category: nextValue, googleProductCategory: nextValue }));
              }}
              source={getFieldSource('google_product_category')}
              onSourceChange={(s) => handleFieldSourceChange('google_product_category', s)}
              isEditing={isEditing}
              placeholder={t('catalogue.placeholderCategory')}
              fieldRef={fieldRefs.google_product_category}
              highlighted={highlightedField === 'google_product_category'}
              onOptimize={() => handleOptimizeField('google_product_category')}
            />
            <ProductFieldWithSource
              label={t('catalogue.productType')}
              fluxValue={getDisplayFieldValue((item as Record<string, unknown>).product_type ?? item.productType)}
              value={getDisplayFieldValue((editedItem as Record<string, unknown>).product_type ?? editedItem.productType)}
              onChange={(v) => {
                const nextValue = toEditableTextValue(v);
                setEditedItem((prev) => ({ ...prev, product_type: nextValue, productType: nextValue }));
              }}
              source={getFieldSource('product_type')}
              onSourceChange={(s) => handleFieldSourceChange('product_type', s)}
              isEditing={isEditing}
              placeholder={t('catalogue.placeholderProductType')}
              fieldRef={fieldRefs.product_type}
              highlighted={highlightedField === 'product_type'}
            />
            <ProductFieldWithSource
              label={t('catalogue.availability')}
              fluxValue={getDisplayFieldValue((item as Record<string, unknown>).availability ?? item.availability)}
              value={getDisplayFieldValue((editedItem as Record<string, unknown>).availability ?? editedItem.availability)}
              onChange={(v) => setEditedItem((prev) => ({ ...prev, availability: toEditableTextValue(v) }))}
              source={getFieldSource('availability')}
              onSourceChange={(s) => handleFieldSourceChange('availability', s)}
              isEditing={isEditing}
              fieldRef={fieldRefs.availability}
              highlighted={highlightedField === 'availability'}
              selectOptions={[
                { value: 'in stock', label: 'En stock' },
                { value: 'out of stock', label: 'Rupture de stock' },
                { value: 'preorder', label: 'Précommande' },
                { value: 'backorder', label: 'Sur commande' },
              ]}
              placeholder={t('common.select')}
            />

            {/* Attributs produits */}
            {(item.color || item.size || item.material || item.pattern || item.gender || item.ageGroup) && (
              <div className="pt-4 border-t border-border">
                <h3 className="text-sm font-semibold mb-3 text-foreground">Attributs produit</h3>
                <div className="grid gap-3">
                  {item.color && (<div><label className="block text-sm font-medium text-muted-foreground mb-1.5">Couleur</label><p className="m-0 text-sm text-foreground">{item.color}</p></div>)}
                  {item.size && (<div><label className="block text-sm font-medium text-muted-foreground mb-1.5">Taille</label><p className="m-0 text-sm text-foreground">{item.size}</p></div>)}
                  {item.material && (<div><label className="block text-sm font-medium text-muted-foreground mb-1.5">Matériau</label><p className="m-0 text-sm text-foreground">{item.material}</p></div>)}
                  {item.pattern && (<div><label className="block text-sm font-medium text-muted-foreground mb-1.5">Motif</label><p className="m-0 text-sm text-foreground">{item.pattern}</p></div>)}
                  {item.gender && (<div><label className="block text-sm font-medium text-muted-foreground mb-1.5">Genre</label><p className="m-0 text-sm text-foreground">{item.gender === 'male' ? 'Homme' : item.gender === 'female' ? 'Femme' : item.gender === 'unisex' ? 'Unisexe' : item.gender}</p></div>)}
                  {item.ageGroup && (<div><label className="block text-sm font-medium text-muted-foreground mb-1.5">Groupe d&apos;âge</label><p className="m-0 text-sm text-foreground">{item.ageGroup === 'newborn' ? 'Nouveau-né' : item.ageGroup === 'infant' ? 'Bébé' : item.ageGroup === 'toddler' ? 'Tout-petit' : item.ageGroup === 'kids' ? 'Enfant' : item.ageGroup === 'adult' ? 'Adulte' : item.ageGroup}</p></div>)}
                </div>
              </div>
            )}

            {/* ID de groupe (variantes) */}
            {item.itemGroupId && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">ID de groupe (variantes)</label>
                <p className="m-0 text-sm text-foreground">{item.itemGroupId}</p>
              </div>
            )}
              </div>
            </details>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tous les champs du mapping + champs supplémentaires */}
      {item && item.feed && (item.feed.mappingJson || item.feed.mappingjson) && Object.keys(item.feed.mappingJson || item.feed.mappingjson || {}).length > 0 && (
        <details className="mb-6 rounded-xl border border-border/80 bg-[#fcfdfc] shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-foreground flex items-center justify-between">
            <span>Voir le mapping complet du flux</span>
            <span className="text-xs text-muted-foreground">{mappedFieldCount} champ(s)</span>
          </summary>
          <div className="border-t border-border px-5 py-5">
            <ProductMappingGrid
              item={{ ...item, customfields: parseProductCustomFields(item.customfields) }}
              editedItem={editedItem as Record<string, unknown>}
              onEditedItemChange={(next) => setEditedItem((prev) => ({ ...prev, ...next }))}
              isEditing={isEditing}
            />
          </div>
        </details>
      )}
      </div>
      </div>

      {/* ——— 5. Bloc Enrichissement IA FeedPlug ——— */}
      <div ref={sectionRefs.enrichissement}>
        <Card className="mb-6 border-border/80 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Enrichissement IA FeedPlug
            </CardTitle>
            <CardDescription>
              FeedPlug te montre ici ce qui peut être complété automatiquement, avec validation avant application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {enrichmentAnalysis ? (
              <>
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <div className="text-xs uppercase tracking-wide text-amber-700">Champs proposés</div>
                    <div className="mt-1 text-2xl font-semibold text-amber-900">{enrichmentOpportunityCount}</div>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
                    <div className="text-xs uppercase tracking-wide text-red-700">Alertes détectées</div>
                    <div className="mt-1 text-2xl font-semibold text-red-900">{enrichmentAlertsCount}</div>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-[#fcfdfc] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Action recommandée</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {enrichmentOpportunityCount > 0 ? 'Prévisualiser puis appliquer les champs utiles' : 'Rien d’urgent à compléter'}
                    </div>
                  </div>
                </div>
                {enrichmentAnalysis.enrichedFieldsCount > 0 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {enrichmentAnalysis.enrichedFieldsCount} champ(s) peuvent être complétés. Prévisualisez avant d’appliquer.
                    </p>
                    {Object.entries(enrichmentAnalysis.enrichments).map(([field, proposedValue]) => {
                      const currentRaw = field === 'description'
                        ? (editedItem.descriptionText ?? item.descriptionText ?? item.descriptionHtml)
                        : (editedItem as Record<string, unknown>)[field] ?? (item as Record<string, unknown>)[field] ?? getCustomFieldValue(item, field);
                      const currentVal = formatEnrichmentValue(currentRaw);
                      const proposedStr = formatEnrichmentValue(proposedValue);
                      const isPreviewOpen = previewEnrichmentField === field;
                      const fieldLabel = field === 'google_product_category' ? 'Catégorie Google' : field === 'description' ? 'Description' : field === 'product_type' ? 'Type de produit' : field;
                      return (
                        <div key={field} className="rounded-xl border border-border/80 bg-[#fafcfa] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-medium text-foreground">{fieldLabel}</span>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-auto min-h-9 whitespace-normal px-3 py-2 text-left"
                                onClick={() => setPreviewEnrichmentField(isPreviewOpen ? null : field)}
                              >
                                {isPreviewOpen ? 'Masquer' : 'Prévisualiser'}
                              </Button>
                              <Button size="sm" className="h-auto min-h-9 whitespace-normal px-3 py-2 text-left" onClick={() => handleEnrich([field])} disabled={enriching}>
                                {enriching ? '…' : 'Appliquer'}
                              </Button>
                            </div>
                          </div>
                          {isPreviewOpen && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="rounded border border-amber-200 bg-amber-50/50 p-3">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Valeur actuelle</div>
                                <div className="text-sm text-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{currentVal === '—' ? 'Non renseigné' : currentVal}</div>
                              </div>
                              <div className="rounded border border-green-200 bg-green-50/50 p-3">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Valeur proposée (IA)</div>
                                <div className="text-sm text-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{proposedStr === '—' ? '—' : proposedStr}</div>
                              </div>
                            </div>
                          )}
                          {!isPreviewOpen && (
                            <p className="mt-2 text-sm text-muted-foreground truncate max-w-full" title={proposedStr}>
                              Proposé : {proposedStr === '—' ? '—' : proposedStr.length > 80 ? proposedStr.slice(0, 80) + '…' : proposedStr}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <Button onClick={() => void handleEnrich()} disabled={enriching} className="mt-2 h-auto min-h-10 whitespace-normal px-3 py-2 text-left leading-5">
                      {enriching ? 'Enrichissement…' : 'Appliquer tout'}
                    </Button>
                  </div>
                )}
                {enrichmentAnalysis.alertsCount > 0 && (
                  <details className="rounded-xl border border-border/80 bg-[#fcfdfc] shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground flex items-center justify-between">
                      <span>Voir les alertes détectées</span>
                      <span className="text-xs text-muted-foreground">{enrichmentAlertsCount}</span>
                    </summary>
                    <div className="space-y-2 border-t border-border px-4 py-4">
                      {enrichmentAnalysis.alerts.slice(0, 10).map((alert, idx: number) => (
                        <div key={idx} className={cn('rounded-md border p-3 text-sm', alert.level === 'error' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200')}>
                          <span className="font-medium">{alert.field}</span> — {alert.message}
                          {alert.suggestion && <p className="text-xs mt-1 italic">{alert.suggestion}</p>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {enrichmentAnalysis.enrichedFieldsCount === 0 && enrichmentAnalysis.alertsCount === 0 && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-700">Tous les champs requis et recommandés sont présents.</AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Chargement de l&apos;analyse…</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ——— 7. Historique des modifications ——— */}
      <div ref={sectionRefs.historique}>
        <Card className="mb-6 border-border/80 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5" />
              Historique des modifications
            </CardTitle>
            <CardDescription>
              Restaurer une version précédente ou revenir aux valeurs du flux d&apos;origine
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                size="sm"
                className="h-auto min-h-10 w-fit whitespace-normal px-3 py-2 text-left leading-5"
                onClick={() => setConfirmRevertOpen(true)}
                disabled={revertingToFeed || loadingRevisions}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {revertingToFeed ? 'En cours…' : 'Revenir au flux d\'origine'}
              </Button>
              {loadingRevisions ? (
                <p className="text-sm text-muted-foreground">Chargement de l&apos;historique…</p>
              ) : revisions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune révision enregistrée. Les révisions sont créées à chaque modification ou synchro du flux.</p>
              ) : (
                <ul className="space-y-2">
                  {revisions.map((rev) => (
                    <li key={rev.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm">
                        <span className="font-medium capitalize">{rev.source === 'ingestion' ? 'Synchro flux' : rev.source === 'manual' ? 'Modification manuelle' : rev.source === 'restore' ? 'Restauration' : rev.source}</span>
                        {' · '}
                        <span className="text-muted-foreground">{new Date(rev.createdAt).toLocaleString('fr-FR')}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto min-h-9 whitespace-normal px-3 py-2 text-left"
                        onClick={() => handleRestoreRevision(rev.id)}
                        disabled={restoringRevisionId === rev.id}
                      >
                        <Undo2 className="w-4 h-4 mr-1" />
                        {restoringRevisionId === rev.id ? '…' : 'Restaurer'}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visionneuse d'images */}
      {imageViewerOpen && item && (() => {
        const allImages = allImagesForViewer;
        const currentImage = allImages[currentImageIndex] || '';
        
        return (
          <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-5">
            <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center">
              <Button
                variant="secondary"
                size="icon"
                onClick={closeImageViewer}
                className="absolute -top-12 right-0 bg-white/10 border border-white/20 text-white hover:bg-white/20 z-[10000]"
              >
                <X className="w-5 h-5" />
              </Button>
              
              {allImages.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => navigateImage('prev')}
                    className="absolute -left-14 top-1/2 -translate-y-1/2 bg-white/10 border border-white/20 text-white hover:bg-white/20"
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => navigateImage('next')}
                    className="absolute -right-14 top-1/2 -translate-y-1/2 bg-white/10 border border-white/20 text-white hover:bg-white/20"
                  >
                    <ChevronRight className="w-8 h-8" />
                  </Button>
                </>
              )}
          
              <img
                src={currentImage || ''}
                alt={item?.title || 'Image produit'}
                className="max-w-full max-h-[80vh] object-contain rounded"
              />
          
              {allImages.length > 1 && (
                <div className="mt-4 text-white text-sm">
                  Image {currentImageIndex + 1} / {allImages.length}
                </div>
              )}
            </div>
          </div>
    );
  })()}

  {item && (
    <ProductAiOptimizationModal
      product={{
        id: item.id,
        title: item.title,
        description: item.descriptionText ?? item.descriptionHtml ?? undefined,
        sku: item.sku ?? undefined,
        brand: item.brand ?? undefined,
        url: item.url ?? undefined,
        imageUrl: item.imageUrl ?? undefined,
        customfields: item.customfields,
      }}
      isOpen={showAiOptimizationModal}
      destinations={aiDestinationOptions}
      initialDestinationId={aiDestinationId}
      autoGenerateOnOpen={autoGenerateAiOnOpen}
      onClose={() => {
        setAiDestinationId(null);
        setAutoGenerateAiOnOpen(false);
        setShowAiOptimizationModal(false);
      }}
      onApplied={async () => {
        setAiDestinationId(null);
        setAutoGenerateAiOnOpen(false);
        const previousScore = productScore?.qualityScore ?? null;
        const nextScore = await fetchItem();
        const nextValue = nextScore?.qualityScore ?? null;
        if (previousScore !== null && nextValue !== null) {
          const delta = nextValue - previousScore;
          const deltaLabel = delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : ' (stable)';
          setToast({ type: 'success', message: `${t('catalogue.titleDescSaved')} Score : ${nextValue}/100${deltaLabel}` });
        } else if (nextValue !== null) {
          setToast({ type: 'success', message: `${t('catalogue.titleDescSaved')} Score : ${nextValue}/100` });
        } else {
          setToast({ type: 'success', message: t('catalogue.titleDescSaved') });
        }
      }}
    />
  )}
    </PageLayout>
  );
}
