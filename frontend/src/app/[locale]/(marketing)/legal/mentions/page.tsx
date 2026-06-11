"use client";

import { useLocale } from "next-intl";
import LegalPageShell from "@/components/marketing/LegalPageShell";

const LAST_UPDATED_ISO = "2026-06-11";

// ⚠️ TODO AVANT SOUMISSION SHOPIFY APP STORE :
// Remplacer ces champs par les données de l'entité juridique réelle
// (Kbis, RCS, capital, TVA, adresse postale).
const PUBLISHER = {
  legalName: "FeedPlug (Agence Inconnu)",
  legalForm: "—",
  capital: "—",
  address: "—",
  rcs: "—",
  vat: "—",
  representative: "Victor Soldet",
  contactEmail: "support@feedplug.com",
};

// Hébergeur : Google Cloud Platform (Cloud Run + Cloud SQL en europe-west1).
const HOST = {
  name: "Google Cloud Platform — Google LLC",
  address: "1600 Amphitheatre Parkway, Mountain View, CA 94043, USA",
  euOperator: "Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland",
  region: "europe-west1 (Saint-Ghislain, Belgique)",
  url: "https://cloud.google.com",
};

export default function MentionsLegalesPage() {
  const locale = useLocale();
  const isEn = locale === "en";

  return (
    <LegalPageShell
      isEn={isEn}
      title={isEn ? "Legal information" : "Mentions légales"}
      description={
        isEn
          ? "Publisher, hosting and legal references for the FeedPlug website (feedplug.com) and the embedded Shopify app (app.feedplug.com)."
          : "Éditeur, hébergement et références juridiques du site FeedPlug (feedplug.com) et de l'app embedded Shopify (app.feedplug.com)."
      }
      bullets={[
        isEn ? "Publisher identity and primary contact." : "Identité de l'éditeur et contact principal.",
        isEn ? "Hosting provider and infrastructure region." : "Hébergeur et région d'infrastructure.",
        isEn ? "Intellectual property statement." : "Déclaration de propriété intellectuelle.",
        isEn ? "Links to the privacy, terms and cookie policies." : "Liens vers la confidentialité, les CGU et la politique cookies.",
      ]}
    >
      <MentionsContent isEn={isEn} />
    </LegalPageShell>
  );
}

function MentionsContent({ isEn }: { isEn: boolean }) {
  return (
    <div className="legal-prose">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .legal-prose h2 { font-size: 1.4rem; margin: 32px 0 12px; color: var(--ink); letter-spacing: -0.02em; }
            .legal-prose p { margin: 8px 0 12px; color: var(--ink-2); line-height: 1.65; }
            .legal-prose ul { margin: 8px 0 12px; padding-left: 22px; color: var(--ink-2); line-height: 1.65; }
            .legal-prose li { margin-bottom: 6px; }
            .legal-prose dl { margin: 12px 0; }
            .legal-prose dt { font-weight: 600; color: var(--ink); margin-top: 8px; }
            .legal-prose dd { margin: 2px 0 0 0; color: var(--ink-2); }
            .legal-prose code { background: var(--paper-2); padding: 2px 6px; border-radius: 4px; font-size: 0.92em; }
            .legal-prose .legal-meta { color: var(--ink-3); font-size: 0.92em; margin-bottom: 20px; }
          `,
        }}
      />

      <p className="legal-meta">
        {isEn ? "Last updated: " : "Dernière mise à jour : "}
        {new Date(LAST_UPDATED_ISO).toLocaleDateString(isEn ? "en-GB" : "fr-FR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </p>

      <h2>{isEn ? "1. Publisher" : "1. Éditeur"}</h2>
      <dl>
        <dt>{isEn ? "Legal name" : "Raison sociale"}</dt>
        <dd>{PUBLISHER.legalName}</dd>
        <dt>{isEn ? "Legal form" : "Forme juridique"}</dt>
        <dd>{PUBLISHER.legalForm}</dd>
        <dt>{isEn ? "Share capital" : "Capital social"}</dt>
        <dd>{PUBLISHER.capital}</dd>
        <dt>{isEn ? "Registered office" : "Siège social"}</dt>
        <dd>{PUBLISHER.address}</dd>
        <dt>RCS</dt>
        <dd>{PUBLISHER.rcs}</dd>
        <dt>{isEn ? "VAT" : "TVA intracommunautaire"}</dt>
        <dd>{PUBLISHER.vat}</dd>
        <dt>{isEn ? "Publication director" : "Directeur de la publication"}</dt>
        <dd>{PUBLISHER.representative}</dd>
        <dt>{isEn ? "Contact" : "Contact"}</dt>
        <dd>
          <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>
        </dd>
      </dl>

      <h2>{isEn ? "2. Hosting" : "2. Hébergement"}</h2>
      <p>
        {isEn
          ? "The FeedPlug website and embedded Shopify app are hosted by:"
          : "Le site et l'app embedded Shopify FeedPlug sont hébergés par :"}
      </p>
      <dl>
        <dt>{isEn ? "Host" : "Hébergeur"}</dt>
        <dd>{HOST.name}</dd>
        <dt>{isEn ? "Address" : "Adresse"}</dt>
        <dd>{HOST.address}</dd>
        <dt>{isEn ? "EU operator" : "Opérateur UE"}</dt>
        <dd>{HOST.euOperator}</dd>
        <dt>{isEn ? "Infrastructure region" : "Région d'infrastructure"}</dt>
        <dd>{HOST.region}</dd>
        <dt>URL</dt>
        <dd>
          <a href={HOST.url} target="_blank" rel="noopener noreferrer">
            {HOST.url}
          </a>
        </dd>
      </dl>

      <h2>{isEn ? "3. Intellectual property" : "3. Propriété intellectuelle"}</h2>
      <p>
        {isEn
          ? "The FeedPlug name, logo, design, software and content are protected by intellectual property law. Any reproduction, representation, modification, publication, adaptation of all or part of the elements is prohibited, unless prior written authorisation."
          : "Le nom FeedPlug, le logo, le design, le logiciel et les contenus sont protégés par le droit de la propriété intellectuelle. Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments est interdite, sauf autorisation écrite préalable."}
      </p>

      <h2>{isEn ? "4. Hyperlinks" : "4. Liens hypertextes"}</h2>
      <p>
        {isEn
          ? "The FeedPlug website may contain links to third-party sites (e.g. Shopify, Google Merchant Center, Microsoft Bing). FeedPlug has no control over the content of these sites and cannot be held responsible for it."
          : "Le site FeedPlug peut contenir des liens vers des sites tiers (par exemple Shopify, Google Merchant Center, Microsoft Bing). FeedPlug n'a aucun contrôle sur le contenu de ces sites et ne saurait être tenu responsable de leur contenu."}
      </p>

      <h2>{isEn ? "5. Applicable law" : "5. Droit applicable"}</h2>
      <p>
        {isEn
          ? "These legal mentions are governed by French law. In case of dispute, the French courts have jurisdiction."
          : "Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux français sont compétents."}
      </p>

      <h2>{isEn ? "6. Related policies" : "6. Politiques associées"}</h2>
      <ul>
        <li>
          <a href="/legal/privacy">{isEn ? "Privacy policy" : "Politique de confidentialité"}</a>
        </li>
        <li>
          <a href="/legal/terms">{isEn ? "Terms of service" : "Conditions générales d'utilisation"}</a>
        </li>
        <li>
          <a href="/legal/cookies">{isEn ? "Cookie policy" : "Politique cookies"}</a>
        </li>
      </ul>

      <h2>{isEn ? "7. Reporting an issue" : "7. Signaler un contenu"}</h2>
      <p>
        {isEn
          ? "To report illegal content or abuse, contact us at "
          : "Pour signaler un contenu illicite ou un abus, contactez-nous à "}
        <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>
        {isEn ? "." : "."}
      </p>
    </div>
  );
}
