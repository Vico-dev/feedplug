# Audit SEO — feedplug.com (front public)

Audit ciblé sur le front public : landing (/, /fr, /en), documentation (/docs, /docs/*), sans le dashboard ni l’app.

---

## 1. Métadonnées et balises title / description

### Problèmes

- **Home (/, /fr, /en)** : Aucune métadonnée dédiée. Les pages `/fr` et `/en` héritent du layout racine avec un **title/description en anglais** (« FeedPlug - Multi-channel Product Synchronization », « Centralize and synchronize your product catalogs across all channels ») alors que la home en français est la version par défaut. Incohérence langue / contenu.
- **Pas de metadata par page** pour la landing : pas de `generateMetadata` ou `metadata` dans `[locale]/(marketing)/page.tsx` ni dans un layout `[locale]` ou `[locale]/(marketing)`.
- **Documentation** : Les pages docs ont des `layout.tsx` avec title, description, openGraph, canonical — c’est bien. En revanche, la doc est servie **sans préfixe de langue** (/docs, pas /fr/docs ni /en/docs). Si une version EN de la doc existe ou est prévue, il manque des URLs et du hreflang.

### Recommandations

1. **Ajouter des métadonnées pour la home par locale**  
   - Soit `generateMetadata` dans `[locale]/(marketing)/page.tsx` qui retourne title/description (et OG) selon la locale.  
   - Soit un `layout.tsx` dans `[locale]` ou `[locale]/(marketing)` qui exporte un `metadata` dynamique (avec `params.locale`).  
   - **FR** : titre du type « FeedPlug — Centralisez et optimisez vos flux produits | Google Shopping, multi-canal », description en français (flux produits, Google Merchant Center, enrichissement IA, etc.).  
   - **EN** : équivalent en anglais, cohérent avec le contenu de la page.

2. **Enrichir les métadonnées globales** du layout racine : garder un default en anglais si besoin, mais s’assurer que les pages localisées overrident bien (template « %s | FeedPlug » est déjà là, à utiliser).

3. **Documentation** :  
   - Si la doc reste en français uniquement : ajouter dans le layout docs une balise `<html lang="fr">` si ce n’est pas déjà le cas (éviter lang="en" par défaut).  
   - Si vous ajoutez une doc EN : prévoir des URLs type `/en/docs` et des hreflang (voir section 4).

---

## 2. Sitemap et robots.txt

### Problèmes

- **Aucun sitemap** : pas de `app/sitemap.ts` (ni équivalent). Les moteurs de recherche découvrent les URLs au fil des liens, mais un sitemap explicite améliore l’indexation, surtout après mise en ligne ou ajout de pages.
- **Aucun robots.txt** : pas de `app/robots.ts` ni fichier statique `public/robots.txt`. Par défaut, tout est explorable ; vous ne pouvez pas indiquer l’emplacement du sitemap ni exclure éventuellement des chemins (ex. /api, /oauth si exposés).

### Recommandations

1. **Créer un sitemap dynamique** (`app/sitemap.ts`) qui liste au minimum :  
   - `metadataBase` (ex. https://feedplug.com),  
   - `/`, `/fr`, `/en` (home),  
   - `/docs`, `/docs/sources`, `/docs/catalogue`, `/docs/enrichissement`, `/docs/score`, `/docs/export`, `/docs/dashboard`, `/docs/compte`, `/docs/demarrage`, `/docs/faq`, `/docs/glossaire`, `/docs/roadmap`,  
   - avec `lastModified` (ou équivalent) et `changeFrequency` / `priority` si vous le souhaitez.

2. **Créer un robots.txt** (`app/robots.ts` ou `public/robots.txt`) :  
   - `User-agent: *`  
   - `Allow: /` (et éventuellement `Disallow: /api`, `/oauth`, etc. si ces routes sont accessibles en GET et ne doivent pas être indexées).  
   - `Sitemap: https://feedplug.com/sitemap.xml` (ou l’URL réelle du sitemap généré par Next).

---

## 3. Structure des URLs et canonical

### Points positifs

- Documentation : canonical et openGraph sont renseignés par page (ex. `alternates: { canonical: siteUrl + '/docs/score' }`), ce qui limite le duplicate content.

### Problèmes

- **Home** : pas de balise canonical explicite sur `/`, `/fr`, `/en`. En cas de contenu dupliqué perçu entre ces URLs (même contenu en FR/EN), un canonical par page évite la dilution.
- **Redirection /** : la racine redirige vers `/fr` ou `/en` selon la langue. C’est cohérent ; il faut s’assurer que la version canonique de la « home FR » soit bien `/fr` (ou `https://feedplug.com` si vous décidez que la racine = FR) et l’indiquer.

### Recommandations

1. **Canonical sur la home** : dans les métadonnées de la home, définir `alternates.canonical` :  
   - pour `/fr` → `https://feedplug.com/fr` (ou `https://feedplug.com` si vous considérez que la racine après redirection est la canonique),  
   - pour `/en` → `https://feedplug.com/en`.

2. **Cohérence www / non-www** : si vous utilisez une redirection permanente (ex. www → non-www ou l’inverse), s’assurer que `metadataBase` et tous les canonicals utilisent la même forme (ex. toujours `https://feedplug.com` sans www).

---

## 4. Internationalisation (hreflang)

### Problèmes

- **Pas de balises hreflang** sur la home ni dans les layouts. Pour une cible FR + EN, les moteurs doivent savoir que `/fr` = français et `/en` = anglais pour éviter duplicate content et afficher la bonne version dans les résultats.
- **Documentation** : servie sans locale (/docs). Si la doc est en français uniquement, indiquer `lang="fr"` et éventuellement un seul hreflang `fr` pour les pages docs. Si vous ajoutez une doc EN plus tard, il faudra des URLs `/en/docs/...` et des hreflang correspondants.

### Recommandations

1. **Ajouter des alternates hreflang pour la home** dans les métadonnées de la page (ou du layout) :  
   - `alternates.languages` (ou équivalent Next.js) :  
     - `fr`: `https://feedplug.com/fr`,  
     - `en`: `https://feedplug.com/en`,  
     - `x-default`: `https://feedplug.com/fr` (ou la langue par défaut).

2. **Vérifier** que le layout `[locale]` ou la page home définit bien `<html lang={locale}>` (déjà le cas dans `[locale]/layout.tsx` avec `lang={locale}`).

3. **Doc** : si vous créez des versions localisées de la doc, appliquer la même logique hreflang sur les pages concernées.

---

## 5. Contenu et structure des pages

### Points positifs

- **Landing** : un seul **H1** par page (hero), puis des **H2** pour les sections (problème, fonctionnalités, valeur, etc.) — structure claire.
- **Documentation** : chaque page docs a un **H1** (titre de la page) et des **H2** pour les sections — bon pour le référencement thématique.

### Problèmes

- **Mots-clés** : le titre et la description par défaut (anglais) ne reflètent pas les requêtes probables en français (« flux produits », « Google Merchant Center », « feed Google Shopping », « optimisation catalogue »). La home FR n’a pas de meta dédiée pour cibler ces termes.
- **Longueur du contenu** : la landing est riche en blocs (features, value, expansion, advanced, CTA). Vérifier que le contenu textuel est bien crawlable (pas uniquement en JS sans fallback) — Next avec SSR/hybrid rend le contenu, donc en principe OK.
- **Images** : la landing semble utiliser surtout des icônes (Lucide). S’il existe des images (logos, visuels), s’assurer que chaque image a un attribut **alt** pertinent (nom du produit, contexte FeedPlug, etc.). Aucune image avec alt n’a été repérée dans la page `[locale]/(marketing)/page.tsx` ; si des images sont ajoutées, les accompagner systématiquement d’un alt.

### Recommandations

1. **Optimiser title et description par langue** (voir section 1) en intégrant des expressions clés :  
   - FR : « flux produits », « Google Shopping », « Google Merchant Center », « enrichissement catalogue », « multi-canal ».  
   - EN : « product feed », « Google Shopping », « feed optimization », « multi-channel ».

2. **Ajouter une section dédiée « Pourquoi FeedPlug » ou FAQ** sur la home (même courte) avec des questions type « Comment optimiser mon feed Google Shopping ? », « Qu’est-ce qu’un flux produit ? » — cela aide au SEO thématique et aux snippets.

3. **Toutes les images** (présentes ou à venir) : attribut `alt` descriptif et si possible incluant un mot-clé pertinent sans sur-optimisation.

---

## 6. Données structurées (Schema.org)

### Problèmes

- **Aucune donnée structurée** détectée (JSON-LD) : pas de `Organization`, `WebSite`, `SoftwareApplication` ou `FAQPage` dans le code du front public. Les moteurs ne peuvent pas exploiter de rich results (snippet organisation, FAQ, etc.).

### Recommandations

1. **Ajouter un JSON-LD Organization** sur la home (et éventuellement dans le layout) : nom, URL, logo, même coordonnées de contact si vous les exposez.
2. **WebSite** avec `url`, `potentialAction` (SearchAction) si vous avez une recherche, et `inLanguage` (fr, en).
3. **Si vous ajoutez une FAQ sur la home** : schéma **FAQPage** avec les questions/réponses pour permettre l’affichage en FAQ dans les SERP.
4. **Optionnel** : **SoftwareApplication** si vous souhaitez positionner FeedPlug comme logiciel (catégorie, offre, etc.).

---

## 7. Performance et Core Web Vitals

### Points à vérifier (hors audit code détaillé)

- **LCP** : hero avec texte + formulaire ; éviter des polices ou des scripts bloquants qui retardent l’affichage.
- **CLS** : s’assurer que les blocs (hero, sections) ont des dimensions ou réservations pour éviter les décalages (ex. pas d’images sans width/height).
- **FID / INP** : formulaire et boutons ; garder les handlers légers pour ne pas bloquer le main thread.

### Recommandations

1. Utiliser **next/image** pour toute image réelle (logos, visuels) avec `width`/`height` ou `fill` pour limiter le CLS.
2. **Polices** : vous utilisez déjà Geist (next/font) — bon pour le LCP ; éviter d’ajouter des polices externes bloquantes.
3. Lancer régulièrement **PageSpeed Insights** ou **Lighthouse** sur `https://feedplug.com/fr` et `https://feedplug.com/docs` pour suivre les CWV et le « mobile-friendly ».

---

## 8. Sécurité et préférences crawl

- **HTTPS** : supposé en production (Cloud Run) — à conserver.
- **Redirections** : middleware propre (app vs marketing, locale). Pas de boucle détectée dans la logique décrite.
- Si vous exposez des pages sensibles (ex. brouillons, preview) : les exclure du crawl (robots ou noindex) pour éviter toute fuite.

---

## 9. Synthèse des actions prioritaires

| Priorité | Action |
|----------|--------|
| **Haute** | Métadonnées dédiées pour la home FR/EN (title, description, OG) + canonical par locale. |
| **Haute** | Créer `sitemap.ts` et `robots.ts` (ou robots.txt) avec Sitemap. |
| **Moyenne** | Hreflang pour /fr et /en (et x-default). |
| **Moyenne** | JSON-LD Organization + WebSite sur la home. |
| **Moyenne** | Vérifier et ajouter `alt` sur toutes les images du front public. |
| **Basse** | Enrichir la home avec une micro-FAQ et schéma FAQPage. |
| **Basse** | Suivi CWV (Lighthouse) et optimisation images (next/image) si besoin. |

---

*Audit basé sur la structure du front public (landing, docs) du dépôt FeedPlug. À mettre à jour après chaque grosse évolution (nouvelles pages, nouvelles langues, refonte).*
