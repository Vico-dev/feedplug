# Système de Scoring Avancé pour Google Shopping

## Architecture Multi-Dimensionnelle

Le score est calculé sur **4 dimensions** indépendantes, chacune avec des métriques précises :

### 1. CONFORMITÉ GMC (0-100) - Bloquant
**Impact : Rejet du produit si < 70**

#### Champs Obligatoires (70 points)
- **ID** (5 points) - Unique, présent
- **Title** (15 points)
  - Présence : 5 points
  - Longueur valide (1-150 caractères) : 3 points
  - Pas de caractères interdits : 2 points
  - Pas de contenu promotionnel : 5 points
  
- **Description** (12 points)
  - Présence : 4 points
  - Longueur valide (1-5000 caractères) : 3 points
  - Pas de HTML invalide : 3 points
  - Pas de liens externes : 2 points
  
- **Image Link** (12 points)
  - Présence : 4 points
  - URL valide (HTTPS) : 3 points
  - Format supporté (JPG, PNG, WebP, GIF) : 3 points
  - Accessible (200 OK) : 2 points
  
- **Price** (10 points)
  - Présence : 4 points
  - Format valide (nombre positif) : 3 points
  - Devise présente : 3 points
  
- **Availability** (8 points)
  - Présence : 4 points
  - Valeur valide (in stock, out of stock, preorder, backorder) : 4 points
  
- **Condition** (6 points)
  - Présence : 3 points
  - Valeur valide (new, refurbished, used) : 3 points
  
- **Link** (2 points)
  - Présence : 2 points

#### Champs Recommandés pour Conformité (30 points)
- **Brand** (8 points) - Obligatoire pour certaines catégories
- **GTIN** (10 points) - Obligatoire si disponible
- **MPN** (5 points) - Obligatoire si pas de GTIN
- **Google Product Category** (7 points) - Très recommandé

### 2. QUALITÉ DES DONNÉES (0-100) - Impact sur la visibilité

#### Titre (25 points)
- **Longueur optimale** (50-60 caractères) : 8 points
  - 50-60 : 8 points
  - 40-70 : 6 points
  - 30-80 : 4 points
  - Autre : 2 points
  
- **Structure optimale** : 7 points
  - Format : [Marque] [Modèle] [Attributs clés] [Variantes]
  - Marque présente : 2 points
  - Modèle/Type présent : 2 points
  - Attributs clés (couleur, taille, etc.) : 2 points
  - Ordre logique : 1 point
  
- **Mots-clés pertinents** : 5 points
  - Mots-clés de recherche présents : 3 points
  - Pas de mots vides excessifs : 2 points
  
- **Lisibilité** : 5 points
  - Pas de majuscules excessives : 2 points
  - Séparateurs appropriés : 1 point
  - Pas de répétitions : 2 points

#### Description (25 points)
- **Longueur optimale** (500-1000 caractères) : 10 points
  - 500-1000 : 10 points
  - 300-1500 : 7 points
  - 100-2000 : 5 points
  - Autre : 2 points
  
- **Contenu riche** : 8 points
  - Caractéristiques principales : 3 points
  - Bénéfices utilisateur : 2 points
  - Informations techniques : 2 points
  - Utilisation/Contexte : 1 point
  
- **Structure** : 4 points
  - Paragraphes organisés : 2 points
  - Liste à puces si approprié : 1 point
  - Pas de HTML excessif : 1 point
  
- **SEO** : 3 points
  - Mots-clés pertinents : 2 points
  - Densité de mots-clés optimale : 1 point

#### Image (25 points)
- **Résolution** : 12 points
  - ≥ 800x800px : 12 points
  - ≥ 500x500px : 8 points
  - ≥ 250x250px : 5 points
  - < 250x250px : 2 points
  
- **Ratio d'aspect** : 5 points
  - Carré (1:1) : 5 points
  - 4:3 ou 3:4 : 4 points
  - 16:9 ou 9:16 : 3 points
  - Autre : 2 points
  
- **Qualité technique** : 5 points
  - Format optimisé (WebP/JPG) : 2 points
  - Taille fichier raisonnable (< 1MB) : 2 points
  - Pas de compression excessive : 1 point
  
- **Conformité visuelle** : 3 points
  - Fond neutre (détection) : 2 points
  - Pas de texte/logo sur image : 1 point

#### Prix (10 points)
- **Compétitivité** : 5 points
  - Prix cohérent avec la catégorie : 3 points
  - Prix promotionnel si applicable : 2 points
  
- **Présentation** : 3 points
  - Format correct (XX.XX) : 2 points
  - Devise claire : 1 point
  
- **Cohérence** : 2 points
  - Prix cohérent avec description : 2 points

#### Disponibilité (5 points)
- **En stock** : 5 points
- **Précommande** : 3 points
- **Rupture de stock** : 1 point
- **Sur commande** : 2 points

#### Identifiants Produit (10 points)
- **GTIN présent et valide** : 5 points
- **MPN présent** : 3 points
- **Brand présent** : 2 points

### 3. OPTIMISATION SEO (0-100) - Impact sur le ranking

#### Optimisation Titre (30 points)
- **Mots-clés primaires** : 10 points
  - Mots-clés de recherche présents : 5 points
  - Position optimale (début) : 3 points
  - Densité optimale : 2 points
  
- **Mots-clés secondaires** : 8 points
  - Mots-clés longue traîne : 4 points
  - Variations de mots-clés : 4 points
  
- **Longue traîne** : 7 points
  - Phrases de recherche complètes : 4 points
  - Intent de recherche : 3 points
  
- **Unicité** : 5 points
  - Titre unique dans le catalogue : 3 points
  - Pas de duplication : 2 points

#### Optimisation Description (25 points)
- **Mots-clés dans description** : 10 points
  - Mots-clés primaires : 5 points
  - Mots-clés secondaires : 3 points
  - Variations : 2 points
  
- **Structure sémantique** : 8 points
  - Entités nommées (marque, modèle) : 3 points
  - Attributs structurés : 3 points
  - Relations sémantiques : 2 points
  
- **Rich snippets potentiel** : 7 points
  - Données structurées possibles : 4 points
  - FAQ potentiel : 2 points
  - Reviews potentiel : 1 point

#### Catégorisation (20 points)
- **Google Product Category** : 12 points
  - Catégorie précise (niveau 3+) : 8 points
  - Catégorie générale (niveau 1-2) : 5 points
  - Absente : 0 points
  
- **Product Type** : 8 points
  - Type hiérarchique complet : 5 points
  - Type simple : 3 points
  - Absent : 0 points

#### Attributs Enrichis (25 points)
- **Attributs détaillés** : 15 points
  - Couleur : 2 points
  - Taille : 2 points
  - Matériau : 2 points
  - Genre : 2 points
  - Groupe d'âge : 2 points
  - Pattern : 2 points
  - Autres attributs : 3 points
  
- **Groupement produits** : 5 points
  - Item Group ID présent : 3 points
  - Variantes bien groupées : 2 points
  
- **Informations expédition** : 5 points
  - Shipping configuré : 3 points
  - Temps de livraison : 2 points

### 4. POTENTIEL DE CONVERSION (0-100) - Impact sur les ventes

#### Attractivité Visuelle (30 points)
- **Qualité image** : 15 points
  - Résolution haute : 5 points
  - Éclairage professionnel : 4 points
  - Angle de vue optimal : 3 points
  - Détails visibles : 3 points
  
- **Images multiples** : 10 points
  - ≥ 4 images : 10 points
  - 2-3 images : 7 points
  - 1 image : 4 points
  
- **Vidéos** : 5 points
  - Vidéo présente : 5 points

#### Informations Produit (25 points)
- **Description complète** : 10 points
  - Caractéristiques détaillées : 4 points
  - Bénéfices utilisateur : 3 points
  - Guide d'utilisation : 3 points
  
- **Spécifications techniques** : 8 points
  - Dimensions : 2 points
  - Poids : 2 points
  - Matériaux : 2 points
  - Autres specs : 2 points
  
- **Informations pratiques** : 7 points
  - Disponibilité claire : 2 points
  - Délais de livraison : 2 points
  - Garantie : 2 points
  - Retour/Échange : 1 point

#### Confiance et Preuve Sociale (25 points)
- **Avis clients** : 10 points
  - Avis présents : 5 points
  - Note moyenne ≥ 4 : 3 points
  - Nombre d'avis ≥ 10 : 2 points
  
- **Certifications** : 5 points
  - Labels qualité : 3 points
  - Certifications : 2 points
  
- **Garantie** : 5 points
  - Garantie mentionnée : 3 points
  - Durée garantie : 2 points
  
- **Retour facile** : 5 points
  - Politique retour claire : 3 points
  - Retour gratuit : 2 points

#### Prix et Promotion (20 points)
- **Prix compétitif** : 10 points
  - Prix inférieur à la moyenne : 5 points
  - Prix dans la moyenne : 3 points
  - Prix supérieur justifié : 2 points
  
- **Promotions** : 10 points
  - Prix promotionnel présent : 5 points
  - Réduction significative (≥ 10%) : 3 points
  - Dates promotion claires : 2 points

## Score Global (0-100)

Le score global est une **moyenne pondérée** des 4 dimensions :

```
Score Global = (Conformité × 0.30) + (Qualité × 0.30) + (SEO × 0.25) + (Conversion × 0.15)
```

**Pondération** :
- Conformité : 30% (bloquant)
- Qualité : 30% (base)
- SEO : 25% (visibilité)
- Conversion : 15% (performance)

## Recommandations Actionnables

Pour chaque dimension < 80, générer des recommandations spécifiques :

### Exemples de Recommandations

**Conformité < 70** :
- ❌ "Le champ [X] est obligatoire et manquant. Le produit sera rejeté par Google."
- ⚠️ "Le format du champ [X] est invalide. Corriger pour éviter le rejet."

**Qualité < 80** :
- 📝 "Le titre fait 120 caractères. Réduire à 50-60 caractères pour optimiser l'affichage."
- 🖼️ "L'image fait 300x300px. Augmenter à 800x800px minimum pour une meilleure qualité."
- 📄 "La description fait 200 caractères. Étendre à 500-1000 caractères pour plus de détails."

**SEO < 70** :
- 🔍 "Ajouter le mot-clé '[X]' dans le titre pour améliorer le ranking."
- 📂 "La catégorie Google est absente. Ajouter une catégorie précise pour un meilleur ciblage."
- 🏷️ "Ajouter les attributs couleur, taille, matériau pour enrichir les données."

**Conversion < 60** :
- 📸 "Ajouter 2-3 images supplémentaires pour montrer le produit sous différents angles."
- ⭐ "Intégrer des avis clients pour augmenter la confiance."
- 💰 "Ajouter un prix promotionnel si disponible pour augmenter l'attractivité."

## Score Global du Catalogue

### Métriques Globales
- **Score moyen** : Moyenne de tous les produits
- **Score médian** : Médiane pour éviter les outliers
- **Distribution** : % produits par catégorie de score
- **Tendance** : Évolution du score dans le temps

### Breakdowns
- **Par feed** : Score moyen par source de données
- **Par catégorie** : Score moyen par catégorie produit
- **Par statut** : Score moyen en stock vs hors stock
- **Par dimension** : Score moyen par dimension (Conformité, Qualité, SEO, Conversion)

### Actions Prioritaires Catalogue
1. **Produits bloquants** (< 70 conformité) : À corriger en priorité
2. **Gains rapides** : Produits 70-80 avec améliorations faciles
3. **Optimisations** : Produits > 80 pour maximiser la performance

## Impact Estimé

Pour chaque recommandation, estimer l'impact :

- **Impact Conformité** : Évite le rejet (100% de visibilité)
- **Impact Qualité** : +5-15% de visibilité
- **Impact SEO** : +10-30% de ranking
- **Impact Conversion** : +5-20% de taux de conversion

## Dashboard de Scoring

### Vue Produit
- Score global avec breakdown par dimension
- Graphiques radar pour visualiser les forces/faiblesses
- Liste des recommandations prioritaires
- Historique du score

### Vue Catalogue
- Score global du catalogue
- Distribution des scores
- Top produits et produits à améliorer
- Métriques par dimension
- Tendances temporelles


