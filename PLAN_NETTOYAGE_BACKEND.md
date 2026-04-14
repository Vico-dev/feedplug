# 🧹 Plan de Nettoyage des Backends

## 🚨 Situation Actuelle (BORDEL)

On a **4 backends** déployés :
1. `feedplug-backend` (NestJS complet - inutilisé)
2. `feedplug-backend-fixed` (ne répond pas)
3. `feedplug-backend-marketing` (Prisma connecté mais erreur)
4. `feedplug-backend-minimal` (???)

Et **2 bases de données** :
1. `feedplug-db` (instance Cloud SQL)
2. `feedplug-marketing-db` (instance Cloud SQL)

**Résultat** : Complexité inutile, difficile à maintenir, coûts multipliés

---

## ✅ Plan de Nettoyage Proposé

### Étape 1 : Identifier la source de vérité (5 min)
- Quelle base a les vraies données (produits, feeds) ?
- Quel backend fonctionne actuellement avec le frontend ?

### Étape 2 : Garder UN SEUL backend (10 min)
**Choix recommandé** : `backend-marketing/server-minimal.js`
- Code le plus simple et propre
- Pas de NestJS overhead
- Toutes les features nécessaires

**Supprimer** :
- `backend/` (dossier NestJS complet)
- `backend-minimal/` (doublon)
- Services Cloud Run inutilisés

### Étape 3 : Garder UNE SEULE base (15 min)
**Choix recommandé** : Celle qui a les données
- Migrer les données si nécessaire
- Supprimer l'autre instance Cloud SQL
- **Économie** : ~50€/mois

### Étape 4 : Nettoyer Prisma (5 min)
- Garder 1 seul schéma : `backend-marketing/prisma/schema.prisma`
- Supprimer `backend/prisma/` et `prisma/` à la racine

---

## 🎯 Résultat Final

```
/feedplug
├── backend-marketing/
│   ├── server-minimal.js         ← Backend unique
│   ├── prisma/schema.prisma      ← Schéma unique
│   ├── ingestion/
│   ├── scoring/
│   ├── enrichment/
│   └── ...
├── frontend/                     ← Frontend
└── ...
```

**1 backend + 1 base + 1 schéma Prisma** = Simplicité maximale

---

## 🚀 Actions Immédiates

1. **Trouver quelle base a les données**
   ```bash
   # Tester les connexions
   gcloud sql connect feedplug-db --user=postgres
   gcloud sql connect feedplug-marketing-db --user=postgres
   
   # Dans chaque base :
   \dt  # Lister les tables
   SELECT COUNT(*) FROM "FeedItem";
   ```

2. **Fixer la connexion Prisma**
   - Vérifier DATABASE_URL pointe vers la bonne base
   - Tester localement d'abord

3. **Une fois que ça marche : supprimer le reste**

---

## ❓ Questions pour Victor

1. **Quelle base a tes vraies données ?**
   - feedplug-db
   - feedplug-marketing-db
   - Les deux ?

2. **Peux-tu te connecter en SSH/Cloud Shell pour vérifier ?**

3. **Veux-tu qu'on nettoie maintenant ou qu'on fasse d'abord marcher l'export ?**

