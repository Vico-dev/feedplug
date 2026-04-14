# Déploiement production

`gcloud` n'est pas disponible dans l'environnement Cursor. **Exécute ces commandes dans ton terminal.**

## 1. Secrets Stripe (si pas déjà fait)

```bash
cd /Users/victorsoldet/Desktop/Feedplug
./scripts/setup-stripe-secrets.sh
```

## 2. Déployer le backend

```bash
cd /Users/victorsoldet/Desktop/Feedplug
gcloud builds submit --config=cloudbuild-backend-marketing.yaml .
```

## 3. Frontend (si déployé séparément)

Le frontend Dockerfile inclut maintenant `NEXT_PUBLIC_GOOGLE_CLIENT_ID` pour le bouton Google Auth en prod.

---

**Modifs incluses dans ce déploiement :**
- GOOGLE_CLIENT_ID pour auth Google
- Routes onboarding + billing + Stripe
- Secrets Stripe via Secret Manager
