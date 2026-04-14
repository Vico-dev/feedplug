# Next steps : accès strict aux fonctionnalités du plan (grille V2)

Objectif : que chaque utilisateur n’ait accès qu’aux fonctionnalités incluses dans son plan (grille produits × canaux + add-on IA à 49 € HT/mois).

---

## 1. Modèle de données (Account)

**À faire :**

- **Conserver ou adapter `Account.plan`**  
  Aujourd’hui : `STARTER` | `PROFESSIONAL` | `ENTERPRISE`.  
  Pour la grille V2 : stocker la **tranche produits** (ex. `100` | `500` | `1000` | `2500` | `10000` | `50000`). Soit on réutilise `plan` avec ces valeurs, soit on ajoute un champ dédié `productTier` (recommandé : garder `plan` = identifiant de la tranche, ex. `TIER_100`, `TIER_500`, … `TIER_50000`).

- **Ajouter un champ add-on IA sur le compte**  
  Ex. `Account.addonIA` (booléen) ou `Account.addons` (JSON/array) avec `['IA']`.  
  Si le compte a souscrit l’add-on à 49 € HT/mois → `addonIA = true` → accès génération de titres (IA) + génération d’images (IA).

- **Canaux**  
  Pas de champ à ajouter : le nombre de canaux = nombre d’**ExportChannel** (ou de connexions d’export actives) du compte. À calculer à la volée pour les vérifications et pour l’API capabilities.

**Résumé :**

- `Account.plan` (ou `productTier`) = tranche produits (100, 500, 1K, 2.5K, 10K, 50K).
- `Account.addonIA` = true si pack IA souscrit.
- Limite canaux = 5 (au-delà = hors grille / devis). Comptage = COUNT(ExportChannel) ou équivalent par compte.

---

## 2. Backend — Module de limites (grille V2)

**Fichier :** `backend-marketing/lib/plan-limits.js` (adapter ou créer `plan-limits-v2.js`).

- **Tranches produits** : 100, 500, 1000, 2500, 10000, 50000 → `maxProducts` par tranche.
- **Canaux** : `maxChannels = 5` pour tous les comptes “dans la grille”. Au-delà = refus ou flag “sur devis”.
- **Fonctions à avoir :**
  - `getAccountPlan(prisma, accountId)` → retourne la tranche (plan) du compte.
  - `getAccountAddonIA(prisma, accountId)` → retourne true/false.
  - `checkProductLimit(prisma, accountId, currentProductCount)` → autorisé ou non selon la tranche.
  - `checkChannelLimit(prisma, accountId, currentChannelCount)` → autorisé si currentChannelCount < 5 (ou selon règle métier).
  - `canUseFeature(prisma, accountId, featureKey)` : pour `'addonIA'` (ou `'aiTitleGeneration'` / `'aiImageGeneration'`) retourner `getAccountAddonIA()`.
- **Comptage canaux** : fonction `countChannelsForAccount(prisma, accountId)` → COUNT des ExportChannel (actifs) du compte.

---

## 3. Backend — Vérifications dans les routes

**Limites à appliquer :**

| Action | Vérification |
|--------|----------------|
| Création source / flux | Déjà en place (maxFeedSources, maxFeeds). À faire évoluer vers **tranche produits** (maxProducts) et **maxChannels** si la création impacte les canaux. |
| Lancement ingestion (runs) | Vérifier que le nombre total de produits du compte ne dépasse pas la limite de la tranche (`checkProductLimit`). |
| Création / activation d’un canal d’export | Vérifier `checkChannelLimit` (ex. < 5 canaux). Au-delà, refus avec message “Hors grille, sur devis”. |
| **Génération de titres (IA)** | `POST /api/v1/enrichment/optimize-title` et tout endpoint “optimize-titles” / batch : vérifier `canUseFeature(prisma, accountId, 'addonIA')` (ou équivalent). Si false → 403 + message “Pack IA requis (+49 € HT/mois)”. |
| **Génération d’images (IA)** | `POST /api/v1/enrichment/optimize-image`, `POST /api/v1/enrichment/generate-lifestyle-image` : idem, vérifier add-on IA. Si false → 403. |
| Enrichissement “classique” (sans IA) | Selon la grille V2, l’IA (titres + images) est le seul add-on. Les autres enrichissements (règles, mapping) peuvent rester inclus dans la grille de base, sauf décision contraire. |

**Endpoints à protéger côté “IA” (add-on) :**

- `POST /api/v1/enrichment/optimize-title` (et variantes batch).
- `POST /api/v1/enrichment/optimize-image`.
- `POST /api/v1/enrichment/generate-lifestyle-image`.

Sur chacun : après vérification d’auth et d’accès au flux/item, appeler `canUseFeature(prisma, req.accountId, 'addonIA')` (ou le nom de feature retenu). Si `allowed === false`, répondre 403 avec `code: 'PLAN_FEATURE'` et message explicite.

---

## 4. API capabilities (GET /api/v1/account/capabilities)

**Réponse à exposer (alignée grille V2) :**

- `plan` ou `productTier` : tranche produits (ex. `100`, `500`, … `50000`).
- `limits` : `{ maxProducts, maxChannels: 5 }`.
- `features` : `{ addonIA: true | false }`.
- `usage` : `{ productsCount, sourcesCount, feedsCount, channelsCount }`.

Le frontend pourra ainsi :

- Afficher les bonnes limites (produits, canaux) et l’usage.
- Savoir si le pack IA est actif (`addonIA`) pour afficher ou désactiver les boutons “Génération titres IA” / “Génération images IA” et rediriger vers la page tarifs / add-on si besoin.

---

## 5. Frontend — Affichage et désactivation selon le plan

- **Config** (`frontend/src/config/plans.ts` ou équivalent) : refléter la grille V2 (tranches produits, max 5 canaux, add-on IA à 49 € HT/mois). Pas de logique métier, juste libellés et prix pour affichage.
- **Hook** `usePlanCapabilities` : consommer `GET /account/capabilities` et exposer par exemple :
  - `limits`, `usage` (dont `channelsCount`, `productsCount`),
  - `features.addonIA`,
  - `canUseAddonIA`, `canAddChannel`, `isAtProductLimit`, etc.
- **Pages / composants** :
  - **Génération de titres (IA)** : si `!canUseAddonIA`, masquer le bouton ou l’action, ou afficher un CTA “Activer le pack IA (+49 € HT/mois)” vers tarifs / facturation.
  - **Génération d’images (IA)** : idem.
  - **Ajout de canal** : si `channelsCount >= 5`, afficher “Limite atteinte (5 canaux). Sur devis pour plus.” et désactiver l’ajout.
  - **Catalogue / ingestion** : afficher une alerte ou bloquer si `productsCount` atteint la limite de la tranche (avec lien upgrade / tarifs).

Gérer les réponses 403 `code: 'PLAN_FEATURE'` ou `'PLAN_LIMIT'` : afficher le message retourné par l’API et proposer un lien vers la page tarifs ou le formulaire de contact “sur devis”.

---

## 6. Facturation / Stripe (optionnel pour la première phase)

- Créer dans Stripe les produits/prix correspondant aux tranches (100, 500, … 50K) × éventuellement nombre de canaux si tu factures par canal, ou un prix par tranche produit avec “jusqu’à 5 canaux inclus”.
- Créer un produit “Pack IA” à 49 € HT/mois et l’associer à l’add-on (abonnement séparé ou ligne additionnelle selon ton modèle Stripe).
- Lors du paiement / webhook : mettre à jour `Account.plan` (tranche) et `Account.addonIA` selon le(s) produit(s) souscrit(s).

Tu peux décider de faire d’abord les étapes 1–5 (accès strict sans Stripe grille V2), puis brancher Stripe ensuite.

---

## Ordre recommandé

1. **Modèle de données** : ajouter `addonIA` (et éventuellement renommer/adapter `plan` pour les tranches 100…50K).
2. **Backend** : adapter `plan-limits.js` (ou v2) + `countChannelsForAccount` + vérifications sur création de canal et sur les 3 endpoints IA (titres + images).
3. **API** : étendre `GET /account/capabilities` avec `channelsCount`, `maxChannels`, `addonIA`.
4. **Frontend** : config + hook + masquage/désactivation des actions “IA” et “ajout canal” selon le plan.
5. **Facturation** : quand tu es prêt, Stripe + webhooks pour mettre à jour `plan` et `addonIA`.

Une fois ces étapes en place, l’utilisateur n’a accès qu’aux fonctionnalités de son plan (tranche produits, max 5 canaux, et génération titres + images uniquement si add-on IA souscrit).
