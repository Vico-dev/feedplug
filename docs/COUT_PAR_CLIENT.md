# Coût par client et coût prévisionnel

## Coût prévisionnel (estimation mensuelle GCP)

Pour obtenir un **coût prévisionnel** mensuel en € (Cloud Run + Cloud SQL) selon le nombre de clients et de produits :

```bash
cd backend-marketing

# Scénario basé sur les données réelles en base (comptes + produits)
node scripts/cout-previsionnel.js

# Scénarios prédéfinis (light/medium = petit SQL 35€ ; reel = SQL type prod ~120€)
node scripts/cout-previsionnel.js --scenario light   # 5 clients, 10k produits
node scripts/cout-previsionnel.js --scenario medium # 20 clients, 100k produits
node scripts/cout-previsionnel.js --scenario heavy  # 50 clients, 500k produits
node scripts/cout-previsionnel.js --scenario reel  # ordre de grandeur "plateforme à vide" (SQL prod)

# Personnalisé
node scripts/cout-previsionnel.js --clients 15 --produits 80000
node scripts/cout-previsionnel.js --clients 30 --produits 5000 --par-client  # 5000 = moyenne par client
```

Le script utilise les tarifs publics GCP (europe-west1) et une estimation des requêtes/jour à partir des produits. Résultat : Cloud Run + Cloud SQL en €/mois (ordre de grandeur).

---

## Coût de revient par client (répartition)

FeedPlug ne dispose pas du détail des coûts GCP **par compte** (les factures sont par projet GCP). On peut toutefois **estimer** un coût par client en répartissant le coût total du mois selon l’usage de chaque compte en base.

## Script d’estimation

Dans `backend-marketing` :

```bash
cd backend-marketing

# 1. Afficher les métriques par compte (produits, flux, sources, poids)
node scripts/cost-per-client.js

# 2. Répartir un coût total mensuel (ex. 150 €) selon ces métriques
COST_TOTAL_EUR=150 node scripts/cost-per-client.js
```

Ou avec npm :

```bash
cd backend-marketing
COST_TOTAL_EUR=150 npm run cost-per-client
```

`DATABASE_URL` doit être défini (`.env` ou environnement).

## Formule

- **Poids par compte** = `produits × 1` + `flux × 50` + `sources × 20`  
  (les produits pèsent le plus : requêtes SQL, stockage, exports.)
- **Coût estimé du compte** = `Coût total GCP du mois` × (poids du compte / somme des poids).

C’est une **répartition proportionnelle** : un compte avec 2× plus de poids reçoit 2× plus de coût. Ça ne reflète pas les coûts réels par compte (GCP ne les fournit pas), mais donne un ordre de grandeur et permet de repérer les comptes les plus “coûteux” en usage.

## Affiner plus tard

- Récupérer le **coût total** depuis l’export facturation GCP (BigQuery ou CSV) et l’injecter dans `COST_TOTAL_EUR`.
- Ajouter d’autres métriques (ex. nombre d’exports, appels IA) dans le calcul du poids si tu les stockes en base.
- Optionnel : étiqueter les ressources GCP par compte (labels) pour un jour avoir des coûts réels par client (plus lourd à mettre en place).
