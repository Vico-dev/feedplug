# FeedPlug

Repo principale de FeedPlug, structurée aujourd'hui autour de deux surfaces actives :

- `frontend/` : application Next.js 16
- `backend-marketing/` : API Express + Prisma déployée sur Cloud Run

Le présent README remplace l'ancienne documentation NestJS devenue trompeuse. La référence d'architecture est désormais [ARCHITECTURE.md](./ARCHITECTURE.md).

## Structure utile

```text
.
├── frontend/              # App web Next.js, proxy API, dashboard, marketing
├── backend-marketing/     # API Node/Express, Prisma, billing, auth, ingestion
├── docs/                  # Docs d'exploitation et plans de rollout ciblés
├── .github/workflows/     # CI
└── package.json           # Commandes workspace de haut niveau
```

## Démarrage rapide

### Installer les dépendances

```bash
npm ci --prefix frontend
npm ci --prefix backend-marketing
```

### Frontend

```bash
npm run dev:frontend
```

### Backend

```bash
npm run dev:backend
```

### Build / qualité

```bash
npm run ci
```

Cette commande agrège :

- lint + build du frontend
- génération Prisma backend
- checks syntax backend
- tests backend domaines + smoke authentifié

## Variables importantes

### Frontend

- `BACKEND_API_URL`
  Stratégie canonique côté repo pour résoudre l'API backend. La valeur peut pointer vers l'origine backend ou vers `/api/v1` ; le frontend la normalise.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  Client ID public pour les flows Google côté navigateur.

### Backend

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `FEEDPLUG_SECRET_ENCRYPTION_KEY`
- `STRIPE_SECRET_KEY`
- `TURNSTILE_SECRET_KEY`

## Source de vérité

- Architecture actuelle : [ARCHITECTURE.md](./ARCHITECTURE.md)
- Procédures backend/infrastructure : `backend-marketing/DEPLOI_GCP.md`
- Rollout chiffrement des secrets : `docs/P0_SECRET_ENCRYPTION_ROLLOUT.md`
- Healthcheck et readiness : `docs/HEALTHCHECK.md`

## Ce qui n'est plus vrai

Les anciens documents racine qui décrivaient une stack NestJS + Redis + Pub/Sub comme runtime principal ne doivent plus être utilisés comme référence opérationnelle. La réalité de production est aujourd'hui :

- frontend Next.js
- backend `backend-marketing` en Express
- PostgreSQL via Prisma
- protections anti-abus partagées
- migrations exécutées hors runtime
