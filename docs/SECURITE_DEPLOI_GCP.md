# Sécurité déploiement GCP — .env et fichiers sensibles

## Contexte

Quand on déploie **sans Git** (en lançant `gcloud builds submit .` ou `./deploy-backend-marketing.sh` depuis sa machine), tout le dossier courant est **envoyé à GCP** sauf ce qui est exclu par **`.gcloudignore`**.

- **Avant** : `.gcloudignore` n’excluait pas les fichiers sensibles (`.env`, `config.local.js`, etc.). Donc si un `.env` ou autre fichier sensible était présent dans le dossier au moment du `gcloud builds submit`, il a **pu être envoyé** dans l’archive source utilisée par Cloud Build.
- **Image Docker** : le build du backend utilise `dir: backend-marketing` et `backend-marketing/.dockerignore` exclut `.env*`, donc le **contenu de l’image** ne contient pas le `.env`. En revanche, l’**archive source** uploadée à GCP (stockée le temps du build) pouvait contenir ces fichiers.

## Ce qui a été corrigé

- **`.gcloudignore`** a été mis à jour pour :
  - inclure tout ce qui est dans **`.gitignore`** (`#!include:.gitignore`) ;
  - exclure explicitement `.env`, `.env.*`, `.env.local`, `config.local.js`, `**/service-account*.json`, `*.pem`.

Les **prochains** déploiements avec `gcloud builds submit` n’enverront plus ces fichiers vers GCP.

## Faut-il faire une rotation des clés ?

- **Si tu as déjà déployé** en lançant `gcloud builds submit` (ou le script de déploiement) **depuis un dossier qui contenait** `.env`, `backend-marketing/.env` ou `frontend/.env.local` : l’archive source a pu être envoyée. Elle est en général stockée temporairement par Cloud Build (bucket par défaut du projet). Par précaution, il est recommandé de **faire tourner** les secrets qui étaient dans ces fichiers (Stripe, Google OAuth, JWT, SMTP, etc.) :
  - Stripe : recréer les clés API / webhook dans le tableau de bord, mettre à jour Secret Manager.
  - JWT : générer un nouveau `JWT_SECRET`, mettre à jour le secret Cloud Run.
  - Google OAuth : si la clé client était dans le .env, pas forcément de rotation (les client IDs sont souvent publics), mais vérifier qu’aucun secret type “client secret” n’a fuité.
  - Base de données : le `DATABASE_URL` est déjà dans Secret Manager ; si en plus il était dans un .env envoyé, changer le mot de passe du user DB et mettre à jour le secret.
- **Si tu n’as jamais eu de `.env`** (ou équivalent) dans le dossier au moment du `gcloud builds submit`, le risque est faible.

## Bonnes pratiques à partir de maintenant

1. **Toujours déployer** avec `.gcloudignore` à jour (c’est fait).
2. **Secrets en prod** : utiliser uniquement **Secret Manager** (ou variables d’environnement Cloud Run injectées par la CI), jamais de fichier `.env` commité ou envoyé.
3. **Vérifier** avant un `gcloud builds submit` qu’aucun `.env` ou fichier sensible ne traîne à la racine ou dans les sous-dossiers (ou s’assurer qu’ils sont bien listés dans `.gcloudignore` / `.gitignore`).

## Références

- Healthcheck : `docs/HEALTHCHECK.md`
- Checklist déploiement : `backend-marketing/DEPLOI_CHECKLIST.md`
- Stripe en prod : `docs/DEPLOI_STRIPE.md`
