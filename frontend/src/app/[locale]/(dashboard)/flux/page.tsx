"use client";

import { 
  FileText, 
  Plus,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  Globe,
  ShoppingCart,
  Activity,
  Download,
  BarChart3,
  TrendingUp
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { FluxGuide } from "@/components/onboarding/contextual-guide";
import { useOnboarding } from "@/contexts/onboarding-context";
import Link from "next/link";
import { getFeeds, getFeedAudit, updateFeedAutoPush, exportFeedAsCsv,exportFeedAsCsvAmazon, exportFeedAsCsvAmazonForDestination, exportFeedAsCsvBaidu, exportFeedAsCsvBing, exportFeedAsCsvCdiscount, exportFeedAsCsvForDestination, exportFeedAsCsvGemini, exportFeedAsCsvLia, exportFeedAsCsvMeta, exportFeedAsCsvPerplexity, exportFeedAsCsvPinterest, exportFeedAsCsvRakuten, exportFeedAsCsvSnapchat, exportFeedAsCsvTikTok, exportFeedAsCsvYandex, exportFeedAsChatGPT, AMAZON_EXPORT_CHANNELS, type Feed, type FeedAudit } from "@/lib/services/flux.service";
import { getMarkets, type Market } from "@/lib/services/markets.service";
import { connectAmazon } from "@/lib/services/platforms.service";
import { CreateExportModal } from "@/components/forms/create-export-modal";
import { usePlanCapabilities } from "@/hooks/use-plan-capabilities";
import {
  PageLayout,
  PageHeader,
  PageLoading,
  PageError,
  EmptyState,
  StatusBadge,
  PageCard,
  DashboardSection,
  DashboardStatGrid,
  DashboardStatCard,
  PageButtonPrimary,
  PageButtonSecondary,
} from "@/components/layout";
import { apiClient } from "@/lib/api";
import { CHANNEL_FAMILY_META, SUPPORTED_CHANNELS } from "@/lib/channels/catalog";
import { formatLocaleLabel } from "@/lib/markets";

interface PushResult {
  total?: number;
  succeeded?: number;
  failed?: number;
  message?: string;
  reconnect?: boolean;
  mcaError?: boolean;
  errors?: Array<{ productId?: string; errors?: string[]; batch?: string; error?: string }>;
}

interface GmcStatus {
  connected: boolean;
  merchantId?: string;
  merchantName?: string;
  email?: string;
}

interface GmcSelectionOption {
  merchantId: string;
  merchantName?: string;
  aggregatorId?: string;
  label?: string;
}

interface GmcSelectionState {
  selectionId: string;
  email?: string;
  merchants: GmcSelectionOption[];
  selectedMerchantId: string;
}

interface PushTargetOption {
  destinationId: string;
  label: string;
  channelKey?: (typeof AMAZON_EXPORT_CHANNELS)[number]["channelKey"];
}

export default function FluxPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { canAddChannel, channelsCount, maxChannels } = usePlanCapabilities();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [togglingAutoPushId, setTogglingAutoPushId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportMenuFeedId, setExportMenuFeedId] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [selectedAuditFeedId, setSelectedAuditFeedId] = useState<string | null>(null);
  const [feedAudit, setFeedAudit] = useState<FeedAudit | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const { onboardingState } = useOnboarding();

  // GMC connection
  const [gmcStatus, setGmcStatus] = useState<GmcStatus>({ connected: false });
  const [gmcLoading, setGmcLoading] = useState(false);
  const [gmcSelection, setGmcSelection] = useState<GmcSelectionState | null>(null);
  const [gmcSelectionLoading, setGmcSelectionLoading] = useState(false);
  const [gmcPushMenuFeedId, setGmcPushMenuFeedId] = useState<string | null>(null);

  // Amazon connection
  const [amazonStatus, setAmazonStatus] = useState<{ connected: boolean; sellerId?: string }>({ connected: false });
  const [amazonLoading, setAmazonLoading] = useState(false);
  const [amazonPushMenuFeedId, setAmazonPushMenuFeedId] = useState<string | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const fluxPath = `/${locale}/flux`;

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const clearFluxQueryState = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.history.replaceState({}, '', fluxPath);
  }, [fluxPath]);

  const refreshGmcStatus = useCallback(async () => {
    try {
      const { data } = await apiClient.get<GmcStatus>('/platforms/gmc/status');
      setGmcStatus({
        connected: !!data.connected,
        merchantId: data.merchantId,
        merchantName: data.merchantName,
        email: data.email,
      });
    } catch {
      setGmcStatus({ connected: false });
    }
  }, []);

  const loadGmcSelection = useCallback(async (selectionId: string) => {
    setGmcSelectionLoading(true);
    try {
      const { data } = await apiClient.get<{ selectionId: string; email?: string; merchants?: GmcSelectionOption[] }>(`/platforms/gmc/selection/${selectionId}`);
      const merchants = Array.isArray(data?.merchants) ? data.merchants.filter((merchant) => !!merchant?.merchantId) : [];

      if (!merchants.length) {
        throw new Error("Aucun Merchant Center n'est disponible pour cette connexion.");
      }

      setGmcSelection({
        selectionId: data.selectionId || selectionId,
        email: data.email,
        merchants,
        selectedMerchantId: merchants[0].merchantId,
      });
      showToast('Choisissez le Merchant Center a connecter.', 'info');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Impossible de charger la selection Merchant Center.', 'error');
      setGmcSelection(null);
    } finally {
      setGmcSelectionLoading(false);
    }
  }, [showToast]);

  const loadFeedAudit = useCallback(async (feedId: string) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const audit = await getFeedAudit(feedId);
      setFeedAudit(audit);
    } catch (e) {
      setFeedAudit(null);
      setAuditError(e instanceof Error ? e.message : 'Audit indisponible');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  // Charger feeds + statut GMC + Amazon
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getFeeds();
        if (!cancelled) setFeeds(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t("fluxPage.errorLoadingFeeds"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Charger statut GMC
    void refreshGmcStatus();

    // Charger statut Amazon
    (async () => {
      try {
        const { data } = await apiClient.get<{ connected?: boolean; sellerId?: string }>('/platforms/amazon/status');
        if (!cancelled && data) setAmazonStatus({ connected: !!data.connected, sellerId: data.sellerId });
      } catch {}
    })();

    (async () => {
      try {
        const data = await getMarkets();
        if (!cancelled) setMarkets(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setMarkets([]);
      }
    })();

    // Vérifier si on revient du callback OAuth
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('gmc') === 'connected') {
        void refreshGmcStatus();
        showToast('Google Merchant Center connecté. Vous pouvez maintenant pousser ce flux.', 'success');
        clearFluxQueryState();
      }
      if (params.get('gmc') === 'select' && params.get('selection')) {
        void loadGmcSelection(params.get('selection') || '');
      }
      if (params.get('gmc') === 'error') {
        const message = params.get('message') || 'La connexion Google Merchant Center a echoue.';
        showToast(message, 'error');
        clearFluxQueryState();
      }
      if (params.get('amazon') === 'connected') {
        setAmazonStatus({ connected: true, sellerId: params.get('seller') || undefined });
        showToast('Amazon connecté. Vous pouvez maintenant pousser ce flux vers un canal Amazon.', 'success');
        clearFluxQueryState();
      }
      if (params.get('amazon') === 'error') {
        showToast('Erreur connexion Amazon: ' + (params.get('reason') || 'Échec'), 'error');
        clearFluxQueryState();
      }
    }

    return () => { cancelled = true; };
  }, [clearFluxQueryState, loadGmcSelection, refreshGmcStatus, showToast, t]);

  useEffect(() => {
    if (!feeds.length) {
      setSelectedAuditFeedId(null);
      setFeedAudit(null);
      return;
    }
    if (!selectedAuditFeedId || !feeds.some((feed) => feed.id === selectedAuditFeedId)) {
      setSelectedAuditFeedId(feeds[0].id);
    }
  }, [feeds, selectedAuditFeedId]);

  useEffect(() => {
    if (!selectedAuditFeedId) return;
    void loadFeedAudit(selectedAuditFeedId);
  }, [loadFeedAudit, selectedAuditFeedId]);

  const handleConnectGMC = async () => {
    setGmcLoading(true);
    try {
      const { data } = await apiClient.get<{ authUrl?: string }>(`/platforms/gmc/auth-url?locale=${encodeURIComponent(locale)}`);
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        showToast('Erreur lors de la connexion à Google Merchant Center.', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur de connexion à Google Merchant Center', 'error');
    } finally {
      setGmcLoading(false);
    }
  };

  const handleDisconnectGMC = async () => {
    setGmcLoading(true);
    try {
      await apiClient.delete('/platforms/gmc/disconnect');
      setGmcSelection(null);
      clearFluxQueryState();
      await refreshGmcStatus();
      showToast('Google Merchant Center déconnecté.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur lors de la déconnexion GMC', 'error');
    } finally {
      setGmcLoading(false);
    }
  };

  const requestDisconnectGMC = async () => {
    if (typeof window !== 'undefined' && !window.confirm("Déconnecter Google Merchant Center ? Le push automatique sera interrompu jusqu'à reconnexion.")) {
      return;
    }
    await handleDisconnectGMC();
  };

  const handleConfirmGmcSelection = async () => {
    if (!gmcSelection?.selectionId || !gmcSelection.selectedMerchantId) {
      showToast('Selection Merchant Center invalide.', 'error');
      return;
    }

    setGmcSelectionLoading(true);
    try {
      await apiClient.post('/platforms/gmc/select-merchant', {
        selectionId: gmcSelection.selectionId,
        merchantId: gmcSelection.selectedMerchantId,
      });
      setGmcSelection(null);
      clearFluxQueryState();
      await refreshGmcStatus();
      showToast('Google Merchant Center connecté. Vous pouvez maintenant pousser ce flux.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Impossible de finaliser la connexion Merchant Center.', 'error');
    } finally {
      setGmcSelectionLoading(false);
    }
  };

  const handlePushGMC = async (feedId: string, target?: PushTargetOption | null) => {
    setGmcPushMenuFeedId(null);
    setPushingId(feedId);
    setPushResult(null);
    try {
      const query = target?.destinationId ? `?destinationId=${encodeURIComponent(target.destinationId)}` : '';
      const { data } = await apiClient.post<PushResult>(`/platforms/gmc/push/${feedId}${query}`);
      if (data) {
        setPushResult(data);
        const succeeded = data.succeeded ?? 0;
        const failed = data.failed ?? 0;
        const total = data.total ?? succeeded + failed;
        if (succeeded === 0 && failed === 0 && total === 0) {
          showToast(data.message || 'Aucun produit a pousser vers Google Merchant Center.', 'info');
        } else if (succeeded === 0 && failed > 0) {
          const firstError = data.errors?.[0]?.errors?.[0] || data.errors?.[0]?.error || 'Erreur Google Merchant Center';
          showToast(`Push GMC échoué: ${failed} erreurs — ${firstError}`, 'error');
        } else if (failed > 0) {
          showToast(data.message || `Push GMC partiel: ${succeeded} envoyés, ${failed} erreurs.`, 'error');
        } else {
          showToast(data.message || `Push GMC terminé: ${succeeded} produits envoyés.`, 'success');
        }
      }
    } catch (e) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || 'Erreur') : 'Erreur';
      const reconnect = e && typeof e === 'object' && 'response' in e
        ? Boolean(((e as { response?: { reconnect?: boolean } }).response?.reconnect))
        : false;
      if (reconnect) {
        setGmcStatus({ connected: false });
        showToast('Votre connexion Google Merchant Center a expiré. Reconnectez votre compte.', 'error');
      } else {
        showToast(message, 'error');
      }
    } finally {
      setPushingId(null);
    }
  };

  const handleConnectAmazon = async () => {
    setAmazonLoading(true);
    try {
      const result = await connectAmazon(`/${locale}/flux`);
      if (result.kind === 'redirect') {
        window.location.href = result.url;
        return;
      }
      // SP-API pas encore activé (configured:false) → message neutre, pas une erreur rouge.
      showToast(result.message, 'info');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur de connexion Amazon';
      if (/oauth\s*non\s*configur/i.test(message)) {
        showToast('La connexion Amazon Seller Central arrive bientôt sur FeedPlug.', 'info');
      } else {
        showToast(message, 'error');
      }
    } finally {
      setAmazonLoading(false);
    }
  };

  const handleDisconnectAmazon = async () => {
    try {
      await apiClient.delete('/platforms/amazon/disconnect');
      setAmazonStatus({ connected: false });
      showToast('Amazon déconnecté.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur lors de la déconnexion Amazon', 'error');
    }
  };

  const requestDisconnectAmazon = async () => {
    if (typeof window !== 'undefined' && !window.confirm("Déconnecter Amazon ? Le push automatique sera interrompu jusqu'à reconnexion.")) {
      return;
    }
    await handleDisconnectAmazon();
  };

  const handlePushAmazon = async (feedId: string, target: PushTargetOption) => {
    setAmazonPushMenuFeedId(null);
    setPushingId(feedId);
    setPushResult(null);
    try {
      const query = target.destinationId
        ? `?destinationId=${encodeURIComponent(target.destinationId)}`
        : `?channel=${encodeURIComponent(target.channelKey || 'amazon_fr')}`;
      const { data } = await apiClient.post<PushResult>(`/platforms/amazon/push/${feedId}${query}`);
      if (data) {
        setPushResult(data);
        showToast(data.message || `Push Amazon terminé: ${data.succeeded ?? 0} produits envoyés.`, 'success');
      }
    } catch (e) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || 'Erreur') : 'Erreur';
      const reconnect = e && typeof e === 'object' && 'response' in e
        ? Boolean(((e as { response?: { reconnect?: boolean } }).response?.reconnect))
        : false;
      if (reconnect) {
        setAmazonStatus({ connected: false });
        showToast('Connexion Amazon expirée. Reconnectez votre compte.', 'error');
      } else {
        showToast(message, 'error');
      }
    } finally {
      setPushingId(null);
    }
  };

  const handleExportCsv = async (feedId: string) => {
    setExportMenuFeedId(null);
    setExportingId(feedId);
    try {
      await exportFeedAsCsv(feedId);
      showToast('Export Google Merchant Center téléchargé.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Export impossible', 'error');
    } finally {
      setExportingId(null);
    }
  };

  const handleToggleAutoPush = async (feedId: string, current: boolean) => {
    const next = !current;
    setTogglingAutoPushId(feedId);
    // Mise à jour optimiste
    setFeeds((prev) => prev.map((f) => (f.id === feedId ? { ...f, autoPushEnabled: next } : f)));
    try {
      await updateFeedAutoPush(feedId, next);
      showToast(
        next
          ? 'Export automatique activé : ce flux sera poussé vers vos canaux connectés une fois par jour.'
          : 'Export automatique désactivé.',
        'success'
      );
    } catch (e) {
      // Rollback en cas d'échec
      setFeeds((prev) => prev.map((f) => (f.id === feedId ? { ...f, autoPushEnabled: current } : f)));
      showToast(e instanceof Error ? e.message : 'Modification impossible', 'error');
    } finally {
      setTogglingAutoPushId(null);
    }
  };

  const handleExportGmcTarget = async (feedId: string, target: PushTargetOption) => {
    setExportMenuFeedId(null);
    setExportingId(feedId);
    try {
      await exportFeedAsCsvForDestination(feedId, target.destinationId);
      showToast(`Export Google Merchant Center · ${target.label} téléchargé.`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Export Google Merchant Center impossible', 'error');
    } finally {
      setExportingId(null);
    }
  };

  const handleExportCsvMeta = async (feedId: string) => {
    setExportMenuFeedId(null);
    setExportingId(feedId);
    try {
      await exportFeedAsCsvMeta(feedId);
      showToast('Export Meta téléchargé.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Export Meta impossible', 'error');
    } finally {
      setExportingId(null);
    }
  };

  const handleExportCsvAmazon = async (feedId: string, channel: (typeof AMAZON_EXPORT_CHANNELS)[number]["channelKey"]) => {
    setExportMenuFeedId(null);
    setExportingId(feedId);
    try {
      await exportFeedAsCsvAmazon(feedId, channel);
      showToast(`Export ${channel.toUpperCase()} téléchargé.`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Export Amazon impossible', 'error');
    } finally {
      setExportingId(null);
    }
  };

  const handleExportAmazonTarget = async (feedId: string, target: PushTargetOption) => {
    setExportMenuFeedId(null);
    setExportingId(feedId);
    try {
      await exportFeedAsCsvAmazonForDestination(feedId, target.destinationId, target.channelKey || 'amazon_fr');
      showToast(`Export ${target.label} téléchargé.`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Export Amazon impossible', 'error');
    } finally {
      setExportingId(null);
    }
  };

  const handleExportCsvCdiscount = async (feedId: string) => {
    setExportMenuFeedId(null);
    setExportingId(feedId);
    try {
      await exportFeedAsCsvCdiscount(feedId);
      showToast('Export Cdiscount téléchargé.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Export Cdiscount impossible', 'error');
    } finally {
      setExportingId(null);
    }
  };

  const handleExportCsvRakuten = async (feedId: string) => {
    setExportMenuFeedId(null);
    setExportingId(feedId);
    try {
      await exportFeedAsCsvRakuten(feedId);
      showToast('Export Rakuten téléchargé.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Export Rakuten impossible', 'error');
    } finally {
      setExportingId(null);
    }
  };

  const handleExportChatGPT = async (feedId: string, format: 'json' | 'csv' = 'json') => {
    setExportMenuFeedId(null);
    setExportingId(feedId);
    try {
      await exportFeedAsChatGPT(feedId, format);
      showToast(`Export ChatGPT ${format.toUpperCase()} téléchargé.`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Export ChatGPT impossible', 'error');
    } finally {
      setExportingId(null);
    }
  };

  const handleExportPlatform = async (feedId: string, name: string, fn: () => Promise<void>) => {
    setExportMenuFeedId(null);
    setExportingId(feedId);
    try {
      await fn();
      showToast(`Export ${name} téléchargé.`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : `Export ${name} impossible`, 'error');
    } finally {
      setExportingId(null);
    }
  };

  const filteredFlows = feeds;
  const connectedChannels = [
    gmcStatus.connected ? 'Google Merchant Center' : null,
    amazonStatus.connected ? 'Amazon' : null,
  ].filter((value): value is string => Boolean(value));
  const connectedChannelsCount = connectedChannels.length;
  const availableChannelsLabel = connectedChannels.join(' et ');
  const directPushChannels = SUPPORTED_CHANNELS.filter((channel) => channel.delivery === 'push' || channel.delivery === 'both');
  const gmcPushTargets: PushTargetOption[] = markets.flatMap((market) => {
    const localeById = new Map(market.locales.map((entry) => [entry.id, entry.localeCode]));
    return market.channels
      .filter((channel) => channel.platformKey === 'gmc' && channel.isEnabled)
      .flatMap((channel) => channel.destinations.map((destination) => {
        const localeCode = destination.marketLocaleId ? localeById.get(destination.marketLocaleId) : null;
        const suffix = localeCode ? ` · ${formatLocaleLabel(locale, localeCode)}` : '';
        return {
          destinationId: destination.id,
          label: `${market.name}${suffix}`,
        };
      }));
  });
  const amazonPushTargets: Array<PushTargetOption & { channelKey?: (typeof AMAZON_EXPORT_CHANNELS)[number]['channelKey'] }> = markets.flatMap((market) => {
    const localeById = new Map(market.locales.map((entry) => [entry.id, entry.localeCode]));
    return market.channels
      .filter((channel) => channel.platformKey === 'amazon' && channel.isEnabled)
      .flatMap((channel) => channel.destinations.map((destination) => {
        const localeCode = destination.marketLocaleId ? localeById.get(destination.marketLocaleId) : null;
        const suffix = localeCode ? ` · ${formatLocaleLabel(locale, localeCode)}` : '';
        const fallbackLabel = destination.externalScopeLabel || market.name;
        const legacyChannelKey = typeof destination.config?.legacyChannelKey === 'string'
          ? destination.config.legacyChannelKey as (typeof AMAZON_EXPORT_CHANNELS)[number]['channelKey']
          : undefined;
        return {
          destinationId: destination.id,
          label: `${fallbackLabel}${suffix}`,
          channelKey: legacyChannelKey,
        };
      }));
  });
  const exportReadyChannels = SUPPORTED_CHANNELS.filter((channel) => channel.delivery === 'export' || channel.delivery === 'both');
  const aiChannels = SUPPORTED_CHANNELS.filter((channel) => channel.family === 'ai');
  const distributionFamilies = Object.entries(CHANNEL_FAMILY_META).map(([familyKey, meta]) => ({
    key: familyKey,
    meta,
    channels: SUPPORTED_CHANNELS.filter((channel) => channel.family === familyKey).map((channel) => {
      const isConnected =
        channel.key === 'gmc'
          ? gmcStatus.connected
          : channel.key.startsWith('amazon_')
            ? amazonStatus.connected
            : false;

      return {
        ...channel,
        statusLabel: isConnected
          ? 'Push connecte'
          : channel.delivery === 'both'
            ? 'Push + export'
            : channel.family === 'ai'
              ? 'Export IA'
              : 'Export pret',
        statusTone: isConnected
          ? { background: 'var(--success-bg)', color: 'var(--success)', border: '#BBF7D0' }
          : { background: 'var(--surface)', color: 'var(--ink-3)', border: 'var(--line)' },
      };
    }),
  }));

  const formatFrequency = (frequency?: string | null) => {
    if (!frequency) return 'Manuel';
    const normalized = String(frequency).toLowerCase();
    if (normalized.includes('hour')) return 'Toutes les heures';
    if (normalized.includes('day')) return 'Quotidien';
    if (normalized.includes('week')) return 'Hebdomadaire';
    if (normalized.includes('month')) return 'Mensuel';
    return String(frequency);
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Jamais';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Jamais';
    return new Intl.DateTimeFormat(locale || 'fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getFeedSyncCoverage = (feed: Feed) => {
    const mapping = feed.mappingJson || {};
    const hasTitle = Boolean(mapping.title);
    const hasIdentifier = Boolean(mapping.id || mapping.sku);
    const hasLink = Boolean(mapping.link || mapping.mobile_link);
    const missing: string[] = [];

    if (!hasTitle) missing.push('Titre');
    if (!hasIdentifier) missing.push('ID / SKU');
    if (!hasLink) missing.push('URL produit');

    return {
      mappingCount: Object.keys(mapping).length,
      hasMinimumSyncFields: hasTitle || hasIdentifier || hasLink,
      missing,
    };
  };

  const getFeedReadiness = (feed: Feed) => {
    const syncCoverage = getFeedSyncCoverage(feed);
    const latestRun = feed.latestRun;

    if (syncCoverage.mappingCount === 0 || !syncCoverage.hasMinimumSyncFields) {
      return {
        label: 'Mapping à compléter',
        description: syncCoverage.mappingCount === 0
          ? 'Associez au moins un titre, un identifiant ou une URL produit avant la première synchro.'
          : `Le flux a un mapping partiel. Complétez : ${syncCoverage.missing.join(', ')}.`,
        accent: 'var(--danger)',
        background: 'var(--danger-bg)',
        priority: 'attention' as const,
        nextStep: 'Compléter le mapping dans Sources',
      };
    }

    if (feed.source?.status !== 'ACTIVE') {
      return {
        label: 'Source en pause',
        description: 'Le mapping est prêt, mais la source est actuellement en pause. Reprenez-la avant la prochaine synchro.',
        accent: 'var(--warning)',
        background: 'var(--warning-bg)',
        priority: 'attention' as const,
        nextStep: 'Réactiver la source',
      };
    }

    if (feed.status === 'ERROR' || latestRun?.status === 'FAILED') {
      return {
        label: 'Dernière synchro en erreur',
        description: latestRun?.errorMessage || 'Ce flux remonte une erreur. Vérifiez la source ou relancez une synchro.',
        accent: 'var(--danger)',
        background: 'var(--danger-bg)',
        priority: 'attention' as const,
        nextStep: 'Ouvrir la source et corriger le blocage',
      };
    }

    if (feed.status === 'PENDING') {
      return {
        label: 'Configuration en attente',
        description: 'Finalisez ce flux avant le premier export ou push.',
        accent: 'var(--warning)',
        background: 'var(--warning-bg)',
        priority: 'attention' as const,
        nextStep: 'Terminer la configuration du flux',
      };
    }

    if (feed.status === 'INACTIVE') {
      return {
        label: 'Prêt à activer',
        description: connectedChannelsCount > 0
          ? `Export CSV prêt. Activez ce flux ou poussez-le vers ${availableChannelsLabel}.`
          : 'Export CSV prêt. Connectez Google Merchant Center ou Amazon pour le push automatique.',
        accent: 'var(--accent)',
        background: 'var(--accent-bg)',
        priority: 'ready' as const,
        nextStep: connectedChannelsCount > 0 ? 'Activer ou pousser ce flux' : 'Connecter un canal de diffusion',
      };
    }

    return {
      label: connectedChannelsCount > 0 ? 'Prêt à diffuser' : 'Prêt à exporter',
      description: connectedChannelsCount > 0
        ? `Vous pouvez exporter ce flux ou le pousser vers ${availableChannelsLabel}.`
        : 'Ce flux est prêt en CSV. Connectez un canal pour le push automatique.',
      accent: 'var(--success)',
      background: 'var(--success-bg)',
      priority: 'ready' as const,
      nextStep: connectedChannelsCount > 0 ? 'Lancer un export ou un push' : 'Connecter Google Merchant Center ou Amazon',
    };
  };

  const feedReadinessMap = new Map(feeds.map((feed) => [feed.id, getFeedReadiness(feed)]));
  const activeFeedsCount = feeds.filter((feed) => feedReadinessMap.get(feed.id)?.priority === 'ready').length;
  const attentionFeedsCount = feeds.filter((feed) => feedReadinessMap.get(feed.id)?.priority === 'attention').length;
  const selectedAuditFeed = feeds.find((feed) => feed.id === selectedAuditFeedId) ?? null;
  const nextAction = !feeds.length
    ? {
        title: "Créez votre premier flux d'export",
        description: "Choisissez une source existante puis créez un flux pour commencer à diffuser votre catalogue.",
        tone: 'var(--ink)',
      }
    : connectedChannelsCount === 0
      ? {
          title: 'Connectez un canal de diffusion',
          description: "Vos flux sont prêts en CSV, mais vous devez relier Google Merchant Center ou Amazon pour pousser automatiquement vos produits.",
          tone: 'var(--accent)',
        }
      : attentionFeedsCount > 0
        ? {
            title: 'Vérifiez les flux à débloquer',
            description: "Certains flux demandent encore une action côté source, mapping ou synchro. Traitez-les avant de lancer de nouveaux exports.",
            tone: 'var(--warning)',
          }
        : {
            title: 'Lancez votre première diffusion',
            description: `Vos flux et vos connexions sont prêts. Vous pouvez exporter en CSV ou pousser directement vers ${availableChannelsLabel}.`,
            tone: 'var(--success)',
          };

  const getReadinessBadge = (readiness: ReturnType<typeof getFeedReadiness>) => {
    if (readiness.priority === 'attention') {
      return <StatusBadge variant="warning">{readiness.label}</StatusBadge>;
    }
    return <StatusBadge variant="success">{readiness.label}</StatusBadge>;
  };

  const getIssueAccent = (severity: FeedAudit["topIssues"][number]["severity"]) => {
    if (severity === 'high') {
      return { border: '#fecaca', background: 'var(--danger-bg)', text: 'var(--danger)', label: 'Priorite haute' };
    }
    if (severity === 'medium') {
      return { border: '#fde68a', background: 'var(--warning-bg)', text: 'var(--warning)', label: 'Priorite moyenne' };
    }
    return { border: 'var(--line-strong)', background: 'var(--paper-2)', text: 'var(--ink-2)', label: 'Priorite basse' };
  };

  return (
    <PageLayout>
      {gmcSelection && (
        <PageCard
          style={{
            marginBottom: '20px',
            borderColor: 'var(--accent-bg)',
            background: 'linear-gradient(135deg, var(--accent-bg) 0%, var(--paper-2) 100%)',
            boxShadow: '0 22px 50px rgba(15, 118, 110, 0.12)',
          }}
        >
          <div style={{ display: 'grid', gap: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: '6px' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                  Etape requise
                </p>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--ink)' }}>Choisir un Merchant Center</h2>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  {gmcSelection.email
                    ? `Plusieurs Merchant Centers sont accessibles avec ${gmcSelection.email}. Selectionnez celui que FeedPlug doit piloter.`
                    : "Plusieurs Merchant Centers sont disponibles. Selectionnez celui que FeedPlug doit piloter."}
                </p>
              </div>
              <PageButtonSecondary
                onClick={() => {
                  setGmcSelection(null);
                  clearFluxQueryState();
                }}
                disabled={gmcSelectionLoading}
              >
                Plus tard
              </PageButtonSecondary>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {gmcSelection.merchants.map((merchant) => {
                const selected = gmcSelection.selectedMerchantId === merchant.merchantId;
                return (
                  <button
                    key={merchant.merchantId}
                    type="button"
                    onClick={() => setGmcSelection((current) => current ? { ...current, selectedMerchantId: merchant.merchantId } : current)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      borderRadius: '16px',
                      border: selected ? '1.5px solid var(--accent)' : '1px solid var(--line-strong)',
                      backgroundColor: selected ? '#f0fdfa' : '#ffffff',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'grid',
                      gap: '4px',
                      boxShadow: selected ? '0 12px 24px rgba(15,118,110,0.10)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                      {merchant.merchantName || merchant.label || `Merchant Center ${merchant.merchantId}`}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
                      ID Merchant Center: {merchant.merchantId}
                      {merchant.aggregatorId ? ` · Aggregator ${merchant.aggregatorId}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
              <PageButtonPrimary
                onClick={handleConfirmGmcSelection}
                disabled={gmcSelectionLoading || !gmcSelection.selectedMerchantId}
              >
                {gmcSelectionLoading ? 'Connexion...' : 'Connecter ce Merchant Center'}
              </PageButtonPrimary>
            </div>
          </div>
        </PageCard>
      )}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 100,
          padding: '14px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxWidth: '460px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          backgroundColor: toast.type === 'success' ? 'var(--success-bg)' : toast.type === 'error' ? 'var(--danger-bg)' : 'var(--accent-bg)',
          border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : toast.type === 'error' ? '#fecaca' : 'var(--accent-bg)'}`,
          color: toast.type === 'success' ? 'var(--success)' : toast.type === 'error' ? 'var(--danger)' : 'var(--accent-2)',
        }}>
          {toast.type === 'success' ? <CheckCircle style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: 2 }} /> :
           toast.type === 'error' ? <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: 2 }} /> :
           <Activity style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: 2 }} />}
          <span style={{ flex: 1, whiteSpace: 'pre-line' }}>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, opacity: 0.6 }}>
            <XCircle style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      )}
      <PageHeader
        title={t("flux.title")}
        subtitle={t("flux.subtitle")}
      />

      {!canAddChannel && (
        <div className="feedplug-shell-card" style={{
          marginBottom: '20px',
          padding: '14px 16px',
          backgroundColor: 'var(--warning-bg)',
          border: '1px solid var(--warning)',
          fontSize: '14px',
          color: 'var(--warning)'
        }}>
          {t("fluxPage.limitReached", { count: channelsCount, max: maxChannels })} <Link href={`/${locale}/tarifs`} prefetch={false} style={{ fontWeight: 600, color: 'var(--warning)', textDecoration: 'underline' }}>{t("fluxPage.pricingLinkLabel")}</Link>{t("fluxPage.limitReachedSuffix")}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <DashboardSection title="Connexions de diffusion" description="Reliez vos plateformes principales pour exporter ou pousser automatiquement votre catalogue.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
            <PageCard style={{ borderColor: gmcStatus.connected ? '#bbf7d0' : 'var(--line)', backgroundColor: gmcStatus.connected ? 'var(--success-bg)' : '#ffffff', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', backgroundColor: gmcStatus.connected ? 'var(--success-bg)' : 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Globe style={{ width: '22px', height: '22px', color: gmcStatus.connected ? 'var(--success)' : 'var(--ink-3)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 2px' }}>Google Merchant Center</p>
                    <p style={{ fontSize: '13px', color: gmcStatus.connected ? 'var(--success)' : 'var(--ink-3)', margin: 0 }}>
                      {gmcStatus.connected
                        ? `Connecte - ${gmcStatus.email || 'Compte Google'} ${gmcStatus.merchantName ? `(${gmcStatus.merchantName}) ` : ''}${gmcStatus.merchantId ? `(MC ${gmcStatus.merchantId})` : ''}`
                        : 'Connectez votre compte pour pousser automatiquement vos produits'}
                    </p>
                  </div>
                </div>
                {gmcStatus.connected ? (
                  <PageButtonSecondary onClick={requestDisconnectGMC} disabled={gmcLoading}>
                    {gmcLoading ? 'Deconnexion...' : 'Deconnecter'}
                  </PageButtonSecondary>
                ) : (
                  <PageButtonPrimary onClick={handleConnectGMC} disabled={gmcLoading}>
                    {gmcLoading ? t("fluxPage.connecting") : t("fluxPage.connectGoogle")}
                  </PageButtonPrimary>
                )}
              </div>
            </PageCard>

            <PageCard style={{ borderColor: amazonStatus.connected ? 'var(--warning)' : 'var(--line)', backgroundColor: amazonStatus.connected ? 'var(--warning-bg)' : '#ffffff', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', backgroundColor: amazonStatus.connected ? 'var(--warning-bg)' : 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShoppingCart style={{ width: '22px', height: '22px', color: amazonStatus.connected ? 'var(--warning)' : 'var(--ink-3)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 2px' }}>Amazon Seller Central</p>
                    <p style={{ fontSize: '13px', color: amazonStatus.connected ? 'var(--warning)' : 'var(--ink-3)', margin: 0 }}>
                      {amazonStatus.connected
                        ? `Connecte ${amazonStatus.sellerId ? `(Seller ${amazonStatus.sellerId})` : ''}`
                        : 'Connectez votre compte pour pousser vos produits vers Amazon FR, UK, DE, IT, ES'}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {amazonStatus.connected ? (
                    <PageButtonSecondary onClick={requestDisconnectAmazon} disabled={amazonLoading}>Deconnecter</PageButtonSecondary>
                  ) : (
                    <PageButtonPrimary onClick={handleConnectAmazon} disabled={amazonLoading}>
                      {amazonLoading ? t("fluxPage.connecting") : t("fluxPage.connectAmazon")}
                    </PageButtonPrimary>
                  )}
                  <Link href={`/${locale}/channels`} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
                    Gérer les canaux →
                  </Link>
                </div>
              </div>
            </PageCard>
          </div>
        </DashboardSection>

      {/* Push result */}
      {pushResult && (() => {
        const hasErrors = (pushResult.failed ?? 0) > 0;
        const allFailed = hasErrors && (pushResult.succeeded ?? 0) === 0;
        const hasNoProducts = (pushResult.total ?? 0) === 0 && (pushResult.succeeded ?? 0) === 0 && !hasErrors;
        const isMca = pushResult.mcaError === true;
        const firstError = !isMca ? (pushResult.errors?.[0]?.errors?.[0] || pushResult.errors?.[0]?.error) : undefined;
        const borderColor = allFailed ? 'var(--danger)' : hasErrors ? 'var(--warning)' : hasNoProducts ? 'var(--line-strong)' : 'var(--success)';
        const bgColor = allFailed ? 'var(--danger-bg)' : hasErrors ? 'var(--warning-bg)' : hasNoProducts ? 'var(--paper-2)' : 'var(--success-bg)';
        const textColor = allFailed ? 'var(--danger)' : hasErrors ? 'var(--warning)' : hasNoProducts ? 'var(--ink-2)' : 'var(--success)';
        const subColor = allFailed ? 'var(--danger)' : hasErrors ? 'var(--warning)' : hasNoProducts ? 'var(--ink-3)' : 'var(--success)';
        return (
          <div className="feedplug-shell-card" style={{ border: `1px solid ${borderColor}`, padding: '16px 20px', backgroundColor: bgColor, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderRadius: '14px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', fontWeight: '600', color: textColor, margin: '0 0 4px' }}>
                {isMca ? 'Compte MCA détecté' : allFailed ? 'Push échoué' : hasNoProducts ? 'Aucun produit à pousser' : 'Push terminé'}
                {!isMca && !hasNoProducts && ` — ${pushResult.succeeded ?? 0} produits envoyés${hasErrors ? `, ${pushResult.failed ?? 0} erreurs` : ''}`}
              </p>
              <p style={{ fontSize: '12px', color: subColor, margin: 0 }}>
                {isMca
                  ? 'Le compte Google Merchant Center connecté est un agrégateur (MCA). Les produits ne peuvent pas être envoyés directement sur un compte MCA — reconnectez en sélectionnant un sous-compte enfant.'
                  : hasNoProducts
                  ? (pushResult.message || 'Ce flux ne contient actuellement aucun produit eligible pour Google Merchant Center.')
                  : t("fluxPage.totalProducts", { total: pushResult.total ?? 0 })}
              </p>
              {firstError && (
                <p style={{ fontSize: '12px', color: textColor, margin: '6px 0 0', fontStyle: 'italic' }}>{firstError}</p>
              )}
              {isMca && (
                <button
                  onClick={() => { setPushResult(null); handleConnectGMC(); }}
                  style={{ marginTop: '10px', padding: '6px 14px', backgroundColor: 'var(--danger)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}
                >
                  Reconnecter Google Merchant Center
                </button>
              )}
            </div>
            <button onClick={() => setPushResult(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--ink-3)', marginLeft: '12px' }}>×</button>
          </div>
        );
      })()}

        <DashboardSection
          title="Surface multi-plateforme"
          description="La diffusion ne se limite pas a Google et Amazon: vous pouvez couvrir shopping, marketplaces, social ads, international et assistants IA."
        >
          <DashboardStatGrid>
            <DashboardStatCard
              icon={<Globe size={20} />}
              label="Canaux supportes"
              value={SUPPORTED_CHANNELS.length}
              hint="Surface totale de diffusion disponible"
              accent="var(--ink)"
            />
            <DashboardStatCard
              icon={<ShoppingCart size={20} />}
              label="Push directs"
              value={directPushChannels.length}
              hint="Canaux pouvant etre pousses directement une fois relies"
              accent="var(--ink)"
            />
            <DashboardStatCard
              icon={<Download size={20} />}
              label="Exports prets"
              value={exportReadyChannels.length}
              hint="Canaux accessibles via export catalogue"
              accent="var(--ink)"
            />
            <DashboardStatCard
              icon={<FileText size={20} />}
              label="Assistants IA"
              value={aiChannels.length}
              hint="Sorties dediees a ChatGPT, Gemini et Perplexity"
              accent="var(--ink)"
            />
          </DashboardStatGrid>

          <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginTop: '20px' }}>
            {distributionFamilies.map((family) => (
              <PageCard
                key={family.key}
                style={{
                  border: `1px solid ${family.meta.border}`,
                  backgroundColor: family.meta.background,
                  boxShadow: '0 10px 28px rgba(15,23,42,0.04)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: family.meta.accent }}>
                        {family.meta.label}
                      </p>
                      <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.6 }}>
                        {family.channels.length} canal{family.channels.length > 1 ? 'aux' : ''} dans cette famille.
                      </p>
                    </div>
                    <span style={{ padding: '6px 10px', borderRadius: '999px', backgroundColor: '#fff', border: `1px solid ${family.meta.border}`, color: family.meta.accent, fontSize: '12px', fontWeight: 700 }}>
                      {family.channels.filter((channel) => channel.statusLabel === 'Push connecte').length} relies
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {family.channels.map((channel) => (
                      <div
                        key={channel.key}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '14px',
                          border: `1px solid ${channel.statusTone.border}`,
                          backgroundColor: channel.statusTone.background,
                          minWidth: '120px',
                        }}
                      >
                        <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
                          {channel.label}
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: channel.statusTone.color }}>
                          {channel.statusLabel}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </PageCard>
            ))}
          </div>
        </DashboardSection>

        <DashboardSection
          title="État de diffusion"
          description="Vérifiez d’abord ce qui est prêt, ce qui manque et quelle action débloque le plus vite vos exports."
        >
          <DashboardStatGrid>
            <DashboardStatCard
              icon={<Activity size={20} />}
              label="Flux actifs"
              value={activeFeedsCount}
              hint={`${activeFeedsCount} sur ${feeds.length} prêts ou actifs`}
              accent="var(--ink)"
            />
            <DashboardStatCard
              icon={<Globe size={20} />}
              label="Canaux connectés"
              value={connectedChannelsCount}
              hint={connectedChannelsCount > 0 ? availableChannelsLabel : 'Aucun canal relié'}
              accent={connectedChannelsCount > 0 ? 'var(--success)' : 'var(--accent)'}
            />
            <DashboardStatCard
              icon={<AlertCircle size={20} />}
              label="À vérifier"
              value={attentionFeedsCount}
              hint={attentionFeedsCount > 0 ? 'Flux inactifs, en attente ou en erreur' : 'Aucun blocage signalé'}
              accent={attentionFeedsCount > 0 ? 'var(--warning)' : 'var(--ink-4)'}
            />
          </DashboardStatGrid>

          <PageCard style={{ marginTop: '20px', padding: '20px 22px', border: '1px solid rgba(226,232,240,0.9)', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: nextAction.tone, margin: '0 0 8px' }}>
                  Prochaine action
                </p>
                <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
                  {nextAction.title}
                </h3>
                <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--ink-3)', margin: 0, maxWidth: '760px' }}>
                  {nextAction.description}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {feeds.length === 0 ? (
                  <PageButtonPrimary onClick={() => setShowCreateModal(true)}>
                    <Plus style={{ width: '16px', height: '16px' }} />
                    Nouveau flux d&apos;export
                  </PageButtonPrimary>
                ) : connectedChannelsCount === 0 ? (
                  <>
                    <PageButtonPrimary onClick={handleConnectGMC} disabled={gmcLoading}>
                      {gmcLoading ? t("fluxPage.connecting") : t("fluxPage.connectGoogle")}
                    </PageButtonPrimary>
                    <PageButtonSecondary onClick={handleConnectAmazon} disabled={amazonLoading}>
                      {amazonLoading ? t("fluxPage.connecting") : t("fluxPage.connectAmazon")}
                    </PageButtonSecondary>
                  </>
                ) : (
                  <>
                    <PageButtonPrimary onClick={() => setShowCreateModal(true)}>
                      <Plus style={{ width: '16px', height: '16px' }} />
                      Nouveau flux d&apos;export
                    </PageButtonPrimary>
                    <Link href={`/${locale}/catalogue`} prefetch={false} style={{ textDecoration: 'none' }}>
                      <PageButtonSecondary>Voir le catalogue</PageButtonSecondary>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </PageCard>
        </DashboardSection>

        <DashboardSection
          title="Audit de flux"
          description="Analysez la qualite marchande du flux, les blocages prioritaires et le potentiel recuperable si vous optimisez les champs critiques."
          actions={feeds.length > 0 ? (
            <select
              value={selectedAuditFeedId ?? ''}
              onChange={(event) => setSelectedAuditFeedId(event.target.value)}
              style={{
                minHeight: 40,
                borderRadius: 12,
                border: '1px solid rgba(148,163,184,0.35)',
                padding: '0 14px',
                backgroundColor: '#fff',
                color: 'var(--ink)',
                fontSize: 14,
              }}
            >
              {feeds.map((feed) => (
                <option key={feed.id} value={feed.id}>
                  {feed.name}
                </option>
              ))}
            </select>
          ) : null}
        >
          {loading ? (
            <PageLoading message="Preparation de l'audit du flux..." />
          ) : !selectedAuditFeed ? (
            <EmptyState
              icon={BarChart3}
              title="Aucun flux a auditer"
              description="Creez un premier flux d'export pour obtenir un score sur 100 et des priorites actionnables."
            />
          ) : auditError ? (
            <PageError message={auditError} />
          ) : auditLoading || !feedAudit ? (
            <PageLoading message="Calcul de l'audit du flux..." />
          ) : (
            <>
              <DashboardStatGrid>
                <DashboardStatCard
                  icon={<BarChart3 size={20} />}
                  label="Score flux"
                  value={`${feedAudit.score}/100`}
                  hint={`${selectedAuditFeed.name} · ${feedAudit.summary.totalProducts} produits analyses`}
                  accent="var(--ink)"
                />
                <DashboardStatCard
                  icon={<TrendingUp size={20} />}
                  label="Potentiel avec accompagnement"
                  value={`${feedAudit.potentialScore}/100`}
                  hint={`Jusqu'a +${feedAudit.estimatedVisibilityLiftPct}% de visibilite estimee`}
                  accent="var(--ink)"
                />
                <DashboardStatCard
                  icon={<CheckCircle size={20} />}
                  label="Produits recuperables"
                  value={feedAudit.estimatedAdditionalApprovedProducts}
                  hint="Produits supplementaires potentiellement diffusable apres correction"
                  accent="var(--ink)"
                />
              </DashboardStatGrid>

              <PageCard style={{ marginTop: '20px', border: '1px solid rgba(226,232,240,0.9)', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}>
                <div style={{ display: 'grid', gap: '18px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  {[
                    { label: 'Couverture des donnees', value: feedAudit.scoreBreakdown.dataCoverage, tone: 'var(--accent)' },
                    { label: 'Qualite produit moyenne', value: feedAudit.scoreBreakdown.productQuality, tone: 'var(--accent-2)' },
                    { label: 'Readiness canal', value: feedAudit.scoreBreakdown.channelReadiness, tone: 'var(--accent)' },
                    { label: 'Produits deja prets', value: feedAudit.summary.approvalReadyRate, tone: 'var(--success)', suffix: '%' },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: '16px 0' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--ink-3)' }}>{item.label}</p>
                      <p style={{ margin: '10px 0 6px', fontSize: '30px', fontWeight: 700, letterSpacing: '-0.04em', color: item.tone }}>
                        {item.value}{item.suffix ?? '/100'}
                      </p>
                      <div style={{ height: '8px', borderRadius: '999px', backgroundColor: 'var(--line)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(4, Math.min(item.value, 100))}%`, height: '100%', borderRadius: '999px', backgroundColor: item.tone }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '13px', lineHeight: 1.6, color: 'var(--ink-3)' }}>
                  Estimation issue de l&apos;audit technique du flux. {feedAudit.methodology.estimation}
                </p>
              </PageCard>

              <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                {feedAudit.topIssues.map((issue) => {
                  const accent = getIssueAccent(issue.severity);
                  return (
                    <PageCard
                      key={issue.key}
                      style={{
                        border: `1px solid ${accent.border}`,
                        backgroundColor: accent.background,
                        boxShadow: '0 10px 28px rgba(15,23,42,0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <div>
                          <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent.text }}>
                            {accent.label}
                          </p>
                          <h3 style={{ margin: '10px 0 6px', fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>
                            {issue.label}
                          </h3>
                        </div>
                        <span style={{ padding: '6px 10px', borderRadius: '999px', backgroundColor: '#fff', border: `1px solid ${accent.border}`, color: accent.text, fontSize: '12px', fontWeight: 700 }}>
                          {issue.affectedRate}%
                        </span>
                      </div>
                      <p style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.6 }}>
                        {issue.affectedProducts} produits concernes. {issue.impact}
                      </p>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.6 }}>
                        Action recommandee: {issue.recommendation}
                      </p>
                    </PageCard>
                  );
                })}
              </div>
            </>
          )}
        </DashboardSection>

      {/* Filtres */}
        <DashboardSection
          title="Vos flux d'export"
          description="Chaque flux represente une sortie catalogue vers un canal, un reseau ou un assistant IA."
          actions={
            <span
              style={{
                minHeight: 40,
                padding: '0 14px',
                borderRadius: 999,
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'var(--app-accent-soft)',
                color: 'var(--app-accent-strong)',
                border: '1px solid rgba(15, 118, 110, 0.16)',
              }}
            >
              Tous ({feeds.length})
            </span>
          }
        >

      {/* Liste des flux */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? (
          <PageLoading message={t("fluxPage.loadingFeeds")} />
        ) : error ? (
          <PageError message={error} />
        ) : filteredFlows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("fluxPage.noFluxTitle")}
            description="Créez une source dans l'onglet Sources pour commencer."
          />
        ) : (
          filteredFlows.map((feed) => {
            const readiness = feedReadinessMap.get(feed.id) ?? getFeedReadiness(feed);
            return (
            <PageCard key={feed.id} style={{ 
              padding: '20px',
              transition: 'all 0.2s ease',
              border: '1px solid rgba(226,232,240,0.9)',
              boxShadow: '0 10px 28px rgba(15,23,42,0.04)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--app-border-strong)';
              e.currentTarget.style.boxShadow = 'var(--app-shadow-md)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--app-border)';
              e.currentTarget.style.boxShadow = 'var(--card-shadow)';
            }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', backgroundColor: feed.status === 'ERROR' ? 'var(--danger-bg)' : 'var(--accent-bg)', borderRadius: '14px' }}>
                    <FileText style={{ width: '20px', height: '20px', color: readiness.priority === 'attention' ? 'var(--danger)' : 'var(--accent)' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                        {feed.name}
                      </h3>
                      {getReadinessBadge(readiness)}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ padding: '5px 10px', borderRadius: '999px', backgroundColor: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)', fontSize: '12px', fontWeight: 500 }}>
                        Source {feed.source?.name ?? '—'}
                      </span>
                      <span style={{ padding: '5px 10px', borderRadius: '999px', backgroundColor: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)', fontSize: '12px', fontWeight: 500 }}>
                        {formatFrequency(feed.frequency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleAutoPush(feed.id, feed.autoPushEnabled === true)}
                        disabled={togglingAutoPushId === feed.id}
                        title="Pousse automatiquement ce flux vers vos canaux connectés (GMC / Amazon) une fois par jour."
                        style={{
                          padding: '5px 10px',
                          borderRadius: '999px',
                          backgroundColor: feed.autoPushEnabled ? 'var(--success-bg)' : 'var(--paper-2)',
                          border: `1px solid ${feed.autoPushEnabled ? '#bbf7d0' : 'var(--line)'}`,
                          color: feed.autoPushEnabled ? 'var(--success)' : 'var(--ink-3)',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: togglingAutoPushId === feed.id ? 'wait' : 'pointer',
                        }}
                      >
                        {feed.autoPushEnabled ? '✓ Synchro auto' : 'Synchro auto'}
                      </button>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px', position: 'relative', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                      <button 
                        onClick={() => setExportMenuFeedId(exportMenuFeedId === feed.id ? null : feed.id)}
                        disabled={!!exportingId}
                        style={{ 
                          border: '1px solid #0a0a0a', 
                          color: '#0a0a0a', 
                          padding: '6px 12px', 
                          borderRadius: '10px', 
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: 'white',
                          cursor: exportingId ? 'wait' : 'pointer'
                        }}
                      >
                        <Download style={{ width: '12px', height: '12px' }} />
                        {exportingId === feed.id ? 'Export...' : 'CSV'}
                      </button>
                      {exportMenuFeedId === feed.id && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, minWidth: '260px', maxHeight: '70vh', overflowY: 'auto', padding: '4px 0' }}>
                          <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '600', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Moteurs de recherche
                          </div>
                          {gmcPushTargets.length > 0 ? (
                            gmcPushTargets.map((target) => (
                              <button key={target.destinationId} type="button" onClick={() => handleExportGmcTarget(feed.id, target)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                                {`Google Merchant Center · ${target.label}`}
                              </button>
                            ))
                          ) : (
                            <button type="button" onClick={() => handleExportCsv(feed.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                              Google Merchant Center
                            </button>
                          )}
                          <button type="button" onClick={() => handleExportPlatform(feed.id, 'Google Local Inventory Ads', () => exportFeedAsCsvLia(feed.id))} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            Google Local Inventory Ads (LIA)
                          </button>
                          <button type="button" onClick={() => handleExportPlatform(feed.id, 'Bing', () => exportFeedAsCsvBing(feed.id))} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            Bing / Microsoft
                          </button>
                          <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }} />
                          <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '600', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Réseaux sociaux
                          </div>
                          <button type="button" onClick={() => handleExportCsvMeta(feed.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            Meta (Facebook / Instagram)
                          </button>
                          <button type="button" onClick={() => handleExportPlatform(feed.id, 'Pinterest', () => exportFeedAsCsvPinterest(feed.id))} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            Pinterest
                          </button>
                          <button type="button" onClick={() => handleExportPlatform(feed.id, 'TikTok', () => exportFeedAsCsvTikTok(feed.id))} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            TikTok Shop
                          </button>
                          <button type="button" onClick={() => handleExportPlatform(feed.id, 'Snapchat', () => exportFeedAsCsvSnapchat(feed.id))} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            Snapchat
                          </button>
                          <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }} />
                          <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '600', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Marketplaces
                          </div>
                          {(amazonPushTargets.length > 0
                            ? amazonPushTargets
                            : AMAZON_EXPORT_CHANNELS.map((ch) => ({
                                destinationId: '',
                                label: ch.label,
                                channelKey: ch.channelKey,
                              }))
                          ).map((target) => (
                            <button
                              key={target.destinationId || target.channelKey}
                              type="button"
                              onClick={() => target.destinationId ? handleExportAmazonTarget(feed.id, target) : handleExportCsvAmazon(feed.id, target.channelKey || 'amazon_fr')}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}
                            >
                              {target.label}
                            </button>
                          ))}
                          <button type="button" onClick={() => handleExportCsvCdiscount(feed.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            Cdiscount
                          </button>
                          <button type="button" onClick={() => handleExportCsvRakuten(feed.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            Rakuten
                          </button>
                          <button type="button" onClick={() => handleExportPlatform(feed.id, 'Yandex', () => exportFeedAsCsvYandex(feed.id))} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            Yandex Market
                          </button>
                          <button type="button" onClick={() => handleExportPlatform(feed.id, 'Baidu', () => exportFeedAsCsvBaidu(feed.id))} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            Baidu
                          </button>
                          <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }} />
                          <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '600', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            LLM / IA
                          </div>
                          <button type="button" onClick={() => handleExportChatGPT(feed.id, 'json')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            ChatGPT (JSON)
                          </button>
                          <button type="button" onClick={() => handleExportChatGPT(feed.id, 'csv')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            ChatGPT (CSV)
                          </button>
                          <button type="button" onClick={() => handleExportPlatform(feed.id, 'Perplexity', () => exportFeedAsCsvPerplexity(feed.id))} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            Perplexity
                          </button>
                          <button type="button" onClick={() => handleExportPlatform(feed.id, 'Gemini', () => exportFeedAsCsvGemini(feed.id))} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                            Google Gemini
                          </button>
                        </div>
                      )}
                    </div>
                    {gmcStatus.connected && (
                      gmcPushTargets.length > 1 ? (
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setGmcPushMenuFeedId(gmcPushMenuFeedId === feed.id ? null : feed.id)}
                            disabled={!!pushingId}
                            style={{
                              border: '1px solid var(--success)',
                              color: 'var(--success)',
                              padding: '6px 12px',
                              borderRadius: '10px',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: 'white',
                              cursor: pushingId ? 'wait' : 'pointer',
                              fontWeight: '600'
                            }}
                          >
                            <Play style={{ width: '12px', height: '12px' }} />
                            {pushingId === feed.id ? 'Push...' : 'Push Google'}
                          </button>
                          {gmcPushMenuFeedId === feed.id && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, minWidth: '220px', padding: '4px 0' }}>
                              {gmcPushTargets.map((target) => (
                                <button key={target.destinationId} type="button" onClick={() => handlePushGMC(feed.id, target)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                                  {target.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePushGMC(feed.id, gmcPushTargets[0] || null)}
                          disabled={!!pushingId}
                          style={{
                              border: '1px solid var(--success)',
                              color: 'var(--success)',
                              padding: '6px 12px',
                              borderRadius: '10px',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'white',
                            cursor: pushingId ? 'wait' : 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          <Play style={{ width: '12px', height: '12px' }} />
                          {pushingId === feed.id ? 'Push...' : 'Push GMC'}
                        </button>
                      )
                    )}
                    {amazonStatus.connected && (
                      <div style={{ position: 'relative' }}>
                        <button 
                          onClick={() => setAmazonPushMenuFeedId(amazonPushMenuFeedId === feed.id ? null : feed.id)}
                          disabled={!!pushingId}
                          style={{ 
                            border: '1px solid var(--warning)', 
                            color: 'var(--warning)', 
                            padding: '6px 12px', 
                            borderRadius: '10px', 
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'white',
                            cursor: pushingId ? 'wait' : 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          <Play style={{ width: '12px', height: '12px' }} />
                          {pushingId === feed.id ? 'Push...' : 'Push Amazon'}
                        </button>
                        {amazonPushMenuFeedId === feed.id && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, minWidth: '160px', padding: '4px 0' }}>
                            {(amazonPushTargets.length > 0
                              ? amazonPushTargets
                              : AMAZON_EXPORT_CHANNELS.map((ch) => ({
                                  destinationId: '',
                                  label: ch.label,
                                  channelKey: ch.channelKey,
                                }))
                            ).map((target) => (
                              <button key={target.destinationId || target.channelKey} type="button" onClick={() => handlePushAmazon(feed.id, target)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                                {target.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedAuditFeedId(feed.id)}
                      style={{
                        border: selectedAuditFeedId === feed.id ? '1px solid var(--accent)' : '1px solid var(--line-strong)',
                        color: selectedAuditFeedId === feed.id ? 'var(--accent)' : 'var(--ink-2)',
                        padding: '6px 12px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      <BarChart3 style={{ width: '12px', height: '12px' }} />
                      Auditer ce flux
                    </button>
                    <Link href={`/${locale}/catalogue?feed=${feed.id}`} prefetch={false} style={{ textDecoration: 'none' }}>
                      <PageButtonSecondary>Voir le catalogue</PageButtonSecondary>
                    </Link>
                  </div>
                </div>
              </div>
              
                <div
                style={{
                  marginTop: '16px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${readiness.accent}22`,
                  backgroundColor: readiness.background,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: readiness.accent, margin: '0 0 4px' }}>
                      {readiness.label}
                    </p>
                    <p style={{ fontSize: '14px', color: 'var(--ink-2)', margin: 0 }}>
                      {readiness.description}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxWidth: '480px' }}>
                    <span style={{ padding: '5px 10px', borderRadius: '999px', backgroundColor: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', fontSize: '12px', color: 'var(--ink-2)', fontWeight: 500 }}>
                      {feed.source?.connector ?? '—'}
                    </span>
                    <span style={{ padding: '5px 10px', borderRadius: '999px', backgroundColor: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', fontSize: '12px', color: 'var(--ink-2)', fontWeight: 500 }}>
                      Dernière exécution: {formatDateTime(feed.source?.lastRunAt)}
                    </span>
                    <span style={{ padding: '5px 10px', borderRadius: '999px', backgroundColor: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', fontSize: '12px', color: 'var(--ink-2)', fontWeight: 500 }}>
                      {readiness.nextStep}
                    </span>
                  </div>
                </div>
              </div>
            </PageCard>
          )})
        )}
      </div>
      </DashboardSection>

      {/* Guide contextuel d'onboarding */}
      {!onboardingState.isCompleted && onboardingState.currentStep === 2 && (
        <FluxGuide />
      )}

      </div>

      {/* Modal de création d'export */}
      <CreateExportModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />
    </PageLayout>
  );
}
