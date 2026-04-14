# 🔍 Audit FeedPlug & Roadmap jusqu'à la commercialisation

**Date** : 13 février 2026  
**Objectif** : Évaluation honnête de l'état du produit et plan d'action jusqu'au lancement commercial.

---

## 1. Synthèse exécutive

| Indicateur | Évaluation |
|------------|------------|
| **Maturité MVP** | ~75% — Fonctionnel pour une démo et une vente early adopter |
| **Stack technique** | Solide (Next.js, Express, Prisma, Cloud Run) avec une architecture hybride à clarifier |
| **Stratégie paiement T1** | Facturation manuelle ; Stripe à intégrer quand le volume le justifiera |
| **Délai commercialisation réaliste** | 1-2 semaines pour une première vente (early adopters) |
| **Délai "produit complet"** | 6-8 semaines pour être concurrentiel Lengow/Channable |

---

## 2. Audit détaillé

### 2.1 Architecture — Points forts & faiblesses

#### ✅ Points forts

| Composant | État | Détail |
|-----------|------|--------|
| **Backend production** | Opérationnel | Express (`server-minimal.js`) — 6000+ lignes, API complète |
| **Frontend** | Opérationnel | Next.js 16, i18n FR/EN, design cohérent |
| **Base de données** | Opérationnel | PostgreSQL (Cloud SQL), Prisma, multi-tenant (Account/User) |
| **Import** | Opérationnel | CSV, Shopify OAuth, ingestion manuelle + Cloud Scheduler |
| **Enrichissement IA** | Opérationnel | Gemini 2.0 Flash, cache, 5 templates industrie |
| **Score qualité** | Opérationnel | 0-100 avec breakdown (titre, description, image, technique) |
| **Export GMC** | Opérationnel | CSV conforme 23 colonnes, Push API OAuth2 |
| **Dashboard** | Opérationnel | Données réelles via `GET /dashboard/overview` |
| **Auth** | Opérationnel | JWT, OAuth Google, mot de passe oublié, rôles |
| **Emails transactionnels** | Opérationnel | Bienvenue, sync terminée, export prêt, erreur |
| **Monitoring** | Opérationnel | Sentry backend + frontend, health check |
| **CI/CD** | Opérationnel | GitHub Actions → Cloud Run |
| **Documentation** | Bonne | README, roadmap, docs marketing |

#### ⚠️ Points faibles / à améliorer

| Problème | Impact | Priorité | Statut |
|----------|--------|----------|--------|
| **Multi-tenancy** | Filtrage par `accountId` manquant sur plusieurs endpoints → risques de fuite de données entre comptes. | 🔴 Priorité | ✅ Corrigé (fév. 2026) |
| **Facturation = mock** | La page `/facturation` affiche des données hardcodées. Acceptable en T1 : facturation manuelle (virement, proforma). Stripe à intégrer plus tard pour l'abonnement récurrent. | 🟡 Non prioritaire T1 | — |
| **Double backend** | NestJS (scaffold) + Express (prod). Les connecteurs Meta/Amazon sont dans NestJS, pas dans Express. Confusion pour l'évolution. | 🟠 Élevée | — |
| **Export Meta/Amazon** | GMC seul opérationnel. Meta et Amazon annoncés dans l'UI mais non livrés côté flux réel. | 🟠 Élevée | — |
| **Mapping codé en dur** | Pas d'UI pour mapper colonne source → champ canal. Chaque nouveau canal = dev. | 🟡 Moyenne | — |
| **Tests** | Coverage ~5%. Pas de tests e2e du flow complet. | 🟡 Moyenne | — |

#### 🟢 Points mineurs

- **Alertes Sentry** : À configurer manuellement (Slack/email) — checklist dans `SENTRY_ALERTES.md`
- **Clés API IA** : Stockées en clair (chiffrement recommandé)
- **Dates obsolètes** : "Le 15 janvier 2024" sur la page facturation (mock)

---

### 2.2 Inventaire des fonctionnalités

| Fonctionnalité | Backend | Frontend | Branché | Statut |
|----------------|---------|----------|---------|--------|
| Import CSV/Shopify | ✅ Express | ✅ | ✅ | Opérationnel |
| Catalogue produits | ✅ Express | ✅ | ✅ | Opérationnel |
| Enrichissement IA | ✅ Express | ✅ | ✅ | Opérationnel |
| Score qualité | ✅ Express | ✅ | ✅ | Opérationnel |
| Export CSV GMC | ✅ Express | ✅ | ✅ | Opérationnel |
| Push GMC | ✅ Express | ✅ | ✅ | Opérationnel |
| Dashboard | ✅ Express | ✅ | ✅ | Opérationnel |
| Auth + OAuth | ✅ Express | ✅ | ✅ | Opérationnel |
| Emails transactionnels | ✅ Express | — | ✅ | Opérationnel |
| Paiement / Facturation | — | Mock (page statique) | — | Manuelle en T1 ; Stripe prévu plus tard |
| Export Meta | ❌ | ❌ | — | Non implémenté |
| Export Amazon | ⚠️ Partiel | ❌ | ❌ | En cours |
| WooCommerce | ❌ | Badge "V2" | — | Prévu |
| Rapports PDF/Excel | ❌ | ❌ | — | Non implémenté |
| Métriques Google Ads | ❌ | ❌ | — | Non implémenté |

---

### 2.3 Risques identifiés

1. **Risque technique** : Double backend complique la maintenance et les évolutions.
2. **Risque concurrence** : Positionnement "multi-canal" alors que seul GMC est livré → risque de déception.
3. **Risque conformité** : RGPD, PCI — à valider lors de l'intégration Stripe (T2+).
4. **Facturation T1** : Gestion manuelle (facture proforma, virement) — acceptable pour 1-10 premiers clients.

---

## 3. Roadmap jusqu'à la commercialisation

### Stratégie facturation

- **T1 (premiers clients)** : Facturation manuelle (proforma, virement, suivi externe). La page `/facturation` reste en mock ou affiche un message type "Contactez-nous pour votre abonnement". Pas de dev prioritaire sur Pennylane.
- **T2+ (volume)** : Intégration **Stripe** pour abonnements récurrents, checkout, portail client. C'est le stack paiement cible. La facturation (invoices PDF, compta) peut rester manuelle ou être gérée via Stripe + export comptable.

---

### Phase 1 — "Première vente" (1-2 semaines)

> Objectif : Signer 1-3 clients early adopters. Facturation manuelle (virement, proforma).

#### Sprint 1 (Semaine 1) — Produit prêt à vendre

| # | Tâche | Effort | Bloquant |
|---|-------|--------|----------|
| 1.1 | **Page tarifs publique** — `/tarifs` ou `/pricing` avec les 3 plans (Starter €29, Pro €99, Enterprise €299), CTA vers inscription ou contact. | 0.5 j | Non |
| 1.2 | **Page Facturation** — Remplacer le mock par un message simple : "Votre abonnement est géré manuellement. Contact : billing@feedplug.com" ou afficher le plan actuel depuis `Account.plan` si disponible. | 0.5 j | Non |
| 1.3 | **Alertes Sentry** — Configurer les alertes Slack/email selon `SENTRY_ALERTES.md`. | 0.5 j | Non |
| 1.4 | **Tests manuels E2E** — Flow complet : inscription → import → enrichissement → export GMC. Documenter les cas de test. | 1 j | Non |
| 1.5 | **Documentation vendeur** — 1-pager produit, arguments de vente, limites connues (GMC uniquement), process facturation manuelle. | 0.5 j | Non |

**Livrable Sprint 1** : Produit démo-rable et vendable. Facturation par virement / proforma.

#### Sprint 2 (Semaine 2) — Polish & lancement

| # | Tâche | Effort | Bloquant |
|---|-------|--------|----------|
| 2.1 | **Environnement de démo** — Données de démo propres, compte démo pour les commerciaux. | 0.5 j | Non |
| 2.2 | **Onboarding** — Parcours clair après inscription (sources, premiers flux). Essai gratuit si souhaité. | 1 j | Non |
| 2.3 | **Corrections UX** — Vérifier les parcours critiques, messages d'erreur, loading states. | 1 j | Non |

**Livrable Phase 1** : Produit vendable à des early adopters. Facturation manuelle OK.

---

### Phase 2 — "Produit compétitif" (3-4 semaines)

> Objectif : Tenir la promesse "multi-canal" et concurrencer Lengow/Channable sur le segment PME.

#### Priorités Phase 2

| # | Tâche | Effort | Valeur |
|---|-------|--------|--------|
| 4.1 | **Export Meta Catalog** — CSV conformes Meta + option push si API disponible. Réutiliser ou adapter le connecteur NestJS. | 3-4 j | Haute |
| 4.2 | **Export Amazon** — Finaliser les canaux Amazon (FR, DE, etc.), export CSV. | 2-3 j | Haute |
| 4.3 | **Intégration Stripe** — Abonnements récurrents, checkout, webhooks, portail client. Priorité dès que le nombre de clients rend la facturation manuelle pénible. | 2-3 j | Haute |
| 4.4 | **Mapping configurable** — Modèle en base (mapping par flux/canal), UI pour éditer les mappings. | 3-4 j | Moyenne |
| 4.5 | **Scheduling UI** — Page pour configurer les synchros automatiques (fréquence, heure). | 1-2 j | Moyenne |
| 4.6 | **Connecteur WooCommerce** — Import produits WooCommerce (OAuth1). | 3 j | Moyenne |
| 4.7 | **Tests automatisés** — Coverage backend > 40%, tests e2e flow critique. | 3-4 j | Haute |

---

### Phase 3 — "Avantage concurrentiel" (2-3 mois)

> Objectif : Ce que Lengow/Channable ne font pas — intelligence data, métriques d'impact.

| # | Domaine | Tâches clés |
|---|---------|-------------|
| 5.1 | **Métriques d'impact** | Google Ads Reporting API, GMC Diagnostics, dashboard "Performance" |
| 5.2 | **A/B test avancé** | Modèle ABTest, significance statistique, historique des tests |
| 5.3 | **Rapports exportables** | PDF mensuel, Excel, envoi automatique |
| 5.4 | **Webhooks sortants** | Config par événement (sync_complete, export_ready, etc.) |
| 5.5 | **API publique** | OpenAPI, clés API, rate limits, documentation développeur |

---

## 4. Planning synthétique

```
Semaine 1     : Page tarifs, facturation (message manuel), alertes Sentry, tests E2E, docs vendeur
Semaine 2     : Environnement démo, onboarding, polish UX
────────────────────────────────────────────────────────
→ JOUR J COMMERCIAL : Fin semaine 2 (fin février 2026)
────────────────────────────────────────────────────────
Semaine 3-4   : Export Meta, Amazon
Semaine 5     : Stripe (quand volume justifié), mapping configurable
Semaine 6-7   : Scheduling UI, WooCommerce, tests automatisés
────────────────────────────────────────────────────────
→ PRODUIT COMPÉTITIF : Fin mars / début avril 2026
────────────────────────────────────────────────────────
Mois 2-3      : Métriques d'impact, A/B avancé, rapports, webhooks
────────────────────────────────────────────────────────
→ AVANTAGE CONCURRENTIEL : Mai 2026
```

---

## 5. Recommandations stratégiques

### Court terme

1. **Facturation T1 = manuelle** — Proforma, virement, suivi Excel/outil. OK pour les premiers clients. Stripe à intégrer quand le volume le justifie.
2. **Communiquer clairement le scope** — "Google Merchant Center + Shopify/CSV" pour les early adopters. Éviter de promettre Meta/Amazon avant livraison.
3. **Décision architecture** — Acter Express comme backend principal. Soit migrer progressivement les bons morceaux de NestJS vers Express, soit laisser NestJS en standby jusqu'à une V2 ultérieure.

### Moyen terme

4. **Intégrer Stripe** — Quand 5-10 clients payants : checkout, abonnements, webhooks. Stripe est le stack cible (pas Pennylane pour le paiement).
5. **Prioriser Meta** — Deuxième canal le plus demandé après GMC pour l'e-commerce.
6. **Investir dans les tests** — Réduire le risque de régressions avant chaque release.
7. **Chiffrer les clés API IA** — Sécurité renforcée avant scale.

### Long terme

8. **Unifier le backend** — Une seule stack (Express ou NestJS) pour simplifier la maintenance.
9. **Métriques d'impact** — Différenciateur fort vs Lengow/Channable : "L'IA a amélioré votre CTR de +X%".

---

## 6. Checklist avant première vente

- [ ] Page tarifs publique avec plans STARTER/PRO/ENTERPRISE
- [ ] Page Facturation : message "gestion manuelle" ou plan actuel depuis Account
- [ ] Process facturation manuelle documenté (proforma, virement)
- [ ] Au moins 1 flow E2E testé manuellement (inscription → import → enrichissement → export GMC)
- [ ] Documentation vendeur à jour
- [ ] Compte démo opérationnel

---

## 7. Métriques de succès

| Métrique | Actuel | Cible Phase 1 | Cible Phase 2 |
|----------|--------|---------------|---------------|
| Paiement / Facturation | Mock | Manuelle (virement) | Stripe opérationnel |
| Canaux export | 1 (GMC) | 1 | 3 (GMC, Meta, Amazon) |
| Connecteurs import | 2 (CSV, Shopify) | 2 | 3 (+ WooCommerce) |
| Tests coverage | ~5% | 20% | 50%+ |
| Première vente | — | 1-3 clients | 5-10 clients |

---

*Document généré à partir de l'audit du dépôt FeedPlug. À mettre à jour au fur et à mesure de l'avancement.*
