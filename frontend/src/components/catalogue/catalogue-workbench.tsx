/* eslint-disable @next/next/no-img-element */
"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Filter,
  Loader2,
  Package,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Table2,
  Target,
  TriangleAlert,
  Wand2,
  X,
} from "lucide-react";
import { getLocalePrefixFromPathname } from "@/lib/locale-navigation";
import { apiClient } from "@/lib/api";
import {
  EmptyState,
  PageButtonPrimary,
  PageButtonSecondary,
  PageCard,
  PageError,
  PageHeader,
  PageLayout,
  PageLoading,
} from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAvailableFields, getFieldLabel } from "@/lib/catalogue-field-labels";
import { cn } from "@/lib/utils";
import { getIngestionEmptyFileMessage, getIngestionSyncToastMessage } from "@/lib/ingestion-sync-message";
import { formatLocaleLabel, getPlatformLabel } from "@/lib/markets";
import { getMarkets, type Market } from "@/lib/services/markets.service";
import {
  getOptimizedPlatformContent as getStoredOptimizedPlatformContent,
  hasStoredOptimizedContent as hasStoredOptimizedPlatformContent,
  parseProductCustomFields,
} from "@/lib/optimized-product-content";

interface FeedItem {
  id: string;
  title: string;
  sku: string | null;
  mpn?: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  inventory: number | null;
  url: string | null;
  imageUrl: string | null;
  descriptionText: string | null;
  createdAt: string;
  updatedAt: string;
  customfields?: Record<string, unknown> | string | null;
  feed: {
    id: string;
    name: string;
    source: {
      id: string;
      name: string;
      connector: string;
    };
  };
  _selectedDestinationId?: string | null;
  _selectedDestinationLabel?: string | null;
  _selectedDestinationPlatformKey?: string | null;
  _selectedDestinationPlatformLabel?: string | null;
  _selectedDestinationMarketCode?: string | null;
  _selectedDestinationLocaleCode?: string | null;
  _selectedDestinationIsEnabled?: boolean;
  _selectedDestinationActivationSource?: string | null;
  _selectedDestinationActivationStatus?: string | null;
  _selectedDestinationHasOptimizedContent?: boolean;
  _selectedDestinationCategory?: string | null;
}

interface FeedOption {
  id: string;
  name: string;
  source?: { id: string; name: string; connector: string };
}

interface CatalogueDestinationOption {
  id: string;
  label: string;
  platformKey: BulkPlatform;
  marketCode: string;
  localeCode: string | null;
}

interface CatalogueDestinationContext {
  id: string;
  label: string;
  platformKey: string;
  platformLabel: string;
  marketCode: string;
  localeCode: string | null;
}

type SortOption = "date_desc" | "date_asc" | "title_asc" | "title_desc" | "price_asc" | "price_desc";
type FilterImage = "all" | "with" | "without";
type FilterOptimized = "all" | "optimized" | "not_optimized";
type FilterChannel = "all" | "google_on" | "google_off";
type FilterStock = "all" | "in_stock" | "out_of_stock";
type BulkPlatform = "gmc" | "meta" | "amazon" | "chatgpt";
type SmartViewKey = "all" | "to_fix" | "to_optimize" | "ready_google" | "google_off" | "missing_category" | "missing_brand" | "missing_image";
type BulkEditField = "brand" | "google_product_category" | "product_type" | "availability" | "optimized_title" | "optimized_description" | "optimized_highlights";
type BulkApplyMode = "replace_all" | "only_empty";
type ColumnKey = "product" | "status" | "brand" | "category" | "price" | "stock" | "channels" | "updated" | "actions";

interface BulkGridDraft {
  id: string;
  title: string;
  brand: string;
  google_product_category: string;
  product_type: string;
  availability: string;
  optimized_title: string;
  optimized_description: string;
  optimized_highlights: string;
  googleEnabled: boolean;
}

interface BulkGridSnapshot {
  drafts: Record<string, BulkGridDraft>;
  attributes: Record<string, Record<string, string>>;
}

interface GridCellPosition {
  itemId: string;
  field: string;
}

interface DragFillState {
  originItemId: string;
  field: string;
  targetItemId: string;
}

const FIXED_GRID_FIELDS = new Set([
  "title",
  "brand",
  "google_product_category",
  "product_type",
  "availability",
]);

const CORE_GRID_FIELDS = new Set([
  "id",
  "title",
  "brand",
  "google_product_category",
  "product_type",
  "availability",
  "optimized_title",
  "optimized_description",
  "optimized_highlights",
  "googleEnabled",
]);

const ROOT_EDITABLE_FIELDS = new Set(["gtin", "mpn", "condition", "sku", "price", "currency", "inventory", "url"]);

const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = ["product", "status", "brand", "category", "price", "stock", "channels", "updated", "actions"];
const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  product: 380,
  status: 200,
  brand: 180,
  category: 240,
  price: 120,
  stock: 110,
  channels: 150,
  updated: 140,
  actions: 160,
};

const CATALOGUE_CONTEXT_KEY = "feedplug_catalogue_context";
const CATALOGUE_SCROLL_KEY = "feedplug_catalogue_scroll";
const CATALOGUE_VIEW_PREFS_KEY = "feedplug_catalogue_view_prefs_v1";
const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 50;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: string;
      response?: { data?: { message?: string } };
    };
    return candidate.response?.data?.message || candidate.message || fallback;
  }
  return fallback;
}

function parseCustomFields(value: FeedItem["customfields"]): Record<string, unknown> {
  return parseProductCustomFields(value);
}

function hasOptimizedContent(item: FeedItem): boolean {
  if (item._selectedDestinationId && item._selectedDestinationPlatformKey) {
    const selectedPlatform = item._selectedDestinationPlatformKey as BulkPlatform;
    if (typeof item._selectedDestinationHasOptimizedContent === "boolean") {
      return item._selectedDestinationHasOptimizedContent;
    }
    return hasStoredOptimizedPlatformContent(item.customfields, selectedPlatform, {
      destinationId: item._selectedDestinationId,
      allowPlatformFallback: false,
    });
  }
  const customfields = parseCustomFields(item.customfields);
  if (typeof customfields.optimized_title === "string" && customfields.optimized_title.trim()) return true;
  if (typeof customfields.optimized_description === "string" && customfields.optimized_description.trim()) return true;
  const optimized = customfields.optimized;
  if (!optimized || typeof optimized !== "object") return false;
  return ["gmc", "meta", "amazon", "chatgpt"].some((platform) => {
    const platformContent = (optimized as Record<string, unknown>)[platform];
    if (!platformContent || typeof platformContent !== "object") return false;
    const content = platformContent as Record<string, unknown>;
    if (typeof content.title === "string" && content.title.trim()) return true;
    if (typeof content.description === "string" && content.description.trim()) return true;
    return Array.isArray(content.highlights) && content.highlights.some((entry) => typeof entry === "string" && entry.trim());
  });
}

function isGoogleEnabled(item: FeedItem): boolean {
  if (typeof item._selectedDestinationIsEnabled === "boolean") {
    return item._selectedDestinationIsEnabled;
  }
  const customfields = parseCustomFields(item.customfields);
  const overrides = customfields._channelOverrides;
  if (!overrides || typeof overrides !== "object") return true;
  return (overrides as Record<string, unknown>).google !== false;
}

function getItemCategory(item: FeedItem): string {
  if (typeof item._selectedDestinationCategory === "string" && item._selectedDestinationCategory.trim()) {
    return item._selectedDestinationCategory.trim();
  }
  const customfields = parseCustomFields(item.customfields);
  const raw = customfields.product_type ?? customfields.google_product_category ?? customfields.category;
  return typeof raw === "string" ? raw.trim() : "";
}

function getItemSourceLabel(item: FeedItem): string {
  return item.feed?.source?.name || item.feed?.name || "";
}

function getItemAvailability(item: FeedItem): string {
  const customfields = parseCustomFields(item.customfields);
  const raw = customfields.availability;
  return typeof raw === "string" ? raw.trim() : "";
}

function getOptimizedPlatformContent(item: FeedItem, platform: BulkPlatform): {
  title: string;
  description: string;
  highlights: string[];
} {
  const destinationId = item._selectedDestinationId;
  const content = getStoredOptimizedPlatformContent(item.customfields, platform, destinationId ? {
    destinationId,
    allowPlatformFallback: false,
  } : undefined);
  return {
    title: typeof content.title === "string" ? content.title : "",
    description: typeof content.description === "string" ? content.description : "",
    highlights: Array.isArray(content.highlights) ? content.highlights : [],
  };
}

function buildCatalogueDestinationOptions(markets: Market[], locale: string): CatalogueDestinationOption[] {
  return markets.flatMap((market) => {
    const localeById = new Map(market.locales.map((entry) => [entry.id, entry.localeCode]));
    return market.channels
      .filter((channel) => channel.isEnabled)
      .flatMap((channel) =>
        channel.destinations
          .filter((destination) => ["gmc", "meta", "amazon", "chatgpt"].includes(destination.platformKey))
          .map((destination) => {
            const localeCode = destination.marketLocaleId ? localeById.get(destination.marketLocaleId) ?? null : null;
            const localeSuffix = localeCode ? ` · ${formatLocaleLabel(locale, localeCode)}` : "";
            return {
              id: destination.id,
              label: `${getPlatformLabel(destination.platformKey)} · ${market.name}${localeSuffix}`,
              platformKey: destination.platformKey as BulkPlatform,
              marketCode: market.code,
              localeCode,
            };
          })
      );
  });
}

function hasCoreMerchantData(item: FeedItem): boolean {
  return Boolean(item.title?.trim() && item.imageUrl && item.brand?.trim() && getItemCategory(item));
}

function createBulkGridDraft(item: FeedItem, platform: BulkPlatform): BulkGridDraft {
  const optimized = getOptimizedPlatformContent(item, platform);
  const customfields = parseCustomFields(item.customfields);
  const productType = typeof customfields.product_type === "string" ? customfields.product_type : "";
  return {
    id: item.id,
    title: item.title || "",
    brand: item.brand || "",
    google_product_category: getItemCategory(item),
    product_type: productType,
    availability: getItemAvailability(item),
    optimized_title: optimized.title,
    optimized_description: optimized.description,
    optimized_highlights: optimized.highlights.join("\n"),
    googleEnabled: isGoogleEnabled(item),
  };
}

function getAttributeValue(item: FeedItem, key: string): string {
  const record = item as unknown as Record<string, unknown>;
  const direct = record[key];
  if (typeof direct === "string" || typeof direct === "number") return String(direct);
  const customfields = parseCustomFields(item.customfields);
  const customValue = customfields[key];
  if (typeof customValue === "string" || typeof customValue === "number") return String(customValue);
  if (typeof customValue === "boolean") return customValue ? "true" : "false";
  return "";
}

function getSearchSuggestions(items: FeedItem[], query: string, searchFocused: boolean): string[] {
  if (!searchFocused || query.length < 2 || items.length === 0) return [];
  const lower = query.toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (out.length >= 6) break;
    const brand = item.brand?.trim();
    if (brand && brand.toLowerCase().includes(lower) && !seen.has(brand)) {
      seen.add(brand);
      out.push(brand);
    }
    const title = (item.title || "").trim();
    if (title && title.toLowerCase().includes(lower) && !seen.has(title) && title.length < 56) {
      seen.add(title);
      out.push(title.length > 52 ? `${title.slice(0, 52)}...` : title);
    }
  }
  return out;
}

interface BulkGridRowProps {
  item: FeedItem;
  productHref: string;
  draft: BulkGridDraft;
  dirtyFields: Record<keyof BulkGridDraft, boolean>;
  attributeColumns: string[];
  attributeValues: Record<string, string>;
  attributeDirty: Record<string, boolean>;
  onDraftChange: (itemId: string, field: keyof BulkGridDraft, value: string | boolean) => void;
  onAttributeChange: (itemId: string, field: string, value: string) => void;
  isCellSelected: (itemId: string, field: string) => boolean;
  isActiveCell: (itemId: string, field: string) => boolean;
  onCellActivate: (itemId: string, field: string, extendSelection: boolean) => void;
  onCellKeyDown: (
    itemId: string,
    field: string,
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => void;
  onCellHover: (itemId: string, field: string) => void;
  onCellPaste: (
    itemId: string,
    field: string,
    event: ReactClipboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  registerCellRef: (itemId: string, field: string, element: HTMLElement | null) => void;
  onPrepareProductNavigation: () => void;
  onFillDown: (itemId: string, field: string) => void;
  isDragFillPreviewCell: (itemId: string, field: string) => boolean;
  onFillHandleMouseDown: (itemId: string, field: string) => void;
  hasActiveSelectionOnRow: boolean;
}

const BulkGridRow = memo(function BulkGridRow({
  item,
  productHref,
  draft,
  dirtyFields,
  attributeColumns,
  attributeValues,
  attributeDirty,
  onDraftChange,
  onAttributeChange,
  isCellSelected,
  isActiveCell,
  onCellActivate,
  onCellKeyDown,
  onCellHover,
  onCellPaste,
  registerCellRef,
  onPrepareProductNavigation,
  onFillDown,
  isDragFillPreviewCell,
  onFillHandleMouseDown,
  hasActiveSelectionOnRow,
}: BulkGridRowProps) {
  return (
    <tr className="border-b border-border/70 align-top">
      <td className={cn("sticky left-0 z-10 border-r border-border bg-background px-3 py-3", hasActiveSelectionOnRow && "bg-sky-50/60")}>
        <div className="flex w-[220px] items-start gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.title || ""} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <a
              href={productHref}
              onClick={onPrepareProductNavigation}
              className="block max-w-[170px] truncate text-left text-sm font-semibold text-foreground hover:underline"
            >
              {item.title || "Sans titre"}
            </a>
            <div className="mt-1 truncate text-xs text-muted-foreground">{item.sku || item.id}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="relative" onMouseEnter={() => onCellHover(item.id, "title")}>
          <Input ref={(node) => registerCellRef(item.id, "title", node)} value={draft.title} onChange={(event) => onDraftChange(item.id, "title", event.target.value)} onFocus={() => onCellActivate(item.id, "title", false)} onMouseDown={(event) => onCellActivate(item.id, "title", event.shiftKey)} onMouseEnter={() => onCellHover(item.id, "title")} onKeyDown={(event) => onCellKeyDown(item.id, "title", event)} onPaste={(event) => onCellPaste(item.id, "title", event)} className={cn("h-9 min-w-[220px] text-sm transition-colors", dirtyFields.title && "border-amber-400 bg-amber-50", isCellSelected(item.id, "title") && "border-sky-400 bg-sky-100 ring-2 ring-sky-300 ring-offset-0", isActiveCell(item.id, "title") && "border-sky-600 bg-white ring-2 ring-sky-500 ring-offset-0", isDragFillPreviewCell(item.id, "title") && "bg-sky-200/70")} />
          {isActiveCell(item.id, "title") && (
            <button type="button" className="absolute bottom-1 right-1 h-3 w-3 cursor-ns-resize rounded-sm bg-sky-600" onMouseDown={(event) => { event.preventDefault(); onFillHandleMouseDown(item.id, "title"); }} onDoubleClick={() => onFillDown(item.id, "title")} aria-label="Recopier vers le bas" />
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="relative" onMouseEnter={() => onCellHover(item.id, "brand")}>
          <Input ref={(node) => registerCellRef(item.id, "brand", node)} value={draft.brand} onChange={(event) => onDraftChange(item.id, "brand", event.target.value)} onFocus={() => onCellActivate(item.id, "brand", false)} onMouseDown={(event) => onCellActivate(item.id, "brand", event.shiftKey)} onMouseEnter={() => onCellHover(item.id, "brand")} onKeyDown={(event) => onCellKeyDown(item.id, "brand", event)} onPaste={(event) => onCellPaste(item.id, "brand", event)} className={cn("h-9 min-w-[150px] text-sm transition-colors", dirtyFields.brand && "border-amber-400 bg-amber-50", isCellSelected(item.id, "brand") && "border-sky-400 bg-sky-100 ring-2 ring-sky-300 ring-offset-0", isActiveCell(item.id, "brand") && "border-sky-600 bg-white ring-2 ring-sky-500 ring-offset-0", isDragFillPreviewCell(item.id, "brand") && "bg-sky-200/70")} />
          {isActiveCell(item.id, "brand") && (
            <button type="button" className="absolute bottom-1 right-1 h-3 w-3 cursor-ns-resize rounded-sm bg-sky-600" onMouseDown={(event) => { event.preventDefault(); onFillHandleMouseDown(item.id, "brand"); }} onDoubleClick={() => onFillDown(item.id, "brand")} aria-label="Recopier vers le bas" />
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="relative" onMouseEnter={() => onCellHover(item.id, "google_product_category")}>
          <Input ref={(node) => registerCellRef(item.id, "google_product_category", node)} value={draft.google_product_category} onChange={(event) => onDraftChange(item.id, "google_product_category", event.target.value)} onFocus={() => onCellActivate(item.id, "google_product_category", false)} onMouseDown={(event) => onCellActivate(item.id, "google_product_category", event.shiftKey)} onMouseEnter={() => onCellHover(item.id, "google_product_category")} onKeyDown={(event) => onCellKeyDown(item.id, "google_product_category", event)} onPaste={(event) => onCellPaste(item.id, "google_product_category", event)} className={cn("h-9 min-w-[220px] text-sm transition-colors", dirtyFields.google_product_category && "border-amber-400 bg-amber-50", isCellSelected(item.id, "google_product_category") && "border-sky-400 bg-sky-100 ring-2 ring-sky-300 ring-offset-0", isActiveCell(item.id, "google_product_category") && "border-sky-600 bg-white ring-2 ring-sky-500 ring-offset-0", isDragFillPreviewCell(item.id, "google_product_category") && "bg-sky-200/70")} />
          {isActiveCell(item.id, "google_product_category") && (
            <button type="button" className="absolute bottom-1 right-1 h-3 w-3 cursor-ns-resize rounded-sm bg-sky-600" onMouseDown={(event) => { event.preventDefault(); onFillHandleMouseDown(item.id, "google_product_category"); }} onDoubleClick={() => onFillDown(item.id, "google_product_category")} aria-label="Recopier vers le bas" />
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <Input ref={(node) => registerCellRef(item.id, "product_type", node)} value={draft.product_type} onChange={(event) => onDraftChange(item.id, "product_type", event.target.value)} onFocus={() => onCellActivate(item.id, "product_type", false)} onMouseDown={(event) => onCellActivate(item.id, "product_type", event.shiftKey)} onKeyDown={(event) => onCellKeyDown(item.id, "product_type", event)} onPaste={(event) => onCellPaste(item.id, "product_type", event)} className={cn("h-9 min-w-[180px] text-sm transition-colors", dirtyFields.product_type && "border-amber-400 bg-amber-50", isCellSelected(item.id, "product_type") && "border-sky-400 bg-sky-100 ring-2 ring-sky-300 ring-offset-0", isActiveCell(item.id, "product_type") && "border-sky-600 bg-white ring-2 ring-sky-500 ring-offset-0")} />
      </td>
      <td className="px-3 py-3">
        <Select ref={(node) => registerCellRef(item.id, "availability", node)} value={draft.availability || "in stock"} onChange={(event) => onDraftChange(item.id, "availability", event.target.value)} onFocus={() => onCellActivate(item.id, "availability", false)} onMouseDown={(event) => onCellActivate(item.id, "availability", event.shiftKey)} onKeyDown={(event) => onCellKeyDown(item.id, "availability", event)} className={cn("h-9 min-w-[140px] text-sm transition-colors", dirtyFields.availability && "border-amber-400 bg-amber-50", isCellSelected(item.id, "availability") && "border-sky-400 bg-sky-100 ring-2 ring-sky-300 ring-offset-0", isActiveCell(item.id, "availability") && "border-sky-600 bg-white ring-2 ring-sky-500 ring-offset-0")}>
          <option value="in stock">in stock</option>
          <option value="out of stock">out of stock</option>
          <option value="preorder">preorder</option>
          <option value="backorder">backorder</option>
        </Select>
      </td>
      <td className="px-3 py-3">
        <Textarea ref={(node) => registerCellRef(item.id, "optimized_title", node)} value={draft.optimized_title} onChange={(event) => onDraftChange(item.id, "optimized_title", event.target.value)} onFocus={() => onCellActivate(item.id, "optimized_title", false)} onMouseDown={(event) => onCellActivate(item.id, "optimized_title", event.shiftKey)} onKeyDown={(event) => onCellKeyDown(item.id, "optimized_title", event)} onPaste={(event) => onCellPaste(item.id, "optimized_title", event)} className={cn("min-h-[84px] min-w-[220px] rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors", dirtyFields.optimized_title && "border-amber-400 bg-amber-50", isCellSelected(item.id, "optimized_title") && "border-sky-400 bg-sky-100 ring-2 ring-sky-300 ring-offset-0", isActiveCell(item.id, "optimized_title") && "border-sky-600 bg-white ring-2 ring-sky-500 ring-offset-0")} />
      </td>
      <td className="px-3 py-3">
        <Textarea ref={(node) => registerCellRef(item.id, "optimized_description", node)} value={draft.optimized_description} onChange={(event) => onDraftChange(item.id, "optimized_description", event.target.value)} onFocus={() => onCellActivate(item.id, "optimized_description", false)} onMouseDown={(event) => onCellActivate(item.id, "optimized_description", event.shiftKey)} onKeyDown={(event) => onCellKeyDown(item.id, "optimized_description", event)} onPaste={(event) => onCellPaste(item.id, "optimized_description", event)} className={cn("min-h-[84px] min-w-[260px] rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors", dirtyFields.optimized_description && "border-amber-400 bg-amber-50", isCellSelected(item.id, "optimized_description") && "border-sky-400 bg-sky-100 ring-2 ring-sky-300 ring-offset-0", isActiveCell(item.id, "optimized_description") && "border-sky-600 bg-white ring-2 ring-sky-500 ring-offset-0")} />
      </td>
      <td className="px-3 py-3">
        <Textarea ref={(node) => registerCellRef(item.id, "optimized_highlights", node)} value={draft.optimized_highlights} onChange={(event) => onDraftChange(item.id, "optimized_highlights", event.target.value)} onFocus={() => onCellActivate(item.id, "optimized_highlights", false)} onMouseDown={(event) => onCellActivate(item.id, "optimized_highlights", event.shiftKey)} onKeyDown={(event) => onCellKeyDown(item.id, "optimized_highlights", event)} onPaste={(event) => onCellPaste(item.id, "optimized_highlights", event)} className={cn("min-h-[84px] min-w-[220px] rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors", dirtyFields.optimized_highlights && "border-amber-400 bg-amber-50", isCellSelected(item.id, "optimized_highlights") && "border-sky-400 bg-sky-100 ring-2 ring-sky-300 ring-offset-0", isActiveCell(item.id, "optimized_highlights") && "border-sky-600 bg-white ring-2 ring-sky-500 ring-offset-0")} />
      </td>
      {attributeColumns.map((field) => (
        <td key={field} className="px-3 py-3">
        <Input
            ref={(node) => registerCellRef(item.id, field, node)}
            value={attributeValues[field] ?? ""}
            onChange={(event) => onAttributeChange(item.id, field, event.target.value)}
            onFocus={() => onCellActivate(item.id, field, false)}
            onMouseDown={(event) => onCellActivate(item.id, field, event.shiftKey)}
            onKeyDown={(event) => onCellKeyDown(item.id, field, event)}
            onPaste={(event) => onCellPaste(item.id, field, event)}
            className={cn("h-9 min-w-[180px] text-sm transition-colors", attributeDirty[field] && "border-blue-400 bg-blue-50", isCellSelected(item.id, field) && "border-sky-400 bg-sky-100 ring-2 ring-sky-300 ring-offset-0", isActiveCell(item.id, field) && "border-sky-600 bg-white ring-2 ring-sky-500 ring-offset-0")}
          />
        </td>
      ))}
      <td className="px-3 py-3">
        <label className={cn("flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors", dirtyFields.googleEnabled && "bg-amber-50", isCellSelected(item.id, "googleEnabled") && "border border-sky-400 bg-sky-100 ring-2 ring-sky-300 ring-offset-0", isActiveCell(item.id, "googleEnabled") && "border border-sky-600 bg-white ring-2 ring-sky-500 ring-offset-0")}>
          <input ref={(node) => registerCellRef(item.id, "googleEnabled", node)} type="checkbox" className="rounded" checked={draft.googleEnabled} onFocus={() => onCellActivate(item.id, "googleEnabled", false)} onMouseDown={(event) => onCellActivate(item.id, "googleEnabled", event.shiftKey)} onChange={(event) => onDraftChange(item.id, "googleEnabled", event.target.checked)} onKeyDown={(event) => onCellKeyDown(item.id, "googleEnabled", event as ReactKeyboardEvent<HTMLInputElement>)} />
          Actif
        </label>
      </td>
    </tr>
  );
});

export function CatalogueWorkbench() {
  const pathname = usePathname();
  const locale = useLocale();
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const columnsPanelRef = useRef<HTMLDivElement>(null);
  const gridColumnsPanelRef = useRef<HTMLDivElement>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const gridCellRefs = useRef<Record<string, HTMLElement | null>>({});
  const columnResizeState = useRef<{ column: ColumnKey; startX: number; startWidth: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRestored = useRef(false);
  const lastFeedsFetchAtRef = useRef(0);
  const localePrefix = useMemo(() => getLocalePrefixFromPathname(pathname), [pathname]);

  const [feedsList, setFeedsList] = useState<FeedOption[]>([]);
  const [destinationOptions, setDestinationOptions] = useState<CatalogueDestinationOption[]>([]);
  const [catalogueMarkets, setCatalogueMarkets] = useState<Market[]>([]);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [locationSearch, setLocationSearch] = useState(() => (typeof window !== "undefined" ? window.location.search : ""));
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingScore, setLoadingScore] = useState(true);
  const [, setLoadingStats] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const [totalCount, setTotalCount] = useState(0);
  const [hasMoreItems, setHasMoreItems] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("feed");
  });
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>("all");
  const [selectedDestinationContext, setSelectedDestinationContext] = useState<CatalogueDestinationContext | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);
  const [showGridColumnsPanel, setShowGridColumnsPanel] = useState(false);
  const [openColumnMenu, setOpenColumnMenu] = useState<ColumnKey | null>(null);

  const [filterImage, setFilterImage] = useState<FilterImage>("all");
  const [filterOptimized, setFilterOptimized] = useState<FilterOptimized>("all");
  const [filterChannel, setFilterChannel] = useState<FilterChannel>("all");
  const [filterStock, setFilterStock] = useState<FilterStock>("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterUpdatedRecent, setFilterUpdatedRecent] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState<{
    totalItems: number;
    enriched: number;
    fieldsEnriched: number;
    alertsCount: number;
  } | null>(null);
  const [enrichmentFeedback, setEnrichmentFeedback] = useState<{
    type: "success" | "error" | "info";
    title: string;
    description: string;
  } | null>(null);

  const [showBulkAiModal, setShowBulkAiModal] = useState(false);
  const [bulkAiPlatform, setBulkAiPlatform] = useState<BulkPlatform>("gmc");
  const [bulkOptimizeTitles, setBulkOptimizeTitles] = useState(true);
  const [bulkOptimizeDescriptions, setBulkOptimizeDescriptions] = useState(true);
  const [bulkOptimizeHighlights, setBulkOptimizeHighlights] = useState(false);
  const [bulkMarketCode, setBulkMarketCode] = useState<string>("");
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<BulkEditField>("google_product_category");
  const [bulkApplyMode, setBulkApplyMode] = useState<BulkApplyMode>("only_empty");
  const [bulkEditValue, setBulkEditValue] = useState("");
  const [showBulkGridModal, setShowBulkGridModal] = useState(false);
  const [bulkGridDrafts, setBulkGridDrafts] = useState<Record<string, BulkGridDraft>>({});
  const [bulkGridHistory, setBulkGridHistory] = useState<BulkGridSnapshot[]>([]);
  const [bulkGridAttributeDrafts, setBulkGridAttributeDrafts] = useState<Record<string, Record<string, string>>>({});
  const [gridAttributeColumns, setGridAttributeColumns] = useState<string[]>(["gtin", "mpn", "condition"]);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(DEFAULT_COLUMN_WIDTHS);
  const [gridCopyField, setGridCopyField] = useState<keyof BulkGridDraft>("google_product_category");
  const [activeGridCell, setActiveGridCell] = useState<GridCellPosition | null>(null);
  const [gridSelectionAnchor, setGridSelectionAnchor] = useState<GridCellPosition | null>(null);
  const [dragFillState, setDragFillState] = useState<DragFillState | null>(null);
  const [activeSmartView, setActiveSmartView] = useState<SmartViewKey>("all");
  const [bulkActionLoading, setBulkActionLoading] = useState<"ai" | "google_on" | "google_off" | "bulk_edit" | "grid_save" | null>(null);

  const [catalogueScore, setCatalogueScore] = useState<{
    globalScore: number;
    scoreBand?: {
      label: string;
      description: string;
    };
    auditPillars?: Array<{
      key: string;
      label: string;
      score: number;
      detail?: string;
    }>;
    topIssues?: Array<{
      key: string;
      label: string;
      count: number;
      recommendation: string;
      impact?: string;
      smartView?: SmartViewKey | null;
      priority?: "high" | "medium" | "low";
    }>;
    recommendations?: Array<{
      priority: "high" | "medium" | "low";
      category: string;
      message: string;
      impact?: string;
    }>;
    byDimension?: {
      compliance: { average: number; count: number };
      dataQuality: { average: number; count: number };
      seo: { average: number; count: number };
      conversion: { average: number; count: number };
    };
  } | null>(null);
  const [, setEnrichmentStats] = useState<{
    totals: {
      totalItems: number;
      enrichedItems: number;
      fieldsEnriched: number;
      alertsGenerated: number;
      aiEnrichments: number;
      rulesEnrichments: number;
    };
    completionRate: number;
    averages: {
      fieldsPerItem: number;
      aiUsageRate: number;
    };
  } | null>(null);
  const [catalogueSummary, setCatalogueSummary] = useState<{
    total: number;
    toFix: number;
    toOptimize: number;
    readyToPublish: number;
    notPublished: number;
    missingCategory: number;
    missingBrand: number;
    missingImage: number;
    withImage: number;
    published: number;
  } | null>(null);
  const [catalogueFilterOptions, setCatalogueFilterOptions] = useState<{
    brands: string[];
    categories: string[];
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  };

  const resetEnrichmentModalState = useCallback(() => {
    setEnrichmentResult(null);
    setEnrichmentFeedback(null);
    setUseAI(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncSearch = () => setLocationSearch(window.location.search);
    syncSearch();
    window.addEventListener("popstate", syncSearch);
    return () => window.removeEventListener("popstate", syncSearch);
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(locationSearch);
    const q = searchParams.get("q");
    const value = q != null && q !== "" ? q : "";
    setSearchQuery(value);
    setDebouncedSearchQuery(value);

    const feedId = searchParams.get("feed");
    if (feedId) {
      setSelectedFeedId((current) => (current === feedId ? current : feedId));
    }
  }, [locationSearch]);

  const replaceBrowserUrl = useCallback((nextUrl: string) => {
    if (typeof window === "undefined") return;
    const next = new URL(nextUrl, window.location.origin);
    const nextPathAndSearch = `${next.pathname}${next.search}`;
    const currentPathAndSearch = `${window.location.pathname}${window.location.search}`;
    if (currentPathAndSearch !== nextPathAndSearch) {
      window.history.replaceState(window.history.state, "", nextPathAndSearch);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, []);

  const hardNavigate = useCallback((nextUrl: string) => {
    if (typeof window === "undefined") return;
    window.location.assign(nextUrl);
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      const trimmed = searchQuery.trim();
      setDebouncedSearchQuery(trimmed);
      const url = trimmed ? `${localePrefix}/catalogue?q=${encodeURIComponent(trimmed)}` : `${localePrefix}/catalogue`;
      replaceBrowserUrl(url);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [localePrefix, replaceBrowserUrl, searchQuery]);

  useEffect(() => {
    if (scrollRestored.current) return;
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(CATALOGUE_SCROLL_KEY) : null;
    if (!saved) return;
    scrollRestored.current = true;
    sessionStorage.removeItem(CATALOGUE_SCROLL_KEY);
    const y = parseInt(saved, 10);
    if (!Number.isNaN(y)) requestAnimationFrame(() => window.scrollTo(0, y));
  }, [loading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CATALOGUE_VIEW_PREFS_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw) as {
        visibleColumns?: ColumnKey[];
        gridAttributeColumns?: string[];
        activeSmartView?: SmartViewKey;
        columnWidths?: Partial<Record<ColumnKey, number>>;
      };
      if (Array.isArray(prefs.visibleColumns) && prefs.visibleColumns.length > 0) {
        setVisibleColumns(prefs.visibleColumns.filter((value): value is ColumnKey => DEFAULT_VISIBLE_COLUMNS.includes(value as ColumnKey)));
      }
      if (Array.isArray(prefs.gridAttributeColumns)) {
        setGridAttributeColumns(prefs.gridAttributeColumns.filter((value) => typeof value === "string"));
      }
      if (prefs.activeSmartView) setActiveSmartView(prefs.activeSmartView);
      if (prefs.columnWidths && typeof prefs.columnWidths === "object") {
        setColumnWidths((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.entries(prefs.columnWidths || {}).filter(
              ([key, value]) => DEFAULT_VISIBLE_COLUMNS.includes(key as ColumnKey) && typeof value === "number" && Number.isFinite(value)
            )
          ) as Partial<Record<ColumnKey, number>>,
        }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      CATALOGUE_VIEW_PREFS_KEY,
      JSON.stringify({
        visibleColumns,
        gridAttributeColumns,
        activeSmartView,
        columnWidths,
      })
    );
  }, [activeSmartView, columnWidths, gridAttributeColumns, visibleColumns]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const resize = columnResizeState.current;
      if (!resize) return;
      const delta = event.clientX - resize.startX;
      setColumnWidths((current) => ({
        ...current,
        [resize.column]: Math.max(100, resize.startWidth + delta),
      }));
    };
    const handleUp = () => {
      columnResizeState.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  useEffect(() => {
    void fetchFeeds(true);
  }, []);

  useEffect(() => {
    void fetchMarketsForCatalogue();
  }, [locale]);

  useEffect(() => {
    const onFocus = () => {
      void fetchFeeds(false);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const feedIdFromUrl = useMemo(() => new URLSearchParams(locationSearch).get("feed"), [locationSearch]);
  useEffect(() => {
    if (!feedIdFromUrl || feedsList.length === 0) return;
    if (feedsList.some((feed) => feed.id === feedIdFromUrl)) setSelectedFeedId(feedIdFromUrl);
  }, [feedIdFromUrl, feedsList]);

  useEffect(() => {
    if (feedsList.length === 0) return;
    const inList = selectedFeedId && feedsList.some((feed) => feed.id === selectedFeedId);
    if (!inList) setSelectedFeedId(feedsList[0].id);
  }, [feedsList, selectedFeedId]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!selectedFeedId) {
      setCatalogueScore(null);
      setItems([]);
      setTotalCount(0);
      setHasMoreItems(false);
      setCatalogueSummary(null);
      setLoading(false);
      return;
    }
    void fetchCatalogueScore(selectedFeedId);
    void fetchItems(selectedFeedId, false, debouncedSearchQuery);
  }, [
    activeSmartView,
    debouncedSearchQuery,
    filterBrand,
    filterCategory,
    filterChannel,
    filterImage,
    filterOptimized,
    filterSource,
    filterStock,
    filterUpdatedRecent,
    selectedDestinationId,
    selectedFeedId,
    sortBy,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!selectedFeedId) {
      setEnrichmentStats(null);
      return;
    }
    void fetchEnrichmentStats(selectedFeedId);
  }, [selectedFeedId]);

  useEffect(() => {
    if (!showFilterPanel) return;
    const onDocClick = (event: MouseEvent) => {
      if (filterPanelRef.current?.contains(event.target as Node)) return;
      setShowFilterPanel(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [showFilterPanel]);

  useEffect(() => {
    if (!showColumnsPanel) return;
    const onDocClick = (event: MouseEvent) => {
      if (columnsPanelRef.current?.contains(event.target as Node)) return;
      setShowColumnsPanel(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [showColumnsPanel]);

  useEffect(() => {
    if (!showGridColumnsPanel) return;
    const onDocClick = (event: MouseEvent) => {
      if (gridColumnsPanelRef.current?.contains(event.target as Node)) return;
      setShowGridColumnsPanel(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [showGridColumnsPanel]);

  useEffect(() => {
    if (!openColumnMenu) return;
    const onDocClick = (event: MouseEvent) => {
      if (columnMenuRef.current?.contains(event.target as Node)) return;
      setOpenColumnMenu(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openColumnMenu]);

  const fetchFeeds = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFeedsFetchAtRef.current < 30_000) {
      return;
    }
    try {
      const response = await apiClient.get<FeedOption[]>("/ingestion/feeds");
      setFeedsList(response.data || []);
      setError(null);
      lastFeedsFetchAtRef.current = now;
    } catch (err: unknown) {
      setFeedsList([]);
      const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 0;
      if (status === 401 || status === 403) {
        setError(status === 401 ? "Session expirée. Déconnectez-vous puis reconnectez-vous." : "Accès refusé aux flux.");
      }
    }
  };

  const fetchMarketsForCatalogue = async () => {
    try {
      const markets = await getMarkets();
      const nextOptions = buildCatalogueDestinationOptions(markets, locale);
      setDestinationOptions(nextOptions);
      setCatalogueMarkets(markets);
      setSelectedDestinationId((current) => {
        if (current === "all") return current;
        return nextOptions.some((option) => option.id === current) ? current : "all";
      });
    } catch {
      setDestinationOptions([]);
      setCatalogueMarkets([]);
      setSelectedDestinationId("all");
    }
  };

  const fetchCatalogueScore = async (feedId?: string | null) => {
    try {
      setLoadingScore(true);
      const searchParams = new URLSearchParams();
      if (feedId) searchParams.set("feedId", feedId);
      const response = await apiClient.get<{
        globalScore: number;
        scoreBand?: {
          label: string;
          description: string;
        };
        auditPillars?: Array<{
          key: string;
          label: string;
          score: number;
          detail?: string;
        }>;
        topIssues?: Array<{
          key: string;
          label: string;
          count: number;
          recommendation: string;
          impact?: string;
          smartView?: SmartViewKey | null;
          priority?: "high" | "medium" | "low";
        }>;
        recommendations?: Array<{
          priority: "high" | "medium" | "low";
          category: string;
          message: string;
          impact?: string;
        }>;
        byDimension?: {
          compliance: { average: number; count: number };
          dataQuality: { average: number; count: number };
          seo: { average: number; count: number };
          conversion: { average: number; count: number };
        };
      }>(`/ingestion/catalogue/score${searchParams.toString() ? `?${searchParams.toString()}` : ""}`);
      setCatalogueScore(response.data);
    } catch {
      setCatalogueScore(null);
    } finally {
      setLoadingScore(false);
    }
  };

  const fetchEnrichmentStats = async (feedId: string) => {
    try {
      setLoadingStats(true);
      const response = await apiClient.get<{
        totals: {
          totalItems: number;
          enrichedItems: number;
          fieldsEnriched: number;
          alertsGenerated: number;
          aiEnrichments: number;
          rulesEnrichments: number;
        };
        completionRate: number;
        averages: {
          fieldsPerItem: number;
          aiUsageRate: number;
        };
      }>(`/ingestion/feeds/${feedId}/enrichment-stats?days=30`);
      setEnrichmentStats(response.data);
    } catch {
      setEnrichmentStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchItems = async (feedId: string, append: boolean, query?: string) => {
    try {
      if (!append) {
        setLoading(true);
        setItems([]);
        setError(null);
        setSelectedItemIds([]);
      } else {
        setLoadingMore(true);
      }

      const offset = append ? items.length : 0;
      const searchParams = new URLSearchParams();
      searchParams.set("limit", String(PAGE_SIZE));
      searchParams.set("offset", String(offset));
      if (selectedDestinationId !== "all") searchParams.set("destinationId", selectedDestinationId);
      if (query) searchParams.set("q", query);
      if (activeSmartView !== "all") searchParams.set("smartView", activeSmartView);
      if (filterImage !== "all") searchParams.set("imageFilter", filterImage);
      if (filterOptimized !== "all") searchParams.set("optimizedFilter", filterOptimized);
      if (filterChannel !== "all") searchParams.set("channelFilter", filterChannel);
      if (filterStock !== "all") searchParams.set("stockFilter", filterStock);
      if (filterBrand !== "all") searchParams.set("brandFilter", filterBrand);
      if (filterCategory !== "all") searchParams.set("categoryFilter", filterCategory);
      if (filterSource !== "all") searchParams.set("sourceFilter", filterSource);
      if (filterUpdatedRecent) searchParams.set("updatedRecent", "true");
      if (sortBy !== "date_desc") searchParams.set("sortBy", sortBy);
      const response = await apiClient.get<{
        items: unknown[];
        total: number;
        hasMore?: boolean;
        summary?: {
          total: number;
          toFix: number;
          toOptimize: number;
          readyToPublish: number;
          notPublished: number;
          missingCategory: number;
          missingBrand: number;
          missingImage: number;
          withImage: number;
          published: number;
        };
        filterOptions?: {
          brands?: string[];
          categories?: string[];
        };
        destination?: CatalogueDestinationContext | null;
      }>(`/ingestion/feeds/${feedId}/items?${searchParams.toString()}`);

      const data = response.data;
      const rawItems = data.items || [];
      const total = typeof data.total === "number" ? data.total : rawItems.length;
      const hasMore = data.hasMore ?? offset + rawItems.length < total;
      const feedOption = feedsList.find((feed) => feed.id === feedId);
      const feedInfo = {
        id: feedId,
        name: feedOption?.name || "Flux sans nom",
        source: feedOption?.source || { id: "", name: "Source inconnue", connector: "UNKNOWN" },
      };

      const normalized = (rawItems as Record<string, unknown>[]).map((row) => {
        const item = row as unknown as FeedItem & { imageurl?: string; updatedat?: string; createdat?: string };
        return {
          ...item,
          price: item.price != null ? Number(item.price) : null,
          inventory: item.inventory != null ? Number(item.inventory) : null,
          imageUrl: item.imageUrl || item.imageurl || null,
          updatedAt: (item.updatedAt ?? item.updatedat ?? "") as string,
          createdAt: (item.createdAt ?? item.createdat ?? "") as string,
          feed: feedInfo,
        } as FeedItem;
      });

      setItems((prev) => (append ? [...prev, ...normalized] : normalized));
      setTotalCount(total);
      setHasMoreItems(hasMore);
      if (!append) {
        setCatalogueSummary(data.summary ?? null);
        setCatalogueFilterOptions({
          brands: data.filterOptions?.brands ?? [],
          categories: data.filterOptions?.categories ?? [],
        });
        setSelectedDestinationContext(data.destination ?? null);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erreur lors du chargement des produits"));
      if (!append) setItems([]);
      if (!append) setSelectedDestinationContext(null);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSyncFromCatalogue = async () => {
    if (!selectedFeedId || syncing) return;
    try {
      setSyncing(true);
      setError(null);
      const response = await apiClient.post<{
        message?: string;
        totalFetched?: number;
        totalInserted?: number;
        totalUpdated?: number;
        totalSkipped?: number;
      }>(`/ingestion/feeds/${selectedFeedId}/runs`, {});
      const data = response.data ?? {};
      const totalFetched = data.totalFetched ?? 0;
      if (totalFetched > 0 || (data.totalSkipped ?? 0) > 0 || (data.totalInserted ?? 0) > 0 || (data.totalUpdated ?? 0) > 0) {
        const { message, type } = getIngestionSyncToastMessage(data, "catalogue");
        showToast(message, type);
      } else {
        showToast(getIngestionEmptyFileMessage(), "error");
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fetchItems(selectedFeedId, false, debouncedSearchQuery);
      await fetchFeeds(true);
      await fetchCatalogueScore(selectedFeedId);
      await fetchEnrichmentStats(selectedFeedId);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Erreur lors de la synchronisation");
      setError(message);
      showToast(message, "error");
    } finally {
      setSyncing(false);
    }
  };

  const recalculateAllScores = async () => {
    if (!confirm("Recalculer tous les scores ? Cela peut prendre quelques minutes.")) return;
    try {
      setLoadingScore(true);
      const response = await apiClient.post<{ recalculated: number; errors: number }>("/ingestion/recalculate-all-scores", { limit: 10000 });
      showToast(
        `Scores recalcules : ${response.data.recalculated} produits traites${response.data.errors > 0 ? `, ${response.data.errors} erreurs` : ""}`,
        response.data.errors > 0 ? "info" : "success"
      );
      await fetchCatalogueScore(selectedFeedId);
    } catch {
      showToast("Erreur lors du recalcul des scores", "error");
    } finally {
      setLoadingScore(false);
    }
  };

  const handleBulkEnrichment = async () => {
    if (!selectedFeedId) return;
    try {
      setEnriching(true);
      setEnrichmentResult(null);
      setEnrichmentFeedback(null);
      const response = await apiClient.post<{
        totalItems?: number;
        enriched: number;
        fieldsEnriched: number;
        alertsCount: number;
        message?: string;
        stats?: {
          totalItems?: number;
          enrichedItems?: number;
          fieldsEnriched?: number;
        };
      }>(`/ingestion/feeds/${selectedFeedId}/enrich-all-advanced`, {
        limit: 1000,
        useAI,
      });
      const totalItems = response.data.totalItems ?? response.data.stats?.totalItems ?? 0;
      const enriched = response.data.enriched ?? response.data.stats?.enrichedItems ?? 0;
      const fieldsEnriched = response.data.fieldsEnriched ?? response.data.stats?.fieldsEnriched ?? 0;
      const alertsCount = response.data.alertsCount ?? 0;

      setEnrichmentResult({
        totalItems,
        enriched,
        fieldsEnriched,
        alertsCount,
      });
      await fetchItems(selectedFeedId, false, debouncedSearchQuery);
      await fetchCatalogueScore(selectedFeedId);
      await fetchEnrichmentStats(selectedFeedId);

      if (enriched === 0 && fieldsEnriched === 0) {
        const message = response.data.message || "Aucun champ manquant n'a ete enrichi sur ce flux.";
        setEnrichmentFeedback({
          type: "info",
          title: "Enrichissement terminé",
          description: message,
        });
        showToast(message, "info");
      } else {
        const message = `Enrichissement termine. ${enriched} produits enrichis, ${fieldsEnriched} champs completes.`;
        setEnrichmentFeedback({
          type: "success",
          title: "Enrichissement terminé",
          description: message,
        });
        showToast(message, "success");
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Erreur inconnue");
      setEnrichmentFeedback({
        type: "error",
        title: "Echec de l'enrichissement",
        description: message,
      });
      showToast(`Erreur enrichissement : ${message}`, "error");
    } finally {
      setEnriching(false);
    }
  };

  const prepareProductNavigation = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(CATALOGUE_CONTEXT_KEY, JSON.stringify({ searchQuery }));
      sessionStorage.setItem(CATALOGUE_SCROLL_KEY, String(window.scrollY));
    }
  }, [searchQuery]);

  const goToProduct = useCallback((productId: string) => {
    prepareProductNavigation();
    hardNavigate(`${localePrefix}/catalogue/${productId}`);
  }, [hardNavigate, localePrefix, prepareProductNavigation]);

  const filteredItems = items;
  const selectedDestinationOption = useMemo(
    () => destinationOptions.find((option) => option.id === selectedDestinationId) ?? null,
    [destinationOptions, selectedDestinationId]
  );
  const activeDistributionLabel = selectedDestinationContext?.label || selectedDestinationOption?.label || null;

  useEffect(() => {
    if (selectedDestinationOption) {
      setBulkAiPlatform(selectedDestinationOption.platformKey);
    }
  }, [selectedDestinationOption]);

  // Marchés sélectionnables dans l'optimisation en masse : uniquement ceux qui
  // ont une destination activée pour la plateforme cible (la langue est alors
  // adaptée via le contexte de cette destination).
  const bulkMarketOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { marketCode: string; label: string; destinationId: string }[] = [];
    for (const option of destinationOptions) {
      if (option.platformKey !== bulkAiPlatform) continue;
      if (seen.has(option.marketCode)) continue;
      seen.add(option.marketCode);
      const market = catalogueMarkets.find((entry) => entry.code === option.marketCode);
      const localeSuffix = option.localeCode ? ` · ${formatLocaleLabel(locale, option.localeCode)}` : "";
      options.push({
        marketCode: option.marketCode,
        label: `${market?.name || option.marketCode}${localeSuffix}`,
        destinationId: option.id,
      });
    }
    return options;
  }, [destinationOptions, bulkAiPlatform, catalogueMarkets, locale]);

  // Si le marché choisi n'a pas de destination pour la nouvelle plateforme, on réinitialise.
  useEffect(() => {
    if (bulkMarketCode && !bulkMarketOptions.some((option) => option.marketCode === bulkMarketCode)) {
      setBulkMarketCode("");
    }
  }, [bulkMarketCode, bulkMarketOptions]);

  const searchSuggestions = useMemo(
    () => getSearchSuggestions(items, searchQuery, searchFocused),
    [items, searchFocused, searchQuery]
  );

  const visibleSelectedCount = selectedItemIds.filter((id) => filteredItems.some((item) => item.id === id)).length;
  const selectedItems = filteredItems.filter((item) => selectedItemIds.includes(item.id));
  const selectedItemsKey = useMemo(() => selectedItems.map((item) => item.id).join("|"), [selectedItems]);
  const gridAttributeColumnsKey = useMemo(() => gridAttributeColumns.join("|"), [gridAttributeColumns]);
  const selectedOptimizedCount = selectedItems.filter(hasOptimizedContent).length;
  const selectedGoogleOffCount = selectedItems.filter((item) => !isGoogleEnabled(item)).length;
  const visibleIds = filteredItems.map((item) => item.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedItemIds.includes(id));
  const bulkGridRows = selectedItems.map((item) => bulkGridDrafts[item.id] ?? createBulkGridDraft(item, bulkAiPlatform));
  const gridEditableFields = useMemo(
    () => [
      "title",
      "brand",
      "google_product_category",
      "product_type",
      "availability",
      "optimized_title",
      "optimized_description",
      "optimized_highlights",
      ...gridAttributeColumns,
      "googleEnabled",
    ],
    [gridAttributeColumns]
  );
  const attributeColumnOptions = useMemo(
    () =>
      getAvailableFields().filter((field) => !FIXED_GRID_FIELDS.has(field.key) && field.key !== "description" && field.key !== "id"),
    []
  );
  const getGridFieldLabel = useCallback((field: string) => {
    switch (field) {
      case "title":
        return "Titre publie";
      case "brand":
        return "Marque";
      case "google_product_category":
        return "Categorie Google";
      case "product_type":
        return "Type produit";
      case "availability":
        return "Disponibilite";
      case "optimized_title":
        return "Titre optimise";
      case "optimized_description":
        return "Description optimisee";
      case "optimized_highlights":
        return "Highlights";
      case "googleEnabled":
        return activeDistributionLabel ? "Diffusion" : "Google";
      default:
        return getFieldLabel(field);
    }
  }, [activeDistributionLabel]);
  const dirtyGridRowCount = selectedItems.filter((item) => {
    const draft = bulkGridDrafts[item.id];
    if (!draft) return false;
    const base = createBulkGridDraft(item, bulkAiPlatform);
    return Object.keys(base).some((key) => draft[key as keyof BulkGridDraft] !== base[key as keyof BulkGridDraft]);
  }).length;
  const gridChangeSummary = useMemo(() => {
    const summary = {
      title: 0,
      brand: 0,
      category: 0,
      productType: 0,
      availability: 0,
      optimizedTitle: 0,
      optimizedDescription: 0,
      highlights: 0,
      google: 0,
    };
    for (const item of selectedItems) {
      const draft = bulkGridDrafts[item.id];
      if (!draft) continue;
      const base = createBulkGridDraft(item, bulkAiPlatform);
      if (draft.title !== base.title) summary.title += 1;
      if (draft.brand !== base.brand) summary.brand += 1;
      if (draft.google_product_category !== base.google_product_category) summary.category += 1;
      if (draft.product_type !== base.product_type) summary.productType += 1;
      if (draft.availability !== base.availability) summary.availability += 1;
      if (draft.optimized_title !== base.optimized_title) summary.optimizedTitle += 1;
      if (draft.optimized_description !== base.optimized_description) summary.optimizedDescription += 1;
      if (draft.optimized_highlights !== base.optimized_highlights) summary.highlights += 1;
      if (draft.googleEnabled !== base.googleEnabled) summary.google += 1;
    }
    return summary;
  }, [bulkAiPlatform, bulkGridDrafts, selectedItems]);
  const gridAttributeChangeSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    for (const field of gridAttributeColumns) summary[field] = 0;
    for (const item of selectedItems) {
      const currentDrafts = bulkGridAttributeDrafts[item.id] || {};
      for (const field of gridAttributeColumns) {
        const draftValue = currentDrafts[field] ?? getAttributeValue(item, field);
        if (draftValue !== getAttributeValue(item, field)) {
          summary[field] = (summary[field] || 0) + 1;
        }
      }
    }
    return summary;
  }, [bulkGridAttributeDrafts, gridAttributeColumns, selectedItems]);
  const activeGridItem = useMemo(
    () => (activeGridCell ? selectedItems.find((item) => item.id === activeGridCell.itemId) ?? null : null),
    [activeGridCell, selectedItems]
  );
  const visibleGridSummary = useMemo(
    () =>
      [
        { label: "Titres", value: gridChangeSummary.title },
        { label: "Marques", value: gridChangeSummary.brand },
        { label: "Categories", value: gridChangeSummary.category },
        { label: "Types", value: gridChangeSummary.productType },
        { label: "Disponibilites", value: gridChangeSummary.availability },
        { label: "Titres IA", value: gridChangeSummary.optimizedTitle },
        { label: "Descriptions IA", value: gridChangeSummary.optimizedDescription },
        { label: "Highlights", value: gridChangeSummary.highlights },
        { label: activeDistributionLabel ? "Diffusion" : "Google", value: gridChangeSummary.google },
      ].filter((entry) => entry.value > 0),
    [activeDistributionLabel, gridChangeSummary]
  );
  const visibleGridAttributeSummary = useMemo(
    () =>
      gridAttributeColumns
        .map((field) => ({
          field,
          label: getFieldLabel(field),
          value: gridAttributeChangeSummary[field] || 0,
        }))
        .filter((entry) => entry.value > 0),
    [gridAttributeChangeSummary, gridAttributeColumns]
  );
  const gridSelectionSummary = useMemo(() => {
    if (!activeGridCell || !gridSelectionAnchor) return "1 cellule";
    const startRow = selectedItems.findIndex((item) => item.id === gridSelectionAnchor.itemId);
    const endRow = selectedItems.findIndex((item) => item.id === activeGridCell.itemId);
    const startCol = gridEditableFields.indexOf(gridSelectionAnchor.field);
    const endCol = gridEditableFields.indexOf(activeGridCell.field);
    if ([startRow, endRow, startCol, endCol].some((value) => value === -1)) return "1 cellule";
    const rowCount = Math.abs(endRow - startRow) + 1;
    const colCount = Math.abs(endCol - startCol) + 1;
    if (rowCount === 1 && colCount === 1) return "1 cellule";
    return `${rowCount} ligne${rowCount > 1 ? "s" : ""} x ${colCount} colonne${colCount > 1 ? "s" : ""}`;
  }, [activeGridCell, gridEditableFields, gridSelectionAnchor, selectedItems]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!showBulkGridModal) return;
    setBulkGridDrafts((current) => {
      let changed = false;
      const next: Record<string, BulkGridDraft> = {};
      for (const item of selectedItems) {
        const existing = current[item.id];
        if (existing) {
          next[item.id] = existing;
          continue;
        }
        changed = true;
        next[item.id] = createBulkGridDraft(item, bulkAiPlatform);
      }
      if (!changed && Object.keys(current).length === Object.keys(next).length) return current;
      return next;
    });
    setBulkGridAttributeDrafts((current) => {
      let changed = false;
      const next: Record<string, Record<string, string>> = {};
      for (const item of selectedItems) {
        const existing = current[item.id] || {};
        const itemDraft = Object.fromEntries(
          gridAttributeColumns.map((field) => [field, existing[field] ?? getAttributeValue(item, field)])
        );
        next[item.id] = itemDraft;
        if (!current[item.id]) {
          changed = true;
          continue;
        }
        for (const field of gridAttributeColumns) {
          if ((current[item.id]?.[field] ?? "") !== itemDraft[field]) {
            changed = true;
            break;
          }
        }
      }
      if (!changed && Object.keys(current).length === Object.keys(next).length) return current;
      return next;
    });
  }, [bulkAiPlatform, gridAttributeColumnsKey, selectedItemsKey, showBulkGridModal]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const currentFeed = feedsList.find((feed) => feed.id === selectedFeedId) || null;
  const currentFeedName = currentFeed?.name || "Flux";
  const currentSourceName = currentFeed?.source?.name || "Source inconnue";

  const selectionStats = useMemo(() => {
    const withImage = catalogueSummary?.withImage ?? filteredItems.filter((item) => !!item.imageUrl).length;
    const optimized = catalogueSummary ? Math.max(0, catalogueSummary.total - catalogueSummary.toOptimize) : filteredItems.filter(hasOptimizedContent).length;
    const googleOn = catalogueSummary?.published ?? filteredItems.filter(isGoogleEnabled).length;
    return { withImage, optimized, googleOn };
  }, [catalogueSummary, filteredItems]);

  const smartViewStats = useMemo(() => {
    if (catalogueSummary) {
      return {
        all: catalogueSummary.total,
        to_fix: catalogueSummary.toFix,
        to_optimize: catalogueSummary.toOptimize,
        ready_google: catalogueSummary.readyToPublish,
        google_off: catalogueSummary.notPublished,
        missing_category: catalogueSummary.missingCategory,
        missing_brand: catalogueSummary.missingBrand,
        missing_image: catalogueSummary.missingImage,
      };
    }
    const total = items.length;
    return {
      all: total,
      to_fix: items.filter((item) => !hasCoreMerchantData(item)).length,
      to_optimize: items.filter((item) => !hasOptimizedContent(item)).length,
      ready_google: items.filter((item) => isGoogleEnabled(item) && hasCoreMerchantData(item)).length,
      google_off: items.filter((item) => !isGoogleEnabled(item)).length,
      missing_category: items.filter((item) => !getItemCategory(item)).length,
      missing_brand: items.filter((item) => !(item.brand || "").trim()).length,
      missing_image: items.filter((item) => !item.imageUrl).length,
    };
  }, [catalogueSummary, items]);

  const scoreTone = catalogueScore?.globalScore != null
    ? catalogueScore.globalScore >= 80
      ? "success"
      : catalogueScore.globalScore >= 60
        ? "warning"
        : "error"
    : "warning";

  const scoreAccentClass = catalogueScore?.globalScore != null
    ? catalogueScore.globalScore >= 80
      ? "from-emerald-500/18 via-emerald-500/8 to-white border-emerald-200/80"
      : catalogueScore.globalScore >= 60
        ? "from-amber-500/18 via-amber-500/8 to-white border-amber-200/80"
        : "from-rose-500/20 via-rose-500/8 to-white border-rose-200/80"
    : "from-slate-200/40 via-white to-white border-border/70";

  const scoreBadgeClass = catalogueScore?.globalScore != null
    ? catalogueScore.globalScore >= 80
      ? "bg-emerald-600 text-white"
      : catalogueScore.globalScore >= 60
        ? "bg-amber-500 text-slate-950"
        : "bg-rose-600 text-white"
    : "bg-slate-900 text-white";

  const scoreTextClass = catalogueScore?.globalScore != null
    ? catalogueScore.globalScore >= 80
      ? "text-emerald-700"
      : catalogueScore.globalScore >= 60
        ? "text-amber-700"
        : "text-rose-700"
    : "text-foreground";

  const priorityActions = useMemo(() => {
    const fromScore = (catalogueScore?.topIssues || [])
      .filter((issue) => issue.count > 0)
      .map((issue) => ({
        key: issue.key,
        label: issue.label,
        count: issue.count,
        recommendation: issue.recommendation,
        smartView: issue.smartView ?? null,
      }));
    if (fromScore.length > 0) return fromScore.slice(0, 3);
    return [
      {
        key: "missing_category",
        label: "Produits sans categorie",
        count: smartViewStats.missing_category,
        recommendation: "Completer la categorie pour clarifier le matching canal.",
        smartView: "missing_category" as SmartViewKey,
      },
      {
        key: "missing_image",
        label: "Produits sans image",
        count: smartViewStats.missing_image,
        recommendation: "Ajouter une image principale exploitable sur chaque fiche.",
        smartView: "missing_image" as SmartViewKey,
      },
      {
        key: "missing_brand",
        label: "Produits sans marque",
        count: smartViewStats.missing_brand,
        recommendation: "Renseigner la marque pour fiabiliser le catalogue.",
        smartView: "missing_brand" as SmartViewKey,
      },
    ].filter((issue) => issue.count > 0);
  }, [catalogueScore?.topIssues, smartViewStats.missing_brand, smartViewStats.missing_category, smartViewStats.missing_image]);

  const pillarLead = useMemo(() => {
    const pillars = catalogueScore?.auditPillars || [];
    if (pillars.length === 0) return null;
    return [...pillars].sort((a, b) => a.score - b.score)[0] || null;
  }, [catalogueScore?.auditPillars]);

  const workspaceMetrics = useMemo(
    () => [
      {
        key: "all",
        label: "Produits",
        value: smartViewStats.all,
        hint: "catalogue actif",
        icon: Package,
        accent: "text-slate-700",
        badge: "bg-slate-100 text-slate-700",
      },
      {
        key: "ready_google",
        label: "Prets a diffuser",
        value: smartViewStats.ready_google,
        hint: activeDistributionLabel ? activeDistributionLabel.toLowerCase() : "eligibles Google",
        icon: CheckCircle,
        accent: "text-emerald-700",
        badge: "bg-emerald-100 text-emerald-700",
      },
      {
        key: "optimized",
        label: "Optimises",
        value: selectionStats.optimized,
        hint: "contenu enrichi",
        icon: Sparkles,
        accent: "text-sky-700",
        badge: "bg-sky-100 text-sky-700",
      },
      {
        key: "to_fix",
        label: "A corriger",
        value: smartViewStats.to_fix,
        hint: "donnees coeur a reprendre",
        icon: TriangleAlert,
        accent: "text-amber-700",
        badge: "bg-amber-100 text-amber-700",
      },
    ],
    [activeDistributionLabel, selectionStats.optimized, smartViewStats.all, smartViewStats.ready_google, smartViewStats.to_fix]
  );

  const brandOptions = useMemo(
    () =>
      (catalogueFilterOptions?.brands?.length
        ? catalogueFilterOptions.brands
        : [...new Set(items.map((item) => item.brand?.trim()).filter((value): value is string => Boolean(value)))])
        .sort((a, b) => a.localeCompare(b, "fr")),
    [catalogueFilterOptions?.brands, items]
  );
  const categoryOptions = useMemo(
    () =>
      (catalogueFilterOptions?.categories?.length
        ? catalogueFilterOptions.categories
        : [...new Set(items.map(getItemCategory).filter(Boolean))])
        .sort((a, b) => a.localeCompare(b, "fr")),
    [catalogueFilterOptions?.categories, items]
  );
  const sourceOptions = useMemo(
    () => [...new Set(items.map(getItemSourceLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [items]
  );

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  };

  const toggleSelectAllVisible = () => {
    setSelectedItemIds((prev) => {
      if (allVisibleSelected) return prev.filter((id) => !visibleIds.includes(id));
      return [...new Set([...prev, ...visibleIds])];
    });
  };

  const clearSelection = () => setSelectedItemIds([]);

  const toggleColumn = (column: ColumnKey) => {
    setVisibleColumns((current) =>
      current.includes(column) ? current.filter((entry) => entry !== column) : [...current, column]
    );
  };

  const moveColumn = (column: ColumnKey, direction: "left" | "right") => {
    setVisibleColumns((current) => {
      const index = current.indexOf(column);
      if (index === -1) return current;
      const target = direction === "left" ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const startColumnResize = (column: ColumnKey, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    columnResizeState.current = {
      column,
      startX: event.clientX,
      startWidth: columnWidths[column] ?? DEFAULT_COLUMN_WIDTHS[column],
    };
  };

  const nudgeColumnWidth = (column: ColumnKey, delta: number) => {
    setColumnWidths((current) => ({
      ...current,
      [column]: Math.max(100, (current[column] ?? DEFAULT_COLUMN_WIDTHS[column]) + delta),
    }));
  };

  const resetColumnWidths = () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
  };

  const setSortFromColumn = (column: ColumnKey, direction: "asc" | "desc") => {
    const nextSort =
      column === "product" ? (direction === "asc" ? "title_asc" : "title_desc") :
      column === "price" ? (direction === "asc" ? "price_asc" : "price_desc") :
      direction === "asc" ? "date_asc" : "date_desc";
    setSortBy(nextSort);
    setOpenColumnMenu(null);
  };

  const hideColumnAndClose = (column: ColumnKey) => {
    toggleColumn(column);
    setOpenColumnMenu(null);
  };

  const pushGridHistory = (snapshot: BulkGridSnapshot) => {
    setBulkGridHistory((current) => [...current.slice(-19), snapshot]);
  };

  const openBulkGridForItems = (itemsToEdit: FeedItem[]) => {
    const nextDrafts: Record<string, BulkGridDraft> = {};
    const nextAttributeDrafts: Record<string, Record<string, string>> = {};
    for (const item of itemsToEdit) {
      nextDrafts[item.id] = createBulkGridDraft(item, bulkAiPlatform);
      nextAttributeDrafts[item.id] = Object.fromEntries(gridAttributeColumns.map((field) => [field, getAttributeValue(item, field)]));
    }
    setBulkGridDrafts(nextDrafts);
    setBulkGridAttributeDrafts(nextAttributeDrafts);
    setBulkGridHistory([]);
    setShowBulkGridModal(true);
  };

  const openBulkGrid = () => {
    openBulkGridForItems(selectedItems);
  };

  const updateBulkGridDraft = useCallback((itemId: string, field: keyof BulkGridDraft, value: string | boolean) => {
    const item = selectedItems.find((entry) => entry.id === itemId);
    const baseDraft = bulkGridDrafts[itemId] ?? (item ? createBulkGridDraft(item, bulkAiPlatform) : null);
    if (!baseDraft) return;
    setBulkGridDrafts((current) => ({
      ...current,
      [itemId]: {
        ...baseDraft,
        [field]: value,
      },
    }));
  }, [bulkAiPlatform, bulkGridDrafts, selectedItems]);

  const fillGridFromOptimized = (field: "title" | "description" | "highlights") => {
    pushGridHistory({ drafts: bulkGridDrafts, attributes: bulkGridAttributeDrafts });
    setBulkGridDrafts((current) => {
      const next = { ...current };
      for (const item of selectedItems) {
        const draft = next[item.id] ?? createBulkGridDraft(item, bulkAiPlatform);
        const optimized = getOptimizedPlatformContent(item, bulkAiPlatform);
        if (field === "title" && optimized.title.trim()) draft.title = optimized.title.trim();
        if (field === "description" && optimized.description.trim()) draft.optimized_description = optimized.description.trim();
        if (field === "highlights" && optimized.highlights.length > 0) draft.optimized_highlights = optimized.highlights.join("\n");
        next[item.id] = draft;
      }
      return next;
    });
  };

  const applyGridValueToSelection = () => {
    if (selectedItems.length === 0) return;
    const sourceItem = selectedItems[0];
    const sourceDraft = bulkGridDrafts[sourceItem.id] ?? createBulkGridDraft(sourceItem, bulkAiPlatform);
    const value = sourceDraft[gridCopyField];
    pushGridHistory({ drafts: bulkGridDrafts, attributes: bulkGridAttributeDrafts });
    setBulkGridDrafts((current) => {
      const next = { ...current };
      for (const item of selectedItems) {
        const draft = next[item.id] ?? createBulkGridDraft(item, bulkAiPlatform);
        next[item.id] = { ...draft, [gridCopyField]: value };
      }
      return next;
    });
  };

  const undoGridChanges = () => {
    if (bulkGridHistory.length === 0) return;
    const previous = bulkGridHistory[bulkGridHistory.length - 1];
    setBulkGridDrafts(previous.drafts);
    setBulkGridAttributeDrafts(previous.attributes);
    setBulkGridHistory((current) => current.slice(0, -1));
  };

  const resetGridToSource = () => {
    const nextDrafts: Record<string, BulkGridDraft> = {};
    const nextAttributeDrafts: Record<string, Record<string, string>> = {};
    for (const item of selectedItems) {
      nextDrafts[item.id] = createBulkGridDraft(item, bulkAiPlatform);
      nextAttributeDrafts[item.id] = Object.fromEntries(gridAttributeColumns.map((field) => [field, getAttributeValue(item, field)]));
    }
    pushGridHistory({ drafts: bulkGridDrafts, attributes: bulkGridAttributeDrafts });
    setBulkGridDrafts(nextDrafts);
    setBulkGridAttributeDrafts(nextAttributeDrafts);
  };

  const toggleGridAttributeColumn = (fieldKey: string) => {
    setGridAttributeColumns((current) =>
      current.includes(fieldKey) ? current.filter((field) => field !== fieldKey) : [...current, fieldKey]
    );
  };

  const updateGridAttributeDraft = (itemId: string, field: string, value: string) => {
    setBulkGridAttributeDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] || {}),
        [field]: value,
      },
    }));
  };

  const isGridAttributeDirty = (item: FeedItem, field: string) => {
    const current = bulkGridAttributeDrafts[item.id]?.[field] ?? getAttributeValue(item, field);
    return current !== getAttributeValue(item, field);
  };

  const registerGridCellRef = useCallback((itemId: string, field: string, element: HTMLElement | null) => {
    gridCellRefs.current[`${itemId}:${field}`] = element;
  }, []);

  const activateGridCell = useCallback((itemId: string, field: string, extendSelection: boolean) => {
    const nextCell = { itemId, field };
    setActiveGridCell(nextCell);
    if (!extendSelection || !gridSelectionAnchor) {
      setGridSelectionAnchor(nextCell);
      return;
    }
  }, [gridSelectionAnchor]);

  const isGridCellSelected = useCallback((itemId: string, field: string) => {
    if (!activeGridCell || !gridSelectionAnchor) return false;
    const startRow = selectedItems.findIndex((item) => item.id === gridSelectionAnchor.itemId);
    const endRow = selectedItems.findIndex((item) => item.id === activeGridCell.itemId);
    const startCol = gridEditableFields.indexOf(gridSelectionAnchor.field);
    const endCol = gridEditableFields.indexOf(activeGridCell.field);
    const currentRow = selectedItems.findIndex((item) => item.id === itemId);
    const currentCol = gridEditableFields.indexOf(field);
    if ([startRow, endRow, startCol, endCol, currentRow, currentCol].some((value) => value === -1)) return false;
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    return currentRow >= minRow && currentRow <= maxRow && currentCol >= minCol && currentCol <= maxCol;
  }, [activeGridCell, gridEditableFields, gridSelectionAnchor, selectedItems]);

  const isActiveGridCell = useCallback((itemId: string, field: string) => {
    return activeGridCell?.itemId === itemId && activeGridCell.field === field;
  }, [activeGridCell]);

  const focusGridCell = useCallback((itemId: string, field: string) => {
    const target = gridCellRefs.current[`${itemId}:${field}`];
    if (!target) return;
    target.focus();
    if ("select" in target && typeof (target as HTMLInputElement | HTMLTextAreaElement).select === "function") {
      try {
        (target as HTMLInputElement | HTMLTextAreaElement).select();
      } catch {}
    }
  }, []);

  const moveGridFocus = useCallback((itemId: string, field: string, rowDelta: number, colDelta: number) => {
    const rowIndex = selectedItems.findIndex((item) => item.id === itemId);
    const colIndex = gridEditableFields.indexOf(field);
    if (rowIndex === -1 || colIndex === -1) return;
    const nextRow = Math.max(0, Math.min(selectedItems.length - 1, rowIndex + rowDelta));
    const nextCol = Math.max(0, Math.min(gridEditableFields.length - 1, colIndex + colDelta));
    focusGridCell(selectedItems[nextRow].id, gridEditableFields[nextCol]);
  }, [focusGridCell, gridEditableFields, selectedItems]);

  const parsePastedBoolean = (value: string) => {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "yes", "oui", "active", "on"].includes(normalized);
  };

  const applyGridCellValue = useCallback((itemId: string, field: string, value: string) => {
    if (CORE_GRID_FIELDS.has(field)) {
      if (field === "googleEnabled") {
        updateBulkGridDraft(itemId, "googleEnabled", parsePastedBoolean(value));
        return;
      }
      updateBulkGridDraft(itemId, field as keyof BulkGridDraft, value);
      return;
    }
    updateGridAttributeDraft(itemId, field, value);
  }, [updateBulkGridDraft]);

  const getGridCellStringValue = useCallback((itemId: string, field: string) => {
    const item = selectedItems.find((entry) => entry.id === itemId);
    if (!item) return "";
    if (CORE_GRID_FIELDS.has(field)) {
      const draft = bulkGridDrafts[item.id] ?? createBulkGridDraft(item, bulkAiPlatform);
      const value = draft[field as keyof BulkGridDraft];
      return typeof value === "boolean" ? (value ? "true" : "false") : String(value ?? "");
    }
    return bulkGridAttributeDrafts[item.id]?.[field] ?? getAttributeValue(item, field);
  }, [bulkAiPlatform, bulkGridAttributeDrafts, bulkGridDrafts, selectedItems]);

  const applyGridFillRange = useCallback((itemId: string, field: string, explicitTargetItemId?: string) => {
    const startRow = selectedItems.findIndex((item) => item.id === itemId);
    if (startRow === -1) return;
    const value = getGridCellStringValue(itemId, field);
    pushGridHistory({ drafts: bulkGridDrafts, attributes: bulkGridAttributeDrafts });
    let endRow = selectedItems.length - 1;
    if (explicitTargetItemId) {
      const explicitRow = selectedItems.findIndex((item) => item.id === explicitTargetItemId);
      if (explicitRow !== -1) {
        endRow = explicitRow;
      }
    }
    if (!explicitTargetItemId && gridSelectionAnchor && activeGridCell && gridSelectionAnchor.field === field && activeGridCell.field === field) {
      const anchorRow = selectedItems.findIndex((item) => item.id === gridSelectionAnchor.itemId);
      const activeRow = selectedItems.findIndex((item) => item.id === activeGridCell.itemId);
      if (anchorRow !== -1 && activeRow !== -1) {
        endRow = Math.max(anchorRow, activeRow);
      }
    }
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    for (let row = minRow; row <= maxRow; row += 1) {
      if (selectedItems[row].id === itemId) continue;
      applyGridCellValue(selectedItems[row].id, field, value);
    }
  }, [activeGridCell, applyGridCellValue, bulkGridAttributeDrafts, bulkGridDrafts, getGridCellStringValue, gridSelectionAnchor, selectedItems]);

  const fillDownFromGridCell = useCallback((itemId: string, field: string) => {
    applyGridFillRange(itemId, field);
  }, [applyGridFillRange]);

  const handleGridCellHover = useCallback((itemId: string, field: string) => {
    setDragFillState((current) => {
      if (!current || current.field !== field) return current;
      if (current.targetItemId === itemId) return current;
      return {
        ...current,
        targetItemId: itemId,
      };
    });
  }, []);

  const isDragFillPreviewCell = useCallback((itemId: string, field: string) => {
    if (!dragFillState || dragFillState.field !== field) return false;
    const startRow = selectedItems.findIndex((item) => item.id === dragFillState.originItemId);
    const endRow = selectedItems.findIndex((item) => item.id === dragFillState.targetItemId);
    const currentRow = selectedItems.findIndex((item) => item.id === itemId);
    if (startRow === -1 || endRow === -1 || currentRow === -1) return false;
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    return currentRow >= minRow && currentRow <= maxRow;
  }, [dragFillState, selectedItems]);

  const handleFillHandleMouseDown = useCallback((itemId: string, field: string) => {
    setDragFillState({
      originItemId: itemId,
      field,
      targetItemId: itemId,
    });
  }, []);

  useEffect(() => {
    if (!dragFillState) return;
    const handleMouseUp = () => {
      const startRow = selectedItems.findIndex((item) => item.id === dragFillState.originItemId);
      const endRow = selectedItems.findIndex((item) => item.id === dragFillState.targetItemId);
      if (startRow === -1 || endRow === -1 || startRow === endRow) {
        setDragFillState(null);
        return;
      }
      const value = getGridCellStringValue(dragFillState.originItemId, dragFillState.field);
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      pushGridHistory({ drafts: bulkGridDrafts, attributes: bulkGridAttributeDrafts });
      for (let row = minRow; row <= maxRow; row += 1) {
        if (selectedItems[row].id === dragFillState.originItemId) continue;
        applyGridCellValue(selectedItems[row].id, dragFillState.field, value);
      }
      setDragFillState(null);
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [applyGridCellValue, bulkGridAttributeDrafts, bulkGridDrafts, dragFillState, getGridCellStringValue, selectedItems]);

  const handleGridCellPaste = useCallback((itemId: string, field: string, event: ReactClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const raw = event.clipboardData.getData("text");
    if (!raw.includes("\t") && !raw.includes("\n")) return;
    event.preventDefault();
    pushGridHistory({ drafts: bulkGridDrafts, attributes: bulkGridAttributeDrafts });
    const rows = raw
      .replace(/\r/g, "")
      .split("\n")
      .filter((row) => row.length > 0)
      .map((row) => row.split("\t"));
    const startRow = selectedItems.findIndex((item) => item.id === itemId);
    const startCol = gridEditableFields.indexOf(field);
    if (startRow === -1 || startCol === -1) return;
    for (let r = 0; r < rows.length; r += 1) {
      const targetRowIndex = startRow + r;
      if (targetRowIndex >= selectedItems.length) break;
      for (let c = 0; c < rows[r].length; c += 1) {
        const targetColIndex = startCol + c;
        if (targetColIndex >= gridEditableFields.length) break;
        applyGridCellValue(selectedItems[targetRowIndex].id, gridEditableFields[targetColIndex], rows[r][c]);
      }
    }
  }, [applyGridCellValue, bulkGridAttributeDrafts, bulkGridDrafts, gridEditableFields, selectedItems]);

  const handleGridCopy = useCallback((event: ReactClipboardEvent<HTMLDivElement>) => {
    if (!activeGridCell || !gridSelectionAnchor) return;
    const startRow = selectedItems.findIndex((item) => item.id === gridSelectionAnchor.itemId);
    const endRow = selectedItems.findIndex((item) => item.id === activeGridCell.itemId);
    const startCol = gridEditableFields.indexOf(gridSelectionAnchor.field);
    const endCol = gridEditableFields.indexOf(activeGridCell.field);
    if ([startRow, endRow, startCol, endCol].some((value) => value === -1)) return;
    event.preventDefault();
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const lines: string[] = [];
    for (let row = minRow; row <= maxRow; row += 1) {
      const item = selectedItems[row];
      const cells: string[] = [];
      for (let col = minCol; col <= maxCol; col += 1) {
        const field = gridEditableFields[col];
        if (CORE_GRID_FIELDS.has(field)) {
          const draft = bulkGridDrafts[item.id] ?? createBulkGridDraft(item, bulkAiPlatform);
          const value = draft[field as keyof BulkGridDraft];
          cells.push(typeof value === "boolean" ? (value ? "true" : "false") : String(value ?? ""));
        } else {
          cells.push(bulkGridAttributeDrafts[item.id]?.[field] ?? getAttributeValue(item, field));
        }
      }
      lines.push(cells.join("\t"));
    }
    event.clipboardData.setData("text/plain", lines.join("\n"));
  }, [activeGridCell, bulkAiPlatform, bulkGridAttributeDrafts, bulkGridDrafts, gridEditableFields, gridSelectionAnchor, selectedItems]);

  const handleGridCellKeyDown = useCallback((
    itemId: string,
    field: string,
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const isTextarea = event.currentTarget instanceof HTMLTextAreaElement;
    if (event.key === "Enter" && !isTextarea) {
      event.preventDefault();
      moveGridFocus(itemId, field, event.shiftKey ? -1 : 1, 0);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      moveGridFocus(itemId, field, 0, event.shiftKey ? -1 : 1);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
      return;
    }
    if (event.key === "ArrowDown" && !isTextarea) {
      event.preventDefault();
      moveGridFocus(itemId, field, 1, 0);
      return;
    }
    if (event.key === "ArrowUp" && !isTextarea) {
      event.preventDefault();
      moveGridFocus(itemId, field, -1, 0);
      return;
    }
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !isTextarea) {
      const input = event.currentTarget as HTMLInputElement;
      const cursor = input.selectionStart ?? 0;
      const atStart = cursor === 0;
      const atEnd = cursor === input.value.length;
      if ((event.key === "ArrowLeft" && atStart) || (event.key === "ArrowRight" && atEnd)) {
        event.preventDefault();
        moveGridFocus(itemId, field, 0, event.key === "ArrowLeft" ? -1 : 1);
      }
    }
  }, [moveGridFocus]);

  const openBulkAiModal = ({
    titles = true,
    descriptions = true,
    highlights = false,
  }: {
    titles?: boolean;
    descriptions?: boolean;
    highlights?: boolean;
  }) => {
    setBulkOptimizeTitles(titles);
    setBulkOptimizeDescriptions(descriptions);
    setBulkOptimizeHighlights(highlights);
    setShowBulkAiModal(true);
  };

  const resetFilters = () => {
    setFilterImage("all");
    setFilterOptimized("all");
    setFilterChannel("all");
    setFilterStock("all");
    setFilterBrand("all");
    setFilterCategory("all");
    setFilterSource("all");
    setFilterUpdatedRecent(false);
  };

  const applySmartView = (view: SmartViewKey) => {
    setActiveSmartView(view);
    resetFilters();
  };

  const activeFilterCount = [
    filterImage !== "all",
    filterOptimized !== "all",
    filterChannel !== "all",
    filterStock !== "all",
    filterBrand !== "all",
    filterCategory !== "all",
    filterSource !== "all",
    filterUpdatedRecent,
  ].filter(Boolean).length;

  const activeSmartViewLabel =
    activeSmartView === "all"
      ? null
      : ({
          to_fix: "A corriger",
          to_optimize: "A optimiser",
          ready_google: "Prets a diffuser",
          google_off: "Hors diffusion",
          missing_category: "Sans categorie",
          missing_brand: "Sans marque",
          missing_image: "Sans image",
        } as const)[activeSmartView];

  const hasSearchContext = debouncedSearchQuery.trim().length > 0;
  const hasSecondaryFilters = activeFilterCount > 0;
  const hasViewContext = activeSmartView !== "all";
  const hasCatalogueContext = hasSearchContext || hasSecondaryFilters || hasViewContext;
  const emptyStateTitle = hasSearchContext
    ? "Aucun produit trouve"
    : hasCatalogueContext
      ? "Aucun produit pour cette vue"
      : "Aucun produit dans le catalogue";
  const emptyStateDescription = hasSearchContext
    ? "Essaie d'autres mots-cles."
    : hasCatalogueContext
      ? `Aucun produit ne correspond actuellement${activeSmartViewLabel ? ` a la vue "${activeSmartViewLabel}"` : ""}${hasSecondaryFilters ? " et aux filtres actifs" : ""}.`
      : "Ajoute une source ou synchronise un flux pour remplir le catalogue.";
  const activeContextBadges = [
    activeDistributionLabel ? `Destination: ${activeDistributionLabel}` : null,
    hasViewContext && activeSmartViewLabel ? `Vue: ${activeSmartViewLabel}` : null,
    hasSearchContext ? `Recherche: ${debouncedSearchQuery}` : null,
    filterImage !== "all" ? `Image: ${filterImage === "with" ? "Avec image" : "Sans image"}` : null,
    filterOptimized !== "all" ? `Optimisation: ${filterOptimized === "optimized" ? "Deja optimises" : "A optimiser"}` : null,
    filterChannel !== "all" ? `Diffusion: ${filterChannel === "google_on" ? "En diffusion" : "Hors diffusion"}` : null,
    filterStock !== "all" ? `Stock: ${filterStock === "in_stock" ? "En stock" : "Stock nul"}` : null,
    filterBrand !== "all" ? `Marque: ${filterBrand === "__missing__" ? "Manquante" : filterBrand}` : null,
    filterCategory !== "all" ? `Categorie: ${filterCategory === "__missing__" ? "Manquante" : filterCategory}` : null,
    filterSource !== "all" ? `Source: ${filterSource}` : null,
    filterUpdatedRecent ? "Mise a jour recente" : null,
  ].filter((value): value is string => Boolean(value));

  const fieldNeedsUpdate = (item: FeedItem, field: BulkEditField) => {
    switch (field) {
      case "brand":
        return !(item.brand || "").trim();
      case "google_product_category":
        return !getItemCategory(item);
      case "product_type": {
        const customfields = parseCustomFields(item.customfields);
        return !(typeof customfields.product_type === "string" && customfields.product_type.trim());
      }
      case "availability":
        return !getItemAvailability(item);
      case "optimized_title":
        return !getOptimizedPlatformContent(item, bulkAiPlatform).title.trim();
      case "optimized_description":
        return !getOptimizedPlatformContent(item, bulkAiPlatform).description.trim();
      case "optimized_highlights":
        return getOptimizedPlatformContent(item, bulkAiPlatform).highlights.length === 0;
      default:
        return true;
    }
  };

  const selectedItemsEligibleForBulkEdit = selectedItems.filter((item) =>
    bulkApplyMode === "only_empty" ? fieldNeedsUpdate(item, bulkEditField) : true
  );

  const bulkEditPreview = useMemo(() => {
    const targets = selectedItemsEligibleForBulkEdit.length;
    if (targets === 0) return "Aucun produit de la sélection ne correspond à ce critère.";
    switch (bulkEditField) {
      case "brand":
        return `${targets} produit${targets > 1 ? "s" : ""} recevront une marque.`;
      case "google_product_category":
        return `${targets} produit${targets > 1 ? "s" : ""} recevront une catégorie Google.`;
      case "product_type":
        return `${targets} produit${targets > 1 ? "s" : ""} recevront un type produit.`;
      case "availability":
        return `${targets} produit${targets > 1 ? "s" : ""} recevront une disponibilité marchande.`;
      case "optimized_title":
        return `${targets} produit${targets > 1 ? "s" : ""} recevront un titre optimisé mémorisé pour ${bulkAiPlatform.toUpperCase()}.`;
      case "optimized_description":
        return `${targets} produit${targets > 1 ? "s" : ""} recevront une description optimisée mémorisée pour ${bulkAiPlatform.toUpperCase()}.`;
      case "optimized_highlights":
        return `${targets} produit${targets > 1 ? "s" : ""} recevront des highlights optimisés pour ${bulkAiPlatform.toUpperCase()}.`;
      default:
        return `${targets} produits seront mis à jour.`;
    }
  }, [bulkAiPlatform, bulkEditField, selectedItemsEligibleForBulkEdit.length]);

  const applyGoogleSelection = async (enabled: boolean) => {
    if (selectedItemIds.length === 0) return;
    try {
      setBulkActionLoading(enabled ? "google_on" : "google_off");
      await Promise.all(selectedItemIds.map((itemId) => {
        if (selectedDestinationId !== "all") {
          return apiClient.patch(`/ingestion/items/${itemId}/destinations/${selectedDestinationId}`, { isEnabled: enabled });
        }
        return apiClient.patch(`/ingestion/items/${itemId}/channels`, { google: enabled });
      }));
      if (selectedFeedId) {
        await fetchItems(selectedFeedId, false, debouncedSearchQuery);
      }
      showToast(
        enabled
          ? `Diffusion activee sur ${selectedItemIds.length} produit${selectedItemIds.length > 1 ? "s" : ""}.`
          : `Diffusion desactivee sur ${selectedItemIds.length} produit${selectedItemIds.length > 1 ? "s" : ""}.`,
        "success"
      );
      clearSelection();
    } catch (err: unknown) {
      showToast(
        getErrorMessage(
          err,
          selectedDestinationId !== "all" ? "Impossible de mettre a jour la diffusion sur cette destination" : "Impossible d'appliquer le canal Google"
        ),
        "error"
      );
    } finally {
      setBulkActionLoading(null);
    }
  };

  const runBulkOptimization = async () => {
    if (selectedItemIds.length === 0) return;
    if (!bulkOptimizeTitles && !bulkOptimizeDescriptions && !bulkOptimizeHighlights) {
      showToast("Selectionnez au moins un contenu a optimiser.", "error");
      return;
    }

    // Destination effective : une destination imposée par la page prime ;
    // sinon le marché choisi dans le modal ; sinon la destination de page.
    const bulkMarketOption = bulkMarketCode
      ? bulkMarketOptions.find((option) => option.marketCode === bulkMarketCode)
      : null;
    let effectiveDestinationId: string | undefined;
    if (selectedDestinationOption) {
      effectiveDestinationId = selectedDestinationId;
    } else if (bulkMarketOption) {
      effectiveDestinationId = bulkMarketOption.destinationId;
    } else if (selectedDestinationId !== "all") {
      effectiveDestinationId = selectedDestinationId;
    }

    const itemIds = selectedItemIds;
    const optimizeContent = bulkOptimizeTitles || bulkOptimizeDescriptions;
    const totalSteps =
      (optimizeContent ? itemIds.length : 0) + (bulkOptimizeHighlights ? itemIds.length : 0);

    try {
      setBulkActionLoading("ai");
      setBulkProgress({ done: 0, total: totalSteps });
      let savedTitles = 0;
      let savedDescriptions = 0;
      let savedHighlights = 0;

      // Titres / descriptions : traités par lots pour une progression réelle.
      if (optimizeContent) {
        const CHUNK_SIZE = 10;
        for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
          const chunk = itemIds.slice(i, i + CHUNK_SIZE);
          const response = await apiClient.post<{
            saved?: { titles?: number; descriptions?: number };
          }>("/enrichment/batch", {
            itemIds: chunk,
            optimizations: {
              titles: bulkOptimizeTitles,
              descriptions: bulkOptimizeDescriptions,
            },
            platform: bulkAiPlatform,
            saveToCatalog: true,
            saveDestinationId: effectiveDestinationId,
          });
          savedTitles += response.data.saved?.titles ?? 0;
          savedDescriptions += response.data.saved?.descriptions ?? 0;
          setBulkProgress((current) =>
            current ? { ...current, done: current.done + chunk.length } : current
          );
        }
      }

      if (bulkOptimizeHighlights) {
        for (const itemId of itemIds) {
          const response = await apiClient.post<{ highlights?: string[] }>("/enrichment/generate-highlights", {
            itemId,
            platform: bulkAiPlatform,
            savePlatform: bulkAiPlatform,
            saveDestinationId: effectiveDestinationId,
          });
          if (Array.isArray(response.data.highlights) && response.data.highlights.length > 0) {
            savedHighlights += 1;
          }
          setBulkProgress((current) => (current ? { ...current, done: current.done + 1 } : current));
        }
      }

      if (selectedFeedId) {
        await fetchItems(selectedFeedId, false, debouncedSearchQuery);
        await fetchCatalogueScore(selectedFeedId);
      }
      showToast(
        `Optimisation IA terminee. ${savedTitles} titre${savedTitles > 1 ? "s" : ""}, ${savedDescriptions} description${savedDescriptions > 1 ? "s" : ""} et ${savedHighlights} set${savedHighlights > 1 ? "s" : ""} de highlights sauvegardes.`,
        "success"
      );
      setShowBulkAiModal(false);
      clearSelection();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, "Impossible de lancer l'optimisation IA"), "error");
    } finally {
      setBulkActionLoading(null);
      setBulkProgress(null);
    }
  };

  const runBulkEdit = async () => {
    if (selectedItemIds.length === 0) return;
    const targets = selectedItemsEligibleForBulkEdit;
    if (targets.length === 0) {
      showToast("Aucun produit de la sélection n'a besoin de cette mise à jour.", "info");
      return;
    }
    if (!bulkEditValue.trim()) {
      showToast("Saisissez une valeur à appliquer.", "error");
      return;
    }
    try {
      setBulkActionLoading("bulk_edit");
      if (bulkEditField === "optimized_title" || bulkEditField === "optimized_description" || bulkEditField === "optimized_highlights") {
        for (const item of targets) {
          const payload: { platform: BulkPlatform; destinationId?: string; title?: string; description?: string; highlights?: string[] } = {
            platform: bulkAiPlatform,
            destinationId: selectedDestinationId !== "all" ? selectedDestinationId : undefined,
          };
          if (bulkEditField === "optimized_title") payload.title = bulkEditValue.trim();
          if (bulkEditField === "optimized_description") payload.description = bulkEditValue.trim();
          if (bulkEditField === "optimized_highlights") {
            payload.highlights = bulkEditValue
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
          }
          await apiClient.patch(`/ingestion/items/${item.id}/optimized`, payload);
        }
      } else {
        for (const item of targets) {
          const payload: Record<string, unknown> = {};
          if (bulkEditField === "brand") payload.brand = bulkEditValue.trim();
          if (bulkEditField === "google_product_category") payload.google_product_category = bulkEditValue.trim();
          if (bulkEditField === "product_type") payload.product_type = bulkEditValue.trim();
          if (bulkEditField === "availability") payload.availability = bulkEditValue.trim();
          await apiClient.put(`/ingestion/items/${item.id}`, payload);
        }
      }
      if (selectedFeedId) {
        await fetchItems(selectedFeedId, false, debouncedSearchQuery);
        await fetchCatalogueScore(selectedFeedId);
      }
      showToast(`${targets.length} produit${targets.length > 1 ? "s" : ""} mis a jour via le studio d'edition.`, "success");
      setShowBulkEditModal(false);
      setBulkEditValue("");
      clearSelection();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, "Impossible d'appliquer l'edition en masse"), "error");
    } finally {
      setBulkActionLoading(null);
    }
  };

  const saveBulkGrid = async () => {
    if (selectedItems.length === 0) return;
    const changedRows = selectedItems.filter((item) => {
      const draft = bulkGridDrafts[item.id];
      if (!draft) return false;
      const optimized = getOptimizedPlatformContent(item, bulkAiPlatform);
      const currentProductType = (() => {
        const customfields = parseCustomFields(item.customfields);
        return typeof customfields.product_type === "string" ? customfields.product_type : "";
      })();
      return (
        draft.title !== (item.title || "") ||
        draft.brand !== (item.brand || "") ||
        draft.google_product_category !== getItemCategory(item) ||
        draft.product_type !== currentProductType ||
        draft.availability !== getItemAvailability(item) ||
        draft.googleEnabled !== isGoogleEnabled(item) ||
        draft.optimized_title !== optimized.title ||
        draft.optimized_description !== optimized.description ||
        draft.optimized_highlights !== optimized.highlights.join("\n") ||
        gridAttributeColumns.some((field) => (bulkGridAttributeDrafts[item.id]?.[field] ?? getAttributeValue(item, field)) !== getAttributeValue(item, field))
      );
    });

    if (changedRows.length === 0) {
      showToast("Aucune modification detectee dans la grille.", "info");
      return;
    }

    try {
      setBulkActionLoading("grid_save");
      for (const item of changedRows) {
        const draft = bulkGridDrafts[item.id];
        if (!draft) continue;
        const currentCustomfields = parseCustomFields(item.customfields);
        const nextCustomfields = { ...currentCustomfields };
        const rootPayload: Record<string, unknown> = {
          title: draft.title.trim(),
          brand: draft.brand.trim(),
          google_product_category: draft.google_product_category.trim(),
          product_type: draft.product_type.trim(),
          availability: draft.availability.trim(),
        };
        for (const field of gridAttributeColumns) {
          const nextValue = (bulkGridAttributeDrafts[item.id]?.[field] ?? getAttributeValue(item, field)).trim();
          if (ROOT_EDITABLE_FIELDS.has(field)) {
            rootPayload[field] = nextValue;
          } else {
            nextCustomfields[field] = nextValue;
          }
        }
        await apiClient.put(`/ingestion/items/${item.id}`, {
          ...rootPayload,
          customfields: nextCustomfields,
        });
        await apiClient.patch(`/ingestion/items/${item.id}/optimized`, {
          platform: bulkAiPlatform,
          destinationId: selectedDestinationId !== "all" ? selectedDestinationId : undefined,
          title: draft.optimized_title.trim(),
          description: draft.optimized_description.trim(),
          highlights: draft.optimized_highlights
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        });
        if (selectedDestinationId !== "all") {
          await apiClient.patch(`/ingestion/items/${item.id}/destinations/${selectedDestinationId}`, {
            isEnabled: draft.googleEnabled,
          });
        } else {
          await apiClient.patch(`/ingestion/items/${item.id}/channels`, {
            google: draft.googleEnabled,
          });
        }
      }
      if (selectedFeedId) {
        await fetchItems(selectedFeedId, false, debouncedSearchQuery);
        await fetchCatalogueScore(selectedFeedId);
      }
      showToast(`${changedRows.length} ligne${changedRows.length > 1 ? "s" : ""} enregistree${changedRows.length > 1 ? "s" : ""} depuis la grille.`, "success");
      setShowBulkGridModal(false);
      clearSelection();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, "Impossible d'enregistrer la grille"), "error");
    } finally {
      setBulkActionLoading(null);
    }
  };

  const isGridCellDirty = (item: FeedItem, field: keyof BulkGridDraft) => {
    const draft = bulkGridDrafts[item.id];
    if (!draft) return false;
    const base = createBulkGridDraft(item, bulkAiPlatform);
    return draft[field] !== base[field];
  };

  const loadMore = () => {
    if (selectedFeedId && hasMoreItems && !loadingMore) {
      void fetchItems(selectedFeedId, true, debouncedSearchQuery);
    }
  };

  return (
    <PageLayout className="max-w-full overflow-x-hidden">
      {toast && (
        <div className={cn(
          "fixed right-6 top-6 z-[100] flex max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg",
          toast.type === "success" ? "border-green-200 bg-green-50 text-green-800" :
          toast.type === "error" ? "border-red-200 bg-red-50 text-red-800" :
          "border-blue-200 bg-blue-50 text-blue-800"
        )}>
          {toast.type === "success" ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> :
            toast.type === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : null}
          <span className="flex-1 whitespace-pre-line">{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <PageHeader
        title="Catalogue"
        subtitle="Travaillez votre catalogue comme une table d'operations: filtrez, selectionnez et appliquez vos actions en masse."
        actions={
          <div className="flex flex-wrap gap-2">
            <PageButtonSecondary onClick={handleSyncFromCatalogue} disabled={!selectedFeedId || syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? "Synchronisation..." : "Synchroniser"}
            </PageButtonSecondary>
            <PageButtonPrimary onClick={() => setShowEnrichmentModal(true)} disabled={!selectedFeedId}>
              <Sparkles className="h-4 w-4" />
              Enrichir le flux
            </PageButtonPrimary>
          </div>
        }
      />

      <PageCard className="mb-24 overflow-hidden border-border/70 bg-white p-0 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="border-b border-border/70 bg-[linear-gradient(180deg,#ffffff,#f7faf7)] px-4 py-4 sm:px-5">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <div className="min-w-0 rounded-3xl border border-border/70 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-[var(--paper-2)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          <Table2 className="h-3.5 w-3.5" />
                          Catalogue
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {debouncedSearchQuery ? `${filteredItems.length} resultats sur ${totalCount}` : `${filteredItems.length} produits visibles sur ${totalCount}`}
                        </span>
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{currentFeedName}</h2>
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        Filtre, selectionne puis ouvre l&apos;editeur pour modifier le flux sans perdre le contexte.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {feedsList.length > 1 && (
                        <Select value={selectedFeedId ?? ""} onChange={(event) => setSelectedFeedId(event.target.value || null)} className="w-full sm:w-[240px]">
                          {feedsList.map((feed) => (
                            <option key={feed.id} value={feed.id}>{feed.name}</option>
                          ))}
                        </Select>
                      )}
                      {destinationOptions.length > 0 && (
                        <Select value={selectedDestinationId} onChange={(event) => setSelectedDestinationId(event.target.value)} className="w-full sm:w-[300px]">
                          <option value="all">Toutes les destinations</option>
                          {destinationOptions.map((destination) => (
                            <option key={destination.id} value={destination.id}>{destination.label}</option>
                          ))}
                        </Select>
                      )}
                      <Button variant="outline" size="sm" onClick={recalculateAllScores} disabled={loadingScore}>
                        {loadingScore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Recalculer
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-xs font-medium text-foreground">
                      Source: {currentSourceName}
                    </span>
                    {activeDistributionLabel && (
                      <span className="rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-xs font-medium text-foreground">
                        Destination: {activeDistributionLabel}
                      </span>
                    )}
                    <span className="rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-xs font-medium text-foreground">
                      Vue: {activeSmartViewLabel ?? "Tous les produits"}
                    </span>
                    {hasSearchContext && (
                      <span className="rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-xs font-medium text-foreground">
                        Recherche: {debouncedSearchQuery}
                      </span>
                    )}
                    {activeFilterCount > 0 && (
                      <span className="rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-xs font-medium text-foreground">
                        {activeFilterCount} filtre{activeFilterCount > 1 ? "s" : ""} actif{activeFilterCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {workspaceMetrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={metric.key}
                      className="rounded-[24px] border border-border/70 bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</div>
                          <div className={cn("mt-3 text-2xl font-semibold tracking-tight", metric.accent)}>{metric.value}</div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{metric.hint}</p>
                        </div>
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", metric.badge)}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-border/70 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Etat du catalogue</p>
                </div>
                <span className="rounded-full border border-border/70 bg-[var(--paper-2)] px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  Flux actif
                </span>
              </div>
              {!loadingScore && catalogueScore && (
                <div className="mt-4 space-y-4">
                  <div className={cn("rounded-[28px] border bg-gradient-to-br p-4 shadow-[0_16px_30px_rgba(15,23,42,0.06)]", scoreAccentClass)}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", scoreBadgeClass)}>
                            {catalogueScore.scoreBand?.label || "Catalogue"}
                          </span>
                          {pillarLead ? (
                            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/80 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                              <TriangleAlert className="h-3.5 w-3.5" />
                              Point faible: {pillarLead.label}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-4 flex items-end gap-3">
                          <div className={cn("text-4xl font-semibold leading-none tracking-tight sm:text-5xl", scoreTextClass)}>
                            {catalogueScore.globalScore}
                          </div>
                          <div className="pb-1 text-lg font-medium text-muted-foreground">/100</div>
                        </div>
                        <p className="mt-3 max-w-[17rem] text-sm leading-6 text-slate-700 sm:max-w-sm">
                          {catalogueScore?.scoreBand?.description || "Selectionne des produits pour entrer en edition"}
                        </p>
                      </div>
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center self-end rounded-full border border-white/90 bg-white/85 shadow-sm sm:h-24 sm:w-24 sm:self-auto">
                        <div className="text-center">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Score</div>
                          <div className={cn("mt-1 text-2xl font-semibold", scoreTextClass)}>{catalogueScore.globalScore}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Progress value={catalogueScore.globalScore} color={scoreTone} size="sm" />
                    </div>
                  </div>
                  {Array.isArray(catalogueScore.auditPillars) && catalogueScore.auditPillars.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {catalogueScore.auditPillars.map((pillar) => (
                        <div
                          key={pillar.key}
                          className={cn(
                            "rounded-2xl border px-3 py-3 transition-colors",
                            pillarLead?.key === pillar.key
                              ? "border-rose-200 bg-rose-50/80"
                              : "border-border/70 bg-[var(--paper-2)]"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{pillar.label}</span>
                            <span className="text-sm font-semibold text-foreground">{pillar.score}/100</span>
                          </div>
                          <Progress value={pillar.score} color={pillar.score >= 80 ? "success" : pillar.score >= 60 ? "warning" : "error"} size="sm" className="mt-2" />
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">{pillar.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {priorityActions.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          <Target className="h-4 w-4" />
                          Actions prioritaires
                        </div>
                        <span className="text-[11px] font-medium leading-5 text-muted-foreground sm:text-right">Corriger d&apos;abord les plus gros volumes</span>
                      </div>
                      <div className="space-y-2">
                        {priorityActions.map((issue, index) => (
                          <button
                            key={issue.key}
                            type="button"
                            onClick={() => issue.smartView ? applySmartView(issue.smartView) : undefined}
                            className={cn(
                              "group w-full rounded-2xl border px-3 py-3 text-left transition-colors",
                              issue.smartView ? "border-border/70 bg-white hover:border-slate-300 hover:bg-[var(--paper-2)]" : "border-border/70 bg-white"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 gap-3">
                                <div className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                                  index === 0 ? "bg-rose-100 text-rose-700" : index === 1 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
                                )}>
                                  {index + 1}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-semibold text-foreground">{issue.label}</div>
                                    {issue.smartView ? (
                                      <span className="text-[11px] font-medium text-muted-foreground">Voir la vue</span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{issue.recommendation}</p>
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white">{issue.count}</div>
                                {issue.smartView ? <ArrowRight className="ml-auto mt-3 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /> : null}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-border/70 overflow-x-hidden px-4 py-3 sm:px-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Vues rapides</div>
            {hasCatalogueContext && (
              <div className="flex flex-wrap gap-2">
                {hasSecondaryFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-full border border-border/80 bg-white px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Reinitialiser les filtres
                  </button>
                )}
                {hasViewContext && (
                  <button
                    type="button"
                    onClick={() => applySmartView("all")}
                    className="rounded-full border border-border/80 bg-white px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Revenir a Tous
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {[
              { key: "all" as SmartViewKey, label: "Tous", count: smartViewStats.all, tone: "text-foreground" },
              { key: "to_fix" as SmartViewKey, label: "A corriger", count: smartViewStats.to_fix, tone: "text-red-700" },
              { key: "to_optimize" as SmartViewKey, label: "A optimiser", count: smartViewStats.to_optimize, tone: "text-orange-700" },
              { key: "ready_google" as SmartViewKey, label: "Prets a diffuser", count: smartViewStats.ready_google, tone: "text-emerald-700" },
              { key: "google_off" as SmartViewKey, label: "Hors diffusion", count: smartViewStats.google_off, tone: "text-blue-700" },
              { key: "missing_category" as SmartViewKey, label: "Sans categorie", count: smartViewStats.missing_category, tone: "text-foreground" },
              { key: "missing_brand" as SmartViewKey, label: "Sans marque", count: smartViewStats.missing_brand, tone: "text-foreground" },
              { key: "missing_image" as SmartViewKey, label: "Sans image", count: smartViewStats.missing_image, tone: "text-foreground" },
            ].map((view) => (
              <button
                key={view.key}
                type="button"
                onClick={() => applySmartView(view.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                  activeSmartView === view.key
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-border/70 bg-white hover:bg-[var(--paper-2)]",
                  activeSmartView !== view.key && view.tone
                )}
              >
                <span>{view.label}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", activeSmartView === view.key ? "bg-white/15 text-white" : "bg-white text-foreground")}>
                    {view.count}
                  </span>
                </button>
            ))}
          </div>
        </div>

        <div className="border-b border-border/70 overflow-x-hidden px-4 py-4 sm:px-5">
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Rechercher par titre, SKU, marque..."
                className="pl-10"
              />
              {searchSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-background py-1 shadow-xl ring-1 ring-black/5">
                  <p className="px-3 py-1 text-xs text-muted-foreground">Suggestions</p>
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        const value = suggestion.replace(/\.\.\.$/, "");
                        setSearchQuery(value);
                        setDebouncedSearchQuery(value);
                        replaceBrowserUrl(value ? `${localePrefix}/catalogue?q=${encodeURIComponent(value)}` : `${localePrefix}/catalogue`);
                        searchInputRef.current?.blur();
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:max-w-full xl:justify-end">
              <div className="relative" ref={filterPanelRef}>
                <Button variant="outline" size="sm" className="w-full border-border/70 bg-white sm:w-auto" onClick={() => setShowFilterPanel((value) => !value)}>
                  <Filter className="mr-2 h-4 w-4" />
                  Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </Button>
                {showFilterPanel && (
                  <>
                    <button
                      type="button"
                      aria-label="Fermer les filtres"
                      className="fixed inset-0 z-40 bg-slate-950/25"
                      onClick={() => setShowFilterPanel(false)}
                    />
                    <div className="fixed inset-x-3 bottom-3 top-[88px] z-50 overflow-y-auto rounded-3xl border border-border bg-background p-4 shadow-2xl sm:inset-x-auto sm:right-5 sm:top-24 sm:w-[380px]">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">Filtres catalogue</div>
                          <div className="text-xs text-muted-foreground">Affinez la selection avant une action de masse.</div>
                        </div>
                        {activeFilterCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={resetFilters}>
                          Reset
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setShowFilterPanel(false)}>
                        Fermer
                      </Button>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Image</label>
                        <Select value={filterImage} onChange={(event) => setFilterImage(event.target.value as FilterImage)}>
                          <option value="all">Tous</option>
                          <option value="with">Avec image</option>
                          <option value="without">Sans image</option>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Optimisation IA</label>
                        <Select value={filterOptimized} onChange={(event) => setFilterOptimized(event.target.value as FilterOptimized)}>
                          <option value="all">Tous</option>
                          <option value="optimized">Deja optimises</option>
                          <option value="not_optimized">A optimiser</option>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Diffusion</label>
                        <Select value={filterChannel} onChange={(event) => setFilterChannel(event.target.value as FilterChannel)}>
                          <option value="all">Tous</option>
                          <option value="google_on">En diffusion</option>
                          <option value="google_off">Hors diffusion</option>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Stock</label>
                        <Select value={filterStock} onChange={(event) => setFilterStock(event.target.value as FilterStock)}>
                          <option value="all">Tous</option>
                          <option value="in_stock">En stock</option>
                          <option value="out_of_stock">Stock nul</option>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Marque</label>
                        <Select value={filterBrand} onChange={(event) => setFilterBrand(event.target.value)}>
                          <option value="all">Toutes</option>
                          {brandOptions.map((brand) => (
                            <option key={brand} value={brand}>{brand}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Categorie produit</label>
                        <Select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
                          <option value="all">Toutes</option>
                          {categoryOptions.map((category) => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Source</label>
                        <Select value={filterSource} onChange={(event) => setFilterSource(event.target.value)}>
                          <option value="all">Toutes</option>
                          {sourceOptions.map((source) => (
                            <option key={source} value={source}>{source}</option>
                          ))}
                        </Select>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={filterUpdatedRecent}
                          onChange={(event) => setFilterUpdatedRecent(event.target.checked)}
                        />
                        Mis a jour recemment
                      </label>
                    </div>
                    </div>
                  </>
                )}
              </div>

              <div className="relative" ref={columnsPanelRef}>
                <Button variant="outline" size="sm" className="w-full border-border/70 bg-white sm:w-auto" onClick={() => setShowColumnsPanel((value) => !value)}>
                  Colonnes ({visibleColumns.length})
                </Button>
                {showColumnsPanel && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,320px)] rounded-2xl border border-border bg-background p-4 shadow-2xl ring-1 ring-black/5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-foreground">Colonnes visibles</div>
                      <Button type="button" variant="ghost" size="sm" onClick={resetColumnWidths}>
                        Reset tailles
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {[
                        { key: "product" as ColumnKey, label: "Produit" },
                        { key: "status" as ColumnKey, label: "Etat" },
                        { key: "brand" as ColumnKey, label: "Marque" },
                        { key: "category" as ColumnKey, label: "Categorie" },
                        { key: "price" as ColumnKey, label: "Prix" },
                        { key: "stock" as ColumnKey, label: "Stock" },
                        { key: "channels" as ColumnKey, label: "Canaux" },
                        { key: "updated" as ColumnKey, label: "Derniere action" },
                        { key: "actions" as ColumnKey, label: "Actions" },
                      ].map((column) => (
                        <div key={column.key} className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-sm text-foreground">
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={visibleColumns.includes(column.key)}
                              onChange={() => toggleColumn(column.key)}
                            />
                            {column.label}
                          </label>
                          <div className="flex items-center gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => nudgeColumnWidth(column.key, -20)}>
                              -
                            </Button>
                            <span className="w-10 text-center text-[11px] text-muted-foreground">{columnWidths[column.key]}px</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => nudgeColumnWidth(column.key, 20)}>
                              +
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => moveColumn(column.key, "left")}>
                              ←
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => moveColumn(column.key, "right")}>
                              →
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} className="w-full sm:w-[180px]">
                <option value="date_desc">Plus recents</option>
                <option value="date_asc">Plus anciens</option>
                <option value="title_asc">Titre A a Z</option>
                <option value="title_desc">Titre Z a A</option>
                <option value="price_asc">Prix croissant</option>
                <option value="price_desc">Prix decroissant</option>
              </Select>

              <PageButtonPrimary onClick={() => hardNavigate(`${localePrefix}/sources`)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Ajouter une source
              </PageButtonPrimary>
            </div>
          </div>

        </div>

        {selectedItemIds.length > 0 && (
          <div className="border-b border-border/70 bg-[linear-gradient(180deg,#ffffff,#f7faf7)] px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 font-medium text-blue-700">
                  {selectedItemIds.length} selectionne{selectedItemIds.length > 1 ? "s" : ""}
                </span>
                {activeDistributionLabel && (
                  <span className="rounded-full border border-border bg-white px-3 py-1.5 font-medium text-foreground">
                    {activeDistributionLabel}
                  </span>
                )}
                <span className="text-muted-foreground">
                  Passe dans l&apos;editeur pour modifier proprement la selection.
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="default" onClick={openBulkGrid}>
                  Modifier
                </Button>
                <Button variant="outline" onClick={() => openBulkAiModal({ titles: true, descriptions: true })}>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Optimiser
                </Button>
                <Button variant="outline" onClick={() => void applyGoogleSelection(true)} disabled={bulkActionLoading !== null}>
                  {bulkActionLoading === "google_on" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Activer la diffusion
                </Button>
                <Button variant="ghost" onClick={clearSelection}>
                  Effacer
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && <PageError message={error} style={{ margin: 24 }} />}

        {!loading && feedsList.length > 0 && filteredItems.length === 0 && !hasCatalogueContext && totalCount === 0 && (
          <Alert className="mx-6 mt-6 border-amber-200 bg-amber-50 text-amber-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Si le catalogue reste vide apres synchro, verifie le format CSV/TSV, la ligne d&apos;en-tetes et le mapping des champs dans Sources.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="p-6">
            <PageLoading message="Chargement des produits..." />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Package}
              title={emptyStateTitle}
              description={emptyStateDescription}
              action={
                !hasSearchContext ? (
                  hasCatalogueContext ? (
                    <div className="flex gap-3">
                      {hasSecondaryFilters ? (
                        <PageButtonPrimary onClick={resetFilters}>Reinitialiser les filtres</PageButtonPrimary>
                      ) : (
                        <PageButtonPrimary onClick={() => applySmartView("all")}>Voir tous les produits</PageButtonPrimary>
                      )}
                      <PageButtonSecondary onClick={() => replaceBrowserUrl(`${localePrefix}/catalogue`)}>Revenir au catalogue</PageButtonSecondary>
                    </div>
                  ) : feedsList.length > 0 && selectedFeedId ? (
                    <div className="flex gap-3">
                      <PageButtonPrimary onClick={handleSyncFromCatalogue} disabled={syncing}>
                        {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        {syncing ? "Synchronisation..." : "Synchroniser le flux"}
                      </PageButtonPrimary>
                      <PageButtonSecondary onClick={() => hardNavigate(`${localePrefix}/sources`)}>Voir les sources</PageButtonSecondary>
                    </div>
                  ) : (
                    <PageButtonPrimary onClick={() => hardNavigate(`${localePrefix}/sources`)}>Ajouter une source</PageButtonPrimary>
                  )
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="border-b border-border px-4 py-3 sm:px-6">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {debouncedSearchQuery
                      ? `${filteredItems.length} resultats visibles sur ${totalCount} produits`
                      : `Affichage de ${filteredItems.length} produits charges sur ${totalCount} dans ce flux`}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {activeFilterCount > 0 ? `${activeFilterCount} filtre${activeFilterCount > 1 ? "s" : ""} actif${activeFilterCount > 1 ? "s" : ""}.` : "Aucun filtre secondaire actif."}
                  </div>
                  {activeContextBadges.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeContextBadges.map((badge) => (
                        <span key={badge} className="rounded-full border border-border/80 bg-muted/30 px-3 py-1 text-xs font-medium text-foreground">
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border bg-muted/20 px-3 py-1 text-xs font-medium text-foreground">
                    Vue {activeSmartView === "all" ? "Tous les produits" : activeSmartView.replaceAll("_", " ")}
                  </span>
                  <span className="rounded-full border border-border bg-muted/20 px-3 py-1 text-xs font-medium text-foreground">
                    {visibleColumns.length} colonnes
                  </span>
                </div>
              </div>
            </div>

            <div className="block space-y-3 p-4 lg:hidden">
              {filteredItems.map((item) => {
                const optimized = hasOptimizedContent(item);
                const googleEnabled = isGoogleEnabled(item);
                const category = getItemCategory(item);
                return (
                  <div key={item.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 rounded"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                      />
                      <button
                        type="button"
                        onClick={() => goToProduct(item.mpn || item.sku || item.id)}
                        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title || ""} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => goToProduct(item.mpn || item.sku || item.id)}
                          className="block max-w-full truncate text-left text-sm font-semibold text-foreground"
                        >
                          {item.title || "Sans titre"}
                        </button>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", optimized ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
                            {optimized ? "Optimise IA" : "A optimiser"}
                          </span>
                          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", googleEnabled ? "bg-blue-100 text-blue-800" : "bg-zinc-200 text-zinc-700")}>
                            {googleEnabled ? "En diffusion" : "Hors diffusion"}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {item.brand && <div>Marque: <strong className="text-foreground">{item.brand}</strong></div>}
                          {category && <div>Categorie: <strong className="text-foreground">{category}</strong></div>}
                          <div>Prix: <strong className="text-foreground">{item.price != null ? `${Number(item.price).toFixed(2)} ${item.currency || "EUR"}` : "Non renseigne"}</strong></div>
                          <div>Stock: <strong className="text-foreground">{item.inventory != null ? item.inventory : "N/A"}</strong></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden p-4 lg:block">
              <div className="max-w-full overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm">
                <div className={cn(
                  "border-b border-border px-4 py-3 transition-colors",
                  selectedItemIds.length > 0 ? "bg-blue-50/70" : "bg-muted/20"
                )}>
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" className="mt-1 rounded" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {selectedItemIds.length > 0
                            ? `${selectedItemIds.length} produit${selectedItemIds.length > 1 ? "s" : ""} selectionne${selectedItemIds.length > 1 ? "s" : ""}`
                            : "Selection par lot"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {selectedItemIds.length > 0
                            ? `${selectedOptimizedCount} deja optimises, ${selectedGoogleOffCount} hors diffusion, ${visibleSelectedCount} visibles dans la vue courante.`
                            : "Coche des lignes pour activer les actions bulk directement dans la table."}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant={selectedItemIds.length > 0 ? "secondary" : "outline"} size="sm" onClick={openBulkGrid} disabled={selectedItemIds.length === 0}>
                        Modifier
                      </Button>
                      <Button variant={selectedItemIds.length > 0 ? "secondary" : "outline"} size="sm" onClick={() => openBulkAiModal({ titles: true, descriptions: true })} disabled={selectedItemIds.length === 0}>
                        Optimiser IA
                      </Button>
                      <Button variant={selectedItemIds.length > 0 ? "secondary" : "outline"} size="sm" onClick={() => void applyGoogleSelection(true)} disabled={selectedItemIds.length === 0 || bulkActionLoading !== null}>
                        Activer la diffusion
                      </Button>
                      {selectedItemIds.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={clearSelection}>
                          Effacer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="max-w-full overflow-x-auto overflow-y-hidden">
              <table className="min-w-full border-collapse">
                <colgroup>
                  <col style={{ width: 48 }} />
                  {visibleColumns.includes("product") && <col style={{ width: columnWidths.product }} />}
                  {visibleColumns.includes("status") && <col style={{ width: columnWidths.status }} />}
                  {visibleColumns.includes("brand") && <col style={{ width: columnWidths.brand }} />}
                  {visibleColumns.includes("category") && <col style={{ width: columnWidths.category }} />}
                  {visibleColumns.includes("price") && <col style={{ width: columnWidths.price }} />}
                  {visibleColumns.includes("stock") && <col style={{ width: columnWidths.stock }} />}
                  {visibleColumns.includes("channels") && <col style={{ width: columnWidths.channels }} />}
                  {visibleColumns.includes("updated") && <col style={{ width: columnWidths.updated }} />}
                  {visibleColumns.includes("actions") && <col style={{ width: columnWidths.actions }} />}
                </colgroup>
                <thead className="sticky top-0 z-10 bg-background">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-12 px-3 py-3"></th>
                    {visibleColumns.includes("product") && (
                      <th className="group relative px-3 py-3">
                        <div className="flex items-start justify-between gap-2 pr-4">
                          <div>Produit</div>
                          <div className="relative" ref={openColumnMenu === "product" ? columnMenuRef : undefined}>
                            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 opacity-0 transition-opacity group-hover:opacity-100" onClick={() => setOpenColumnMenu((current) => current === "product" ? null : "product")}>
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                            {openColumnMenu === "product" && (
                              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-border bg-background p-1 shadow-xl">
                                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => setSortFromColumn("product", "asc")}>Trier A vers Z</button>
                                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => setSortFromColumn("product", "desc")}>Trier Z vers A</button>
                                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => nudgeColumnWidth("product", 40)}>Elargir</button>
                                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => nudgeColumnWidth("product", -40)}>Compacter</button>
                                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={() => hideColumnAndClose("product")}>Masquer</button>
                              </div>
                            )}
                          </div>
                        </div>
                        <button type="button" aria-label="Redimensionner colonne produit" className="absolute inset-y-0 right-0 w-2 cursor-col-resize opacity-0 transition-opacity group-hover:opacity-100" onMouseDown={(event) => startColumnResize("product", event)} />
                      </th>
                    )}
                    {visibleColumns.includes("status") && (
                      <th className="group relative px-3 py-3">
                        <div className="pr-4">Signal</div>
                        <button type="button" aria-label="Redimensionner colonne signal" className="absolute inset-y-0 right-0 w-2 cursor-col-resize opacity-0 transition-opacity group-hover:opacity-100" onMouseDown={(event) => startColumnResize("status", event)} />
                      </th>
                    )}
                    {visibleColumns.includes("brand") && (
                      <th className="group relative px-3 py-3">
                        <div className="pr-4">Marque</div>
                        <button type="button" aria-label="Redimensionner colonne marque" className="absolute inset-y-0 right-0 w-2 cursor-col-resize opacity-0 transition-opacity group-hover:opacity-100" onMouseDown={(event) => startColumnResize("brand", event)} />
                      </th>
                    )}
                    {visibleColumns.includes("category") && (
                      <th className="group relative px-3 py-3">
                        <div className="pr-4">Categorie</div>
                        <button type="button" aria-label="Redimensionner colonne categorie" className="absolute inset-y-0 right-0 w-2 cursor-col-resize opacity-0 transition-opacity group-hover:opacity-100" onMouseDown={(event) => startColumnResize("category", event)} />
                      </th>
                    )}
                    {visibleColumns.includes("price") && (
                      <th className="group relative px-3 py-3">
                        <div className="flex items-start justify-between gap-2 pr-4">
                          <div>Prix</div>
                          <div className="relative" ref={openColumnMenu === "price" ? columnMenuRef : undefined}>
                            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 opacity-0 transition-opacity group-hover:opacity-100" onClick={() => setOpenColumnMenu((current) => current === "price" ? null : "price")}>
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                            {openColumnMenu === "price" && (
                              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-border bg-background p-1 shadow-xl">
                                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => setSortFromColumn("price", "asc")}>Trier croissant</button>
                                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => setSortFromColumn("price", "desc")}>Trier decroissant</button>
                                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => nudgeColumnWidth("price", 40)}>Elargir</button>
                                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={() => hideColumnAndClose("price")}>Masquer</button>
                              </div>
                            )}
                          </div>
                        </div>
                        <button type="button" aria-label="Redimensionner colonne prix" className="absolute inset-y-0 right-0 w-2 cursor-col-resize opacity-0 transition-opacity group-hover:opacity-100" onMouseDown={(event) => startColumnResize("price", event)} />
                      </th>
                    )}
                    {visibleColumns.includes("stock") && (
                      <th className="group relative px-3 py-3">
                        <div className="pr-4">Stock</div>
                        <button type="button" aria-label="Redimensionner colonne stock" className="absolute inset-y-0 right-0 w-2 cursor-col-resize opacity-0 transition-opacity group-hover:opacity-100" onMouseDown={(event) => startColumnResize("stock", event)} />
                      </th>
                    )}
                    {visibleColumns.includes("channels") && (
                      <th className="group relative px-3 py-3">
                        <div className="pr-4">Diffusion</div>
                        <button type="button" aria-label="Redimensionner colonne canaux" className="absolute inset-y-0 right-0 w-2 cursor-col-resize opacity-0 transition-opacity group-hover:opacity-100" onMouseDown={(event) => startColumnResize("channels", event)} />
                      </th>
                    )}
                    {visibleColumns.includes("updated") && (
                      <th className="group relative px-3 py-3">
                        <div className="flex items-start justify-between gap-2 pr-4">
                          <div>Derniere action</div>
                          <div className="relative" ref={openColumnMenu === "updated" ? columnMenuRef : undefined}>
                            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 opacity-0 transition-opacity group-hover:opacity-100" onClick={() => setOpenColumnMenu((current) => current === "updated" ? null : "updated")}>
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                            {openColumnMenu === "updated" && (
                              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-border bg-background p-1 shadow-xl">
                                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => setSortFromColumn("updated", "desc")}>Plus recent d&apos;abord</button>
                                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => setSortFromColumn("updated", "asc")}>Plus ancien d&apos;abord</button>
                                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={() => hideColumnAndClose("updated")}>Masquer</button>
                              </div>
                            )}
                          </div>
                        </div>
                        <button type="button" aria-label="Redimensionner colonne derniere action" className="absolute inset-y-0 right-0 w-2 cursor-col-resize opacity-0 transition-opacity group-hover:opacity-100" onMouseDown={(event) => startColumnResize("updated", event)} />
                      </th>
                    )}
                    {visibleColumns.includes("actions") && (
                      <th className="group relative px-3 py-3 text-right">
                        <div className="pr-4">Actions</div>
                        <button type="button" aria-label="Redimensionner colonne actions" className="absolute inset-y-0 right-0 w-2 cursor-col-resize opacity-0 transition-opacity group-hover:opacity-100" onMouseDown={(event) => startColumnResize("actions", event)} />
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const optimized = hasOptimizedContent(item);
                    const googleEnabled = isGoogleEnabled(item);
                    const rowDirty = false;
                    const hasImage = Boolean(item.imageUrl);
                    const statusTone = rowDirty
                      ? "bg-amber-100 text-amber-900"
                      : !optimized
                        ? "bg-orange-100 text-orange-800"
                        : !googleEnabled
                          ? "bg-blue-100 text-blue-800"
                          : "bg-emerald-100 text-emerald-800";
                    const statusLabel = rowDirty
                      ? "Modifie"
                      : !optimized
                        ? "A optimiser"
                        : !googleEnabled
                          ? "Hors diffusion"
                          : "Diffuse";
                    return (
                      <tr key={item.id} className={cn("border-b border-border/70 bg-background transition-colors hover:bg-muted/20", rowDirty && "bg-amber-50/40")}>
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={selectedItemIds.includes(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                          />
                        </td>
                        {visibleColumns.includes("product") && (
                          <td className="px-3 py-3">
                            <div className="flex min-w-[280px] items-start gap-3">
                              <button
                                type="button"
                                onClick={() => goToProduct(item.mpn || item.sku || item.id)}
                                className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted"
                              >
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.title || ""} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <Package className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                )}
                              </button>
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => goToProduct(item.mpn || item.sku || item.id)}
                                  className="text-left text-sm font-semibold text-foreground hover:underline"
                                >
                                  {item.title || "Sans titre"}
                                </button>
                                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                  {item.sku && <span>{item.sku}</span>}
                                  {item.brand && <span>{item.brand}</span>}
                                  <span>{item.feed.name}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        )}
                        {visibleColumns.includes("status") && (
                          <td className="px-3 py-3 align-top">
                            <div className="flex min-w-[140px] flex-wrap gap-2">
                              <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", statusTone)}>
                                {statusLabel}
                              </span>
                              <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", hasImage ? "bg-slate-100 text-slate-700" : "bg-red-100 text-red-700")}>
                                {hasImage ? "Image OK" : "Sans image"}
                              </span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.includes("brand") && (
                          <td className="px-3 py-3 align-top text-sm text-foreground">
                            {item.brand || <span className="text-muted-foreground">A completer</span>}
                          </td>
                        )}
                        {visibleColumns.includes("category") && (
                          <td className="px-3 py-3 align-top text-sm text-foreground">
                            {getItemCategory(item) || <span className="text-muted-foreground">A completer</span>}
                          </td>
                        )}
                        {visibleColumns.includes("price") && (
                          <td className="px-3 py-3 align-top text-sm text-foreground">
                            {item.price != null ? `${Number(item.price).toFixed(2)} ${item.currency || "EUR"}` : "Non renseigne"}
                          </td>
                        )}
                        {visibleColumns.includes("stock") && (
                          <td className="px-3 py-3 align-top text-sm text-foreground">
                            {item.inventory != null ? item.inventory : "N/A"}
                          </td>
                        )}
                        {visibleColumns.includes("channels") && (
                          <td className="px-3 py-3 align-top">
                            <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm", googleEnabled ? "bg-blue-50 text-blue-800" : "bg-zinc-100 text-zinc-700")}>
                              {googleEnabled ? "En diffusion" : "Hors diffusion"}
                            </span>
                          </td>
                        )}
                        {visibleColumns.includes("updated") && (
                          <td className="px-3 py-3 align-top text-sm text-muted-foreground">
                            {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("fr-FR") : "-"}
                          </td>
                        )}
                        {visibleColumns.includes("actions") && (
                          <td className="px-3 py-3 align-top text-right">
                            <div className="flex justify-end gap-1.5">
                              {item.url && (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                              <Button variant="outline" size="sm" className="h-8" onClick={() => {
                                setSelectedItemIds([item.id]);
                                openBulkGridForItems([item]);
                              }}>
                                Modifier
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8" onClick={() => goToProduct(item.mpn || item.sku || item.id)}>
                                Ouvrir
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
                </div>
              </div>
            </div>

            {hasMoreItems && (
              <div className="flex justify-center border-t border-border px-6 py-4">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {loadingMore ? "Chargement..." : `Charger plus (${items.length} / ${totalCount})`}
                </Button>
              </div>
            )}
          </>
        )}
      </PageCard>

      <Dialog open={showBulkAiModal} onOpenChange={setShowBulkAiModal}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Optimisation IA en masse</DialogTitle>
            <DialogDescription>
              Applique une optimisation IA sur la selection courante, un peu comme un bulk action editor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="text-sm font-medium text-foreground">
                {selectedItemIds.length} produit{selectedItemIds.length > 1 ? "s" : ""} seront traites
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {activeDistributionLabel
                  ? `La sauvegarde ecrit directement dans ${activeDistributionLabel} sans toucher aux autres marches.`
                  : "La sauvegarde ecrit directement dans le catalogue FeedPlug et alimente les optimisations par plateforme."}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Plateforme cible</label>
              <Select value={bulkAiPlatform} onChange={(event) => setBulkAiPlatform(event.target.value as BulkPlatform)} disabled={Boolean(selectedDestinationOption) || bulkActionLoading === "ai"}>
                <option value="gmc">Google Merchant Center</option>
                <option value="meta">Meta</option>
                <option value="amazon">Amazon</option>
                <option value="chatgpt">ChatGPT / LLM</option>
              </Select>
              {activeDistributionLabel && (
                <p className="mt-2 text-xs text-muted-foreground">
                  La destination choisie impose cette plateforme: {activeDistributionLabel}.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Marché de destination</label>
              <Select
                value={selectedDestinationOption ? selectedDestinationOption.marketCode : bulkMarketCode}
                onChange={(event) => setBulkMarketCode(event.target.value)}
                disabled={Boolean(selectedDestinationOption) || bulkActionLoading === "ai" || bulkMarketOptions.length === 0}
              >
                <option value="">Marché source (langue d&apos;origine)</option>
                {bulkMarketOptions.map((option) => (
                  <option key={option.marketCode} value={option.marketCode}>{option.label}</option>
                ))}
              </Select>
              {selectedDestinationOption ? (
                <p className="mt-2 text-xs text-muted-foreground">Marché imposé par la destination choisie.</p>
              ) : bulkMarketOptions.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Aucun marché activé pour cette plateforme — optimisation dans la langue source.</p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Le contenu IA est généré dans la langue du marché choisi.</p>
              )}
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input type="checkbox" className="rounded" checked={bulkOptimizeTitles} disabled={bulkActionLoading === "ai"} onChange={(event) => setBulkOptimizeTitles(event.target.checked)} />
                Optimiser les titres
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input type="checkbox" className="rounded" checked={bulkOptimizeDescriptions} disabled={bulkActionLoading === "ai"} onChange={(event) => setBulkOptimizeDescriptions(event.target.checked)} />
                Optimiser les descriptions
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input type="checkbox" className="rounded" checked={bulkOptimizeHighlights} disabled={bulkActionLoading === "ai"} onChange={(event) => setBulkOptimizeHighlights(event.target.checked)} />
                Generer les product highlights
              </label>
            </div>

            {bulkActionLoading === "ai" && bulkProgress && (
              <div className="space-y-1.5 rounded-xl border border-border bg-muted/20 p-4">
                <Progress
                  value={Math.round((bulkProgress.done / Math.max(1, bulkProgress.total)) * 100)}
                  size="sm"
                />
                <div className="text-xs text-muted-foreground">
                  Optimisation en cours… {bulkProgress.done} / {bulkProgress.total} produit{bulkProgress.total > 1 ? "s" : ""} traité{bulkProgress.done > 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBulkAiModal(false)} disabled={bulkActionLoading === "ai"}>
              Annuler
            </Button>
            <Button onClick={() => void runBulkOptimization()} disabled={bulkActionLoading === "ai"}>
              {bulkActionLoading === "ai" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Lancer l&apos;optimisation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkGridModal} onOpenChange={setShowBulkGridModal}>
        <DialogContent className="h-[94vh] w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] overflow-hidden p-0 sm:max-w-[96vw]">
          <div className="flex h-full flex-col">
            <DialogHeader className="border-b border-border px-6 py-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <DialogTitle>Editeur catalogue</DialogTitle>
                  <DialogDescription className="mt-1">
                    Selectionne, modifie, recopie, puis enregistre.
                  </DialogDescription>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>{bulkGridRows.length} ligne{bulkGridRows.length > 1 ? "s" : ""}</span>
                    <span>{dirtyGridRowCount} modifiee{dirtyGridRowCount > 1 ? "s" : ""}</span>
                    <span>{gridSelectionSummary}</span>
                    <span>{bulkAiPlatform.toUpperCase()}</span>
                    {activeDistributionLabel ? <span>{activeDistributionLabel}</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={bulkAiPlatform} onChange={(event) => setBulkAiPlatform(event.target.value as BulkPlatform)} className="min-w-[210px]" disabled={Boolean(selectedDestinationOption)}>
                    <option value="gmc">Google Merchant Center</option>
                    <option value="meta">Meta</option>
                    <option value="amazon">Amazon</option>
                    <option value="chatgpt">ChatGPT / LLM</option>
                  </Select>
                  <Button variant="outline" onClick={undoGridChanges} disabled={bulkGridHistory.length === 0}>
                    Undo
                  </Button>
                  <Button variant="outline" onClick={resetGridToSource}>
                    Reinitialiser
                  </Button>
                  <Button onClick={() => void saveBulkGrid()} disabled={bulkActionLoading === "grid_save"}>
                    {bulkActionLoading === "grid_save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Enregistrer
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-hidden">
              <div className="flex h-full min-h-0 min-w-0 flex-col">
                <div className="border-b border-border bg-muted/5 px-6 py-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="text-sm text-muted-foreground">
                        Choisis les colonnes utiles, clique une cellule, edite la valeur puis enregistre.
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="relative" ref={gridColumnsPanelRef}>
                          <Button variant="outline" onClick={() => setShowGridColumnsPanel((value) => !value)}>
                            Colonnes ({9 + gridAttributeColumns.length})
                          </Button>
                          {showGridColumnsPanel && (
                            <div className="absolute left-0 top-full z-30 mt-2 w-[min(92vw,340px)] rounded-2xl border border-border bg-background p-4 shadow-2xl ring-1 ring-black/5">
                              <div className="mb-3 text-sm font-semibold text-foreground">Colonnes de la grille</div>
                              <div className="grid max-h-72 gap-2 overflow-auto">
                                {attributeColumnOptions.map((field) => (
                                  <label key={field.key} className="flex items-center gap-2 text-sm text-foreground">
                                    <input
                                      type="checkbox"
                                      className="rounded"
                                      checked={gridAttributeColumns.includes(field.key)}
                                      onChange={() => toggleGridAttributeColumn(field.key)}
                                    />
                                    {getFieldLabel(field.key)}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <Button variant="outline" onClick={() => fillGridFromOptimized("title")}>
                          Titres IA
                        </Button>
                        <Button variant="outline" onClick={() => fillGridFromOptimized("description")}>
                          Descriptions IA
                        </Button>
                        <Button variant="outline" onClick={() => fillGridFromOptimized("highlights")}>
                          Highlights IA
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_auto_auto] xl:items-center">
                      <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Cellule active</div>
                        <div className="mt-1 font-medium text-foreground">
                          {activeGridCell ? getGridFieldLabel(activeGridCell.field) : "Aucune selection"}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {activeGridItem ? activeGridItem.title || activeGridItem.sku || activeGridItem.id : "Clique une cellule"}
                        </div>
                      </div>
                      <Input
                        value={activeGridCell ? getGridCellStringValue(activeGridCell.itemId, activeGridCell.field) : ""}
                        onChange={(event) => {
                          if (!activeGridCell) return;
                          applyGridCellValue(activeGridCell.itemId, activeGridCell.field, event.target.value);
                        }}
                        placeholder="Clique une cellule pour modifier sa valeur ici."
                        disabled={!activeGridCell}
                        className="h-11 bg-background text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Select value={gridCopyField} onChange={(event) => setGridCopyField(event.target.value as keyof BulkGridDraft)} className="min-w-[170px]">
                          <option value="title">Titre publie</option>
                          <option value="brand">Marque</option>
                          <option value="google_product_category">Categorie Google</option>
                          <option value="product_type">Type produit</option>
                          <option value="availability">Disponibilite</option>
                          <option value="optimized_title">Titre optimise</option>
                          <option value="optimized_description">Description optimisee</option>
                          <option value="optimized_highlights">Highlights</option>
                          <option value="googleEnabled">{activeDistributionLabel ? "Diffusion on/off" : "Google on/off"}</option>
                        </Select>
                        <Button variant="outline" onClick={applyGridValueToSelection}>
                          Copier
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground xl:text-right">
                        Tab pour naviguer. Glisse pour recopier. Ctrl/Cmd+C pour copier.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-none" onCopy={handleGridCopy}>
              <table className="w-max min-w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_theme(colors.border)]">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="sticky left-0 z-20 border-r border-border bg-background px-3 py-3">Produit</th>
                    <th className="px-3 py-3">Titre publie</th>
                    <th className="px-3 py-3">Marque</th>
                    <th className="px-3 py-3">Categorie Google</th>
                    <th className="px-3 py-3">Type produit</th>
                    <th className="px-3 py-3">Disponibilite</th>
                    <th className="px-3 py-3">Titre optimise</th>
                    <th className="px-3 py-3">Description optimisee</th>
                    <th className="px-3 py-3">Highlights</th>
                    {gridAttributeColumns.map((field) => (
                      <th key={field} className="px-3 py-3">{getFieldLabel(field)}</th>
                    ))}
                    <th className="px-3 py-3">{activeDistributionLabel ? "Diffusion" : "Google"}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item) => {
                    const draft = bulkGridDrafts[item.id] ?? createBulkGridDraft(item, bulkAiPlatform);
                    const dirtyFields: Record<keyof BulkGridDraft, boolean> = {
                      id: false,
                      title: isGridCellDirty(item, "title"),
                      brand: isGridCellDirty(item, "brand"),
                      google_product_category: isGridCellDirty(item, "google_product_category"),
                      product_type: isGridCellDirty(item, "product_type"),
                      availability: isGridCellDirty(item, "availability"),
                      optimized_title: isGridCellDirty(item, "optimized_title"),
                      optimized_description: isGridCellDirty(item, "optimized_description"),
                      optimized_highlights: isGridCellDirty(item, "optimized_highlights"),
                      googleEnabled: isGridCellDirty(item, "googleEnabled"),
                    };
                    const attributeValues = Object.fromEntries(
                      gridAttributeColumns.map((field) => [field, bulkGridAttributeDrafts[item.id]?.[field] ?? getAttributeValue(item, field)])
                    );
                    const attributeDirty = Object.fromEntries(
                      gridAttributeColumns.map((field) => [field, isGridAttributeDirty(item, field)])
                    ) as Record<string, boolean>;
                    return (
                      <BulkGridRow
                        key={item.id}
                        item={item}
                        productHref={`${localePrefix}/catalogue/${item.mpn || item.sku || item.id}`}
                        draft={draft}
                        dirtyFields={dirtyFields}
                        attributeColumns={gridAttributeColumns}
                        attributeValues={attributeValues}
                        attributeDirty={attributeDirty}
                        onDraftChange={updateBulkGridDraft}
                        onAttributeChange={updateGridAttributeDraft}
                        isCellSelected={isGridCellSelected}
                        isActiveCell={isActiveGridCell}
                        onCellActivate={activateGridCell}
                        onCellKeyDown={handleGridCellKeyDown}
                        onCellHover={handleGridCellHover}
                        onCellPaste={handleGridCellPaste}
                        registerCellRef={registerGridCellRef}
                        onPrepareProductNavigation={prepareProductNavigation}
                        onFillDown={fillDownFromGridCell}
                        isDragFillPreviewCell={isDragFillPreviewCell}
                        onFillHandleMouseDown={handleFillHandleMouseDown}
                        hasActiveSelectionOnRow={isGridCellSelected(item.id, "title") || isGridCellSelected(item.id, "brand") || isGridCellSelected(item.id, "google_product_category") || isGridCellSelected(item.id, "product_type") || isGridCellSelected(item.id, "availability") || isGridCellSelected(item.id, "optimized_title") || isGridCellSelected(item.id, "optimized_description") || isGridCellSelected(item.id, "optimized_highlights") || isGridCellSelected(item.id, "googleEnabled")}
                      />
                    );
                  })}
                </tbody>
              </table>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-border bg-background px-6 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2 text-sm">
                {visibleGridSummary.map((entry) => (
                  <span key={entry.label} className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                    {entry.label}: {entry.value}
                  </span>
                ))}
                {visibleGridAttributeSummary.map((entry) => (
                  <span key={entry.field} className="rounded-full bg-blue-100 px-3 py-1 text-blue-900">
                    {entry.label}: {entry.value}
                  </span>
                ))}
                {visibleGridSummary.length === 0 && visibleGridAttributeSummary.length === 0 && (
                  <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">Aucun changement</span>
                )}
              </div>
              <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBulkGridModal(false)} disabled={bulkActionLoading === "grid_save"}>
                Retour au catalogue
              </Button>
              <Button onClick={() => void saveBulkGrid()} disabled={bulkActionLoading === "grid_save"}>
                {bulkActionLoading === "grid_save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Enregistrer la grille
              </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkEditModal} onOpenChange={setShowBulkEditModal}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Studio d&apos;edition en masse</DialogTitle>
            <DialogDescription>
              Appliquez une valeur commune ou une couche optimisee a la selection, comme un vrai bulk editor marchand.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="text-sm font-medium text-foreground">
                {selectedItemIds.length} produit{selectedItemIds.length > 1 ? "s" : ""} dans la selection
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{bulkEditPreview}</div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Champ a editer</label>
                <Select value={bulkEditField} onChange={(event) => setBulkEditField(event.target.value as BulkEditField)}>
                  <option value="google_product_category">Categorie Google</option>
                  <option value="product_type">Type produit</option>
                  <option value="brand">Marque</option>
                  <option value="availability">Disponibilite</option>
                  <option value="optimized_title">Titre optimise</option>
                  <option value="optimized_description">Description optimisee</option>
                  <option value="optimized_highlights">Product highlights</option>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Mode d&apos;application</label>
                <Select value={bulkApplyMode} onChange={(event) => setBulkApplyMode(event.target.value as BulkApplyMode)}>
                  <option value="only_empty">Seulement les champs vides</option>
                  <option value="replace_all">Remplacer toute la selection</option>
                </Select>
              </div>
            </div>

            {(bulkEditField === "optimized_title" || bulkEditField === "optimized_description" || bulkEditField === "optimized_highlights") && (
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Plateforme cible</label>
                <Select value={bulkAiPlatform} onChange={(event) => setBulkAiPlatform(event.target.value as BulkPlatform)} disabled={Boolean(selectedDestinationOption)}>
                  <option value="gmc">Google Merchant Center</option>
                  <option value="meta">Meta</option>
                  <option value="amazon">Amazon</option>
                  <option value="chatgpt">ChatGPT / LLM</option>
                </Select>
                {activeDistributionLabel ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Edition ciblee sur {activeDistributionLabel}.
                  </p>
                ) : null}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                {bulkEditField === "optimized_highlights" ? "Valeur a appliquer (une ligne = un highlight)" : "Valeur a appliquer"}
              </label>
              {bulkEditField === "optimized_description" || bulkEditField === "optimized_highlights" ? (
                <Textarea
                  value={bulkEditValue}
                  onChange={(event) => setBulkEditValue(event.target.value)}
                  className="min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder={
                    bulkEditField === "optimized_highlights"
                      ? "Point fort 1\nPoint fort 2\nPoint fort 3"
                      : "Saisissez la description optimisee a appliquer sur la selection"
                  }
                />
              ) : (
                <Input
                  value={bulkEditValue}
                  onChange={(event) => setBulkEditValue(event.target.value)}
                  placeholder="Saisissez la valeur a appliquer"
                />
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBulkEditModal(false)} disabled={bulkActionLoading === "bulk_edit"}>
              Annuler
            </Button>
            <Button onClick={() => void runBulkEdit()} disabled={bulkActionLoading === "bulk_edit"}>
              {bulkActionLoading === "bulk_edit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Appliquer les changements
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEnrichmentModal}
        onOpenChange={(open) => {
          setShowEnrichmentModal(open);
          if (!open) {
            resetEnrichmentModalState();
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Enrichissement automatique du catalogue</DialogTitle>
            <DialogDescription>Complete les champs manquants du flux actif avant de retravailler les fiches une par une.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <label className="flex items-center gap-3 text-sm text-foreground">
              <input type="checkbox" className="rounded" checked={useAI} onChange={(event) => setUseAI(event.target.checked)} />
              Utiliser l&apos;IA pour les champs complexes
            </label>
            <p className="text-sm text-muted-foreground">
              Ce mode sert a completer les attributs marchands. Pour retravailler les titres et descriptions, utilise plutot la barre d&apos;actions de la selection.
            </p>

            {enriching && (
              <Alert>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <AlertDescription>Enrichissement en cours. Cela peut prendre quelques minutes.</AlertDescription>
              </Alert>
            )}

            {enrichmentFeedback && (
              <Alert
                className={
                  enrichmentFeedback.type === "success"
                    ? "border-green-200 bg-green-50 text-green-800"
                    : enrichmentFeedback.type === "error"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-blue-200 bg-blue-50 text-blue-800"
                }
              >
                {enrichmentFeedback.type === "success" ? (
                  <CheckCircle className="mr-2 h-4 w-4" />
                ) : enrichmentFeedback.type === "error" ? (
                  <AlertCircle className="mr-2 h-4 w-4" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                <AlertDescription>
                  <span className="block font-semibold">{enrichmentFeedback.title}</span>
                  <span className="mt-1 block">{enrichmentFeedback.description}</span>
                </AlertDescription>
              </Alert>
            )}

            {enrichmentResult && (
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <AlertDescription>
                  {enrichmentResult.totalItems > 0 ? `${enrichmentResult.totalItems} produits analyses. ` : ""}
                  {enrichmentResult.enriched} produits enrichis, {enrichmentResult.fieldsEnriched} champs completes, {enrichmentResult.alertsCount} alertes generees.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowEnrichmentModal(false);
                resetEnrichmentModalState();
              }}
              disabled={enriching}
            >
              {enrichmentFeedback ? "Fermer" : "Annuler"}
            </Button>
            <Button onClick={() => void handleBulkEnrichment()} disabled={enriching || !selectedFeedId}>
              {enriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {enrichmentFeedback ? "Relancer l'enrichissement" : "Lancer l'enrichissement"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
