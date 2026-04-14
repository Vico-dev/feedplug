# Comment fonctionne l'enrichissement des product category

Ce document décrit **étape par étape** comment `google_product_category` et `product_type` sont remplis ou corrigés par FeedPlug.

---

## 1. Où sont stockées les catégories ?

- **En base** : dans la table `FeedItem`, colonne **`customfields`** (JSONB).
- Les clés utilisées sont : **`google_product_category`** et **`product_type`**.
- À l’import (CSV, Shopify), si ta source envoie ces champs, ils sont mappés dans `customfields` (voir mapping d’import). Sinon, `customfields` peut ne pas contenir ces clés.

---

## 2. Qui déclenche l’enrichissement ?

Trois cas :

| Point d’entrée | Route / contexte | Ce qui se passe |
|----------------|------------------|------------------|
| **Fiche produit** (analyse seule) | `GET /api/v1/ingestion/items/:id/enrichment-analysis` | Analyse uniquement : pas d’écriture en base. Retourne `enrichments` et `alerts`. |
| **Fiche produit** (enrichir) | `POST /api/v1/ingestion/items/:id/enrich` avec `applyEnrichments: true` | Analyse + application des enrichissements → **écriture** dans `FeedItem.customfields`. |
| **En masse (feed)** | `POST /api/v1/ingestion/feeds/:id/enrich-all` ou `enrich-all-advanced` | Même logique pour chaque item du feed : analyse → si enrichissements → **écriture** en base. |

L’enrichissement “product category” est donc **exactement** le même qu’on soit sur une fiche ou en masse ; seul le déclencheur change.

---

## 3. Flux technique (à chaque enrichissement)

Pour **un** produit, le serveur fait :

1. **Charger l’item**  
   - `FeedItem` en base (colonnes standards + `customfields`).
   - Construction d’un objet `item` avec `customFields` parsé (équivalent de `customfields` en camelCase pour le code).

2. **Appeler l’analyse**  
   - Soit **`analyzeProduct(item)`** (règles uniquement),  
   - Soit **`analyzeProductWithAI(prisma, item, true)`** (règles puis IA pour les champs encore vides).

3. **Dans `analyzeProduct`** (fichier `enrichment/auto-enrichment.js`) :

   - Pour chaque champ **recommandé** (dont `google_product_category` et `product_type`) :
     - On lit la valeur actuelle via **`getFieldValue(unifiedItem, field)`** (colonnes standards + `customFields`).
     - Si **vide** : on appelle **`tryDeduceField(unifiedItem, field)`**.
       - Pour `google_product_category` → **`deduceGoogleProductCategory(item)`** (mapping depuis `product_type` ou titre via `auto-categorization.js`).
       - Pour `product_type` → **`deduceProductType(item)`** (titre, dernier segment de la GPC, ou mots-clés).
     - Si une valeur est déduite, elle est mise dans **`enrichments[field]`**.

   - **Ensuite**, passage spécifique catégories :
     - **`google_product_category`** :
       - Valeur courante = `getFieldValue(..., 'google_product_category')` ou déjà dans `enrichments`.
       - **`validateOrMapGoogleCategory(currentGpc, unifiedItem)`** (module `auto-categorization.js`) :
         - Si **vide** → `shouldEnrich: true`, pas de `suggested`.
         - Si **déjà au format GPC** (ex. `"X > Y > Z"`) → on la garde (éventuellement rapprochée d’une catégorie connue).
         - Si **fournie mais pas GPC** (ex. "Vêtements", "Électronique") → **mapping** vers une Google Product Category ; cette valeur mappée est mise dans **`enrichments.google_product_category`**.
       - Si après validation on n’a toujours pas de catégorie et `shouldEnrich` → on rappelle **`deduceGoogleProductCategory`** et on met le résultat dans `enrichments` si non vide.
     - **`product_type`** :
       - Si **vide** et `shouldEnrich` → **`deduceProductType`** et mise dans `enrichments.product_type` si non vide.

4. **Si IA activée** (`analyzeProductWithAI`) :  
   - Après les règles, pour les champs dans **`AI_ENRICHABLE_FIELDS`** (dont **`google_product_category`**) encore vides, appel à **`enrichWithAI(prisma, item, fieldsForAI)`** (fichier `ai-enrichment.js`).  
   - L’IA renvoie une chaîne au format `"Category > Subcategory > ..."` ; elle est fusionnée dans **`enrichments`**.

5. **Application des enrichissements**  
   - **`enrichProduct(item, analysis.enrichments)`** :  
     - Prend le `customFields` actuel du produit.  
     - Pour chaque clé de `enrichments` (ex. `google_product_category`, `product_type`), fait **`updatedCustomFields[field] = value`**.  
     - Donc **`updatedCustomFields.google_product_category`** et **`updatedCustomFields.product_type`** sont mis à jour.

6. **Sauvegarde en base**  
   - Le serveur fait un **`UPDATE "FeedItem" SET customfields = $1::jsonb, "updatedat" = $2 WHERE id = $3`** avec **`updatedCustomFields`** sérialisé en JSON.  
   - Donc **`customfields`** en base contient désormais les clés **`google_product_category`** et **`product_type`** telles que calculées par l’enrichissement.

Résumé : **l’enrichissement des product category** = analyse (déduction + validation/mapping + optionnellement IA) → mise des valeurs dans **`enrichments`** → **`enrichProduct`** les copie dans **`customfields`** → le serveur **écrit** ce JSON dans **`FeedItem.customfields`**.

---

## 4. Récap logique “product category”

| Situation | Rôle de l’enrichissement |
|-----------|---------------------------|
| **`google_product_category` vide** | Déduction par règles (titre, `product_type`, mapping dans `auto-categorization.js`) ou par IA. La valeur trouvée est mise dans `enrichments.google_product_category` puis enregistrée dans `customfields`. |
| **`google_product_category` fournie mais “sale” (ex. "Vêtements")** | **`validateOrMapGoogleCategory`** la mappe vers une GPC (ex. `Apparel & Accessories > Clothing`). La valeur mappée est mise dans `enrichments` puis enregistrée. |
| **`google_product_category` déjà au format GPC** | En général conservée ; éventuellement rapprochée d’une catégorie connue. Si aucune modification, pas d’écrasement. |
| **`product_type` vide** | **`deduceProductType`** (titre, GPC, mots-clés). Si une valeur est déduite, elle est mise dans `enrichments.product_type` puis enregistrée. |
| **`product_type` fourni** | Pour l’instant on ne le modifie pas ; seul le fait qu’il soit présent est utilisé (ex. pour déduire la GPC). |

---

## 5. Fichiers concernés

| Fichier | Rôle |
|---------|------|
| **`enrichment/auto-enrichment.js`** | `analyzeProduct`, `enrichProduct`, `deduceGoogleProductCategory`, `deduceProductType`, boucle sur champs recommandés + passage validation/mapping catégories. |
| **`enrichment/auto-categorization.js`** | `validateOrMapGoogleCategory`, `validateOrMapProductType`, mapping source → GPC, liste de GPC connues. |
| **`enrichment/ai-enrichment.js`** | Enrichissement IA de `google_product_category` (et autres champs) quand les règles ne suffisent pas. |
| **`server-minimal.js`** | Routes d’enrichissement (analyse, enrich fiche, enrich-all, enrich-all-advanced) : chargement item, appel analyse, appel `enrichProduct`, UPDATE `FeedItem.customfields`. |

---

## 6. Export / push GMC

L’export CSV et le push GMC lisent **`FeedItem.customfields`** (dont **`google_product_category`** et **`product_type`**). Donc dès qu’un enrichissement a été exécuté et sauvegardé, ces valeurs sont celles qui partent dans le flux Google. Si aucun enrichissement n’a été fait, l’export utilise des valeurs par défaut (fallback) pour éviter les rejets.
