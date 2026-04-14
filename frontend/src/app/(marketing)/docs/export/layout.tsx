import type { Metadata } from "next";
import { createDocMetadata } from "@/lib/seo";

export const metadata: Metadata = createDocMetadata(
  "Export et flux",
  "Exporter vos flux vers Google Merchant Center, Google Shopping ou télécharger pour comparateurs, marketplaces et réseaux sociaux.",
  "/export",
  ["export flux", "Google Merchant Center", "feed XML", "marketplaces"]
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
