export type ChannelDeliveryMode = "push" | "export" | "both";
export type ChannelFamily =
  | "shopping"
  | "marketplace"
  | "social"
  | "search"
  | "international"
  | "ai";

export interface SupportedChannel {
  key: string;
  label: string;
  family: ChannelFamily;
  delivery: ChannelDeliveryMode;
  description: string;
}

export const SUPPORTED_CHANNELS: SupportedChannel[] = [
  {
    key: "gmc",
    label: "Google Merchant Center",
    family: "shopping",
    delivery: "both",
    description: "Push direct et export CSV pour Google Shopping.",
  },
  {
    key: "amazon_fr",
    label: "Amazon FR",
    family: "marketplace",
    delivery: "both",
    description: "Export et push vendeur vers Amazon France.",
  },
  {
    key: "amazon_uk",
    label: "Amazon UK",
    family: "marketplace",
    delivery: "both",
    description: "Export et push vendeur vers Amazon Royaume-Uni.",
  },
  {
    key: "amazon_de",
    label: "Amazon DE",
    family: "marketplace",
    delivery: "both",
    description: "Export et push vendeur vers Amazon Allemagne.",
  },
  {
    key: "amazon_it",
    label: "Amazon IT",
    family: "marketplace",
    delivery: "both",
    description: "Export et push vendeur vers Amazon Italie.",
  },
  {
    key: "amazon_es",
    label: "Amazon ES",
    family: "marketplace",
    delivery: "both",
    description: "Export et push vendeur vers Amazon Espagne.",
  },
  {
    key: "meta",
    label: "Meta",
    family: "social",
    delivery: "export",
    description: "Export catalogue pour Meta Ads et Commerce.",
  },
  {
    key: "bing",
    label: "Microsoft Merchant Center",
    family: "search",
    delivery: "export",
    description: "Export catalogue pour Bing et Microsoft Shopping.",
  },
  {
    key: "pinterest",
    label: "Pinterest",
    family: "social",
    delivery: "export",
    description: "Export catalogue pour Pinterest Shopping.",
  },
  {
    key: "tiktok",
    label: "TikTok Shop",
    family: "social",
    delivery: "export",
    description: "Export produit pour TikTok Shop.",
  },
  {
    key: "snapchat",
    label: "Snapchat",
    family: "social",
    delivery: "export",
    description: "Export catalogue pour Snapchat Ads.",
  },
  {
    key: "cdiscount",
    label: "Cdiscount",
    family: "marketplace",
    delivery: "export",
    description: "Export CSV pour Cdiscount Marketplace.",
  },
  {
    key: "rakuten",
    label: "Rakuten",
    family: "marketplace",
    delivery: "export",
    description: "Export CSV pour Rakuten.",
  },
  {
    key: "yandex",
    label: "Yandex Market",
    family: "international",
    delivery: "export",
    description: "Export catalogue pour Yandex Market.",
  },
  {
    key: "baidu",
    label: "Baidu",
    family: "international",
    delivery: "export",
    description: "Export catalogue pour Baidu.",
  },
  {
    key: "chatgpt",
    label: "ChatGPT",
    family: "ai",
    delivery: "export",
    description: "Export JSON ou CSV pour assistants IA.",
  },
  {
    key: "perplexity",
    label: "Perplexity",
    family: "ai",
    delivery: "export",
    description: "Export catalogue pour Perplexity.",
  },
  {
    key: "gemini",
    label: "Google Gemini",
    family: "ai",
    delivery: "export",
    description: "Export catalogue pour Gemini.",
  },
];

/**
 * Tesla mineral keeps a single accent. We differentiate families through
 * the LABEL (mono eyebrow uppercase) — every card uses the same neutral
 * paper-2 surface with a line border, so the visual hierarchy comes from
 * typography and content, not from pastel backgrounds.
 */
export const CHANNEL_FAMILY_META: Record<
  ChannelFamily,
  { label: string; accent: string; background: string; border: string }
> = {
  shopping: {
    label: "Shopping",
    accent: "var(--ink)",
    background: "var(--paper-2)",
    border: "var(--line)",
  },
  marketplace: {
    label: "Marketplaces",
    accent: "var(--ink)",
    background: "var(--paper-2)",
    border: "var(--line)",
  },
  social: {
    label: "Social ads",
    accent: "var(--ink)",
    background: "var(--paper-2)",
    border: "var(--line)",
  },
  search: {
    label: "Search",
    accent: "var(--ink)",
    background: "var(--paper-2)",
    border: "var(--line)",
  },
  international: {
    label: "International",
    accent: "var(--ink)",
    background: "var(--paper-2)",
    border: "var(--line)",
  },
  ai: {
    label: "Assistants IA",
    accent: "var(--ink)",
    background: "var(--paper-2)",
    border: "var(--line)",
  },
};

export function getChannelMeta(channelKey: string) {
  return SUPPORTED_CHANNELS.find((channel) => channel.key === channelKey) || null;
}

export function getChannelLabel(channelKey: string) {
  return getChannelMeta(channelKey)?.label || channelKey;
}
