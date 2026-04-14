# 🤖 Gestion des Coûts IA

## 📋 Vue d'ensemble

Ce module gère tous les appels aux APIs IA (Gemini, OpenAI, etc.) avec :
- ✅ **Cache intelligent** : Évite les appels redondants (économie ~70-80%)
- ✅ **Rate limiting** : Quotas par clé API et par client
- ✅ **Tracking des coûts** : Enregistrement de chaque utilisation
- ✅ **Fallback automatique** : Rotation des clés en cas d'échec
- ✅ **Batch processing** : Optimisation des appels groupés

## 🏗️ Architecture

### Fichiers

- **`cache-manager.js`** : Gestion du cache des résultats IA
- **`provider-manager.js`** : Gestion des providers et clés API
- **`ai-wrapper.js`** : Wrapper centralisé pour tous les appels IA
- **`COST_MANAGEMENT_STRATEGY.md`** : Stratégie détaillée de réduction des coûts

### Base de données

- **`AIProvider`** : Liste des providers (Gemini, OpenAI, etc.)
- **`AIProviderKey`** : Clés API configurées avec limites
- **`AIUsage`** : Tracking de chaque utilisation
- **`AICache`** : Cache des résultats avec TTL

## 💰 Coûts Estimés

### Pour 15000 produits

**Sans optimisation** :
- Coût : $0/mois

**Avec cache + règles basiques** :
- Coût : ~$0.90 par optimisation complète
- Pour nouveaux produits uniquement : ~$6.75/mois

**Avec quotas (1000/mois)** :
- Coût : ~$0.30/mois

## 🚀 Utilisation

### Exemple : Optimisation de titre avec cache

```javascript
const { callGemini } = require('./ai/ai-wrapper');

// Le cache est automatiquement vérifié et utilisé
const optimizedTitle = await callGemini(
  prisma,
  'title_optimization',
  { title: 'T-shirt', brand: 'Nike', color: 'Bleu' },
  (inputs) => buildPrompt(inputs),
  itemId
);
```

### Exemple : Vérifier les statistiques

```javascript
const { getUsageStats } = require('./ai/provider-manager');

const stats = await getUsageStats(
  prisma,
  'gemini',
  new Date('2025-01-01'),
  new Date('2025-01-31')
);
```

## 📊 Stratégies de Réduction

1. **Cache** : 70-80% d'économie
2. **Règles basiques en priorité** : 80% d'économie
3. **Batch processing** : 20-30% d'économie supplémentaire
4. **Quotas** : Contrôle des budgets

## 🔧 Configuration

### Ajouter une clé API

```sql
INSERT INTO "AIProviderKey" (id, providerId, name, apiKey, isDefault, isActive, monthlyLimit, dailyLimit)
VALUES (
  'key_123',
  'gemini',
  'Clé principale',
  'encrypted_key_here',
  true,
  true,
  10000, -- 10000 requêtes/mois
  500    -- 500 requêtes/jour
);
```

### Configurer un provider

Les providers sont créés automatiquement via la migration `005_ai_management.sql`.

## 📈 Monitoring

- Dashboard de consommation (à créer)
- Alertes avant dépassement de quota
- Statistiques par opération
- Coûts par client






