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
  Key,
  LayoutDashboard,
  Lightbulb,
  Package,
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
  section: "workspace" | "admin";
  description: string;
};

export const dashboardNavigation: DashboardNavigationItem[] = [
  { nameKey: "dashboard", href: "/dashboard", icon: LayoutDashboard, section: "workspace", description: "Vue d'ensemble de l'activite du compte." },
  { nameKey: "sources", href: "/sources", icon: Database, section: "workspace", description: "Connexions, imports et qualite des donnees source." },
  { nameKey: "catalogue", href: "/catalogue", icon: Package, section: "workspace", description: "Pilotage du catalogue produit et actions en masse." },
  { nameKey: "flux", href: "/flux", icon: FileText, badge: "3", section: "workspace", description: "Parametrage et suivi des flux de diffusion." },
  { nameKey: "optimiser", href: "/optimiser", icon: Filter, section: "workspace", description: "Priorisation des correctifs et opportunites de gain." },
  { nameKey: "ia", href: "/optimiser/ia", icon: Sparkles, section: "workspace", description: "Enrichissements et recommandations assistes par IA." },
  { nameKey: "rapports", href: "/rapports", icon: TrendingUp, section: "workspace", description: "Lecture des performances et des tendances." },
  { nameKey: "performance", href: "/performance", icon: BarChart3, section: "workspace", description: "Mesures detaillees par canal et par flux." },
  { nameKey: "scoringChannels", href: "/scoring-canaux", icon: Sliders, section: "workspace", description: "Comparaison des scores de diffusion par canal." },
  { nameKey: "notifications", href: "/notifications", icon: Bell, badge: "3", section: "workspace", description: "Alertes produit, diffusion et systeme." },
  { nameKey: "billing", href: "/facturation", icon: CreditCard, section: "workspace", description: "Abonnement, factures et statut de paiement." },
  { nameKey: "accounts", href: "/admin/accounts", icon: Building2, adminOnly: true, section: "admin", description: "Administration des comptes clients." },
  { nameKey: "leads", href: "/admin/leads", icon: Users, adminOnly: true, section: "admin", description: "Suivi commercial et qualification des leads." },
  { nameKey: "featureIdeas", href: "/admin/feature-ideas", icon: Lightbulb, adminOnly: true, section: "admin", description: "Backlog des idees et demandes produit." },
  { nameKey: "aiKeys", href: "/admin/ai-keys", icon: Key, adminOnly: true, section: "admin", description: "Gestion des cles et fournisseurs IA." },
  { nameKey: "settings", href: "/parametres", icon: Settings, section: "workspace", description: "Preferences du compte et configuration generale." },
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
    return normalizedPathname === "/optimiser";
  }
  if (href === "/optimiser/ia") {
    return normalizedPathname.startsWith("/optimiser/ia");
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
