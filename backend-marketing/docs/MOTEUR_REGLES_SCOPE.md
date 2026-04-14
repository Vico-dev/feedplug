# Périmètre des règles – Moteur de règles

## Objectif

Les règles configurables doivent pouvoir s’appliquer **soit à tout le compte**, **soit uniquement aux flux et/ou canaux choisis**.

Exemples :
- « Appliquer 10 % de remise sur la catégorie Électronique **pour le canal Amazon** »
- « Règle de titre (template) sur **tous les flux** »
- « Surcharge brand = X sur **le flux Shopify FR** uniquement, **tous canaux** »

---

## Modèle de portée (scope)

Chaque règle a une **portée** définie par deux listes optionnelles :

| Dimension   | Champ (ex.)   | Vide / null       | Non vide                    |
|------------|---------------|--------------------|-----------------------------|
| **Flux**   | `feedIds`     | Tous les flux du compte | Règle appliquée seulement aux flux listés |
| **Canaux** | `channelIds`  | Tous les canaux    | Règle appliquée seulement aux canaux listés (ex. Amazon FR, GMC) |

- **feedIds** : tableau d’IDs de `Feed` (sources d’ingestion). Vide = « tous les flux ».
- **channelIds** : tableau d’IDs de `ExportChannel` (destinations d’export : GMC, Amazon FR, Amazon UK, etc.). Vide = « tous les canaux ».

On peut donc avoir :
- Règle **compte** : `feedIds = []`, `channelIds = []` → s’applique partout.
- Règle **par flux** : `feedIds = [id1, id2]`, `channelIds = []` → seulement pour ces flux, tous canaux.
- Règle **par canal** : `feedIds = []`, `channelIds = [amazon_fr_id]` → tous les flux, mais seulement à l’export vers Amazon FR.
- Règle **flux + canal** : `feedIds = [shopify_fr]`, `channelIds = [amazon_fr]` → ex. « 10 % remise catégorie X pour le flux Shopify FR quand on exporte vers Amazon ».

---

## Moment d’application

- **À l’export vers un canal** : au moment de générer le flux pour un canal donné, on ne garde que les règles dont `channelIds` est vide ou contient ce canal (et idem pour le flux source du produit → `feedIds`).
- **À l’édition en masse / prévisualisation catalogue** : on peut appliquer les règles « tous canaux » (ou demander un canal cible pour prévisualiser la valeur export).

---

## Résumé

- **Flux** : tous OU sélection de flux.
- **Canaux** : tous OU sélection de canaux (ex. Amazon uniquement).
- Une règle peut donc cibler « canal Amazon » uniquement (ex. remise catégorie X pour Amazon), tout en restant optionnellement limitée à certains flux.

Ce document sert de référence pour le moteur de règles et l’édition en masse.
