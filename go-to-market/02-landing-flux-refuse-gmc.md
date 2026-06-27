# Landing « Flux refusé par Google Merchant Center »

Page de conversion où atterrissent les prospects outbound + le futur trafic SEA/SEO de l'ad group « résolution d'erreur ».
Composant Next.js prêt à coller : voir `02-landing-flux-refuse-gmc.page.tsx`.

## SEO on-page
- **Mot-clé principal :** `flux refusé google merchant center`
- **Secondaires :** `produit refusé google shopping`, `corriger flux merchant center`, `attribut GTIN manquant`, `erreur identifier_exists`, `compte merchant center suspendu`
- **Slug :** `/flux-refuse-google-merchant-center`
- **Title :** `Flux refusé par Google Merchant Center ? Corrigez-le | Feedplug`
- **Meta description :** `Produits refusés, GTIN ou attributs manquants, compte suspendu ? Feedplug audite et corrige votre flux Google Shopping. Auditez votre flux gratuitement.`
- 1 seul H1, H2 par section, H3 par FAQ, canonical self-referencing, JSON-LD FAQPage (inclus dans le composant).

## Structure & copy

**HERO**
- H1 : *Vos produits sont refusés par Google Merchant Center ?*
- Sous-titre : *Feedplug audite votre flux, identifie chaque erreur (GTIN, attributs manquants, identifier_exists…) et génère un flux propre que Google accepte. Connectez Shopify ou un CSV, on s'occupe du reste.*
- CTA : **Auditer mon flux gratuitement** · *Sans carte bancaire · Mise en place en 10 minutes · Shopify & CSV*

**DOULEURS — « Vous reconnaissez ce blocage ? »**
1. *« Mes produits sont refusés et je ne comprends pas pourquoi »* — Google affiche des erreurs vagues, vos produits disparaissent des résultats Shopping, vous perdez des ventes en cherchant la cause.
2. *« On me réclame des GTIN, des attributs… c'est du chinois »* — GTIN, identifier_exists, google_product_category, attributs manquants : votre flux ne sort pas les bons champs, corriger produit par produit est ingérable.
3. *« Mon compte est menacé de suspension et je panique »* — chaque jour bloqué = campagnes Shopping à l'arrêt et CA en moins.

**COMMENT ÇA MARCHE — 3 étapes**
1. **Connectez votre boutique** — Shopify en un clic ou import CSV. Pas de dev, pas de plugin.
2. **On nettoie votre flux** — analyse chaque produit, détecte les erreurs (GTIN, identifier_exists, attributs, catégories) et corrige les champs.
3. **Google récupère votre flux** — URL de flux propre lue automatiquement par GMC. Vos produits repassent en règle, sans manip à chaque mise à jour.

**BLOC RÉSOLUTION — « Feedplug corrige les erreurs qui font refuser vos produits »**
- GTIN & identifiants · Attributs obligatoires · Erreurs de format · Flux toujours à jour.

**PREUVE (pas de faux témoignage — preuve de compétence) — « Ce que Feedplug vérifie »**
GTIN valides · identifier_exists · google_product_category · attributs obligatoires · images conformes · liens valides · cohérence prix · format compatible GMC.
Encart honnête : *Feedplug est un outil récent, conçu avec des marchands confrontés aux refus GMC. Auditez votre flux gratuitement et voyez par vous-même — sans engagement.*
→ **À remplacer dès le 1er case study chiffré.**

**FAQ** (6 questions : GTIN manquant, identifier_exists, compte suspendu, Shopify vs CSV, prix/essai, délai de revalidation) — voir composant.

**CTA FINAL — « Arrêtez de perdre des ventes sur des produits refusés »** · CTA répété.

## Notes d'intégration
- `CTA_HREF` → route réelle d'onboarding/signup (défaut `/choose-plan`).
- Page sous `[locale]` : si next-intl, externaliser les chaînes.
- Le clic CTA doit déclencher l'event de conversion `store_connected` (GA4 / Google Ads).
