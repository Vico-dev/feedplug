# 🗺️ Roadmap FeedPlug

## 📊 État Actuel

### ✅ Fonctionnalités Implémentées
- ✅ Ingestion de sources (CSV, Shopify)
- ✅ Catalogue de produits avec édition en masse
- ✅ Scoring de qualité/complétude (basé GMC)
- ✅ Recommandations cliquables pour améliorer les scores
- ✅ Sécurité robuste pour l'ingestion CSV
- ✅ Interface admin pour les leads
- ✅ Gestion des sources secondaires (stocks, avis, photos)
- ✅ Colonnes personnalisées
- ✅ **Catalogue** : pagination (50 par page, un flux à la fois), virtualisation liste, recherche serveur (`?q=`), filtres (image, prix, mis à jour), tri (titre, date, prix), suggestions recherche, URL partageable
- ✅ **Une seule page Sources** : `/sources` (redirection `/admin/sources` → `/sources`)
- ✅ **Fiche produit** : onglets (Résumé, Qualité, Champs, Enrichissement), barre d'actions sticky, choix par champ "Valeur du flux" ou "Autre valeur" en édition
- ✅ **Sentry** : erreurs fiche produit (chargement, sauvegarde, enrichissement) remontées avec tags `area` / `itemId`
- ✅ **Tests E2E** : Playwright (catalogue + fiche produit + onglets)
- ✅ **Export des Flux** : Google Merchant Center, Amazon Seller Central, Meta Catalog, Cdiscount, Rakuten, Bing, Pinterest, TikTok, Snapchat, Yandex, Baidu, Perplexity, Gemini
- ✅ **Local Inventory Ads (LIA)** : magasins par compte (Paramètres → Magasins), inventaire par magasin via API, export du flux d'inventaire local Google (`platform=lia`, une ligne par produit × magasin, fallback stock global)
- ✅ **Optimisation IA** : Gemini/Mistral API, optimisation titres/descriptions, suggestions dans l'interface, application en masse
- ✅ **Facturation Stripe** : configurateur (produits × canaux), grille tarifaire, checkout session, billing portal, webhook, factures

### ❌ Fonctionnalités Manquantes (Priorité)

---

## 🎯 Phase 1 : MVP Fonctionnel (2-3 semaines)

### 1.1 Export des Flux (PRIORITÉ HAUTE) ✅
**Objectif** : Permettre aux clients d'exporter leurs produits optimisés vers les plateformes

**Implémenté :**
- [x] Page "Flux" dans la sidebar
- [x] Création de flux d'export (Google Merchant Center, Meta Catalog, etc.)
- [x] Génération de fichiers CSV/XML selon les spécifications de chaque plateforme
- [x] Téléchargement des flux générés
- [x] Push automatique vers Google Merchant Center
- [x] Push automatique vers Amazon Seller Central
- [x] Historique des exports

**Valeur métier** : C'est le cœur du produit - sans export, pas de valeur pour le client

---

### 1.2 Optimisation IA des Produits (PRIORITÉ HAUTE) ✅
**Objectif** : Améliorer automatiquement les titres et descriptions pour chaque plateforme

**Implémenté :**
- [x] Intégration avec Gemini/Mistral API
- [x] Optimisation des titres (SEO, longueur optimale, mots-clés)
- [x] Optimisation des descriptions (longueur, structure, mots-clés)
- [x] Suggestions d'amélioration dans l'interface
- [x] Application en masse des optimisations
- [x] Automatisation de règles (automation cards)

**Valeur métier** : Différenciation concurrentielle, amélioration des performances

---

### 1.3 Score de Performance Média (PRIORITÉ MOYENNE) ✅
**Objectif** : Afficher les performances réelles des produits par canal

**Implémenté :**
- [x] Intégration Google Ads API (impressions, clics, conversions)
- [x] Intégration Meta Ads API (impressions, clics, conversions)
- [x] Intégration Amazon Ads API (SP par ASIN)
- [x] Calcul du score de performance par canal
- [x] Page Performance avec dashboard agrégé (par canal, top produits, par catégorie)
- [x] Affichage dans le catalogue et détails produit
- [x] Historique et évolution dans le temps

**Valeur métier** : Insights actionnables pour optimiser les campagnes

**Note** : La structure existe déjà (PerformanceChannel), il faut juste l'alimenter

---

## 🚀 Phase 2 : Amélioration UX & Performance (2 semaines)

### 2.1 Page Rapports & Analytics (PRIORITÉ MOYENNE) ✅
**Objectif** : Dashboard avec métriques clés

**Implémenté :**
- [x] Vue d'ensemble des scores (qualité moyenne, performance moyenne)
- [x] Graphiques d'évolution des scores
- [x] Top produits performants / à améliorer
- [x] Statistiques par source
- [x] Export des rapports

---

### 2.2 Amélioration de l'Ingestion (PRIORITÉ BASSE)
**Objectif** : Support de plus de sources

**À implémenter :**
- [ ] WooCommerce
- [ ] PrestaShop
- [ ] SFCC (Salesforce Commerce Cloud)
- [ ] ERP/PIM génériques

---

### 2.3 Planification Automatique (PRIORITÉ MOYENNE)
**Objectif** : Automatiser les imports/exports

**À implémenter :**
- [ ] Planification des imports (cron jobs)
- [ ] Planification des exports
- [ ] Notifications en cas d'erreur
- [ ] Logs détaillés des exécutions

---

## 💰 Phase 3 : Monétisation (1-2 semaines)

### 3.1 Facturation Stripe (PRIORITÉ HAUTE) ✅
**Objectif** : Facturer les clients selon leur usage

**Implémenté :**
- [x] Intégration Stripe
- [x] Grille tarifaire dynamique (produits × canaux + addon IA)
- [x] Plans tarifaires (Starter, Professional, Enterprise)
- [x] Checkout session Stripe
- [x] Billing Portal (gestion des-abonnements)
- [x] Webhooks Stripe (subscription, invoice, payment)
- [x] Génération automatique de factures
- [x] Page de facturation dans l'interface

**Valeur métier** : Nécessaire pour générer des revenus

---

### 3.2 Gestion des Abonnements (PRIORITÉ MOYENNE)
**À implémenter :**
- [ ] Changement de plan
- [ ] Gestion des limites (nombre de produits, sources, exports)
- [ ] Notifications de dépassement
- [ ] Upgrade/downgrade de plan

---

## 🔒 Phase 4 : Sécurité & Conformité (1 semaine)

### 4.1 Authentification Multi-Facteurs (PRIORITÉ MOYENNE)
**À implémenter :**
- [ ] 2FA avec TOTP
- [ ] Codes de récupération
- [ ] Gestion des sessions

---

### 4.2 Conformité RGPD (PRIORITÉ MOYENNE)
**À implémenter :**
- [ ] Export des données utilisateur
- [ ] Suppression des données (droit à l'oubli)
- [ ] Consentement cookies
- [ ] Politique de confidentialité

---

## 📈 Phase 5 : Scale & Optimisation (Ongoing)

### 5.1 Performance
- [ ] Cache Redis pour les requêtes fréquentes
- [ ] Pagination optimisée
- [ ] Lazy loading des images
- [ ] Compression des exports

### 5.2 Monitoring
- [ ] Alertes automatiques (erreurs, performance)
- [ ] Dashboard de monitoring
- [ ] Logs structurés
- [ ] Métriques de business (MRR, churn, etc.)

---

## 🎨 Phase 6 : Amélioration UX (Ongoing)

### 6.1 Onboarding
- [ ] Wizard d'onboarding pour nouveaux clients
- [ ] Tutoriels interactifs
- [ ] Templates de mapping pré-configurés

### 6.2 Interface
- [ ] Mode sombre
- [ ] Personnalisation de l'interface
- [ ] Raccourcis clavier
- [ ] Recherche avancée

---

## 🎯 Prochaines priorités

### Haute
1. **Planification cron** - imports/exports automatisés
2. **Page Sources** - refonte UX

### Moyenne
- Support WooCommerce/PrestaShop
- 2FA + RGPD
- Gestion-abonnements (Stripe portal already handles this)

---

## 🎯 Objectif MVP Complet

Un MVP complet devrait permettre à un client de :
1. ✅ Importer ses produits (CSV ou Shopify)
2. ✅ Optimiser automatiquement ses produits avec l'IA
3. ✅ Exporter ses produits optimisés vers Google Merchant Center, Amazon, Meta et autres marketplaces
4. ✅ Voir les performances de ses produits (Google Ads, Meta Ads, Amazon Ads)
5. ✅ Être facturé automatiquement via Stripe

**Statut actuel** : ~95% du MVP complet**

### ⏳ Ce qu'il reste à faire

#### Priorité Haute
- **Planification cron** : imports/exports automatisés
- **Page Sources** : refonte UX

#### Priorité Moyenne
- Support de nouvelles sources (WooCommerce, PrestaShop)
- 2FA + Conformité RGPD
- Gestion des-abonnements (upgrade/downgrade)






