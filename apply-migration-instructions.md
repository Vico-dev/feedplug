# Instructions pour appliquer la migration GMC

## Option 1 : Via Cloud Shell (Recommandé)

1. Ouvrez Cloud Shell : https://console.cloud.google.com/cloudshell?project=feedplug-prod

2. Créez le fichier SQL :
```bash
cat > /tmp/gmc_migration.sql << 'SQL_EOF'
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "gtin" TEXT;
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "mpn" TEXT;
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "additionalimages" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "saleprice" NUMERIC(18,4);
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "salepriceeffectivedate" TEXT;
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "condition" TEXT DEFAULT 'new';
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "producttype" TEXT;
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "googleproductcategory" TEXT;
CREATE INDEX IF NOT EXISTS idx_feeditem_gtin ON "FeedItem"(gtin) WHERE gtin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feeditem_mpn ON "FeedItem"(mpn) WHERE mpn IS NOT NULL;
SQL_EOF
```

3. Exécutez la migration :
```bash
gcloud sql connect feedplug-db --user=feedplug_user --database=feedplug_marketing --project=feedplug-prod < /tmp/gmc_migration.sql
```

## Option 2 : Via psql (si Cloud SQL Proxy est installé)

1. Lancez Cloud SQL Proxy :
```bash
cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db
```

2. Dans un autre terminal :
```bash
psql -h localhost -U feedplug_user -d feedplug_marketing -f backend-marketing/prisma/migrations/006_add_gmc_fields.sql
```

## Vérification

Après la migration, testez avec :
```bash
./test-enrichment.sh
```
