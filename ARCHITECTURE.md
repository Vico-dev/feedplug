# Architecture FeedPlug

Ce document décrit l'architecture réellement active de la repo au 11 avril 2026.

## Vue d'ensemble

FeedPlug fonctionne aujourd'hui comme un duo applicatif :

- `frontend/`
  Next.js 16, rendu App Router, dashboard authentifié, pages marketing, proxy applicatif `/feedplug-api`
- `backend-marketing/`
  API Node/Express monolithique, Prisma/PostgreSQL, auth, billing, onboarding, ingestion, enrichissement et opérations marketing

## Topologie logique

```text
Navigateur
  │
  ▼
Frontend Next.js
  │
  ├── UI marketing
  ├── UI dashboard authentifiée
  └── Proxy même origine /feedplug-api/*
          │
          ▼
Backend Express /api/v1/*
  │
  ├── Auth & sessions JWT
  ├── Billing / contrôle d'accès
  ├── Ingestion catalogues / flux
  ├── Back-office staff
  ├── Intégrations IA / enrichissement
  └── Webhooks / opérations
          │
          ▼
PostgreSQL via Prisma
```

## Source de vérité par domaine

### Frontend

- Entrée principale API : `frontend/src/config/api.ts`
- Client HTTP partagé : `frontend/src/lib/api.ts`
- Navigation locale partagée : `frontend/src/lib/locale-navigation.ts`
- Proxy applicatif : `frontend/src/app/feedplug-api/[[...path]]/route.ts`

### Backend

- Entrée runtime : `backend-marketing/server-minimal.js`
- Domaine auth testable : `backend-marketing/domains/auth/security.js`
- Domaine billing / accès testable : `backend-marketing/domains/billing/access-state.js`
- Limites multi-tenant : `backend-marketing/lib/plan-limits.js`
- Ingestion CSV : `backend-marketing/ingestion/csv.js` et `backend-marketing/ingestion/csv-mapping.js`
- Schéma de données : `backend-marketing/prisma/schema.prisma`
- Migrations : `backend-marketing/prisma/migrations/`

## Principes désormais imposés

### 1. Pas de fallback mémoire en production

Les protections anti-abus et les données opérationnelles critiques ne doivent plus retomber sur de la mémoire locale pour masquer un problème d'infra.

### 2. Pas de migration au runtime

Le backend ne doit plus créer ou altérer son schéma à chaud. Les migrations sont exécutées avant ou pendant le déploiement, jamais à la première requête applicative.

### 3. Chiffrement dédié

Les secrets applicatifs sensibles reposent sur une clé dédiée (`FEEDPLUG_SECRET_ENCRYPTION_KEY`), séparée des secrets JWT.

### 4. Chaîne de confiance vérifiable

La CI doit valider plus que la syntaxe :

- génération Prisma
- checks syntax backend
- tests domaines backend
- smoke test backend authentifié
- lint + build frontend

## Découpage backend actuel

Le backend reste un monolithe, mais le travail de réduction de complexité suit ce sens :

- extraction de logique métier stable hors de `server-minimal.js`
- centralisation des règles transverses testables
- réduction du SQL ad hoc là où une fonction de domaine peut porter la logique métier

Les premiers domaines extraits et couverts par tests sont :

- auth token + politique mot de passe
- calcul d'accès billing / trial / grâce
- limites multi-tenant
- mapping CSV d'ingestion

## Flux critiques

### Authentification

1. le frontend appelle `/feedplug-api/auth/*`
2. le proxy Next relaie vers `/api/v1/auth/*`
3. les cookies HttpOnly sont posés côté frontend proxy
4. le backend applique ensuite le contrôle d'accès account/billing sur les routes protégées

### Billing gating

1. le JWT identifie l'utilisateur et l'account
2. le backend charge l'état de facturation du compte
3. la décision d'accès est calculée dans `domains/billing/access-state.js`
4. les routes non exemptées retournent `402 BILLING_REQUIRED` quand l'accès doit être bloqué

### Ingestion

1. une source ou un upload déclenche un import
2. le mapping CSV normalise les colonnes et les valeurs
3. les limites de plan encadrent l'usage multi-tenant
4. les traitements d'enrichissement et d'optimisation s'appuient sur l'état du compte

## Dette encore visible

- `backend-marketing/server-minimal.js` reste trop volumineux et doit encore être découpé par domaines métier
- plusieurs composants frontend dashboard restent massifs et gagnent à être éclatés
- une partie du backend repose encore sur du SQL brut là où des modules Prisma/domaines dédiés seraient plus maintenables

## Opérations

- Déploiement backend et migrations : `backend-marketing/DEPLOI_GCP.md`
- Rollout chiffrement : `docs/P0_SECRET_ENCRYPTION_ROLLOUT.md`
- Health / smoke / readiness : `docs/HEALTHCHECK.md`
