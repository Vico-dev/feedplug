import type { Metadata } from "next";
import { createDocMetadata } from "@/lib/seo";

export const metadata: Metadata = createDocMetadata(
  "Roadmap",
  "Évolutions prévues FeedPlug : mesure d'impact campagnes, rapports, nouveaux canaux (WooCommerce, Meta, Amazon), intégrations. Planning indicatif.",
  "/roadmap",
  ["roadmap FeedPlug", "évolutions feed produit", "Google Shopping", "WooCommerce"]
);

export default function RoadmapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
