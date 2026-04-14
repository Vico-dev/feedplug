# Déploiement en production – changements catalogue / fiche produit

## Ce qui a été modifié (frontend uniquement)

- **Fiche produit** : UI alignée (PageLayout, PageHeader, Tailwind, responsive), composants extraits (ProductQualityScoreCard, ProductGainsSection, ProductMappingGrid, ProductQualityDetailsSection, ProductQualityRecommendedSection), retour catalogue avec contexte (recherche + scroll).
- **Catalogue** : sauvegarde du contexte (recherche, scroll) avant ouverture d’une fiche, restauration au retour.
- **Aucune modification backend** : pas de migration, pas de déploiement backend nécessaire pour ces changements.

## Étapes pour pousser en prod

### 1. Vérifier le build (déjà fait)

```bash
cd frontend && npm run build
```

✅ Build OK (compilé avec succès).

### 2. Commiter et pousser (si vous utilisez Git + CI/CD)

```bash
git add .
git status   # vérifier les fichiers
git commit -m "feat(catalogue): UI fiche produit, composants extraits, retour catalogue avec contexte"
git push origin main
```

Si votre CI/CD (GitHub Actions) déploie automatiquement sur `main`, le déploiement se fera après le push.

### 3. Déployer le frontend manuellement (sans CI/CD ou pour forcer un deploy)

Depuis la racine du projet :

```bash
./deploy-frontend.sh
```

- **Prérequis** : `gcloud` configuré, projet `feedplug-prod`, accès Cloud Run.
- Le script fait `cd frontend` puis `gcloud run deploy feedplug-frontend --source .` (build sur GCP).

### 4. Après le déploiement

- Ouvrir **https://app.feedplug.com** (ou l’URL de votre frontend Cloud Run).
- Tester :
  - **Catalogue** : recherche, clic sur un produit.
  - **Fiche produit** : affichage, onglets, score, champs, mapping.
  - **Retour au catalogue** : la recherche et la position de scroll doivent être conservées.

## En cas de problème

- **Erreur au build** : relancer `npm run build` dans `frontend` et corriger les erreurs TypeScript/ESLint.
- **Erreur au deploy** : vérifier `gcloud config get-value project`, les droits Cloud Run et l’URL d’API dans `deploy-frontend.sh` (`NEXT_PUBLIC_API_URL`).
- **Comportement bizarre en prod** : vérifier la console navigateur et Sentry (si configuré).

### Vérifier une erreur de déploiement

1. **Voir les builds Cloud Build**  
   [Console GCP → Cloud Build → Historique](https://console.cloud.google.com/cloud-build/builds?project=feedplug-prod)  
   Ouvrir le dernier build du dépôt `frontend` (ou « source ») et regarder les **logs** : l’erreur apparaît souvent à la fin (échec `npm run build`, quota, timeout).

2. **Voir les logs Cloud Run**  
   [Console GCP → Cloud Run → feedplug-frontend → Journaux](https://console.cloud.google.com/run/detail/europe-west1/feedplug-frontend/logs?project=feedplug-prod)  
   Utile si le déploiement réussit mais le service crash au démarrage (ex. erreur Node, port).

3. **Causes fréquentes**
   - **Build npm** : timeout ou manque de mémoire → augmenter timeout/mémoire dans Cloud Build ou simplifier le build.
   - **gcloud** : « Permission denied » → vérifier le compte actif (`gcloud auth list`) et les droits sur le projet.
   - **Image** : « Failed to deploy » → vérifier que le Dockerfile expose le port 3000 et que `CMD` lance bien le serveur (ex. `node start.js`).
