ok # Scoring combiné Qualité + Performance par canal

**Date** : 18 février 2026  
**Objectif** : Permettre à l’utilisateur de définir, par canal, un score qui combine la **qualité des données produit** et les **performances commerciales** sur ce canal.

---

## 1. Vision produit

Aujourd’hui Feedplug calcule un **score de qualité** (0–100) basé sur les données du flux (titre, description, image, prix, attributs techniques). Les **performances commerciales** par canal (Google Ads, Amazon, Meta, etc.) ne sont pas encore intégrées dans un score.

**Objectif** : une page dédiée où l’utilisateur peut **créer et configurer un scoring par canal**. Pour chaque canal (ex. Google Ads, Amazon), il définit comment combiner :

- **Qualité de la data produit** → score qualité Feedplug existant (0–100)
- **Performances commerciales** sur ce canal → métriques (impressions, clics, conversions, CA, etc.) ramenées à un score 0–100 ou utilisées dans une formule

Le résultat est un **score par canal** (et éventuellement un score global agrégé) qui reflète à la fois “est-ce que ma fiche est bonne ?” et “est-ce que ce produit performe sur ce canal ?”.

---

## 2. Concepts

| Concept | Description |
|--------|-------------|
| **Score qualité** | Déjà existant. Calculé à partir des champs du flux (ProductScore.qualityScore, qualityDetails). |
| **Métriques de perf canal** | Par produit et par canal : impressions, clics, conversions, revenus, etc. Stockées ou dérivées (APIs, imports). |
| **Règle de scoring canal** | Configuration créée par l’utilisateur pour **un canal** : comment combiner qualité + perf pour obtenir un score 0–100 (ex. 50 % qualité + 50 % perf, ou formule personnalisée). |
| **Score par canal** | Résultat du calcul pour un produit sur un canal donné, selon la règle du canal. |

---

## 3. Parcours utilisateur cible

1. L’utilisateur va sur une page **« Scoring par canal »** (ex. `/scoring-canaux` ou `/parametres/scoring-canaux`).
2. Il voit la liste des canaux disponibles (Google Ads, Meta Ads, Amazon, Mirakl, Shopify, Autre).
3. Pour chaque canal, il peut **créer ou modifier une règle de scoring** :
   - Activer/désactiver le scoring pour ce canal
   - Choisir le **poids de la qualité** vs **poids de la performance** (ex. 50/50, 70/30)
   - Optionnel : choisir quelles métriques de perf entrent dans le calcul (conversions, CA, CTR, etc.) et comment les normaliser en 0–100
4. Une fois les règles sauvegardées, le système calcule (ou recalcule) les scores par canal pour chaque produit.
5. Ces scores sont visibles :
   - Dans le catalogue (colonnes ou filtres par canal)
   - Dans une vue analytique / dashboard (évolution, top produits par canal)
   - Dans les exports si besoin

---

## 4. Modèle de données proposé

### 4.1 Existant (à réutiliser)

- **ProductScore** : `qualityScore`, `performanceScore`, `qualityDetails`, `performanceDetails`, lié à `FeedItem`.
- **PerformanceChannel** : par (ProductScore, canal, période) → `metrics` (JSONB), `channelScore` (0–100). Idéal pour stocker les métriques de perf et le score calculé par canal.

### 4.2 Nouveau : configuration du scoring par canal

Une table **ChannelScoringConfig** (ou équivalent) par compte :

| Champ | Type | Description |
|-------|------|-------------|
| id | TEXT PK | UUID |
| accountId | TEXT FK | Compte (multi-tenant) |
| channel | TEXT | GOOGLE_ADS, META_ADS, AMAZON, MIRAKL, SHOPIFY, OTHER |
| name | TEXT | Nom affiché (ex. "Google Ads") |
| enabled | BOOLEAN | Scoring actif pour ce canal |
| qualityWeight | DECIMAL | Poids du score qualité (ex. 0.5 pour 50 %) |
| performanceWeight | DECIMAL | Poids du score performance (ex. 0.5) |
| performanceMetrics | JSONB | Optionnel : quelles métriques utiliser (conversions, revenue, ctr…) et comment les normaliser |
| period | TEXT | Période des perf (ex. LAST_30_DAYS) |
| createdAt / updatedAt | TIMESTAMPTZ | |

Contrainte : `qualityWeight + performanceWeight = 1` (ou on normalise côté calcul).

**Alternative légère** : stocker la config en JSONB dans une table “AccountSettings” (clé `channelScoring`) si on veut éviter une nouvelle table au début.

### 4.3 Calcul du score par canal

Pour un produit et un canal :

1. Récupérer **qualityScore** depuis ProductScore (déjà calculé).
2. Récupérer les **métriques de perf** pour ce produit sur ce canal (PerformanceChannel.metrics ou API/import).
3. Calculer un **performanceScore normalisé** 0–100 à partir des métriques (règle simple : percentile, ou min-max sur le catalogue).
4. Appliquer la **règle du canal** :  
   `channelScore = qualityWeight * qualityScore + performanceWeight * performanceScoreNormalized`
5. Enregistrer dans **PerformanceChannel** (ou table dédiée) : `channelScore`, `metrics`, `date`, `period`.

Si aucune donnée de perf n’existe pour le produit sur ce canal, on peut soit utiliser uniquement la qualité (performanceWeight = 0 ou fallback), soit afficher “Pas de données”.

---

## 5. Page / interface

### 5.1 Emplacement

- **Option A** : Page dédiée **« Scoring par canal »** dans le menu principal (sidebar), ex. `/scoring-canaux`, à côté de Rapports / Optimiser.
- **Option B** : Sous-section dans **Paramètres** ou **Rapports**, ex. `/parametres/scoring-canaux` ou `/rapports/scoring-canaux`.

Recommandation : **Option A** si le scoring par canal devient un pilier du produit ; **Option B** si on veut d’abord le proposer comme fonctionnalité avancée.

### 5.2 Contenu de la page

1. **Titre** : « Scoring par canal » + court paragraphe explicatif (qualité + perf).
2. **Liste des canaux** : cartes ou lignes (Google Ads, Meta Ads, Amazon, Mirakl, Shopify, Autre).
   - Pour chaque canal : statut (activé / désactivé), résumé de la règle (ex. « 50 % qualité, 50 % perf »), lien « Configurer ».
3. **Modal ou panneau « Configurer le scoring »** (au clic sur un canal) :
   - Nom du canal (éditable pour “Autre”)
   - Switch activer / désactiver
   - Slider ou champs : poids qualité (0–100 %) / poids performance (0–100 %), avec somme = 100 %
   - Optionnel : sélection des métriques de perf à prendre en compte (cases à cocher : conversions, CA, clics, etc.)
   - Optionnel : période (7j, 30j, 90j)
   - Boutons Annuler / Enregistrer
4. **Aperçu** : ex. “Votre score sur ce canal = 50 % score qualité Feedplug + 50 % performance (conversions, CA). Les produits sans donnée de perf utilisent uniquement le score qualité.”

---

## 6. Ordre d’implémentation suggéré

| Étape | Description |
|-------|-------------|
| 1 | **Config par canal** : table ou JSONB `ChannelScoringConfig` (accountId, channel, qualityWeight, performanceWeight, enabled). API CRUD (liste, get, create, update). |
| 2 | **Page « Scoring par canal »** : liste des canaux + formulaire de configuration (poids qualité / perf), sauvegarde via API. |
| 3 | **Alimentation des perf** : import ou API (Google Ads, etc.) pour remplir PerformanceChannel.metrics par produit et par canal. |
| 4 | **Calcul du score par canal** : job ou calcul à la demande qui lit ProductScore.qualityScore + PerformanceChannel.metrics, applique ChannelScoringConfig, écrit channelScore (et éventuellement performanceScore global dans ProductScore). |
| 5 | **Affichage** : catalogue (colonne ou filtre “Score Google Ads”, etc.), dashboard / rapports (évolution, top produits par canal). |

On peut livrer les étapes 1–2 sans données de perf réelles (poids performance à 0 ou score = qualité uniquement), puis activer 3–5 au fur et à mesure des intégrations.

---

## 7. Résumé

- **Oui, c’est clair** : un scoring par canal, configurable par l’utilisateur, qui combine **qualité du flux** et **performances commerciales** sur chaque canal.
- La **page** permet de **créer / éditer une règle de scoring par canal** (poids qualité vs perf, optionnellement métriques et période).
- Le **modèle** s’appuie sur ProductScore (qualité) et PerformanceChannel (métriques + score calculé), plus une config **ChannelScoringConfig** (ou équivalent) par compte et par canal.
- On peut démarrer par la config + l’UI (sans vraies données de perf), puis brancher les APIs / imports et le calcul automatique du score par canal.

Si tu valides cette direction, la suite logique est : schéma de la table de config (migration) + routes API + maquette de la page « Scoring par canal ».
