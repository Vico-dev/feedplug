import type { Metadata } from "next";
import { createDocMetadata } from "@/lib/seo";

export const metadata: Metadata = createDocMetadata(
  "Score FeedPlug",
  "Score 0-100 par fiche produit avec détail titre, description, image et infos produit. Savoir où progresser pour Google Shopping.",
  "/score",
  ["score produit", "qualité Google Shopping", "conformité Merchant Center", "audit fiche produit"]
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
