# Optimisation titre/description par plateforme

## Vue d'ensemble

Chaque canal (Google, Meta, Amazon, ChatGPT) a ses propres contraintes et best practices pour les titres et descriptions produits. Feedplug stocke désormais **une version optimisée par plateforme** pour éviter le duplicate content et maximiser les performances sur chaque canal.

## Structure des données

Dans `FeedItem.customfields` :

```json
{
  "optimized": {
    "gmc": { "title": "...", "description": "...", "updatedAt": "..." },
    "meta": { "title": "...", "description": "...", "updatedAt": "..." },
    "amazon": { "title": "...", "description": "...", "updatedAt": "..." },
    "chatgpt": { "title": "...", "description": "...", "updatedAt": "..." }
  },
  "optimized_title": "...",
  "optimized_description": "..."
}
```

- **`optimized[platform]`** : contenu spécifique par plateforme (prioritaire à l'export)
- **`optimized_title` / `optimized_description`** : fallback legacy (souvent = première plateforme générée)

## Priorité à l'export

Lors de l'export (`GET /ingestion/feeds/:id/export?platform=gmc|amazon|chatgpt`), le système utilise :
1. `customfields.optimized[platform].title` ou `.description` si présents
2. Sinon `optimized_title` / `optimized_description`
3. Sinon les champs source `item.title`, `descriptiontext`, etc.

## API

### Batch (plusieurs produits)
`POST /api/v1/enrichment/batch`

```json
{
  "itemIds": ["uuid1", "uuid2"],
  "optimizations": { "titles": true, "descriptions": true },
  "platform": "GMC",
  "platforms": ["gmc", "meta", "amazon"]
}
```

- **`platform`** : plateforme unique (défaut GMC)
- **`platforms`** : tableau pour optimiser pour plusieurs plateformes (une optimisation IA par plateforme, coût × N)

### Single item
`POST /api/v1/enrichment/optimize-title` avec `savePlatform: 'gmc'` pour sauvegarder dans optimized.gmc

### PATCH contenu optimisé
`PATCH /api/v1/ingestion/items/:id/optimized`

```json
{
  "platform": "gmc",
  "title": "Nouveau titre optimisé",
  "description": "Nouvelle description"
}
```

## Exports concernés

| Plateforme | Clé utilisée |
|------------|--------------|
| GMC (CSV, Push API) | `gmc` |
| Amazon | `amazon` |
| Cdiscount | `gmc` (fallback) |
| Rakuten | `gmc` (fallback) |
| ChatGPT | `chatgpt` |

## Frontend

Page **Enrichissement IA** (`/optimiser/ia`) : sélecteur de plateforme (Google, Meta, Amazon, ChatGPT) avant de lancer l'optimisation batch.
