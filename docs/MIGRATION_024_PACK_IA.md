# Migration 024 — Colonne Pack IA (addonia)

Sans cette migration, la colonne `addonia` n’existe pas en base : **getAccountAddonIA** échoue et tous les comptes sont considérés comme sans Pack IA (génération titres + images bloquée).

## Option 1 : Depuis l’admin (recommandé)

1. Aller sur **app.feedplug.com** → **Comptes** (en tant qu’admin).
2. Cliquer sur **« Activer le Pack IA (appliquer la migration en base) »**.
3. Si un message de succès s’affiche : ensuite, pour chaque compte concerné, **Changer** → cocher **Pack IA** → **Enregistrer**.

Si vous avez une erreur (ex. *permission denied*), utiliser l’option 2.

## Option 2 : Appliquer la migration à la main (Cloud SQL)

1. **Démarrer le proxy Cloud SQL** (dans un terminal) :
   ```bash
   cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db --port=5432
   ```
   Ou si le binaire est dans le repo :
   ```bash
   ./cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db --port=5432
   ```

2. **Récupérer le mot de passe** (Secret Manager) :
   ```bash
   gcloud secrets versions access latest --secret=database-url-marketing --project=feedplug-prod
   ```
   Le mot de passe est entre `feedplug_user:` et le `@` dans l’URL.

3. **Dans un autre terminal**, exécuter la migration :
   ```bash
   cd /Users/victorsoldet/Desktop/Feedplug
   export PGPASSWORD="VOTRE_MOT_DE_PASSE"
   psql -h 127.0.0.1 -p 5432 -U feedplug_user -d feedplug_marketing -f backend-marketing/prisma/migrations/024_account_addon_ia.sql
   ```

4. **Vérifier** (optionnel) :
   ```bash
   psql -h 127.0.0.1 -p 5432 -U feedplug_user -d feedplug_marketing -c "\d \"Account\""
   ```
   La colonne `addonia` doit apparaître (boolean, default false).

5. **Si psql avec feedplug_user échoue** (permission denied pour ALTER) : se connecter en **postgres** et exécuter le SQL à la main :
   ```bash
   gcloud sql connect feedplug-db --user=postgres --database=feedplug_marketing --project=feedplug-prod
   ```
   Puis dans la session psql :
   ```sql
   ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS addonia BOOLEAN NOT NULL DEFAULT false;
   COMMENT ON COLUMN "Account".addonia IS 'Pack IA souscrit (+49 € HT/mois) : génération titres + images';
   \q
   ```

6. Ensuite : sur **Comptes**, pour chaque client à activer, **Changer** → cocher **Pack IA** → **Enregistrer**. Les utilisateurs de ces comptes doivent **rafraîchir la page** pour que l’IA soit accessible.
