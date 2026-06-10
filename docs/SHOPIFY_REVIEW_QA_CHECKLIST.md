# FeedPlug x Shopify Review QA Checklist

Date: 10 juin 2026
Objectif: valider la passe finale avant soumission Shopify App Store / Built for Shopify.

## Préparation

- utiliser un store de test Shopify dédié
- installer la version courante de l'app FeedPlug
- préparer un compte Google test avec accès Merchant Center
- préparer un compte Google Ads test
- préparer un compte Amazon Seller Central test si disponible
- ouvrir le Partner Dashboard pour capturer les signaux BFS

## Smoke déjà validé en prod

- `GET https://feedplug-frontend-771607738477.europe-west1.run.app/embedded` → `200`
- `GET https://feedplug-frontend-771607738477.europe-west1.run.app/embedded/billing` → `200`
- `GET https://feedplug-frontend-771607738477.europe-west1.run.app/embedded/channels` → `200`
- `GET https://feedplug-frontend-771607738477.europe-west1.run.app/embedded/sources` → `200`
- `GET https://feedplug-frontend-771607738477.europe-west1.run.app/embedded/performance` → `200`
- `GET https://feedplug-backend-marketing-771607738477.europe-west1.run.app/health` → `200`
- `OPTIONS https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/health` → `204`

## Parcours à valider dans Shopify Admin

### 1. Install / provisioning

- installer l'app depuis Shopify
- vérifier que l'embedded app s'ouvre bien dans Shopify Admin
- vérifier que la home explique clairement les prochaines étapes
- vérifier qu'aucun compte FeedPlug séparé n'est demandé

Critère de réussite:
- le merchant arrive sur FeedPlug dans Shopify Admin sans friction supplémentaire

### 2. Billing

- ouvrir `/embedded/billing`
- choisir un plan
- valider le retour Shopify après approbation
- vérifier le toast / l'état actif du plan

Critère de réussite:
- le retour billing ramène dans Shopify Admin et le plan est visible comme actif

### 3. Channels

- ouvrir `/embedded/channels`
- connecter Google Merchant Center
- connecter Google Ads
- connecter Amazon Seller Central
- vérifier les statuts connectés / déconnectés
- vérifier la sélection Merchant Center si plusieurs comptes sont détectés
- vérifier l'activation / désactivation des marketplaces Amazon

Critère de réussite:
- chaque OAuth revient dans Shopify Admin et l'état du canal est lisible sans aller sur `app.feedplug.com`

### 4. Catalogue

- ouvrir `/embedded/sources`
- déclencher une synchronisation manuelle
- vérifier que la boutique, le statut source et la date de dernier sync s'affichent
- vérifier qu'un échantillon de produits apparaît

Critère de réussite:
- un reviewer voit clairement que FeedPlug sait lire et synchroniser le catalogue Shopify

### 5. Performance

- ouvrir `/embedded/performance`
- vérifier l'affichage vide propre si aucune donnée n'est disponible
- vérifier l'affichage agrégé si des données existent
- vérifier que le lien externe restant est bien présenté comme "analyses avancées"

Critère de réussite:
- la vue embedded est utile seule; le lien externe n'est pas requis pour comprendre la valeur produit

### 6. Webhooks catalogue

- modifier un produit Shopify
- créer un produit
- supprimer un produit
- vérifier que FeedPlug reçoit et traite les webhooks `products/create`, `products/update`, `products/delete`

Critère de réussite:
- les changements Shopify déclenchent bien la logique de synchronisation attendue

### 7. Uninstall / reinstall

- désinstaller l'app
- vérifier que la désinstallation est prise en compte côté FeedPlug
- réinstaller l'app
- vérifier que le retour est propre et que la boutique peut être ré-associée

Critère de réussite:
- aucun état fantôme ni boucle OAuth après réinstallation

## Vérifications Partner Dashboard

- standing Partner OK
- app review prerequisites OK
- installations actives suffisantes
- reviews / rating suffisants
- métriques Web Vitals BFS observables

## Go / No-Go

### Go

- tous les parcours critiques passent dans Shopify Admin
- aucun lien externe n'est requis pour terminer l'installation et le setup principal
- les retours OAuth sont stables
- les webhooks sont observés en vrai
- les signaux Partner Dashboard sont compatibles avec une soumission

### No-Go

- un OAuth ne revient pas dans Shopify Admin
- le setup principal dépend encore d'une surface externe
- le provisioning / billing / reinstall est instable
- les métriques ou reviews Shopify sont insuffisants
