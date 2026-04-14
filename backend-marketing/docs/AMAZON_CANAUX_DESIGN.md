# Design : Canaux Amazon multi-marchés (FR, UK, DE, IT, ES)

## Objectif

Permettre au client de **créer plusieurs canaux Amazon** (ex. Amazon FR, puis UK, IT, ES, DE) à partir du même catalogue FeedPlug, avec export/push normalisé au format attendu par Amazon, **quel que soit le flux source** (Shopify, CSV, etc.).

## Contraintes Amazon

- **SP-API** : une même connexion (LWA : refresh_token + client_id/secret) permet d’appeler les API pour **plusieurs marketplaces** (FR, UK, DE, IT, ES) en précisant le `marketplaceId` à chaque appel.
- **Un flux = un pays** : un fichier/feed est soumis pour un marketplace donné (pas un seul fichier pour FR+DE simultanément pour les flat files).
- **Format** : à partir de juillet 2025, les anciens flux XML/flat file listing sont dépréciés ; **Listings Items API** et **JSON_LISTINGS_FEED** sont recommandés. Pour l’export CSV “prêt à l’import” Seller Central, on suit le template officiel par catégorie/marché.

## Approche recommandée : canaux = destinations d’export par marketplace

### 1. Un seul type de connexion Amazon par compte

- **PlatformConnection** avec `platform = 'amazon'` (une seule ligne par compte).
- Stocke les credentials SP-API (refresh_token, accesstoken, tokenexpiry, et dans metadata : seller_id, region, etc.).
- Une connexion Amazon permet de lister/vendre sur plusieurs marketplaces (FR, UK, DE, IT, ES) selon l’inscription du vendeur.

### 2. “Canal” = une destination d’export vers un marketplace donné

Le client doit pouvoir **créer un canal “Amazon FR”**, puis **“Amazon UK”**, etc. Chaque canal = un marketplace activé pour l’export/push.

**Option A – Nouvelle table `ExportChannel` (recommandée)**

| Champ        | Type   | Description |
|-------------|--------|-------------|
| id          | string | PK (cuid)   |
| accountId   | string | Compte FeedPlug |
| platform    | string | `'amazon'`  |
| channelKey | string | `amazon_fr`, `amazon_uk`, `amazon_de`, `amazon_it`, `amazon_es` |
| label       | string | "Amazon FR", "Amazon UK", … |
| config      | Json   | `{ marketplaceId, currency, countryCode, locale }` |
| isActive    | bool   | true par défaut |
| createdAt   | datetime | |
| updatedAt   | datetime | |

- **Créer un canal Amazon FR** = INSERT une ligne `channelKey = 'amazon_fr'`, label = "Amazon FR", config = { marketplaceId: 'A13V1IB3VIYzH9', currency: 'EUR', countryCode: 'FR', locale: 'fr_FR' }.
- Idem pour UK, DE, IT, ES avec leurs marketplace IDs et devises (GBP pour UK, EUR pour les autres EU).
- Liste des canaux = “Où exporter ?” (comme aujourd’hui “Push vers GMC” mais “Push vers Amazon FR”, “Amazon UK”, etc.).

**Avantages** : modèle clair, extensible (plus tard Cdiscount, Fnac = autres `platform`), pas de duplication de credentials, un canal = une ligne.

**Option B – Tout dans PlatformConnection.metadata**

- Une seule ligne `platform = 'amazon'` avec `metadata.marketplaces = [{ code: 'fr', label: 'Amazon FR', marketplaceId: '...', currency: 'EUR' }, ...]`.
- “Créer un canal” = ajouter un élément à ce tableau (API PATCH).

**Inconvénient** : moins structuré, plus difficile d’ajouter plus tard des options par canal (ex. règles de prix par marketplace).

**Recommandation** : **Option A** (table `ExportChannel`).

### 3. Marketplace IDs de référence (EU)

| Pays | Code canal   | Marketplace ID   | Devise | Locale  |
|------|--------------|------------------|--------|---------|
| France  | amazon_fr | A13V1IB3VIYzH9 | EUR | fr_FR   |
| UK      | amazon_uk | A1F83G8C2ARO7P | GBP | en_GB   |
| Allemagne | amazon_de | A1PA6795UKMFR9 | EUR | de_DE   |
| Italie  | amazon_it | APLT6OXPXZ7JE  | EUR | it_IT   |
| Espagne | amazon_es | A1RKKUPIHCS9HS | EUR | es_ES   |

(À valider dans la doc SP-API officielle si besoin.)

### 4. Flux de données (comme GMC)

- **Source** : toujours les **FeedItem** (+ customfields) du feed choisi, quel que soit l’origine (Shopify, CSV, etc.).
- **Normalisation** :  
  - Helpers **normalizeForAmazon(item, channelConfig)** :  
    - Titre / item_name (limites Amazon, ex. 200 car.), description / bullet_point, brand, condition, prix, devise, images, identifiants (GTIN/MPN), etc.  
    - Utilisation de la **locale / currency** du canal (ex. Amazon UK → GBP, libellés si besoin).
  - Même logique que GMC : une couche de normalisation à l’export/push pour que tout flux source produise le même format Amazon.
- **Export CSV** :  
  - Endpoint du type `GET /api/v1/ingestion/feeds/:id/export?format=csv&platform=amazon&channel=amazon_fr` (ou `channel=amazon_uk`, etc.).  
  - Génère un CSV conforme au template Amazon pour le marketplace concerné (colonnes requises/recommandées).
- **Push API** (optionnel / phase 2) :  
  - “Push vers Amazon FR” = appels Listings Items API (ou Feeds API JSON) avec `marketplaceId` du canal `amazon_fr`, en utilisant la même connexion `platform = 'amazon'` et les produits normalisés par **normalizeForAmazon**.

### 5. UX côté client

- Page Flux (ou Export) :  
  - Section “Amazon” :  
    - Si pas de connexion Amazon : “Connecter Amazon” (OAuth SP-API / LWA).  
    - Si connexion OK : liste des **canaux** (Amazon FR, Amazon UK, …).  
    - Pour chaque canal : “Télécharger CSV” et/ou “Push vers Amazon FR” (ou UK, etc.).  
- Paramétrage des canaux :  
  - “Ajouter un canal” → choix du pays (FR, UK, DE, IT, ES) → crée une ligne `ExportChannel` avec le bon `channelKey` et `config`.  
  - Possibilité de désactiver un canal (`isActive = false`) sans le supprimer.

### 6. Implémentation par étapes

1. **Modèle et API canaux**  
   - Migration : création table `ExportChannel`.  
   - API :  
     - `GET /api/v1/platforms/amazon/channels` → liste des canaux (amazon_fr, amazon_uk, …) pour le compte.  
     - `POST /api/v1/platforms/amazon/channels` → créer un canal (body : `{ channelKey: 'amazon_fr' }` ou `{ countryCode: 'FR' }`).  
     - `DELETE /api/v1/platforms/amazon/channels/:channelKey` → désactiver/supprimer un canal.

2. **Connexion Amazon**  
   - Endpoints type `GET /api/v1/platforms/amazon/auth-url`, callback, `GET /api/v1/platforms/amazon/status`, `DELETE /api/v1/platforms/amazon/disconnect` (une connexion par compte, comme GMC).

3. **Normalisation Amazon**  
   - Helpers **normalizeForAmazon** (titres, descriptions, prix, condition, disponibilité, images, identifiants) + respect des limites par marketplace (longueurs, valeurs énumérées).  
   - Réutiliser la logique existante du connecteur NestJS si utile, mais appliquer la normalisation côté backend Express (server-minimal) au moment de l’export/push, comme pour GMC.

4. **Export CSV Amazon**  
   - Même route d’export avec `platform=amazon` et `channel=amazon_fr` (ou autre).  
   - Colonnes et format selon template Amazon (par catégorie / type de produit si besoin ; sinon un jeu de colonnes commun “EU”).

5. **Push vers Amazon** (phase 2)  
   - `POST /api/v1/platforms/amazon/push/:feedId?channel=amazon_fr` (ou channel dans le body).  
   - Utilise la connexion `platform = 'amazon'`, le canal pour `marketplaceId` + currency/locale, et les produits normalisés.

---

## Résumé

- **Une connexion Amazon** par compte (credentials SP-API).  
- **Plusieurs canaux** = plusieurs marketplaces (FR, UK, DE, IT, ES) via une table **ExportChannel** (recommandé).  
- **Même catalogue** (FeedItem) pour tous les canaux ; **normalisation à l’export/push** (normalizeForAmazon) pour être conforme Amazon quel que soit le flux source.  
- Export CSV et push API par **canal** (un canal = un pays/marketplace).

Après validation de cette approche, l’implémentation peut suivre les étapes ci-dessus (d’abord canaux + export CSV, puis push API si besoin).
