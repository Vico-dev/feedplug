# Plan de remédiation — Bloquants pré-lancement FeedPlug (hors RGPD)

> Issu de l'audit pré-lancement du 2026-06-26. Périmètre : les bloquants B1, B4, B5, B6 (+ B3 ops).
> Convention : `[S/M/L]` effort · **AC** = critères d'acceptation.

## Statut bloquants

| Code | Bloquant | Statut | Sprint |
|---|---|---|---|
| B1 | Coût IA non plafonné | ✅ Gates+comptage faits (A1) · caps en Sprint 1 | 0 (gates) + 1 (caps) |
| B3 | Délivrabilité email | ⏳ Checklist OPS à exécuter (hors code) | 0 |
| B4 | Schedulers en mémoire process | ✅ Stopgap fait (min-instances 1) · Cloud Tasks en Sprint 2 | 0 (stopgap) + 2 |
| B5 | Ingestion synchrone non bornée | ✅ Stopgap fait (plafond + sweeper) · background en Sprint 2 | 0 (stopgap) + 2 |
| B6 | A/B testing factice | ✅ Réparé (front + back) | 0 |

> **Sprint 0 réalisé le 2026-06-26** sur la branche `fix/blocking-issues-sprint-0`. Détail des changements en bas de fichier.

## Changements Sprint 0 (réalisés)

- **A1** — `server-minimal.js` : gate `addonIA` + `trackAiUsage` sur `embedded/products/optimize` ; gate `getAccountAddonIA` sur l'auto-optimisation (push brut sinon) ; `trackAiUsage` sur `optimization/titles/generate`.
- **B-STOP1** — `cloudbuild-backend-marketing.yaml` : `--min-instances 1`.
- **B-STOP2** — plafond `MAX_INGEST_PRODUCTS` (défaut 5000) dans `ingestion/{csv,shopify,prestashop}.js` (→ 413 `INGEST_TOO_LARGE`) ; sweeper de runs zombies `RUNNING` au démarrage (`STALE_RUN_TIMEOUT_MIN`, défaut 15 min).
- **B6** — `routes/ab-tests.js` : accepte `customTransformations`, calcule la variante depuis le contenu réel en base (`applyAbTransformations`) ; `optimiser/page.tsx` : envoie les transformations réelles (fin du placeholder + fallback `sample-*`), garde-fou seuil ≥100/bras, correction du bug d'indexation des transformations.
- **Vérifs** : `node --check` OK sur tous les fichiers backend, `npm test` (domain+routes+smoke) vert, `tsc --noEmit` frontend 0 erreur.

### Nouvelles variables d'environnement (optionnelles, défauts sûrs)
- `MAX_INGEST_PRODUCTS` (défaut `5000`)
- `STALE_RUN_TIMEOUT_MIN` (défaut `15`)

---

## EPIC A — B1 : Plafonds IA par plan

### A1 — Fermer les trous de gating sur les endpoints IA `[S]` — SPRINT 0
- `server-minimal.js:17072` `POST /embedded/products/optimize` → ajouter gate `addonIA` + `trackAiUsage`
- `server-minimal.js:15582` `scheduleAutoOptimization` → gate `getAccountAddonIA` avant la boucle (sinon push brut)
- `server-minimal.js:12713` `POST /optimization/titles/generate` → ajouter `trackAiUsage`
- **AC** : compte sans addonIA → 403 sur embedded/optimize ; auto-optim n'appelle pas Gemini pour lui ; les 3 endpoints incrémentent `ai_usage`.

### A2 — Séparer compteurs texte / images dans `ai_usage` `[S]` — SPRINT 1
- Migration : colonne `kind text NOT NULL DEFAULT 'text'`, PK `(accountid, period, kind)`.
- `recordAiUsage(prisma, accountId, count, kind='text')` ; `getAiUsage` → `{ text, image }`.

### A3 — Hard cap par plan (bloquant) `[M]` — SPRINT 1
Grille proposée (config-driven, surchargeable env, **à valider business**) :

| Plan / Tier | Cap texte /mois | Cap images /mois |
|---|---|---|
| STARTER / TIER_100 | 2 000 | 100 |
| TIER_500 | 5 000 | 250 |
| PROFESSIONAL / TIER_1000 | 10 000 | 500 |
| TIER_2500 | 25 000 | 1 000 |
| ENTERPRISE / TIER_10000 | 100 000 | 3 000 |
| TIER_50000 | 300 000 | 8 000 |

- `checkAiQuota(prisma, accountId, kind, requestedCount)` lu **avant** l'appel payant ; `429 { code:'AI_QUOTA' }` au dépassement.
- **AC** : au-delà du cap, aucune route IA n'appelle Gemini.

### A4 — Cache de génération d'images `[M]` — SPRINT 1
- Clé `sha256(imageSourceHash + scene + model + mannequin + ratio)` → URL GCS, TTL 90j.

---

## EPIC B — B4 + B5 : Jobs longs hors du thread HTTP

### B-STOP1 — `--min-instances 1` backend `[S]` — SPRINT 0
- `cloudbuild-backend-marketing.yaml` : `--min-instances 1`. Réduit la fenêtre de perte des timers `.unref()`.

### B-STOP2 — Ingestion défensive `[S/M]` — SPRINT 0
- Plafond `MAX_INGEST_PRODUCTS` (ex. 5000) → 413 au-delà (ou troncature + `truncated:true`).
- `try/finally` forçant `IngestionRun=FAILED` sur exception/timeout (plus de run zombie `RUNNING`).
- Fichiers : `ingestion/csv.js`, `ingestion/shopify.js`, `ingestion/prestashop.js`, handlers `server-minimal.js:3790,3876,3944`.

### B-PROPER — Cloud Tasks + worker idempotent `[L]` — SPRINT 2
- `scheduleAutoX` → Cloud Task nommée `accountId-feedId-window` (dédup native = debounce distribué).
- Ingestion en background (202 + polling `IngestionRun`), batching `INSERT … ON CONFLICT` + `$transaction` (règle aussi le N+1).

---

## EPIC C — B6 : Réparer l'A/B testing

### C1 — Vraies variantes côté frontend `[M]` — SPRINT 0
- `optimiser/page.tsx:528-561` : remplacer le placeholder `[Test] Titre modifié pour ${id}` par un vrai moteur `applyTransformation(title, transfo)` (types `replace|prepend|append|remove`) appliqué au titre réel de chaque produit.
- Supprimer le fallback `['sample-1','sample-2']` ; bloquer si 0 produit.
- Backend `ab-tests.js:165` consomme déjà `variantTitles[itemId]` → pas de changement backend pour le champ titre.

### C2 — Pré-requis visibles `[S]` — SPRINT 0
- Afficher le seuil ≥100 produits/bras (`MIN_PRODUCTS_PER_ARM`, `ab-tests.js:8`) ; avertir si `selectedIds < 200`.

---

## B3 — Email : checklist OPS (pas de code) `[S]` — SPRINT 0
`RESEND_API_KEY` est injecté en prod (Secret Manager). Risque résiduel = DNS/délivrabilité :
- [ ] Domaine `feedplug.com` *verified* dans Resend
- [ ] SPF présent
- [ ] DKIM publié et validé
- [ ] DMARC (`_dmarc`, `p=none` pour démarrer)
- [ ] Secret `resend-api-key` peuplé dans Secret Manager
- [ ] Test réel : reset password → inbox Gmail + Outlook (pas spam)

---

## Séquencement

- **Sprint 0 (déblocage pilote)** : A1 · B-STOP1 · B-STOP2 · B3 · C1 · C2
- **Sprint 1 (durcissement coûts)** : A2 · A3 · A4
- **Sprint 2 (scalabilité)** : B-PROPER

Après Sprint 0 → pilote restreint OK. Après Sprint 1 → ouverture publique côté coûts. Après Sprint 2 → montée en charge.
