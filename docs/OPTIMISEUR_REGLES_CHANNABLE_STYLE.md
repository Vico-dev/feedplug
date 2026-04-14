# Stratégie d'intégration – Onglet "Optimiser" style Channable

## Contexte

Channable propose un onglet **Optimiser** permettant de créer des règles **IF-THEN** puissantes pour modifier ou enrichir chaque valeur d'attribut, en ciblant un ou plusieurs canaux. Cette fonctionnalité est un différentiateur fort car elle permet :
- De personnaliser les données **par canal** (ex. titre différent pour Amazon vs Google)
- D'automatiser des corrections récurrentes (remises, mapping de catégories, etc.)
- De combiner conditions et actions de façon flexible

---

## 1. État actuel Feedplug

### Modèle déjà en place ✅
- **Rule** : `conditionJson`, `actionJson`, `feedIds`, `channelIds`, `priority`, `startDate`, `endDate`, `runOnIngestion`
- **Scope** : flux (feedIds) + canaux (channelIds) déjà documenté dans `MOTEUR_REGLES_SCOPE.md`
- **ExportChannel** : GMC et autres canaux
- **FeedItemRevision** : historisation
- **EnrichmentSource** : enrichissement par CSV/API

### Manques
- **Pas de page "Optimiser"** dédiée dans la navigation
- **Pas d'API CRUD règles** exposées (`/api/v1/rules`)
- **Pas de moteur d'exécution des règles** à l'ingestion / à l'export (le modèle existe mais l'exécution n'est pas branchée)
- **conditionJson / actionJson** : format non défini de façon structurée
- **Pas de prévisualisation** (simulation "avant/après" par règle)

---

## 2. Modèle de règles (logique métier)

### 2.1 Structure conditionJson (IF)

```
{
  "operator": "AND" | "OR",
  "conditions": [
    {
      "field": "title" | "brand" | "price" | "category" | "customfields.xxx" | ...,
      "operator": "contains" | "equals" | "not_equals" | "is_empty" | "starts_with" | "in" | "not_in" | "lt" | "lte" | "gt" | "gte" | "regex",
      "value": "string" | number | string[] | null
    }
  ]
}
```

**Exemples :**
- Marque = "Nike" **ET** prix &lt; 100 €
- Catégorie contient "Électronique" **OU** title contient "phone"
- Champ personnalisé `customfields.promotion` est vide

### 2.2 Structure actionJson (THEN)

```
{
  "type": "set_value" | "copy_field" | "template" | "search_replace" | "calculate" | "exclude" | "concat" | "ai_fill",
  "params": {
    "field": "title" | "brand" | ...,
    "value": "string" (pour set_value),
    "sourceField": "xxx" (pour copy_field),
    "template": "{brand} - {title} | {price}€" (pour template),
    "pattern": "regex",
    "replacement": "string" (pour search_replace),
    "formula": "price * 0.9" (pour calculate),
    "separator": " | " (pour concat),
    "fields": ["field1", "field2"] (pour concat)
  }
}
```

**Types d'actions inspirés Channable :**

| Type | Description | Exemple |
|------|-------------|---------|
| `set_value` | Remplacer par une valeur fixe | brand = "Nike" |
| `copy_field` | Copier un champ dans un autre | gtin = sku |
| `template` | Combiner avec placeholders `{field}` | title = "{brand} - {title}" |
| `search_replace` | Rechercher/remplacer (texte ou regex) | titre: " - " → " | " |
| `calculate` | Calcul (%, +, -, *, /) | price = price * 0.9 |
| `concat` | Concaténer plusieurs champs | description = title + " | " + description |
| `exclude` | Exclure du flux (ou masquer pour un canal) | - |
| `ai_fill` | Remplir par IA (Phase 2) | title vide → optimiser par IA |

### 2.3 Ordre d'application

1. **Règles métier** (IF-THEN) → par priorité croissante
2. **Enrichissement** (EnrichmentSource CSV/API)
3. **Optimisation IA** (titres, descriptions)
4. **Overrides manuels** (éditions produit)

Les règles sont filtrées par :
- **feedIds** : item.feedId ∈ feedIds (ou tous si vide)
- **channelIds** : canal courant ∈ channelIds (ou tous si vide)
- **Dates** : now ∈ [startDate, endDate] (ou infini si null)
- **isActive** : true

---

## 3. UX – Intégration dans l'interface

### 3.1 Emplacement

**Option A : Page dédiée "Optimiser"**
- Nouvelle entrée navigation : **Optimiser** (icône Filter ou Sparkles)
- Route : `/optimiser`
- Avantage : visibilité, focalisation
- Risque : duplication avec "IA & Optimisation"

**Option B : Sous Flux**
- Onglet "Optimiser" au sein de la page Flux (chaque flux a son onglet)
- Route : `/flux/[feedId]?tab=optimiser`
- Avantage : contexte par flux
- Inconvénient : règles multi-flux moins évidentes

**Option C (recommandée) : Section dans Flux + page globale**
- **Flux** : pour chaque flux, onglet **Optimiser** = règles filtrées par ce flux
- **Page globale** : `/optimiser` = toutes les règles du compte, avec filtre flux/canal
- L’utilisateur peut créer une règle depuis le flux ou depuis la page globale

### 3.2 Architecture UX de la page Optimiser

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Optimiser                                                    [+ Nouvelle]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Filtres : [Flux ▼] [Canal ▼] [Actives uniquement ☑]                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Règle 1 : Titre Amazon          flux: Shopify FR   canal: Amazon FR   │  │
│  │ IF brand = "Nike" AND price < 100                                      │  │
│  │ THEN title = "{brand} - {title} [Promo]"                               │  │
│  │ Priorité: 10 | Actif ☑ | [Éditer] [Dupliquer] [Désactiver]            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Règle 2 : Remise catégorie Élec     flux: Tous   canal: Amazon UK      │  │
│  │ IF product_type contains "Électronique"                                │  │
│  │ THEN price = price * 0.9                                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Création / édition d'une règle (modal ou page)

**Bloc 1 – Nom & portée**
- Nom de la règle
- Flux : Tous / Sélection (multi-select)
- Canaux : Tous / Sélection (multi-select : GMC, Amazon FR, Meta, etc.)
- Dates : optionnel (début / fin)
- Priorité : 0–100 (0 = priorité max)
- Appliquer à l’ingestion : oui / non

**Bloc 2 – Conditions (IF)**
- Builder visuel : ajouter condition
  - Champ : dropdown (title, brand, price, category, customfields.xxx, etc.)
  - Opérateur : contient, égale, vide, <, >, in, regex...
  - Valeur : input adapté au type (texte, nombre, liste, date)
- Combinaison : AND / OR entre conditions
- Bouton "Ajouter une condition"

**Bloc 3 – Actions (THEN)**
- Type d’action : dropdown
- Paramètres selon le type (champ cible, valeur, template, etc.)
- Possibilité d’actions multiples (AND) : "Puis faire aussi..."

**Bloc 4 – Prévisualisation**
- Bouton "Simuler sur X produits"
- Affichage de quelques items avant/après
- Option : télécharger un échantillon en CSV

### 3.4 Intégration dans le flux produit

Sur la fiche produit (`/catalogue/[id]`) :
- Indicateur "Règles actives" : badge montrant le nombre de règles qui s’appliquent
- Onglet "Par canal" : vue des valeurs **calculées par canal** (après règles)
- Historique : distinguer source `rule` vs `manual` vs `ingestion`

---

## 4. Logique métier – Implémentation technique

### 4.1 API à créer

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v1/rules` | Liste (filtres: feedIds, channelIds, isActive) |
| POST | `/api/v1/rules` | Créer |
| GET | `/api/v1/rules/:id` | Détail |
| PATCH | `/api/v1/rules/:id` | Modifier |
| DELETE | `/api/v1/rules/:id` | Supprimer |
| POST | `/api/v1/rules/apply` | Appliquer (body: feedIds?, channelIds?, itemIds?) |
| POST | `/api/v1/rules/:id/preview` | Simuler sur N items, retour avant/après |

### 4.2 Moteur d'exécution

```
applyRules(items, feedId, channelId) {
  rules = getActiveRules(accountId, feedId, channelId)
  rules.sort(by priority ASC)
  for each rule in rules:
    for each item in items:
      if evaluateCondition(rule.conditionJson, item):
        applyAction(rule.actionJson, item)
        createRevision(item, source: 'rule')
}
```

- **evaluateCondition** : interpréter le JSON de condition (AND/OR, opérateurs)
- **applyAction** : selon le type (set_value, template, etc.), modifier l’item (ou sa copie pour l’export)

### 4.3 Intégration dans le pipeline

- **À l’ingestion** : après insertion/mise à jour des FeedItems, exécuter les règles avec `runOnIngestion = true` pour les scope concernés
- **À l’export** : lors de la génération du flux pour un canal, appliquer les règles dont le scope inclut ce canal (si `runOnIngestion = false`, ou en complément pour règles export-only si on les ajoute plus tard)

---

## 5. Schéma JSON (exemples validés)

### conditionJson
```json
{
  "operator": "AND",
  "conditions": [
    { "field": "brand", "operator": "equals", "value": "Nike" },
    { "field": "price", "operator": "lt", "value": 100 }
  ]
}
```

### actionJson (template)
```json
{
  "type": "template",
  "params": {
    "field": "title",
    "template": "{brand} - {title} | Promo"
  }
}
```

### actionJson (calculate)
```json
{
  "type": "calculate",
  "params": {
    "field": "price",
    "formula": "price * 0.9"
  }
}
```

---

## 6. Roadmap recommandée

| Phase | Livrable | Statut |
|-------|----------|--------|
| **1** | Schémas conditionJson/actionJson (validation) | ✅ Livré |
| **2** | API CRUD règles + moteur evaluateCondition + applyAction | ✅ Livré |
| **3** | Intégration ingestion + export | ✅ Livré |
| **4** | Page Optimiser (liste, modal création règle) | ✅ Livré |
| **5** | Prévisualisation (simulation avant/après) | ✅ Livré |
| **6** | Actions avancées (search_replace, concat, exclude) | À venir |
| **7** | Intégration fiche produit (badge règles, vue par canal) | À venir |

---

## 7. Différenciation vs Channable

Pour aller plus loin que Channable :
1. **IA intégrée** : action `ai_fill` pour champs vides ou score faible
2. **Templates prédéfinis** : "Règle remise catégorie", "Règle titre Google Shopping", etc.
3. **A/B par canal** (Phase 3 du plan existant) : variantes de titre/description par canal
4. **Analytics** : nombre de produits modifiés par règle, impact estimé
5. **Validation** : vérifier conformité canal (ex. titre Google ≤ 150 caractères) après application

---

## Résumé

- **Modèle** : Rule existe déjà ; standardiser `conditionJson` et `actionJson` avec des schémas clairs.
- **UX** : Page "Optimiser" dédiée + onglet dans Flux ; builder IF-THEN visuel, scope flux/canal, prévisualisation.
- **Logique** : Moteur d’exécution condition/action ; intégration ingestion + export ; ordre Règles → Enrichissement → IA → Manuel.
- **Priorité** : Phase 1–4 pour un MVP "Optimiser" opérationnel, puis affiner avec prévisualisation et analytics.
