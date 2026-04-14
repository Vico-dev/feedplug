/**
 * Navigation marketing — Solutions (canaux) et Fonctionnalités
 */

export const NAV_SOLUTIONS = [
  {
    id: "google-shopping",
    label: "Google Ads / Google Shopping",
    href: "/optimiser-flux-google-shopping",
    available: true,
  },
  {
    id: "amazon",
    label: "Amazon",
    href: "/optimiser-flux-amazon",
    available: true,
  },
  {
    id: "cdiscount",
    label: "Cdiscount",
    href: "/optimiser-flux-cdiscount",
    available: true,
  },
  {
    id: "rakuten",
    label: "Rakuten",
    href: "/optimiser-flux-rakuten",
    available: true,
  },
  {
    id: "assistants-ia",
    label: "ChatGPT & assistants IA",
    href: "/distribution-assistants-ia",
    available: true,
  },
] as const;

export const NAV_FONCTIONNALITES = [
  { id: "enrichissement-ia", label: "Optimisation titres & descriptions par IA" },
  { id: "diffusion-canaux", label: "Diffusion sur de nouveaux canaux", page: "/diffusion-nouveaux-canaux" },
  { id: "traduction-flux", label: "Traduction du flux à la volée" },
  { id: "analytics", label: "Analytics & performance" },
  { id: "ab-testing", label: "A/B Testing" },
] as const;
