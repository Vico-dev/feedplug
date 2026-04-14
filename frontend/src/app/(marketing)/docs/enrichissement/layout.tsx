import type { Metadata } from "next";
import { createDocMetadata } from "@/lib/seo";

export const metadata: Metadata = createDocMetadata(
  "Enrichissement IA",
  "Optimisez titres, descriptions et visuels avec l'IA FeedPlug. Templates par secteur, tests A/B, prévisualisation avant/après.",
  "/enrichissement",
  ["enrichissement IA", "optimisation titre", "optimisation description", "templates produit"]
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
