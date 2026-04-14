# URLs signées GCS (images lifestyle, proxy image)

## Erreur en prod

Si tu vois :

**« Image générée mais impossible de créer l'URL de prévisualisation. Vérifiez la config GCS (compte de service, permissions). »**

→ L’image est bien générée et enregistrée dans le bucket GCS, mais le **compte de service** utilisé par Cloud Run n’a pas le droit de **signer des URLs** (nécessaire pour les liens de prévisualisation et « Copier l’URL »).

## Cause

`getSignedUrl()` dans la lib GCS utilise l’API IAM `signBlob` pour signer l’URL. Par défaut, le compte de service Cloud Run n’a pas la permission de s’appeler lui‑même pour signer.

## Correction (une fois en prod)

1. **Identifier le compte de service** utilisé par le service Cloud Run  
   - Console GCP → Cloud Run → service `feedplug-backend-marketing` → onglet **Paramètres** / **Modifier et déployer une nouvelle révision** → section **Sécurité** → **Compte de service**.  
   - Souvent : `PROJECT_NUMBER-compute@developer.gserviceaccount.com` (ex. `771607738477-compute@developer.gserviceaccount.com` pour le projet feedplug-prod).

2. **Lui accorder le rôle Token Creator sur lui‑même** (remplace `SERVICE_ACCOUNT_EMAIL` et `feedplug-prod` si besoin) :

```bash
export PROJECT_ID=feedplug-prod
export SA_EMAIL="SERVICE_ACCOUNT_EMAIL"   # ex. 771607738477-compute@developer.gserviceaccount.com

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project="$PROJECT_ID"
```

3. **Vérifier** : regénérer une image « mise en situation » ; l’URL de prévisualisation et « Copier l’URL » doivent fonctionner.

## Récap

| Élément | Rôle |
|--------|------|
| Stockage des fichiers | Compte de service avec accès au bucket (Storage Object Admin ou équivalent). |
| URLs signées | Même compte avec **Service Account Token Creator** sur **lui‑même** pour pouvoir appeler `signBlob`. |

Sans cette permission, l’upload GCS peut réussir mais `file.getSignedUrl()` échoue et l’API renvoie l’erreur ci‑dessus.
