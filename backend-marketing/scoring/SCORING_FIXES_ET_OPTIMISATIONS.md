# Score produit : correctifs et pistes d’optimisation

## Correctifs appliqués

### 1. ID canonique pour le score
- **Problème** : Le score était enregistré et lu avec l’ID de la requête (`params.id`), qui peut être un UUID, un MPN ou un SKU. En ouvrant une fiche par SKU puis par UUID, on ne retrouvait pas le même score.
- **Correction** : Utilisation systématique de `item.id` (UUID FeedItem) pour `getAdvancedQualityScore` et `updateAdvancedQualityScore`. Le score est toujours lié à l’entrée FeedItem, quel que soit l’identifiant utilisé dans l’URL.

### 2. Robustesse de `generateRecommendations`
- **Problème** : En cas d’erreur dans une dimension (ex. conformité), `compliance.details` pouvait être `{}` et `compliance.details.issues` être `undefined`, ce qui faisait planter `.forEach`.
- **Correction** : Utilisation de `(compliance.details?.issues || []).forEach` et accès optionnels pour `dataQuality.details?.title`, `dataQuality.details?.description`, `seo.details?.categorization` pour éviter tout crash.

### 3. Réponse API en cas d’erreur de calcul
- **Problème** : En fallback (calcul en erreur, ancien score renvoyé), l’objet renvoyé n’avait pas de `dimensions`, ce qui pouvait casser l’affichage des 6 axes côté frontend.
- **Correction** : En cas de catch, on complète `score.dimensions` avec des valeurs par défaut (0) si absentes.

## Pistes d’optimisation

1. **Persister les dimensions**  
   Stocker `dimensions` (compliance, dataQuality, seo, conversion) en JSONB dans `ProductScore` ou les déduire de `qualitydetails` pour que le fallback renvoie de vrais sous-scores et pas seulement 0.

2. **Cache / recalcul conditionnel**  
   Éviter de recalculer le score à chaque GET si `contentHash` ou `updatedAt` de l’item n’a pas changé (optionnel, avec TTL ou invalidation à la sauvegarde).

3. **Validation des champs avant calcul**  
   S’assurer que `normalizedItem` contient bien les champs attendus (title, description, imageUrl, price, etc.) et que les types sont cohérents (nombre pour price, string pour title) pour limiter les erreurs dans les sous-modules de scoring.

4. **Logging et métriques**  
   Logger les erreurs de calcul avec `itemId` et un résumé des champs manquants pour faciliter le debug et prioriser les corrections de données.

5. **Recommandations et checklist**  
   Le frontend s’attend à `qualityDetails.required` / `qualityDetails.recommended` ; le backend renvoie `qualityDetails.compliance.required|recommended`. La normalisation côté frontend gère déjà ce cas. Pour simplifier, le backend pourrait renvoyer directement `required` / `recommended` à la racine de `qualityDetails` en plus de `compliance`.
