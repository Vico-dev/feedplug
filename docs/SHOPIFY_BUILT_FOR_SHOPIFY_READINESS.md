# FeedPlug x Built for Shopify Readiness

Date de revue: 10 juin 2026
Statut global: `PARTIAL — NEAR SUBMISSION READY`

## Verdict court

FeedPlug est maintenant une vraie app Shopify embedded sérieuse, et la plus grosse partie du gap BFS a été fermée.

Le principal écart n'est plus structurel. Il est maintenant surtout dans:

- la QA reviewable de bout en bout sur un vrai store Shopify
- les preuves externes Shopify Partner Dashboard
- la discipline de soumission (notes de review, support, capture des métriques)

## Légende

- `READY`: conforme d'après la codebase
- `PARTIAL`: bien engagé, mais il reste un écart ou une preuve manquante
- `NOT READY`: écart clair avec les attentes BFS
- `UNKNOWN`: dépend d'un signal externe au repo

## Checklist de soumission

| Domaine | Critère | Statut | Preuve / constat | Action avant soumission |
|---|---|---|---|---|
| Prérequis | App distribuable sur le Shopify App Store | `PARTIAL` | Le flow OAuth, billing et embedded app sont présents, mais la review App Store complète n'est pas revalidée ici. | Refaire une passe "App Store review" complète avant dépôt BFS. |
| Prérequis | Good Partner standing | `UNKNOWN` | Impossible à vérifier depuis le repo. | Vérifier le Partner Dashboard et l'absence d'infractions. |
| Prérequis | Minimum d'installations actives | `UNKNOWN` | Critère mesuré par Shopify, pas par le code. | Vérifier la Distribution page dans le Partner Dashboard. |
| Prérequis | Minimum d'avis et rating récent | `UNKNOWN` | Critère externe au repo. | Vérifier reviews et rating dans le Shopify App Store. |
| Performance | App Bridge chargé correctement dans le `head` | `READY` | Le script App Bridge est injecté en premier dans le `head` dans `frontend/src/app/layout.tsx`. | Garder cette implémentation et revalider après toute refonte du layout. |
| Performance | Session token auth pour l'embedded app | `READY` | L'app envoie le session token Shopify via `Authorization` dans `frontend/src/app/embedded/_components/use-embedded-fetch.ts`. | Aucun, garder comme chemin nominal. |
| Performance | Instrumentation Web Vitals Shopify | `READY` | Les métriques LCP / CLS / INP sont branchées via `shopify.webVitals.onReport` dans `frontend/src/app/embedded/_components/embedded-web-vitals.tsx`. | Brancher un vrai dashboard de suivi release si ce n'est pas déjà fait. |
| Performance | Seuils Web Vitals BFS réellement atteints en prod | `UNKNOWN` | Le repo prouve l'instrumentation, pas les mesures des 28 derniers jours. | Vérifier les métriques BFS dans Shopify + Sentry avant dépôt. |
| Intégration | App réellement embedded dans Shopify Admin | `READY` | `embedded = true` dans `shopify.app.toml`, App Bridge + `NavMenu` présents, redirection dans l'iframe après install dans `backend-marketing/server-minimal.js`. | Aucun. |
| Intégration | Garder les workflows primaires dans Shopify Admin | `PARTIAL` | Le setup principal vit maintenant dans l'embedded app: home, billing, channels, catalogue, performance. Il reste encore des liens externes non critiques vers la documentation et l'analytics avancée. | Vérifier en QA qu'aucune étape critique d'installation / setup / sync ne force une sortie de Shopify Admin. |
| Intégration | Sign-up seamless avec identifiants Shopify | `READY` | Auto-provisioning après install Shopify dans `backend-marketing/server-minimal.js`. | Aucun, juste revalider le happy path en review. |
| Intégration | Monitoring / reporting simplifié dans l'embedded app | `PARTIAL` | Une vue performance simplifiée existe dans `frontend/src/app/embedded/performance/page.tsx`, ce qui va dans le bon sens. | Garder la vue simplifiée, mais éviter d'en faire dépendre les usages critiques d'une surface externe. |
| Intégration | Réglages de connexions tierces disponibles dans Shopify Admin | `READY` | La page embedded `Channels` permet maintenant de connecter / déconnecter Google Merchant Center, Google Ads et Amazon Seller Central sans repasser par `app.feedplug.com`. | Revalider le happy path OAuth en QA store réel. |
| Expérience review | Pas de sortie externe sur les parcours critiques | `PARTIAL` | Les parcours critiques sont dans Shopify Admin. Il reste des liens externes non bloquants pour la documentation et l'analytics avancée. | Garder ces liens comme surfaces explicitement "advanced", jamais comme étape obligatoire. |
| Expérience review | Promesse produit cohérente avec le runtime | `READY` | Le copy embedded a été réaligné sur une synchronisation pilotée par Shopify + relance manuelle. | Aucun, juste vérifier les derniers textes en review finale. |
| Sécurité | OAuth immédiat après install / reinstall | `READY` | Le flow `/install` -> autorisation -> callback OAuth est bien en place dans `backend-marketing/server-minimal.js`. | Aucun. |
| Sécurité | Validation HMAC OAuth Shopify | `READY` | Les entrées install et callback vérifient maintenant correctement le HMAC. | Aucun. |
| Sécurité | Scopes minimaux | `READY` | `shopify.app.toml` ne demande plus que `read_products`. | Conserver cette discipline si de nouveaux besoins apparaissent. |
| Sécurité | Webhooks obligatoires Shopify | `READY` | `app/uninstalled`, `app_subscriptions/update` et les webhooks compliance sont déclarés dans `shopify.app.toml`. | Aucun. |
| Sécurité | Conformité GDPR Shopify | `READY` | Les topics compliance sont déclarés et gérés côté backend. | Revalider une fois en staging review si possible. |
| API Shopify | Usage GraphQL Admin API | `READY` | Les URLs Shopify pointent vers `/graphql.json` via `backend-marketing/domains/shopify/config.js`. | Aucun. |
| Storefront / thèmes | Pas d'usage de l'Asset API / modifications thème | `READY` | Aucun usage détecté de l'Asset API ni de mutations de fichiers thème dans le repo. | Aucun. |
| Catégorie BFS | Exigences catégorie marketing / analytics / ads | `UNKNOWN` | Dépend de la catégorie déclarée dans l'App Store et des critères automatiques associés. | Vérifier la Distribution page pour voir les critères spécifiques activés. |

## Écarts restants avant soumission confiante

### 1. Faire une vraie QA "review Shopify" sur un store test

À date, l'app embedded couvre bien:

- accueil
- facturation
- channels
- catalogue simplifié
- performance simplifiée

Le point à verrouiller maintenant, ce n'est plus la présence des écrans mais leur comportement réel:

- install
- billing approval / return
- OAuth Google Merchant Center
- OAuth Google Ads
- OAuth Amazon
- sync catalogue
- uninstall / reinstall
- webhooks `products/create|update|delete`

### 2. Vérifier les prérequis externes Shopify

Le code ne suffit pas pour BFS. Il faut aussi confirmer:

- standing Partner sain
- nombre d'installations actives suffisant
- reviews / rating suffisants
- Web Vitals BFS observés sur les 28 derniers jours

### 3. Définir ce qui peut légitimement rester hors Shopify

Shopify tolère qu'une surface externe existe pour des fonctions complexes, mais pas si cela casse un workflow primaire.

Règle recommandée pour FeedPlug:

- `dans Shopify`: installation, plan, connexion canaux, premier sync, état global, monitoring simplifié
- `hors Shopify`: analyses avancées, vues expertes, outils power-user, exports complexes

## Recommandation de soumission

### Ne pas déposer "à l'aveugle"

Je ne recommande pas une soumission BFS sans QA store réelle ni validation Partner Dashboard.

### Soumettre après ces 5 conditions

1. Une passe QA store test est faite de bout en bout.
2. Les retours OAuth reviennent bien dans Shopify Admin pour Google / Amazon.
3. Les webhooks catalogue sont observés en conditions réelles.
4. Les métriques BFS du Partner Dashboard sont au vert ou très proches.
5. Les notes de review et assets de soumission sont prêtes.

## Estimation honnête

Si on se concentre uniquement sur l'écart BFS restant:

- `1 à 3 jours` : possible pour devenir `submission-ready` côté produit / QA si tout se passe bien sur le store test
- `plus variable` : la partie installs / reviews / rating / métriques observées

En pratique, la question n'est pas seulement "le code est-il bon ?".
La vraie question est:

"un reviewer Shopify peut-il installer FeedPlug, le comprendre, le configurer, et faire les étapes principales sans quitter Shopify ?"

Aujourd'hui, la réponse est `presque oui`, avec encore une étape obligatoire de validation terrain.

## Preuves déjà observées

- révision backend prod déployée: `feedplug-backend-marketing-00588-lxt`
- révision frontend prod déployée: `feedplug-frontend-00537-lt7`
- version Shopify app publiée: `feedplug-7`
- smoke prod:
  - `/embedded` = `200`
  - `/embedded/billing` = `200`
  - `/embedded/channels` = `200`
  - `/embedded/sources` = `200`
  - `/embedded/performance` = `200`
  - `/health` backend = `200`
  - preflight `OPTIONS /api/v1/health` = `204`

## Sources officielles Shopify

- Built for Shopify requirements: https://shopify.dev/docs/apps/launch/built-for-shopify/requirements
- About Built for Shopify: https://shopify.dev/docs/apps/launch/built-for-shopify
- Shopify App Store requirements: https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
- App design guidelines: https://shopify.dev/docs/apps/design
- Built for Shopify requirements for embedded / marketing apps: https://shopify.dev/changelog/built-for-shopify-requirements-for-embedded-apps-and-apps-in-marketing-categories-effective-july-2025
