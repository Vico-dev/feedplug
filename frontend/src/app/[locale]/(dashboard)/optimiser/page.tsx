"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Loader2,
  Play,
  Plus,
  Sparkles,
  TestTube,
  Wand2,
  Workflow,
  Zap,
  ArrowRight,
  Settings,
  Eye,
  Target,
  Trophy,
  TrendingUp,
  XCircle,
  Sliders,
  BarChart3,
  ShoppingCart,
  Type,
  LayoutList,
  Image as ImageIcon,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Save,
  RefreshCw,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { apiClient, authFetch, API_BASE_URL } from "@/lib/api";
import { getLocalePrefixFromPathname } from "@/lib/locale-navigation";
import { getFeeds } from "@/lib/services/flux.service";
import { getMarkets } from "@/lib/services/markets.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  EmptyState,
  PageCard,
  PageError,
  PageHeader,
  PageLayout,
  PageLoading,
  PageSectionTitle,
} from "@/components/layout";
import { RuleModal } from "@/components/optimiser/rule-modal";
import { AutomationCard } from "@/components/optimiser/automation-card";
import type { Rule } from "@/components/optimiser/types";
import {
  CHANNEL_FAMILY_META,
  SUPPORTED_CHANNELS,
  getChannelLabel as getSupportedChannelLabel,
} from "@/lib/channels/catalog";
import { formatLocaleLabel, getPlatformLabel } from "@/lib/markets";

const CHANNELS = SUPPORTED_CHANNELS.map(({ key, label }) => ({ key, label }));

type TabView = "rules" | "ab-tests" | "ia";
type FilterView = "all" | "active" | "paused" | "ai" | "ab";
type FieldChangeType = 'add_brand' | 'add_price' | 'add_keyword' | 'uppercase' | 'shorten' | 'add_emoji' | 'rewrite_ai' | 'lifestyle_image' | 'white_background' | 'custom' | 'replace_text' | 'prepend_text' | 'append_text';
type Platform = 'GMC' | 'META' | 'AMAZON' | 'CHATGPT' | 'CDISCOUNT' | 'RAKUTEN';

interface CustomTransformation {
  field: 'title' | 'description';
  type: 'replace' | 'prepend' | 'append' | 'remove';
  searchValue?: string;
  replaceValue?: string;
}
type ABTestStatus = 'DRAFT' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';

interface ABTest {
  id: string;
  name: string;
  platform: string;
  fieldUnderTest?: string;
  status: ABTestStatus;
  startDate: string | null;
  endDate: string | null;
  minDurationDays: number;
  controlPercent: number;
  variantPercent: number;
  prerequisitesMet: boolean | null;
  assignmentCount?: number;
  controlCount?: number;
  variantCount?: number;
  resultSummary?: { winner?: 'CONTROL' | 'VARIANT' | 'TIE'; improvement?: number };
  createdAt: string;
}

interface TemplateDefinition {
  id: string;
  title: string;
  description: string;
  helper: string;
  badge?: string;
  rule: Rule;
  example?: { before: string; after: string };
}

interface ApiError {
  response?: { data?: { message?: string; error?: string; errors?: string[] } };
  message?: string;
}

interface PreviewItem {
  itemId: string;
  title: string;
  matches: boolean;
  before: { title?: string; price?: number; brand?: string } | null;
  after: { title?: string; price?: number; brand?: string } | null;
}

interface RuleDestinationOption {
  id: string;
  label: string;
  platformKey: string;
}

interface ABTestConfig {
  step: number;
  name: string;
  platform: Platform;
  products: { filter: any; selectedIds: string[] };
  modifications: { field: 'title' | 'description' | 'image'; changes: { type: FieldChangeType; value?: string }[] }[];
  customTransformations: CustomTransformation[];
  durationDays: number;
  trafficSplit: number;
}

interface PreviewProduct {
  id: string;
  title: string;
  description?: string;
  brand?: string;
  price?: string;
  modifiedTitle?: string;
  modifiedDescription?: string;
}

const AUTOMATION_TEMPLATES: TemplateDefinition[] = [
  {
    id: "google-category-ai",
    title: "Compléter les catégories Google",
    description: "Laissez l'IA remplir les catégories manquantes pour améliorer le reach.",
    helper: "IA uniquement si la catégorie est vide.",
    badge: "IA",
    example: { before: "Chaussures", after: "Apparel & Accessories > Shoes" },
    rule: {
      name: "Compléter la catégorie Google si vide",
      conditionJson: { operator: "AND", conditions: [{ field: "google_product_category", operator: "is_empty" }] },
      actionJson: { type: "ai_fill", params: { field: "google_product_category" } },
      channelIds: ["gmc"], feedIds: [], runOnIngestion: true, priority: 0, isActive: true,
    },
  },
  {
    id: "brand-title",
    title: "Enrichir les titles avec la marque",
    description: "Ajoutez la marque au début des titles pour plus de contexte marchand.",
    helper: "Si la marque est renseignée.",
    badge: "Titre",
    example: { before: "Air Max 90", after: "Nike Air Max 90" },
    rule: {
      name: "Ajouter la marque au titre",
      conditionJson: { operator: "AND", conditions: [{ field: "brand", operator: "is_not_empty" }] },
      actionJson: { type: "template", params: { field: "title", template: "{brand} - {title}" } },
      channelIds: [], feedIds: [], runOnIngestion: true, priority: 20, isActive: true,
    },
  },
  {
    id: "out-of-stock",
    title: "Exclure les produits hors stock",
    description: "Évitez de diffuser des références indisponibles sur Google.",
    helper: "Supprime de la diffusion les produits hors stock.",
    badge: "Exclusion",
    example: { before: "Air Max 90 - Publié", after: "Air Max 90 - Exclu" },
    rule: {
      name: "Exclure produits hors stock",
      conditionJson: { operator: "AND", conditions: [{ field: "availability", operator: "equals", value: "out of stock" }] },
      actionJson: { type: "exclude", params: {} },
      channelIds: ["gmc"], feedIds: [], runOnIngestion: true, priority: 5, isActive: true,
    },
  },
  {
    id: "amazon-mpn",
    title: "Ajouter le MPN depuis le SKU",
    description: "Copiez le SKU dans le MPN pour les marketplaces qui l'exigent.",
    helper: "Si le MPN est vide.",
    badge: "Amazon",
    rule: {
      name: "Copier SKU dans MPN si vide",
      conditionJson: { operator: "AND", conditions: [{ field: "customfields.mpn", operator: "is_empty" }] },
      actionJson: { type: "copy_field", params: { field: "customfields.mpn", sourceField: "sku" } },
      channelIds: ["amazon_fr", "amazon_uk", "amazon_de"], feedIds: [], runOnIngestion: true, priority: 10, isActive: true,
    },
  },
];

const FIELD_CHANGE_OPTIONS = {
  title: [
    { id: 'add_brand', label: 'Ajouter la marque' },
    { id: 'add_price', label: 'Ajouter le prix' },
    { id: 'uppercase', label: 'Tout en majuscules' },
    { id: 'shorten', label: 'Raccourcir' },
    { id: 'replace_text', label: 'Remplacer du texte' },
    { id: 'prepend_text', label: 'Ajouter au début' },
    { id: 'append_text', label: 'Ajouter à la fin' },
  ],
  description: [
    { id: 'shorten', label: 'Raccourcir' },
    { id: 'add_emoji', label: 'Ajouter émojis' },
    { id: 'replace_text', label: 'Remplacer du texte' },
    { id: 'prepend_text', label: 'Ajouter au début' },
    { id: 'append_text', label: 'Ajouter à la fin' },
  ],
  image: [
    { id: 'lifestyle_image', label: 'Photo lifestyle' },
    { id: 'white_background', label: 'Fond blanc' },
  ],
};

const PLATFORMS = [
  { id: 'GMC' as Platform, label: 'Google', icon: '🔍' },
  { id: 'META' as Platform, label: 'Meta', icon: '📘' },
  { id: 'AMAZON' as Platform, label: 'Amazon', icon: '📦' },
  { id: 'CHATGPT' as Platform, label: 'ChatGPT', icon: '🤖' },
];

const STATUS_CONFIG: Record<ABTestStatus, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Brouillon', color: 'var(--ink-3)', bg: 'var(--paper-2)' },
  RUNNING: { label: 'En cours', color: 'var(--accent)', bg: 'var(--accent-bg)' },
  COMPLETED: { label: 'Terminé', color: 'var(--success)', bg: 'var(--success-bg)' },
  CANCELLED: { label: 'Annulé', color: 'var(--danger)', bg: 'var(--danger-bg)' },
};

function formatConditionSentence(rule: Rule) {
  const conditions = rule.conditionJson?.conditions || [];
  if (conditions.length === 0) return "Tous les produits";
  const fieldLabels: Record<string, string> = { google_product_category: "catégorie Google", brand: "marque", title: "titre", price: "prix", availability: "disponibilité" };
  const opLabels: Record<string, string> = { is_empty: "est vide", is_not_empty: "n'est pas vide", equals: "=" };
  return conditions.map(c => `${fieldLabels[c.field] || c.field} ${opLabels[c.operator] || c.operator}${c.value ? ` ${c.value}` : ""}`).join(" et ");
}

function formatActionSentence(rule: Rule) {
  const params = rule.actionJson?.params || {};
  const actionLabels: Record<string, string> = { ai_fill: "compléter avec l'IA", template: "recomposer le titre", exclude: "exclure de la diffusion", copy_field: `copier ${params.sourceField}` };
  return actionLabels[rule.actionJson?.type || ""] || rule.actionJson?.type;
}

function formatAutomationSummary(rule: Rule) {
  return `${formatConditionSentence(rule)} → ${formatActionSentence(rule)}`;
}

export default function OptimiserPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const pathname = usePathname();
  const localePrefix = getLocalePrefixFromPathname(pathname);

  const [tab, setTab] = useState<TabView>("rules");
  const [rules, setRules] = useState<Rule[]>([]);
  const [abTests, setAbTests] = useState<ABTest[]>([]);
  const [feeds, setFeeds] = useState<{ id: string; name: string }[]>([]);
  const [destinations, setDestinations] = useState<RuleDestinationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [applying, setApplying] = useState(false);
  const [previewRuleId, setPreviewRuleId] = useState<string | null>(null);
  const [startingAbTestId, setStartingAbTestId] = useState<string | null>(null);
  const [view, setView] = useState<FilterView>("all");
  const [search, setSearch] = useState("");
  const [previewData, setPreviewData] = useState<{ ruleName: string; preview: PreviewItem[] } | null>(null);

  const [showAbModal, setShowAbModal] = useState(false);
  const [abConfig, setAbConfig] = useState<ABTestConfig>({
    step: 1, name: '', platform: 'GMC', products: { filter: {}, selectedIds: [] },
    modifications: [], customTransformations: [], durationDays: 14, trafficSplit: 50,
  });
  const [creatingAbTest, setCreatingAbTest] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<PreviewProduct[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const previewMatches = useMemo(() => previewData?.preview.filter(item => item.matches) || [], [previewData]);
  const previewedRule = useMemo(() => rules.find(rule => rule.id === previewRuleId) || null, [rules, previewRuleId]);

  const fetchRules = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get<{ rules: Rule[] }>("/rules");
      setRules(res.data.rules || []);
    } catch (e: unknown) {
      const apiError = e as ApiError;
      setError(apiError.response?.data?.message || apiError.message || t("optimiser.errorRules"));
    }
  }, [t]);

  const fetchAbTests = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/ab-tests`);
      if (res.ok) setAbTests(await res.json());
    } catch (e) { console.error('Erreur chargement tests:', e); }
  }, []);

  const fetchFeeds = useCallback(async () => {
    try {
      const list = await getFeeds();
      setFeeds(list.map(feed => ({ id: feed.id, name: feed.name || feed.id })));
    } catch { setFeeds([]); }
  }, []);

  const fetchMarkets = useCallback(async () => {
    try {
      const markets = await getMarkets();
      const nextDestinations = markets.flatMap((market) => {
        const localeById = new Map(market.locales.map((entry) => [entry.id, entry.localeCode]));
        return market.channels
          .filter((channel) => channel.isEnabled)
          .flatMap((channel) =>
            channel.destinations.map((destination) => {
              const localeCode = destination.marketLocaleId ? localeById.get(destination.marketLocaleId) ?? null : null;
              const suffix = localeCode ? ` · ${formatLocaleLabel(locale, localeCode)}` : "";
              return {
                id: destination.id,
                label: `${getPlatformLabel(destination.platformKey)} · ${market.name}${suffix}`,
                platformKey: destination.platformKey,
              };
            })
          );
      });
      setDestinations(nextDestinations);
    } catch {
      setDestinations([]);
    }
  }, [locale]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRules(), fetchAbTests(), fetchFeeds(), fetchMarkets()]).finally(() => setLoading(false));
  }, [fetchAbTests, fetchFeeds, fetchMarkets, fetchRules]);

  const counts = useMemo(() => ({
    total: rules.length,
    active: rules.filter(rule => rule.isActive).length,
    ai: rules.filter(rule => rule.actionJson?.type === "ai_fill").length,
    ab: abTests.length,
  }), [rules, abTests]);

  const channelCoverage = useMemo(() => {
    return Object.entries(CHANNEL_FAMILY_META).map(([familyKey, familyMeta]) => {
      const channels = SUPPORTED_CHANNELS.filter(channel => channel.family === familyKey)
        .map(channel => {
          const ruleCount = rules.filter((rule) => {
            if (rule.isActive === false) return false;
            const matchesChannel = (rule.channelIds?.length ?? 0) === 0 || (rule.channelIds || []).includes(channel.key);
            const matchesDestination = (rule.destinationIds || []).some((destinationId) => {
              const destination = destinations.find((entry) => entry.id === destinationId);
              return destination?.platformKey === channel.key || destination?.platformKey === channel.key.replace(/^amazon_.+$/, "amazon");
            });
            return matchesChannel || matchesDestination;
          }).length;
          return { ...channel, ruleCount };
        });
      return { key: familyKey, meta: familyMeta, channels, coveredCount: channels.filter(c => c.ruleCount > 0).length };
    });
  }, [destinations, rules]);

  function getFeedLabel(ids: string[]) {
    if (!ids?.length) return t("common.allFlux");
    return ids.map(id => feeds.find(f => f.id === id)?.name || id).join(", ");
  }

  function getChannelLabel(ids: string[]) {
    if (!ids?.length) return t("common.allChannels");
    return ids.map(id => getSupportedChannelLabel(id)).join(", ");
  }

  function getDestinationLabel(ids: string[]) {
    if (!ids?.length) return "";
    return ids
      .map((id) => destinations.find((destination) => destination.id === id)?.label || id)
      .join(", ");
  }

  function getRuleScopeLabel(rule: Rule) {
    const channelLabel = getChannelLabel(rule.channelIds || []);
    const destinationLabel = getDestinationLabel(rule.destinationIds || []);
    if (destinationLabel && (rule.channelIds?.length ?? 0) > 0) {
      return `${channelLabel} · ${destinationLabel}`;
    }
    if (destinationLabel) return destinationLabel;
    return channelLabel;
  }

  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      if (view === "active" && !rule.isActive) return false;
      if (view === "paused" && rule.isActive) return false;
      if (view === "ai" && rule.actionJson?.type !== "ai_fill") return false;
      if (!search.trim()) return true;
      const haystack = [
        rule.name,
        formatAutomationSummary(rule),
        getDestinationLabel(rule.destinationIds || []),
      ].join(" ").toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    });
  }, [destinations, rules, search, view]);

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await apiClient.post<{ applied: number; excluded: number }>("/rules/apply", {});
      alert(`Règles appliquées : ${res.data.applied} modifications, ${res.data.excluded} exclusions.`);
      fetchRules();
    } catch (e) { alert("Erreur : " + (e instanceof Error ? e.message : "Erreur")); }
    finally { setApplying(false); }
  };

  const openBlankAutomation = () => { setEditingRule(null); setShowModal(true); };

  const openTemplate = (template: TemplateDefinition) => {
    setEditingRule({
      ...template.rule,
      conditionJson: { operator: template.rule.conditionJson.operator, conditions: template.rule.conditionJson.conditions.map(c => ({ ...c })) },
      actionJson: { type: template.rule.actionJson.type, params: { ...(template.rule.actionJson.params || {}) } },
      feedIds: [...(template.rule.feedIds || [])],
      channelIds: [...(template.rule.channelIds || [])],
      destinationIds: [...(template.rule.destinationIds || [])],
    });
    setShowModal(true);
  };

  const handleSave = async (data: Partial<Rule>): Promise<{ id: string } | void> => {
    try {
      if (editingRule?.id) {
        const res = await apiClient.patch<Rule>(`/rules/${editingRule.id}`, data);
        setShowModal(false); setEditingRule(null); fetchRules();
        return res.data?.id ? { id: res.data.id } : undefined;
      }
      const res = await apiClient.post<Rule>("/rules", data);
      setShowModal(false); setEditingRule(null); fetchRules();
      return res.data?.id ? { id: res.data.id } : undefined;
    } catch (e: unknown) {
      const apiError = e as ApiError;
      throw new Error(apiError.response?.data?.errors?.join(", ") || apiError.response?.data?.message || apiError.message || "Erreur");
    }
  };

  const handleDelete = async (rule: Rule) => {
    if (!confirm(`Supprimer "${rule.name}" ?`)) return;
    try { await apiClient.delete(`/rules/${rule.id}`); fetchRules(); }
    catch (e) { alert("Erreur : " + (e instanceof Error ? e.message : "Erreur")); }
  };

  const handlePreview = async (rule: Rule) => {
    if (!rule.id) return;
    setPreviewRuleId(rule.id);
    setPreviewData(null);
    try {
      const res = await apiClient.post<{ ruleName: string; preview: PreviewItem[] }>(`/rules/${rule.id}/preview`, {
        limit: 5,
        channelId: rule.channelIds?.[0],
        destinationId: rule.destinationIds?.[0],
      });
      setPreviewData({ ruleName: res.data.ruleName, preview: res.data.preview });
    } catch (e) { alert("Erreur : " + (e instanceof Error ? e.message : "Erreur")); setPreviewRuleId(null); }
  };

  const handleToggleActive = async (rule: Rule) => {
    try { await apiClient.patch(`/rules/${rule.id}`, { isActive: !rule.isActive }); fetchRules(); }
    catch (e) { alert("Erreur : " + (e instanceof Error ? e.message : "Erreur")); }
  };

  const handleStartAbTest = async (rule: Rule) => {
    if (!rule.abTest?.id) return;
    setStartingAbTestId(rule.abTest.id);
    try {
      await authFetch(`${API_BASE_URL}/ab-tests/${rule.abTest.id}/start`, { method: 'POST' });
      fetchRules();
    } catch (e: unknown) {
      const apiError = e as ApiError;
      alert(apiError.response?.data?.message || "Impossible de démarrer le test");
    } finally { setStartingAbTestId(null); }
  };

  const handleStartAbTestFromId = async (testId: string) => {
    setStartingAbTestId(testId);
    try {
      await authFetch(`${API_BASE_URL}/ab-tests/${testId}/start`, { method: 'POST' });
      fetchAbTests();
    } catch (e: unknown) {
      const apiError = e as ApiError;
      alert(apiError.response?.data?.message || "Impossible de démarrer le test");
    } finally { setStartingAbTestId(null); }
  };

  const handleStopAbTest = async (testId: string) => {
    try { await authFetch(`${API_BASE_URL}/ab-tests/${testId}/stop`, { method: 'POST' }); fetchAbTests(); }
    catch (e) { console.error('Stop error:', e); }
  };

  const handleCreateAbTest = async () => {
    if (!abConfig.name || abConfig.modifications.length === 0) {
      alert('Veuillez remplir le nom et ajouter au moins une modification');
      return;
    }
    setCreatingAbTest(true);
    try {
      const variantTitles: Record<string, string> = {};
      abConfig.modifications.forEach(mod => {
        if (mod.field === 'title') {
          abConfig.products.selectedIds.forEach(id => {
            variantTitles[id] = `[Test] Titre modifié pour ${id}`;
          });
        }
      });
      const res = await authFetch(`${API_BASE_URL}/ab-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: abConfig.name,
          platform: abConfig.platform,
          fieldUnderTest: abConfig.modifications[0]?.field || 'title',
          controlPercent: abConfig.trafficSplit,
          variantPercent: 100 - abConfig.trafficSplit,
          minDurationDays: abConfig.durationDays,
          itemIds: abConfig.products.selectedIds.length > 0 ? abConfig.products.selectedIds : ['sample-1', 'sample-2'],
          variantTitles,
        }),
      });
      if (res.ok) { await fetchAbTests(); setShowAbModal(false); setAbConfig({ step: 1, name: '', platform: 'GMC', products: { filter: {}, selectedIds: [] }, modifications: [], customTransformations: [], durationDays: 14, trafficSplit: 50 }); }
      else { const err = await res.json(); alert(err.message || 'Erreur'); }
    } catch (e) { alert('Erreur lors de la création'); }
    finally { setCreatingAbTest(false); }
  };

  const addModification = (field: 'title' | 'description' | 'image', changeType: FieldChangeType) => {
    setAbConfig(prev => {
      const existing = prev.modifications.find(m => m.field === field);
      if (existing) return { ...prev, modifications: prev.modifications.map(m => m.field === field ? { ...m, changes: [...m.changes, { type: changeType }] } : m) };
      return { ...prev, modifications: [...prev.modifications, { field, changes: [{ type: changeType }] }] };
    });
  };

  const removeModification = (field: string, index: number) => {
    setAbConfig(prev => ({ ...prev, modifications: prev.modifications.map(m => m.field === field ? { ...m, changes: m.changes.filter((_, i) => i !== index) } : m).filter(m => m.changes.length > 0) }));
  };

  const addCustomTransformation = (field: 'title' | 'description', type: 'replace' | 'prepend' | 'append' | 'remove') => {
    setAbConfig(prev => ({
      ...prev,
      customTransformations: [...prev.customTransformations, { field, type }]
    }));
  };

  const updateCustomTransformation = (index: number, updates: Partial<CustomTransformation>) => {
    setAbConfig(prev => ({
      ...prev,
      customTransformations: prev.customTransformations.map((t, i) => i === index ? { ...t, ...updates } : t)
    }));
  };

  const removeCustomTransformation = (index: number) => {
    setAbConfig(prev => ({
      ...prev,
      customTransformations: prev.customTransformations.filter((_, i) => i !== index)
    }));
  };

  const loadPreviewProducts = async () => {
    if (abConfig.products.selectedIds.length === 0) return;
    setLoadingPreview(true);
    try {
      const res = await apiClient.get<{ items: any[] }>(`/ingestion/items?ids=${abConfig.products.selectedIds.slice(0, 10).join(',')}`);
      if (res.data?.items) {
        setPreviewProducts(res.data.items.map((item: any) => ({
          id: item.id,
          title: item.title || '',
          description: item.description || item.descriptiontext || '',
          brand: item.brand || '',
          price: item.price || ''
        })));
      }
    } catch {
      setPreviewProducts([
        { id: '1', title: 'Air Max 90', description: 'Chaussure de running légère', brand: 'Nike', price: '124€' },
        { id: '2', title: 'Ultraboost 22', description: 'Chaussure高性能', brand: 'Adidas', price: '180€' },
        { id: '3', title: 'Classic Leather', description: 'Basket rétro', brand: 'Reebok', price: '89€' },
      ]);
    } finally {
      setLoadingPreview(false);
    }
  };

  const applyTransformations = (text: string, transformations: CustomTransformation[], product: PreviewProduct): string => {
    let result = text;
    transformations.forEach(t => {
      switch (t.type) {
        case 'replace':
          if (t.searchValue) {
            result = result.split(t.searchValue).join(t.replaceValue || '');
          }
          break;
        case 'prepend':
          if (t.replaceValue) {
            result = t.replaceValue + result;
          }
          break;
        case 'append':
          if (t.replaceValue) {
            result = result + ' ' + t.replaceValue;
          }
          break;
        case 'remove':
          if (t.searchValue) {
            result = result.split(t.searchValue).join('');
          }
          break;
      }
    });
    return result;
  };

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={fetchRules} />;

  return (
    <PageLayout>
      <PageHeader title="Optimisation catalogue" subtitle="Transformez, enrichissez et testez vos produits pour chaque canal." />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--app-border)', paddingBottom: 0 }}>
        {[
          { key: 'rules' as TabView, label: 'Règles', icon: Workflow, count: counts.active, badge: 'Automation' },
          { key: 'ab-tests' as TabView, label: 'Tests A/B', icon: TestTube, count: counts.ab, badge: 'Expérimentation' },
          { key: 'ia' as TabView, label: 'IA', icon: Bot, count: counts.ai, badge: 'Intelligence' },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
              border: 'none', borderBottom: tab === item.key ? '2px solid var(--app-accent)' : '2px solid transparent',
              background: 'transparent', cursor: 'pointer', color: tab === item.key ? 'var(--app-accent)' : 'var(--app-text-muted)',
              fontWeight: 600, fontSize: 14, transition: 'all 0.2s',
            }}
          >
            <item.icon size={18} />
            {item.label}
            <span style={{ padding: '2px 8px', borderRadius: 999, backgroundColor: tab === item.key ? 'var(--app-accent-soft)' : 'var(--paper-2)', fontSize: 12, color: tab === item.key ? 'var(--app-accent)' : 'var(--app-text-muted)' }}>
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* RULES TAB */}
      {tab === 'rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Hero */}
          <PageCard style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #e0f2ee 0%, #ffffff 100%)', padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'var(--app-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <Zap size={22} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Moteur de transformation</h2>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--app-text-muted)' }}>IF-THEN multi-canal avec IA intégrée</p>
                </div>
              </div>
              <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.6, color: 'var(--app-text-muted)' }}>
                Créez des règles pour transformer vos produits automatiquement.
              </p>
              <Button onClick={openBlankAutomation}><Plus size={16} /> Nouvelle règle</Button>
            </div>
          </PageCard>

          {/* Templates */}
          <div>
            <PageSectionTitle style={{ marginBottom: 16 }}>Templates</PageSectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {AUTOMATION_TEMPLATES.map(template => (
                <button key={template.id} onClick={() => openTemplate(template)} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20, background: 'white', border: '1px solid var(--app-border)', borderRadius: 'var(--card-radius)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 999, backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)', fontSize: 11, fontWeight: 600 }}>{template.badge}</span>
                    <ArrowRight size={16} style={{ color: 'var(--app-text-muted)' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>{template.title}</h3>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--app-text-muted)' }}>{template.description}</p>
                  </div>
                  {template.example && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', padding: 12, backgroundColor: 'var(--paper-2)', borderRadius: 10, fontSize: 12 }}>
                      <div style={{ color: 'var(--app-text-muted)' }}><div style={{ fontSize: 10, marginBottom: 2 }}>AVANT</div><div style={{ fontWeight: 500 }}>{template.example.before}</div></div>
                      <div style={{ color: 'var(--app-accent)' }}>→</div>
                      <div style={{ color: 'var(--app-text-muted)' }}><div style={{ fontSize: 10, marginBottom: 2 }}>APRÈS</div><div style={{ fontWeight: 500, color: 'var(--app-accent)' }}>{template.example.after}</div></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Rules List */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <PageSectionTitle style={{ margin: 0 }}>Vos règles</PageSectionTitle>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ key: "all", label: "Toutes" }, { key: "active", label: "Actives" }, { key: "paused", label: "Pause" }, { key: "ai", label: "IA" }].map(item => (
                  <Button key={item.key} variant={view === item.key ? "default" : "outline"} size="sm" onClick={() => setView(item.key as FilterView)}>{item.label}</Button>
                ))}
              </div>
            </div>
            <PageCard>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ minWidth: 240, flex: 1 }} />
                <Button variant="outline" onClick={handleApply} disabled={applying}><Play size={14} /> Lancer</Button>
                <Button onClick={openBlankAutomation}><Plus size={14} /> Nouvelle</Button>
              </div>
              {filteredRules.length === 0 ? (
                <EmptyState icon={Sparkles} title="Aucune règle" description="Commencez avec un template." action={<Button onClick={() => openTemplate(AUTOMATION_TEMPLATES[0])}>Utiliser un template</Button>} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredRules.map(rule => (
                    <AutomationCard key={rule.id} rule={rule} summary={formatAutomationSummary(rule)} feedLabel={getFeedLabel(rule.feedIds || [])} channelLabel={getRuleScopeLabel(rule)} localePrefix={localePrefix} previewLoading={previewRuleId === rule.id} startingAbTestId={startingAbTestId} onToggleActive={handleToggleActive} onPreview={handlePreview} onEdit={r => { setEditingRule(r); setShowModal(true); }} onDelete={handleDelete} onStartAbTest={handleStartAbTest} />
                  ))}
                </div>
              )}
            </PageCard>
          </div>
        </div>
      )}

      {/* A/B TESTS TAB */}
      {tab === 'ab-tests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Hero */}
          <div style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)', borderRadius: 'var(--card-radius)', padding: 28, color: 'white' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)', fontSize: 13, marginBottom: 12 }}>
              <Target size={14} /> Expérimentation
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Testez pour optimiser</h2>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.9, maxWidth: 600 }}>
              Créez des variantes et mesurez leur performance. Appliquez ce qui fonctionne.
            </p>
            <Button onClick={() => { setAbConfig({ step: 1, name: '', platform: 'GMC', products: { filter: {}, selectedIds: [] }, modifications: [], customTransformations: [], durationDays: 14, trafficSplit: 50 }); setShowAbModal(true); }} style={{ marginTop: 16, backgroundColor: 'white', color: 'var(--app-accent)', fontWeight: 600 }}>
              <Plus size={16} /> Nouveau test
            </Button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <PageCard style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'var(--app-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--app-accent)' }}><TestTube size={17} /></div>
                <span style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>Tests créés</span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 600 }}>{abTests.length}</div>
            </PageCard>
            <PageCard style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}><Play size={17} /></div>
                <span style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>En cours</span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 600 }}>{abTests.filter(t => t.status === 'RUNNING').length}</div>
            </PageCard>
            <PageCard style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}><Trophy size={17} /></div>
                <span style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>Terminés</span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 600 }}>{abTests.filter(t => t.status === 'COMPLETED').length}</div>
            </PageCard>
          </div>

          {/* Tests List */}
          <div>
            <PageSectionTitle style={{ marginBottom: 16 }}>Vos tests</PageSectionTitle>
            {abTests.length === 0 ? (
              <PageCard className="text-center py-12">
                <TestTube size={40} style={{ color: 'var(--app-text-muted)', margin: '0 auto 16px' }} />
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>Aucun test créé</h3>
                <p style={{ margin: '0 0 20px', color: 'var(--app-text-muted)' }}>Lancez votre premier test A/B</p>
                <Button onClick={() => setShowAbModal(true)}><Plus size={16} /> Créer un test</Button>
              </PageCard>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {abTests.map(test => {
                  const status = STATUS_CONFIG[test.status];
                  return (
                    <PageCard key={test.id} style={{ padding: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                            <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, backgroundColor: status.bg, color: status.color }}>{status.label}</span>
                            <span style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>{test.platform}</span>
                            <span style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>Split {test.controlPercent}% / {test.variantPercent}%</span>
                          </div>
                          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>{test.name}</h3>
                          <p style={{ margin: 0, fontSize: 13, color: 'var(--app-text-muted)' }}>
                            {test.assignmentCount || 0} produits · {test.minDurationDays}j minimum
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {test.status === 'DRAFT' && (
                            <Button size="sm" onClick={() => handleStartAbTestFromId(test.id)} disabled={startingAbTestId === test.id}>
                              {startingAbTestId === test.id ? <Loader2 size={14} className="animate-spin" /> : <><Play size={14} /> Démarrer</>}
                            </Button>
                          )}
                          {test.status === 'RUNNING' && (
                            <Button size="sm" variant="outline" onClick={() => handleStopAbTest(test.id)}>
                              <XCircle size={14} /> Arrêter
                            </Button>
                          )}
                        </div>
                      </div>
                    </PageCard>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* IA TAB */}
      {tab === 'ia' && (
        <IASuggestionsTab
          feeds={feeds}
          onRuleCreated={() => { fetchRules(); setTab('rules'); }}
        />
      )}

      {/* Rule Modal */}
      <RuleModal open={showModal} onClose={() => { setShowModal(false); setEditingRule(null); }} onSave={handleSave} onAbTestCreated={fetchRules} rule={editingRule} feeds={feeds} channels={CHANNELS} destinations={destinations} />

      {/* Preview Dialog */}
      <Dialog open={!!previewData} onOpenChange={open => { if (!open) { setPreviewData(null); setPreviewRuleId(null); } }}>
        {previewData && (
          <DialogContent style={{ maxWidth: 640 }}>
            <DialogHeader>
              <DialogTitle>Prévisualisation</DialogTitle>
              <DialogDescription>{previewMatches.length} produit(s) touché(s)</DialogDescription>
            </DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              {previewMatches.slice(0, 5).map(item => (
                <div key={item.itemId} style={{ padding: 16, backgroundColor: 'var(--paper-2)', borderRadius: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--app-text-muted)', marginBottom: 4 }}>Avant</div><div style={{ fontSize: 13 }}>{item.before?.title || '—'}</div></div>
                  <div style={{ backgroundColor: 'var(--app-accent-soft)', padding: 12, borderRadius: 8 }}><div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--app-accent)', marginBottom: 4 }}>Après</div><div style={{ fontSize: 13, fontWeight: 500 }}>{item.after?.title || '—'}</div></div>
                </div>
              ))}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* A/B Test Creation Modal */}
      {showAbModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAbModal(false)}>
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 sticky top-0 bg-white rounded-t-3xl z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Créer un test A/B</h2>
                  <p className="text-sm text-slate-500">Étape {abConfig.step} sur 4</p>
                </div>
                <button onClick={() => setShowAbModal(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
              </div>
              <div className="flex gap-2 mt-4">
                {[1, 2, 3, 4].map(step => <div key={step} className={`h-1.5 flex-1 rounded-full ${step <= abConfig.step ? 'bg-indigo-500' : 'bg-slate-200'}`} />)}
              </div>
            </div>

            <div className="p-6">
              {abConfig.step === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Nom du test *</label>
                    <input type="text" value={abConfig.name} onChange={e => setAbConfig(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Test titres avec marque" className="w-full px-4 py-3 rounded-xl border border-slate-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-3">Plateforme</label>
                    <div className="grid grid-cols-4 gap-3">
                      {PLATFORMS.map(p => (
                        <button key={p.id} onClick={() => setAbConfig(prev => ({ ...prev, platform: p.id }))} className={`flex items-center gap-2 p-3 rounded-xl border-2 ${abConfig.platform === p.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                          <span className="text-xl">{p.icon}</span>
                          <span className="font-medium text-sm">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {abConfig.step === 2 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">IDs produits (séparés par virgules)</label>
                    <textarea value={abConfig.products.selectedIds.join(', ')} onChange={e => setAbConfig(p => ({ ...p, products: { ...p.products, selectedIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))} placeholder="Entrer les IDs ou Laisser vide pour prévisualisation" rows={2} className="w-full px-4 py-3 rounded-xl border border-slate-200" />
                    <div className="flex items-center gap-2 mt-2">
                      <Button variant="outline" size="sm" onClick={loadPreviewProducts} disabled={loadingPreview}>
                        {loadingPreview ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                        Charger l&apos;aperçu
                      </Button>
                      <span className="text-xs text-slate-500">{abConfig.products.selectedIds.length || 0} produits</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-3">Transformations personnalisées</label>
                    <p className="text-xs text-slate-500 mb-4">Définissez vos propres règles de transformation (ex: remplacer &quot;chaussure&quot; par &quot;basket&quot;)</p>

                    {/* Titre transformations */}
                    <div className="mb-4 p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <Type size={16} className="text-indigo-500" />
                        <span className="font-medium text-sm">Titre</span>
                      </div>
                      <div className="space-y-2">
                        {abConfig.customTransformations.filter(t => t.field === 'title').map((t, i) => (
                          <div key={i} className="flex items-center gap-2 bg-white p-2 rounded-lg">
                            <select value={t.type} onChange={e => updateCustomTransformation(i, { type: e.target.value as any })} className="px-2 py-1 border rounded text-sm">
                              <option value="replace">Remplacer</option>
                              <option value="prepend">Ajouter au début</option>
                              <option value="append">Ajouter à la fin</option>
                              <option value="remove">Supprimer</option>
                            </select>
                            {t.type !== 'remove' && (
                              <input type="text" value={t.searchValue || ''} onChange={e => updateCustomTransformation(i, { searchValue: e.target.value })} placeholder={t.type === 'replace' ? 'Texte à chercher' : 'Texte à ajouter'} className="flex-1 px-2 py-1 border rounded text-sm" />
                            )}
                            {t.type === 'replace' && (
                              <>
                                <span className="text-slate-400">par</span>
                                <input type="text" value={t.replaceValue || ''} onChange={e => updateCustomTransformation(i, { replaceValue: e.target.value })} placeholder="Nouveau texte" className="flex-1 px-2 py-1 border rounded text-sm" />
                              </>
                            )}
                            <button onClick={() => removeCustomTransformation(i)} className="p-1 hover:bg-red-50 rounded"><X size={14} className="text-red-500" /></button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => addCustomTransformation('title', 'replace')}>
                          <Plus size={14} /> Ajouter transformation titre
                        </Button>
                      </div>
                    </div>

                    {/* Description transformations */}
                    <div className="mb-4 p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <LayoutList size={16} className="text-purple-500" />
                        <span className="font-medium text-sm">Description</span>
                      </div>
                      <div className="space-y-2">
                        {abConfig.customTransformations.filter(t => t.field === 'description').map((t, i) => {
                          const realIndex = abConfig.customTransformations.findIndex((x, idx) => x.field === 'description' && idx === i);
                          return (
                            <div key={i} className="flex items-center gap-2 bg-white p-2 rounded-lg">
                              <select value={t.type} onChange={e => updateCustomTransformation(i, { type: e.target.value as any })} className="px-2 py-1 border rounded text-sm">
                                <option value="replace">Remplacer</option>
                                <option value="prepend">Ajouter au début</option>
                                <option value="append">Ajouter à la fin</option>
                                <option value="remove">Supprimer</option>
                              </select>
                              {t.type !== 'remove' && (
                                <input type="text" value={t.searchValue || ''} onChange={e => updateCustomTransformation(i, { searchValue: e.target.value })} placeholder={t.type === 'replace' ? 'Texte à chercher' : 'Texte à ajouter'} className="flex-1 px-2 py-1 border rounded text-sm" />
                              )}
                              {t.type === 'replace' && (
                                <>
                                  <span className="text-slate-400">par</span>
                                  <input type="text" value={t.replaceValue || ''} onChange={e => updateCustomTransformation(i, { replaceValue: e.target.value })} placeholder="Nouveau texte" className="flex-1 px-2 py-1 border rounded text-sm" />
                                </>
                              )}
                              <button onClick={() => removeCustomTransformation(i)} className="p-1 hover:bg-red-50 rounded"><X size={14} className="text-red-500" /></button>
                            </div>
                          );
                        })}
                        <Button variant="outline" size="sm" onClick={() => addCustomTransformation('description', 'replace')}>
                          <Plus size={14} /> Ajouter transformation description
                        </Button>
                      </div>
                    </div>

                    {/* Quick presets */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-500 mb-2">Transformations rapides</label>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => { addCustomTransformation('title', 'replace'); setAbConfig(p => ({ ...p, customTransformations: [...p.customTransformations.slice(0, -1), { ...p.customTransformations[p.customTransformations.length - 1], field: 'title', type: 'replace', searchValue: 'chaussure', replaceValue: 'basket' }] })); }} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
                          &quot;chaussure&quot; → &quot;basket&quot;
                        </button>
                        <button onClick={() => addCustomTransformation('title', 'prepend')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
                          + Marque au début
                        </button>
                        <button onClick={() => addCustomTransformation('title', 'append')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
                          + Prix à la fin
                        </button>

                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  {previewProducts.length > 0 && (
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <Eye size={16} className="text-indigo-500" /> Aperçu en temps réel
                        </h4>
                        <span className="text-xs text-indigo-600">{previewProducts.length} produits</span>
                      </div>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {previewProducts.map(product => {
                          const titleTrans = abConfig.customTransformations.filter(t => t.field === 'title');
                          const descTrans = abConfig.customTransformations.filter(t => t.field === 'description');
                          const modifiedTitle = applyTransformations(product.title, titleTrans, product);
                          const modifiedDesc = applyTransformations(product.description || '', descTrans, product);
                          return (
                            <div key={product.id} className="bg-white rounded-lg p-3">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <div className="text-xs text-slate-500 mb-1">TITRE ACTUEL</div>
                                  <div className="text-sm text-slate-700">{product.title}</div>
                                </div>
                                <div className="bg-green-50 p-2 rounded">
                                  <div className="text-xs text-green-600 mb-1">NOUVEAU TITRE</div>
                                  <div className="text-sm font-medium text-green-700">{modifiedTitle}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {abConfig.step === 3 && (
                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-2xl p-6">
                    <h4 className="font-semibold mb-4 flex items-center gap-2"><Sliders size={18} /> Distribution du trafic</h4>
                    <div className="flex items-center gap-4">
                      <div className="text-center"><div className="font-bold text-2xl">{abConfig.trafficSplit}%</div><div className="text-sm text-slate-500">Groupe A</div></div>
                      <input type="range" min="10" max="90" step="5" value={abConfig.trafficSplit} onChange={e => setAbConfig(p => ({ ...p, trafficSplit: Number(e.target.value) }))} className="flex-1 h-2 bg-slate-200 rounded-lg accent-indigo-500" />
                      <div className="text-center"><div className="font-bold text-2xl text-indigo-600">{100 - abConfig.trafficSplit}%</div><div className="text-sm text-indigo-500">Groupe B</div></div>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-6">
                    <h4 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 size={18} /> Durée minimale</h4>
                    <div className="flex items-center gap-4">
                      <input type="range" min="7" max="30" value={abConfig.durationDays} onChange={e => setAbConfig(p => ({ ...p, durationDays: Number(e.target.value) }))} className="flex-1 h-2 bg-slate-200 rounded-lg accent-indigo-500" />
                      <span className="font-bold text-lg w-24 text-center">{abConfig.durationDays} jours</span>
                    </div>
                  </div>
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                    <h4 className="font-semibold text-indigo-900 mb-2">Récapitulatif</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-indigo-600">Nom:</span> {abConfig.name || 'Sans nom'}</div>
                      <div><span className="text-indigo-600">Plateforme:</span> {abConfig.platform}</div>
                      <div><span className="text-indigo-600">Produits:</span> {abConfig.products.selectedIds.length}</div>
                      <div><span className="text-indigo-600">Modifications:</span> {abConfig.modifications.length} champ(s)</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-3xl">
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setAbConfig(p => ({ ...p, step: Math.max(1, p.step - 1) }))} disabled={abConfig.step === 1}><ChevronLeft size={16} /> Précédent</Button>
                {abConfig.step < 4 ? (
                  <Button
                    onClick={() => setAbConfig(p => ({ ...p, step: p.step + 1 }))}
                    disabled={abConfig.step === 1 && !abConfig.name}
                  >
                    Suivant <ChevronRight size={16} />
                  </Button>
                ) : (
                  <Button onClick={handleCreateAbTest} disabled={creatingAbTest || (abConfig.customTransformations.length === 0 && abConfig.modifications.length === 0)}>
                    {creatingAbTest ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Créer le test</>}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

interface IASuggestion {
  id: string;
  type: 'title' | 'description' | 'category' | 'image' | 'price';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  affectedProducts: number;
  actionLabel: string;
  example?: { before: string; after: string };
}

interface IASuggestionsTabProps {
  feeds: { id: string; name: string }[];
  onRuleCreated: () => void;
}

function IASuggestionsTab({ feeds, onRuleCreated }: IASuggestionsTabProps) {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<IASuggestion[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const [selectedFeed, setSelectedFeed] = useState<string>('');
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState<IASuggestion | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedFeed) params.set('feedId', selectedFeed);
      const res = await apiClient.get<{ suggestions: IASuggestion[] }>(`/enrichment/suggestions?${params}`);
      if (res.data?.suggestions) {
        setSuggestions(res.data.suggestions);
      } else {
        setSuggestions(getDefaultSuggestions());
      }
    } catch {
      setSuggestions(getDefaultSuggestions());
    } finally {
      setLoading(false);
    }
  }, [selectedFeed]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const getDefaultSuggestions = (): IASuggestion[] => [
    { id: '1', type: 'category', title: 'Catégories Google manquantes', description: 'Complétez automatiquement les catégories Google Shopping pour vos produits.', impact: 'high', affectedProducts: 0, actionLabel: 'Compléter les catégories' },
    { id: '2', type: 'title', title: 'Titres optimisables', description: 'Ajoutez la marque et des mots-clés stratégiques à vos titres.', impact: 'medium', affectedProducts: 0, actionLabel: 'Optimiser les titres' },
    { id: '3', type: 'description', title: 'Descriptions courtes', description: 'Générez des descriptions concises et percutantes pour les marketplaces.', impact: 'medium', affectedProducts: 0, actionLabel: 'Générer des descriptions' },
    { id: '4', type: 'image', title: 'Images manquantes', description: 'Certains produits n\'ont pas d\'image. Ajoutez-en pour améliorer les conversions.', impact: 'high', affectedProducts: 0, actionLabel: 'Voir les produits' },
    { id: '5', type: 'price', title: 'Prix à vérifier', description: 'Des produits ont des prix suspects ou manquants.', impact: 'low', affectedProducts: 0, actionLabel: 'Vérifier les prix' },
  ];

  const handleApply = async (suggestion: IASuggestion) => {
    setApplying(suggestion.id);
    try {
      // Each suggestion type maps to (a) the field to fill, (b) a default
      // condition that scopes the rule to the products actually missing
      // that field. The backend requires a non-empty `conditions` array,
      // and these defaults make the rules semantically meaningful — we
      // only optimize what's actually broken.
      const TYPE_TO_FIELD: Record<IASuggestion['type'], string> = {
        category: 'google_product_category',
        title: 'title',
        description: 'description',
        image: 'image_link',
        price: 'price',
      };
      const targetField = TYPE_TO_FIELD[suggestion.type] || suggestion.type;
      const feedIds = selectedFeed ? [selectedFeed] : [];

      let ruleData: Partial<Rule> = { name: suggestion.title, isActive: true, runOnIngestion: true, feedIds };
      switch (suggestion.type) {
        case 'category':
          ruleData = {
            ...ruleData,
            conditionJson: { operator: 'AND', conditions: [{ field: 'google_product_category', operator: 'is_empty' }] },
            actionJson: { type: 'ai_fill', params: { field: 'google_product_category' } },
            channelIds: ['gmc'],
          };
          break;
        case 'title':
          ruleData = {
            ...ruleData,
            conditionJson: { operator: 'AND', conditions: [{ field: 'brand', operator: 'is_not_empty' }] },
            actionJson: { type: 'template', params: { field: 'title', template: '{brand} - {title}' } },
          };
          break;
        case 'description':
        case 'image':
        case 'price':
        default:
          ruleData = {
            ...ruleData,
            // Only apply to products where the target field is empty —
            // this satisfies the backend's "non-empty conditions" rule
            // AND scopes the optimization to the products that need it.
            conditionJson: { operator: 'AND', conditions: [{ field: targetField, operator: 'is_empty' }] },
            actionJson: { type: 'ai_fill', params: { field: targetField } },
          };
      }

      await apiClient.post('/rules', ruleData);
      onRuleCreated();
    } catch (e) {
      const message = e instanceof Error && e.message ? e.message : 'Erreur lors de la création de la règle';
      // Surface the actual backend reason (e.g. validation details) so
      // future failures don't hide behind a generic message.
      console.error('POST /rules failed:', e);
      alert(message);
    } finally {
      setApplying(null);
    }
  };

  const getSuggestionIcon = (type: IASuggestion['type']) => {
    const icons: Record<string, { icon: typeof Type; color: string; bg: string }> = {
      title: { icon: Type, color: 'var(--accent)', bg: 'var(--accent-bg)' },
      description: { icon: LayoutList, color: 'var(--warning)', bg: 'var(--warning-bg)' },
      category: { icon: Filter, color: 'var(--accent)', bg: 'var(--accent-bg)' },
      image: { icon: ImageIcon, color: 'var(--accent)', bg: 'var(--accent-bg)' },
      price: { icon: BarChart3, color: 'var(--success)', bg: 'var(--success-bg)' },
    };
    return icons[type] || icons.title;
  };

  const getImpactBadge = (impact: IASuggestion['impact']) => {
    const config = { high: { label: 'Impact fort', color: 'var(--danger)', bg: 'var(--danger-bg)' }, medium: { label: 'Impact moyen', color: 'var(--warning)', bg: 'var(--warning-bg)' }, low: { label: 'Impact faible', color: 'var(--ink-3)', bg: 'var(--paper-2)' } };
    return config[impact];
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ background: 'var(--ink)', borderRadius: 'var(--card-radius)', padding: 28, color: 'var(--paper)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: 'var(--accent)', boxShadow: '0 0 0 4px rgba(42,111,232,0.18)' }} />
            <Bot size={12} /> Intelligence artificielle
          </div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.05 }}>Analyse en cours…</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <PageCard key={i} style={{ padding: 24 }}>
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
              </div>
            </PageCard>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: 'var(--ink)', borderRadius: 'var(--card-radius)', padding: 32, color: 'var(--paper)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 18 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: 'var(--accent)', boxShadow: '0 0 0 4px rgba(42,111,232,0.18)' }} />
          <Bot size={12} /> Intelligence artificielle
        </div>
        <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.05, color: 'var(--paper)' }}>
          Suggestions{' '}
          <em style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-4)', letterSpacing: '-0.02em' }}>
            intelligentes
          </em>
        </h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--ink-4)', maxWidth: 640 }}>
          L&apos;IA analyse vos produits et suggère des optimisations basées sur les meilleures pratiques e-commerce.
        </p>
      </div>

      {feeds.length > 0 && (
        <PageCard style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--app-text)' }}>Filtrer par flux:</label>
            <select value={selectedFeed} onChange={e => setSelectedFeed(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--app-border)', fontSize: 14 }}>
              <option value="">Tous les flux</option>
              {feeds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={fetchSuggestions}><RefreshCw size={14} /> Actualiser</Button>
          </div>
        </PageCard>
      )}

      {suggestions.length === 0 ? (
        <PageCard className="text-center py-12">
          <Bot size={48} style={{ color: 'var(--accent)', margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>Aucune suggestion</h3>
          <p style={{ margin: 0, color: 'var(--app-text-muted)' }}>Votre catalogue est bien optimisé !</p>
        </PageCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {suggestions.map(suggestion => {
            const { icon: Icon, color, bg } = getSuggestionIcon(suggestion.type);
            const impactBadge = getImpactBadge(suggestion.impact);
            return (
              <PageCard key={suggestion.id} style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={22} style={{ color }} />
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, backgroundColor: impactBadge.bg, color: impactBadge.color }}>
                    {impactBadge.label}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{suggestion.title}</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--app-text-muted)', lineHeight: 1.6 }}>
                  {suggestion.description}
                </p>
                {suggestion.example && (
                  <div style={{ backgroundColor: 'var(--paper-2)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', fontSize: 12 }}>
                      <div style={{ color: 'var(--app-text-muted)' }}>
                        <div style={{ fontSize: 10, marginBottom: 2 }}>AVANT</div>
                        <div style={{ fontWeight: 500 }}>{suggestion.example.before}</div>
                      </div>
                      <span style={{ color }}>→</span>
                      <div style={{ color }}>
                        <div style={{ fontSize: 10, marginBottom: 2 }}>APRÈS</div>
                        <div style={{ fontWeight: 500 }}>{suggestion.example.after}</div>
                      </div>
                    </div>
                  </div>
                )}
                <Button onClick={() => handleApply(suggestion)} disabled={applying === suggestion.id} style={{ width: '100%' }}>
                  {applying === suggestion.id ? <Loader2 size={14} className="animate-spin" /> : <><Wand2 size={14} /> {suggestion.actionLabel}</>}
                </Button>
              </PageCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
