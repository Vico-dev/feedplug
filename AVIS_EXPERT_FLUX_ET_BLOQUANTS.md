# Avis expert flux produits e‑commerce — FeedPlug

**Contexte** : Revue du produit FeedPlug par un expert flux produits e‑commerce (média & marketplaces), pour identifier les points bloquants et les risques.

---

## 1. Ce que fait FeedPlug (résumé)

- **Import** : CSV, Shopify (URL/SFTP prévus côté doc).
- **Catalogue** : agrégation par flux, scoring qualité (type GMC), colonnes custom, enrichissement IA (titres, descriptions, catégories).
- **Export** : CSV GMC (téléchargement), push API GMC (implémenté), Meta/Amazon/Mirakl prévus (connecteurs NestJS en place, peu ou pas branchés au flux réel).

**Positionnement** : centraliser et optimiser les flux produits, puis les diffuser vers Google, Meta, marketplaces.

---

## 2. Points bloquants identifiés

### 2.1 Export CSV GMC (critique)

- **Symptôme** : La roadmap et les commentaires indiquent que l’export renvoie *« Erreur lors de l’export du flux »*.
- **Cause technique probable** : Dans `backend-marketing/server-minimal.js`, l’export utilise une requête SQL brute sur `"FeedItem"` avec des colonnes en **minuscules** (`feedid`, `createdat`), alors que le schéma Prisma / migrations utilisent du **camelCase** (`feedId`, `createdAt`) pour cette table. En PostgreSQL, les identifiants non quotés sont mis en minuscules ; si la base a été créée avec des noms en camelCase (quoted), la requête échoue.
- **Impact** : Sans export CSV fiable, le client ne peut pas alimenter Google Merchant Center ni valider le flux. **Bloquant pour la valeur principale du produit.**

**Recommandation** :  
- Utiliser des identifiants quotés pour les colonnes de `FeedItem` dans toutes les requêtes brutes, par ex. `"feedId"`, `"createdAt"`, `"originId"`, `"descriptionText"`, `"descriptionHtml"`, `"imageUrl"`, etc.  
- Ou passer par le client Prisma (sans `$queryRawUnsafe`) pour éviter les écarts de casse.

---

### 2.2 Champs GMC requis / recommandés

- **Problème** : Pour être accepté par Google Merchant Center, un flux doit contenir un certain nombre de champs requis (ex. `google_product_category`). Aujourd’hui, ces champs ne sont souvent présents que via `customfields` (JSON). Si la source ne les fournit pas et qu’il n’y a pas d’auto‑catégorisation IA fiable, les produits sont rejetés ou en avertissement.
- **Impact** : Flux rejetés ou de mauvaise qualité côté GMC → annonces absentes ou sous‑performantes.

**Recommandation** :  
- Rendre **obligatoire** dans l’export au moins `google_product_category` (et si possible `product_type`), avec une valeur par défaut métier ou une catégorisation IA par défaut.  
- Documenter clairement les champs requis GMC et les mapper explicitement (y compris depuis les colonnes custom).

---

### 2.3 Double backend (NestJS vs Express)

- **Constat** :  
  - **NestJS** (`src/`) : modules Import, Export, Mapping, Billing, etc. — beaucoup de **stubs / TODO** (ex. `ExportService` ne fait que retourner des succès factices).  
  - **Express** (`backend-marketing/server-minimal.js`) : c’est là que tournent **vraiment** l’ingestion, le catalogue, l’export CSV et le push GMC.
- **Impact** :  
  - Risque de confusion (quelle API appeler, quelle doc, quel schéma).  
  - Évolutions à faire à deux endroits (ex. ajout d’un champ GMC).  
  - Connecteurs NestJS (Google, Meta, Amazon, Mirakl) **non utilisés** par le flux actuel (export / push).

**Recommandation** :  
- Soit migrer toute la logique métier (import, export, push) dans NestJS et déprécier l’API Express.  
- Soit acter Express comme backend principal et y brancher les connecteurs (Google, Meta, etc.) de façon explicite, avec une seule base et un seul schéma.

---

### 2.4 Export = seul GMC (CSV + push)

- **Constat** :  
  - Export fichier : uniquement `format=csv` et `platform=gmc`.  
  - Push API : uniquement GMC.  
  - Pas d’export Meta (Facebook Catalog), Amazon, Mirakl, Pinterest, TikTok côté **backend réel** (Express).
- **Impact** : Pour un positionnement « flux sur toutes les plateformes », le produit ne délivre aujourd’hui que pour Google. Les marketplaces et le social (Meta, etc.) sont annoncés mais non livrés côté flux.

**Recommandation** :  
- Prioriser au minimum **Meta Catalog** (CSV + push si possible), puis un canal marketplace (ex. Mirakl ou Amazon) selon la cible.  
- Réutiliser ou réimplémenter les connecteurs existants (NestJS ou Express) sur le même pipeline de données que l’export GMC.

---

### 2.5 Pas de mapping configurable par canal

- **Constat** : Le mapping source → GMC est **codé en dur** dans l’export (colonnes fixes + `customfields`). Aucune interface pour mapper « colonne source X → champ GMC Y » ou « champ custom → google_product_category ».
- **Impact** : Chaque nouveau type de source ou nouveau canal demande du dev. Peu d’autonomie pour l’e‑commerçant ou l’agence.

**Recommandation** :  
- Introduire un **mapping par flux / par canal** (source → champs cible) stocké en base, avec templates par défaut (GMC, Meta, etc.) et édition dans l’UI.

---

### 2.6 Planification et automatisation

- **Constat** : Les synchros et exports peuvent être lancés à la demande ; la roadmap mentionne cron / planification, mais l’automatisation complète (synchro + export + push à fréquence configurée) n’est pas évidente dans le code parcouru.
- **Impact** : Sans planification, le client doit revenir régulièrement pour lancer les exports / push → faible valeur pour du « flux toujours à jour ».

**Recommandation** :  
- Clarifier et documenter la planification (synchro + export) et, si possible, le push GMC/Meta planifié (ex. Cloud Scheduler ou équivalent).

---

### 2.7 Facturation et limites produit

- **Constat** : Module Billing (Pennylane) présent côté NestJS ; l’usage réel (nombre de produits, nombre d’exports, etc.) n’est pas clairement branché au backend qui fait les imports/exports (Express). Pas de vue unifiée « usage → facturation ».
- **Impact** : Risque de sous‑facturation ou de non‑alignement entre ce qui est facturé et ce qui est réellement utilisé.

**Recommandation** :  
- Aligner un seul backend avec un modèle d’usage (produits, exports, push) et l’intégration Pennylane (même si c’est d’abord manuel ou par webhook).

---

## 3. Synthèse des priorités (ordre recommandé)

| Priorité | Point bloquant / risque | Action recommandée |
|----------|--------------------------|---------------------|
| 1        | Export CSV GMC en erreur | Corriger la requête SQL (casse des colonnes `FeedItem`) et valider un export de bout en bout. |
| 2        | Champs GMC requis       | Rendre `google_product_category` (et si possible `product_type`) systématiquement renseignés ; défaut ou IA. |
| 3        | Un seul backend          | Choisir NestJS ou Express, y centraliser import/export/push et une seule base. |
| 4        | Multi‑canal              | Ajouter au moins Meta (CSV + push si possible), puis un canal marketplace. |
| 5        | Mapping par canal        | Modèle de mapping configurable (DB + UI) par flux / par plateforme. |
| 6        | Planification            | Synchro + export (et push) planifiés, documentés et opérationnels. |
| 7        | Facturation / usage      | Lier usage réel (produits, exports) au module Billing (Pennylane). |

---

## 4. Points positifs

- **Import** : CSV + Shopify opérationnels ; sécurité CSV (validation, limites) prise en compte.
- **Catalogue** : Scoring qualité type GMC, recommandations, colonnes custom, fiche produit riche.
- **IA** : Enrichissement titres/descriptions, stratégie de coûts (cache, etc.) réfléchie.
- **Push GMC** : Endpoint de push API GMC implémenté (batch, OAuth, refresh token) ; à sécuriser côté SQL (même correctif de casse que l’export).
- **Multi‑tenant** : Comptes, accès par feed, isolation par `accountId` présents.
- **Docs / roadmap** : Roadmap export et next features bien décrites ; bonne base pour prioriser.

---

## 5. Conclusion

Le produit a une **bonne base** (import, catalogue, scoring, IA, push GMC) mais plusieurs **bloquants** limitent la valeur livrée :

1. **Export CSV GMC** : erreur côté serveur (SQL probable) à corriger en priorité.  
2. **Conformité GMC** : champs requis (notamment `google_product_category`) à garantir.  
3. **Architecture** : double backend (NestJS / Express) et connecteurs non branchés au flux réel.  
4. **Couverture** : seul GMC est vraiment livré ; Meta et marketplaces sont à implémenter sur le pipeline actuel.

En corrigeant d’abord l’export CSV et la casse SQL sur `FeedItem`, puis en unifiant le backend et en ajoutant au moins Meta, FeedPlug peut tenir la promesse « branche ton flux, on s’occupe du reste » pour Google et un deuxième canal, puis étendre aux marketplaces.

---

## 6. Correctifs appliqués (suite à l’avis)

Les optimisations suivantes ont été réalisées dans `backend-marketing/server-minimal.js` :

1. **Export CSV GMC**  
   - Requête avec **colonnes explicites** et identifiants quotés (`"feedid"`, `"createdat"`, etc.) pour éviter les erreurs de casse PostgreSQL.  
   - Normalisation de l’accès aux champs (camelCase ou lowercase selon le driver).

2. **Champs GMC requis**  
   - **Valeur par défaut** pour `google_product_category` si vide : `Apparel & Accessories > Clothing`.  
   - **Valeur par défaut** pour `product_type` si vide : `Products`.  
   - Réduit les rejets de flux par Google quand la source ne fournit pas ces champs.

3. **Push GMC**  
   - Même logique : requête avec colonnes explicites et `"feedid"`.  
   - `googleProductCategory` toujours renseigné (défaut si absent).

4. **Autres requêtes FeedItem**  
   - Liste des items (pagination avec/sans recherche) : `WHERE "feedid"`, `ORDER BY "createdat"`.  
   - Force-update customfields, enrich-all, enrich-all-advanced : `WHERE "feedid"`.  
   - UPDATE enrichissement : `SET "updatedat"` pour cohérence avec le schéma.

À valider en conditions réelles : lancer un export CSV depuis la page Flux et, si possible, un push GMC.

---

*Document généré à partir de l’analyse du dépôt FeedPlug (backend NestJS, backend-marketing Express, frontend, roadmap et docs).*
