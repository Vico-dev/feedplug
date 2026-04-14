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
- ✅ **Fiche produit** : onglets (Résumé, Qualité, Champs, Enrichissement), barre d’actions sticky, choix par champ « Valeur du flux » ou « Autre valeur » en édition
- ✅ **Sentry** : erreurs fiche produit (chargement, sauvegarde, enrichissement) remontées avec tags `area` / `itemId`
- ✅ **Tests E2E** : Playwright (catalogue + fiche produit + onglets)

### ❌ Fonctionnalités Manquantes (Priorité)

---

## 🎯 Phase 1 : MVP Fonctionnel (2-3 semaines)

### 1.1 Export des Flux (PRIORITÉ HAUTE) 🔥
**Objectif** : Permettre aux clients d'exporter leurs produits optimisés vers les plateformes

**À implémenter :**
- [ ] Page "Flux" dans la sidebar (actuellement badge "3")
- [ ] Création de flux d'export (Google Merchant Center, Meta Catalog, etc.)
- [ ] Génération de fichiers CSV/XML selon les spécifications de chaque plateforme
- [ ] Téléchargement des flux générés
- [ ] Historique des exports

**Valeur métier** : C'est le cœur du produit - sans export, pas de valeur pour le client

---

### 1.2 Optimisation IA des Produits (PRIORITÉ HAUTE) 🔥
**Objectif** : Améliorer automatiquement les titres et descriptions pour chaque plateforme

**À implémenter :**
- [ ] Intégration avec Gemini/Mistral API
- [ ] Optimisation des titres (SEO, longueur optimale, mots-clés)
- [ ] Optimisation des descriptions (longueur, structure, mots-clés)
- [ ] Suggestions d'amélioration dans l'interface
- [ ] Application en masse des optimisations

**Valeur métier** : Différenciation concurrentielle, amélioration des performances

---

### 1.3 Score de Performance Média (PRIORITÉ MOYENNE)
**Objectif** : Afficher les performances réelles des produits par canal

**À implémenter :**
- [ ] Intégration Google Ads API (impressions, clics, conversions)
- [ ] Intégration Meta Ads API (impressions, clics, conversions)
- [ ] Calcul du score de performance par canal
- [ ] Affichage dans le catalogue et détails produit
- [ ] Graphiques d'évolution dans le temps

**Valeur métier** : Insights actionnables pour optimiser les campagnes

**Note** : La structure existe déjà (PerformanceChannel), il faut juste l'alimenter

---

## 🚀 Phase 2 : Amélioration UX & Performance (2 semaines)

### 2.1 Page Rapports & Analytics (PRIORITÉ MOYENNE)
**Objectif** : Dashboard avec métriques clés

**À implémenter :**
- [ ] Vue d'ensemble des scores (qualité moyenne, performance moyenne)
- [ ] Graphiques d'évolution des scores
- [ ] Top produits performants / à améliorer
- [ ] Statistiques par source
- [ ] Export des rapports

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

### 3.1 Facturation Automatique (PRIORITÉ HAUTE) 🔥
**Objectif** : Facturer les clients selon leur usage

**À implémenter :**
- [ ] Intégration Pennylane API
- [ ] Plans tarifaires (Starter, Pro, Enterprise)
- [ ] Compteur de produits traités
- [ ] Génération automatique de factures
- [ ] Page de facturation dans l'interface

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

## 📝 Recommandations Prioritaires

### 🔥 À faire IMMÉDIATEMENT (Semaine 1-2)
1. **Export des flux** - C'est la fonctionnalité principale du produit
2. **Optimisation IA** - Différenciation concurrentielle
3. **Facturation** - Nécessaire pour générer des revenus

### ⚡ À faire ENSUITE (Semaine 3-4)
4. **Score de performance média** - Complète la valeur du scoring
5. **Page Rapports** - Donne de la visibilité sur les résultats
6. **Planification automatique** - Automatise les tâches répétitives

### 📌 À faire PLUS TARD
- Support de plus de sources (WooCommerce, PrestaShop, etc.)
- 2FA et conformité RGPD
- Améliorations UX

---

## 🎯 Objectif MVP Complet

Un MVP complet devrait permettre à un client de :
1. ✅ Importer ses produits (CSV ou Shopify)
2. ⏳ Optimiser automatiquement ses produits avec l'IA
3. ⏳ Exporter ses produits optimisés vers Google Merchant Center et Meta
4. ⏳ Voir les performances de ses produits
5. ⏳ Être facturé automatiquement

**Statut actuel** : ~40% du MVP complet






