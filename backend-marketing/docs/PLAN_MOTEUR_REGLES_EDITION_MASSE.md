# Plan de mise en œuvre – Moteur de règles & Édition en masse

Objectif : atteindre la cible définie dans `MOTEUR_REGLES_EDITION_MASSE_SYNTHESE.md` en trois phases, avec des jalons livrables et des dépendances claires.

---

## Vue d’ensemble

| Phase | Objectif | Livrable principal |
|-------|----------|--------------------|
| **Phase 1** | Moteur de règles + édition en masse + historisation + retour au flux | Règles configurables (flux/canal, dates), édition en masse catalogue, historique et rollback |
| **Phase 2** | Corrélation avec l’enrichissement IA | Règles + IA dans le même flux ; édition en masse avec option « Optimiser par IA » |
| **Phase 3** | A/B test par canal | Tests A/B (par produit ou par segment) attachés à un canal, appliqués à l’export |

Les **canaux** (table ExportChannel) sont introduits en Phase 1 pour que le modèle de règles soit cohérent tout de suite (scope par canal). Aujourd’hui un seul canal = GMC ; les autres (Amazon, Meta, etc.) s’ajoutent au fil du temps.

---

## Phase 1 – Moteur de règles + Édition en masse

### 1.1 Modèle de données (backend-marketing)

**À créer :**

| Entité | Rôle |
|--------|------|
| **ExportChannel** | Canal d’export (GMC, puis Amazon, Meta, TikTok Shop…). Champs : `id`, `accountId`, `platform`, `channelKey`, `label`, `config` (Json), `isActive`, `createdAt`, `updatedAt`. |
| **Rule** | Règle configurable. Champs : `id`, `accountId`, `name`, `conditionJson` (filtres : catégorie, marque, flux, etc.), `actionJson` (type d’action + paramètres : set field, template, remise %), `feedIds` (Json array, vide = tous), `channelIds` (Json array, vide = tous), `startDate`, `endDate` (nullable), `runOnIngestion` (bool), `priority` (int), `isActive`, `createdAt`, `updatedAt`. |
| **FeedItemRevision** | Une révision = snapshot des champs modifiables d’un FeedItem à un instant T. Champs : `id`, `feedItemId`, `snapshotJson` (valeurs des champs concernés), `source` (enum : `ingestion` \| `rule` \| `bulk_edit` \| `manual`), `operationId` (optionnel, pour bulk), `createdAt`. Optionnel : `userId` si disponible. |
| **BulkEditOperation** | Une opération d’édition en masse. Champs : `id`, `accountId`, `feedId` (ou scope : feedIds + filtres), `changesJson` (patch appliqué), `itemCount`, `createdAt`, `userId` (optionnel). Permet « annuler la dernière édition en masse » en restaurant les révisions liées. |

**Contraintes :**
- FeedItem : s’assurer que `customfields` (JSONB) existe bien en base (déjà utilisé côté code).
- Lien Rule → Feed : via `feedIds` (tableau d’IDs). Lien Rule → ExportChannel : via `channelIds`.

**Migration :** une migration SQL (ou Prisma) qui crée les 4 tables + index (accountId, feedItemId, createdAt pour révisions, etc.).

**Seed :** pour chaque compte (ou au premier usage), créer un ExportChannel « Google Merchant Center » (platform = gmc, channelKey = gmc).

---

### 1.2 Historisation (backend)

- **Création de révisions**  
  À chaque modification d’un FeedItem (règle, édition en masse, manuelle) : avant d’écrire, enregistrer dans **FeedItemRevision** un snapshot des champs concernés (ou du full item léger) avec `source` et éventuellement `operationId` pour les bulk.
- **Limite de conservation**  
  Politique à définir (ex. garder les 50 dernières révisions par item, ou 90 jours) pour éviter une base énorme. À documenter.
- **APIs**  
  - `GET /api/v1/ingestion/items/:id/revisions` → liste des révisions (date, source, aperçu).  
  - `POST /api/v1/ingestion/items/:id/restore` body `{ revisionId }` → restaure l’item à cette révision (écrase les champs concernés, crée une nouvelle révision « manual » ou « restore »).  
  - **Retour au flux** : `POST /api/v1/ingestion/items/:id/revert-to-feed` → soit restaurer la dernière révision dont `source = ingestion`, soit (si plus simple) marquer l’item pour « ré-ingestion » et écraser les overrides au prochain run. Option alternative : endpoint qui re-fetch l’item depuis la source (Shopify, etc.) et écrase les champs modifiés. À trancher selon coût/réalisme.
- **Annuler dernière édition en masse**  
  Pour une `BulkEditOperation` donnée : lister les FeedItemRevisions avec `operationId = bulkOp.id`, puis pour chaque item appeler la logique de restore à la révision précédant cette opération (ou restaurer le snapshot « avant » si stocké).

---

### 1.3 Moteur de règles (backend)

- **Modèle d’exécution**  
  - **Condition** : prédicat sur l’item (ex. `category = X`, `brand in [A,B]`, `price &lt; 100`, `feedId in [...]`). Représentation en JSON (structure à définir : liste de critères AND/OR).  
  - **Action** : type + paramètres. Ex. : `set_field` (field, value), `set_template` (template avec placeholders {brand}, {title}), `discount_percent` (field = price, percent, category si besoin).  
- **Filtrage des règles actives**  
  - Par `feedId` de l’item (si `feedIds` non vide, l’item doit être dans la liste).  
  - Par canal : utilisé à l’**export** (voir 1.5) ; en édition en masse / prévisualisation, appliquer les règles « tous canaux » ou celles dont `channelIds` est vide.  
  - Par date : `now` entre `startDate` et `endDate` (ou `endDate` null).  
  - Ordre : `priority` (ex. numéro plus petit = appliqué en premier).  
- **Intégration**  
  - **À l’ingestion** : après insertion/mise à jour des FeedItems, pour chaque item appliquer les règles avec `runOnIngestion = true` (et scope feedIds/channelIds/dates), écrire les changements dans FeedItem + customFields, créer des révisions `source = rule`.  
  - **À la demande** : `POST /api/v1/rules/apply` (optionnel body : feedIds, channelIds, itemIds) → applique les règles concernées aux items ciblés, crée les révisions.  
- **APIs CRUD règles**  
  - `GET/POST/PATCH/DELETE /api/v1/rules` pour créer, lister, modifier, désactiver des règles.

---

### 1.4 Édition en masse (backend)

- **API**  
  `POST /api/v1/ingestion/bulk-edit` body :  
  - `feedId` (optionnel) ou `feedIds` + `filters` (marque, catégorie, etc.) ou `itemIds` explicites.  
  - `changes` : objet patch (ex. `{ title: "nouveau titre", customfields: { brand: "X" } }`).  
  → Pour chaque item concerné : créer révision « avant », appliquer le patch, sauvegarder, créer révision « après » avec `source = bulk_edit`, enregistrer une **BulkEditOperation** et lier les révisions à `operationId`.  
- **Limites**  
  - Taille de lot (ex. 500 ou 1000 par requête), pagination ou job async si très gros volume (à définir).

---

### 1.5 Export et canaux

- **Utilisation des règles à l’export**  
  Lors de la génération d’un flux pour un **canal** donné (ex. GMC) : récupérer les règles actives dont `channelIds` est vide ou contient ce canal, et dont `feedIds` est vide ou contient le flux de l’item. Appliquer ces règles « à la volée » sur une copie des données item pour produire le fichier/API d’export (sans forcément réécrire en base si la règle est « export-only » ; ou alors les règles ont déjà été appliquées à l’ingestion — à trancher : soit règles appliquées en base, soit calculées uniquement à l’export).  
  **Recommandation** : appliquer en base à l’ingestion + à la demande, et à l’export ne faire que lire les champs déjà calculés (éventuellement recalculer uniquement les règles « export-only » si on introduit ce concept plus tard).
- **ExportChannel**  
  Pour l’instant, l’export existant (GMC) est associé à « un » canal logique. Créer en base un ExportChannel GMC par compte (ou global) et faire en sorte que l’export utilise ce canal. Pas de changement majeur du flux d’export actuel, juste une référence.

---

### 1.6 Frontend (Phase 1)

- **Catalogue**  
  - Sélection multiple d’items (checkboxes, « Tout sélectionner sur la page », option « Sélectionner par filtre » si faisable).  
  - Bouton « Édition en masse » → modal : champs éditables (titre, description, brand, prix, customFields principaux, etc.) + application sur la sélection.  
  - Pour un produit : onglet ou drawer « Historique » → liste des révisions (date, source), bouton « Restaurer » (choix de la révision), bouton « Revenir au flux d’origine ».  
- **Page Règles** (nouvelle page, ex. `/regles` ou dans Paramètres)  
  - Liste des règles (nom, scope, dates, actif).  
  - Création / édition : formulaire (nom, condition : filtres, action : type + paramètres, scope : flux/canaux, dates début/fin, runOnIngestion, priorité).  
  - Bouton « Appliquer les règles maintenant » (optionnel : choisir flux ou « tous »).  
- **Retour au flux**  
  - Visible depuis la fiche produit (et éventuellement depuis l’historique en masse si on ajoute « annuler dernière édition en masse »).

---

### Jalons Phase 1 (ordre suggéré)

1. Migration + seed ExportChannel (GMC).  
2. Tables Rule, FeedItemRevision, BulkEditOperation + APIs révisions (liste, restore, revert-to-feed).  
3. Moteur de règles (évaluation condition/action, filtrage scope/dates) + intégration ingestion + endpoint apply.  
4. CRUD règles (API) + API bulk-edit.  
5. UI catalogue : sélection multiple + édition en masse + historique + retour au flux.  
6. UI page Règles (liste, CRUD, appliquer maintenant).  
7. Brancher l’export GMC sur ExportChannel et appliquer les règles à l’export si besoin (ou confirmer que tout est déjà en base).

---

## Phase 2 – Corrélation avec l’enrichissement IA

- **Ordre d’application** (documenté et implémenté) : Règles métier → Enrichissement IA (titres, descriptions, etc.) → Overrides manuels / édition en masse.  
- **Règles et IA**  
  - Possibilité d’une action de type « fill_with_ai » (ex. si titre vide ou score faible, appeler l’optimiseur titre).  
  - Ou simplement : après application des règles, les jobs/endpoints d’optimisation IA existants continuent de s’appliquer sur les champs vides ou à améliorer.  
- **Édition en masse**  
  - Dans la modal d’édition en masse (ou une action dédiée), option « Optimiser titres / descriptions par IA » sur la sélection (réutiliser la logique de la page `/ia`).  
  - Coût et confirmation utilisateur (nombre de produits, coût estimé) comme sur la page IA actuelle.

**Jalons Phase 2 :**  
1. Documenter et coder l’ordre Règles → IA → manuel dans le pipeline.  
2. Option « Optimiser par IA » dans l’édition en masse (sélection catalogue).  
3. (Optionnel) Règles avec action « fill_with_ai » pour certains champs.

---

## Phase 3 – A/B test par canal

- **Modèle**  
  - Table **ABTest** : `id`, `accountId`, `channelId` (ExportChannel), `name`, `status` (draft, running, completed), `variantType` (`random` \| `segment`), `segmentConfig` (Json, si segment : mapping segment → A/B), `startDate`, `endDate`, `createdAt`, `updatedAt`.  
  - Pour chaque item exporté vers ce canal : déterminer la variante (A ou B) selon le test actif (aléatoire par productId ou par segment). Les variantes A/B sont des champs déjà présents sur l’item (ex. `title`, `titleVariantB`) ou une table **ItemVariant** (itemId, testId, variant, value). À préciser selon si on stocke 2 colonnes par champ ou une structure plus flexible.  
- **Export**  
  - Lors de l’export vers un canal ayant un test actif : pour chaque item, choisir A ou B, puis exporter la valeur correspondante (titre A ou titre B).  
- **UI**  
  - Création / configuration d’un test A/B (canal, type random/segment, segments éventuels, dates).  
  - Gestion des variantes (saisie ou génération IA pour B).  
  - Affichage des résultats (impressions, clics, etc.) si les données sont disponibles (sinon placeholder pour intégration future).

**Jalons Phase 3 :**  
1. Modèle ABTest + ItemVariant (ou champs *_variant_b).  
2. Logique d’affectation A/B (random + segment) à l’export.  
3. UI création/test A/B par canal.  
4. Branchement export par canal sur cette logique.

---

## Dépendances et risques

- **Phase 1** ne dépend que du modèle actuel (FeedItem, customFields, ingestion). ExportChannel et Rule sont des ajouts.  
- **Phase 2** dépend de la Phase 1 (règles et édition en masse en place).  
- **Phase 3** dépend de Phase 1 (ExportChannel, export par canal) et de la décision de stockage des variantes A/B (champs vs table).  
- **Risques** : volume de révisions (politique de rétention), perfs sur gros catalogues (bulk-edit async si besoin).

---

## Récapitulatif des livrables par phase

| Phase | Backend | Frontend |
|-------|---------|----------|
| **1** | ExportChannel, Rule, FeedItemRevision, BulkEditOperation ; APIs révisions, rules CRUD + apply, bulk-edit ; moteur de règles à l’ingestion et à l’export | Catalogue : sélection, édition en masse, historique, retour au flux ; Page Règles |
| **2** | Pipeline Règles → IA → manuel ; option bulk « Optimiser par IA » | Option IA dans édition en masse |
| **3** | ABTest, variantes, affectation A/B à l’export | Page/config A/B par canal |

Ce plan peut servir de base pour estimer les sprints et répartir les tâches (backend / frontend).
