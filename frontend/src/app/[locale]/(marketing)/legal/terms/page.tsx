"use client";

import { useLocale } from "next-intl";
import LegalPageShell from "@/components/marketing/LegalPageShell";

export default function TermsPage() {
  const locale = useLocale();
  const isEn = locale === "en";

  return (
    <LegalPageShell
      isEn={isEn}
      title={isEn ? "Terms of use" : "Conditions générales d'utilisation"}
      description={
        isEn
          ? "The FeedPlug terms define the contractual framework for access, subscription, use of the platform and each party's responsibilities."
          : "Les CGU FeedPlug définissent le cadre contractuel d'accès, d'abonnement, d'utilisation de la plateforme et les responsabilités de chaque partie."
      }
      bullets={[
        isEn ? "Scope, acceptance of the terms and account creation rules." : "Champ d'application, acceptation des CGU et règles de création de compte.",
        isEn ? "Subscription model, billing, renewal and cancellation logic." : "Modèle d'abonnement, facturation, renouvellement et résiliation.",
        isEn ? "User obligations, acceptable use and liability boundaries." : "Obligations utilisateur, usage acceptable et limites de responsabilité.",
        isEn ? "Applicable law, dispute process and support commitments." : "Droit applicable, traitement des litiges et engagements de support.",
      ]}
    />
  );
}
