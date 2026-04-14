# Corrections multi-tenancy (13 février 2026)

## Problème

Plusieurs endpoints ne filtraient pas correctement par `accountId`, exposant des données d’un compte à un autre.

## Corrections appliquées

### 1. `POST /api/v1/ingestion/create-missing-feeds`
- **Avant** : Récupérait toutes les sources CSV sans flux, tous comptes confondus.
- **Après** : Ajout de `AND s.accountid = $1::text` pour ne traiter que les sources du compte connecté.

### 2. `POST /api/v1/ingestion/recalculate-all-scores`
- **Avant** : Recalcul possible sur n’importe quel feed, sans vérification d’accès.
- **Après** : `verifyFeedAccess()` si `feedId` fourni ; ajout de `WHERE f.accountid = $1` pour limiter aux items du compte.

### 3. `GET /api/v1/ingestion/catalogue/score`
- **Avant** : Retour des scores de tous les comptes.
- **Après** : `verifyFeedAccess()` si `feedId` fourni ; ajout de `WHERE f.accountid = $1` pour filtrer par compte.

### 4. `GET /api/v1/ingestion/items/:id`
- **Avant** : Récupération d’un item par ID / MPN / SKU sans filtrage par compte.
- **Après** : Requêtes MPN/SKU limitées au compte via JOIN Feed ; `verifyItemAccess()` pour un UUID ; clause `AND f.accountid = $2` dans la requête principale.

### 5. `GET /api/v1/ingestion/items/:id/debug`
- **Avant** : Même problème que `items/:id`.
- **Après** : Même logique que `items/:id` (MPN/SKU scopés au compte, `verifyItemAccess()` pour un UUID).

### 6. `GET /api/v1/ingestion/items/:id/score`
- **Avant** : Score accessible pour tout item par ID / MPN / SKU.
- **Après** : Filtrage par `accountId` via JOIN Feed, `verifyItemAccess()` pour un UUID.

### 7. `DELETE /api/v1/ingestion/sources/:id`
- **Avant** : `DELETE ... WHERE id = $1` (risque en cas de bug dans `verifySourceAccess`).
- **Après** : `DELETE ... WHERE id = $1 AND accountid = $2` pour renforcer la sécurité.

## Endpoints déjà conformes

- `GET/POST/PUT/DELETE` sources, feeds — filtrage existant par `accountId` / `verifySourceAccess` / `verifyFeedAccess`
- `GET feeds/:id/items` — middleware de vérification d’ownership
- `POST enrichment/*`, `optimization/*` — utilisation de `verifyItemAccess`
- `GET /dashboard/overview` — filtrage par `req.accountId`
- `GET /platforms/*` — filtrage par `req.accountId`

## Vérification recommandée

1. Créer deux comptes (A et B) avec des sources et feeds distincts.
2. Se connecter en A et vérifier qu’aucune donnée de B n’est accessible (sources, feeds, items, scores).
3. Répéter en se connectant en B.
