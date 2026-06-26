/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePlanCapabilities } from "@/hooks/use-plan-capabilities";
import { API_BASE_URL, apiClient, authFetch } from "@/lib/api";
import {
  getOptimizedPlatformContent,
  hasStoredOptimizedContent,
  parseProductCustomFields,
  type OptimizedPlatformKey,
} from "@/lib/optimized-product-content";
import { AlertCircle, ChevronDown, Copy, FileText, ImageIcon, ImagePlus, Loader2, Sparkles } from "lucide-react";

type LifestyleChannel = "global" | "gmc" | "facebook" | "leroyMerlin";

interface AiProduct {
  id: string;
  title?: string | null;
  sku?: string | null;
  brand?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  customfields?: Record<string, unknown> | string | null;
}

interface ProductAiOptimizationModalProps {
  product: AiProduct;
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => Promise<void> | void;
  autoGenerateOnOpen?: boolean;
  destinations?: Array<{
    id: string;
    label: string;
    platformKey: OptimizedPlatformKey;
    summary?: string | null;
  }>;
  initialDestinationId?: string | null;
}

const PLATFORMS: Array<{ value: OptimizedPlatformKey; label: string }> = [
  { value: "gmc", label: "Google Merchant Center" },
  { value: "meta", label: "Meta (Facebook / Instagram)" },
  { value: "amazon", label: "Amazon" },
  { value: "chatgpt", label: "ChatGPT / LLM" },
];

type ProductVisualProfile = "textile" | "home" | "beauty" | "food" | "technical" | "generic";
type ImageRenderMode = "auto" | "packshot" | "studio" | "worn" | "flatlay" | "lifestyle" | "technical";
type MannequinProfile = "none" | "woman" | "man" | "child";

const IMAGE_RENDER_MODES: Array<{ value: ImageRenderMode; label: string; hint: string }> = [
  { value: "auto", label: "Auto", hint: "FeedPlug recommande le rendu le plus adapté au produit." },
  { value: "packshot", label: "Packshot", hint: "Fond propre, très catalogue, sans décor." },
  { value: "studio", label: "Studio", hint: "Rendu premium sur fond neutre et lumière maîtrisée." },
  { value: "worn", label: "Porté", hint: "Produit montré sur mannequin ou en situation de port." },
  { value: "flatlay", label: "Flat lay", hint: "Vue à plat, utile pour textile et accessoires." },
  { value: "lifestyle", label: "Lifestyle", hint: "Contexte d’usage réaliste, plus marketing." },
  { value: "technical", label: "Technique", hint: "Vue propre et lisible pour produits utilitaires." },
];

const LIFESTYLE_PRESETS: Array<{
  value: string;
  label: string;
  mode: Exclude<ImageRenderMode, "auto">;
  profiles: ProductVisualProfile[];
}> = [
  { value: "neutral", label: "Studio neutre", mode: "packshot", profiles: ["generic", "textile", "beauty", "food", "technical", "home"] },
  { value: "studio_shadow", label: "Studio premium", mode: "studio", profiles: ["generic", "beauty", "technical", "home"] },
  { value: "on_model_studio", label: "Porté studio", mode: "worn", profiles: ["textile"] },
  { value: "flat_lay_editorial", label: "Flat lay éditorial", mode: "flatlay", profiles: ["textile", "beauty"] },
  { value: "folded_stack", label: "Produit plié / stack", mode: "flatlay", profiles: ["textile"] },
  { value: "living_room", label: "Salon", mode: "lifestyle", profiles: ["home", "generic"] },
  { value: "kitchen", label: "Cuisine", mode: "lifestyle", profiles: ["home", "food"] },
  { value: "bathroom", label: "Salle de bain", mode: "lifestyle", profiles: ["beauty", "home"] },
  { value: "outdoor", label: "Extérieur", mode: "lifestyle", profiles: ["generic", "textile"] },
  { value: "desk", label: "Bureau", mode: "lifestyle", profiles: ["technical", "generic"] },
  { value: "technical_clean", label: "Vue technique propre", mode: "technical", profiles: ["technical"] },
  { value: "in_hand_macro", label: "Macro en main", mode: "technical", profiles: ["beauty", "generic"] },
];

const LIFESTYLE_MODELS = [
  { id: "imagen-3.0-capability-001", label: "Imagen 3 (plus réaliste)" },
  { id: "imagen-4.0-capability", label: "Imagen 4 (expérimental)" },
  { id: "gemini-2.5-flash-image", label: "Nano Banana" },
  { id: "gemini-2.5-flash-preview-05-20", label: "Nano Banana preview" },
] as const;

const MANNEQUIN_OPTIONS: Array<{ value: MannequinProfile; label: string }> = [
  { value: "none", label: "Sans mannequin" },
  { value: "woman", label: "Mannequin femme" },
  { value: "man", label: "Mannequin homme" },
  { value: "child", label: "Mannequin enfant" },
];

function getLifestyleChannel(platform: OptimizedPlatformKey): LifestyleChannel {
  if (platform === "gmc") return "gmc";
  if (platform === "meta") return "facebook";
  return "global";
}

function getLifestyleUrls(customfields: Record<string, unknown>): Partial<Record<LifestyleChannel, string | null>> {
  const raw = customfields._lifestyleImageUrls;
  if (!raw || typeof raw !== "object") return {};
  return raw as Partial<Record<LifestyleChannel, string | null>>;
}

function toApiPlatform(platform: OptimizedPlatformKey): string {
  if (platform === "chatgpt") return "CHATGPT";
  return platform.toUpperCase();
}

function stripHtml(value: string | null | undefined): string {
  return (value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeHighlightsText(value: string): string {
  return value
    .split("\n")
    .map((entry) => entry.replace(/^[\s\-•]+/, "").trim())
    .filter(Boolean)
    .join("\n");
}

function normalizeStoredAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("https://storage.googleapis.com/")) {
    return value.split("?")[0] || value;
  }
  return value;
}

function inferProductVisualProfile(product: AiProduct, description: string): ProductVisualProfile {
  const haystack = `${product.title || ""} ${product.brand || ""} ${product.sku || ""} ${description || ""}`.toLowerCase();

  if (/(shirt|t-shirt|tee|hoodie|sweat|pant|pants|jacket|dress|coat|pull|pullover|jean|short|legging|textile|chemise|veste|pantalon|robe|mode|sneaker|shoe)/.test(haystack)) {
    return "textile";
  }
  if (/(sofa|chair|table|lamp|cushion|vase|furniture|living room|kitchen|bathroom|interior|décor|deco|maison|canape|chaise|lampe|meuble)/.test(haystack)) {
    return "home";
  }
  if (/(cream|serum|makeup|cosmetic|shampoo|perfume|skincare|beauty|beauté|cosmetique|parfum)/.test(haystack)) {
    return "beauty";
  }
  if (/(coffee|tea|food|drink|bottle|snack|wine|huile|epice|épice|aliment|boisson)/.test(haystack)) {
    return "food";
  }
  if (/(tool|part|industrial|component|hardware|technical|b2b|atelier|piece|pièce|machine|equipment|accessoire auto)/.test(haystack)) {
    return "technical";
  }
  return "generic";
}

function getRecommendedRenderMode(profile: ProductVisualProfile): ImageRenderMode {
  switch (profile) {
    case "textile":
      return "worn";
    case "home":
      return "lifestyle";
    case "beauty":
      return "studio";
    case "food":
      return "lifestyle";
    case "technical":
      return "technical";
    default:
      return "studio";
  }
}

function getProfileLabel(profile: ProductVisualProfile): string {
  switch (profile) {
    case "textile":
      return "Textile";
    case "home":
      return "Maison";
    case "beauty":
      return "Beaute";
    case "food":
      return "Food";
    case "technical":
      return "Technique";
    default:
      return "Generaliste";
  }
}

export function ProductAiOptimizationModal({
  product,
  isOpen,
  onClose,
  onApplied,
  autoGenerateOnOpen = false,
  destinations = [],
  initialDestinationId = null,
}: ProductAiOptimizationModalProps) {
  const { canUseAddonIA } = usePlanCapabilities();
  const [platform, setPlatform] = useState<OptimizedPlatformKey>("gmc");
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>("global");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [highlightsText, setHighlightsText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleLoading, setTitleLoading] = useState(false);
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [renderMode, setRenderMode] = useState<ImageRenderMode>("auto");
  const [lifestylePreset, setLifestylePreset] = useState("neutral");
  const [lifestyleModel, setLifestyleModel] = useState<string>("imagen-3.0-capability-001");
  const [mannequinProfile, setMannequinProfile] = useState<MannequinProfile>("none");
  const [customSceneInput, setCustomSceneInput] = useState("");
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null);
  const [uploadedMimeType, setUploadedMimeType] = useState("image/jpeg");
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"texte" | "image">("texte");
  const [showAdvancedImage, setShowAdvancedImage] = useState(false);
  const pasteZoneRef = useRef<HTMLDivElement>(null);
  const autoGenerateTriggeredRef = useRef(false);
  const scopeBootstrapPendingRef = useRef(false);
  const scopeBootstrappedRef = useRef(false);
  const generateAllRef = useRef<() => Promise<void>>(async () => {});

  const customfields = useMemo(() => parseProductCustomFields(product.customfields), [product.customfields]);
  const selectedDestination = useMemo(
    () => destinations.find((destination) => destination.id === selectedDestinationId) ?? null,
    [destinations, selectedDestinationId]
  );
  const currentPlatformContent = useMemo(
    () => getOptimizedPlatformContent(
      customfields,
      platform,
      selectedDestination ? { destinationId: selectedDestination.id } : undefined
    ),
    [customfields, platform, selectedDestination]
  );
  const hasScopedDestinationContent = useMemo(
    () => selectedDestination
      ? hasStoredOptimizedContent(customfields, platform, {
          destinationId: selectedDestination.id,
          allowPlatformFallback: false,
        })
      : false,
    [customfields, platform, selectedDestination]
  );
  const currentLifestyleUrl = useMemo(() => {
    const urls = getLifestyleUrls(customfields);
    const target = getLifestyleChannel(platform);
    return urls[target] ?? urls.global ?? null;
  }, [customfields, platform]);
  const baselineTitle = (currentPlatformContent.title ?? product.title ?? "").trim();
  const baselineDescription = (currentPlatformContent.description ?? stripHtml(product.description)).trim();
  const productProfile = useMemo(
    () => inferProductVisualProfile(product, currentPlatformContent.description ?? stripHtml(product.description)),
    [product, currentPlatformContent.description]
  );
  const recommendedRenderMode = useMemo(() => getRecommendedRenderMode(productProfile), [productProfile]);
  const availablePresets = useMemo(() => {
    const effectiveMode = renderMode === "auto" ? recommendedRenderMode : renderMode;
    return LIFESTYLE_PRESETS.filter((preset) => {
      const modeMatch =
        effectiveMode === "packshot"
          ? preset.mode === "packshot" || preset.mode === "studio"
          : preset.mode === effectiveMode;
      return modeMatch && preset.profiles.includes(productProfile);
    });
  }, [productProfile, renderMode, recommendedRenderMode]);
  const recommendedPreset = useMemo(
    () => availablePresets[0]?.value ?? "neutral",
    [availablePresets]
  );
  const baselineHighlightsText = useMemo(
    () => normalizeHighlightsText(currentPlatformContent.highlights.join("\n")),
    [currentPlatformContent.highlights]
  );
  const selectedScopeLabel = selectedDestination ? selectedDestination.label : "Version globale FeedPlug";
  const hasUnappliedChanges = useMemo(() => {
    return (
      title.trim() !== baselineTitle ||
      description.trim() !== baselineDescription ||
      normalizeHighlightsText(highlightsText) !== baselineHighlightsText ||
      (imageUrl ?? "") !== (currentLifestyleUrl ?? "")
    );
  }, [title, baselineTitle, description, baselineDescription, highlightsText, baselineHighlightsText, imageUrl, currentLifestyleUrl]);

  useEffect(() => {
    if (!isOpen) {
      scopeBootstrapPendingRef.current = false;
      scopeBootstrappedRef.current = false;
      return;
    }
    if (scopeBootstrappedRef.current) return;

    scopeBootstrappedRef.current = true;
    const nextDestinationId = initialDestinationId || "global";
    const nextDestination = destinations.find((destination) => destination.id === nextDestinationId) ?? null;
    const nextPlatform = nextDestination?.platformKey ?? platform;
    const needsScopeSync = selectedDestinationId !== nextDestinationId || nextPlatform !== platform;

    if (selectedDestinationId !== nextDestinationId) {
      setSelectedDestinationId(nextDestinationId);
    }
    if (nextPlatform !== platform) {
      setPlatform(nextPlatform);
    }
    scopeBootstrapPendingRef.current = needsScopeSync;
  }, [destinations, initialDestinationId, isOpen, platform, selectedDestinationId]);

  useEffect(() => {
    if (!isOpen) return;
    if (scopeBootstrapPendingRef.current) {
      scopeBootstrapPendingRef.current = false;
      return;
    }
    setSelectedDestinationId(initialDestinationId || "global");
    setError(null);
    setTitle(currentPlatformContent.title ?? product.title ?? "");
    setDescription(currentPlatformContent.description ?? stripHtml(product.description));
    setHighlightsText(currentPlatformContent.highlights.join("\n"));
    setImageUrl(currentLifestyleUrl);
    setImageChanged(false);
    setMannequinProfile("none");
    setCustomSceneInput("");
    setUploadedBase64(null);
    setUploadedMimeType("image/jpeg");
  }, [currentLifestyleUrl, currentPlatformContent, initialDestinationId, isOpen, product.title, product.description]);

  useEffect(() => {
    if (!isOpen) return;
    setRenderMode("auto");
  }, [isOpen, product.id]);

  useEffect(() => {
    if (!selectedDestination) return;
    if (platform !== selectedDestination.platformKey) {
      setPlatform(selectedDestination.platformKey);
    }
  }, [platform, selectedDestination]);

  useEffect(() => {
    if (!availablePresets.some((preset) => preset.value === lifestylePreset)) {
      setLifestylePreset(recommendedPreset);
    }
  }, [availablePresets, lifestylePreset, recommendedPreset]);

  const handleRequestClose = () => {
    if (saving) return;
    if (hasUnappliedChanges) {
      setConfirmCloseOpen(true);
      return;
    }
    onClose();
  };

  const requestAi = async <T,>(endpoint: string, body: Record<string, unknown>): Promise<T> => {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data: Record<string, unknown> = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok) {
      const code = typeof data.code === "string" ? data.code : "";
      const message =
        (typeof data.message === "string" && data.message) ||
        (typeof data.detail === "string" && data.detail) ||
        `Erreur ${response.status}`;
      if (response.status === 403 && (code === "PLAN_FEATURE" || code === "PLAN_LIMIT")) {
        throw new Error("Cette fonctionnalité nécessite le Pack IA. Activez-le depuis la page Tarifs.");
      }
      throw new Error(message);
    }
    return data as T;
  };

  const generateTitle = async () => {
    setTitleLoading(true);
    setError(null);
    try {
      const data = await requestAi<{ optimizedTitle?: string }>("/enrichment/optimize-title", {
        itemId: product.id,
        platform: toApiPlatform(platform),
        forceRefresh: true,
        saveDestinationId: selectedDestination?.id,
      });
      if (data.optimizedTitle?.trim()) {
        setTitle(data.optimizedTitle);
      } else {
        throw new Error("Aucun titre optimisé retourné.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de la génération du titre.");
    } finally {
      setTitleLoading(false);
    }
  };

  const generateDescription = async () => {
    setDescriptionLoading(true);
    setError(null);
    try {
      const data = await requestAi<{ optimizedDescription?: string }>("/enrichment/optimize-description", {
        itemId: product.id,
        platform: toApiPlatform(platform),
        forceRefresh: true,
        saveDestinationId: selectedDestination?.id,
      });
      if (data.optimizedDescription?.trim()) {
        setDescription(data.optimizedDescription);
      } else {
        throw new Error("Aucune description optimisée retournée.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de la génération de la description.");
    } finally {
      setDescriptionLoading(false);
    }
  };

  const generateHighlights = async () => {
    setHighlightsLoading(true);
    setError(null);
    try {
      const data = await requestAi<{ highlights?: string[] }>("/enrichment/generate-highlights", {
        itemId: product.id,
        platform: toApiPlatform(platform),
        forceRefresh: true,
        saveDestinationId: selectedDestination?.id,
      });
      if (Array.isArray(data.highlights) && data.highlights.length > 0) {
        setHighlightsText(data.highlights.join("\n"));
      } else {
        throw new Error("Aucun highlight généré.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de la génération des highlights.");
    } finally {
      setHighlightsLoading(false);
    }
  };

  const handleLifestylePaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const imageItem = event.clipboardData?.items && Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const match = result.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return;
      setUploadedBase64(match[2]);
      setUploadedMimeType(match[1] || "image/jpeg");
    };
    reader.readAsDataURL(file);
  };

  const generateImage = async () => {
    const sourceImageUrl = product.imageUrl;
    if (!sourceImageUrl && !uploadedBase64) {
      setError("Aucune image produit disponible pour générer la mise en situation.");
      return;
    }
    setImageLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 200000);
    try {
      const body: Record<string, string> = {
        scenePreset: lifestylePreset,
        provider: "vertex",
        model: lifestyleModel,
        feedItemId: product.id,
      };
      if (mannequinProfile !== "none") body.mannequinProfile = mannequinProfile;
      if (customSceneInput.trim()) body.customScene = customSceneInput.trim();
      if (product.title) body.productTitle = product.title;
      if (product.brand) body.productBrand = product.brand;
      if (product.url) body.productPageUrl = product.url;
      if (description) body.productDescription = description.slice(0, 500);
      if (uploadedBase64) {
        body.imageBase64 = uploadedBase64;
        body.imageMimeType = uploadedMimeType;
      } else if (sourceImageUrl) {
        body.imageUrl = sourceImageUrl;
      }
      const response = await authFetch(`${API_BASE_URL}/enrichment/generate-lifestyle-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      let data: Record<string, unknown> = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }
      if (!response.ok) {
        const message =
          (typeof data.message === "string" && data.message) ||
          (typeof data.detail === "string" && data.detail) ||
          "Génération d'image échouée.";
        throw new Error(message);
      }
      const nextUrl = typeof data.url === "string" ? data.url : null;
      if (!nextUrl) {
        throw new Error("Aucune image générée.");
      }
      setImageUrl(nextUrl);
      setImageChanged(true);
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      setError(isAbort ? "La génération a expiré. Réessayez, l'image peut prendre 1 à 2 minutes." : err instanceof Error ? err.message : "Erreur lors de la génération de l'image.");
    } finally {
      clearTimeout(timeoutId);
      setImageLoading(false);
    }
  };

  generateAllRef.current = async () => {
    await Promise.all([
      generateTitle(),
      generateDescription(),
      generateHighlights(),
      generateImage(),
    ]);
  };

  useEffect(() => {
    if (!isOpen) {
      autoGenerateTriggeredRef.current = false;
      return;
    }
    if (!autoGenerateOnOpen || autoGenerateTriggeredRef.current || !canUseAddonIA) return;
    autoGenerateTriggeredRef.current = true;
    void generateAllRef.current();
  }, [autoGenerateOnOpen, canUseAddonIA, isOpen]);

  const copyImageUrl = async () => {
    if (!imageUrl) return;
    await navigator.clipboard.writeText(imageUrl);
  };

  const handleApply = async () => {
    setSaving(true);
    setError(null);
    try {
      const highlights = highlightsText
        .split("\n")
        .map((entry) => entry.replace(/^[\s\-•]+/, "").trim())
        .filter(Boolean);
      await apiClient.patch(`/ingestion/items/${product.id}/optimized`, {
        platform,
        destinationId: selectedDestination?.id,
        title: title.trim(),
        description: description.trim(),
        highlights,
      });

      const persistedImageUrl = normalizeStoredAssetUrl(imageUrl);
      const nextCustomfields = { ...customfields };

      if (imageChanged && persistedImageUrl) {
        const lifestyleUrls = getLifestyleUrls(nextCustomfields);
        const target = getLifestyleChannel(platform);
        nextCustomfields._lifestyleImageUrls = {
          ...lifestyleUrls,
          global: target === "global" ? persistedImageUrl : lifestyleUrls.global ?? persistedImageUrl,
          [target]: persistedImageUrl,
        };
      }

      const payload: Record<string, unknown> = {};
      if (!selectedDestination) {
        payload.title = title.trim() || product.title || "";
        payload.descriptionText = description.trim();
      }
      if (imageChanged) {
        payload.customfields = nextCustomfields;
        if (persistedImageUrl) {
          payload.imageUrl = persistedImageUrl;
        }
      }
      if (Object.keys(payload).length > 0) {
        await apiClient.put(`/ingestion/items/${product.id}`, payload);
      }
      await onApplied?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ConfirmDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        title="Fermer sans appliquer les contenus IA ?"
        description="Les titres, descriptions, highlights ou visuels générés et non appliqués seront perdus."
        confirmLabel="Fermer sans appliquer"
        destructive
        onConfirm={() => {
          setConfirmCloseOpen(false);
          onClose();
        }}
      />
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleRequestClose(); }}>
      <DialogContent className="max-w-3xl w-[92vw] max-h-[90vh] overflow-hidden p-0">
        <DialogTitle className="sr-only">Optimisation IA produit</DialogTitle>
        <DialogDescription className="sr-only">
          Une seule modale pour optimiser le titre, la description, les highlights et l&apos;image produit.
        </DialogDescription>
        <div className="flex max-h-[90vh] flex-col bg-white">
          <div className="border-b border-border bg-white px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  Optimisation IA unifiée
                </div>
                <h2 className="mt-1 line-clamp-2 text-xl font-semibold text-foreground">{product.title || "Produit sans titre"}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {product.sku && (
                    <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
                      {product.sku}
                    </span>
                  )}
                  <span>Titre, description, highlights et image dans un seul flux.</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedDestinationId}
                  onChange={(event) => setSelectedDestinationId(event.target.value)}
                  className="h-10 max-w-[320px] rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="global">Version globale FeedPlug</option>
                  {destinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>{destination.label}</option>
                  ))}
                </select>
                <select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value as OptimizedPlatformKey)}
                  disabled={Boolean(selectedDestination)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {PLATFORMS.map((entry) => (
                    <option key={entry.value} value={entry.value}>{entry.label}</option>
                  ))}
                </select>
                <Button type="button" variant="outline" onClick={() => void generateAllRef.current()} disabled={!canUseAddonIA || titleLoading || descriptionLoading || highlightsLoading || imageLoading}>
                  {(titleLoading || descriptionLoading || highlightsLoading || imageLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Tout générer
                </Button>
              </div>
            </div>
            {!canUseAddonIA && (
              <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-900">
                <AlertDescription>
                  Le Pack IA est nécessaire pour ces actions. <Link href="/tarifs" prefetch={false} className="font-medium underline">Voir les tarifs</Link>
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive" className="mt-4 border-red-200 bg-red-50/90 text-red-950">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-start justify-between gap-3">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-xs font-medium text-red-700 underline-offset-2 hover:underline"
                  >
                    Fermer
                  </button>
                </AlertDescription>
              </Alert>
            )}
            {hasUnappliedChanges && !error && (
              <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-950">
                <AlertDescription>
                  Une version IA est en attente d&apos;application. Clique sur <strong>Appliquer</strong> pour l&apos;enregistrer sur la fiche produit.
                </AlertDescription>
              </Alert>
            )}
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              <strong className="font-medium text-foreground">{selectedScopeLabel}</strong>
              {selectedDestination
                ? hasScopedDestinationContent
                  ? " dispose déjà d'une version dédiée. Les changements resteront limités à cette destination."
                  : " n'a pas encore de version dédiée. FeedPlug part de la meilleure version existante pour vous laisser l'adapter sans toucher à la fiche source."
                : " reste la base commune partagée entre vos différents marchés."}
            </p>
          </div>

          <div className="border-b border-border bg-white px-6">
            <div role="tablist" aria-label="Sections d'optimisation" className="flex gap-6">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "texte"}
                onClick={() => setActiveTab("texte")}
                className={`-mb-px flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === "texte"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-4 w-4" />
                Texte
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "image"}
                onClick={() => setActiveTab("image")}
                className={`-mb-px flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === "image"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <ImageIcon className="h-4 w-4" />
                Image
                {imageUrl && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeTab === "texte" ? (
              <div className="space-y-6">
                <section className="rounded-xl border border-border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Titre produit</h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedDestination
                          ? `Version mémorisée pour ${selectedScopeLabel}, sans écraser le titre source.`
                          : `Version appliquée à la fiche et mémorisée pour ${PLATFORMS.find((entry) => entry.value === platform)?.label}.`}
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => void generateTitle()} disabled={!canUseAddonIA || titleLoading}>
                      {titleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Générer
                    </Button>
                  </div>
                  <textarea
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input px-3 py-2 text-sm leading-6"
                  />
                </section>

                <section className="rounded-xl border border-border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Description</h3>
                      <p className="text-xs text-muted-foreground">
                        {platform === "gmc"
                          ? "Texte factuel, lisible et conforme au style Google Merchant Center. Pas de ✓, pas de blocs marketing."
                          : selectedDestination
                            ? "Texte localisé pour cette destination, sans modifier la description source."
                            : "Texte long optimisé pour la fiche produit et la plateforme cible."}
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => void generateDescription()} disabled={!canUseAddonIA || descriptionLoading}>
                      {descriptionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Générer
                    </Button>
                  </div>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={8}
                    placeholder={platform === "gmc" ? "Description factuelle en 2 à 3 paragraphes courts." : undefined}
                    className="min-h-[220px] w-full rounded-md border border-input px-3 py-2 text-sm leading-6"
                  />
                </section>

                <section className="rounded-xl border border-border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Highlights produit</h3>
                      <p className="text-xs text-muted-foreground">
                        {platform === "gmc"
                          ? "Un fragment par ligne. Pour GMC: 4 à 6 points courts, concrets, sans promo ni information magasin."
                          : selectedDestination
                            ? "Un point par ligne. Ils seront stockés dans la couche optimisée de cette destination."
                            : "Un point par ligne. Ils sont stockés dans la couche optimisée par plateforme."}
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => void generateHighlights()} disabled={!canUseAddonIA || highlightsLoading}>
                      {highlightsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Générer
                    </Button>
                  </div>
                  {currentPlatformContent.highlights.length > 0 && (
                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                      <div className="text-xs uppercase tracking-wide text-emerald-700">Version actuellement retenue</div>
                      <p className="mt-1 text-sm text-emerald-900">
                        Les arguments déjà mémorisés pour {PLATFORMS.find((entry) => entry.value === platform)?.label}.
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {currentPlatformContent.highlights.slice(0, 6).map((highlight) => (
                          <div key={highlight} className="rounded-lg bg-white/85 px-3 py-2 text-sm text-foreground">
                            {highlight}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <textarea
                    value={highlightsText}
                    onChange={(event) => setHighlightsText(event.target.value)}
                    rows={6}
                    placeholder={platform === "gmc"
                      ? "Ex: Bol inox 3 L\nEx: 10 programmes automatiques\nEx: Cuisson vapeur et mijotage"
                      : "Ex: Matériaux durables\nEx: Format compact\nEx: Usage quotidien"}
                    className="min-h-[188px] w-full rounded-md border border-input px-3 py-2 text-sm leading-6"
                  />
                </section>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Mise en situation générée et réutilisable sur la fiche. Pour l&apos;instant, le visuel reste partagé entre les destinations.
                  </p>
                  <Button type="button" size="sm" onClick={() => void generateImage()} disabled={!canUseAddonIA || imageLoading} className="shrink-0">
                    {imageLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                    Générer
                  </Button>
                </div>

                <div className="rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
                    Recommandation FeedPlug
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Type détecté : <span className="font-medium">{getProfileLabel(productProfile)}</span> ·
                    rendu recommandé : <span className="font-medium">{IMAGE_RENDER_MODES.find((mode) => mode.value === recommendedRenderMode)?.label}</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Mode de rendu</label>
                    <select
                      value={renderMode}
                      onChange={(event) => setRenderMode(event.target.value as ImageRenderMode)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {IMAGE_RENDER_MODES.map((mode) => (
                        <option key={mode.value} value={mode.value}>{mode.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Décor / preset</label>
                    <select
                      value={lifestylePreset}
                      onChange={(event) => setLifestylePreset(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {availablePresets.map((preset) => (
                        <option key={preset.value} value={preset.value}>{preset.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {IMAGE_RENDER_MODES.find((mode) => mode.value === renderMode)?.hint ||
                    IMAGE_RENDER_MODES.find((mode) => mode.value === recommendedRenderMode)?.hint}
                </p>

                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  {imageUrl ? (
                    <div className="space-y-3">
                      <img src={imageUrl} alt="Aperçu optimisation image" className="h-[320px] w-full rounded-xl border border-border bg-white object-cover" />
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs text-muted-foreground">
                        <span className="truncate">Visuel prêt à appliquer sur la fiche produit.</span>
                        <Button type="button" variant="outline" size="sm" onClick={() => void copyImageUrl()}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copier l&apos;URL
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 text-center text-sm text-muted-foreground">
                      <ImagePlus className="mb-3 h-8 w-8 text-muted-foreground/70" />
                      <p className="font-medium text-foreground">Aucun visuel IA généré pour le moment</p>
                      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                        Génère une image de mise en situation à partir du visuel produit ou ajoute une image de référence.
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedImage((value) => !value)}
                    aria-expanded={showAdvancedImage}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground"
                  >
                    Options avancées
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showAdvancedImage ? "rotate-180" : ""}`} />
                  </button>
                  {showAdvancedImage && (
                    <div className="space-y-4 border-t border-border px-4 py-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Mannequin</label>
                        <select
                          value={mannequinProfile}
                          onChange={(event) => setMannequinProfile(event.target.value as MannequinProfile)}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {MANNEQUIN_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                          Ajoute un mannequin quand tu veux montrer le porté, la coupe ou l&apos;échelle du produit.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Lieu ou scène spécifique</label>
                        <textarea
                          value={customSceneInput}
                          onChange={(event) => setCustomSceneInput(event.target.value)}
                          rows={3}
                          placeholder="Ex: dans un manège équestre couvert, au bord d'un green de golf, dans une rue élégante, dans une sellerie premium, sur un terrain de concours..."
                          className="w-full rounded-md border border-input px-3 py-2 text-sm leading-6"
                        />
                        <p className="text-xs text-muted-foreground">
                          Champ libre pour ajouter ton contexte métier. Il affine le preset au lieu de te limiter à une liste fermée.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Modèle de génération</label>
                        <select
                          value={lifestyleModel}
                          onChange={(event) => setLifestyleModel(event.target.value)}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {LIFESTYLE_MODELS.map((model) => (
                            <option key={model.id} value={model.id}>{model.label}</option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                          Les scènes proposées sont filtrées pour éviter les rendus incohérents pour ce type de produit.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Image de référence</label>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-foreground/40">
                            <ImagePlus className="h-4 w-4" />
                            Envoyer une image
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () => {
                                  const result = String(reader.result || "");
                                  const match = result.match(/^data:([^;]+);base64,(.+)$/);
                                  if (!match) return;
                                  setUploadedBase64(match[2]);
                                  setUploadedMimeType(match[1] || "image/jpeg");
                                };
                                reader.readAsDataURL(file);
                                event.target.value = "";
                              }}
                            />
                          </label>
                          <div
                            ref={pasteZoneRef}
                            tabIndex={0}
                            role="button"
                            onPaste={handleLifestylePaste}
                            onClick={() => pasteZoneRef.current?.focus()}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-foreground/40"
                          >
                            <ImagePlus className="h-4 w-4" />
                            Coller une image
                          </div>
                          {uploadedBase64 && (
                            <span className="text-xs font-medium text-emerald-600">Image de référence ajoutée</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
            <p className="text-sm text-muted-foreground">
              {selectedDestination
                ? "La sauvegarde conserve une version dédiée pour cette destination. La fiche source n'est pas réécrite."
                : "La sauvegarde met à jour la fiche produit et conserve la version optimisée par plateforme."}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={handleRequestClose} disabled={saving}>
                Annuler
              </Button>
              <Button type="button" onClick={() => void handleApply()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Appliquer
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}
