# P0 Secret Encryption Rollout

Objectif: chiffrer les credentials/tokens stockés en base avec une clé dédiée obligatoire, sans fallback vers `JWT_SECRET`.

## 1. Créer la clé applicative

Créer un secret GCP dédié, distinct de `JWT_SECRET`.

Exemple:

```bash
printf '%s' 'REMPLACE_PAR_UNE_VALEUR_LONGUE_ET_ALEATOIRE' | \
gcloud secrets create secret-encryption-key --data-file=-
```

Si le secret existe déjà:

```bash
printf '%s' 'REMPLACE_PAR_UNE_VALEUR_LONGUE_ET_ALEATOIRE' | \
gcloud secrets versions add secret-encryption-key --data-file=-
```

## 2. Déployer le backend

Le pipeline Cloud Build injecte maintenant:

- `SECRET_ENCRYPTION_KEY=secret-encryption-key:latest`

Le backend démarre désormais seulement si cette clé dédiée est présente.

Déployer avec:

```bash
./deploy-backend-marketing.sh
```

## 3. Rechiffrer les données déjà présentes

Exécuter une seule fois le script sur la base cible avec les vrais secrets chargés:

```bash
cd backend-marketing
SECRET_ENCRYPTION_KEY='...' DATABASE_URL='...' npm run secrets:encrypt-existing
```

Le script rechiffre:

- `Credential.secretjson`
- `PlatformConnection.accesstoken`
- `PlatformConnection.refreshtoken`
- `PlatformConnection.metadata`
- `marketing_audits.inputjson`

## 4. Vérifier

- Connexion Shopify existante toujours exploitable
- Connexion GMC existante toujours exploitable
- Connexion Amazon existante toujours exploitable
- Audit marketing lisible sans exposer les secrets
- `npm run build` front OK
- smoke test prod OK

## 5. Retour arrière

Le code lit encore les anciennes valeurs en clair et les nouvelles valeurs chiffrées.
Le risque principal n'est donc pas la lecture, mais une mauvaise clé `SECRET_ENCRYPTION_KEY`.
Le fallback historique vers `JWT_SECRET` n'existe plus.

En cas d'erreur:

- redeployer avec la bonne clé
- ne pas relancer une rotation de clé tant que les connexions existantes n'ont pas été validées
