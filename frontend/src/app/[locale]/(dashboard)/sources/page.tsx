"use client";

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { 
  Database, Plus, CheckCircle, AlertCircle, Play, RefreshCw, Pause,
  Upload, Link as LinkIcon, ShoppingCart, FileText, Globe, Trash2, Layers,
  ChevronDown, ChevronUp, Settings, Check, X, ArrowLeft
} from 'lucide-react';
import {
  DashboardStatCard,
  DashboardStatGrid,
  PageLayout,
  PageHeader,
  PageError,
  PageLoading,
  EmptyState,
  PageCard,
  StatusBadge,
  PageButtonPrimary,
  PageButtonSecondary,
} from '@/components/layout';
import { getIngestionSyncToastMessage, getIngestionEmptyFileMessage } from '@/lib/ingestion-sync-message';
import { ALL_MAPPING_FIELDS, CHANNEL_OPTIONS, MAPPING_FIELDS_GROUPS, getMappingFieldsForChannel, type MappingOutputChannel } from '@/lib/mapping-field-groups';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { buildLocalizedPath, getLocalePrefixForLocale } from '@/lib/locale-navigation';

interface FeedSource {
  id: string;
  name: string;
  connector: string;
  configJson: Record<string, unknown>;
  defaultFreq: string;
  status: string;
  lastRunAt: string | null;
  createdAt: string;
}

interface Feed {
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
  createdAt: string;
}

interface EnrichmentSource {
  id: string;
  feedId: string;
  name: string;
  configJson: { csvUrl?: string; joinKey?: string; joinColumn?: string };
  mappingJson: Record<string, string>;
  status: string;
  lastSyncAt: string | null;
  createdAt: string;
}

interface ApplyEnrichmentResponse {
  applied?: number;
}

interface AnalyzeCsvResponse {
  csvUrl?: string;
  gcsPath?: string | null;
  suggestedMapping?: Record<string, string>;
  columns?: string[];
  preview?: CsvPreviewRow[];
}

interface CreateSourceResponse {
  id: string;
}

interface CsvPreviewRow {
  title?: string;
  price?: string | number;
  brand?: string;
  [key: string]: unknown;
}


function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      message?: string;
      response?: {
        detail?: string;
        message?: string;
        data?: { message?: string };
      };
    };

    return (
      candidate.response?.detail ||
      candidate.response?.message ||
      candidate.response?.data?.message ||
      candidate.message ||
      fallback
    );
  }

  return fallback;
}

const CUSTOM_MAPPING_SENTINEL = '__custom__';
const KNOWN_MAPPING_KEYS = new Set(ALL_MAPPING_FIELDS.map((field) => field.key));

function sanitizeCustomFieldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function getMappedTargetForColumn(currentMapping: Record<string, string>, column: string): string | undefined {
  return Object.entries(currentMapping).find(([, mappedColumn]) => mappedColumn === column)?.[0];
}

function isCustomMappingTarget(target: string): boolean {
  return !KNOWN_MAPPING_KEYS.has(target);
}

function buildCustomMappingTarget(column: string, currentMapping: Record<string, string>, previousTarget?: string): string {
  const baseTarget = sanitizeCustomFieldKey(column) || 'custom_field';
  let candidate = baseTarget;
  let suffix = 2;

  while (
    candidate !== previousTarget &&
    Object.prototype.hasOwnProperty.call(currentMapping, candidate) &&
    currentMapping[candidate] !== column
  ) {
    candidate = `${baseTarget}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function formatSourceFrequency(defaultFreq?: string | null): string {
  if (!defaultFreq) return 'Manuelle';
  const normalized = String(defaultFreq).toUpperCase();
  if (normalized.includes('HOUR')) return 'Horaire';
  if (normalized.includes('WEEK')) return 'Hebdomadaire';
  if (normalized.includes('MONTH')) return 'Mensuelle';
  return 'Quotidienne';
}

function formatSourceDate(value?: string | null, locale = 'fr-FR'): string {
  if (!value) return 'Jamais';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Jamais';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function normalizeConnectorUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getSyncKeyCoverage(mappingJson?: Record<string, string>) {
  const mapping = mappingJson || {};
  const hasTitle = Boolean(mapping.title);
  const hasIdentifier = Boolean(mapping.id || mapping.sku);
  const hasLink = Boolean(mapping.link || mapping.mobile_link);
  const missing: string[] = [];

  if (!hasTitle) missing.push('Titre');
  if (!hasIdentifier) missing.push('ID / SKU');
  if (!hasLink) missing.push('URL produit');

  return {
    hasTitle,
    hasIdentifier,
    hasLink,
    hasMinimumSyncFields: hasTitle || hasIdentifier || hasLink,
    missing,
  };
}

function getSourceReadiness(source: FeedSource, primaryFeed?: Feed) {
  const mappingJson = primaryFeed?.mappingJson || {};
  const mappingCount = Object.keys(mappingJson).length;
  const hasAttempt = Boolean(primaryFeed?.latestRun?.status || primaryFeed?.latestRun?.finishedAt || source.lastRunAt);

  if (!primaryFeed) {
    return {
      tone: 'var(--warning)',
      bg: 'var(--warning-bg)',
      border: 'var(--warning)',
      label: 'Flux à finaliser',
      text: 'Aucun flux n’est encore associé à cette source. Reprenez la configuration avant la première synchro.',
      canSync: false,
    };
  }

  const syncCoverage = getSyncKeyCoverage(mappingJson);

  if (mappingCount === 0 || !syncCoverage.hasMinimumSyncFields) {
    return {
      tone: 'var(--danger)',
      bg: 'var(--danger-bg)',
      border: '#fecaca',
      label: 'Mapping requis',
      text: mappingCount === 0
        ? 'Mappez au moins un titre, un identifiant ou une URL produit avant de lancer la première synchro.'
        : `Complétez le mapping avec au moins un titre, un identifiant ou une URL produit. Manque actuellement : ${syncCoverage.missing.join(', ')}.`,
      canSync: false,
    };
  }

  if (source.status !== 'ACTIVE') {
    return {
      tone: 'var(--warning)',
      bg: 'var(--warning-bg)',
      border: 'var(--warning)',
      label: 'Source en pause',
      text: `Le mapping est prêt (${mappingCount} champ(s)), mais la source est actuellement en pause.`,
      canSync: true,
    };
  }

  return {
    tone: 'var(--success)',
    bg: 'var(--success-bg)',
    border: '#BBF7D0',
    label: hasAttempt ? 'Prête à resynchroniser' : 'Prête pour la première synchro',
    text: `Flux prêt avec ${mappingCount} champ(s) mappé(s). Vous pouvez synchroniser maintenant ou ouvrir le catalogue.`,
    canSync: true,
  };
}

function getLatestAttemptAt(source: FeedSource, feed?: Feed) {
  return feed?.latestRun?.finishedAt || source.lastRunAt || null;
}

function getSourceAttemptBadge(source: FeedSource, feed?: Feed, locale = 'fr-FR') {
  const latestAttemptAt = getLatestAttemptAt(source, feed);
  const runStatus = feed?.latestRun?.status || null;

  if (!latestAttemptAt && !runStatus) {
    return {
      label: 'Aucune tentative',
      tone: 'var(--ink-2)',
      bg: 'var(--paper-2)',
      border: 'var(--line)',
    };
  }

  if (runStatus === 'FAILED') {
    return {
      label: `Dernière tentative: ${formatSourceDate(latestAttemptAt, locale)}`,
      tone: 'var(--danger)',
      bg: 'var(--danger-bg)',
      border: '#fecaca',
    };
  }

  return {
    label: `Dernière tentative: ${formatSourceDate(latestAttemptAt, locale)}`,
    tone: 'var(--accent-2)',
    bg: 'var(--accent-bg)',
    border: 'var(--accent-bg)',
  };
}

function getLatestRunSummary(feed?: Feed, locale = 'fr-FR') {
  const run = feed?.latestRun;
  if (!run || (!run.finishedAt && !run.status)) return null;

  const finishedAt = formatSourceDate(run.finishedAt ?? null, locale);
  const inserted = Number(run.totalInserted ?? 0);
  const updated = Number(run.totalUpdated ?? 0);
  const fetched = Number(run.totalFetched ?? 0);
  const skipped = Number(run.totalSkipped ?? 0);
  const changed = inserted + updated;

  if (run.status === 'FAILED') {
    return {
      tone: 'var(--danger)',
      bg: 'var(--danger-bg)',
      border: '#fecaca',
      label: 'Dernière synchro en erreur',
      text: run.errorMessage
        ? `${run.errorMessage} • ${finishedAt}`
        : `La dernière synchro a échoué. ${finishedAt}`,
    };
  }

  if (changed > 0) {
    return {
      tone: 'var(--success)',
      bg: 'var(--success-bg)',
      border: '#BBF7D0',
      label: 'Dernière synchro utile',
      text: `${inserted} importé(s), ${updated} mis à jour • ${finishedAt}`,
    };
  }

  if (fetched > 0 || skipped > 0) {
    return {
      tone: 'var(--accent-2)',
      bg: 'var(--accent-bg)',
      border: 'var(--accent-bg)',
      label: 'Dernière synchro sans changement',
      text: `${fetched} ligne(s) lue(s), ${skipped} ignorée(s) • ${finishedAt}`,
    };
  }

  return {
    tone: 'var(--ink-2)',
    bg: 'var(--paper-2)',
    border: 'var(--line-strong)',
    label: 'Dernière synchro',
    text: finishedAt,
  };
}

export default function SourcesPage() {
  const router = useRouter();
  const locale = useLocale();
  const localePrefix = getLocalePrefixForLocale(locale);
  const t = useTranslations("dashboard");
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [runningIngestion, setRunningIngestion] = useState<string | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // État du formulaire CSV
  const [sourceName, setSourceName] = useState('');
  const [csvUrl, setCsvUrl] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('file');
  const [analyzingCsv, setAnalyzingCsv] = useState(false);
  const [csvAnalysis, setCsvAnalysis] = useState<AnalyzeCsvResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mappingOutputChannel, setMappingOutputChannel] = useState<MappingOutputChannel>('gmc');
  const [creatingSource, setCreatingSource] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [modalError, setModalError] = useState<string | null>(null);

  // État pour Shopify OAuth
  const [shopifyShopName, setShopifyShopName] = useState('');
  const [shopifyConnecting, setShopifyConnecting] = useState(false);
  const [shopifyError, setShopifyError] = useState<string | null>(null);
  const [prestashopShopUrl, setPrestashopShopUrl] = useState('');
  const [prestashopApiKey, setPrestashopApiKey] = useState('');

  // État pour modifier le mapping d'une source existante
  const [editMappingFeed, setEditMappingFeed] = useState<Feed | null>(null);
  const [editMappingSource, setEditMappingSource] = useState<FeedSource | null>(null);
  const [editMappingAnalysis, setEditMappingAnalysis] = useState<AnalyzeCsvResponse | null>(null);
  const [editMapping, setEditMapping] = useState<Record<string, string>>({});
  const [editMappingOutputChannel, setEditMappingOutputChannel] = useState<MappingOutputChannel>('gmc');
  const [savingMapping, setSavingMapping] = useState(false);
  const [loadingEditMapping, setLoadingEditMapping] = useState(false);

  // État pour suppression
  const [sourceToDelete, setSourceToDelete] = useState<FeedSource | null>(null);
  const [enrichmentSourceToDelete, setEnrichmentSourceToDelete] = useState<EnrichmentSource | null>(null);
  const [deletingSource, setDeletingSource] = useState(false);

  // État pour sources secondaires d'enrichissement
  const [enrichmentSourcesByFeed, setEnrichmentSourcesByFeed] = useState<Record<string, EnrichmentSource[]>>({});
  const [showAddEnrichmentModal, setShowAddEnrichmentModal] = useState(false);
  const [addEnrichmentFeed, setAddEnrichmentFeed] = useState<Feed | null>(null);
  const [addEnrichmentName, setAddEnrichmentName] = useState('');
  const [addEnrichmentCsvUrl, setAddEnrichmentCsvUrl] = useState('');
  const [addEnrichmentCsvFile, setAddEnrichmentCsvFile] = useState<File | null>(null);
  const [addEnrichmentAnalysis, setAddEnrichmentAnalysis] = useState<AnalyzeCsvResponse | null>(null);
  const [addEnrichmentJoinKey, setAddEnrichmentJoinKey] = useState('originId');
  const [addEnrichmentJoinColumn, setAddEnrichmentJoinColumn] = useState('');
  const [addEnrichmentMapping, setAddEnrichmentMapping] = useState<Record<string, string>>({});
  const [addEnrichmentCreating, setAddEnrichmentCreating] = useState(false);
  const [addEnrichmentAnalyzing, setAddEnrichmentAnalyzing] = useState(false);
  const [applyingEnrichment, setApplyingEnrichment] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const hrefs = sources
      .map((source) => {
        const primaryFeed = feeds.find((feed) => feed.sourceId === source.id);
        return primaryFeed ? buildLocalizedPath(`/catalogue?feed=${primaryFeed.id}`, localePrefix) : null;
      })
      .filter((href): href is string => Boolean(href));

    hrefs.forEach((href) => {
      void router.prefetch(href);
    });
  }, [feeds, localePrefix, router, sources]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncViewport = () => setIsCompactViewport(window.innerWidth < 1180);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  // Toast + refresh au retour OAuth Shopify (lecture client-side pour éviter Suspense)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('shopify') === 'connected') {
      const shop = params.get('shop');
      const guest = params.get('guest');
      if (guest === '1' && shop) {
        apiClient.post('/connectors/shopify/claim', { shop }).then(() => {
          fetchData();
          showToast('Boutique Shopify liée à votre compte. Vous pouvez maintenant synchroniser vos produits.', 'success');
        }).catch(() => {
          fetchData();
          showToast('Boutique Shopify connectée. Si elle n’apparaît pas, réessayez dans un instant.', 'success');
        }).finally(() => {
          window.history.replaceState({}, '', window.location.pathname);
        });
      } else {
        fetchData();
        showToast('Boutique Shopify connectée ! Vous pouvez maintenant synchroniser vos produits.', 'success');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [sourcesResponse, feedsResponse] = await Promise.all([
        apiClient.get<FeedSource[]>('/ingestion/sources').catch(() => ({ data: [] })),
        apiClient.get<Feed[]>('/ingestion/feeds').catch(() => ({ data: [] }))
      ]);
      
      setSources(sourcesResponse.data || []);
      setFeeds(feedsResponse.data || []);
    } catch (err: unknown) {
      console.error('Error fetching data:', err);
      setError(getErrorMessage(err, 'Erreur lors du chargement'));
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerIngestion = async (source: FeedSource, primaryFeed?: Feed) => {
    if (!primaryFeed) {
      showToast(t('sources.noFeedForSource'), 'error');
      return;
    }

    const mappingJson = primaryFeed.mappingJson || {};
    const mappingCount = Object.keys(mappingJson).length;
    const syncCoverage = getSyncKeyCoverage(mappingJson);
    if (mappingCount === 0 || !syncCoverage.hasMinimumSyncFields) {
      showToast(
        mappingCount === 0
          ? 'Complétez d’abord le mapping avant de synchroniser ce flux.'
          : `Complétez le mapping avant synchro. Il manque encore : ${syncCoverage.missing.join(', ')}.`,
        'info'
      );
      await handleOpenEditMapping(source, primaryFeed);
      return;
    }

    try {
      setRunningIngestion(source.id);
      const res = await apiClient.post<{
        message?: string;
        totalFetched?: number;
        totalInserted?: number;
        totalUpdated?: number;
        totalSkipped?: number;
        diagnostic?: { sampleColumns?: string[]; skipReason?: string; skipReasonMessage?: string; mappingKeysCount?: number };
      }>(`/ingestion/feeds/${primaryFeed.id}/runs`, {});
      const data = res.data ?? {};
      const totalFetched = data.totalFetched ?? 0;
      const added = (data.totalInserted ?? 0) + (data.totalUpdated ?? 0);

      if (added > 0 || totalFetched > 0 || (data.totalSkipped ?? 0) > 0) {
        const { message, type } = getIngestionSyncToastMessage(data, 'sources');
        showToast(message, type);
      } else {
        showToast(getIngestionEmptyFileMessage(), 'error');
      }
      setTimeout(() => fetchData(), 2000);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Erreur lors de la synchronisation'), 'error');
    } finally {
      setRunningIngestion(null);
    }
  };

  const handlePauseResumeSource = async (source: FeedSource) => {
    const newStatus = source.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await apiClient.put(`/ingestion/sources/${source.id}`, { status: newStatus });
      showToast(newStatus === 'PAUSED' ? t('sources.sourcePaused') : t('sources.sourceReactivated'), 'success');
      await fetchData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Erreur lors de la mise à jour'), 'error');
    }
  };

  const handleDeleteSource = async () => {
    if (!sourceToDelete) return;
    const deletedId = sourceToDelete.id;
    try {
      setDeletingSource(true);
      await apiClient.delete(`/ingestion/sources/${deletedId}`);
      showToast('Source supprimée', 'success');
      // Suppression optimiste immédiate : retirer du state sans attendre fetchData
      setSources(prev => prev.filter(s => s.id !== deletedId));
      setSourceToDelete(null);
      // Rafraîchissement en arrière-plan pour synchroniser le reste
      fetchData().catch(() => {});
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Erreur lors de la suppression'), 'error');
    } finally {
      setDeletingSource(false);
    }
  };

  const handleOpenEditMapping = async (source: FeedSource, feed: Feed) => {
    setEditMappingFeed(feed);
    setEditMappingSource(source);
    setEditMapping(feed.mappingJson || {});
    setEditMappingAnalysis(null);
    setModalError(null);

    // Ré-analyser le CSV pour obtenir les colonnes (si CSV source)
    const csvUrl =
      typeof source.configJson.csvUrl === 'string' ? source.configJson.csvUrl : undefined;
    if (source.connector === 'CSV' && csvUrl) {
      try {
        setLoadingEditMapping(true);
        const res = await apiClient.post<AnalyzeCsvResponse>('/ingestion/analyze-csv', { csvUrl });
        setEditMappingAnalysis(res.data);
        // Garder le mapping actuel (déjà chargé via setEditMapping)
      } catch {
        // Si erreur, utiliser les colonnes du mapping actuel comme fallback
        const cols = Object.values(feed.mappingJson || {}).filter(Boolean);
        setEditMappingAnalysis({ columns: [...new Set(cols)] as string[], preview: [] });
      } finally {
        setLoadingEditMapping(false);
      }
    } else {
      // Fallback : colonnes dédupliquées du mapping actuel
      const cols = Object.values(feed.mappingJson || {}).filter(Boolean);
      setEditMappingAnalysis({ columns: [...new Set(cols)] as string[], preview: [] });
    }
  };

  const handleSaveMapping = async () => {
    if (!editMappingFeed) return;
    try {
      setSavingMapping(true);
      setModalError(null);
      await apiClient.put(`/ingestion/feeds/${editMappingFeed.id}`, {
        ...editMappingFeed,
        mappingJson: editMapping
      });
      showToast('Mapping mis à jour', 'success');
      setEditMappingFeed(null);
      setEditMappingSource(null);
      setEditMappingAnalysis(null);
      await fetchData();
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, 'Erreur lors de la mise à jour du mapping'));
    } finally {
      setSavingMapping(false);
    }
  };

  const fetchEnrichmentSources = async (feedId: string) => {
    try {
      const res = await apiClient.get<EnrichmentSource[]>(`/ingestion/feeds/${feedId}/enrichment-sources`);
      setEnrichmentSourcesByFeed(prev => ({ ...prev, [feedId]: res.data || [] }));
    } catch {
      setEnrichmentSourcesByFeed(prev => ({ ...prev, [feedId]: [] }));
    }
  };

  const handleExpandSource = (sourceId: string) => {
    const newExpanded = new Set(expandedSources);
    if (expandedSources.has(sourceId)) {
      newExpanded.delete(sourceId);
    } else {
      newExpanded.add(sourceId);
      const sourceFeeds = feeds.filter(f => f.sourceId === sourceId);
      sourceFeeds.forEach(f => fetchEnrichmentSources(f.id));
    }
    setExpandedSources(newExpanded);
  };

  const handleOpenAddEnrichment = (feed: Feed) => {
    setAddEnrichmentFeed(feed);
    setAddEnrichmentName('');
    setAddEnrichmentCsvUrl('');
    setAddEnrichmentCsvFile(null);
    setAddEnrichmentAnalysis(null);
    setAddEnrichmentJoinKey('originId');
    setAddEnrichmentJoinColumn('');
    setAddEnrichmentMapping({});
    setShowAddEnrichmentModal(true);
    setModalError(null);
  };

  const handleAnalyzeEnrichmentCsv = async () => {
    if (!addEnrichmentCsvUrl.trim() && !addEnrichmentCsvFile) {
      setModalError('URL ou fichier requis');
      return;
    }
    try {
      setAddEnrichmentAnalyzing(true);
      setModalError(null);
      let response;
      if (addEnrichmentCsvFile) {
        const formData = new FormData();
        formData.append('file', addEnrichmentCsvFile);
        response = await apiClient.postForm<AnalyzeCsvResponse>('/ingestion/upload-csv', formData);
      } else {
        response = await apiClient.post<AnalyzeCsvResponse>('/ingestion/analyze-csv', { csvUrl: addEnrichmentCsvUrl.trim() });
      }
      setAddEnrichmentAnalysis(response.data);
      setAddEnrichmentMapping(response.data.suggestedMapping || {});
      const cols = response.data?.columns || [];
      if (cols.length > 0) setAddEnrichmentJoinColumn(cols[0]);
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, 'Erreur analyse'));
    } finally {
      setAddEnrichmentAnalyzing(false);
    }
  };

  const handleCreateEnrichmentSource = async () => {
    if (!addEnrichmentFeed || !addEnrichmentName.trim()) {
      setModalError('Nom requis');
      return;
    }
    if (!addEnrichmentAnalysis?.columns) {
      setModalError('Analysez d\'abord le fichier CSV');
      return;
    }
    const csvUrl = addEnrichmentAnalysis.csvUrl || addEnrichmentCsvUrl.trim();
    const gcsPath = addEnrichmentAnalysis.gcsPath || null;
    if (!csvUrl) {
      setModalError('URL du CSV requise');
      return;
    }
    const mapping = Object.fromEntries(Object.entries(addEnrichmentMapping).filter(([, v]) => v));
    if (Object.keys(mapping).length === 0) {
      setModalError('Configurez au moins un champ dans le mapping');
      return;
    }
    try {
      setAddEnrichmentCreating(true);
      setModalError(null);
      await apiClient.post(`/ingestion/feeds/${addEnrichmentFeed.id}/enrichment-sources`, {
        name: addEnrichmentName.trim(),
        configJson: {
          csvUrl,
          gcsPath,
          joinKey: addEnrichmentJoinKey,
          joinColumn: addEnrichmentJoinColumn || addEnrichmentAnalysis.columns?.[0] || addEnrichmentJoinKey
        },
        mappingJson: mapping
      });
      showToast('Source secondaire créée', 'success');
      setShowAddEnrichmentModal(false);
      setAddEnrichmentFeed(null);
      await fetchEnrichmentSources(addEnrichmentFeed.id);
      await fetchData();
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, 'Erreur création'));
    } finally {
      setAddEnrichmentCreating(false);
    }
  };

  const handleApplyEnrichment = async (feedId: string) => {
    try {
      setApplyingEnrichment(feedId);
      const res = await apiClient.post<ApplyEnrichmentResponse>(`/ingestion/feeds/${feedId}/apply-enrichment-sources`);
      showToast(`${res.data?.applied ?? 0} produits enrichis`, 'success');
      await fetchData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Erreur enrichissement'), 'error');
    } finally {
      setApplyingEnrichment(null);
    }
  };

  const handleDeleteEnrichmentSource = async () => {
    if (!enrichmentSourceToDelete) return;
    try {
      await apiClient.delete(`/ingestion/enrichment-sources/${enrichmentSourceToDelete.id}`);
      showToast('Source secondaire supprimée', 'success');
      await fetchEnrichmentSources(enrichmentSourceToDelete.feedId);
      setEnrichmentSourceToDelete(null);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Erreur suppression'), 'error');
    }
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xml') || file.name.endsWith('.tsv') || file.name.endsWith('.txt'))) {
      setCsvFile(file);
      if (!sourceName) {
        // Nettoyer le nom du fichier : enlever UUID, garder partie lisible
        let cleanName = file.name.replace(/\.(csv|xml|tsv|txt)$/i, '');
        // Enlever les UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        cleanName = cleanName.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '');
        // Enlever les caractères spéciaux multiples
        cleanName = cleanName.replace(/[-_]{2,}/g, '-').replace(/^[-_]+|[-_]+$/g, '');
        // Limiter à 50 caractères
        cleanName = cleanName.substring(0, 50);
        setSourceName(cleanName || 'Catalogue importé');
      }
    } else {
      showToast('Format non supporté. Utilisez CSV, XML, TSV ou TXT.', 'error');
    }
  }, [sourceName]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      if (!sourceName) {
        // Nettoyer le nom du fichier
        let cleanName = file.name.replace(/\.(csv|xml|tsv|txt)$/i, '');
        cleanName = cleanName.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '');
        cleanName = cleanName.replace(/[-_]{2,}/g, '-').replace(/^[-_]+|[-_]+$/g, '');
        cleanName = cleanName.substring(0, 50);
        setSourceName(cleanName || 'Catalogue importé');
      }
    }
  };

  const handleAnalyzeCsv = async () => {
    if (uploadMode === 'url' && !csvUrl.trim()) {
      setModalError('Veuillez entrer une URL');
      return;
    }
    if (uploadMode === 'file' && !csvFile) {
      setModalError('Veuillez sélectionner un fichier');
      return;
    }

    try {
      setAnalyzingCsv(true);
      setModalError(null);

      let response: { data: AnalyzeCsvResponse };
      
      // Si mode fichier, uploader vers le nouveau endpoint
      if (uploadMode === 'file' && csvFile) {
        const formData = new FormData();
        formData.append('file', csvFile);
        response = await apiClient.postForm<AnalyzeCsvResponse>('/ingestion/upload-csv', formData);
      } else {
        // Mode URL : utiliser l'endpoint existant
        response = await apiClient.post<AnalyzeCsvResponse>('/ingestion/analyze-csv', { csvUrl: csvUrl.trim() });
      }

      setCsvAnalysis(response.data);
      setMapping(response.data.suggestedMapping || {});
      
      // Si upload de fichier, sauvegarder l'URL retournée
      if (uploadMode === 'file' && response.data.csvUrl) {
        setCsvUrl(response.data.csvUrl);
      }
    } catch (err: unknown) {
      console.error('Error analyzing CSV:', err);
      setModalError(getErrorMessage(err, 'Erreur lors de l\'analyse du fichier'));
    } finally {
      setAnalyzingCsv(false);
    }
  };

  const resetModal = () => {
    setShowCreateModal(false);
    setSelectedConnector(null);
    setSourceName('');
    setCsvUrl('');
    setCsvFile(null);
    setCsvAnalysis(null);
    setMapping({});
    setModalError(null);
    setShopifyShopName('');
    setShopifyConnecting(false);
    setShopifyError(null);
    setPrestashopShopUrl('');
    setPrestashopApiKey('');
  };

  const handleShopifyConnect = async () => {
    const normalizedShop = shopifyShopName
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .replace(/\.myshopify\.com$/i, '');
    if (!normalizedShop) {
      setShopifyError('Veuillez entrer le nom de votre boutique');
      return;
    }
    const isValidShop = /^[a-z0-9-]+$/i.test(normalizedShop);
    if (!isValidShop) {
      setShopifyError('Utilisez le sous-domaine Shopify, par ex. ma-boutique ou ma-boutique.myshopify.com.');
      return;
    }
    setShopifyConnecting(true);
    setShopifyError(null);
    try {
      const currentParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const response = await apiClient.post<{ url: string }>('/connectors/shopify/connect', {
        shop: normalizedShop,
        locale,
        host: currentParams?.get('host') || '',
      });
      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error('URL de connexion non reçue');
      }
    } catch (err: unknown) {
      setShopifyError(getErrorMessage(err, 'Erreur lors de la connexion à Shopify'));
    } finally {
      setShopifyConnecting(false);
    }
  };

  const handleCreateSource = async () => {
    if (!sourceName.trim()) {
      setModalError('Veuillez entrer un nom pour la source');
      return;
    }

    if (selectedConnector === 'csv' && !csvAnalysis) {
      setModalError('Veuillez d\'abord analyser le fichier CSV');
      return;
    }

    if (selectedConnector === 'prestashop') {
      if (!prestashopShopUrl.trim()) {
        setModalError('Veuillez renseigner l’URL de la boutique PrestaShop');
        return;
      }
      if (!prestashopApiKey.trim()) {
        setModalError('Veuillez renseigner la clé API webservice PrestaShop');
        return;
      }
    }

    try {
      setCreatingSource(true);
      setModalError(null);

      const normalizedPrestashopUrl = normalizeConnectorUrl(prestashopShopUrl);
      const configJson = selectedConnector === 'prestashop'
        ? {
            shopUrl: normalizedPrestashopUrl,
            apiKey: prestashopApiKey.trim(),
          }
        : {
            csvUrl: csvAnalysis?.csvUrl || csvUrl.trim() || null,
            gcsPath: csvAnalysis?.gcsPath || null
          };

      const response = await apiClient.post<CreateSourceResponse>('/ingestion/sources', {
        name: sourceName.trim(),
        connector: selectedConnector?.toUpperCase(),
        configJson,
        defaultFreq: 'DAILY',
        status: 'ACTIVE',
        feedMappingJson: selectedConnector === 'csv' && Object.keys(mapping).length > 0 ? mapping : undefined
      });

      // Le flux est créé automatiquement par le backend (avec le mapping si envoyé ci-dessus)
      const feedsResponse = await apiClient.get<Feed[]>('/ingestion/feeds');
      const createdFeed = feedsResponse.data.find(f => f.sourceId === response.data.id);

      if (createdFeed && Object.keys(mapping).length > 0) {
        try {
          await apiClient.put(`/ingestion/feeds/${createdFeed.id}`, {
            ...createdFeed,
            mappingJson: mapping
          });
        } catch (putErr: unknown) {
          console.warn('Mise à jour du mapping du flux (fallback):', putErr);
          showToast('Source créée. Si le catalogue reste vide après synchro, modifiez le mapping du flux.', 'info');
        }
      }

      resetModal();
      await fetchData();
      showToast('Source créée avec succès ! Le flux a été configuré automatiquement.', 'success');

      // Rediriger vers le catalogue avec le nouveau flux pour lancer la synchronisation
      if (createdFeed?.id) {
        router.push(buildLocalizedPath(`/catalogue?feed=${createdFeed.id}`, localePrefix));
      }
    } catch (err: unknown) {
      console.error('Error creating source:', err);
      setModalError(getErrorMessage(err, 'Erreur lors de la création de la source'));
    } finally {
      setCreatingSource(false);
    }
  };

  const connectors = [
    { id: 'csv', name: 'Fichier CSV/XML', icon: FileText, available: true, description: 'Importez via fichier ou URL' },
    { id: 'shopify', name: 'Shopify', icon: ShoppingCart, available: true, description: 'Connexion OAuth en un clic pour importer vos produits' },
    { id: 'prestashop', name: 'PrestaShop', icon: Globe, available: true, description: 'Connexion via URL de boutique et clé API webservice' },
    { id: 'erp', name: 'ERP', icon: Database, available: false, description: 'Bientôt disponible' },
    { id: 'pim', name: 'PIM', icon: Globe, available: false, description: 'Bientôt disponible' }
  ];

  const totalSources = sources.length;
  const activeSources = sources.filter(s => s.status === 'ACTIVE').length;
  const sourcesReadyToSync = sources.reduce((count, source) => {
    const primaryFeed = feeds.find((feed) => feed.sourceId === source.id);
    return count + (getSourceReadiness(source, primaryFeed).canSync ? 1 : 0);
  }, 0);
  const sourcesNeedingMapping = sources.reduce((count, source) => {
    const primaryFeed = feeds.find((feed) => feed.sourceId === source.id);
    return count + (primaryFeed && Object.keys(primaryFeed.mappingJson || {}).length === 0 ? 1 : 0);
  }, 0);
  const csvNameReady = sourceName.trim().length > 0;
  const csvInputReady = uploadMode === 'url' ? csvUrl.trim().length > 0 : Boolean(csvFile);
  const csvAnalysisReady = Boolean(csvAnalysis);
  const csvCurrentStep = csvAnalysisReady ? 3 : csvInputReady ? 2 : 1;
  const csvSteps = [
    { id: 1, title: 'Nommer la source', description: 'Choisis un nom interne pour retrouver ce catalogue.' },
    { id: 2, title: 'Ajouter le fichier', description: uploadMode === 'file' ? 'Dépose un CSV/XML ou choisis un fichier.' : 'Renseigne une URL publique vers le fichier.' },
    { id: 3, title: 'Vérifier le mapping', description: 'Contrôle les colonnes détectées avant la création.' },
  ];
  const csvNextAction = !csvNameReady
    ? 'Renseigne d’abord un nom de source.'
    : !csvInputReady
      ? uploadMode === 'file'
        ? 'Ajoute un fichier pour lancer l’analyse.'
        : 'Ajoute une URL de fichier pour lancer l’analyse.'
      : !csvAnalysisReady
        ? 'Analyse le fichier pour préremplir le mapping.'
        : 'Vérifie le mapping puis crée la source.';
  const fieldsForSelectedChannel = getMappingFieldsForChannel(mappingOutputChannel);
  const requiredFieldsForSelectedChannel = fieldsForSelectedChannel.filter((field) => field.required);
  const mappedColumns = new Set(Object.values(mapping).filter(Boolean));
  const csvUnmappedColumns = (csvAnalysis?.columns ?? []).filter((col) => !mappedColumns.has(col));
  const mappedRequiredCount = requiredFieldsForSelectedChannel.filter(({ key }) => Boolean(mapping[key])).length;
  const missingRequiredFields = requiredFieldsForSelectedChannel.filter(({ key }) => !mapping[key]);
  const csvMappingHasCoverage = Object.keys(mapping).length > 0;
  const customMappings = Object.entries(mapping).filter(([target, column]) => Boolean(column) && isCustomMappingTarget(target));
  const editCustomMappings = Object.entries(editMapping).filter(([target, column]) => Boolean(column) && isCustomMappingTarget(target));
  const enrichmentCustomMappings = Object.entries(addEnrichmentMapping).filter(([target, column]) => Boolean(column) && isCustomMappingTarget(target));

  return (
    <PageLayout>
      <ConfirmDialog
        open={Boolean(enrichmentSourceToDelete)}
        onOpenChange={(open) => {
          if (!open) setEnrichmentSourceToDelete(null);
        }}
        title="Supprimer cette source secondaire ?"
        description={enrichmentSourceToDelete ? `La source secondaire « ${enrichmentSourceToDelete.name} » sera définitivement supprimée.` : ''}
        confirmLabel="Supprimer"
        destructive
        onConfirm={handleDeleteEnrichmentSource}
      />
      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 100,
          padding: '14px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: '480px', maxHeight: '85vh',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          backgroundColor: toast.type === 'success' ? 'var(--success-bg)' : toast.type === 'error' ? 'var(--danger-bg)' : 'var(--accent-bg)',
          border: `1px solid ${toast.type === 'success' ? '#BBF7D0' : toast.type === 'error' ? '#fecaca' : 'var(--accent-bg)'}`,
          color: toast.type === 'success' ? 'var(--success)' : toast.type === 'error' ? 'var(--danger)' : 'var(--accent-2)',
          animation: 'fadeIn 0.3s ease'
        }}>
          {toast.type === 'success' ? <CheckCircle style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: 2 }} /> :
           toast.type === 'error' ? <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: 2 }} /> : null}
          <span style={{ flex: 1, whiteSpace: 'pre-line', overflowY: 'auto', maxHeight: '70vh' }}>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, opacity: 0.6 }}>
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      )}

      <PageHeader
        title={t("sources.title")}
        subtitle={t("sources.subtitle")}
        actions={
          <PageButtonPrimary onClick={() => setShowCreateModal(true)}>
            <Plus style={{ width: 16, height: 16 }} />
            Connecter une source
          </PageButtonPrimary>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <DashboardStatGrid>
          <DashboardStatCard
            icon={<Database size={20} />}
            label="Sources connectees"
            value={loading ? '...' : totalSources}
            hint={!loading && activeSources > 0 ? `${activeSources} active${activeSources > 1 ? 's' : ''}` : 'Aucune source active pour le moment'}
            accent="var(--ink)"
          />
          <DashboardStatCard
            icon={<RefreshCw size={20} />}
            label="Prêtes à synchroniser"
            value={loading ? '...' : sourcesReadyToSync}
            hint={loading ? '...' : sourcesNeedingMapping > 0 ? `${sourcesNeedingMapping} mapping(s) à compléter` : 'Toutes les sources configurées sont prêtes'}
            accent="var(--ink)"
          />
          <DashboardStatCard
            icon={<Layers size={20} />}
            label="Sources secondaires"
            value={Object.values(enrichmentSourcesByFeed).reduce((sum, list) => sum + list.length, 0)}
            hint="Attributs additionnels relies au catalogue principal"
            accent="var(--ink)"
          />
        </DashboardStatGrid>

        <PageCard style={{ padding: '20px 22px', border: '1px solid rgba(226,232,240,0.9)', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', flexDirection: isCompactViewport ? 'column' : 'row', alignItems: isCompactViewport ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ maxWidth: '760px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: '10px' }}>
                Workflow source
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                Connectez une boutique ou un fichier, validez le mapping puis synchronisez le catalogue.
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--ink-3)' }}>
                Le parcours recommandé reste simple : connexion, analyse, mapping, puis première synchronisation.
              </div>
            </div>
            <PageButtonSecondary onClick={() => setShowCreateModal(true)}>
              <Plus style={{ width: 16, height: 16 }} />
              Nouvelle connexion
            </PageButtonSecondary>
          </div>
        </PageCard>
      </div>

      {error && <PageError message={error} />}

      {/* Liste des sources */}
      {loading ? (
        <PageLoading message="Chargement des sources…" />
      ) : sources.length === 0 ? (
        <EmptyState
          icon={Database}
          title={t("sources.noSources")}
          description={t("sources.connectSource")}
          action={
            <PageButtonPrimary onClick={() => setShowCreateModal(true)}>
              <Plus style={{ width: 16, height: 16 }} />
              Connecter une source
            </PageButtonPrimary>
          }
        />
      ) : (
        <div style={{ display: 'grid', gap: '18px' }}>
          {sources.map(source => {
            const sourceFeeds = feeds.filter(f => f.sourceId === source.id);
            const isExpanded = expandedSources.has(source.id);
            const primaryFeed = sourceFeeds[0];
            const mappingCount = Object.keys(primaryFeed?.mappingJson || {}).length;
            const sourceGuidance = getSourceReadiness(source, primaryFeed);
            const latestRunSummary = getLatestRunSummary(primaryFeed, locale || 'fr-FR');
            const attemptBadge = getSourceAttemptBadge(source, primaryFeed, locale || 'fr-FR');
            const hasPreviousAttempt = Boolean(primaryFeed?.latestRun?.status || primaryFeed?.latestRun?.finishedAt || source.lastRunAt);
            const isSyncing = runningIngestion === source.id;

            return (
              <PageCard
                key={source.id}
                style={{
                  padding: '20px',
                  border: isSyncing ? '1px solid rgba(37,99,235,0.35)' : '1px solid rgba(226,232,240,0.9)',
                  boxShadow: isSyncing ? '0 14px 36px rgba(37,99,235,0.12)' : '0 10px 28px rgba(15,23,42,0.04)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {isSyncing && (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: '-35%',
                        width: '35%',
                        height: '3px',
                        background: 'linear-gradient(90deg, rgba(59,130,246,0), rgba(59,130,246,0.95), rgba(125,211,252,0.9))',
                        animation: 'sourceSyncProgress 1.6s ease-in-out infinite'
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 'inherit',
                        pointerEvents: 'none',
                        boxShadow: 'inset 0 0 0 1px rgba(147,197,253,0.25)',
                        animation: 'sourceSyncPulse 2s ease-in-out infinite'
                      }}
                    />
                  </>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: sourceFeeds.length > 0 && isExpanded ? '16px' : '0' }}>
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>{source.name}</h3>
                      <StatusBadge variant={source.status === 'ACTIVE' ? 'success' : 'error'}>
                        {source.status === 'ACTIVE' ? 'Actif' : 'En pause'}
                      </StatusBadge>
                      {isSyncing && (
                        <span
                          style={{
                            padding: '5px 10px',
                            borderRadius: '999px',
                            backgroundColor: 'var(--accent-bg)',
                            border: '1px solid var(--accent-bg)',
                            color: 'var(--accent-2)',
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <RefreshCw style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                          Synchronisation en cours
                        </span>
                      )}
                      {sourceFeeds.length > 0 && (
                        <span style={{ padding: '5px 10px', borderRadius: '999px', backgroundColor: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)', fontSize: '12px', fontWeight: 500 }}>
                          {sourceFeeds.length} flux
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                      <span style={{ padding: '5px 10px', borderRadius: '999px', backgroundColor: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)', fontSize: '12px', fontWeight: 500 }}>
                        {source.connector}
                      </span>
                      <span style={{ padding: '5px 10px', borderRadius: '999px', backgroundColor: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)', fontSize: '12px', fontWeight: 500 }}>
                        {formatSourceFrequency(source.defaultFreq)}
                      </span>
                      <span
                        style={{
                          padding: '5px 10px',
                          borderRadius: '999px',
                          backgroundColor: attemptBadge.bg,
                          border: `1px solid ${attemptBadge.border}`,
                          color: attemptBadge.tone,
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                      >
                        {attemptBadge.label}
                      </span>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: 0 }}>
                      {sourceFeeds.length > 0
                        ? 'Le flux principal est déjà relié à cette source. Vous pouvez compléter le mapping, synchroniser ou ouvrir le catalogue.'
                        : 'Terminez la configuration pour créer le premier flux exploitable depuis cette source.'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {sourceFeeds.length > 0 && (
                      <button
                        onClick={() => handlePauseResumeSource(source)}
                        title={source.status === 'ACTIVE' ? 'Mettre en pause' : 'Reprendre'}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--line)',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {source.status === 'ACTIVE' ? <Pause style={{ width: '14px', height: '14px' }} /> : <Play style={{ width: '14px', height: '14px' }} />}
                        {source.status === 'ACTIVE' ? 'Pause' : 'Reprendre'}
                      </button>
                    )}
                    {sourceFeeds.length > 0 && (
                      mappingCount > 0 ? (
                        <button
                          onClick={() => handleTriggerIngestion(source, primaryFeed)}
                          disabled={isSyncing}
                          style={{
                          padding: '8px 12px',
                          backgroundColor: isSyncing ? 'var(--accent-2)' : '#0a0a0a',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: isSyncing ? 'not-allowed' : 'pointer',
                          color: '#ffffff',
                          fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: isSyncing ? '0 10px 24px rgba(37,99,235,0.22)' : 'none'
                          }}
                        >
                          {isSyncing ? <RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <Play style={{ width: '14px', height: '14px' }} />}
                          {isSyncing ? 'Synchronisation...' : hasPreviousAttempt ? 'Resynchroniser' : 'Synchroniser'}
                        </button>
                      ) : (
                        <PageButtonSecondary onClick={() => primaryFeed && handleOpenEditMapping(source, primaryFeed)}>
                          <Settings style={{ width: '14px', height: '14px' }} />
                          Compléter le mapping
                        </PageButtonSecondary>
                      )
                    )}
                    {sourceFeeds.length > 0 && (
                      <button
                        onClick={() => handleOpenEditMapping(source, sourceFeeds[0])}
                        title="Modifier le mapping"
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--line)',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Settings style={{ width: '14px', height: '14px' }} />
                        Mapping
                      </button>
                    )}
                    <button
                      onClick={() => setSourceToDelete(source)}
                      title="Supprimer la source"
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #fecaca',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: 'var(--danger)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                    </button>
                    {sourceFeeds.length > 0 && primaryFeed && (() => {
                      const catalogueHref = buildLocalizedPath(`/catalogue?feed=${primaryFeed.id}`, localePrefix);
                      return (
                        <PageButtonSecondary
                          onClick={() => router.push(catalogueHref)}
                          onMouseEnter={() => void router.prefetch(catalogueHref)}
                          onFocus={() => void router.prefetch(catalogueHref)}
                        >
                          Voir le catalogue
                        </PageButtonSecondary>
                      );
                    })()}
                    {sourceFeeds.length > 0 && (
                      <button
                        onClick={() => handleExpandSource(source.id)}
                        style={{
                        padding: '8px 12px',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--line)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                      >
                        {isExpanded ? <ChevronUp style={{ width: '16px', height: '16px' }} /> : <ChevronDown style={{ width: '16px', height: '16px' }} />}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: latestRunSummary && !isCompactViewport ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr',
                  gap: '10px',
                  marginTop: '14px'
                }}>
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: `1px solid ${isSyncing ? 'var(--accent-bg)' : sourceGuidance.border}`,
                    backgroundColor: isSyncing ? 'var(--accent-bg)' : sourceGuidance.bg,
                    color: isSyncing ? 'var(--accent-2)' : sourceGuidance.tone
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                      {isSyncing ? 'Synchronisation en cours' : sourceGuidance.label}
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: 1.55 }}>
                      {isSyncing
                        ? 'Le flux est en train de relire le catalogue et de comparer les produits avec la dernière version connue.'
                        : sourceGuidance.text}
                    </div>
                  </div>

                  {latestRunSummary && (
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: `1px solid ${latestRunSummary.border}`,
                      backgroundColor: latestRunSummary.bg,
                      color: latestRunSummary.tone
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                        {latestRunSummary.label}
                      </div>
                      <div style={{ fontSize: '13px', lineHeight: 1.55 }}>
                        {latestRunSummary.text}
                      </div>
                    </div>
                  )}
                </div>

                {/* Détails du flux (expandable) */}
                {isExpanded && sourceFeeds.length > 0 && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
                    {sourceFeeds.map(feed => {
                      const enrichmentList = enrichmentSourcesByFeed[feed.id] || [];
                      return (
                        <div key={feed.id} style={{ padding: '14px', backgroundColor: 'var(--paper-2)', borderRadius: '12px', marginBottom: '12px', border: '1px solid var(--line)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '12px', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)', marginBottom: '4px' }}>
                                {feed.name}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
                                Mapping: {Object.keys(feed.mappingJson || {}).length} champs
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleOpenEditMapping(source, feed)}
                                style={{ padding: '6px 10px', fontSize: '12px', backgroundColor: 'white', border: '1px solid var(--line)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Settings style={{ width: '12px', height: '12px' }} />
                                Mapping
                              </button>
                              <button
                                onClick={() => handleOpenAddEnrichment(feed)}
                                style={{ padding: '6px 10px', fontSize: '12px', backgroundColor: 'white', border: '1px solid #0a0a0a', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Layers style={{ width: '12px', height: '12px' }} />
                                Source secondaire
                              </button>
                            </div>
                          </div>
                          {enrichmentList.length > 0 && (
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', marginBottom: '6px' }}>
                                Sources secondaires ({enrichmentList.length})
                              </div>
                              {enrichmentList.map(es => (
                                <div key={es.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: 'white', borderRadius: '8px', marginBottom: '6px', fontSize: '13px', gap: '12px', flexWrap: 'wrap' }}>
                                  <div>
                                    <span style={{ fontWeight: '500' }}>{es.name}</span>
                                    <span style={{ color: 'var(--ink-3)', marginLeft: '8px' }}>
                                      {Object.keys(es.mappingJson || {}).length} champs • {es.lastSyncAt ? `Sync: ${new Date(es.lastSyncAt).toLocaleDateString('fr-FR')}` : 'Jamais sync'}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      onClick={() => handleApplyEnrichment(feed.id)}
                                      disabled={applyingEnrichment === feed.id}
                                      style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid var(--line)', borderRadius: '6px', cursor: applyingEnrichment === feed.id ? 'not-allowed' : 'pointer', backgroundColor: 'white' }}
                                    >
                                      {applyingEnrichment === feed.id ? '…' : 'Appliquer'}
                                    </button>
                                    <button
                                      onClick={() => setEnrichmentSourceToDelete(es)}
                                      style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid #fecaca', color: 'var(--danger)', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white' }}
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </PageCard>
            );
          })}
        </div>
      )}
      <style jsx global>{`
        @keyframes sourceSyncPulse {
          0% { opacity: 0.25; }
          50% { opacity: 0.55; }
          100% { opacity: 0.25; }
        }

        @keyframes sourceSyncProgress {
          0% { transform: translateX(0); }
          100% { transform: translateX(390%); }
        }
      `}</style>

      {/* Modal de création — sélection du connecteur */}
      {showCreateModal && !selectedConnector && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => resetModal()}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '8px', maxWidth: '800px', width: '90%', maxHeight: '80vh', overflow: 'auto', padding: '32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>Sélectionnez un connecteur</h2>
              <button onClick={() => resetModal()} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: '24px', height: '24px', color: 'var(--ink-3)' }} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {connectors.map(connector => {
                const Icon = connector.icon;
                return (
                  <div
                    key={connector.id}
                    onClick={() => connector.available && setSelectedConnector(connector.id)}
                    style={{
                      border: '2px solid var(--line)',
                      borderRadius: '8px',
                      padding: '20px',
                      cursor: connector.available ? 'pointer' : 'not-allowed',
                      opacity: connector.available ? 1 : 0.5,
                      backgroundColor: connector.available ? 'white' : 'var(--paper-2)',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    {!connector.available && (
                      <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'var(--warning)', color: 'var(--warning)', fontSize: '10px', fontWeight: '600', padding: '4px 8px', borderRadius: '4px' }}>
                        Bientôt
                      </div>
                    )}
                    <Icon style={{ width: '32px', height: '32px', color: connector.available ? '#0a0a0a' : 'var(--ink-4)', marginBottom: '12px' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: connector.available ? 'var(--ink)' : 'var(--ink-4)', marginBottom: '4px' }}>
                      {connector.name}
                    </h3>
                    <p style={{ fontSize: '13px', color: connector.available ? 'var(--ink-3)' : 'var(--ink-4)', margin: 0 }}>
                      {connector.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de connexion Shopify */}
      {showCreateModal && selectedConnector === 'shopify' && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}
          onClick={() => resetModal()}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '8px', maxWidth: '500px', width: '100%', padding: '32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>Connecter Shopify</h2>
                <p style={{ fontSize: '14px', color: 'var(--ink-3)', marginTop: '4px' }}>Connexion OAuth en un clic pour importer vos produits</p>
              </div>
              <button onClick={() => resetModal()} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: '24px', height: '24px' }} />
              </button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => { setSelectedConnector(null); setShopifyError(null); }}
                style={{ background: 'none', border: '1px solid var(--line)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--ink-3)', marginBottom: '20px' }}
              >
                <ArrowLeft style={{ width: '14px', height: '14px' }} />
                Retour
              </button>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '8px' }}>
                Nom de votre boutique Shopify
              </label>
              <input
                type="text"
                value={shopifyShopName}
                onChange={(e) => setShopifyShopName(e.target.value)}
                placeholder="ma-boutique"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: shopifyError ? '2px solid var(--danger)' : '1px solid var(--line)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '6px' }}>
                Exemple : vous pouvez saisir ma-boutique, ma-boutique.myshopify.com ou l’URL directe de la boutique
              </p>
            </div>
            {shopifyError && (
              <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: 'var(--danger)', fontSize: '14px', marginBottom: '16px' }}>
                {shopifyError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => resetModal()}
                style={{ padding: '10px 20px', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', backgroundColor: 'white', color: 'var(--ink-3)' }}
              >
                Annuler
              </button>
              <button
                onClick={handleShopifyConnect}
                disabled={shopifyConnecting || !shopifyShopName.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: shopifyConnecting || !shopifyShopName.trim() ? 'var(--ink-4)' : '#0a0a0a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: shopifyConnecting || !shopifyShopName.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {shopifyConnecting ? (
                  <>
                    <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                    Connexion…
                  </>
                ) : (
                  <>
                    <ShoppingCart style={{ width: '16px', height: '16px' }} />
                    Continuer avec Shopify
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && selectedConnector === 'prestashop' && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}
          onClick={() => resetModal()}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '8px', maxWidth: '560px', width: '100%', padding: '32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>Connecter PrestaShop</h2>
                <p style={{ fontSize: '14px', color: 'var(--ink-3)', marginTop: '4px' }}>Connexion via URL de boutique et clé API webservice</p>
              </div>
              <button onClick={() => resetModal()} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: '24px', height: '24px' }} />
              </button>
            </div>

            <button
              onClick={() => { setSelectedConnector(null); setModalError(null); }}
              style={{ background: 'none', border: '1px solid var(--line)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--ink-3)', marginBottom: '20px' }}
            >
              <ArrowLeft style={{ width: '14px', height: '14px' }} />
              Retour
            </button>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '8px' }}>
                  Nom de la source
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="Catalogue PrestaShop principal"
                  style={{ width: '100%', padding: '12px', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '8px' }}>
                  URL de la boutique
                </label>
                <input
                  type="url"
                  value={prestashopShopUrl}
                  onChange={(e) => setPrestashopShopUrl(e.target.value)}
                  placeholder="https://ma-boutique.com"
                  style={{ width: '100%', padding: '12px', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '8px' }}>
                  Clé API webservice
                </label>
                <input
                  type="password"
                  value={prestashopApiKey}
                  onChange={(e) => setPrestashopApiKey(e.target.value)}
                  placeholder="Votre clé API PrestaShop"
                  style={{ width: '100%', padding: '12px', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                />
                <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '6px', lineHeight: 1.5 }}>
                  Activez le webservice PrestaShop et autorisez au minimum la lecture sur la ressource produits.
                </p>
              </div>
            </div>

            {modalError && (
              <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: 'var(--danger)', fontSize: '14px', marginTop: '16px' }}>
                {modalError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                onClick={() => resetModal()}
                style={{ padding: '10px 20px', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', backgroundColor: 'white', color: 'var(--ink-3)' }}
              >
                Annuler
              </button>
              <button
                onClick={handleCreateSource}
                disabled={creatingSource || !sourceName.trim() || !prestashopShopUrl.trim() || !prestashopApiKey.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: (creatingSource || !sourceName.trim() || !prestashopShopUrl.trim() || !prestashopApiKey.trim()) ? 'var(--ink-4)' : '#0a0a0a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (creatingSource || !sourceName.trim() || !prestashopShopUrl.trim() || !prestashopApiKey.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {creatingSource ? 'Création en cours...' : 'Créer la source'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de configuration CSV */}
      {showCreateModal && selectedConnector === 'csv' && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: isCompactViewport ? '12px' : '20px' }}
          onClick={() => resetModal()}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '8px', width: 'min(1100px, 100%)', maxHeight: 'calc(100vh - 24px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header avec bouton retour */}
            <div style={{ padding: isCompactViewport ? '18px' : '24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: isCompactViewport ? 'flex-start' : 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: isCompactViewport ? 'flex-start' : 'center', gap: '12px', flexWrap: 'wrap', minWidth: 0 }}>
                <button 
                  onClick={() => { setSelectedConnector(null); setCsvAnalysis(null); setModalError(null); }}
                  style={{ background: 'none', border: '1px solid var(--line)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--ink-3)' }}
                >
                  <ArrowLeft style={{ width: '14px', height: '14px' }} />
                  Retour
                </button>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>Import CSV/XML</h2>
                  <p style={{ fontSize: '14px', color: 'var(--ink-3)', marginTop: '4px' }}>Importez via fichier ou URL publique</p>
                </div>
              </div>
              <button onClick={() => resetModal()} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: '24px', height: '24px' }} />
              </button>
            </div>

            <div style={{ padding: isCompactViewport ? '16px' : '24px', overflowY: 'auto', overflowX: 'hidden' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isCompactViewport ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                gap: '12px',
                marginBottom: '24px'
              }}>
                {csvSteps.map((step) => {
                  const isDone = csvCurrentStep > step.id;
                  const isActive = csvCurrentStep === step.id;
                  return (
                    <div
                      key={step.id}
                      style={{
                        border: `1px solid ${isActive ? 'var(--accent-bg)' : isDone ? '#BBF7D0' : 'var(--line)'}`,
                        backgroundColor: isActive ? 'var(--accent-bg)' : isDone ? 'var(--success-bg)' : 'var(--paper-2)',
                        borderRadius: '10px',
                        padding: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '999px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '700',
                          backgroundColor: isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--line)',
                          color: isDone || isActive ? '#ffffff' : 'var(--ink-3)'
                        }}>
                          {isDone ? '✓' : step.id}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink)' }}>{step.title}</div>
                      </div>
                      <div style={{ fontSize: '12px', lineHeight: 1.45, color: 'var(--ink-3)' }}>{step.description}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{
                border: '1px solid var(--line)',
                backgroundColor: '#fafafa',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                    Étape en cours
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--ink)', marginBottom: '2px' }}>
                    {csvSteps[csvCurrentStep - 1]?.title}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--ink-3)' }}>{csvNextAction}</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
                  {csvAnalysisReady ? 'Analyse prête' : 'Création bloquée tant que le fichier n’est pas analysé'}
                </div>
              </div>

              {/* Nom de la source */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '8px' }}>
                  Nom de la source *
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="Ex: Catalogue principal"
                  style={{ width: '100%', padding: '12px', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              {/* Toggle URL vs File */}
              <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setUploadMode('file')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: uploadMode === 'file' ? '#0a0a0a' : 'white',
                    color: uploadMode === 'file' ? 'white' : 'var(--ink-3)',
                    border: '1px solid var(--line)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  <Upload style={{ width: '14px', height: '14px', display: 'inline', marginRight: '6px' }} />
                  Uploader un fichier
                </button>
                <button
                  onClick={() => setUploadMode('url')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: uploadMode === 'url' ? '#0a0a0a' : 'white',
                    color: uploadMode === 'url' ? 'white' : 'var(--ink-3)',
                    border: '1px solid var(--line)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  <LinkIcon style={{ width: '14px', height: '14px', display: 'inline', marginRight: '6px' }} />
                  URL publique
                </button>
              </div>

              {/* Zone de drag & drop ou URL */}
              {uploadMode === 'file' ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  style={{
                    border: '2px dashed var(--line-strong)',
                    borderRadius: '8px',
                    padding: isCompactViewport ? '24px 16px' : '40px',
                    textAlign: 'center',
                    backgroundColor: csvFile ? 'var(--success-bg)' : '#fafafa',
                    marginBottom: '24px',
                    cursor: 'pointer'
                  }}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  {csvFile ? (
                    <>
                      <CheckCircle style={{ width: '48px', height: '48px', color: 'var(--success)', margin: '0 auto 12px' }} />
                      <p style={{ fontSize: '16px', fontWeight: '500', color: 'var(--success)', marginBottom: '4px' }}>{csvFile.name}</p>
                      <p style={{ fontSize: '14px', color: 'var(--ink-3)' }}>{(csvFile.size / 1024).toFixed(0)} KB</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCsvFile(null); }}
                        style={{ marginTop: '12px', padding: '6px 12px', backgroundColor: 'var(--danger)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Supprimer
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload style={{ width: '48px', height: '48px', color: 'var(--ink-4)', margin: '0 auto 12px' }} />
                      <p style={{ fontSize: '16px', fontWeight: '500', color: 'var(--ink)', marginBottom: '4px' }}>
                        Glissez-déposez votre fichier ici
                      </p>
                      <p style={{ fontSize: '14px', color: 'var(--ink-3)' }}>ou cliquez pour parcourir</p>
                      <p style={{ fontSize: '12px', color: 'var(--ink-4)', marginTop: '8px' }}>Formats supportés: CSV, XML, TSV, TXT</p>
                    </>
                  )}
                  <input
                    id="file-input"
                    type="file"
                    accept=".csv,.xml,.tsv,.txt"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '8px' }}>
                    URL du fichier CSV/XML *
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                    <input
                      type="url"
                      value={csvUrl}
                      onChange={(e) => setCsvUrl(e.target.value)}
                      placeholder="https://example.com/products.csv"
                      style={{ flex: 1, padding: '12px', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '14px' }}
                    />
                  </div>
                </div>
              )}

              {/* Erreur dans la modale */}
              {modalError && (
                <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px', color: 'var(--danger)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                  {modalError}
                </div>
              )}

              {/* Bouton Analyser */}
              {((uploadMode === 'url' && csvUrl.trim()) || (uploadMode === 'file' && csvFile)) && (
                <button
                  onClick={() => { setCsvAnalysis(null); setModalError(null); handleAnalyzeCsv(); }}
                  disabled={analyzingCsv}
                  style={{
                    width: '100%',
                    padding: '14px',
                    backgroundColor: analyzingCsv ? 'var(--line)' : csvAnalysis ? 'var(--paper-2)' : '#0a0a0a',
                    color: csvAnalysis ? 'var(--ink-2)' : 'white',
                    border: csvAnalysis ? '1px solid var(--line-strong)' : 'none',
                    borderRadius: '6px',
                    fontSize: '15px',
                    fontWeight: '500',
                    cursor: analyzingCsv ? 'not-allowed' : 'pointer',
                    marginBottom: '24px'
                  }}
                >
                  {analyzingCsv ? 'Analyse en cours...' : csvAnalysis ? 'Relancer l’analyse du fichier' : 'Analyser le fichier et préparer le mapping'}
                </button>
              )}

              {/* Résultat du mapping auto avec possibilité de modification */}
              {csvAnalysis && (
                <div style={{ backgroundColor: 'var(--success-bg)', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <CheckCircle style={{ width: '20px', height: '20px', color: 'var(--success)' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--success)', margin: 0 }}>
                      Analyse terminée
                    </h3>
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--success)', marginBottom: '16px' }}>
                    {(csvAnalysis.columns?.length ?? 0)} colonnes trouvées • {Object.keys(mapping).length} champs déjà associés • {customMappings.length} champ{customMappings.length > 1 ? 's' : ''} custom conservé{customMappings.length > 1 ? 's' : ''}
                  </p>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isCompactViewport ? '1fr' : 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '10px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ backgroundColor: 'white', border: '1px solid var(--success-bg)', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                        Champs clés couverts
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--success)' }}>
                        {mappedRequiredCount}/{requiredFieldsForSelectedChannel.length || 0}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--success)' }}>
                        {requiredFieldsForSelectedChannel.length > 0
                          ? 'Utiles pour valider le flux cible.'
                          : 'Aucun champ obligatoire sur cette vue.'}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'white', border: '1px solid #FDE68A', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                        Colonnes à revoir
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--warning)' }}>
                        {csvUnmappedColumns.length}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--warning)' }}>
                        Elles peuvent être ignorées, mappées ou gardées en custom.
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'white', border: '1px solid var(--accent-bg)', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                        Statut du mapping
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-2)', lineHeight: 1.2 }}>
                        {missingRequiredFields.length === 0 ? 'Prêt à créer la source' : 'Création possible, synchro à compléter'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--accent-2)' }}>
                        {missingRequiredFields.length === 0
                          ? 'Les champs attendus par le flux cible sont couverts.'
                          : `${missingRequiredFields.length} champ${missingRequiredFields.length > 1 ? 's' : ''} clé${missingRequiredFields.length > 1 ? 's' : ''} reste${missingRequiredFields.length > 1 ? 'nt' : ''} à vérifier.`}
                      </div>
                    </div>
                  </div>

                  {missingRequiredFields.length > 0 && (
                    <div style={{
                      marginBottom: '16px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--warning-bg)',
                      border: '1px solid var(--warning)',
                      color: 'var(--warning)'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                        Champs clés encore absents
                      </div>
                      <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                        {missingRequiredFields.map((field) => field.label).join(' • ')}
                      </div>
                    </div>
                  )}

                  {/* Mapping modifiable — noms alignés avec le backend */}
                  <div style={{ backgroundColor: 'white', border: '1px solid var(--line)', borderRadius: '6px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isCompactViewport ? 'flex-start' : 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                        Mapping des colonnes
                      </h4>
                      <span style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
                        Modifiez ou complétez si besoin
                      </span>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', marginBottom: '6px' }}>Flux de sortie cible</label>
                      <select
                        value={mappingOutputChannel}
                        onChange={(e) => setMappingOutputChannel(e.target.value as MappingOutputChannel)}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '13px' }}
                      >
                        {CHANNEL_OPTIONS.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                      <p style={{ fontSize: '11px', color: 'var(--ink-4)', marginTop: '4px' }}>
                        Les champs affichés correspondent au format attendu par la plateforme. Vous pourrez exporter vers GMC, Meta, Amazon, etc. depuis le même catalogue.
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: isCompactViewport ? '50vh' : '400px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '4px' }}>
                      {(CHANNEL_OPTIONS.find(c => c.id === mappingOutputChannel)?.fieldGroups ?? MAPPING_FIELDS_GROUPS).map(({ group, fields }) => (
                        <div key={group}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', marginBottom: '8px', textTransform: 'uppercase' }}>{group}</div>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {fields.map(({ key, label, required }) => (
                              <div key={key} style={{ display: 'grid', gridTemplateColumns: isCompactViewport ? '1fr' : '200px minmax(0, 1fr)', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                                <label style={{ fontSize: '13px', fontWeight: required ? '600' : '500', color: 'var(--ink-2)' }}>
                                  {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
                                  {mapping[key] && <Check style={{ width: '12px', height: '12px', color: 'var(--success)', display: 'inline', marginLeft: '4px' }} />}
                                </label>
                                <select
                                  value={mapping[key] || ''}
                                  onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
                                  style={{
                                    padding: '8px 10px',
                                    border: `1px solid ${mapping[key] ? 'var(--success)' : 'var(--line)'}`,
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    backgroundColor: mapping[key] ? 'var(--success-bg)' : 'white'
                                  }}
                                >
                                  <option value="">-- Non mappé --</option>
                                  {(csvAnalysis.columns ?? []).map((col: string) => (
                                    <option key={col} value={col}>{col}</option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {/* Colonnes non mappées : permettre de mapper les colonnes restantes */}
                      {csvUnmappedColumns.length > 0 ? (
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', marginBottom: '8px', textTransform: 'uppercase' }}>
                              Colonnes non mappées ({csvUnmappedColumns.length})
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '8px' }}>
                              FeedPlug garde ces colonnes seulement si vous les associez à un champ standard ou à un champ personnalisé.
                            </p>
                            <div style={{ display: 'grid', gap: '8px' }}>
                              {csvUnmappedColumns.map((col: string) => (
                                <div key={col} style={{ display: 'grid', gridTemplateColumns: isCompactViewport ? '1fr' : '180px minmax(0, 1fr)', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                                  <span style={{ fontSize: '13px', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={col}>{col}</span>
                                  <select
                                    value={Object.entries(mapping).find(([, v]) => v === col)?.[0] || ''}
                                    onChange={(e) => {
                                      const target = e.target.value;
                                      const prev = getMappedTargetForColumn(mapping, col);
                                      const next = { ...mapping };
                                      if (prev) delete next[prev];
                                      if (target === CUSTOM_MAPPING_SENTINEL) {
                                        next[buildCustomMappingTarget(col, next, prev)] = col;
                                      } else if (target) {
                                        next[target] = col;
                                      }
                                      setMapping(next);
                                    }}
                                    style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '13px' }}
                                  >
                                    <option value="">-- Ignorer --</option>
                                    {fieldsForSelectedChannel.map(({ key, label }) => (
                                      <option key={key} value={key}>
                                        {label}
                                      </option>
                                    ))}
                                    <option value={CUSTOM_MAPPING_SENTINEL}>Champ personnalisé…</option>
                                  </select>
                                </div>
                              ))}
                            </div>
                          </div>
                      ) : (
                        <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--paper-2)', border: '1px solid var(--line)', fontSize: '12px', color: 'var(--ink-2)' }}>
                          Toutes les colonnes détectées sont déjà associées à un champ standard ou custom.
                        </div>
                      )}
                      {customMappings.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', marginBottom: '8px', textTransform: 'uppercase' }}>
                            Champs personnalisés ({customMappings.length})
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '8px' }}>
                            Ces champs seront conservés dans les données produit comme attributs custom, même s&apos;ils ne sont pas requis par GMC.
                          </p>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {customMappings.map(([target, column]) => (
                              <div key={`${target}-${column}`} style={{ display: 'grid', gridTemplateColumns: isCompactViewport ? '1fr' : '180px minmax(0, 1fr) auto', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                                <span style={{ fontSize: '13px', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={column}>
                                  {column}
                                </span>
                                <input
                                  type="text"
                                  value={target}
                                  onChange={(e) => {
                                    const nextTarget = sanitizeCustomFieldKey(e.target.value);
                                    if (!nextTarget || nextTarget === target) return;
                                    const next = { ...mapping };
                                    delete next[target];
                                    next[buildCustomMappingTarget(nextTarget, next, target)] = column;
                                    setMapping(next);
                                  }}
                                  placeholder="ex: pickup_slot_label"
                                  style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '13px' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = { ...mapping };
                                    delete next[target];
                                    setMapping(next);
                                  }}
                                  style={{ padding: '8px 10px', border: '1px solid #fecaca', borderRadius: '4px', backgroundColor: '#fff5f5', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                >
                                  Retirer
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Aperçu */}
                  {csvAnalysis.preview && csvAnalysis.preview.length > 0 && (
                    <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)', marginBottom: '12px' }}>
                        Aperçu (3 premiers produits)
                      </h4>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {csvAnalysis.preview.map((item: CsvPreviewRow, idx: number) => (
                          <div key={idx} style={{ fontSize: '12px', padding: '8px', backgroundColor: 'var(--paper-2)', borderRadius: '4px' }}>
                            <strong>{item.title || `Produit ${idx + 1}`}</strong>
                            {item.price && ` • ${item.price}`}
                            {item.brand && ` • ${item.brand}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isCompactViewport ? 'stretch' : 'center', flexDirection: isCompactViewport ? 'column' : 'row', gap: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--ink-4)' }}>
                  {!csvNameReady && 'Nom requis'}
                  {csvNameReady && !csvInputReady && ' • Fichier ou URL requis'}
                  {csvNameReady && csvInputReady && !csvAnalysisReady && ' • Analyse requise'}
                  {csvNameReady && csvInputReady && csvAnalysisReady && !csvMappingHasCoverage && ' • Associer au moins une colonne'}
                  {csvNameReady && csvInputReady && csvAnalysisReady && csvMappingHasCoverage && missingRequiredFields.length > 0 && ` • ${missingRequiredFields.length} champ${missingRequiredFields.length > 1 ? 's' : ''} clé${missingRequiredFields.length > 1 ? 's' : ''} à vérifier`}
                  {csvNameReady && csvInputReady && csvAnalysisReady && csvMappingHasCoverage && missingRequiredFields.length === 0 && ' • Mapping prêt'}
                </div>
                <div style={{ display: 'flex', gap: '12px', width: isCompactViewport ? '100%' : 'auto', flexDirection: isCompactViewport ? 'column-reverse' : 'row' }}>
                  <button
                    onClick={() => resetModal()}
                    style={{ padding: '12px 24px', border: '1px solid var(--line-strong)', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', width: isCompactViewport ? '100%' : 'auto' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleCreateSource}
                    disabled={creatingSource || !csvAnalysis || !sourceName.trim()}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: (creatingSource || !csvAnalysis || !sourceName.trim()) ? 'var(--line-strong)' : '#0a0a0a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: (creatingSource || !csvAnalysis || !sourceName.trim()) ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      width: isCompactViewport ? '100%' : 'auto'
                    }}
                  >
                    {creatingSource ? 'Création en cours...' : 'Créer la source et ouvrir le catalogue'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation de suppression */}
      {sourceToDelete && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => !deletingSource && setSourceToDelete(null)}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '8px', maxWidth: '420px', width: '90%', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--danger-bg)', borderRadius: '8px' }}>
                <Trash2 style={{ width: '24px', height: '24px', color: 'var(--danger)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 8px' }}>
                  Supprimer cette source ?
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: 0 }}>
                  La source « {sourceToDelete.name} » et ses flux associés seront définitivement supprimés. Cette action est irréversible.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setSourceToDelete(null)}
                disabled={deletingSource}
                style={{ padding: '10px 20px', border: '1px solid var(--line)', borderRadius: '6px', backgroundColor: 'white', cursor: deletingSource ? 'not-allowed' : 'pointer', fontSize: '14px' }}
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteSource}
                disabled={deletingSource}
                style={{ padding: '10px 20px', backgroundColor: 'var(--danger)', color: 'white', border: 'none', borderRadius: '6px', cursor: deletingSource ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}
              >
                {deletingSource ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de modification du mapping */}
      {editMappingFeed && editMappingSource && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: isCompactViewport ? '12px' : '20px' }}
          onClick={() => !savingMapping && (setEditMappingFeed(null), setEditMappingSource(null), setEditMappingAnalysis(null))}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '8px', maxWidth: '900px', width: '100%', maxHeight: 'calc(100vh - 24px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: isCompactViewport ? '18px' : '24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: isCompactViewport ? 'flex-start' : 'center', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                Modifier le mapping — {editMappingSource.name}
              </h2>
              <button onClick={() => { setEditMappingFeed(null); setEditMappingSource(null); setEditMappingAnalysis(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: '24px', height: '24px' }} />
              </button>
            </div>
            <div style={{ padding: isCompactViewport ? '16px' : '24px', overflowY: 'auto', overflowX: 'hidden' }}>
              {modalError && (
                <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px', color: 'var(--danger)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                  {modalError}
                </div>
              )}
              {loadingEditMapping ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-3)' }}>Chargement des colonnes…</div>
              ) : editMappingAnalysis?.columns ? (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', marginBottom: '6px' }}>Flux de sortie cible</label>
                    <select
                      value={editMappingOutputChannel}
                      onChange={(e) => setEditMappingOutputChannel(e.target.value as MappingOutputChannel)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '13px' }}
                    >
                      {CHANNEL_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: isCompactViewport ? '50vh' : '450px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '4px', marginBottom: '20px' }}>
                    {(CHANNEL_OPTIONS.find(c => c.id === editMappingOutputChannel)?.fieldGroups ?? MAPPING_FIELDS_GROUPS).map(({ group, fields }) => (
                      <div key={group}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', marginBottom: '8px', textTransform: 'uppercase' }}>{group}</div>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {fields.map(({ key, label, required }) => (
                            <div key={key} style={{ display: 'grid', gridTemplateColumns: isCompactViewport ? '1fr' : '200px minmax(0, 1fr)', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                              <label style={{ fontSize: '13px', fontWeight: required ? '600' : '500', color: 'var(--ink-2)' }}>
                                {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
                                {editMapping[key] && <Check style={{ width: '12px', height: '12px', color: 'var(--success)', display: 'inline', marginLeft: '4px' }} />}
                              </label>
                              <select
                                value={editMapping[key] || ''}
                                onChange={(e) => setEditMapping({ ...editMapping, [key]: e.target.value })}
                                style={{
                                  padding: '8px 10px',
                                  border: `1px solid ${editMapping[key] ? 'var(--success)' : 'var(--line)'}`,
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  backgroundColor: editMapping[key] ? 'var(--success-bg)' : 'white'
                                }}
                              >
                                <option value="">-- Non mappé --</option>
                                {(editMappingAnalysis.columns ?? []).map((col: string) => (
                                  <option key={col} value={col}>{col}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {/* Colonnes non mappées */}
                    {(() => {
                      const mappedCols = new Set(Object.values(editMapping).filter(Boolean));
                      const unmapped = (editMappingAnalysis.columns ?? []).filter((col: string) => !mappedCols.has(col));
                      const editFieldsForChannel = getMappingFieldsForChannel(editMappingOutputChannel);
                      return unmapped.length > 0 ? (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', marginBottom: '8px', textTransform: 'uppercase' }}>Colonnes non mappées ({unmapped.length})</div>
                          <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '8px' }}>
                            Utilisez un champ personnalisé si cette donnée ne correspond pas à un attribut standard.
                          </p>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {unmapped.map((col: string) => (
                              <div key={col} style={{ display: 'grid', gridTemplateColumns: isCompactViewport ? '1fr' : '180px minmax(0, 1fr)', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                                <span style={{ fontSize: '13px', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={col}>{col}</span>
                                <select
                                  value={Object.entries(editMapping).find(([, v]) => v === col)?.[0] || ''}
                                  onChange={(e) => {
                                    const target = e.target.value;
                                    const prev = getMappedTargetForColumn(editMapping, col);
                                    const next = { ...editMapping };
                                    if (prev) delete next[prev];
                                    if (target === CUSTOM_MAPPING_SENTINEL) {
                                      next[buildCustomMappingTarget(col, next, prev)] = col;
                                    } else if (target) {
                                      next[target] = col;
                                    }
                                    setEditMapping(next);
                                  }}
                                  style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '13px' }}
                                >
                                  <option value="">-- Ignorer --</option>
                                  {editFieldsForChannel.map(({ key, label }) => (
                                    <option key={key} value={key}>{label}</option>
                                  ))}
                                  <option value={CUSTOM_MAPPING_SENTINEL}>Champ personnalisé…</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {editCustomMappings.length > 0 && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', marginBottom: '8px', textTransform: 'uppercase' }}>
                          Champs personnalisés ({editCustomMappings.length})
                        </div>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {editCustomMappings.map(([target, column]) => (
                            <div key={`${target}-${column}`} style={{ display: 'grid', gridTemplateColumns: isCompactViewport ? '1fr' : '180px minmax(0, 1fr) auto', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                              <span style={{ fontSize: '13px', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={column}>
                                {column}
                              </span>
                              <input
                                type="text"
                                value={target}
                                onChange={(e) => {
                                  const nextTarget = sanitizeCustomFieldKey(e.target.value);
                                  if (!nextTarget || nextTarget === target) return;
                                  const next = { ...editMapping };
                                  delete next[target];
                                  next[buildCustomMappingTarget(nextTarget, next, target)] = column;
                                  setEditMapping(next);
                                }}
                                placeholder="ex: promotion_internal_label"
                                style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '13px' }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const next = { ...editMapping };
                                  delete next[target];
                                  setEditMapping(next);
                                }}
                                style={{ padding: '8px 10px', border: '1px solid #fecaca', borderRadius: '4px', backgroundColor: '#fff5f5', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, width: isCompactViewport ? '100%' : 'auto' }}
                              >
                                Retirer
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', flexDirection: isCompactViewport ? 'column-reverse' : 'row', gap: '12px' }}>
                    <button
                      onClick={() => { setEditMappingFeed(null); setEditMappingSource(null); setEditMappingAnalysis(null); }}
                      style={{ padding: '10px 20px', border: '1px solid var(--line)', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', width: isCompactViewport ? '100%' : 'auto' }}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSaveMapping}
                      disabled={savingMapping}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: savingMapping ? 'var(--line-strong)' : '#0a0a0a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: savingMapping ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        width: isCompactViewport ? '100%' : 'auto'
                      }}
                    >
                      {savingMapping ? 'Enregistrement...' : 'Enregistrer le mapping'}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-3)' }}>
                  Impossible de charger les colonnes pour modifier le mapping. Vérifiez que l&apos;URL du CSV est toujours accessible.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajouter source secondaire */}
      {showAddEnrichmentModal && addEnrichmentFeed && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: isCompactViewport ? '12px' : '20px' }}
          onClick={() => !addEnrichmentCreating && setShowAddEnrichmentModal(false)}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '8px', maxWidth: '900px', width: '100%', maxHeight: 'calc(100vh - 24px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: isCompactViewport ? '18px' : '24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: isCompactViewport ? 'flex-start' : 'center', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                Ajouter une source secondaire — {addEnrichmentFeed.name}
              </h2>
              <button onClick={() => setShowAddEnrichmentModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '24px', height: '24px' }} /></button>
            </div>
            <div style={{ padding: isCompactViewport ? '16px' : '24px', overflowY: 'auto', overflowX: 'hidden' }}>
              {modalError && (
                <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px', marginBottom: '16px', color: 'var(--danger)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle style={{ width: '16px', height: '16px' }} />{modalError}
                </div>
              )}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Nom de la source *</label>
                <input
                  type="text"
                  value={addEnrichmentName}
                  onChange={(e) => setAddEnrichmentName(e.target.value)}
                  placeholder="Ex: Custom labels marketing, Stocks magasins"
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Fichier CSV/Excel *</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch', flexWrap: 'wrap', flexDirection: isCompactViewport ? 'column' : 'row' }}>
                  <input
                    type="url"
                    value={addEnrichmentCsvUrl}
                    onChange={(e) => setAddEnrichmentCsvUrl(e.target.value)}
                    placeholder="URL ou glissez un fichier"
                    style={{ flex: 1, minWidth: isCompactViewport ? '100%' : '200px', width: isCompactViewport ? '100%' : undefined, padding: '10px', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '14px' }}
                  />
                  <label style={{ padding: '10px 16px', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', width: isCompactViewport ? '100%' : 'auto', justifyContent: isCompactViewport ? 'center' : 'flex-start' }}>
                    <Upload style={{ width: '16px', height: '16px' }} />
                    {addEnrichmentCsvFile ? addEnrichmentCsvFile.name : 'Parcourir'}
                    <input
                      type="file"
                      accept=".csv,.xml,.tsv,.txt"
                      onChange={(e) => setAddEnrichmentCsvFile(e.target.files?.[0] || null)}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                {addEnrichmentCsvFile && (
                  <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>Fichier sélectionné : {addEnrichmentCsvFile.name}</p>
                )}
              </div>
              <button
                onClick={handleAnalyzeEnrichmentCsv}
                disabled={addEnrichmentAnalyzing || (!addEnrichmentCsvUrl.trim() && !addEnrichmentCsvFile)}
                style={{ padding: '10px 20px', marginBottom: '20px', backgroundColor: addEnrichmentAnalyzing ? 'var(--line)' : '#0a0a0a', color: 'white', border: 'none', borderRadius: '6px', cursor: addEnrichmentAnalyzing ? 'not-allowed' : 'pointer', fontSize: '14px' }}
              >
                {addEnrichmentAnalyzing ? 'Analyse...' : 'Analyser le fichier'}
              </button>
              {addEnrichmentAnalysis?.columns && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Colonne de jointure (clé produit dans le CSV)</label>
                    <select
                      value={addEnrichmentJoinColumn}
                      onChange={(e) => setAddEnrichmentJoinColumn(e.target.value)}
                      style={{ width: '100%', padding: '10px', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '14px' }}
                    >
                      {(addEnrichmentAnalysis.columns ?? []).map((col: string) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Champ produit pour matcher</label>
                    <select
                      value={addEnrichmentJoinKey}
                      onChange={(e) => setAddEnrichmentJoinKey(e.target.value)}
                      style={{ width: '100%', padding: '10px', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '14px' }}
                    >
                      <option value="originId">ID origine (originId)</option>
                      <option value="sku">SKU</option>
                      <option value="mpn">MPN</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Mapping des champs (colonne CSV → champ produit)</label>
                    <div style={{ display: 'grid', gap: '8px', maxHeight: isCompactViewport ? '35vh' : '250px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '4px' }}>
                      {getMappingFieldsForChannel('all').slice(0, 40).map(({ key, label }) => (
                        <div key={key} style={{ display: 'grid', gridTemplateColumns: isCompactViewport ? '1fr' : '160px minmax(0, 1fr)', gap: '8px', alignItems: 'center', minWidth: 0 }}>
                          <span style={{ fontSize: '13px', color: 'var(--ink-2)' }}>{label}</span>
                          <select
                            value={addEnrichmentMapping[key] || ''}
                            onChange={(e) => setAddEnrichmentMapping({ ...addEnrichmentMapping, [key]: e.target.value })}
                            style={{ padding: '8px', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '13px' }}
                          >
                            <option value="">-- Non mappé --</option>
                            {(addEnrichmentAnalysis.columns ?? []).map((col: string) => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const mappedColumns = new Set(Object.values(addEnrichmentMapping).filter(Boolean));
                      const unmappedColumns = (addEnrichmentAnalysis.columns ?? []).filter((col: string) => !mappedColumns.has(col));
                      return unmappedColumns.length > 0 ? (
                        <div style={{ marginTop: '16px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', marginBottom: '8px', textTransform: 'uppercase' }}>
                            Colonnes non mappées ({unmappedColumns.length})
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '8px' }}>
                            Pratique pour stocker des attributs métiers ou marketplace qui ne sont pas dans la liste standard.
                          </p>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {unmappedColumns.map((col: string) => (
                              <div key={col} style={{ display: 'grid', gridTemplateColumns: isCompactViewport ? '1fr' : '160px minmax(0, 1fr)', gap: '8px', alignItems: 'center', minWidth: 0 }}>
                                <span style={{ fontSize: '13px', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={col}>{col}</span>
                                <select
                                  value={getMappedTargetForColumn(addEnrichmentMapping, col) || ''}
                                  onChange={(e) => {
                                    const target = e.target.value;
                                    const prev = getMappedTargetForColumn(addEnrichmentMapping, col);
                                    const next = { ...addEnrichmentMapping };
                                    if (prev) delete next[prev];
                                    if (target === CUSTOM_MAPPING_SENTINEL) {
                                      next[buildCustomMappingTarget(col, next, prev)] = col;
                                    } else if (target) {
                                      next[target] = col;
                                    }
                                    setAddEnrichmentMapping(next);
                                  }}
                                  style={{ padding: '8px', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '13px' }}
                                >
                                  <option value="">-- Ignorer --</option>
                                  {getMappingFieldsForChannel('all').map(({ key, label }) => (
                                    <option key={key} value={key}>{label}</option>
                                  ))}
                                  <option value={CUSTOM_MAPPING_SENTINEL}>Champ personnalisé…</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {enrichmentCustomMappings.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', marginBottom: '8px', textTransform: 'uppercase' }}>
                          Champs personnalisés ({enrichmentCustomMappings.length})
                        </div>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {enrichmentCustomMappings.map(([target, column]) => (
                            <div key={`${target}-${column}`} style={{ display: 'grid', gridTemplateColumns: isCompactViewport ? '1fr' : '160px minmax(0, 1fr) auto', gap: '8px', alignItems: 'center', minWidth: 0 }}>
                              <span style={{ fontSize: '13px', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={column}>{column}</span>
                              <input
                                type="text"
                                value={target}
                                onChange={(e) => {
                                  const nextTarget = sanitizeCustomFieldKey(e.target.value);
                                  if (!nextTarget || nextTarget === target) return;
                                  const next = { ...addEnrichmentMapping };
                                  delete next[target];
                                  next[buildCustomMappingTarget(nextTarget, next, target)] = column;
                                  setAddEnrichmentMapping(next);
                                }}
                                placeholder="ex: store_cluster_label"
                                style={{ padding: '8px', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '13px' }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const next = { ...addEnrichmentMapping };
                                  delete next[target];
                                  setAddEnrichmentMapping(next);
                                }}
                                style={{ padding: '8px 10px', border: '1px solid #fecaca', borderRadius: '4px', backgroundColor: '#fff5f5', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, width: isCompactViewport ? '100%' : 'auto' }}
                              >
                                Retirer
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '8px' }}>
                      Les valeurs du CSV seront fusionnées avec les produits via la clé de jointure (SKU, ID...)
                    </p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', flexDirection: isCompactViewport ? 'column-reverse' : 'row', gap: '12px' }}>
                    <button onClick={() => setShowAddEnrichmentModal(false)} style={{ padding: '10px 20px', border: '1px solid var(--line)', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', width: isCompactViewport ? '100%' : 'auto' }}>
                      Annuler
                    </button>
                    <button
                      onClick={handleCreateEnrichmentSource}
                      disabled={addEnrichmentCreating || Object.values(addEnrichmentMapping).filter(Boolean).length === 0}
                      style={{ padding: '10px 20px', backgroundColor: addEnrichmentCreating ? 'var(--line-strong)' : '#0a0a0a', color: 'white', border: 'none', borderRadius: '6px', cursor: addEnrichmentCreating ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', width: isCompactViewport ? '100%' : 'auto' }}
                    >
                      {addEnrichmentCreating ? 'Création...' : 'Créer la source secondaire'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Les connecteurs Shopify, ERP, PIM sont désactivés — pas de modale nécessaire */}
    </PageLayout>
  );
}
