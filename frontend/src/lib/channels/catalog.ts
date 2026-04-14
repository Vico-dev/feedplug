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

export const CHANNEL_FAMILY_META: Record<
  ChannelFamily,
  { label: string; accent: string; background: string; border: string }
> = {
  shopping: {
    label: "Shopping",
    accent: "#2563eb",
    background: "#eff6ff",
    border: "#bfdbfe",
  },
  marketplace: {
    label: "Marketplaces",
    accent: "#b45309",
    background: "#fffbeb",
    border: "#fde68a",
  },
  social: {
    label: "Social ads",
    accent: "#be185d",
    background: "#fdf2f8",
    border: "#fbcfe8",
  },
  search: {
    label: "Search",
    accent: "#0f766e",
    background: "#ecfeff",
    border: "#a5f3fc",
  },
  international: {
    label: "International",
    accent: "#7c3aed",
    background: "#f5f3ff",
    border: "#ddd6fe",
  },
  ai: {
    label: "Assistants IA",
    accent: "#111827",
    background: "#f8fafc",
    border: "#cbd5e1",
  },
};

export function getChannelMeta(channelKey: string) {
  return SUPPORTED_CHANNELS.find((channel) => channel.key === channelKey) || null;
}

export function getChannelLabel(channelKey: string) {
  return getChannelMeta(channelKey)?.label || channelKey;
}
