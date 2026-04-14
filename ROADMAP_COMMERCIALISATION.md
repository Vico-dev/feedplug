# Roadmap Commercialisation FeedPlug

**Dernière mise à jour** : 10 février 2026
**Objectif** : Produit commercialisable capable de concurrencer Lengow/Channable, avec une approche data/testing supérieure pour les grands comptes.

---

## Légende

- [ ] À faire
- [x] Fait
- [~] En cours
- [!] Bloquant

---

## Phase 0 — Déjà fait (acquis)

- [x] Import sources CSV/XML/TSV/TXT (drag & drop, auto-mapping)
- [x] Enrichissement IA Gemini 2.0 Flash (titres, descriptions, images)
- [x] Templates par industrie (5 industries : mode, beauté, tech, food, home)
- [x] Cache IA intelligent (tables AICache, AIProvider, AIProviderKey, AIUsage)
- [x] Score FeedPlug 0-100 avec breakdown (titre, description, image, technique)
- [x] Export CSV Google Merchant Center (23 colonnes conformes)
- [x] Page /ia : optimiser tout le catalogue en 1 clic
- [x] Page /ia : test A/B par échantillon aléatoire OU par segment (marque, catégorie, prix, enrichissement)
- [x] Sauvegarde enrichissements IA en base (customfields JSONB)
- [x] Preview avant/après post-optimisation
- [x] Auth JWT + OAuth Google
- [x] Rôles OWNER / MANAGER / VIEWER
- [x] Shopify OAuth connector
- [x] Rate limiting (100 req/min + anti-brute force)
- [x] Cloud Scheduler pour synchros automatiques
- [x] CI/CD GitHub Actions → Cloud Run
- [x] Facturation Pennylane (plans STARTER/PRO/ENTERPRISE)
- [x] Onboarding guidé
- [x] Connecteurs Push API GMC/Meta/Amazon (code NestJS)

---

## Phase 1 — "Vendable" (2 semaines)

> Objectif : un produit qu'on peut montrer et vendre à des PME early adopters.
> Deadline cible : 22 février 2026

### 1.1 — Multi-tenancy [!] BLOQUANT

> Sans ça, tous les clients voient les mêmes données.

- [x] Ajouter `accountId` aux tables `FeedSource`, `Feed` + créer tables `Account`, `User` (migration 010)
- [x] Filtrer GET sources / GET feeds par `accountId` via middleware `extractAccount`
- [x] Associer `accountId` à la session auth (JWT payload) — login, register, /me
- [x] Tester l'isolation : nouveau compte voit 0 feeds, admin voit ses 2 feeds
- **Effort** : 3 jours
- **Risque** : Migration sur données existantes

### 1.2 — Dashboard réel

> Les métriques affichent "—" ou des données factices (1250 produits en dur).

- [x] Endpoint `GET /api/v1/dashboard/overview` (sources, feeds, produits, score moyen, enrichissements, dernières synchros)
- [x] Frontend dashboard avec données réelles (plus de hardcode)
- [x] Graphique d'évolution du score moyen sur 30 jours (après synchros avec migration 011)
- **Effort** : 1 jour

### 1.3 — Unifier le flow Push API

> Les connecteurs GMC/Meta/Amazon existent (NestJS) mais le flow principal est sur Express (server-minimal.js). Ils ne sont pas branchés.

- [x] Brancher le Google Merchant Center Content API dans le flow d'export
- [x] Ajouter un bouton "Push vers GMC" dans la page /flux (en plus du CSV)
- [x] Stocker les credentials GMC par account (OAuth2 / PlatformConnection)
- [x] Log des push (succès/échec par produit — table ExportLog + GET /platforms/export-logs)
- **Effort** : 2-3 jours

### 1.4 — Mot de passe oublié

- [x] Endpoint `POST /auth/forgot-password` (génère token, stocke en DB, expire 1h)
- [x] Endpoint `POST /auth/reset-password` (validation token + nouveau mdp bcrypt 12)
- [x] Pages frontend `/forgot-password` et `/reset-password?token=XXX`
- [x] Lien "Mot de passe oublié ?" sur la page login
- **Effort** : 0.5 jour

### 1.5 — Nettoyer les connecteurs stubs

> WooCommerce, PrestaShop, Magento affichés dans l'UI mais non fonctionnels = trompeur.

- [x] Déjà grisé avec badge "V2" dans les sources et "V2 - Bientôt" dans les exports
- [x] Seuls Shopify + CSV/XML sont actifs — ERP/PIM marqués indisponibles
- **Effort** : 0.5 jour

### 1.6 — Emails transactionnels

- [x] Email "Synchronisation terminée" (nb produits importés, insérés, mis à jour) — branché après ingestion manuelle et runs planifiés
- [x] Email "Export prêt" (après push GMC — lien vers /flux)
- [x] Email "Erreur de sync" (détails + lien dashboard) — branché en cas d'échec ingestion (manuel + scheduler)
- [x] Email "Bienvenue" après inscription
- [x] Template email sobre et professionnel (HTML)
- **Effort** : 1-2 jours

### 1.7 — Monitoring & stabilité

- [x] Intégrer Sentry (backend + frontend) — backend : instrument.js + setupExpressErrorHandler ; frontend déjà OK
- [x] Ajouter des error boundaries React (app/error.tsx + (dashboard)/error.tsx)
- [x] Health check endpoint `GET /api/v1/health` (DB, Prisma, AI, Email)
- [x] Sentry backend : @sentry/node + setupExpressErrorHandler
- [ ] Alertes Sentry → Slack/email : config manuelle (checklist dans backend-marketing/SENTRY_ALERTES.md)
- **Effort** : 0.5-1 jour

---

### Phase 1 — Statut (vérifié fév. 2026)

| # | Tâche | Statut |
|---|--------|--------|
| 1 | **1.2** Graphique score 30j | Fait : dashboard/overview + scoreEvolution, frontend graphique, migration 011 + avg_score_after. |
| 2 | **1.6** Email Sync terminée | Fait : sendSyncCompleteEmail après ingestion (runs + scheduler). |
| 3 | **1.6** Email Erreur sync | Fait : sendErrorEmail dans catch runs + scheduler. |
| 4 | **1.7** Sentry backend | Fait : @sentry/node, instrument.js, setupExpressErrorHandler. |
| 5 | **1.7** Alertes Sentry | À faire : config manuelle dans Sentry (voir SENTRY_ALERTES.md). |

---

## Phase 2 — "Enterprise-ready" (3-4 semaines)

> Objectif : convaincre un mid-market / grand compte que c'est un outil sérieux.
> Deadline cible : 22 mars 2026

### 2.1 — Métriques d'impact (le game changer)

> C'est ce que Lengow fait mal et notre avantage concurrentiel.

- [ ] Intégrer Google Ads Reporting API (impressions, clics, CTR, CPC par produit)
- [ ] Intégrer GMC Diagnostics API (statut produits, erreurs, warnings)
- [ ] Stocker les métriques quotidiennement en base (table `ProductMetrics`)
- [ ] Dashboard "Performance" : graphiques par produit, par catégorie, par marque
- [ ] Comparaison avant/après enrichissement IA (delta CTR, delta impressions)
- [ ] KPI global : "L'IA a amélioré le CTR moyen de +X% sur Y produits"
- **Effort** : 5-7 jours

### 2.2 — A/B test avancé

- [ ] Modèle de données `ABTest` (id, name, segmentFilters, startDate, endDate, status, results)
- [ ] Enregistrer formellement chaque test A/B avec date de début
- [ ] Page "Historique des tests" avec liste et résultats
- [ ] Calcul de significance statistique (p-value, intervalle de confiance)
- [ ] Auto-application du gagnant en fin de test (optionnel, configurable)
- [ ] Durée configurable (7j, 14j, 30j)
- **Effort** : 4-5 jours

### 2.3 — Rapports exportables

- [ ] Génération PDF : résumé mensuel, impact IA, top produits, recommandations
- [ ] Génération Excel : données brutes par produit (score, métriques, enrichissements)
- [ ] Envoi automatique par email (configurable : hebdo/mensuel)
- [ ] White-label possible (logo client)
- **Effort** : 3 jours

### 2.4 — Tests automatisés

- [ ] Tests unitaires backend : fonctions IA, scoring, export, ingestion (coverage > 60%)
- [ ] Tests e2e : flow complet import → enrichissement → export
- [ ] Tests frontend : pages critiques (sources, /ia, flux)
- [ ] Intégrer dans CI/CD (bloquer le deploy si tests échouent)
- **Effort** : 5 jours

### 2.5 — Connecteur WooCommerce

> Le plus demandé après Shopify dans l'e-commerce français.

- [ ] WooCommerce REST API integration (OAuth1)
- [ ] Import produits (title, description, images, price, categories, attributes)
- [ ] Sync bidirectionnelle (push des enrichissements vers WooCommerce)
- **Effort** : 3 jours

### 2.6 — Webhooks sortants

> Pour l'intégration dans les systèmes des grands comptes.

- [ ] Configurer des webhooks par event (sync_complete, export_ready, test_finished, error)
- [ ] UI de configuration dans les paramètres
- [ ] Retry automatique avec backoff exponentiel
- [ ] Logs des webhooks envoyés
- **Effort** : 2 jours

### 2.7 — Scheduling UI

- [ ] Page de configuration des synchros automatiques dans le frontend
- [ ] Choix de fréquence : toutes les heures, quotidien, hebdomadaire
- [ ] Choix de l'heure de sync
- [ ] Historique des exécutions passées (succès/échec)
- **Effort** : 1-2 jours

---

## Phase 3 — "Avantage concurrentiel" (2-3 mois)

> Objectif : ce que Lengow/Channable ne font pas. L'intelligence data.
> Deadline cible : mai 2026

### 3.1 — Prédiction de performance

- [ ] Modèle ML : prédire le CTR d'un titre/description avant publication
- [ ] Score de confiance : "Ce titre devrait performer +25% mieux"
- [ ] Entraînement sur les données historiques des clients
- [ ] A/B test automatique avec sélection du meilleur

### 3.2 — Multi-variantes automatisées

- [ ] Générer N variantes de titres/descriptions pour un même produit
- [ ] Rotation automatique (chaque variante est testée X jours)
- [ ] Convergence vers le meilleur performer
- [ ] Interface de suivi des variantes actives

### 3.3 — Analyse concurrentielle

- [ ] Scraping des annonces Shopping concurrentes par catégorie
- [ ] Comparaison : "Vos titres sont 30% plus courts que la moyenne du marché"
- [ ] Recommandations basées sur les patterns gagnants du marché
- [ ] Alertes : "Un concurrent a modifié ses prix sur X produits"

### 3.4 — Détection d'anomalies

- [ ] Alertes proactives : "Produit X a perdu 50% d'impressions cette semaine"
- [ ] Détection de rupture de stock chez les concurrents = opportunité
- [ ] Alertes prix : variations inhabituelles
- [ ] Digest quotidien automatique

### 3.5 — API publique + documentation

- [ ] API REST documentée (OpenAPI/Swagger)
- [ ] Clés API par compte
- [ ] Rate limits par plan
- [ ] Documentation développeur (guide d'intégration)
- [ ] SDK JavaScript/Python (optionnel)

### 3.6 — Connecteurs supplémentaires

- [ ] PrestaShop
- [ ] Magento 2
- [ ] BigCommerce
- [ ] Custom API (connecteur générique REST/GraphQL)
- [ ] Google Sheets (import/export)

---

## Suivi d'avancement

| Phase | Statut | Progression | Deadline |
|-------|--------|-------------|----------|
| Phase 0 | Terminée | 100% | — |
| Phase 1 | Quasi terminée | ~90% | 22 fév. 2026 |
| Phase 2 | — | 0% | 22 mars 2026 |
| Phase 3 | — | 0% | Mai 2026 |

### Métriques de suivi

| Indicateur | Actuel | Cible Phase 1 | Cible Phase 2 |
|------------|--------|---------------|---------------|
| Multi-tenancy | Non | Oui | Oui |
| Connecteurs actifs | 2 (CSV, Shopify) | 2 | 3 (+WooCommerce) |
| Push API fonctionnel | Non (CSV only) | GMC | GMC + Meta |
| Dashboard réel | Non | Oui | Oui + métriques |
| Tests coverage | ~5% | 20% | 60% |
| Emails transactionnels | 0 | 4 types | 6 types |
| A/B test | Basique | Par segment | Avancé (significance) |
| Métriques d'impact | Non | Non | Oui (CTR, impressions) |
| Rapports | Non | Non | PDF + Excel |

---

## Stack technique de référence

| Composant | Technologie |
|-----------|-------------|
| Frontend | Next.js (App Router) |
| Backend principal | Express.js (`server-minimal.js`) |
| Backend modules | NestJS (auth, billing, export connectors) |
| Base de données | PostgreSQL (Cloud SQL) |
| ORM | Prisma |
| IA | Google Gemini 2.0 Flash |
| Images | Sharp |
| Storage | Google Cloud Storage |
| Hosting | Google Cloud Run |
| CI/CD | GitHub Actions + Cloud Build |
| Scheduler | Google Cloud Scheduler |
| Secrets | Google Secret Manager |
| Monitoring | Sentry (à intégrer) |

---

## Positionnement vs concurrence (usage interne / vente uniquement)

*Ne pas utiliser en client-facing : pas de comparaison ni de « nous sommes meilleurs ». Le client doit ressentir la valeur par les faits.*

| Feature | Lengow | Channable | FeedPlug (Phase 2) |
|---------|--------|-----------|---------------------|
| Import multi-sources | Oui | Oui | Oui |
| Export multi-plateformes | Oui | Oui | Oui (GMC, Meta, Amazon) |
| Enrichissement IA | Basique (1 prompt) | Non | Avancé (5 templates industrie) |
| A/B test | Non | Non | Oui (par segment, significance) |
| Métriques d'impact | Basique | Basique | Avancé (delta CTR, ROI) |
| Rapports auto | Non | Non | Oui (PDF, Excel, email) |
| Score qualité produit | Non | Non | Oui (0-100, actionnable) |
| Cache IA | Non | N/A | Oui (80% économie) |
| Prix | 500€+/mois | 300€+/mois | 49-499€/mois |

**Pitch client (faits uniquement, pas de comparaison)** : « FeedPlug centralise votre catalogue, l’optimise avec l’IA (titres, descriptions, score qualité 0–100) et distribue des flux conformes sur Google, Meta, Amazon. Vous avez les métriques d’impact (delta CTR, rapports) et les prix sont affichés (49 € / 149 € / 399 €). »

---

*Ce document est la source de vérité pour le suivi de la commercialisation. Mettre à jour les checkboxes au fur et à mesure de l'avancement.*
