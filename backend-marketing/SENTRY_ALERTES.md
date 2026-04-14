# Alertes Sentry (optionnel)

Le backend et le frontend envoient les erreurs à Sentry lorsque les DSN sont configurés.

## Backend

Le backend envoie les erreurs à Sentry si la variable d'environnement `SENTRY_DSN` est définie (Cloud Run / env).

## Frontend (Next.js)

Le frontend utilise `@sentry/nextjs`. Les erreurs non gérées sont capturées via les boundaries d’erreur (`error.tsx`). Les erreurs **fiche produit** sont en plus envoyées explicitement avec un tag `area` pour filtrer les alertes :

| Zone | Tag `area` | Description |
|------|------------|-------------|
| Chargement fiche | `product.load` | Échec du chargement d’un produit (`GET /ingestion/items/:id`) |
| Sauvegarde fiche | `product.save` | Échec de l’enregistrement des modifications (`PUT /ingestion/items/:id`) |
| Enrichissement | `product.enrich` | Échec de l’enrichissement d’un produit |
| Analyse enrichissement | `product.enrichment-analysis` | Échec du chargement de l’analyse d’enrichissement |
| Calcul du score | `product.score` | Échec du calcul / chargement du score produit |

Chaque événement inclut aussi le tag `itemId` (id du produit) pour le debugging.

**Variables à définir (build / env frontend)** : `SENTRY_DSN` (ou `NEXT_PUBLIC_SENTRY_DSN` selon la config Sentry Next.js). Sans DSN, le SDK frontend n’envoie pas d’événements.

## Configurer les alertes (Slack / email)

1. **Connexion** : [sentry.io](https://sentry.io) → projet FeedPlug (backend et/ou frontend selon besoin).
2. **Alerts** : **Alerts** → **Create Alert**.
3. **Règles possibles** :
   - **When** : "An event is seen" ou "The issue's events increase by X%".
   - **If** : "The event's level is equal to error" (ou "fatal").
   - **Filtre optionnel (fiche produit)** : "The event's tags match **area** equals **product.load**" (ou `product.save`, `product.enrich`, etc.) pour cibler uniquement ces zones.
4. **Then** : "Send a notification via Slack" et/ou "Send a notification via Email".
5. **Slack** : **Settings** → **Integrations** → **Slack** → connecter le workspace et choisir le canal (ex. `#feedplug-alerts`).
6. **Email** : par défaut Sentry envoie aux membres du projet ; tu peux ajouter des adresses dans **Project Settings** → **Alerts** → **Email**.

## Vérifier que les erreurs remontent

- **Fiche produit** : provoquer une erreur (ex. coupure réseau, id invalide) sur chargement, sauvegarde ou enrichissement, puis vérifier dans Sentry que l’événement apparaît avec le tag `area` correspondant.
- **Backend** : idem en déclenchant une erreur côté API (ex. timeout, 500).

## Variables à définir (Cloud Run / env)

- **Backend** : `SENTRY_DSN` (onglet **Settings** → **Client Keys (DSN)** dans Sentry).
- **Frontend** : selon la doc `@sentry/nextjs`, le DSN est souvent injecté au build (voir `sentry.client.config.ts` / `sentry.server.config.ts`).

Sans `SENTRY_DSN`, le backend ne contacte pas Sentry (aucune erreur au démarrage). Le frontend idem si le DSN n’est pas configuré.

---

## Checklist rapide (créer une alerte)

- [ ] Aller sur [sentry.io](https://sentry.io) → projet FeedPlug (backend ou frontend).
- [ ] **Alerts** → **Create Alert** → choisir "Issues" ou "Metric".
- [ ] **When** : "An event is seen" ou "The issue's events increase by X%".
- [ ] **If** : "The event's level is equal to error" (ou "fatal").
- [ ] **Filtre (optionnel)** : tag `area` equals `product.load` / `product.save` / `product.enrich` / `product.score` pour cibler la fiche produit.
- [ ] **Then** : "Send a notification via Slack" et/ou "Send a notification via Email".
- [ ] **Slack** : Settings → Integrations → Slack → connecter le workspace et le canal (ex. `#feedplug-alerts`).
- [ ] Sauvegarder l'alerte et tester en déclenchant une erreur (ex. id produit invalide).
