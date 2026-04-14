# 🤖 Intégration du Système de Gestion des Coûts IA

## ✅ Ce qui a été fait

### 1. Base de données
- ✅ Migration SQL créée : `backend-marketing/prisma/migrations/005_ai_management.sql`
- ✅ Tables créées :
  - `AIProvider` : Liste des providers (Gemini, OpenAI, Mistral)
  - `AIProviderKey` : Clés API avec limites et quotas
  - `AIUsage` : Tracking de chaque utilisation et coûts
  - `AICache` : Cache des résultats avec TTL

### 2. Modules créés
- ✅ `ai/cache-manager.js` : Gestion du cache (économie ~70-80%)
- ✅ `ai/provider-manager.js` : Gestion des clés API et quotas
- ✅ `ai/ai-wrapper.js` : Wrapper centralisé pour tous les appels IA
- ✅ `ai/COST_MANAGEMENT_STRATEGY.md` : Stratégie détaillée

### 3. Intégration dans les fonctions existantes
- ✅ `optimization/title-gmc.js` : Utilise maintenant le cache
- ✅ `server-minimal.js` : Appels mis à jour pour passer `prisma` et `itemId`
- ✅ Nettoyage automatique du cache toutes les 24h

### 4. Endpoints d'administration
- ✅ `GET /api/v1/ai/providers` : Lister les providers
- ✅ `GET /api/v1/ai/providers/:providerId/keys` : Lister les clés d'un provider
- ✅ `POST /api/v1/ai/providers/:providerId/keys` : Créer une clé API
- ✅ `PUT /api/v1/ai/keys/:keyId` : Mettre à jour une clé
- ✅ `DELETE /api/v1/ai/keys/:keyId` : Supprimer une clé
- ✅ `GET /api/v1/ai/usage/stats` : Statistiques d'utilisation
- ✅ `POST /api/v1/ai/cache/clean` : Nettoyer le cache manuellement

## 📋 Prochaines étapes

### 1. Appliquer la migration SQL

**Option A : Via Cloud SQL Proxy (recommandé)**
```bash
# Terminal 1 : Démarrer le proxy
cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db

# Terminal 2 : Appliquer la migration
psql -h localhost -U feedplug_user -d feedplug_marketing \
  -f backend-marketing/prisma/migrations/005_ai_management.sql
```

**Option B : Via le script**
```bash
cd backend-marketing/scripts
./apply-ai-migration.sh [MOT_DE_PASSE]
```

### 2. Configurer une clé API Gemini

Une fois la migration appliquée, vous pouvez configurer une clé API via l'API :

```bash
curl -X POST https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/ai/providers/gemini/keys \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Clé principale",
    "apiKey": "YOUR_GEMINI_API_KEY",
    "isDefault": true,
    "monthlyLimit": 10000,
    "dailyLimit": 500
  }'
```

### 3. Créer l'interface d'administration (Frontend)

Il reste à créer l'interface frontend pour :
- Visualiser les providers et leurs clés
- Ajouter/modifier/supprimer des clés API
- Voir les statistiques d'utilisation
- Configurer les quotas

### 4. Intégrer dans les autres fonctions

Les fonctions suivantes doivent être mises à jour pour utiliser le cache :
- `enrichment/description-optimizer.js` : `optimizeDescriptionWithAI`
- `enrichment/auto-categorization.js` : `categorizeAndEnrich`

## 💰 Économies attendues

### Pour 15000 produits

| Scénario | Coût sans cache | Coût avec cache | Économie |
|----------|----------------|-----------------|----------|
| Optimisation complète | ~$4.50 | ~$0.90 | **80%** |
| Nouveaux produits (5%/jour) | ~$6.75/mois | ~$1.35/mois | **80%** |
| Avec quotas (1000/mois) | ~$0.30/mois | ~$0.30/mois | **0%** (déjà limité) |

## 🔧 Configuration recommandée

### Quotas par défaut
- **Monthly limit** : 10000 requêtes/mois
- **Daily limit** : 500 requêtes/jour
- **Cache TTL** : 30 jours

### Monitoring
- Vérifier les statistiques quotidiennement
- Nettoyer le cache toutes les 24h (automatique)
- Alertes si dépassement de quota (à implémenter)

## 📊 Métriques à suivre

- Taux de cache hit : Objectif **>80%**
- Coût moyen par optimisation : Objectif **<$0.001**
- Nombre de requêtes/mois : Suivre pour ajuster les quotas
- Taux d'erreur : Objectif **<1%**

## 🚨 Notes importantes

1. **Chiffrement des clés API** : Actuellement, les clés sont stockées en clair. Il faudrait implémenter le chiffrement avant la production.

2. **Fallback** : Si Prisma n'est pas disponible ou si aucune clé n'est configurée, le système utilise l'ancien système avec `GEMINI_API_KEY` en variable d'environnement.

3. **Cache** : Le cache est automatiquement nettoyé toutes les 24h. Les entrées expirées sont supprimées lors de la vérification.

4. **Quotas** : Les quotas sont vérifiés avant chaque appel. Si une clé est épuisée, le système essaie la suivante.






