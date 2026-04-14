# Plans et niveaux d'accès

Ce document décrit la gestion des plans (STARTER, PROFESSIONAL, ENTERPRISE) et des limites / fonctionnalités associées.

## Plans et limites

| Plan           | Produits | Sources de flux | Flux | Enrichissement IA | Score qualité |
|----------------|----------|-----------------|------|-------------------|---------------|
| **Starter**    | 1 000    | 3               | 3    | Non               | Non           |
| **Professional** | 10 000 | Illimité        | Illimité | Oui            | Oui           |
| **Enterprise** | Illimité | Illimité        | Illimité | Oui            | Oui           |

- Le plan est stocké sur le **compte** (`Account.plan`), pas sur l’utilisateur.
- Les limites sont appliquées **côté backend** (refus 403 avec `code: 'PLAN_LIMIT'` ou `'PLAN_FEATURE'`).

## Où c’est défini

- **Backend** : `backend-marketing/lib/plan-limits.js`  
  - `PLAN_LIMITS`, `PLAN_FEATURES`  
  - `getAccountPlan()`, `checkPlanLimit()`, `canUseFeature()`, `countProductsForAccount()`, `getPlanCapabilitiesForApi()`
- **Frontend** : `frontend/src/config/plans.ts`  
  - `PLAN_LIMITS`, `PLAN_FEATURES` (alignés avec le backend pour affichage)
- **Hook frontend** : `frontend/src/hooks/use-plan-capabilities.ts`  
  - Appel à `GET /api/v1/account/capabilities`  
  - Expose `plan`, `limits`, `features`, `usage`, `canUseFeature()`, `isAtLimit()`, `canAddSource`, `canAddFeed`, `canAddProducts`

## Vérifications côté backend

- **Création de source** (`POST /api/v1/ingestion/sources`) : limite `maxFeedSources` puis `maxFeeds` si création d’un flux par défaut.
- **Création de flux** (`POST /api/v1/ingestion/feeds`, `POST /api/v1/ingestion/create-missing-feeds`) : limite `maxFeeds`.
- **Lancement d’un run d’ingestion** (`POST /api/v1/ingestion/feeds/:id/runs`) : limite `maxProducts` (nombre total de produits du compte).
- **Enrichissement** (`POST .../enrichment-sources`, `POST .../apply-enrichment-sources`) : fonctionnalité `aiEnrichment` (plan Professional ou supérieur).
- **Recalcul des scores** (`POST /api/v1/ingestion/recalculate-all-scores`) : fonctionnalité `qualityScore` (plan Professional ou supérieur).

## API exposée au frontend

- **GET /api/v1/account/capabilities** (authentifié)  
  Réponse : `{ plan, limits, features, usage }`  
  - `usage` : `{ sourcesCount, feedsCount, productsCount }` pour afficher les barres de progression et les messages d’upgrade.

## Utilisation dans le frontend

```tsx
import { usePlanCapabilities } from '@/hooks/use-plan-capabilities';

function MyComponent() {
  const { plan, usage, limits, canUseFeature, canAddSource, canAddFeed } = usePlanCapabilities();

  if (!canAddSource) {
    return <p>Limite atteinte (3 sources). <Link href="/tarifs">Passer à Professional</Link></p>;
  }
  if (!canUseFeature('aiEnrichment')) {
    return <p>L’enrichissement IA est disponible à partir du plan Professional.</p>;
  }
  // ...
}
```

## Gestion des erreurs API

En cas de refus pour limite ou fonctionnalité, le backend renvoie :

- **403** avec `code: 'PLAN_LIMIT'` et `message` explicatif (ex. « Limite de votre plan (3 flux). Passez à un plan supérieur… »).
- **403** avec `code: 'PLAN_FEATURE'` et `message` (ex. « Cette fonctionnalité est disponible à partir du plan Professional. »).

Le frontend peut afficher ces messages ou rediriger vers la page tarifs / choix de plan.
