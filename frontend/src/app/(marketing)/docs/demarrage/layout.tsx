import type { Metadata } from "next";
import { createDocMetadata } from "@/lib/seo";

export const metadata: Metadata = createDocMetadata(
  "Démarrer",
  "Parcours de démarrage FeedPlug : connecter une source, lancer une synchro, découvrir l'optimisation IA et les exports.",
  "/demarrage",
  ["démarrage FeedPlug", "connexion source", "synchronisation", "export flux"]
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
