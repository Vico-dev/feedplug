import type { Metadata } from "next";
import { createDocMetadata } from "@/lib/seo";

export const metadata: Metadata = createDocMetadata(
  "Glossaire",
  "Définitions des termes FeedPlug et Google Shopping : GTIN, MPN, Google Product Category, availability, condition, flux produit.",
  "/glossaire",
  ["glossaire", "GTIN", "MPN", "Google Product Category", "flux produit"]
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
