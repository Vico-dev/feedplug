# 🧪 Guide de Test - Export GMC

## ✅ Corrections Appliquées

### 1. **Bug Fix : Noms de colonnes SQL**
**Avant** :
```sql
SELECT "descriptionHtml", "descriptionText", "imageUrl", "customfields"
```
**Problème** : PostgreSQL est sensible à la casse avec guillemets

**Après** :
```sql
SELECT descriptionhtml, descriptiontext, imageurl, customfields
```
**Résultat** : ✅ Requête fonctionne

---

### 2. **Ajout de TOUS les champs GMC requis**

**Avant** (12 colonnes) :
```
id, title, description, link, image_link, availability, price, brand, gtin, mpn, condition, identifier_exists
```

**Après** (23 colonnes) :
```
id, title, description, link, image_link, additional_image_link,
availability, price, sale_price, brand, gtin, mpn, condition,
google_product_category, product_type, item_group_id,
color, size, gender, age_group, adult,
shipping, identifier_exists
```

---

## 🧪 Tests à Effectuer

### Test 1 : Export CSV de base
```bash
curl -s "https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/ingestion/feeds/0ccb45e2-fcac-4c67-b020-d743fe4b9881/export?format=csv&platform=gmc" -o test-export.csv

# Vérifier que ça ne retourne pas d'erreur JSON
head -5 test-export.csv
```

**Résultat attendu** :
```csv
"id","title","description","link","image_link","additional_image_link","availability",...
"mp-00005882","Coffret Essentiel Soins Bébé pour Enfant - Laboratoires Téane","Coffret...","https://...","https://...",...
```

---

### Test 2 : Vérifier les colonnes
```bash
head -1 test-export.csv | tr ',' '\n' | nl
```

**Résultat attendu** :
```
1  "id"
2  "title"
3  "description"
4  "link"
5  "image_link"
6  "additional_image_link"
7  "availability"
8  "price"
9  "sale_price"
10 "brand"
11 "gtin"
12 "mpn"
13 "condition"
14 "google_product_category"
15 "product_type"
16 "item_group_id"
17 "color"
18 "size"
19 "gender"
20 "age_group"
21 "adult"
22 "shipping"
23 "identifier_exists"
```

---

### Test 3 : Vérifier un produit complet
```bash
# Ligne 2 = premier produit
sed -n '2p' test-export.csv
```

**Vérifier** :
- ✅ `google_product_category` est rempli (ex: "Santé et beauté > Hygiène personnelle")
- ✅ `availability` = "in stock" ou "out of stock"
- ✅ `price` = format "XX.XX EUR"
- ✅ `gtin` ou `mpn` est rempli
- ✅ `identifier_exists` = "yes"

---

### Test 4 : Tester via le frontend
1. Aller sur https://app.feedplug.com/flux
2. Cliquer sur "Télécharger CSV (GMC)"
3. Le CSV doit se télécharger sans erreur
4. Ouvrir le CSV dans Excel/Google Sheets
5. Vérifier que toutes les colonnes sont présentes

---

### Test 5 : Upload dans Google Merchant Center (validation finale)
1. Aller sur https://merchants.google.com
2. Produits > Flux > + Ajouter un flux
3. Choisir "Upload ponctuel"
4. Uploader `test-export.csv`
5. Google doit accepter le flux **sans erreur critique**

**Erreurs acceptables** :
- ⚠️ Warnings sur des produits individuels (ex: description trop courte)
- ⚠️ Suggestions d'amélioration

**Erreurs bloquantes** :
- ❌ "Champ requis manquant : google_product_category"
- ❌ "Format de prix invalide"
- ❌ "Colonne obligatoire manquante"

---

## 📊 Exemple de Produit GMC Valide

Voici à quoi doit ressembler un produit dans le CSV :

```csv
"mp-00005882","Coffret Essentiel Soins Bébé pour Enfant - Laboratoires Téane","Coffret Essentiel Soins Bébé pour Enfant - Laboratoires Téane - Le Coffret Essentiel Soins Bébé des Laboratoires Téane réunit trois soins certifiés bio...","https://www.yves-rocher.fr/soin-visage/coffret-essentiel-soins-bebe/p/mp-00005882","https://www.yves-rocher.fr/medias/a795f46697fa49ef99ef4965aa77103b?context=...","https://www.yves-rocher.fr/medias/a546f2e74e344a348d5478da247afcd4?context=...","in stock","51.30 EUR","39.95 EUR","Laboratoires Téane","3700666900443","mp-00005882","new","Santé et beauté > Hygiène personnelle","Soin visage","","","4piece(s)","unisex","infant","no","FR:::4.90 EUR","yes"
```

**Colonnes importantes** :
- `title` : 150 caractères max ✅
- `description` : 5000 caractères max ✅
- `google_product_category` : "Santé et beauté > Hygiène personnelle" ✅
- `gtin` : "3700666900443" ✅
- `mpn` : "mp-00005882" ✅
- `identifier_exists` : "yes" ✅
- `price` : "51.30 EUR" ✅
- `sale_price` : "39.95 EUR" ✅

---

## ✅ Checklist de Validation

- [ ] Export CSV fonctionne (pas d'erreur JSON)
- [ ] 23 colonnes présentes dans le header
- [ ] `google_product_category` rempli pour chaque produit
- [ ] Prix au bon format (XX.XX EUR)
- [ ] GTIN ou MPN présent
- [ ] `identifier_exists` = "yes" si GTIN ou MPN présent
- [ ] CSV ouvrable dans Excel/Google Sheets
- [ ] Upload GMC sans erreur critique

---

## 🐛 Debug si ça ne fonctionne pas

### Erreur : "Erreur lors de l'export du flux"
```bash
# Vérifier les logs backend
gcloud logging read 'resource.labels.service_name=feedplug-backend-marketing AND severity>=ERROR' --limit=10 --project=feedplug-prod
```

### Erreur : "Colonne manquante en base"
```bash
# Vérifier la structure d'un item
curl -s "https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/ingestion/feeds/0ccb45e2-fcac-4c67-b020-d743fe4b9881/items?limit=1" | jq '.'
```

### Erreur GMC : "google_product_category manquant"
- Vérifier que `customfields.google_product_category` est présent dans les items
- Si absent, enrichir les produits avec l'IA pour catégoriser automatiquement

---

## 🚀 Prochaines Étapes

Une fois l'export GMC validé :

1. ✅ **Export Meta Catalog** (ajouter `platform=meta`)
2. ✅ **Push API automatique GMC** (Google Content API)
3. ✅ **Push API automatique Meta** (Meta Catalog API)
4. ✅ **Planification automatique** (cron jobs)

