"use client";

import { useLocale } from "next-intl";
import LegalPageShell from "@/components/marketing/LegalPageShell";

const LAST_UPDATED_ISO = "2026-06-11";

// Données juridiques de l'entité opérant FeedPlug.
// ⚠️ TODO AVANT SOUMISSION SHOPIFY APP STORE :
// Remplacer par la raison sociale exacte une fois la société immatriculée
// (Kbis disponible). Shopify review refuse les Privacy Policies sans entité
// juridique clairement identifiée.
const DATA_CONTROLLER_NAME = "FeedPlug (Agence Inconnu)";
const DATA_CONTROLLER_COUNTRY = "France";

export default function PrivacyPage() {
  const locale = useLocale();
  const isEn = locale === "en";

  return (
    <LegalPageShell
      isEn={isEn}
      title={isEn ? "Privacy policy" : "Politique de confidentialité"}
      description={
        isEn
          ? "FeedPlug processes only the data strictly required to synchronise your product catalog with marketing channels (Google Shopping, Microsoft Bing, Amazon Seller). We never access customer-level data of your Shopify store."
          : "FeedPlug ne traite que les données strictement nécessaires à la synchronisation de votre catalogue produits vers les canaux marketing (Google Shopping, Microsoft Bing, Amazon Seller). Nous n'accédons jamais aux données clients de votre boutique Shopify."
      }
      bullets={[
        isEn ? "Read-only access to product data (no customers, no orders)." : "Accès en lecture seule aux données produits (jamais aux clients ni commandes).",
        isEn ? "Hosting in the European Union (GCP, europe-west1 region)." : "Hébergement en Union Européenne (GCP, région europe-west1).",
        isEn ? "GDPR webhooks fully implemented (customers/data_request, customers/redact, shop/redact)." : "Webhooks GDPR Shopify implémentés (customers/data_request, customers/redact, shop/redact).",
        isEn ? "Access, rectification, deletion and portability rights guaranteed." : "Droits d'accès, rectification, effacement et portabilité garantis.",
      ]}
    >
      <PrivacyContent isEn={isEn} />
    </LegalPageShell>
  );
}

function PrivacyContent({ isEn }: { isEn: boolean }) {
  return (
    <div className="legal-prose">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .legal-prose h2 { font-size: 1.4rem; margin: 32px 0 12px; color: var(--ink); letter-spacing: -0.02em; }
            .legal-prose h3 { font-size: 1.1rem; margin: 20px 0 8px; color: var(--ink); }
            .legal-prose p { margin: 8px 0 12px; color: var(--ink-2); line-height: 1.65; }
            .legal-prose ul { margin: 8px 0 12px; padding-left: 22px; color: var(--ink-2); line-height: 1.65; }
            .legal-prose li { margin-bottom: 6px; }
            .legal-prose code { background: var(--paper-2); padding: 2px 6px; border-radius: 4px; font-size: 0.92em; }
            .legal-prose table { width: 100%; border-collapse: collapse; margin: 12px 0 16px; font-size: 0.94em; }
            .legal-prose th, .legal-prose td { border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
            .legal-prose th { background: var(--paper-2); font-weight: 600; }
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

      {/* === 1. Data controller === */}
      <h2>{isEn ? "1. Data controller" : "1. Responsable du traitement"}</h2>
      <p>
        {isEn ? (
          <>
            The data controller is <strong>{DATA_CONTROLLER_NAME}</strong>, operating the FeedPlug service,
            registered office: {DATA_CONTROLLER_COUNTRY}. Contact: <a href="mailto:support@feedplug.com">support@feedplug.com</a>.
          </>
        ) : (
          <>
            Le responsable du traitement est <strong>{DATA_CONTROLLER_NAME}</strong>, opérateur du service FeedPlug,
            siège social {DATA_CONTROLLER_COUNTRY === "France" ? "en France" : `à ${DATA_CONTROLLER_COUNTRY}`}. Contact : <a href="mailto:support@feedplug.com">support@feedplug.com</a>.
          </>
        )}
      </p>

      {/* === 2. Data we access on Shopify === */}
      <h2>{isEn ? "2. Data accessed from your Shopify store" : "2. Données accédées sur votre boutique Shopify"}</h2>
      <p>
        {isEn
          ? "FeedPlug uses the minimum Shopify Admin API scope required to sync product feeds. We do NOT request, access or store customer data, orders, payment information or marketing analytics from your Shopify store."
          : "FeedPlug utilise le périmètre Shopify Admin API minimum nécessaire à la synchronisation des flux produits. Nous NE DEMANDONS PAS, n'accédons pas et ne stockons pas les données clients, commandes, informations de paiement ou statistiques marketing de votre boutique Shopify."}
      </p>
      <table>
        <thead>
          <tr>
            <th>{isEn ? "Shopify scope requested" : "Scope Shopify demandé"}</th>
            <th>{isEn ? "Purpose" : "Finalité"}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>read_products</code></td>
            <td>{isEn ? "Read your product catalog (titles, descriptions, images, variants, prices, inventory, SEO fields) to build the feed sent to Google Shopping, Microsoft Bing and Amazon." : "Lire votre catalogue produits (titres, descriptions, images, variantes, prix, stock, champs SEO) pour construire le flux envoyé à Google Shopping, Microsoft Bing et Amazon."}</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>{isEn ? "Shop-level metadata also stored:" : "Métadonnées de boutique également stockées :"}</strong>{" "}
        {isEn
          ? "myshopify domain, shop name, billing email (used only to identify the account), currency code."
          : "domaine myshopify, nom de la boutique, email de facturation (utilisé uniquement pour identifier le compte), code devise."}
      </p>

      {/* === 3. Purposes === */}
      <h2>{isEn ? "3. Processing purposes" : "3. Finalités du traitement"}</h2>
      <ul>
        <li>{isEn ? "Build, validate and continuously sync product feeds with Google Merchant Center, Microsoft Bing Shopping and Amazon Seller catalogs." : "Construire, valider et synchroniser en continu les flux produits avec Google Merchant Center, Microsoft Bing Shopping et les catalogues Amazon Seller."}</li>
        <li>{isEn ? "Optimise product titles and generate ad-friendly images (Pack IA add-on, opt-in)." : "Optimiser les titres produits et générer des images optimisées pub (Pack IA, opt-in)."}</li>
        <li>{isEn ? "Run quality diagnostics on the catalog (missing GTIN, broken images, policy violations) and surface fixes inside the app." : "Réaliser des diagnostics qualité sur le catalogue (GTIN manquants, images cassées, violations de policy) et proposer des correctifs dans l'app."}</li>
        <li>{isEn ? "Bill the subscription (via Shopify Billing API or Stripe depending on signup channel)." : "Facturer l'abonnement (via Shopify Billing API ou Stripe selon le canal d'inscription)."}</li>
        <li>{isEn ? "Support and incident communication tied to the active subscription." : "Support et communication d'incident liés à l'abonnement actif."}</li>
      </ul>

      {/* === 4. Legal basis === */}
      <h2>{isEn ? "4. Legal basis" : "4. Bases légales"}</h2>
      <ul>
        <li>{isEn ? "Performance of the contract (provision of the FeedPlug service)." : "Exécution du contrat (fourniture du service FeedPlug)."}</li>
        <li>{isEn ? "Legitimate interest (security monitoring, fraud prevention, abuse rate-limits)." : "Intérêt légitime (sécurité, prévention de la fraude, rate-limits anti-abus)."}</li>
        <li>{isEn ? "Consent (Pack IA optimisations, marketing emails)." : "Consentement (optimisations Pack IA, emails marketing)."}</li>
      </ul>

      {/* === 5. Hosting & security === */}
      <h2>{isEn ? "5. Hosting & security" : "5. Hébergement et sécurité"}</h2>
      <p>
        {isEn
          ? "All data is hosted on Google Cloud Platform in the europe-west1 region (Saint-Ghislain, Belgium). PostgreSQL data is encrypted at rest, all traffic uses TLS 1.2+ in transit."
          : "Toutes les données sont hébergées sur Google Cloud Platform dans la région europe-west1 (Saint-Ghislain, Belgique). Les données PostgreSQL sont chiffrées au repos, le trafic utilise TLS 1.2+ en transit."}
      </p>
      <ul>
        <li>{isEn ? "Application secrets (Shopify access tokens, API keys, JWT secrets) stored in GCP Secret Manager, never in code." : "Secrets applicatifs (access tokens Shopify, clés API, secrets JWT) stockés dans GCP Secret Manager, jamais dans le code."}</li>
        <li>{isEn ? "Sensitive fields encrypted at the application level (AES-256-GCM) before persistence." : "Champs sensibles chiffrés au niveau applicatif (AES-256-GCM) avant persistance."}</li>
        <li>{isEn ? "Daily PostgreSQL backups retained for 7 days." : "Sauvegardes PostgreSQL quotidiennes conservées 7 jours."}</li>
        <li>{isEn ? "Strict access control: only FeedPlug staff with operational need can access production data, with audit trail." : "Contrôle d'accès strict : seul le staff FeedPlug avec besoin opérationnel accède aux données de production, avec audit trail."}</li>
      </ul>

      {/* === 6. Shopify GDPR webhooks === */}
      <h2>{isEn ? "6. Shopify GDPR webhooks" : "6. Webhooks GDPR Shopify"}</h2>
      <p>
        {isEn
          ? "FeedPlug implements all three mandatory Shopify GDPR webhooks. Because we never collect customer data from Shopify stores, the customers-related webhooks are mostly acknowledgments:"
          : "FeedPlug implémente les trois webhooks GDPR Shopify obligatoires. Comme nous ne collectons aucune donnée client depuis les boutiques Shopify, les webhooks customers sont essentiellement des acknowledgments :"}
      </p>
      <table>
        <thead>
          <tr>
            <th>{isEn ? "Webhook" : "Webhook"}</th>
            <th>{isEn ? "Behavior" : "Comportement"}</th>
            <th>SLA</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>customers/data_request</code></td>
            <td>{isEn ? "Acknowledged + logged for audit. No customer data is held to return." : "Acknowledgement + log audit. Aucune donnée client à retourner."}</td>
            <td>30 {isEn ? "days" : "jours"}</td>
          </tr>
          <tr>
            <td><code>customers/redact</code></td>
            <td>{isEn ? "Acknowledged + logged. No customer data to delete." : "Acknowledgement + log. Aucune donnée client à supprimer."}</td>
            <td>30 {isEn ? "days" : "jours"}</td>
          </tr>
          <tr>
            <td><code>shop/redact</code></td>
            <td>{isEn ? "Full cascade deletion: FeedItem → Feed → FeedSource → Credential for the shop, plus orphan Account cleanup." : "Suppression en cascade : FeedItem → Feed → FeedSource → Credential pour la boutique, ainsi que le nettoyage de l'Account orphelin."}</td>
            <td>48 {isEn ? "hours" : "heures"}</td>
          </tr>
        </tbody>
      </table>

      {/* === 7. Subprocessors === */}
      <h2>{isEn ? "7. Subprocessors" : "7. Sous-traitants"}</h2>
      <p>{isEn ? "FeedPlug relies on the following subprocessors:" : "FeedPlug s'appuie sur les sous-traitants suivants :"}</p>
      <table>
        <thead>
          <tr>
            <th>{isEn ? "Subprocessor" : "Sous-traitant"}</th>
            <th>{isEn ? "Role" : "Rôle"}</th>
            <th>{isEn ? "Location" : "Localisation"}</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Google Cloud Platform</td><td>{isEn ? "Hosting, database, secret manager, storage" : "Hébergement, base de données, secret manager, stockage"}</td><td>EU (Belgium)</td></tr>
          <tr><td>Shopify</td><td>{isEn ? "Admin API + Managed Pricing billing" : "Admin API + facturation Managed Pricing"}</td><td>CA / US</td></tr>
          <tr><td>Stripe</td><td>{isEn ? "Billing for non-Shopify signups (feedplug.com)" : "Facturation pour les inscriptions hors-Shopify (feedplug.com)"}</td><td>US (EU subprocessor)</td></tr>
          <tr><td>Google Merchant Center / Microsoft Bing / Amazon Seller</td><td>{isEn ? "Destination channels (your product data is sent there per your activation choice)" : "Canaux de destination (vos données produits y sont envoyées selon vos activations)"}</td><td>US</td></tr>
          <tr><td>Resend</td><td>{isEn ? "Transactional email (welcome, billing notices, alerts)" : "Email transactionnel (bienvenue, notifications facturation, alertes)"}</td><td>US</td></tr>
          <tr><td>Sentry</td><td>{isEn ? "Error monitoring (no PII captured)" : "Monitoring d'erreurs (pas de PII capturée)"}</td><td>US / EU</td></tr>
        </tbody>
      </table>
      <p>{isEn ? "Data Processing Agreements signed with each subprocessor (SCC where applicable)." : "Data Processing Agreements signés avec chaque sous-traitant (clauses contractuelles types le cas échéant)."}</p>

      {/* === 8. Retention === */}
      <h2>{isEn ? "8. Retention" : "8. Conservation"}</h2>
      <ul>
        <li>{isEn ? "Active subscription: data retained as long as the subscription is active." : "Abonnement actif : données conservées tant que l'abonnement est actif."}</li>
        <li>{isEn ? "App uninstall: a 48-hour grace window before the shop/redact webhook triggers a full cascade deletion." : "Désinstallation de l'app : fenêtre de grâce 48h avant que le webhook shop/redact ne déclenche la suppression en cascade complète."}</li>
        <li>{isEn ? "Account cancellation (non-Shopify): data deleted within 30 days of cancellation, except billing records retained 10 years for tax compliance." : "Résiliation de compte (hors Shopify) : données supprimées dans les 30 jours suivant la résiliation, sauf documents comptables conservés 10 ans pour conformité fiscale."}</li>
        <li>{isEn ? "Backups: rotated automatically, last backup containing your data deleted within 7 days." : "Sauvegardes : rotation automatique, dernière sauvegarde contenant vos données supprimée sous 7 jours."}</li>
      </ul>

      {/* === 9. Rights === */}
      <h2>{isEn ? "9. Your rights" : "9. Vos droits"}</h2>
      <p>
        {isEn
          ? "Under GDPR you can request access, rectification, erasure, portability, restriction, or object to specific processing. You can also lodge a complaint with your supervisory authority (CNIL in France)."
          : "Conformément au RGPD vous pouvez demander l'accès, la rectification, l'effacement, la portabilité, la limitation, ou vous opposer à un traitement spécifique. Vous pouvez également introduire une réclamation auprès de l'autorité de contrôle (CNIL en France)."}
      </p>
      <p>
        {isEn ? "To exercise your rights, contact us at " : "Pour exercer vos droits, contactez-nous à "}
        <a href="mailto:support@feedplug.com">support@feedplug.com</a>
        {isEn ? ". We respond within 30 days." : ". Nous répondons sous 30 jours."}
      </p>

      {/* === 10. Cookies === */}
      <h2>{isEn ? "10. Cookies" : "10. Cookies"}</h2>
      <p>
        {isEn
          ? "FeedPlug uses strictly necessary cookies (session, CSRF) and a minimal analytics cookie aggregated and anonymised. No third-party advertising cookies are set."
          : "FeedPlug utilise des cookies strictement nécessaires (session, CSRF) et un cookie d'analyse minimal agrégé et anonymisé. Aucun cookie publicitaire tiers n'est déposé."}{" "}
        {isEn ? "Details: " : "Détails : "}
        <a href="/legal/cookies">{isEn ? "Cookie policy" : "Politique cookies"}</a>.
      </p>

      {/* === 11. Updates === */}
      <h2>{isEn ? "11. Changes to this policy" : "11. Modifications de cette politique"}</h2>
      <p>
        {isEn
          ? "We may update this policy to reflect changes in our service, subprocessors or legal obligations. Material changes are notified by email to active merchants at least 30 days before they take effect."
          : "Nous pouvons mettre à jour cette politique pour refléter les évolutions du service, des sous-traitants ou des obligations légales. Les changements substantiels sont notifiés par email aux merchants actifs au moins 30 jours avant entrée en vigueur."}
      </p>

      {/* === 12. Contact === */}
      <h2>{isEn ? "12. Contact" : "12. Contact"}</h2>
      <p>
        <a href="mailto:support@feedplug.com">support@feedplug.com</a> —{" "}
        {isEn ? "general support: " : "support général : "}
        <a href="mailto:support@feedplug.com">support@feedplug.com</a>
      </p>
    </div>
  );
}
