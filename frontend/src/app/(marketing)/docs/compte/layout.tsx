import type { Metadata } from "next";
import { createDocMetadata } from "@/lib/seo";

export const metadata: Metadata = createDocMetadata(
  "Compte et équipe",
  "Connexion FeedPlug, mot de passe oublié, rôles Propriétaire / Manager / Lecteur, facturation et sécurité du compte.",
  "/compte",
  ["compte FeedPlug", "équipe", "rôles", "facturation", "sécurité"]
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
