/**
 * Helpers de formatage partagés (sans dépendance UI framework).
 *
 * Utilisés par les UIs dashboard standalone (shadcn) ET embedded (Polaris).
 * Une seule implémentation = pas de divergence d'affichage entre les deux
 * contextes (un merchant voit la même date "5 juin 2026" peu importe où il est).
 */

const DEFAULT_LOCALE = "fr-FR";

export function formatPrice(
  value: number | null | undefined,
  currency: string | null | undefined = "EUR",
  locale: string = DEFAULT_LOCALE
): string {
  if (value == null || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${Number(value).toFixed(2)} ${currency || ""}`.trim();
  }
}

/** Variante compacte pour les tuiles stat (1 234 € au lieu de 1 234,00 €) */
export function formatPriceCompact(
  value: number | null | undefined,
  currency: string | null | undefined = "EUR",
  locale: string = DEFAULT_LOCALE
): string {
  if (value == null || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(Number(value))} ${currency || ""}`.trim();
  }
}

export function formatNumber(
  value: number | null | undefined,
  locale: string = DEFAULT_LOCALE
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale).format(value);
}

export function formatDateTime(
  value: string | null | undefined,
  locale: string = DEFAULT_LOCALE
): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDateShort(
  value: string | null | undefined,
  locale: string = DEFAULT_LOCALE
): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * ROAS : Return on Ad Spend. > 1 = rentable, < 1 = perd de l'argent.
 * Affichage en pourcentage pour l'embedded (convention business).
 */
export function formatRoas(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

/**
 * Mappe un status feed/source/sub vers le tone Polaris correspondant.
 * Réutilisable par toute UI qui affiche un Badge — l'embedded utilise
 * directement le tone Polaris, le dashboard standalone peut le mapper vers
 * une couleur shadcn.
 */
export type StatusTone = "success" | "warning" | "critical" | "info";

export function statusToTone(status: string | null | undefined): StatusTone {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE" || s === "OK" || s === "SUCCESS") return "success";
  if (s === "PENDING" || s === "RUNNING" || s === "PROCESSING") return "info";
  if (s === "INACTIVE" || s === "PAUSED" || s === "FROZEN" || s === "WARNING") return "warning";
  if (s === "ERROR" || s === "FAILED" || s === "CANCELLED" || s === "EXPIRED" || s === "DECLINED") return "critical";
  return "info";
}

/**
 * Libellé humain pour un canal d'export.
 * Source de vérité : à compléter au fur et à mesure des canaux supportés.
 */
const CHANNEL_LABELS: Record<string, string> = {
  GMC: "Google Shopping",
  GOOGLE_SHOPPING: "Google Shopping",
  GOOGLE_ADS: "Google Ads",
  BING: "Microsoft Bing",
  AMAZON: "Amazon",
  META: "Meta Ads",
  META_ADS: "Meta Ads",
  TIKTOK: "TikTok",
  SHOPIFY: "Shopify",
};

export function channelLabel(channel: string | null | undefined): string {
  if (!channel) return "—";
  const upper = String(channel).toUpperCase();
  return CHANNEL_LABELS[upper] || channel;
}
