"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import type { ActionJson, ConditionJson, Rule } from "./types";

const COMMON_OPERATORS = [
  { value: "equals", label: "égale" },
  { value: "not_equals", label: "différent de" },
  { value: "contains", label: "contient" },
  { value: "is_empty", label: "est vide" },
  { value: "is_not_empty", label: "n'est pas vide" },
];

const ADVANCED_OPERATORS = [
  { value: "starts_with", label: "commence par" },
  { value: "ends_with", label: "finit par" },
  { value: "not_in", label: "n'est pas dans la liste" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "in", label: "dans la liste" },
  { value: "regex", label: "correspond a une regex" },
];

const CONDITION_OPERATORS = [...COMMON_OPERATORS, ...ADVANCED_OPERATORS];

const ACTION_TYPES = [
  {
    value: "set_value",
    label: "Definir une valeur",
    description: "Remplacer un champ cible par une valeur fixe.",
  },
  {
    value: "template",
    label: "Reecrire avec un format",
    description: "Composer un champ a partir de plusieurs attributs.",
  },
  {
    value: "copy_field",
    label: "Copier un autre champ",
    description: "Reprendre une donnee existante dans un autre champ.",
  },
  {
    value: "calculate",
    label: "Calculer une nouvelle valeur",
    description: "Appliquer une formule de prix, de remise ou de marge.",
  },
  {
    value: "search_replace",
    label: "Rechercher / remplacer",
    description: "Nettoyer ou harmoniser un texte deja present.",
  },
  {
    value: "concat",
    label: "Concatener plusieurs champs",
    description: "Assembler plusieurs attributs dans l'ordre voulu.",
  },
  {
    value: "exclude",
    label: "Exclure de la diffusion",
    description: "Retirer du canal cible sans toucher a la source.",
  },
  {
    value: "ai_fill",
    label: "Completer avec l'IA",
    description: "Lancer l'IA uniquement sur les cas qui le meritent.",
  },
];

const STEP_LABELS = [
  "1. Quand",
  "2. Alors",
  "3. Où",
];

interface FieldOption {
  value: string;
  label: string;
  source?: "preset" | "mapping" | "item" | "customfield" | "mixed";
}

const FIELD_LABELS: Record<string, string> = {
  title: "le titre",
  brand: "la marque",
  price: "le prix",
  sale_price: "le prix promotionnel",
  sku: "le SKU",
  descriptionText: "la description",
  descriptionHtml: "la description HTML",
  imageUrl: "l'image",
  additional_image_link: "les images supplémentaires",
  url: "l'URL produit",
  google_product_category: "la catégorie Google",
  product_type: "le type produit",
  availability: "la disponibilité",
  inventory: "le stock",
  currency: "la devise",
  item_group_id: "l'identifiant de groupe",
  gtin: "le GTIN",
  mpn: "le MPN",
  condition: "l'état",
  color: "la couleur",
  size: "la taille",
  material: "la matière",
  pattern: "le motif",
  gender: "le genre",
  age_group: "la tranche d'âge",
  shipping: "les informations de livraison",
  tax: "la taxe",
  "customfields.gtin": "le GTIN",
  "customfields.mpn": "le MPN",
  "customfields.condition": "l'état",
  "customfields.color": "la couleur",
  "customfields.size": "la taille",
  "customfields.material": "la matière",
  "customfields.pattern": "le motif",
  "customfields.gender": "le genre",
  "customfields.age_group": "la tranche d'âge",
  "customfields.shipping": "les informations de livraison",
  "customfields.tax": "la taxe",
};

const FIELD_OPTIONS: FieldOption[] = [
  { value: "title", label: "Titre" },
  { value: "brand", label: "Marque" },
  { value: "price", label: "Prix" },
  { value: "sale_price", label: "Prix promotionnel" },
  { value: "sku", label: "SKU" },
  { value: "descriptionText", label: "Description" },
  { value: "descriptionHtml", label: "Description HTML" },
  { value: "imageUrl", label: "Image principale" },
  { value: "additional_image_link", label: "Images supplémentaires" },
  { value: "url", label: "URL produit" },
  { value: "google_product_category", label: "Catégorie Google" },
  { value: "product_type", label: "Type produit" },
  { value: "availability", label: "Disponibilité" },
  { value: "inventory", label: "Stock" },
  { value: "currency", label: "Devise" },
  { value: "item_group_id", label: "Item group ID" },
  { value: "customfields.gtin", label: "GTIN" },
  { value: "customfields.mpn", label: "MPN" },
  { value: "customfields.condition", label: "État" },
  { value: "customfields.color", label: "Couleur" },
  { value: "customfields.size", label: "Taille" },
  { value: "customfields.material", label: "Matière" },
  { value: "customfields.pattern", label: "Motif" },
  { value: "customfields.gender", label: "Genre" },
  { value: "customfields.age_group", label: "Tranche d'âge" },
  { value: "customfields.shipping", label: "Livraison" },
  { value: "customfields.tax", label: "Taxe" },
].map((field) => ({ ...field, source: "preset" as const }));

const AI_FIELD_OPTIONS = FIELD_OPTIONS.filter((field) =>
  ["title", "descriptionText", "brand", "google_product_category", "product_type"].includes(field.value),
);

const CALCULATED_FIELD_OPTIONS = FIELD_OPTIONS.filter((field) =>
  ["price", "sale_price"].includes(field.value),
);

type WizardStep = 1 | 2 | 3;

interface RuleModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Rule>) => Promise<{ id: string } | void>;
  onAbTestCreated?: () => void;
  rule: Rule | null;
  feeds: { id: string; name: string }[];
  channels: { key: string; label: string }[];
}

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

interface PreviewResultItem {
  itemId: string;
  title: string;
  matches: boolean;
  before: {
    field?: string | null;
    value?: string | number | null;
    title?: string | null;
  } | null;
  after: {
    field?: string | null;
    value?: string | number | null;
    title?: string | null;
  } | null;
}

interface DynamicFieldOption {
  key: string;
  label: string;
  source: string;
  feedIds: string[];
}

interface FieldPickerProps {
  value?: string;
  onChange: (value: string) => void;
  options?: FieldOption[];
  placeholder?: string;
  className?: string;
}

function humanizeField(field: string) {
  return field
    .replace(/^customfields\.|^customFields\./, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function fieldLabel(field?: string) {
  if (!field) return "ce champ";
  return FIELD_LABELS[field] || humanizeField(field);
}

function fieldSelectLabel(field?: string) {
  return FIELD_OPTIONS.find((option) => option.value === field)?.label || (field ? humanizeField(field) : "Champ");
}

function operatorLabel(operator?: string) {
  return CONDITION_OPERATORS.find((item) => item.value === operator)?.label || operator || "correspond à";
}

function conditionSummary(conditionJson: ConditionJson) {
  const joiner = conditionJson.operator === "OR" ? " ou " : " et ";

  return conditionJson.conditions
    .map((condition) => {
      if (condition.operator === "is_empty" || condition.operator === "is_not_empty") {
        return `${fieldLabel(condition.field)} ${operatorLabel(condition.operator)}`;
      }

      return `${fieldLabel(condition.field)} ${operatorLabel(condition.operator)} ${condition.value ?? ""}`;
    })
    .join(joiner);
}

function actionSummary(actionJson: ActionJson) {
  const params = actionJson.params || {};

  switch (actionJson.type) {
    case "set_value":
      return `définir ${fieldLabel(params.field)} sur ${params.value ?? ""}`;
    case "template":
      return `réécrire ${fieldLabel(params.field)} avec ${params.template ?? ""}`;
    case "copy_field":
      return `copier ${fieldLabel(params.sourceField)} dans ${fieldLabel(params.field)}`;
    case "calculate":
      return `recalculer ${fieldLabel(params.field)} avec ${params.formula ?? ""}`;
    case "search_replace":
      return `remplacer ${params.pattern ?? ""} dans ${fieldLabel(params.field)}`;
    case "concat":
      return `concaténer plusieurs champs dans ${fieldLabel(params.field)}`;
    case "exclude":
      return "exclure les produits qui correspondent aux conditions";
    case "ai_fill":
      return `compléter ${fieldLabel(params.field)} avec l'IA`;
    default:
      return "appliquer une action";
  }
}

function normalizeConditionValue(operator: string, rawValue: string) {
  if (["is_empty", "is_not_empty"].includes(operator)) {
    return undefined;
  }

  if (["in", "not_in"].includes(operator)) {
    return rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return rawValue;
}

function conditionValueToInputValue(
  value: Rule["conditionJson"]["conditions"][0]["value"],
  operator: string,
) {
  if (Array.isArray(value) && ["in", "not_in"].includes(operator)) {
    return value.join(", ");
  }

  return value ?? "";
}

function getValuePlaceholder(field: string, operator: string) {
  if (operator === "regex") {
    return "Regex, ex: ^nike|adidas$";
  }

  if (["in", "not_in"].includes(operator)) {
    return "Valeurs séparées par des virgules";
  }

  return `Valeur pour ${fieldSelectLabel(field).toLowerCase()}`;
}

function getActionDefaultParams(actionType: string, currentParams: ActionJson["params"]) {
  if (actionType === "exclude") {
    return {};
  }

  if (actionType === "ai_fill") {
    return { field: currentParams?.field || "title" };
  }

  return { ...currentParams, field: currentParams?.field || "title" };
}

function FieldPicker({
  value,
  onChange,
  options = FIELD_OPTIONS,
  placeholder,
  className,
}: FieldPickerProps) {
  const [open, setOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const query = (value || "").trim().toLowerCase();
    const ranked = query.length === 0
      ? options
      : options.filter((field) =>
          field.value.toLowerCase().includes(query) || field.label.toLowerCase().includes(query),
        );

    return ranked.slice(0, 14);
  }, [options, value]);

  const detectedOptions = filteredOptions.filter((field) => field.source && field.source !== "preset");
  const suggestedOptions = filteredOptions.filter((field) => !field.source || field.source === "preset");

  return (
    <div className={`relative ${className || ""}`}>
      <Input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
      />

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {detectedOptions.length > 0 ? (
            <div className="border-b border-slate-100 p-2">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Champs détectés
              </p>
              <div className="space-y-1">
                {detectedOptions.map((field) => (
                  <button
                    key={field.value}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(field.value);
                      setOpen(false);
                    }}
                    className="flex w-full items-start justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{field.label}</p>
                      <p className="text-xs text-slate-500">{field.value}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                      {field.source === "customfield" ? "Custom" : field.source === "mapping" ? "Mapping" : "Flux"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {suggestedOptions.length > 0 ? (
            <div className="p-2">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Suggestions
              </p>
              <div className="space-y-1">
                {suggestedOptions.map((field) => (
                  <button
                    key={field.value}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(field.value);
                      setOpen(false);
                    }}
                    className="flex w-full items-start justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{field.label}</p>
                      <p className="text-xs text-slate-500">{field.value}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      Base
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {filteredOptions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-500">
              Aucun champ détecté pour cette recherche. Vous pouvez continuer avec la saisie libre.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function RuleModal({
  open,
  onClose,
  onSave,
  onAbTestCreated,
  rule,
  feeds,
  channels,
}: RuleModalProps) {
  const [name, setName] = useState("");
  const [conditionJson, setConditionJson] = useState<ConditionJson>({
    operator: "AND",
    conditions: [{ field: "brand", operator: "equals", value: "" }],
  });
  const [actionJson, setActionJson] = useState<ActionJson>({
    type: "set_value",
    params: { field: "title", value: "" },
  });
  const [feedIds, setFeedIds] = useState<string[]>([]);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [runOnIngestion, setRunOnIngestion] = useState(true);
  const [priority, setPriority] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  const [createAbTest, setCreateAbTest] = useState(false);
  const [abTestName, setAbTestName] = useState("");
  const [abTestPlatform, setAbTestPlatform] = useState("");
  const [abTestControlPercent, setAbTestControlPercent] = useState(50);
  const [abTestVariantPercent, setAbTestVariantPercent] = useState(50);
  const [showAdvancedOperators, setShowAdvancedOperators] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [fieldOptionsLoading, setFieldOptionsLoading] = useState(false);
  const [dynamicFieldOptions, setDynamicFieldOptions] = useState<DynamicFieldOption[]>([]);
  const [previewData, setPreviewData] = useState<{
    affectedCount: number;
    preview: PreviewResultItem[];
    message?: string | null;
  } | null>(null);

  const isEditing = Boolean(rule?.id);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setConditionJson(rule.conditionJson || { operator: "AND", conditions: [{ field: "brand", operator: "equals", value: "" }] });
      setActionJson(rule.actionJson || { type: "set_value", params: { field: "title", value: "" } });
      setFeedIds(rule.feedIds || []);
      setChannelIds(rule.channelIds || []);
      setRunOnIngestion(rule.runOnIngestion !== false);
      setPriority(rule.priority ?? 0);
      setCreateAbTest(false);
      setAbTestName(rule.name ? `${rule.name} – A/B` : "");
      setAbTestPlatform(rule.channelIds?.[0] || channels[0]?.key || "");
      setAbTestControlPercent(50);
      setAbTestVariantPercent(50);
    } else {
      setName("");
      setConditionJson({ operator: "AND", conditions: [{ field: "brand", operator: "equals", value: "" }] });
      setActionJson({ type: "set_value", params: { field: "title", value: "" } });
      setFeedIds([]);
      setChannelIds([]);
      setRunOnIngestion(true);
      setPriority(0);
      setCreateAbTest(false);
      setAbTestName("");
      setAbTestPlatform(channels[0]?.key || "");
      setAbTestControlPercent(50);
      setAbTestVariantPercent(50);
    }

    setCurrentStep(1);
    setError(null);
    setPreviewData(null);
  }, [rule, open, channels]);

  const stepSummary = useMemo(() => {
    return {
      when: conditionSummary(conditionJson),
      action: actionSummary(actionJson),
      scope: `${feedIds.length > 0 ? `${feedIds.length} flux` : "tous les flux"} · ${channelIds.length > 0 ? `${channelIds.length} canaux` : "tous les canaux"}`,
    };
  }, [actionJson, channelIds.length, conditionJson, feedIds.length]);

  const availableFieldOptions = useMemo(() => {
    const merged = new Map(FIELD_OPTIONS.map((field) => [field.value, field]));

    for (const field of dynamicFieldOptions) {
      merged.set(field.key, {
        value: field.key,
        label: field.label || fieldSelectLabel(field.key),
      });
    }

    return Array.from(merged.values()).sort((left, right) => left.label.localeCompare(right.label, "fr"));
  }, [dynamicFieldOptions]);

  const dynamicFieldHint = useMemo(() => {
    if (fieldOptionsLoading) {
      return "Analyse des champs disponibles en cours...";
    }

    if (dynamicFieldOptions.length === 0) {
      return feedIds.length > 0
        ? "Aucun champ n'a été détecté automatiquement sur ce flux. Vous pouvez toujours saisir un champ manuellement."
        : "Sélectionnez un flux à l'étape 3 pour limiter les suggestions aux champs réellement présents dans ce flux.";
    }

    return feedIds.length > 0
      ? `${dynamicFieldOptions.length} champ(s) détecté(s) sur le flux sélectionné.`
      : `${dynamicFieldOptions.length} champ(s) détecté(s) sur vos flux. La liste se resserre automatiquement quand un flux est choisi.`;
  }, [dynamicFieldOptions.length, feedIds.length, fieldOptionsLoading]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadDynamicFields = async () => {
      setFieldOptionsLoading(true);
      try {
        const searchParams = new URLSearchParams();
        if (feedIds.length > 0) {
          searchParams.set("feedIds", feedIds.join(","));
        }
        searchParams.set("sampleSize", "250");
        const endpoint = `/ingestion/fields?${searchParams.toString()}`;
        const response = await apiClient.get<{ fields: DynamicFieldOption[] }>(endpoint);

        if (!cancelled) {
          setDynamicFieldOptions(response.data?.fields || []);
        }
      } catch {
        if (!cancelled) {
          setDynamicFieldOptions([]);
        }
      } finally {
        if (!cancelled) {
          setFieldOptionsLoading(false);
        }
      }
    };

    void loadDynamicFields();

    return () => {
      cancelled = true;
    };
  }, [feedIds, open]);

  const updateCondition = (index: number, updates: Partial<Rule["conditionJson"]["conditions"][0]>) => {
    setConditionJson((current) => ({
      ...current,
      conditions: current.conditions.map((condition, conditionIndex) =>
        conditionIndex === index ? { ...condition, ...updates } : condition,
      ),
    }));
  };

  const addCondition = () => {
    setConditionJson((current) => ({
      ...current,
      conditions: [...current.conditions, { field: "brand", operator: "equals", value: "" }],
    }));
  };

  const removeCondition = (index: number) => {
    setConditionJson((current) => ({
      ...current,
      conditions: current.conditions.filter((_, conditionIndex) => conditionIndex !== index),
    }));
  };

  const updateActionParams = (updates: Partial<ActionJson["params"]>) => {
    setActionJson((current) => ({
      ...current,
      params: { ...current.params, ...updates },
    }));
  };

  const showValueInput = (operator: string) => !["is_empty", "is_not_empty"].includes(operator);

  const goNext = () => {
    setCurrentStep((step) => (step < 3 ? ((step + 1) as WizardStep) : step));
  };

  const goBack = () => {
    setCurrentStep((step) => (step > 1 ? ((step - 1) as WizardStep) : step));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const saved = await onSave({
        name: name.trim(),
        conditionJson,
        actionJson,
        feedIds,
        channelIds,
        runOnIngestion,
        priority,
      });
      const ruleId = saved?.id ?? rule?.id;

      if (createAbTest && ruleId && abTestPlatform) {
        await apiClient.post("/ab-tests", {
          ruleId,
          name: abTestName.trim() || `${name.trim()} – A/B`,
          platform: abTestPlatform,
          controlPercent: abTestControlPercent,
          variantPercent: abTestVariantPercent,
        });
        onAbTestCreated?.();
      }

      onClose();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError.response?.data?.message || apiError.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<{
        ruleName: string;
        affectedCount: number;
        preview: PreviewResultItem[];
        message?: string | null;
      }>("/rules/preview", {
        draftRule: {
          name: name.trim() || "Prévisualisation",
          conditionJson,
          actionJson,
          feedIds,
          channelIds,
          runOnIngestion,
          priority,
        },
        limit: 5,
        feedId: feedIds[0],
        channelId: channelIds[0],
      });
      setPreviewData({
        affectedCount: response.data.affectedCount || 0,
        preview: response.data.preview || [],
        message: response.data.message,
      });
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError.response?.data?.message || apiError.message || "Impossible de générer la prévisualisation");
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifier la règle" : "Nouvelle règle"}</DialogTitle>
          <DialogDescription>
            Parcourez trois étapes simples: quand agir, quoi faire, puis où l&apos;appliquer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Stepper steps={3} currentStep={currentStep} />
          <div className="grid gap-2 sm:grid-cols-3">
            {STEP_LABELS.map((label, index) => {
              const step = (index + 1) as WizardStep;
              const isActive = currentStep === step;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCurrentStep(step)}
                  className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <p className="text-sm font-semibold">{label}</p>
                  <p className={`mt-1 text-xs leading-5 ${isActive ? "text-slate-200" : "text-slate-500"}`}>
                    {step === 1 ? "Déclencheur métier" : step === 2 ? "Transformation à appliquer" : "Portée et activation"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nom de la règle</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex: Compléter la catégorie Google si elle est vide"
                required
              />
            </div>

            {currentStep === 1 ? (
              <section className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Quand faut-il agir ?</label>
                  <p className="text-sm text-gray-500">
                    Définissez les conditions qui déclenchent la règle.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={conditionJson.operator}
                    onChange={(event) =>
                      setConditionJson((current) => ({
                        ...current,
                        operator: event.target.value as "AND" | "OR",
                      }))
                    }
                    className="w-auto min-w-[280px]"
                  >
                    <option value="AND">Toutes les conditions sont vraies</option>
                    <option value="OR">Au moins une condition est vraie</option>
                  </Select>
                </div>

                <div className="space-y-3">
                  {conditionJson.conditions.map((condition, index) => (
                    <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap gap-2">
                        <FieldPicker
                          value={condition.field}
                          onChange={(value) => updateCondition(index, { field: value })}
                          placeholder="Champ à vérifier"
                          className="min-w-[220px]"
                          options={availableFieldOptions}
                        />

                        <Select
                          value={condition.operator}
                          onChange={(event) => updateCondition(index, { operator: event.target.value })}
                          className="min-w-[190px]"
                        >
                          {(showAdvancedOperators
                            ? CONDITION_OPERATORS
                            : [...COMMON_OPERATORS, ...ADVANCED_OPERATORS.filter((operator) => operator.value === condition.operator)]
                          ).map((operator) => (
                            <option key={operator.value} value={operator.value}>
                              {operator.label}
                            </option>
                          ))}
                        </Select>

                        {showValueInput(condition.operator) ? (
                          <Input
                            value={conditionValueToInputValue(condition.value, condition.operator)}
                            onChange={(event) =>
                              updateCondition(index, {
                                value: normalizeConditionValue(condition.operator, event.target.value),
                              })
                            }
                            placeholder={getValuePlaceholder(condition.field, condition.operator)}
                            className="min-w-[180px]"
                          />
                        ) : null}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCondition(index)}
                          disabled={conditionJson.conditions.length <= 1}
                        >
                          Retirer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500">
                  Les operateurs de liste acceptent plusieurs valeurs separees par des virgules.
                  {" "}
                  L&apos;operateur regex est utile pour cibler des structures de titres, de SKU ou de marques plus avancees.
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                    Ajouter une condition
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedOperators((current) => !current)}
                    className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-700"
                  >
                    {showAdvancedOperators ? "Masquer les opérateurs avancés" : "Afficher les opérateurs avancés"}
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  Suggestions prêtes à l&apos;emploi ci-dessus, mais vous pouvez aussi saisir n&apos;importe quel champ, par exemple
                  {" "}
                  <span className="font-medium">customfields.color</span>
                  {" "}
                  ou
                  {" "}
                  <span className="font-medium">customfields.size</span>.
                </p>
                <p className="text-xs text-slate-500">{dynamicFieldHint}</p>
              </section>
            ) : null}

            {currentStep === 2 ? (
              <section className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Que faut-il faire ?</label>
                  <p className="text-sm text-gray-500">
                    Choisissez l&apos;action métier à appliquer quand les conditions sont remplies.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {ACTION_TYPES.map((action) => {
                    const selected = actionJson.type === action.value;
                    return (
                      <button
                        key={action.value}
                        type="button"
                        onClick={() =>
                          setActionJson((current) => ({
                            ...current,
                            type: action.value,
                            params: getActionDefaultParams(action.value, current.params || {}),
                          }))
                        }
                        className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <p className="text-sm font-semibold">{action.label}</p>
                        <p className={`mt-1 text-xs leading-5 ${selected ? "text-slate-200" : "text-slate-500"}`}>
                          {action.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  {actionJson.type === "set_value" ? (
                    <>
                      <FieldPicker
                        value={actionJson.params?.field}
                        onChange={(value) => updateActionParams({ field: value })}
                        placeholder="Champ à modifier"
                        options={availableFieldOptions}
                      />
                      <Input
                        placeholder="Valeur à appliquer"
                        value={actionJson.params?.value ?? ""}
                        onChange={(event) => updateActionParams({ value: event.target.value })}
                      />
                    </>
                  ) : null}

                  {actionJson.type === "template" ? (
                    <>
                      <FieldPicker
                        value={actionJson.params?.field}
                        onChange={(value) => updateActionParams({ field: value })}
                        placeholder="Champ à réécrire"
                        options={availableFieldOptions}
                      />
                      <Input
                        placeholder="Format (ex: {brand} - {title})"
                        value={actionJson.params?.template ?? ""}
                        onChange={(event) => updateActionParams({ template: event.target.value })}
                      />
                    </>
                  ) : null}

                  {actionJson.type === "copy_field" ? (
                    <>
                      <FieldPicker
                        value={actionJson.params?.field}
                        onChange={(value) => updateActionParams({ field: value })}
                        placeholder="Champ cible"
                        options={availableFieldOptions}
                      />
                      <FieldPicker
                        value={actionJson.params?.sourceField}
                        onChange={(value) => updateActionParams({ sourceField: value })}
                        placeholder="Champ source"
                        options={availableFieldOptions}
                      />
                    </>
                  ) : null}

                  {actionJson.type === "calculate" ? (
                    <>
                      <Select
                        value={actionJson.params?.field || ""}
                        onChange={(event) => updateActionParams({ field: event.target.value })}
                      >
                        {CALCULATED_FIELD_OPTIONS.map((field) => (
                          <option key={field.value} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        placeholder="Formule (ex: price * 0.9)"
                        value={actionJson.params?.formula ?? ""}
                        onChange={(event) => updateActionParams({ formula: event.target.value })}
                      />
                    </>
                  ) : null}

                  {actionJson.type === "search_replace" ? (
                    <>
                      <FieldPicker
                        value={actionJson.params?.field}
                        onChange={(value) => updateActionParams({ field: value })}
                        placeholder="Champ à modifier"
                        options={availableFieldOptions}
                      />
                      <Input
                        placeholder="Texte ou regex à remplacer"
                        value={actionJson.params?.pattern ?? ""}
                        onChange={(event) => updateActionParams({ pattern: event.target.value })}
                      />
                      <Input
                        placeholder="Remplacement"
                        value={actionJson.params?.replacement ?? ""}
                        onChange={(event) => updateActionParams({ replacement: event.target.value })}
                      />
                    </>
                  ) : null}

                  {actionJson.type === "concat" ? (
                    <>
                      <FieldPicker
                        value={actionJson.params?.field}
                        onChange={(value) => updateActionParams({ field: value })}
                        placeholder="Champ cible"
                        options={availableFieldOptions}
                      />
                      <Input
                        placeholder="Champs à concaténer, ex: brand, customfields.color, title"
                        value={Array.isArray(actionJson.params?.fields) ? actionJson.params.fields.join(", ") : ""}
                        onChange={(event) =>
                          updateActionParams({
                            fields: event.target.value
                              .split(",")
                              .map((field) => field.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                      <Input
                        placeholder="Séparateur"
                        value={actionJson.params?.separator ?? " "}
                        onChange={(event) => updateActionParams({ separator: event.target.value })}
                      />
                    </>
                  ) : null}

                  {actionJson.type === "ai_fill" ? (
                    <>
                      <Select
                        value={actionJson.params?.field || ""}
                        onChange={(event) => updateActionParams({ field: event.target.value })}
                      >
                        {AI_FIELD_OPTIONS.map((field) => (
                          <option key={field.value} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-gray-500">
                        Utilisez cette action pour ne lancer l&apos;IA que sur les cas où elle apporte vraiment quelque chose.
                      </p>
                      <p className="text-xs text-slate-500">
                        Ici la liste reste volontairement courte: seuls les champs déjà bien supportés par le moteur IA sont proposés.
                      </p>
                    </>
                  ) : null}

                  {actionJson.type === "exclude" ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-medium text-amber-900">
                        Les produits qui matchent seront exclus du perimetre choisi.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-amber-800">
                        C&apos;est utile pour retirer des produits indisponibles, hors stock ou non conformes d&apos;un canal
                        sans modifier le catalogue source.
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {currentStep === 3 ? (
              <section className="space-y-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Où faut-il l&apos;appliquer ?</label>
                  <p className="text-sm text-gray-500">
                    Définissez la portée de la règle, son mode d&apos;exécution et les options avancées.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setFeedIds([])}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      feedIds.length === 0
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold">Tous les flux</p>
                    <p className={`mt-1 text-xs ${feedIds.length === 0 ? "text-slate-200" : "text-slate-500"}`}>
                      La règle s&apos;applique à l&apos;ensemble du catalogue.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannelIds([])}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      channelIds.length === 0
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold">Tous les canaux</p>
                    <p className={`mt-1 text-xs ${channelIds.length === 0 ? "text-slate-200" : "text-slate-500"}`}>
                      Pas de canal spécifique, la règle reste globale.
                    </p>
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Flux concernés (vide = tous)</label>
                    <select
                      multiple
                      value={feedIds}
                      onChange={(event) =>
                        setFeedIds(Array.from(event.target.selectedOptions, (option) => option.value))
                      }
                      className="h-28 w-full rounded border p-3 text-sm"
                    >
                      {feeds.map((feed) => (
                        <option key={feed.id} value={feed.id}>
                          {feed.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Canaux concernés (vide = tous)</label>
                    <select
                      multiple
                      value={channelIds}
                      onChange={(event) =>
                        setChannelIds(Array.from(event.target.selectedOptions, (option) => option.value))
                      }
                      className="h-28 w-full rounded border p-3 text-sm"
                    >
                      {channels.map((channel) => (
                        <option key={channel.key} value={channel.key}>
                          {channel.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Switch checked={runOnIngestion} onCheckedChange={setRunOnIngestion} />
                    Appliquer automatiquement à l&apos;ingestion
                  </label>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Priorité (0 = max)</label>
                    <Input
                      type="number"
                      min={0}
                      value={priority}
                      onChange={(event) => setPriority(parseInt(event.target.value, 10) || 0)}
                      className="w-24"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={createAbTest} onCheckedChange={setCreateAbTest} />
                    <label className="text-sm font-medium text-gray-700">Créer aussi un test A/B</label>
                  </div>

                  {createAbTest ? (
                    <div className="grid gap-3 pl-6 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Nom du test</label>
                        <Input
                          value={abTestName}
                          onChange={(event) => setAbTestName(event.target.value)}
                          placeholder={name ? `${name} – A/B` : "Mon test A/B"}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Canal</label>
                        <select
                          value={abTestPlatform}
                          onChange={(event) => setAbTestPlatform(event.target.value)}
                          className="w-full rounded border px-3 py-2 text-sm"
                        >
                          {channels.map((channel) => (
                            <option key={channel.key} value={channel.key}>
                              {channel.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Témoin %</label>
                        <Input
                          type="number"
                          min={10}
                          max={90}
                          value={abTestControlPercent}
                          onChange={(event) => {
                            const nextValue = parseInt(event.target.value, 10) || 50;
                            setAbTestControlPercent(nextValue);
                            setAbTestVariantPercent(100 - nextValue);
                          }}
                          className="w-24"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Variant %</label>
                        <Input type="number" min={10} max={90} value={abTestVariantPercent} readOnly className="w-24 bg-gray-100" />
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <DialogFooter className="flex-row justify-between">
              <div>
                {currentStep > 1 ? (
                  <Button type="button" variant="outline" onClick={goBack}>
                    Retour
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={onClose}>
                    Annuler
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={handlePreview} disabled={previewLoading}>
                  {previewLoading ? "Préparation..." : "Prévisualiser l'impact"}
                </Button>
                {currentStep < 3 ? (
                  <Button type="button" onClick={goNext}>
                    Continuer
                  </Button>
                ) : (
                  <Button type="submit" disabled={saving}>
                    {saving ? "Enregistrement..." : isEditing ? "Enregistrer les changements" : "Créer la règle"}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </div>

          <aside className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Résumé</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                {name.trim() || "Votre règle"}
              </h3>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Quand</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{stepSummary.when}</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Alors</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{stepSummary.action}</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Portée</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{stepSummary.scope}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Impact estimé</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {previewData
                      ? `${previewData.affectedCount} produit(s) correspondent à cette règle dans l'échantillon.`
                      : "Lancez une prévisualisation pour voir combien de produits seront touchés."}
                  </p>
                </div>
              </div>

              {previewData?.message ? (
                <p className="mt-3 text-xs text-slate-500">{previewData.message}</p>
              ) : null}

              {previewData && previewData.preview.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {previewData.preview.slice(0, 3).map((item) => (
                    <div key={item.itemId} className="rounded-2xl border border-slate-200 p-3">
                      <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                      {item.matches ? (
                        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 p-2 text-slate-600">
                            <p className="font-semibold text-slate-400">Avant</p>
                            <p className="mt-1">{item.before?.value ?? item.before?.title ?? "—"}</p>
                          </div>
                          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-800">
                            <p className="font-semibold text-emerald-500">Après</p>
                            <p className="mt-1">{item.after?.value ?? item.after?.title ?? "—"}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-400">Le produit ne correspond pas aux conditions.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">
              {currentStep === 1
                ? "Commencez par formuler le déclencheur de façon simple: si catégorie = X, si champ vide, si prix < 10."
                : currentStep === 2
                  ? "Choisissez une action claire. Le meilleur levier d'adoption reste une transformation simple et prévisible."
                  : "Terminez par la portée: tous les flux, un canal spécifique, exécution automatique ou non."}
            </div>
          </aside>
        </form>
      </DialogContent>
    </Dialog>
  );
}
