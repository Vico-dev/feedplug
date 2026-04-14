"use client";

import { useLocale } from "next-intl";
import LegalPageShell from "@/components/marketing/LegalPageShell";

export default function CookiesPage() {
  const locale = useLocale();
  const isEn = locale === "en";

  return (
    <LegalPageShell
      isEn={isEn}
      title={isEn ? "Cookie policy" : "Politique de cookies"}
      description={
        isEn
          ? "FeedPlug uses essential, measurement and preference technologies to operate the site and improve the product experience within the applicable consent framework."
          : "FeedPlug utilise des technologies essentielles, de mesure et de préférence pour faire fonctionner le site et améliorer l'expérience produit, dans le cadre du consentement applicable."
      }
      bullets={[
        isEn ? "Distinction between essential, analytics and preference cookies." : "Distinction entre cookies essentiels, analytiques et de préférence.",
        isEn ? "How consent is collected, modified and withdrawn." : "Comment le consentement est recueilli, modifié et retiré.",
        isEn ? "Third-party technologies involved on the marketing site and app." : "Technologies tierces impliquées sur le site marketing et l'application.",
        isEn ? "Retention windows and user controls by browser or CMP." : "Durées de conservation et contrôles utilisateurs via navigateur ou CMP.",
      ]}
    />
  );
}
