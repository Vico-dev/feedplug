"use client";

import { useLocale } from "next-intl";
import LegalPageShell from "@/components/marketing/LegalPageShell";

const LAST_UPDATED_ISO = "2026-06-11";

// Entité opérant le service FeedPlug.
// ⚠️ TODO AVANT SOUMISSION SHOPIFY APP STORE : mettre à jour avec la raison sociale exacte.
const PROVIDER_NAME = "FeedPlug (Agence Inconnu)";
const PROVIDER_COUNTRY = "France";

export default function TermsPage() {
  const locale = useLocale();
  const isEn = locale === "en";

  return (
    <LegalPageShell
      isEn={isEn}
      title={isEn ? "Terms of service" : "Conditions générales d'utilisation"}
      description={
        isEn
          ? "These terms govern the use of FeedPlug — a SaaS product feed management service for Shopify, Stripe-based and other ecommerce platforms. By installing the app or signing up, you accept these terms."
          : "Ces conditions régissent l'utilisation de FeedPlug — service SaaS de gestion de flux produit pour Shopify, Stripe et autres plateformes e-commerce. L'installation de l'app ou l'inscription vaut acceptation."
      }
      bullets={[
        isEn ? "Subscription via Shopify Managed Pricing or Stripe depending on signup channel." : "Abonnement via Shopify Managed Pricing ou Stripe selon le canal d'inscription.",
        isEn ? "14-day free trial on every plan, no commitment, cancel anytime." : "14 jours d'essai gratuit sur tous les plans, sans engagement, résiliable à tout moment.",
        isEn ? "Read-only access to product data — never customer data or orders." : "Accès en lecture seule aux données produits — jamais aux clients ni commandes.",
        isEn ? "French law applies, dispute resolution before the competent French court." : "Droit français applicable, juridiction française compétente.",
      ]}
    >
      <TermsContent isEn={isEn} />
    </LegalPageShell>
  );
}

function TermsContent({ isEn }: { isEn: boolean }) {
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
            .legal-prose .legal-meta { color: var(--ink-3); font-size: 0.92em; margin-bottom: 20px; }
            .legal-prose strong { color: var(--ink); }
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

      <h2>{isEn ? "1. Service provider" : "1. Prestataire"}</h2>
      <p>
        {isEn
          ? `FeedPlug is operated by ${PROVIDER_NAME} (registered office: ${PROVIDER_COUNTRY}). Contact: `
          : `FeedPlug est opéré par ${PROVIDER_NAME} (siège social ${PROVIDER_COUNTRY === "France" ? "en France" : `à ${PROVIDER_COUNTRY}`}). Contact : `}
        <a href="mailto:support@feedplug.com">support@feedplug.com</a>.
      </p>

      <h2>{isEn ? "2. Service description" : "2. Description du service"}</h2>
      <p>
        {isEn
          ? "FeedPlug is a SaaS product-feed management platform that connects your product catalog (Shopify, CSV, or other sources) to marketing destinations: Google Merchant Center, Microsoft Bing Shopping, Amazon Seller and other supported channels. The service includes catalog synchronisation, quality diagnostics, and an optional AI add-on for title optimisation and image generation."
          : "FeedPlug est une plateforme SaaS de gestion de flux produits qui connecte votre catalogue (Shopify, CSV, ou autres sources) à des destinations marketing : Google Merchant Center, Microsoft Bing Shopping, Amazon Seller et autres canaux supportés. Le service comprend la synchronisation du catalogue, le diagnostic qualité, et un Pack IA optionnel pour l'optimisation des titres et la génération d'images."}
      </p>

      <h2>{isEn ? "3. Eligibility and account" : "3. Éligibilité et compte"}</h2>
      <ul>
        <li>{isEn ? "You must be at least 18 years old and have legal authority to bind your business entity." : "Vous devez être âgé d'au moins 18 ans et disposer du pouvoir d'engager votre structure professionnelle."}</li>
        <li>{isEn ? "One account per Shopify shop. Multiple Shopify shops require multiple installs and subscriptions." : "Un compte par boutique Shopify. Plusieurs boutiques Shopify nécessitent plusieurs installations et abonnements."}</li>
        <li>{isEn ? "You are responsible for keeping access credentials confidential." : "Vous êtes responsable de la confidentialité de vos accès."}</li>
      </ul>

      <h2>{isEn ? "4. Subscription and billing" : "4. Abonnement et facturation"}</h2>
      <p>
        {isEn
          ? "FeedPlug is offered through plans defined in Shopify Partners (Managed Pricing) for Shopify merchants, or directly via Stripe for merchants subscribing on feedplug.com."
          : "FeedPlug est proposé via des plans définis dans Shopify Partners (Managed Pricing) pour les merchants Shopify, ou directement via Stripe pour les merchants s'inscrivant sur feedplug.com."}
      </p>
      <ul>
        <li>{isEn ? "All plans include a 14-day free trial." : "Tous les plans incluent un essai gratuit de 14 jours."}</li>
        <li>{isEn ? "Billing is monthly, recurring, automatically renewed unless cancelled." : "Facturation mensuelle, récurrente, automatiquement renouvelée sauf résiliation."}</li>
        <li>{isEn ? "For Shopify merchants: charges are processed by Shopify Billing and appear on your Shopify bill. Cancelling the Shopify subscription cancels FeedPlug automatically." : "Pour les merchants Shopify : les charges sont gérées par Shopify Billing et apparaissent sur votre facture Shopify. Annuler l'abonnement Shopify annule FeedPlug automatiquement."}</li>
        <li>{isEn ? "For Stripe merchants: charges are processed by Stripe; cancellation from the FeedPlug account interface." : "Pour les merchants Stripe : les charges sont gérées par Stripe ; résiliation depuis l'interface du compte FeedPlug."}</li>
        <li>{isEn ? "Prices may change with 30 days notice. Existing subscriptions keep their current price until next renewal." : "Les prix peuvent changer avec un préavis de 30 jours. Les abonnements en cours conservent leur prix jusqu'au prochain renouvellement."}</li>
        <li>{isEn ? "No refund for partial months after cancellation; access continues until the end of the paid period." : "Pas de remboursement au prorata après résiliation ; l'accès est maintenu jusqu'à la fin de la période payée."}</li>
      </ul>

      <h2>{isEn ? "5. Acceptable use" : "5. Usage acceptable"}</h2>
      <p>{isEn ? "You agree not to:" : "Vous vous engagez à ne pas :"}</p>
      <ul>
        <li>{isEn ? "Resell or rebrand the FeedPlug service without a written reseller agreement." : "Revendre ou marquer en blanc le service FeedPlug sans accord écrit de revente."}</li>
        <li>{isEn ? "Use FeedPlug to distribute products that violate Google Merchant Center, Microsoft Bing or Amazon Seller policies (counterfeit, adult, restricted goods, illegal items)." : "Utiliser FeedPlug pour distribuer des produits violant les policies Google Merchant Center, Microsoft Bing ou Amazon Seller (contrefaçon, adulte, biens réglementés, produits illégaux)."}</li>
        <li>{isEn ? "Reverse engineer, scrape or copy substantial portions of the service." : "Faire du reverse engineering, scraper ou copier des portions substantielles du service."}</li>
        <li>{isEn ? "Use the service to attack, overload or disrupt FeedPlug or any third-party system." : "Utiliser le service pour attaquer, surcharger ou perturber FeedPlug ou tout système tiers."}</li>
      </ul>
      <p>
        {isEn
          ? "Violations may result in immediate suspension or termination, without refund."
          : "Toute violation peut entraîner une suspension ou résiliation immédiate, sans remboursement."}
      </p>

      <h2>{isEn ? "6. Merchant data ownership" : "6. Propriété des données merchant"}</h2>
      <p>
        {isEn
          ? "You retain full ownership of your product catalog and all data you provide. FeedPlug receives only a limited license to read and process it for the purpose of providing the service (sync to marketing channels, quality diagnostics, AI optimisation if opted in). This license terminates when your subscription ends."
          : "Vous restez pleinement propriétaire de votre catalogue produits et de toutes les données que vous fournissez. FeedPlug ne reçoit qu'une licence limitée pour lire et traiter ces données afin de fournir le service (synchronisation vers les canaux marketing, diagnostic qualité, optimisation IA si opt-in). Cette licence prend fin à la résiliation de l'abonnement."}
      </p>

      <h2>{isEn ? "7. AI add-on (Pack IA)" : "7. Pack IA (option)"}</h2>
      <p>
        {isEn
          ? "The optional Pack IA (titles optimisation, ad-friendly image generation) uses third-party generative AI subprocessors (Google Vertex AI, fal.ai). By opting in, you authorise FeedPlug to send the necessary product data to these subprocessors and to store the generated output on your behalf. Generated assets are exclusively yours and inherit the underlying generator's content policy."
          : "Le Pack IA optionnel (optimisation titres, génération images optimisées pub) utilise des sous-traitants d'IA générative (Google Vertex AI, fal.ai). En activant l'option, vous autorisez FeedPlug à transmettre les données produits nécessaires à ces sous-traitants et à stocker les résultats pour votre compte. Les contenus générés vous appartiennent exclusivement et héritent de la politique du générateur sous-jacent."}
      </p>

      <h2>{isEn ? "8. Intellectual property" : "8. Propriété intellectuelle"}</h2>
      <p>
        {isEn
          ? "The FeedPlug software, design, brand and documentation are the property of FeedPlug and protected by copyright, trademark and other IP laws. You receive a limited, non-exclusive, non-transferable right to use the service during your subscription."
          : "Le logiciel, le design, la marque et la documentation FeedPlug sont la propriété de FeedPlug et protégés par les lois sur la propriété intellectuelle. Vous bénéficiez d'un droit limité, non exclusif, non transférable d'utiliser le service pendant la durée de votre abonnement."}
      </p>

      <h2>{isEn ? "9. Service availability and changes" : "9. Disponibilité et évolutions"}</h2>
      <ul>
        <li>{isEn ? "Target uptime: 99.5% measured monthly excluding scheduled maintenance windows." : "Objectif de disponibilité : 99,5% mesuré mensuellement hors fenêtres de maintenance programmées."}</li>
        <li>{isEn ? "Scheduled maintenance is announced at least 48h in advance via in-app banner and email when service impact is expected." : "Les maintenances programmées sont annoncées au moins 48h à l'avance via bannière in-app et email si un impact service est attendu."}</li>
        <li>{isEn ? "FeedPlug may update or evolve features without notice provided the core service contract is preserved." : "FeedPlug peut mettre à jour ou faire évoluer les fonctionnalités sans préavis dès lors que le contrat de service principal est préservé."}</li>
        <li>{isEn ? "Major breaking changes (e.g. removing a sync destination) are announced 60 days in advance." : "Changements majeurs (par ex. suppression d'une destination) annoncés 60 jours à l'avance."}</li>
      </ul>

      <h2>{isEn ? "10. Warranties and limitations" : "10. Garanties et limitations"}</h2>
      <p>
        {isEn
          ? "FeedPlug is provided « as is ». We make commercially reasonable efforts to ensure correct functioning but do not guarantee absence of bugs, interruption-free service, or that the service will meet every specific need."
          : "FeedPlug est fourni « en l'état ». Nous mettons en œuvre des efforts commerciaux raisonnables pour assurer son bon fonctionnement, sans garantir l'absence totale de bugs, une absence d'interruption, ni l'adéquation à un besoin spécifique."}
      </p>
      <p>
        {isEn
          ? "We do not warrant the acceptance or performance of your products on third-party marketing channels (Google Shopping, Bing, Amazon) — those channels make their own moderation and ranking decisions."
          : "Nous ne garantissons pas l'acceptation ni la performance de vos produits sur les canaux marketing tiers (Google Shopping, Bing, Amazon) — ces canaux décident souverainement de leur modération et de leur classement."}
      </p>

      <h2>{isEn ? "11. Liability" : "11. Responsabilité"}</h2>
      <p>
        {isEn
          ? "To the extent permitted by law, FeedPlug's aggregate liability for any direct damages is capped at the total amount paid by you for the service over the 12 months preceding the event giving rise to liability. Indirect damages (loss of profit, loss of opportunity, image damage, third-party penalties) are excluded."
          : "Dans la limite autorisée par la loi, la responsabilité globale de FeedPlug au titre de dommages directs est plafonnée au montant total payé par vous sur les 12 mois précédant l'événement à l'origine de la responsabilité. Les dommages indirects (perte de profit, perte de chance, atteinte à l'image, pénalités tierces) sont exclus."}
      </p>

      <h2>{isEn ? "12. Termination" : "12. Résiliation"}</h2>
      <ul>
        <li>{isEn ? "By you: cancel anytime from the billing page of the app (Shopify) or your account (Stripe). Access continues until end of paid period." : "Par vous : résilier à tout moment depuis la page facturation de l'app (Shopify) ou votre compte (Stripe). Accès maintenu jusqu'à la fin de la période payée."}</li>
        <li>{isEn ? "By us: with 30 days notice for any reason, or immediately for violation of these terms." : "Par nous : avec préavis de 30 jours pour quelque motif que ce soit, ou immédiatement en cas de violation des présentes."}</li>
        <li>{isEn ? "Upon termination: data deletion per the Privacy Policy retention schedule." : "À la résiliation : suppression des données selon le calendrier de conservation de la Politique de confidentialité."}</li>
      </ul>

      <h2>{isEn ? "13. Compliance, taxes and resale" : "13. Conformité, taxes et revente"}</h2>
      <p>
        {isEn
          ? "Stated prices are exclusive of taxes. Applicable VAT or local sales tax is added at billing. For Shopify merchants, taxes are handled by Shopify Payments. For Stripe merchants, VAT is computed at checkout."
          : "Les prix affichés s'entendent hors taxes. La TVA applicable ou la taxe locale équivalente est ajoutée à la facturation. Pour les merchants Shopify, les taxes sont gérées par Shopify Payments. Pour les merchants Stripe, la TVA est calculée au paiement."}
      </p>

      <h2>{isEn ? "14. Personal data and privacy" : "14. Données personnelles et vie privée"}</h2>
      <p>
        {isEn ? "Processing of personal data is governed by our " : "Le traitement des données personnelles est régi par notre "}
        <a href="/legal/privacy">{isEn ? "Privacy policy" : "Politique de confidentialité"}</a>
        {isEn ? ", which forms an integral part of these terms." : ", partie intégrante des présentes."}
      </p>

      <h2>{isEn ? "15. Governing law and jurisdiction" : "15. Droit applicable et juridiction"}</h2>
      <p>
        {isEn
          ? "These terms are governed by French law. Any dispute that cannot be resolved amicably will be brought before the competent French court of the registered office of FeedPlug, except where consumer protection laws give the merchant a different choice."
          : "Les présentes conditions sont régies par le droit français. Tout litige qui ne pourrait être résolu à l'amiable sera porté devant le tribunal français compétent du siège social de FeedPlug, sauf si les règles de protection du consommateur ouvrent un autre choix au merchant."}
      </p>

      <h2>{isEn ? "16. Changes to these terms" : "16. Modifications des présentes"}</h2>
      <p>
        {isEn
          ? "We may update these terms. Material changes are notified at least 30 days before they take effect via in-app banner and email. Continued use after the effective date constitutes acceptance."
          : "Nous pouvons mettre à jour ces conditions. Les changements substantiels sont notifiés au moins 30 jours avant entrée en vigueur via bannière in-app et email. La poursuite de l'utilisation après la date d'effet vaut acceptation."}
      </p>

      <h2>{isEn ? "17. Contact" : "17. Contact"}</h2>
      <p>
        <a href="mailto:support@feedplug.com">support@feedplug.com</a>
      </p>
    </div>
  );
}
