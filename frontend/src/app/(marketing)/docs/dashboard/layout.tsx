import type { Metadata } from "next";
import { createDocMetadata } from "@/lib/seo";

export const metadata: Metadata = createDocMetadata(
  "Dashboard",
  "Tableau de bord FeedPlug : sources, flux, catalogue, score moyen, évolution 30 jours, enrichissements IA et statut des mises à jour.",
  "/dashboard",
  ["dashboard FeedPlug", "tableau de bord", "flux produits", "statistiques"]
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
