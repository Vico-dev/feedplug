import type { Metadata } from "next";
import { createDocMetadata } from "@/lib/seo";

export const metadata: Metadata = createDocMetadata(
  "Sources et import",
  "Connecter Shopify et vos fichiers d'export à FeedPlug. Import, mapping automatique, flux multiples et synchronisations planifiées.",
  "/sources",
  ["connexion Shopify", "import flux", "mapping produit", "synchronisation"]
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
