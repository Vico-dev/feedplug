# Healthcheck Feedplug – Rapport et actions

**Date** : février 2026  
**Objectif** : Fichiers à supprimer/fusionner, prérequis sécurité, recommandations.

---

## 1. Résumé exécutif

| Domaine | État |
|--------|------|
| **Structure** | Monorepo clair (Nest, backend-marketing, frontend) ; doc et config éclatées. |
| **Fichiers** | Plusieurs doublons (NEXT_STEPS, README), racine encombrée de .md ; setup Docker incohérent. |
| **Sécurité** | Bonnes bases (CORS, validation, rate limit, auth) ; Helmet manquant sur Nest ; vigilance sur les secrets. |

---

## 2. Fichiers / dossiers à supprimer ou fusionner

### 2.1 Documentation en double

| Fichier | Statut |
|---------|--------|
| `docs/NEXT_STEPS.md` | Fichier de référence principal (inchangé). |
| `NEXT_STEPS.md` (racine) | Remplacé par un court fichier qui redirige vers `docs/NEXT_STEPS.md` + rappel « après déploiement ». |
| `backend-marketing/NEXT_STEPS.md` | Remplacé par des liens vers `docs/NEXT_STEPS.md` et `backend-marketing/docs/NEXT_STEPS_BACKEND_MARKETING.md`. |

### 2.2 Documentation à regrouper (racine → docs/)

Déplacer vers `docs/` (ou sous-dossiers `docs/roadmaps/`, `docs/audits/`) pour éviter la multiplication à la racine :

- `ROADMAP.md`, `ROADMAP_COMMERCIALISATION.md`, `AUDIT_ET_ROADMAP_COMMERCIALISATION.md`
- `NEXT_FEATURES.md`, `PROJECT_SUMMARY.md`, `ARCHITECTURE.md`, `CHANGELOG.md`
- `RECAP_SESSION_COMPLETE.md`, `DIAGNOSTIC_DATABASE.md`
- Fichiers `PLAN_*.md`, `AUDIT_*.md`, `AMELIORATIONS_*.md`, `DEPLOI_*.md` à la racine

Dans `backend-marketing/`, regrouper les .md (DEPLOI_*, CONFIGURATION_*, ETAT_*, FIX_*, etc.) dans `backend-marketing/docs/`.

### 2.3 Setup Docker incohérent

- **Corrigé** : `scripts/docker-setup.sh` et `README-DOCKER.md` utilisent désormais `cp env.example .env` (pas de fichier `.env.example` dans le repo).

### 2.4 Dossier potentiellement obsolète

- Si le dossier `feedplug-prod:europe-west1:feedplug-db` existe à la racine (résidu type instance GCP), le **supprimer** du dépôt.

### 2.5 README multiples

Clarifier les rôles ou fusionner :

- `README.md`, `README-DOCKER.md`
- `frontend/README.md`, `frontend/e2e/README.md`
- `backend-marketing/ai/README.md`, `backend-marketing/scripts/README.md`

---

## 3. Sécurité – Ce qui est en place

| Thème | Nest (src/) | Backend-marketing |
|-------|-------------|-------------------|
| Secrets via env | OK | OK (JWT + clé de chiffrement dédiée requis) |
| .env / config.local.js | Dans `.gitignore` | OK |
| CORS | Origines limitées | Whitelist explicite |
| Validation entrées | ValidationPipe + DTOs | Par route |
| Rate limiting | Throttler | Store partagé Postgres |
| Cookies | N/A (API) | Secure + SameSite en prod |
| Sanitization XML/CSV | feed-template.service | N/A selon usage |
| Helmet | **À ajouter** (voir §4) | OK |

- **Auth** : JWT, bcrypt, refresh (Nest), vérification webhook Stripe, OAuth Google/Amazon/Shopify.
- **Fichiers d’exemple** : `env.example` et `env.local.example` sans vrais secrets ; `env.example` complété avec STRIPE_*, APP_URL, NEXT_PUBLIC_*, SMTP, Amazon, Shopify, etc.

---

## 4. Sécurité – Points à corriger

### 4.1 Helmet sur Nest (correction technique)

Le backend Express utilise déjà Helmet ; le serveur Nest ne l’utilise pas. **Action** : ajouter Helmet dans `src/main.ts` (voir correctif appliqué dans le repo).

### 4.2 Secrets et .env

- **Ne jamais commiter** `.env`, `frontend/.env.local`, `backend-marketing/.env`. Vérifier avec `git log -p -- .env` si un .env a déjà été commité ; si oui, **rotation des clés** (Stripe, Google, etc.) et rappel en doc.
- En prod : utiliser uniquement des secrets injectés (variables d’environnement ou secret manager), **jamais** des valeurs de fallback applicatif.
- **backend-marketing** : `SECRET_ENCRYPTION_KEY` est désormais obligatoire et dédié au chiffrement des secrets stockés. Le fallback historique vers `JWT_SECRET` n’est plus autorisé.

### 4.3 Fichiers d’exemple d’environnement

- **Fait** : `env.example` a été complété avec les variables frontend (NEXT_PUBLIC_*), backend-marketing (APP_URL, SMTP, Stripe, Amazon, Shopify, staff, scheduler, FAL, etc.).

---

## 5. Checklist actions prioritaires

- [x] Vérifier que `.env` n’a jamais été commité (vérifié via `git log -p -- .env` ; aucun commit).
- [x] Aligner le setup Docker : `cp env.example .env` dans `scripts/docker-setup.sh` et README-DOCKER.
- [ ] Unifier les instructions README / CONTRIBUTING (quelle commande pour .env / .env.local).
- [x] Ajouter Helmet sur l’app Nest (`src/main.ts`).
- [x] Fusionner les doublons NEXT_STEPS : un seul fichier de référence `docs/NEXT_STEPS.md` ; racine et backend-marketing redirigent vers lui ; contenu backend détaillé dans `backend-marketing/docs/NEXT_STEPS_BACKEND_MARKETING.md`.
- [x] Compléter `env.example` avec toutes les variables nécessaires (frontend, backend-marketing, Stripe, SMTP, Amazon, Shopify, etc.).
- [ ] Supprimer ou déplacer le dossier `feedplug-prod:europe-west1:feedplug-db` s’il est présent et inutile.

---

## 6. Déploiement GCP sans Git

Si vous déployez avec `gcloud builds submit` (sans passer par Git), l’archive envoyée à GCP peut contenir tout le dossier. **Avant** la mise à jour ci-dessous, `.gcloudignore` n’excluait pas `.env` ni les autres fichiers sensibles : ils ont **pu être envoyés** lors de déploiements passés. L’**image Docker** du backend ne les contient pas (`.dockerignore` du backend-marketing les exclut), mais l’archive source oui.

- **Correction** : `.gcloudignore` a été mis à jour (`#!include:.gitignore` + exclusions explicites `.env`, `config.local.js`, etc.) pour que les prochains déploiements n’envoient plus ces fichiers.
- **Détail et recommandations** (rotation des clés si besoin) : **`docs/SECURITE_DEPLOI_GCP.md`**.

---

## 7. Références

- **Sécurité déploiement GCP** : `docs/SECURITE_DEPLOI_GCP.md`
- Audit login/register : `docs/AUDIT_LOGIN_REGISTER.md`
- Reste à faire opérationnel : `docs/RESTE_A_FAIRE_OPERATIONNEL.md`
- Checklist déploiement : `backend-marketing/DEPLOI_CHECKLIST.md`
- Vérification multi-tenancy : `docs/VERIFICATION_MULTITENANCY_2026-02.md`
