# Proposition de grille tarifaire V2 — Double dimension + add-on IA

## Principes

1. **Double dimension** : le prix dépend du **nombre de produits** et du **nombre de canaux d’export activés**.
2. **IA en add-on** : la **génération de titres** et la **génération d’images** (IA) sont un **pack optionnel** facturé en plus (+49 € HT/mois).
3. **Hors grille = devis** : au-delà des seuils (produits ou canaux), le client passe sur **devis** et **accord-cadre avec SLA**.

---

## Définitions

- **Canal** = un canal d’export activé pour le compte (ex. Google Merchant Center, Meta Catalog, Amazon, Mirakl, Shopify, ChatGPT, etc.). Chaque connexion / destination d’export compte pour 1 canal.
- **Produits** = nombre de produits (FeedItem) gérés dans FeedPlug pour le compte, tous flux confondus.
- **Add-on IA** = pack comprenant : **génération de titres** (IA) et **génération d’images** (IA).

---

## Grille de base (HT / mois) — Produits × Canaux

Prix **sans** add-on IA. L’intersection ligne (produits) × colonne (canaux) donne le tarif mensuel.

| Produits | 1 canal | 2 canaux | 3 canaux | 4 canaux | 5 canaux |
|----------|---------|----------|----------|----------|----------|
| **Jusqu’à 100** | 39 € | 49 € | 59 € | 69 € | 79 € |
| **Jusqu’à 500** | 79 € | 99 € | 119 € | 139 € | 159 € |
| **Jusqu’à 1 000** | 129 € | 159 € | 189 € | 219 € | 249 € |
| **Jusqu’à 2 500** | 199 € | 249 € | 299 € | 349 € | 399 € |
| **Jusqu’à 10 000** | 299 € | 369 € | 439 € | 509 € | 579 € |
| **Jusqu’à 50 000** | 449 € | 549 € | 649 € | 749 € | 849 € |

- **Au-delà de 50 000 produits** → **sur devis**.
- **Au-delà de 5 canaux** → **sur devis** (accord-cadre + SLA).

---

## Add-on IA (optionnel)

| Add-on | Prix mensuel (HT) | Contenu |
|--------|-------------------|--------|
| **Pack IA** | **+49 € HT / mois** | Génération de titres (IA) + génération d’images (IA). |

- **Add-on IA = 49 € HT / mois** (optionnel, désactivable). Le client peut souscrire à la grille sans pack IA.
- Extension possible plus tard : autres fonctionnalités IA (ex. descriptions, score qualité, A/B titres) en add-on complémentaire.

---

## Hors grille — Devis et accord-cadre

Les clients suivants sortent de la grille et sont obligatoirement en **devis** et **accord-cadre** :

| Critère | Seuil | Modalité |
|---------|--------|----------|
| **Produits** | > 50 000 | Devis + accord-cadre + SLA (disponibilité, délais de traitement). |
| **Canaux** | > 5 canaux | Devis + accord-cadre + SLA. |

- Contrat type : accord-cadre annuel avec SLA (uptime, délai de support, éventuellement garantie de volume).
- Tarification : soit forfait mensuel négocié, soit formule « base grille 50K + X canaux » avec complément au forfait.

---

## Récap pour communication

- **Entrée de gamme** : 39 € HT/mois (1 canal, jusqu’à 100 produits, sans IA).
- **Exemple milieu de gamme** : 159 € HT/mois (5 canaux, 500 produits) + 49 € si pack IA = **208 € HT/mois**.
- **Haut de gamme (grille)** : 849 € HT/mois (5 canaux, 50 000 produits) + 49 € IA = **898 € HT/mois**.
- **Hors grille** : sur devis, accord-cadre, SLA.

---

## Suite possible (implémentation)

1. **Valider** cette grille (seuils produits, tranches canaux, prix de base, prix add-on IA).
2. **Adapter le modèle** : stocker par compte au minimum `planBase` (ou tranche produits + tranche canaux), `addonIA` (booléen ou identifiant pack), et éventuellement un flag `horsGrille` / `surDevis`.
3. **Mettre à jour** :
   - `backend-marketing/lib/plan-limits.js` (limites par tranche produits × canaux + feature add-on IA),
   - `backend-marketing/routes/onboarding-billing.js` (prix / priceId Stripe si besoin),
   - `frontend/src/config/plans.ts` et pages tarifs / choix de plan pour afficher la grille et l’add-on.

Si tu valides les principes et les ordres de grandeur, on peut ajuster les tranches (ex. 2K, 10K, 20K au lieu de 1K, 5K, 10K) ou le prix du pack IA, puis passer à l’implémentation technique.
