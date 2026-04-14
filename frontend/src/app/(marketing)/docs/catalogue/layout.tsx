import type { Metadata } from "next";
import { createDocMetadata } from "@/lib/seo";

export const metadata: Metadata = createDocMetadata(
  "Catalogue",
  "Vue unifiée de vos produits FeedPlug : filtres par source et par score, détail des fiches, recommandations et priorisation des améliorations.",
  "/catalogue",
  ["catalogue produits", "fiche produit", "score qualité", "recommandations"]
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
