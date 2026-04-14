# Prochaines étapes & connexion Merchant Center

Résumé des **next steps** et des **problèmes courants** liés à la connexion Google Merchant Center (GMC).

---

## 1. Next steps (priorités)

| Priorité | Tâche | Réf. |
|----------|--------|------|
| **Bloquant** | Config prod : `NEXT_PUBLIC_API_URL`, SMTP, (optionnel) `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` pour GMC | `backend-marketing/DEPLOI_CHECKLIST.md` |
| **Bloquant** | Corriger / stabiliser la connexion Merchant Center (voir §2 ci‑dessous) | Ce doc |
| **Recommandé** | Migration 022 (A/B lié aux règles) appliquée en prod si vous utilisez les tests A/B depuis les règles | `backend-marketing/prisma/migrations/022_ab_test_rule_id.sql` |
| **Recommandé** | Flow E2E testé : inscription → import → enrichissement → export GMC (et connexion GMC si push utilisé) | `docs/RESTE_A_FAIRE_OPERATIONNEL.md` |
| **Polish** | Onboarding, compte démo, doc vendeur | `RESTE_A_FAIRE_OPERATIONNEL.md` §2.3 |

---

## 2. Connexion Merchant Center — problèmes courants et correctifs

### 2.1 Redirect URI (OAuth)

**Symptôme** : Après avoir cliqué « Connecter Google », Google affiche une erreur du type « redirect_uri_mismatch » ou « Redirect URI incorrect ».

**Cause** : L’URL de callback configurée dans le backend (`GOOGLE_REDIRECT_URI`) doit être **exactement** celle enregistrée dans la Console Google Cloud (APIs & Services → Identifiants → votre client OAuth 2.0 → URI de redirection autorisés).

**Correctif** :
1. Vérifier l’URI : `GET /api/v1/platforms/gmc/oauth-config` (connecté) renvoie le `redirectUri` à utiliser.
2. Dans Google Cloud Console : ajouter `https://VOTRE-BACKEND.run.app/api/v1/platforms/gmc/callback` (ex. `https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/platforms/gmc/callback`).
3. En prod : `GOOGLE_REDIRECT_URI` est défini dans le Cloud Build ; l’adapter si l’URL du backend change.

---

### 2.2 Redirection après connexion (APP_URL)

**Symptôme** : Après avoir autorisé l’app Google, l’utilisateur est renvoyé sur `https://app.feedplug.com/flux` alors qu’il utilise un autre domaine (ex. frontend Cloud Run, ou localhost).

**Cause** : Le callback GMC redirige en dur vers `https://app.feedplug.com/flux?...`.

**Correctif** : Utiliser la variable d’environnement `APP_URL` pour la redirection après OAuth.

- Fichier : `backend-marketing/server-minimal.js`, route `GET /api/v1/platforms/gmc/callback`.
- Remplacer les `res.redirect('https://app.feedplug.com/flux?...')` par `res.redirect(\`${process.env.APP_URL || 'https://app.feedplug.com'}/flux?...\`)`.

---

### 2.3 Scopes et Content API

**Symptôme** : Connexion OK mais aucun compte Merchant récupéré (`merchantId` vide), ou erreur 403 sur Content API.

**Cause** : Scopes OAuth insuffisants ou compte Google sans accès à un Merchant Center.

**Vérifications** :
- Les scopes demandés dans `auth-url` sont : `https://www.googleapis.com/auth/content` et `https://www.googleapis.com/auth/userinfo.email`. Ne pas les réduire.
- Le compte Google utilisé doit avoir au moins un compte Merchant Center (ou être invité). L’endpoint `accounts/authinfo` renvoie la liste ; le code prend le premier `merchantId` (ou `aggregatorId` pour un MCA).

---

### 2.4 Upsert GMC (éviter les doublons)

**Symptôme** : Erreur SQL au moment de sauvegarder la connexion (ex. violation de contrainte unique, ou doublons `PlatformConnection` pour le même compte + GMC).

**Cause** : La requête utilise `ON CONFLICT (accountid, platform) DO UPDATE`, mais la table `PlatformConnection` n’a peut‑être pas de contrainte **unique** sur `(accountid, platform)`.

**Correctif** :
- Option A : Ajouter une contrainte unique en base (migration) :
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS "PlatformConnection_account_platform_key"
  ON "PlatformConnection"(accountid, platform);
  ```
- Option B : Remplacer l’upsert SQL par une logique « findFirst + update ou create » avec Prisma pour (accountId, platform = 'gmc').

---

### 2.5 Affichage des erreurs côté frontend

**Symptôme** : L’utilisateur ne voit pas la raison de l’échec (ex. `error=oauth_failed&message=...` dans l’URL non affichée).

**Correctif** : Sur la page Flux, lire les query params au chargement : si `error=oauth_failed` ou `error=no_code`, etc., afficher un message clair (ex. bannière ou toast) avec `message` décodé, et nettoyer l’URL (replaceState) pour retirer les paramètres d’erreur.

---

## 3. Références

- **Opérationnel** : `docs/RESTE_A_FAIRE_OPERATIONNEL.md`
- **Déploiement** : `backend-marketing/DEPLOI_CHECKLIST.md`
- **Connecteurs** : `docs/CONNECTEURS_MARKETPLACE.md`
- **Export / bloquants** : `AVIS_EXPERT_FLUX_ET_BLOQUANTS.md`
