"use client";

import type { ComponentType, CSSProperties } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  Database,
  FileText,
  Filter,
  Globe2,
  Key,
  LayoutDashboard,
  Lightbulb,
  Package,
  Radio,
  Settings,
  Sliders,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { stripLocalePrefix } from "@/lib/locale-navigation";

type Translate = (key: string) => string;

export type DashboardNavigationItem = {
  nameKey: string;
  href: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  badge?: string;
  adminOnly?: boolean;
  group: "overview" | "data" | "preparation" | "diffusion" | "analysis" | "account" | "admin";
  description: string;
};

// Ordre = parcours réel : je connecte → je prépare → je diffuse → je mesure.
// Phase 1 (regroupement) : toutes les entrées restent joignables, organisées en
// sections. Phase 2 (fusions) : Flux→Catalogue, Rapports/Scoring→Analyse,
// Canaux dissous (activation→Marchés, connexion→Compte). Voir mémoire feedplug-sidebar-ia.
export const dashboardNavigation: DashboardNavigationItem[] = [
  { nameKey: "dashboard", href: "/dashboard", icon: LayoutDashboard, group: "overview", description: "Vue d'ensemble de l'activite du compte." },

  { nameKey: "sources", href: "/sources", icon: Database, group: "data", description: "Connexions, imports et qualite des donnees source." },
  { nameKey: "catalogue", href: "/catalogue", icon: Package, group: "data", description: "Pilotage du catalogue produit et actions en masse." },
  { nameKey: "flux", href: "/flux", icon: FileText, badge: "3", group: "data", description: "Parametrage et suivi des flux de diffusion." },

  { nameKey: "optimiser", href: "/optimiser", icon: Filter, group: "preparation", description: "Priorisation des correctifs et opportunites de gain." },

  { nameKey: "markets", href: "/markets", icon: Globe2, group: "diffusion", description: "Marches, langues et activation des canaux (traduction FeedPlug par marche)." },
  { nameKey: "channels", href: "/channels", icon: Radio, group: "diffusion", description: "Connexion des destinations marketing (Google Merchant Center, Amazon, Google Ads, Bing)." },

  { nameKey: "performance", href: "/performance", icon: BarChart3, group: "analysis", description: "Mesures detaillees par canal et par flux." },
  { nameKey: "rapports", href: "/rapports", icon: TrendingUp, group: "analysis", description: "Lecture des performances et des tendances." },
  { nameKey: "scoringChannels", href: "/scoring-canaux", icon: Sliders, group: "analysis", description: "Comparaison des scores de diffusion par canal." },

  { nameKey: "billing", href: "/facturation", icon: CreditCard, group: "account", description: "Abonnement, factures et statut de paiement." },
  { nameKey: "notifications", href: "/notifications", icon: Bell, badge: "3", group: "account", description: "Alertes produit, diffusion et systeme." },
  { nameKey: "settings", href: "/parametres", icon: Settings, group: "account", description: "Preferences du compte et configuration generale." },

  { nameKey: "accounts", href: "/admin/accounts", icon: Building2, adminOnly: true, group: "admin", description: "Administration des comptes clients." },
  { nameKey: "leads", href: "/admin/leads", icon: Users, adminOnly: true, group: "admin", description: "Suivi commercial et qualification des leads." },
  { nameKey: "featureIdeas", href: "/admin/feature-ideas", icon: Lightbulb, adminOnly: true, group: "admin", description: "Backlog des idees et demandes produit." },
  { nameKey: "aiKeys", href: "/admin/ai-keys", icon: Key, adminOnly: true, group: "admin", description: "Gestion des cles et fournisseurs IA." },
];

export function getDashboardNavigation(isStaff: boolean | undefined, t: Translate) {
  return dashboardNavigation
    .filter((item) => !item.adminOnly || isStaff === true)
    .map((item) => ({
      ...item,
      label: t(item.nameKey),
    }));
}

export function getNormalizedDashboardPath(pathname?: string | null, localePrefix?: string) {
  return stripLocalePrefix(pathname, localePrefix);
}

export function isDashboardItemActive(normalizedPathname: string, href: string) {
  if (href === "/optimiser") {
    return normalizedPathname.startsWith("/optimiser");
  }
  return normalizedPathname === href || normalizedPathname.startsWith(`${href}/`);
}

export function getCurrentDashboardItem(
  pathname: string | undefined | null,
  localePrefix: string,
  items: Array<ReturnType<typeof getDashboardNavigation>[number]>
) {
  const normalizedPathname = getNormalizedDashboardPath(pathname, localePrefix);
  const sorted = [...items].sort((a, b) => b.href.length - a.href.length);
  return sorted.find((item) => isDashboardItemActive(normalizedPathname, item.href)) ?? null;
}
