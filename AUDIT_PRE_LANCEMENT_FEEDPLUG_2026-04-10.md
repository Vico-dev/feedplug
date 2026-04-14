# Audit Pre-Lancement FEEDPLUG

Date: 2026-04-10

Auteur: Audit CTO externe

## Verdict

Verdict global: NO-GO conditionnel.

FEEDPLUG montre une base produit deja solide cote experience, build frontend et exposition publique minimale. En revanche, le niveau de fiabilite pre-lancement n'est pas encore suffisant pour un lancement serein avec acquisition payante ou onboarding connecteurs a volume.

Les trois blocants principaux avant lancement sont:

1. Corriger les flux OAuth Shopify et Amazon qui reposent sur un etat en memoire non compatible avec une infra Cloud Run multi-instance.
2. Corriger les vulnérabilites backend remontees par `npm audit`, en priorite l'avis critique sur `axios` et l'avis modere sur `nodemailer`.
3. Renforcer les workflows de securite compte: tokens de reset/invitation stockes en clair, couverture de test backend quasi absente, E2E non executables en l'etat.

## Resume Executif

### Points forts constates

- Le frontend compile en production sans erreur.
- Le lint frontend passe.
- Le backend passe la verification syntaxique Node.
- Le smoke test prod passe sur les URLs actuellement exposees.
- La couche auth/proxy frontend est coherente: cookies HttpOnly, proxy same-origin, sanitation des tokens retournes au navigateur.
- Le backend utilise Helmet, rate limiting et Sentry.

### Risques majeurs

- Connecteurs Shopify/Amazon fragiles sur infra stateless.
- Surface backend avec dependances vulnerables encore presentes.
- Processus de reprise d'acces compte insuffisamment durcis.
- Gaps de readiness QA / ops / documentation qui augmentent le risque d'incident au lancement.

## Validations Realisees

- `frontend`: `npm run lint` -> OK
- `frontend`: `npm run build` -> OK
- `backend-marketing`: `node -c server-minimal.js` -> OK
- `frontend`: `npm audit --omit=dev --json` -> 0 vulnerabilite
- `backend-marketing`: `npm audit --omit=dev --json` -> 1 critique, 1 moderee, 5 faibles
- `backend-marketing`: `npm ls axios` -> `google-ads-api -> axios@1.13.6`
- `frontend`: `npm run test:e2e` -> ECHEC fonctionnel apres installation de Chromium (2 tests en erreur, 1 skip)
- `scripts/smoke-test-prod.sh` -> OK (`/health`, preflight CORS, homepage app)

## Findings Priorises

### P1 - OAuth Shopify et Amazon non robustes sur Cloud Run

Les etats temporaires OAuth sont stockes en memoire processus via `Map()`. En environnement stateless / multi-instance, un callback peut revenir sur une autre instance que celle qui a initie le flow, ce qui casse la liaison de `state` et degrade l'onboarding connecteurs de facon intermittente.

Preuves:

- `backend-marketing/server-minimal.js:879`
- `backend-marketing/server-minimal.js:12080`
- `backend-marketing/server-minimal.js:12120`
- `backend-marketing/server-minimal.js:12968`
- `backend-marketing/server-minimal.js:13028`
- `backend-marketing/server-minimal.js:13200`

Impact:

- Onboarding Shopify/Amazon non deterministe.
- Taux de conversion acquisition degrade.
- Tickets support "ca marche une fois sur deux".

Recommendation:

- Remplacer ces stores memoire par Redis, Postgres ou un store signe/JWE avec TTL.
- Tracer chaque flow avec correlation id.
- Ajouter tests d'integration de callback et test multi-instance.

### P1 - Dependances backend avec vulnerabilites ouvertes

Le backend remonte toujours des vulnerabilites de production, dont une critique. `npm ls axios` montre `axios@1.13.6` via `google-ads-api`, et `npm audit` remonte aussi un advisory modere sur `nodemailer@8.0.4`.

Preuves:

- `backend-marketing/package.json:27`
- `backend-marketing/package.json:32`

Impact:

- Risque securite non nul sur un service expose a Internet.
- Mauvais signal pour un lancement B2B.
- Blocage probable dans un due diligence client/partenaire ou cyber-assurance.

Recommendation:

- Monter `google-ads-api` ou override la version d'`axios` corrigee.
- Mettre a jour `nodemailer`.
- Ajouter un gate CI `npm audit --omit=dev` ou equivalent SCA avec seuil bloquant.

### P1 - Tokens de reset / invitation stockes en clair

Les tokens de reset et d'acceptation d'invitation sont generes en UUID, stockes tels quels en base, puis recherches en clair. En cas d'acces lecture base ou de log accidentel, un attaquant peut reutiliser ces tokens.

Preuves:

- `backend-marketing/server-minimal.js:12823`
- `backend-marketing/server-minimal.js:12827`
- `backend-marketing/server-minimal.js:12862`
- `backend-marketing/server-minimal.js:12905`

Impact:

- Prise de controle compte par reutilisation de token.
- Risque securite et conformite.

Recommendation:

- Stocker uniquement un hash du token.
- Comparer via hash constant-time.
- Journaliser sans email ni token en clair.
- Ajouter invalidation explicite et limitation par compte.

### P2 - Fallback leads marketing en memoire, non durable

Si la DB n'est pas disponible, les leads marketing sont sauvegardes dans `inMemoryLeads` puis annonces dans les logs. Cela evite la perte immediate de la requete HTTP, mais pas la perte de la donnee au redemarrage ou au scale-out.

Preuves:

- `backend-marketing/server-minimal.js:7372`
- `backend-marketing/server-minimal.js:7497`
- `backend-marketing/server-minimal.js:7541`
- `backend-marketing/server-minimal.js:7542`

Impact:

- Perte silencieuse de leads.
- Rupture du funnel commercial.
- Donnees PII dispersees dans les logs.

Recommendation:

- Supprimer le fallback memoire pour les leads business critiques.
- Repondre en erreur explicite ou pousser dans une queue durable.
- Ajouter alerte Sentry / Slack si sauvegarde lead impossible.

### P2 - Endpoint de purge performance incoherent avec son mode cron

L'endpoint `POST /api/v1/admin/performance/purge` est protege par `authenticateToken`, mais le handler pretend aussi accepter un `CRON_SECRET`. En pratique, un bearer `CRON_SECRET` seul n'atteindra jamais le handler car il sera rejete avant par le middleware JWT. De plus, le check staff ne reprend pas la logique email-based employee deja utilisee ailleurs.

Preuves:

- `backend-marketing/server-minimal.js:11631`
- `backend-marketing/server-minimal.js:11633`
- `backend-marketing/server-minimal.js:11636`

Impact:

- Automation de retention possiblement non operationnelle.
- Endpoint d'ops trompeur pour l'equipe.

Recommendation:

- Soit enlever `authenticateToken` et accepter un secret cron dedie via middleware explicite.
- Soit conserver JWT uniquement et supprimer la branche cron morte.
- Harmoniser le check staff avec `requireStaffAccess`.

### P2 - Documentation et artefacts de deploiement incoherents avec la realite

Le README racine presente encore une architecture NestJS / Redis / PubSub / Pennylane qui ne correspond plus au coeur du code observe, tandis que le `package.json` racine se declare lui-meme legacy. Le `docker-compose.prod.yml` vise un `Dockerfile` racine inexistant.

Preuves:

- `README.md:20`
- `README.md:44`
- `package.json:8`
- `docker-compose.prod.yml:8`
- `docker-compose.prod.yml:9`

Impact:

- Mauvaise runbook ops.
- Risque de mauvais deploiement ou d'onboarding equipe.
- Difficulte a savoir ce qui fait foi en incident.

Recommendation:

- Definir une seule source de verite de stack.
- Supprimer ou archiver les artefacts legacy non utilises.
- Mettre a jour README, guide de deploiement et package racine.

### P2 - Hygiene de release fragile: le projet n'est pas isole dans son propre depot Git

Dans le workspace audite, `Feedplug` ne contient pas de dossier `.git` et les commandes Git remontent jusqu'au home utilisateur. Dans cette configuration, un commit, un `git add .` ou une erreur de publication peut inclure des fichiers hors projet, y compris des fichiers locaux sensibles.

Impact:

- Risque eleve de fuite accidentelle.
- Historique projet non fiable.
- Review et CI potentiellement fausses ou incompletes.

Recommendation:

- Re-initialiser FEEDPLUG comme depot autonome.
- Revalider `.gitignore` a la racine reelle du depot.
- Sortir les fichiers secrets locaux du workspace de release.

### P2 - Couverture de test insuffisante pour un go-live B2B

Le frontend n'a qu'une petite suite Playwright catalogue. Elle depend d'une session connectee, skippe facilement et ne couvre ni register, ni billing, ni connectors, ni password reset. Le backend n'expose aucun script `test` ni `lint`. Apres installation de Chromium, la suite echoue encore: 2 tests en erreur, 1 skip.

Preuves:

- `frontend/package.json:5`
- `frontend/playwright.config.ts:15`
- `frontend/e2e/catalogue-product.spec.ts:4`
- `frontend/e2e/catalogue-product.spec.ts:7`
- `frontend/middleware.ts:92`
- `frontend/middleware.ts:159`
- `backend-marketing/package.json:6`

Impact:

- Faible confiance sur les flux critiques.
- Regressions detectees trop tard.
- Launch support burden eleve.
- Les tests actuels ne prouvent pas le parcours app local: la baseURL Playwright est `http://localhost:3000`, alors que le middleware ne traite ni `localhost` comme domaine app ni la route `/catalogue` comme route servable sans contexte de domaine/locale, ce qui mene a des 404 en test.

Recommendation:

- Installer Playwright browsers en CI et local bootstrap.
- Ajouter au minimum:
  - register/login/logout/refresh
  - forgot/reset password
  - onboarding + choose-plan
  - Shopify connect init/callback mocked
  - audit marketing create/share/read
- Ajouter lint et tests backend au package et a la CI.

### P3 - Durcissement secrets perfectible

Le chiffrement des secrets applicatifs retombe sur `JWT_SECRET` si aucune cle dediee n'est fournie. Ce n'est pas un incident immediat, mais c'est un couplage de secrets qu'il faut casser avant scale.

Preuves:

- `backend-marketing/lib/secret-crypto.js:6`
- `backend-marketing/lib/secret-crypto.js:48`

Impact:

- Rotation moins propre.
- Blast radius augmente si `JWT_SECRET` est expose.

Recommendation:

- Exiger une cle de chiffrement dediee.
- Refuser le demarrage si la cle manque en production.

## Readiness Matrix

### Produit et UX

- Statut: Orange
- Commentaire: parcours principal present, mais la fiabilite connecteurs reste insuffisante.

### Securite

- Statut: Orange/Rouge
- Commentaire: auth globale correcte, mais reset token storage et dependances ouvertes bloquent un feu vert complet.

### Fiabilite applicative

- Statut: Rouge
- Commentaire: etats OAuth et fallback memoire incompatibles avec une infra stateless mature.

### Observabilite

- Statut: Orange
- Commentaire: Sentry present, smoke test present, mais peu de gates automatiques et peu de preuves sur alerting/recovery.

### Tests / QA

- Statut: Rouge
- Commentaire: build/lint OK, mais presque pas de coverage fonctionnelle prouvable.

### Exploitation / Release engineering

- Statut: Orange/Rouge
- Commentaire: docs et artefacts legacy brouillent la procedure de release.

## Plan d'Action Recommande

### Sous 48 heures

1. Corriger le stockage des `state` OAuth Shopify/Amazon avec un store partage.
2. Patcher `axios` et `nodemailer`, relancer `npm audit`.
3. Hasher les tokens reset/invitation et purger les tokens existants.
4. Corriger `admin/performance/purge` pour que le mode choisi soit reellement executable.
5. Mettre a jour le README de production et sortir les artefacts legacy du chemin critique.

### Sous 7 jours

1. Ajouter une CI minimale: lint frontend, build frontend, test backend, audit deps.
2. Ajouter E2E sur auth, reset password, billing, connecteurs mockes.
3. Supprimer les fallbacks memoire pour les leads ou les remplacer par une queue durable.
4. Durcir la gestion des secrets avec cle dediee obligatoire.

### Sous 30 jours

1. Decouper `server-minimal.js` en modules applicatifs maintenables.
2. Formaliser un vrai runbook incident / rollback / migration.
3. Mettre en place SLO, alerting et healthchecks bout en bout.

## Decision Finale

Je recommande de ne pas lancer publiquement FEEDPLUG tant que les P1 ne sont pas traites.

Si vous devez ouvrir un soft launch restreint, il faut au minimum:

1. Corriger OAuth state stateless.
2. Corriger les dependances backend vulnerables.
3. Corriger reset tokens.
4. Mettre en place un filet de tests sur auth + connecteurs + billing.

Une fois ces quatre points fermes, FEEDPLUG pourra passer d'un statut "demo/staging avance" a un statut "beta commerciale controlee" avec un niveau de risque nettement plus acceptable.
