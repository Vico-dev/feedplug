# Plan suite produit — Connecteurs, Export, Optimiser

> Suite aux points 2, 3, 4 de la roadmap

---

## 1. Audit SEO ✅

- **AUDIT_SEO_LLM.md** mis à jour : LP en FR+EN avec hreflang (fr, en, x-default), HowTo sur LP, checklist à jour.

---

## 2. Connecteurs Meta / Amazon dans le flow actuel

### État actuel

| Canal      | Backend (server-minimal) | Frontend page Flux          |
|-----------|---------------------------|-----------------------------|
| **GMC**   | ✅ Push API, OAuth, CSV   | ✅ Connect, Push, CSV       |
| **Amazon**| ✅ Export CSV par canal   | ✅ Menu CSV (FR, UK, DE…)   |
| **Meta**  | ❌ Non branché            | ❌ Pas d’UI                 |
| **Amazon Push** | ❌ Pas d’API push  | ❌ Pas de bouton Push       |

### À faire

1. **Amazon Push** (priorité haute)
   - OAuth SP-API (auth-url, callback, refresh)
   - Stocker tokens dans `PlatformConnection` (platform = 'amazon')
   - `POST /api/v1/platforms/amazon/push/:feedId?channel=amazon_fr`
   - Réutiliser la logique NestJS `AmazonConnector.uploadProducts` côté Express
   - Bouton « Push vers Amazon FR » sur la page Flux

2. **Meta** (priorité moyenne)
   - OAuth Facebook (Catalog API) ou token d’accès
   - Créer `PlatformConnection` pour `platform = 'meta'`
   - Endpoint `POST /api/v1/platforms/meta/push/:feedId` (catalogId)
   - Normalisation produits (format Meta Catalog)
   - Bouton « Push vers Meta » sur la page Flux

**Ordre recommandé** : Amazon Push (complète le flow existant) puis Meta.

---

## 3. Export Cdiscount / Rakuten

### État actuel

- Les LP existent (SEO), mais aucun export Cdiscount/Rakuten côté produit.
- Pas d’`ExportChannel` pour `platform = 'cdiscount'` ou `'rakuten'`.
- Pas de normalisation ni d’API d’export.

### À faire

1. **Modèle / base**
   - Étendre les valeurs de `platform` dans `ExportChannel` (cdiscount, rakuten).
   - `CDISCOUNT_EXPORT_CHANNELS` et `RAKUTEN_EXPORT_CHANNELS` (ou 1 canal par plateforme).

2. **Normalisation**
   - `normalizeForCdiscount(item)` : attributs Pro Seller (EAN, catégorie, référence, etc.).
   - `normalizeForRakuten(item)` : attributs Seller Space (EAN, catégorie, descriptif, etc.).

3. **Export CSV**
   - `GET /api/v1/ingestion/feeds/:id/export?format=csv&platform=cdiscount`
   - `GET /api/v1/ingestion/feeds/:id/export?format=csv&platform=rakuten`
   - Templates colonnes selon les specs Cdiscount Pro / Rakuten Seller Space.

4. **Frontend**
   - Menu « Télécharger CSV » : ajouter Cdiscount, Rakuten.
   - Appeler les nouveaux endpoints dans `flux.service.ts`.

**Références** : docs Cdiscount Pro Seller, Rakuten Seller Space pour les colonnes et champs obligatoires.

---

## 4. Onglet Optimiser (règles style Channable)

### État actuel

- Table **Rule** en base (migration 014).
- Pas d’API CRUD exposée.
- Pas de moteur d’exécution des règles.
- Pas de page « Optimiser » dans la navigation.

### À faire (par phase)

#### Phase A : APIs règles (backbone)

1. **CRUD règles**
   - `GET /api/v1/rules` (par accountId)
   - `POST /api/v1/rules`
   - `PATCH /api/v1/rules/:id`
   - `DELETE /api/v1/rules/:id`
   - Schéma : `conditionJson`, `actionJson`, `feedIds`, `channelIds`, `priority`, etc.

2. **Format conditionJson / actionJson**
   - Définir et documenter le format (voir `OPTIMISEUR_REGLES_CHANNABLE_STYLE.md`).
   - Validation des entrées côté backend.

#### Phase B : Moteur d’exécution

3. **Moteur de règles**
   - Appliquer les règles à l’ingestion (après sync) : `applyRulesToFeedItems(feedId)`.
   - Appliquer à l’export : filtrer les règles par canal et les appliquer avant génération du flux.
   - Ordre : priorité croissante, dates, scope feedIds/channelIds.

4. **Prévisualisation**
   - Endpoint `POST /api/v1/rules/preview` : produit(s) en entrée → produit(s) après règles.
   - Permet de simuler avant/après côté UI.

#### Phase C : Interface

5. **Page Optimiser**
   - Nouvelle route `/optimiser` (ou sous-page dédiée).
   - Liste des règles, création, édition, suppression.
   - Builder IF-THEN : sélection de champs, opérateurs, valeurs.
   - Lien vers flux et canaux concernés.

6. **Navigation**
   - Lien « Optimiser » dans le menu principal (dashboard).

**Effort estimé** : Phase A 1–2 j, Phase B 2–3 j, Phase C 2–3 j.

---

## Ordre de priorisation suggéré

| Priorité | Tâche                    | Effort  | Impact                     |
|----------|--------------------------|---------|----------------------------|
| 1        | Export CSV Cdiscount     | 1–2 j   | Aligne produit avec LP SEO |
| 2        | Export CSV Rakuten      | 1–2 j   | Idem                        |
| 3        | Amazon Push API         | 2–3 j   | Complète le flow Amazon     |
| 4        | APIs CRUD règles        | 1–2 j   | Base pour Optimiser         |
| 5        | Moteur règles + preview | 2–3 j   | Fonctionnalité cœur         |
| 6        | Page Optimiser + nav    | 2–3 j   | UX complète                 |
| 7        | Meta Push               | 2–3 j   | Nouveau canal               |

---

## Prochaine étape

Par quelle tâche souhaites-tu commencer ?

1. **Export Cdiscount** (le plus court pour coller aux LP)
2. **Export Rakuten** (équivalent à Cdiscount)
3. **Amazon Push** (compléter le flow existant)
4. **APIs règles + page Optimiser** (feature différenciante)
