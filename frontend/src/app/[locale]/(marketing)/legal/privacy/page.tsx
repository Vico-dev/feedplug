"use client";

import { useLocale } from "next-intl";
import LegalPageShell from "@/components/marketing/LegalPageShell";

export default function PrivacyPage() {
  const locale = useLocale();
  const isEn = locale === "en";

  return (
    <LegalPageShell
      isEn={isEn}
      title={isEn ? "Privacy policy" : "Politique de confidentialité"}
      description={
        isEn
          ? "FeedPlug processes personal data under the applicable regulatory framework. This page outlines the categories of data involved, the legal bases used and the rights available to each user."
          : "FeedPlug traite les données personnelles dans le cadre des réglementations applicables. Cette page résume les catégories de données concernées, les bases légales utilisées et les droits ouverts à chaque utilisateur."
      }
      bullets={[
        isEn ? "Data controller details and primary contact channel." : "Identité du responsable du traitement et canal de contact principal.",
        isEn ? "Main processing purposes, legal bases and retention logic." : "Finalités principales, bases légales et logique de conservation.",
        isEn ? "Access, rectification, deletion, portability and objection rights." : "Droits d'accès, rectification, effacement, portabilité et opposition.",
        isEn ? "Security commitments and third-party subprocessors." : "Engagements de sécurité et sous-traitants impliqués.",
      ]}
    />
  );
}
