# Checklist avant déploiement

## Config prod — première vente (bloquant)

À faire **avant première démo / première vente** :

### 1. Frontend : URL de l’API (backend-marketing)

Le frontend doit appeler le **bon** backend en prod (backend-marketing sur Cloud Run).

| Variable | Où la définir | Valeur type |
|----------|----------------|-------------|
| `NEXT_PUBLIC_API_URL` | Build frontend (au moment du build) | `https://VOTRE_URL_CLOUD_RUN_BACKEND/api/v1` |

- **Fichiers concernés** : `frontend/src/lib/api.ts`, `frontend/src/app/(dashboard)/flux/page.tsx`, `frontend/Dockerfile`.
- **Dockerfile** : passer en build-arg, ex. `ARG NEXT_PUBLIC_API_URL=...` puis `ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL`.
- **Cloud Build / CI** : définir `NEXT_PUBLIC_API_URL` (ou équivalent) dans la commande de build du frontend pour qu’elle pointe vers l’URL réelle du backend (ex. `https://feedplug-backend-marketing-XXXX.europe-west1.run.app/api/v1`).
- Si cette variable n’est pas définie en prod, le frontend utilisera la valeur par défaut codée dans `api.ts` ; vérifier que c’est bien l’URL de prod.

### 2. Backend : SMTP (forgot-password, emails transactionnels)

Sans SMTP, les emails de réinitialisation de mot de passe et les notifications ne partent pas (mode mock = log console uniquement).

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `SMTP_HOST` | Oui pour prod | Serveur SMTP (ex. SendGrid, Mailgun, OVH, Gmail) |
| `SMTP_USER` | Oui | Utilisateur SMTP |
| `SMTP_PASS` | Oui | Mot de passe ou clé API |
| `SMTP_PORT` | Non | Défaut 587 |
| `SMTP_SECURE` | Non | `true` pour TLS 465 |

- **Fichier** : `backend-marketing/email/email-service.js` (utilisé par `server-minimal.js`).
- **Cloud Run** : ajouter ces variables (ou les stocker dans Secret Manager et les attacher au service) dans la config du service backend-marketing.
- **Test** : déclencher « Mot de passe oublié » depuis l’app et vérifier réception de l’email.

**Checklist config prod :**

- [ ] `NEXT_PUBLIC_API_URL` défini au build du frontend et pointant vers l’URL réelle du backend (backend-marketing).
- [ ] SMTP configuré sur le backend (SMTP_HOST, SMTP_USER, SMTP_PASS au minimum).
- [ ] Test forgot-password : email reçu.

### 3. Backend : CORS (éviter les régressions à chaque déploiement)

- **Source unique** : `backend-marketing/lib/cors.js`. Les origines viennent de `CORS_ORIGINS` ou `CORS_ORIGIN` (env), avec fallback sur la liste par défaut.
- **Ne pas ajouter de `app.use()` avant le middleware CORS** dans `server-minimal.js` (juste après `trust proxy`). Sinon les requêtes OPTIONS peuvent être interceptées (ex. 429) et le front ne pourra plus appeler l’API.
- **Nouvelle route app (frontend)** : l’ajouter dans `APP_ROUTES` dans `frontend/middleware.ts` pour que la redirection feedplug.com → app.feedplug.com s’applique (sinon risque d’erreur CORS).
- **Cloud Build** : après déploiement, un smoke test vérifie health (200) et OPTIONS (204). Si OPTIONS ≠ 204, le build échoue.

---

## Obligatoire (migrations / base)

1. **Migration 013 (ExportChannel)**  
   Appliquer la migration avant ou au déploiement du nouveau code, sinon les routes Amazon canaux renverront 500 (table absente).
   ```bash
   # Exemple avec Cloud SQL Proxy
   psql -h localhost -U feedplug_user -d feedplug_marketing -f prisma/migrations/013_export_channel.sql
   ```
   Ou via votre procédure habituelle (script, CI, etc.).

2. **Aucune autre variable obligatoire** pour GMC/Amazon avec la config actuelle. Optionnel : `AMAZON_LWA_AUTH_URL` pour la future connexion SP-API.

## GCS : URLs signées (images lifestyle, « Copier l’URL »)

Si l’app renvoie **« Image générée mais impossible de créer l'URL de prévisualisation »**, le compte de service Cloud Run doit pouvoir **signer des URLs** GCS. À faire une fois en prod :

- Donner au compte de service Cloud Run le rôle **Service Account Token Creator** sur **lui‑même**.
- Commandes détaillées : voir **`backend-marketing/docs/GCS_SIGNED_URLS.md`**.

- [ ] Permission IAM Token Creator sur le compte de service (voir GCS_SIGNED_URLS.md) si tu utilises les images lifestyle / proxy-image.

## Vérifications rapides

- [ ] Migration 013 exécutée sur la base cible
- [ ] `npx prisma generate` exécuté en build (pour le client Prisma à jour)
- [ ] **Export CSV GMC** : `GET /api/v1/ingestion/feeds/:id/export?format=csv&platform=gmc` — requête alignée sur la casse des colonnes FeedItem (migration 002 = camelCase). Si l’export échoue encore, vérifier en base les noms réels des colonnes de `FeedItem`.
- [ ] Export Amazon : `?format=csv&platform=amazon&channel=amazon_fr` après déploiement

## Trafic Cloud Run (éviter « clés non configurées »)

Si tu as fait une modif **sans** passer par le Cloud Build (ex. `gcloud run services update --update-secrets=...` ou `--set-env-vars`), une **nouvelle révision** est créée avec la config à jour, mais le trafic peut rester sur une **ancienne** révision. Résultat : les nouveaux secrets/variables ne sont pas pris en compte.

**À faire après toute modif manuelle du service :**

```bash
gcloud run services update-traffic feedplug-backend-marketing \
  --region=europe-west1 \
  --project=feedplug-prod \
  --to-latest
```

Le **Cloud Build** (`cloudbuild-backend-marketing.yaml`) fait déjà cette étape après chaque déploiement, donc en déployant uniquement via Cloud Build tu évites le problème.

## Rollback

En cas de problème : la table `ExportChannel` peut rester en base sans impact sur le reste. Les routes Amazon renverront 500 tant que la table n’existe pas ; désactiver ces routes en déployant la version précédente si besoin.
