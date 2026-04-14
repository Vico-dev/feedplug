# Système de Scoring pour Google Shopping

## Structure du Score (0-100)

### 1. Champs Obligatoires GMC (60 points max)
- **Title** (15 points)
  - Présence : 5 points
  - Qualité (longueur, mots-clés, structure) : 10 points
  
- **Description** (12 points)
  - Présence : 4 points
  - Qualité (longueur, contenu) : 8 points
  
- **Image** (12 points)
  - Présence : 4 points
  - Qualité (résolution, format) : 8 points
  
- **Price** (8 points)
  - Présence : 3 points
  - Validité (positif, raisonnable) : 5 points
  
- **Availability** (6 points)
  - Présence : 3 points
  - En stock : 3 points bonus
  
- **Condition** (4 points)
  - Présence : 4 points
  
- **Link** (3 points)
  - Présence : 3 points

### 2. Champs Recommandés GMC (25 points max)
- **Brand** (5 points)
- **GTIN** (5 points) - Important pour la visibilité
- **MPN** (3 points)
- **Google Product Category** (5 points) - Très important pour le ciblage
- **Product Type** (3 points)
- **Shipping** (2 points)
- **Tax** (2 points)

### 3. Qualité et Optimisation (15 points max)
- **Titre optimisé** (5 points)
  - Longueur optimale (50-60 caractères) : 2 points
  - Structure (Marque + Modèle + Attributs) : 2 points
  - Mots-clés pertinents : 1 point
  
- **Description riche** (5 points)
  - Longueur optimale (500-1000 caractères) : 2 points
  - Informations détaillées : 2 points
  - Pas de HTML excessif : 1 point
  
- **Image haute qualité** (5 points)
  - Résolution minimale (800x800px) : 3 points
  - Format optimisé (JPG/WebP) : 1 point
  - Fond neutre (détection) : 1 point

## Score Global du Catalogue

Le score global est calculé comme la moyenne pondérée de tous les produits :
- **Moyenne simple** : Somme des scores / Nombre de produits
- **Moyenne pondérée** : Par catégorie, par feed, ou par statut (en stock vs hors stock)

## Catégories de Score

- **Excellent (80-100)** : Prêt pour Google Shopping, optimisé
- **Bon (60-79)** : Acceptable, quelques améliorations possibles
- **Moyen (40-59)** : Nécessite des améliorations importantes
- **Faible (0-39)** : Non conforme, nécessite une refonte

## Actions Prioritaires

Pour chaque produit, identifier les actions prioritaires :
1. Champs obligatoires manquants (bloquant)
2. Champs recommandés manquants (amélioration)
3. Optimisations de qualité (gain de visibilité)


