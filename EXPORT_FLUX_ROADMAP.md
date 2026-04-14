# 🚀 Roadmap Export de Flux - FeedPlug

## 📊 État Actuel (Diagnostic)

### ✅ Ce qui existe déjà

#### Frontend
- ✅ Page `/flux` avec UI complète
- ✅ Bouton "Télécharger CSV (GMC)" sur chaque flux
- ✅ Service `exportFeedAsCsv()` qui appelle l'API

#### Backend  
- ✅ Endpoint `GET /api/v1/ingestion/feeds/:id/export?format=csv&platform=gmc`
- ✅ Code de génération CSV basique (lignes 1732-1796)
- ✅ Colonnes GMC standards : id, title, description, link, image_link, availability, price, brand, gtin, mpn, condition

### ❌ Ce qui ne fonctionne pas

#### Problème 1: Export plante actuellement
**Erreur**: `{"message":"Erreur lors de l'export du flux"}`  
**Cause probable**: Requête SQL qui échoue ou timeout  
**Impact**: 🔥 **BLOQUANT** - Aucun export ne fonctionne

#### Problème 2: Champs GMC incomplets
**Manquants**:
- `google_product_category` (REQUIS pour GMC)
- `product_type` 
- `item_group_id` (pour les variantes)
- `color`, `size`, `gender`, `age_group`
- `additional_image_link`
- `sale_price`, `sale_price_effective_date`
- `shipping`, `tax`

**Impact**: 🔥 **CRITIQUE** - Le flux sera rejeté par Google

#### Problème 3: Aucune plateforme autre que GMC
**Manquants**:
- Meta Catalog (Facebook/Instagram)
- Amazon
- Pinterest
- TikTok Shop

**Impact**: ⚡ **HAUTE PRIORITÉ** - Limite la valeur du produit

#### Problème 4: Pas de push API automatique
**État actuel**: Téléchargement manuel du CSV  
**Manque**: Push automatique vers les plateformes via API  
**Impact**: ⚡ **HAUTE PRIORITÉ** - Automatisation limitée

#### Problème 5: Pas de mapping customisé
**État actuel**: Mapping hardcodé dans le code  
**Manque**: Interface pour mapper les champs source → destination  
**Impact**: ⚡ **MOYENNE PRIORITÉ** - Flexibilité limitée

---

## 🎯 Priorités & Killer Features

### 🔥 PRIORITÉ 1 : Fixer l'export GMC de base (2-3 jours)

**Objectif**: Avoir un export CSV GMC qui fonctionne avec TOUS les champs requis

**Tasks**:
1. ✅ **[KILLER]** Debugger et fixer l'endpoint d'export (pourquoi il plante)
2. ✅ **[KILLER]** Ajouter TOUS les champs GMC requis/recommandés
3. ✅ **[KILLER]** Gérer correctement les champs customs (`customfields`)
4. ✅ Optimiser la requête SQL (pagination, indexes)
5. ✅ Ajouter la validation GMC (vérifier que tous les champs requis sont présents)
6. ✅ Logs détaillés pour debug

**Résultat attendu**: 
```csv
id,title,description,link,image_link,availability,price,brand,gtin,mpn,google_product_category,product_type,condition,color,size,gender,age_group...
PROD001,T-shirt Nike,Description...,https://...,https://img...,in stock,29.99 EUR,Nike,123456789,TSHIRT-001,Apparel & Accessories > Clothing > Shirts,T-Shirts > Sport,new,Blue,M,male,adult,...
```

**Validation**: Pouvoir uploader le CSV dans Google Merchant Center sans erreur

---

### 🔥 PRIORITÉ 2 : Export Meta Catalog (2-3 jours)

**Objectif**: Support du format Meta (Facebook/Instagram)

**Tasks**:
1. ✅ **[KILLER]** Ajouter `format=csv&platform=meta` à l'endpoint
2. ✅ **[KILLER]** Mapper les champs GMC → Meta
   - `id` → `id`
   - `title` → `title`
   - `description` → `description`
   - `link` → `link`
   - `image_link` → `image_url`
   - `availability` → `availability`
   - `price` → `price`
   - `brand` → `brand`
   - `condition` → `condition`
   - `google_product_category` → `google_product_category` (Meta l'accepte aussi)
3. ✅ Gérer les champs spécifiques Meta (`fb_product_category`, `custom_label_0-4`)
4. ✅ Validation Meta

**Format Meta attendu**:
```csv
id,title,description,link,image_url,availability,price,brand,condition,google_product_category,custom_label_0,custom_label_1
PROD001,T-shirt Nike,Description...,https://...,https://img...,in stock,29.99 EUR,Nike,new,Apparel & Accessories > Clothing > Shirts,Sport,Premium
```

---

### 🔥 PRIORITÉ 3 : Push API automatique GMC (3-5 jours)

**Objectif**: Pusher automatiquement les produits vers Google Merchant Center via API

**Tasks**:
1. ✅ **[KILLER]** Intégration Google Content API for Shopping
2. ✅ **[KILLER]** Authentification OAuth2 (récup credentials depuis DB)
3. ✅ **[KILLER]** Push des produits en batch (max 1000 par requête)
4. ✅ Gestion des erreurs GMC (validation, rejets)
5. ✅ Retry logic (exponential backoff)
6. ✅ Logs de synchronisation
7. ✅ Interface frontend pour configurer les credentials GMC

**API Google Content**:
```javascript
// Endpoint: POST https://shoppingcontent.googleapis.com/content/v2.1/{merchantId}/products/batch
{
  "entries": [
    {
      "batchId": 1,
      "merchantId": "123456789",
      "method": "insert",
      "product": {
        "offerId": "PROD001",
        "title": "T-shirt Nike",
        "description": "Description...",
        "link": "https://...",
        "imageLink": "https://img...",
        "contentLanguage": "fr",
        "targetCountry": "FR",
        "channel": "online",
        "availability": "in stock",
        "price": { "value": "29.99", "currency": "EUR" },
        "brand": "Nike",
        "condition": "new",
        "googleProductCategory": "Apparel & Accessories > Clothing > Shirts"
      }
    }
  ]
}
```

---

### ⚡ PRIORITÉ 4 : Push API automatique Meta (3-5 jours)

**Objectif**: Pusher automatiquement vers Meta Business (Facebook/Instagram)

**Tasks**:
1. ✅ **[KILLER]** Intégration Meta Catalog API
2. ✅ **[KILLER]** Authentification OAuth2 Meta
3. ✅ **[KILLER]** Push des produits en batch
4. ✅ Gestion des erreurs Meta
5. ✅ Interface frontend pour configurer les credentials Meta

**API Meta Catalog**:
```javascript
// Endpoint: POST https://graph.facebook.com/v18.0/{catalog_id}/products
{
  "retailer_id": "PROD001",
  "availability": "in stock",
  "condition": "new",
  "description": "Description...",
  "image_url": "https://img...",
  "name": "T-shirt Nike",
  "price": "2999",
  "currency": "EUR",
  "url": "https://...",
  "brand": "Nike",
  "google_product_category": "Apparel & Accessories > Clothing > Shirts"
}
```

---

### ⚡ PRIORITÉ 5 : Planification automatique (2-3 jours)

**Objectif**: Synchronisation automatique (cron jobs)

**Tasks**:
1. ✅ **[KILLER]** Configuration de la fréquence (quotidien, hebdo, mensuel, temps réel)
2. ✅ **[KILLER]** Cron jobs Cloud Scheduler
3. ✅ Détection des changements (content hash)
4. ✅ Push uniquement des produits modifiés
5. ✅ Logs d'exécution
6. ✅ Notifications en cas d'erreur

**Interface frontend**:
```
┌─────────────────────────────────────┐
│ Planification: [Quotidien ▼]       │
│ Heure: [03:00 ▼]                    │
│ Push automatique: [✓] Google       │
│                   [✓] Meta          │
│ Notifications: [✓] Email si erreur  │
└─────────────────────────────────────┘
```

---

### 📊 PRIORITÉ 6 : Interface de mapping (3-4 jours)

**Objectif**: Permettre aux utilisateurs de mapper manuellement les champs

**Tasks**:
1. ✅ Interface drag-and-drop pour mapper champs source → destination
2. ✅ Templates pré-configurés (GMC, Meta, Amazon, Pinterest)
3. ✅ Prévisualisation du résultat
4. ✅ Validation en temps réel
5. ✅ Sauvegarde des mappings en DB

**Interface**:
```
┌──────────────────────────────────────────┐
│  Source (CSV)      →    Destination (GMC) │
├──────────────────────────────────────────┤
│  product_name      →    title             │
│  product_desc      →    description       │
│  product_url       →    link              │
│  image_1           →    image_link        │
│  price_eur         →    price             │
│  stock_qty         →    availability      │
│  [Ajouter champ +]                        │
└──────────────────────────────────────────┘
```

---

### 📈 PRIORITÉ 7 : Analytics & Monitoring (2-3 jours)

**Objectif**: Dashboard de suivi des exports

**Tasks**:
1. ✅ Tableau de bord "Exports" avec métriques
   - Nombre de produits exportés
   - Taux de succès/erreur
   - Dernière synchronisation
   - Prochaine synchronisation
2. ✅ Historique des exports (avec logs détaillés)
3. ✅ Alertes en cas d'erreur
4. ✅ Performance GMC/Meta (impressions, clics) via API

**Dashboard**:
```
┌──────────────────────────────────────┐
│ Google Merchant Center               │
│ ✓ 1,234 produits synchronisés       │
│ ⚠ 12 produits en erreur              │
│ 🕐 Dernière sync: Il y a 2h          │
│ 📈 +15% impressions cette semaine    │
└──────────────────────────────────────┘
```

---

## 🎯 Killer Features Résumées

### 🥇 Top 3 Killer Features

1. **Export CSV GMC complet qui fonctionne** (PRIORITÉ 1)
   - Impact: **VITAL** - Sans ça, rien ne fonctionne
   - Effort: 2-3 jours
   - Valeur: ⭐⭐⭐⭐⭐

2. **Push API automatique vers GMC** (PRIORITÉ 3)
   - Impact: **GAME CHANGER** - Différenciation vs concurrents
   - Effort: 3-5 jours
   - Valeur: ⭐⭐⭐⭐⭐

3. **Push API automatique vers Meta** (PRIORITÉ 4)
   - Impact: **GAME CHANGER** - Multi-canal = valeur x2
   - Effort: 3-5 jours
   - Valeur: ⭐⭐⭐⭐⭐

### 🥈 Features Importantes

4. **Export Meta Catalog** (PRIORITÉ 2)
   - Impact: **HAUTE** - Support multi-plateforme
   - Effort: 2-3 jours
   - Valeur: ⭐⭐⭐⭐

5. **Planification automatique** (PRIORITÉ 5)
   - Impact: **HAUTE** - Automatisation complète
   - Effort: 2-3 jours
   - Valeur: ⭐⭐⭐⭐

### 🥉 Features Nice-to-Have

6. **Interface de mapping** (PRIORITÉ 6)
   - Impact: **MOYENNE** - Flexibilité
   - Effort: 3-4 jours
   - Valeur: ⭐⭐⭐

7. **Analytics & Monitoring** (PRIORITÉ 7)
   - Impact: **MOYENNE** - Insights
   - Effort: 2-3 jours
   - Valeur: ⭐⭐⭐

---

## 📅 Timeline Recommandée

### Semaine 1-2: MVP Export
- ✅ PRIORITÉ 1: Fixer export GMC complet (2-3 jours)
- ✅ PRIORITÉ 2: Ajouter export Meta (2-3 jours)
- ✅ Tests manuels et validation

**Résultat**: Pouvoir télécharger des CSV GMC et Meta qui fonctionnent

### Semaine 3-4: Automatisation
- ✅ PRIORITÉ 3: Push API GMC (3-5 jours)
- ✅ PRIORITÉ 4: Push API Meta (3-5 jours)

**Résultat**: Push automatique vers les plateformes

### Semaine 5: Planification
- ✅ PRIORITÉ 5: Cron jobs et synchronisation auto (2-3 jours)

**Résultat**: Système 100% automatisé

### Semaine 6+: Amélioration
- ⏳ PRIORITÉ 6: Interface de mapping
- ⏳ PRIORITÉ 7: Analytics

---

## 🚨 Risques & Bloquants

### 🔴 BLOQUANT 1: Export actuel plante
**Risque**: Impossible d'avancer sans fixer ça  
**Solution**: Débugger en priorité (30 min - 2h)

### 🔴 BLOQUANT 2: Credentials Google/Meta manquants
**Risque**: Impossible de pusher sans API keys  
**Solution**: Demander au client de créer les apps Google/Meta

### 🟡 RISQUE 1: Rate limits API
**Risque**: Google/Meta limitent le nombre de requêtes  
**Solution**: Batch processing + retry logic

### 🟡 RISQUE 2: Validation stricte des plateformes
**Risque**: Produits rejetés si champs manquants  
**Solution**: Validation côté FeedPlug avant push

---

## ✅ Checklist de Validation

### Export GMC
- [ ] CSV téléchargeable
- [ ] Tous les champs requis présents
- [ ] Upload dans GMC sans erreur
- [ ] Au moins 100 produits testés

### Export Meta
- [ ] CSV téléchargeable
- [ ] Format Meta respecté
- [ ] Upload dans Meta Business sans erreur

### Push API GMC
- [ ] Authentification OAuth2 OK
- [ ] Push de 10 produits OK
- [ ] Push de 1000 produits OK
- [ ] Gestion des erreurs OK
- [ ] Retry logic OK

### Push API Meta
- [ ] Authentification OAuth2 OK
- [ ] Push de 10 produits OK
- [ ] Gestion des erreurs OK

### Planification
- [ ] Cron quotidien OK
- [ ] Notifications par email OK
- [ ] Logs détaillés OK

---

## 🎯 Objectif Final

**Un système complet d'export qui permet à un e-commerçant de :**
1. Importer ses produits (CSV, Shopify)
2. Les optimiser avec l'IA (titres, descriptions)
3. Les exporter automatiquement vers Google et Meta
4. Monitorer les performances en temps réel

**Temps estimé**: 5-6 semaines pour un MVP complet
**Temps critique**: 1-2 semaines pour avoir quelque chose qui fonctionne

---

**Next Step**: Commencer par PRIORITÉ 1 - Fixer l'export GMC de base
