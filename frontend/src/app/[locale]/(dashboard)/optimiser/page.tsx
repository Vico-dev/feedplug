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
  Tags,
  TestTube,
  Wand2,
  Workflow,
  Zap,
  ArrowRight,
  Settings,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { apiClient } from "@/lib/api";
import { getLocalePrefixFromPathname } from "@/lib/locale-navigation";
import { getFeeds } from "@/lib/services/flux.service";
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

const CHANNELS = SUPPORTED_CHANNELS.map(({ key, label }) => ({ key, label }));

type FilterView = "all" | "active" | "paused" | "ai" | "ab";

interface TemplateDefinition {
  id: string;
  title: string;
  description: string;
  helper: string;
  badge?: string;
  rule: Rule;
  example?: {
    before: string;
    after: string;
  };
}

interface ApiError {
  response?: {
    data?: {
      message?: string;
      error?: string;
      errors?: string[];
    };
  };
  message?: string;
}

interface PreviewItem {
  itemId: string;
  title: string;
  matches: boolean;
  before: { title?: string; price?: number; brand?: string } | null;
  after: { title?: string; price?: number; brand?: string } | null;
}

const AUTOMATION_TEMPLATES: TemplateDefinition[] = [
  {
    id: "google-category-ai",
    title: "Compléter les catégories Google",
    description: "Laissez l'IA remplir les catégories manquantes pour améliorer le reach.",
    helper: "IA uniquement si la catégorie est vide.",
    badge: "IA",
    example: {
      before: "Chaussures",
      after: "Apparel & Accessories > Shoes",
    },
    rule: {
      name: "Compléter la catégorie Google si vide",
      conditionJson: {
        operator: "AND",
        conditions: [{ field: "google_product_category", operator: "is_empty" }],
      },
      actionJson: {
        type: "ai_fill",
        params: { field: "google_product_category" },
      },
      channelIds: ["gmc"],
      feedIds: [],
      runOnIngestion: true,
      priority: 0,
      isActive: true,
    },
  },
  {
    id: "brand-title",
    title: "Enrichir les titles avec la marque",
    description: "Ajoutez la marque au début des titles pour plus de contexte marchand.",
    helper: "Si la marque est renseignée.",
    badge: "Titre",
    example: {
      before: "Air Max 90",
      after: "Nike Air Max 90",
    },
    rule: {
      name: "Ajouter la marque au titre",
      conditionJson: {
        operator: "AND",
        conditions: [{ field: "brand", operator: "is_not_empty" }],
      },
      actionJson: {
        type: "template",
        params: { field: "title", template: "{brand} - {title}" },
      },
      channelIds: [],
      feedIds: [],
      runOnIngestion: true,
      priority: 20,
      isActive: true,
    },
  },
  {
    id: "out-of-stock",
    title: "Exclure les produits hors stock",
    description: "Évitez de diffuser des références indisponibles sur Google.",
    helper: "Supprime de la diffusion les produits hors stock.",
    badge: "Exclusion",
    example: {
      before: "Air Max 90 - Publié",
      after: "Air Max 90 - Exclu",
    },
    rule: {
      name: "Exclure produits hors stock",
      conditionJson: {
        operator: "AND",
        conditions: [{ field: "availability", operator: "equals", value: "out of stock" }],
      },
      actionJson: {
        type: "exclude",
        params: {},
      },
      channelIds: ["gmc"],
      feedIds: [],
      runOnIngestion: true,
      priority: 5,
      isActive: true,
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
      conditionJson: {
        operator: "AND",
        conditions: [{ field: "customfields.mpn", operator: "is_empty" }],
      },
      actionJson: {
        type: "copy_field",
        params: { field: "customfields.mpn", sourceField: "sku" },
      },
      channelIds: ["amazon_fr", "amazon_uk", "amazon_de"],
      feedIds: [],
      runOnIngestion: true,
      priority: 10,
      isActive: true,
    },
  },
];

function formatConditionSentence(rule: Rule) {
  const conditions = rule.conditionJson?.conditions || [];
  if (conditions.length === 0) return "Tous les produits";

  const fieldLabels: Record<string, string> = {
    google_product_category: "catégorie Google",
    brand: "marque",
    title: "titre",
    price: "prix",
    availability: "disponibilité",
    customfields_mpn: "MPN",
  };

  const opLabels: Record<string, string> = {
    is_empty: "est vide",
    is_not_empty: "n'est pas vide",
    equals: "=",
    gt: ">",
  };

  return conditions.map(c => {
    const field = fieldLabels[c.field] || c.field;
    const op = opLabels[c.operator] || c.operator;
    return `${field} ${op}${c.value ? ` ${c.value}` : ""}`;
  }).join(" et ");
}

function formatActionSentence(rule: Rule) {
  const params = rule.actionJson?.params || {};
  const actionLabels: Record<string, string> = {
    ai_fill: "compléter avec l'IA",
    template: `recomposer le titre`,
    exclude: "exclure de la diffusion",
    copy_field: `copier ${params.sourceField}`,
    set_value: `définir sur ${params.value}`,
  };
  return actionLabels[rule.actionJson?.type || ""] || rule.actionJson?.type;
}

function formatAutomationSummary(rule: Rule) {
  return `${formatConditionSentence(rule)} → ${formatActionSentence(rule)}`;
}

export default function OptimiserPage() {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const [rules, setRules] = useState<Rule[]>([]);
  const [feeds, setFeeds] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [applying, setApplying] = useState(false);
  const [previewRuleId, setPreviewRuleId] = useState<string | null>(null);
  const [startingAbTestId, setStartingAbTestId] = useState<string | null>(null);
  const [view, setView] = useState<FilterView>("all");
  const [search, setSearch] = useState("");
  const localePrefix = getLocalePrefixFromPathname(pathname);
  const [previewData, setPreviewData] = useState<{
    ruleName: string;
    preview: PreviewItem[];
  } | null>(null);

  const previewMatches = useMemo(
    () => previewData?.preview.filter((item) => item.matches) || [],
    [previewData],
  );

  const previewedRule = useMemo(
    () => rules.find((rule) => rule.id === previewRuleId) || null,
    [rules, previewRuleId],
  );

  const fetchRules = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get<{ rules: Rule[] }>("/rules");
      setRules(res.data.rules || []);
    } catch (e: unknown) {
      const apiError = e as ApiError;
      setError(
        apiError.response?.data?.message || apiError.message || t("optimiser.errorRules")
      );
    }
  }, [t]);

  const fetchFeeds = useCallback(async () => {
    try {
      const list = await getFeeds();
      setFeeds(list.map((feed) => ({ id: feed.id, name: feed.name || feed.id })));
    } catch {
      setFeeds([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRules(), fetchFeeds()]).finally(() => setLoading(false));
  }, [fetchFeeds, fetchRules]);

  const counts = useMemo(
    () => ({
      total: rules.length,
      active: rules.filter((rule) => rule.isActive).length,
      ai: rules.filter((rule) => rule.actionJson?.type === "ai_fill").length,
      ab: rules.filter((rule) => rule.abTest).length,
    }),
    [rules],
  );

  const channelCoverage = useMemo(() => {
    return Object.entries(CHANNEL_FAMILY_META).map(([familyKey, familyMeta]) => {
      const channels = SUPPORTED_CHANNELS
        .filter((channel) => channel.family === familyKey)
        .map((channel) => {
          const ruleCount = rules.filter(
            (rule) =>
              rule.isActive !== false &&
              ((rule.channelIds?.length ?? 0) === 0 || (rule.channelIds || []).includes(channel.key))
          ).length;
          return { ...channel, ruleCount };
        });
      return { key: familyKey, meta: familyMeta, channels, coveredCount: channels.filter((c) => c.ruleCount > 0).length };
    });
  }, [rules]);

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (view === "active" && !rule.isActive) return false;
      if (view === "paused" && rule.isActive) return false;
      if (view === "ai" && rule.actionJson?.type !== "ai_fill") return false;
      if (view === "ab" && !rule.abTest) return false;
      if (!search.trim()) return true;
      const haystack = [rule.name, formatAutomationSummary(rule)].join(" ").toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    });
  }, [rules, view, search]);

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await apiClient.post<{ applied: number; excluded: number }>("/rules/apply", {});
      alert(`Règles appliquées : ${res.data.applied} modifications, ${res.data.excluded} exclusions.`);
      fetchRules();
    } catch (e) {
      alert("Erreur : " + (e instanceof Error ? e.message : "Erreur"));
    } finally {
      setApplying(false);
    }
  };

  const openBlankAutomation = () => {
    setEditingRule(null);
    setShowModal(true);
  };

  const openTemplate = (template: TemplateDefinition) => {
    setEditingRule({
      ...template.rule,
      conditionJson: {
        operator: template.rule.conditionJson.operator,
        conditions: template.rule.conditionJson.conditions.map((c) => ({ ...c })),
      },
      actionJson: {
        type: template.rule.actionJson.type,
        params: { ...(template.rule.actionJson.params || {}) },
      },
      feedIds: [...(template.rule.feedIds || [])],
      channelIds: [...(template.rule.channelIds || [])],
    });
    setShowModal(true);
  };

  const handleSave = async (data: Partial<Rule>): Promise<{ id: string } | void> => {
    try {
      if (editingRule?.id) {
        const res = await apiClient.patch<Rule>(`/rules/${editingRule.id}`, data);
        setShowModal(false);
        setEditingRule(null);
        fetchRules();
        return res.data?.id ? { id: res.data.id } : undefined;
      }
      const res = await apiClient.post<Rule>("/rules", data);
      setShowModal(false);
      setEditingRule(null);
      fetchRules();
      return res.data?.id ? { id: res.data.id } : undefined;
    } catch (e: unknown) {
      const apiError = e as ApiError;
      throw new Error(apiError.response?.data?.errors?.join(", ") || apiError.response?.data?.message || apiError.message || "Erreur");
    }
  };

  const handleDelete = async (rule: Rule) => {
    if (!confirm(`Supprimer "${rule.name}" ?`)) return;
    try {
      await apiClient.delete(`/rules/${rule.id}`);
      fetchRules();
    } catch (e) {
      alert("Erreur : " + (e instanceof Error ? e.message : "Erreur"));
    }
  };

  const handlePreview = async (rule: Rule) => {
    if (!rule.id) return;
    setPreviewRuleId(rule.id);
    setPreviewData(null);
    try {
      const res = await apiClient.post<{ ruleName: string; preview: PreviewItem[] }>(`/rules/${rule.id}/preview`, { limit: 5 });
      setPreviewData({ ruleName: res.data.ruleName, preview: res.data.preview });
    } catch (e) {
      alert("Erreur : " + (e instanceof Error ? e.message : "Erreur"));
      setPreviewRuleId(null);
    }
  };

  const handleToggleActive = async (rule: Rule) => {
    try {
      await apiClient.patch(`/rules/${rule.id}`, { isActive: !rule.isActive });
      fetchRules();
    } catch (e) {
      alert("Erreur : " + (e instanceof Error ? e.message : "Erreur"));
    }
  };

  const handleStartAbTest = async (rule: Rule) => {
    if (!rule.abTest?.id) return;
    setStartingAbTestId(rule.abTest.id);
    try {
      await apiClient.post(`/ab-tests/${rule.abTest.id}/start`);
      fetchRules();
    } catch (e: unknown) {
      const apiError = e as ApiError;
      alert(apiError.response?.data?.message || "Impossible de démarrer le test");
    } finally {
      setStartingAbTestId(null);
    }
  };

  const getFeedLabel = (ids: string[]) => {
    if (!ids?.length) return t("common.allFlux");
    return ids.map((id) => feeds.find((f) => f.id === id)?.name || id).join(", ");
  };

  const getChannelLabel = (ids: string[]) => {
    if (!ids?.length) return t("common.allChannels");
    return ids.map((id) => getSupportedChannelLabel(id)).join(", ");
  };

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={fetchRules} />;

  return (
    <PageLayout>
      <PageHeader
        title="Optimisation catalogue"
        subtitle="Transformez, enrichissez et adaptez vos produits pour chaque canal de vente."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Hero Section */}
        <PageCard style={{ padding: 0, overflow: "hidden" }}>
          <div style={{
            background: "linear-gradient(135deg, #e0f2ee 0%, #ffffff 100%)",
            padding: "28px 32px",
            position: "relative",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: "var(--app-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}>
                <Zap size={22} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--app-text)" }}>
                  Moteur de transformation
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: "var(--app-text-muted)" }}>
                  IF-THEN multi-canal avec IA intégrée
                </p>
              </div>
            </div>
            <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.6, color: "var(--app-text-muted)", maxWidth: 640 }}>
              Créez des règles pour transformer vos produits automatiquement. 
              L'IA complète les champs manquants, vous adaptez les autres selon vos besoins.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button onClick={openBlankAutomation}>
                <Plus size={16} />
                Nouvelle règle
              </Button>
              <Link href={`${localePrefix}/optimiser/ab-tests`}>
                <Button variant="outline">
                  <TestTube size={16} />
                  Tests A/B
                </Button>
              </Link>
            </div>
          </div>
        </PageCard>

        {/* Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
        }}>
          {[
            { label: "Règles actives", value: counts.active, icon: Settings },
            { label: "Règles IA", value: counts.ai, icon: Bot },
            { label: "Tests A/B", value: counts.ab, icon: TestTube },
          ].map((stat) => (
            <PageCard key={stat.label} style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: "var(--app-accent-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--app-accent)",
                }}>
                  <stat.icon size={17} />
                </div>
                <span style={{ fontSize: 13, color: "var(--app-text-muted)" }}>{stat.label}</span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 600, color: "var(--app-text)" }}>{stat.value}</div>
            </PageCard>
          ))}
        </div>

        {/* Templates */}
        <div>
          <PageSectionTitle style={{ marginBottom: 16 }}>
            Templates par canal
          </PageSectionTitle>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {AUTOMATION_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => openTemplate(template)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: 20,
                  background: "white",
                  border: "1px solid var(--app-border)",
                  borderRadius: "var(--card-radius)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--app-accent)";
                  e.currentTarget.style.boxShadow = "var(--app-shadow-md)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--app-border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {template.badge && (
                      <span style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        backgroundColor: "var(--app-accent-soft)",
                        color: "var(--app-accent)",
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {template.badge}
                      </span>
                    )}
                  </div>
                  <ArrowRight size={16} style={{ color: "var(--app-text-muted)" }} />
                </div>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "var(--app-text)" }}>
                    {template.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--app-text-muted)", lineHeight: 1.5 }}>
                    {template.description}
                  </p>
                </div>
                {template.example && (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    gap: 8,
                    alignItems: "center",
                    padding: 12,
                    backgroundColor: "#f8faf9",
                    borderRadius: 10,
                    fontSize: 12,
                  }}>
                    <div style={{ color: "var(--app-text-muted)" }}>
                      <div style={{ fontSize: 10, marginBottom: 2, textTransform: "uppercase" }}>Avant</div>
                      <div style={{ fontWeight: 500, color: "var(--app-text)" }}>{template.example.before}</div>
                    </div>
                    <div style={{ color: "var(--app-accent)" }}>→</div>
                    <div style={{ color: "var(--app-text-muted)" }}>
                      <div style={{ fontSize: 10, marginBottom: 2, textTransform: "uppercase", color: "var(--app-accent)" }}>Après</div>
                      <div style={{ fontWeight: 500, color: "var(--app-text)" }}>{template.example.after}</div>
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 12, color: "var(--app-text-muted)" }}>
                  {template.helper}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Couverture canaux */}
        <div>
          <PageSectionTitle style={{ marginBottom: 16 }}>
            Couverture par canal
          </PageSectionTitle>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}>
            {channelCoverage.map((family) => (
              <div
                key={family.key}
                style={{
                  padding: 16,
                  borderRadius: "var(--card-radius)",
                  border: "1px solid",
                  borderColor: family.meta.border,
                  backgroundColor: family.meta.background,
                }}
              >
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: family.meta.accent,
                  marginBottom: 10,
                }}>
                  {family.meta.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {family.channels.map((channel) => (
                    <span
                      key={channel.key}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        borderRadius: 6,
                        backgroundColor: "white",
                        border: "1px solid",
                        borderColor: channel.ruleCount > 0 ? family.meta.border : "var(--app-border)",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--app-text)",
                      }}
                    >
                      {channel.label}
                      <span style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        backgroundColor: channel.ruleCount > 0 ? "var(--app-text)" : "var(--line)",
                        color: channel.ruleCount > 0 ? "white" : "var(--app-text-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                      }}>
                        {channel.ruleCount}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vos règles */}
        <div>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 12,
          }}>
            <PageSectionTitle style={{ margin: 0 }}>
              Vos règles
            </PageSectionTitle>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { key: "all", label: "Toutes" },
                { key: "active", label: "Actives" },
                { key: "paused", label: "En pause" },
                { key: "ai", label: "IA" },
              ].map((item) => (
                <Button
                  key={item.key}
                  variant={view === item.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView(item.key as FilterView)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <PageCard>
            <div style={{
              display: "flex",
              gap: 12,
              marginBottom: 20,
              flexWrap: "wrap",
            }}>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une règle..."
                style={{ minWidth: 240, flex: 1 }}
              />
              <Button variant="outline" onClick={handleApply} disabled={applying || rules.length === 0}>
                {applying ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Lancer
              </Button>
              <Button onClick={openBlankAutomation}>
                <Plus size={14} />
                Nouvelle
              </Button>
            </div>

            {filteredRules.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Aucune règle"
                description="Commencez avec un template ou créez votre première règle."
                action={<Button onClick={() => openTemplate(AUTOMATION_TEMPLATES[0])}>Utiliser un template</Button>}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredRules.map((rule) => (
                  <AutomationCard
                    key={rule.id}
                    rule={rule}
                    summary={formatAutomationSummary(rule)}
                    feedLabel={getFeedLabel(rule.feedIds || [])}
                    channelLabel={getChannelLabel(rule.channelIds || [])}
                    localePrefix={localePrefix}
                    previewLoading={previewRuleId === rule.id}
                    startingAbTestId={startingAbTestId}
                    onToggleActive={handleToggleActive}
                    onPreview={handlePreview}
                    onEdit={(r) => { setEditingRule(r); setShowModal(true); }}
                    onDelete={handleDelete}
                    onStartAbTest={handleStartAbTest}
                  />
                ))}
              </div>
            )}
          </PageCard>
        </div>
      </div>

      <RuleModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingRule(null); }}
        onSave={handleSave}
        onAbTestCreated={fetchRules}
        rule={editingRule}
        feeds={feeds}
        channels={CHANNELS}
      />

      <Dialog open={!!previewData} onOpenChange={(open) => { if (!open) { setPreviewData(null); setPreviewRuleId(null); } }}>
        {previewData && (
          <DialogContent style={{ maxWidth: 640 }}>
            <DialogHeader>
              <DialogTitle>Prévisualisation</DialogTitle>
              <DialogDescription>
                {previewMatches.length} produit(s) touché(s) sur {previewData.preview.length}
              </DialogDescription>
            </DialogHeader>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {previewMatches.slice(0, 5).map((item) => (
                <div
                  key={item.itemId}
                  style={{
                    padding: 16,
                    backgroundColor: "#f8faf9",
                    borderRadius: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--app-text-muted)", marginBottom: 4 }}>Avant</div>
                    <div style={{ fontSize: 13 }}>{item.before?.title || "—"}</div>
                  </div>
                  <div style={{ backgroundColor: "var(--app-accent-soft)", padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--app-accent)", marginBottom: 4 }}>Après</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.after?.title || "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </PageLayout>
  );
}
