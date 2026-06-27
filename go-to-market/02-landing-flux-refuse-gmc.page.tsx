// Landing "Flux refusé par Google Merchant Center" — prête à coller.
// Destination suggérée : frontend/src/app/[locale]/(marketing)/flux-refuse-google-merchant-center/page.tsx
// Adapter CTA_HREF, les tokens de couleur et l'i18n (next-intl) avant mise en prod.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flux refusé par Google Merchant Center ? Corrigez-le | Feedplug",
  description:
    "Produits refusés, GTIN ou attributs manquants, compte suspendu ? Feedplug audite et corrige votre flux Google Shopping. Auditez votre flux gratuitement.",
  alternates: { canonical: "/flux-refuse-google-merchant-center" },
  openGraph: {
    title: "Flux refusé par Google Merchant Center ? Corrigez-le | Feedplug",
    description:
      "Feedplug audite votre flux, corrige GTIN, identifier_exists et attributs manquants, et génère un flux propre que Google accepte.",
    type: "website",
  },
};

const CTA_LABEL = "Auditer mon flux gratuitement";
const CTA_HREF = "/choose-plan"; // ou la route d'onboarding signup

const pains = [
  {
    title: "« Mes produits sont refusés et je ne comprends pas pourquoi »",
    body: "Google affiche des erreurs vagues, vos produits disparaissent des résultats Shopping, et vous perdez des ventes pendant que vous cherchez la cause.",
  },
  {
    title: "« On me réclame des GTIN, des attributs… c'est du chinois »",
    body: "GTIN, identifier_exists, google_product_category, attributs manquants : votre flux ne sort pas les bons champs, et corriger ça produit par produit est ingérable.",
  },
  {
    title: "« Mon compte est menacé de suspension et je panique »",
    body: "Avertissement de suspension, compte déjà suspendu : chaque jour bloqué, ce sont des campagnes Shopping à l'arrêt et du chiffre d'affaires en moins.",
  },
];

const steps = [
  {
    n: "1",
    title: "Connectez votre boutique",
    body: "Reliez votre boutique Shopify en un clic ou importez votre fichier CSV. Pas de développeur, pas de plugin à installer.",
  },
  {
    n: "2",
    title: "On nettoie votre flux",
    body: "Feedplug analyse chaque produit, détecte les erreurs (GTIN manquant, identifier_exists mal réglé, attributs absents, catégories invalides) et corrige les champs pour les rendre conformes aux exigences de Google.",
  },
  {
    n: "3",
    title: "Google récupère votre flux",
    body: "On génère une URL de flux propre que Google Merchant Center vient lire automatiquement. Vos produits repassent en règle, sans manipulation manuelle à chaque mise à jour.",
  },
];

const checks = [
  "GTIN présents et valides",
  "identifier_exists correctement renseigné",
  "google_product_category mappée",
  "Attributs obligatoires complets (état, disponibilité, prix, marque)",
  "Images conformes (taille, format)",
  "Liens produits valides et accessibles",
  "Cohérence prix flux / page produit",
  "Format de flux compatible Merchant Center",
];

const faq = [
  {
    q: "Que faire si Google me refuse des produits pour GTIN manquant ?",
    a: "Si vos produits ont un code-barres, Feedplug récupère et formate le GTIN correctement. S'ils n'en ont pas (produits faits main, marque propre), on règle automatiquement identifier_exists sur la bonne valeur pour que Google accepte le produit sans GTIN.",
  },
  {
    q: "C'est quoi l'erreur identifier_exists et comment la corriger ?",
    a: "C'est l'attribut qui indique à Google si votre produit a un identifiant unique (GTIN/MPN) ou non. Mal renseigné, il provoque des refus. Feedplug le détecte produit par produit et le règle correctement, sans édition manuelle du catalogue.",
  },
  {
    q: "Mon compte Merchant Center est suspendu, est-ce que Feedplug peut aider ?",
    a: "Si la suspension vient de la qualité de votre flux (attributs, GTIN, données produits), Feedplug corrige ces problèmes pour préparer une nouvelle soumission conforme. En revanche, les suspensions liées à des règles commerciales (site non conforme, politique de paiement, contenu interdit) ne se résolvent pas via le flux — on vous indique clairement la différence.",
  },
  {
    q: "Je suis sur Shopify ou j'ai juste un CSV, ça marche dans les deux cas ?",
    a: "Oui. Connexion Shopify en un clic, ou import d'un fichier CSV pour toute autre plateforme. Dans les deux cas, Feedplug génère une URL de flux propre que Google vient lire.",
  },
  {
    q: "Combien ça coûte ? Y a-t-il un essai gratuit ?",
    a: "Vous pouvez auditer votre flux gratuitement et voir les erreurs détectées sans carte bancaire. L'offre payante démarre ensuite en self-service ; vous ne payez que si vous décidez de pousser votre flux corrigé.",
  },
  {
    q: "Combien de temps pour que mes produits repassent en règle ?",
    a: "La mise en place prend environ 10 minutes. Une fois le flux corrigé et l'URL connectée à Merchant Center, Google revalide votre flux lors de sa prochaine lecture (généralement sous 24 à 72 h selon Google).",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

function CtaButton() {
  return (
    <a
      href={CTA_HREF}
      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-700"
    >
      {CTA_LABEL}
    </a>
  );
}

export default function FluxRefuseGmcPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* HERO */}
      <section className="py-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Vos produits sont refusés par Google Merchant Center ?
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          Feedplug audite votre flux, identifie chaque erreur (GTIN, attributs
          manquants, identifier_exists…) et génère un flux propre que Google
          accepte. Connectez Shopify ou un CSV, on s'occupe du reste.
        </p>
        <div className="mt-8">
          <CtaButton />
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Sans carte bancaire · Mise en place en 10 minutes · Shopify &amp; CSV
        </p>
      </section>

      {/* DOULEURS */}
      <section className="py-12">
        <h2 className="text-center text-3xl font-bold">
          Vous reconnaissez ce blocage ?
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {pains.map((p) => (
            <div key={p.title} className="rounded-xl border p-6">
              <h3 className="font-semibold">{p.title}</h3>
              <p className="mt-3 text-gray-600">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMMENT CA MARCHE */}
      <section className="py-12">
        <h2 className="text-center text-3xl font-bold">
          Un flux que Google accepte, en 3 étapes
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-xl border p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-3 text-gray-600">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <CtaButton />
        </div>
      </section>

      {/* BLOC RESOLUTION */}
      <section className="py-12">
        <h2 className="text-center text-3xl font-bold">
          Feedplug corrige les erreurs qui font refuser vos produits
        </h2>
        <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
          <div className="rounded-xl border p-6">
            <h3 className="font-semibold">GTIN &amp; identifiants</h3>
            <p className="mt-2 text-gray-600">
              Détection des GTIN manquants ou invalides et réglage correct de
              identifier_exists pour les produits sans code-barres.
            </p>
          </div>
          <div className="rounded-xl border p-6">
            <h3 className="font-semibold">Attributs obligatoires</h3>
            <p className="mt-2 text-gray-600">
              Complétion et mise en forme des attributs exigés par Google
              (catégorie produit, état, disponibilité, prix…).
            </p>
          </div>
          <div className="rounded-xl border p-6">
            <h3 className="font-semibold">Erreurs de format</h3>
            <p className="mt-2 text-gray-600">
              Images trop petites, prix incohérents, liens cassés : on les
              remonte avant que Google ne refuse.
            </p>
          </div>
          <div className="rounded-xl border p-6">
            <h3 className="font-semibold">Flux toujours à jour</h3>
            <p className="mt-2 text-gray-600">
              Votre URL de flux se met à jour automatiquement ; vos corrections
              ne se perdent pas à la prochaine synchro.
            </p>
          </div>
        </div>
      </section>

      {/* PREUVE ALTERNATIVE (pas de témoignage) */}
      <section className="py-12">
        <h2 className="text-center text-3xl font-bold">
          Ce que Feedplug vérifie sur votre flux
        </h2>
        <ul className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c} className="flex items-start gap-3">
              <span aria-hidden className="mt-1 text-green-600">
                ✓
              </span>
              <span className="text-gray-700">{c}</span>
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-8 max-w-2xl rounded-xl bg-gray-50 p-6 text-center text-gray-600">
          Feedplug est un outil récent, conçu avec des marchands confrontés aux
          refus GMC. Auditez votre flux gratuitement et voyez par vous-même les
          erreurs détectées — sans engagement.
        </p>
      </section>

      {/* FAQ */}
      <section className="py-12">
        <h2 className="text-center text-3xl font-bold">Questions fréquentes</h2>
        <div className="mx-auto mt-8 max-w-3xl divide-y">
          {faq.map((item) => (
            <details key={item.q} className="py-4">
              <summary className="cursor-pointer font-semibold">
                {item.q}
              </summary>
              <p className="mt-3 text-gray-600">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-12 text-center">
        <h2 className="text-3xl font-bold">
          Arrêtez de perdre des ventes sur des produits refusés
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-gray-600">
          Auditez votre flux en quelques minutes et voyez exactement ce qui
          bloque.
        </p>
        <div className="mt-8">
          <CtaButton />
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Sans carte bancaire · Shopify &amp; CSV · Mise en place en 10 minutes
        </p>
      </section>
    </main>
  );
}
