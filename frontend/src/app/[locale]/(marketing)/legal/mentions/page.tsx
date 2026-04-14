"use client";

import { useLocale } from "next-intl";
import LegalPageShell from "@/components/marketing/LegalPageShell";

export default function MentionsLegalesPage() {
  const locale = useLocale();
  const isEn = locale === "en";

  return (
    <LegalPageShell
      isEn={isEn}
      title={isEn ? "Legal information" : "Mentions légales"}
      description={
        isEn
          ? "This page centralizes the publisher information, hosting details and legal references associated with the public FeedPlug website and application."
          : "Cette page centralise les informations éditeur, l'hébergement et les références juridiques associées au site public et à l'application FeedPlug."
      }
      bullets={[
        isEn ? "Publisher identity, legal representative and contact details." : "Identité de l'éditeur, représentant légal et coordonnées.",
        isEn ? "Hosting provider and technical publication information." : "Hébergeur et informations techniques de publication.",
        isEn ? "Applicable jurisdiction and legal references by market." : "Juridiction applicable et références légales selon le marché.",
        isEn ? "Links to privacy, terms and cookie documentation." : "Liens vers la confidentialité, les CGU et la politique cookies.",
      ]}
    />
  );
}
