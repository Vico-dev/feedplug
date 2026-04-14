# Coûts d’ingestion/optimisation et grille tarifaire

## Coût par 1 000 produits (ordre de grandeur)

### Ingestion (import + stockage)
- **Import** : pas d’appel IA. Coût = compute (Cloud Run) + écriture BDD, négligeable pour 1 000 produits (quelques centimes d’euro au plus).
- **Stockage** : 1 000 lignes + custom fields ≈ très faible (fraction de $/mois).

### Optimisation IA (titres, descriptions, catégorisation)
D’après `backend-marketing/ai/COST_MANAGEMENT_STRATEGY.md` et coûts Gemini :

| Poste              | Par produit (sans cache) | 1 000 produits |
|--------------------|--------------------------|----------------|
| Titre              | ~$0.00005                | ~$0.05         |
| Description        | ~$0.00015                | ~$0.15         |
| Catégorisation     | ~$0.0001                 | ~$0.10         |
| **Total IA/produit** | **~$0.0003**           | **~$0.30**     |

Avec **cache** (70–80 % de hit) : **~$0.06–0.09** pour 1 000 produits.  
En pratique, une optimisation “complète” de 1 000 produits coûte donc **moins de ~0,30 €** (sans cache) et **moins de ~0,10 €** avec cache.

### Synthèse pour 1 000 produits
- **Ingestion** : quasi nulle.
- **Optimisation IA** : **~0,10 € à 0,30 €** selon cache.
- **Total coût direct** : **< 0,50 €** pour 1 000 produits ingérés + optimisés.

La marge sur des plans à 29 € / 99 € / 299 € est donc très large. La valeur perçue (gain de temps, conformité GMC, qualité, support) permet de **tarifer plus haut** dès le départ.

---

## Grille tarifaire recommandée (début 2026)

Proposition : **Starter 49 €**, **Professional 149 €**, **Enterprise 399 €**.

| Plan          | Ancien | Nouveau | Produits | Justification courte                    |
|---------------|--------|---------|----------|----------------------------------------|
| **Starter**   | 29 €   | **49 €**   | 1 000    | Coût IA ~0,10–0,30 € ; 49 € reste accessible et valorise la stack (import + IA + GMC). |
| **Professional** | 99 € | **149 €**  | 10 000   | Cible PME ; marge confortable même avec usage IA réel + support. |
| **Enterprise** | 299 € | **399 €**  | Illimité | Grands catalogues, support dédié, SLA ; aligné avec le marché (Lengow, Channable, etc.). |

Ces montants peuvent être ajustés selon positionnement (e.g. Starter 59 € si positionnement premium).

---

## Où les prix sont définis

- **Backend** : `backend-marketing/routes/onboarding-billing.js` → objet `PLANS` (price, priceId Stripe).
- **Frontend** :  
  - `frontend/src/app/[locale]/(marketing)/tarifs/page.tsx` (page publique tarifs)  
  - `frontend/src/app/choose-plan/page.tsx` (choix de plan après inscription)  
  - `frontend/src/app/(dashboard)/facturation/page.tsx` (affichage plan actuel, libellés uniquement).

Lors d’un passage à Stripe, les `priceId` (STRIPE_PRICE_STARTER, etc.) devront correspondre aux bons prix créés dans le dashboard Stripe.

---

## Positionnement par rapport à la concurrence

### Fourchettes de prix (ordre de grandeur)

| Acteur | Entrée de gamme | Milieu de gamme | Haut de gamme | Remarque |
|--------|-----------------|-----------------|---------------|----------|
| **Lengow** | ~99 € HT/user/mois (formule Essential) | Pro / Scale sur devis | 500 €+/mois typique | Licence + modules (NetMonitor, NetRivals, NetMarkets…) facturés à l’unité ; pas de prix publics détaillés. |
| **Channable** | Packages par volume (500, 5K, 15K items…) | Standard / Plus / Pro | 300 €+/mois typique | Tarification par nombre d’items, de projets et de canaux ; plan CSS à 29 €/shop pour comparateurs. |
| **DataFeedWatch** | ~64 $/mois (~60 €) – 1 000 prod, 3 canaux | ~84 $/mois – 5 000 prod, 10 canaux | ~239 $/mois – 30 000 prod | Prix publics (ex. Shopify) ; focus flux / Shopping, moins d’enrichissement IA. |
| **FeedPlug** | **49 €** – 1 000 produits | **149 €** – 10 000 produits | **399 €** – illimité | Prix publics ; IA (titres, descriptions, score qualité) inclus ; positionnement « simple + ROI prouvé ». |

*Sources : sites officiels, comparatifs (Appvizer), ROADMAP_COMMERCIALISATION.md. Les montants concurrence sont des ordres de grandeur ; Lengow/Channable pratiquent souvent le devis sur mesure.*

### Où se situe FeedPlug

- **Prix** : **en dessous** de Lengow et Channable pour des volumes comparables (entrée et milieu de gamme), et **aligné ou légèrement en dessous** de DataFeedWatch sur l’entrée (49 € vs ~60 €).
- **Proposition de valeur** :  
  - **vs Lengow / Channable** : offre plus simple, prix affichés, **enrichissement IA avancé** (templates, score qualité, cache) et **métriques d’impact** (delta CTR, ROI) que les acteurs historiques ne proposent pas en standard.  
  - **vs DataFeedWatch** : même ordre de prix sur le bas de gamme, mais FeedPlug met l’accent sur **qualité des contenus + preuve de performance** (A/B, rapports, score) plutôt que seulement gestion de flux.
- **Positionnement résumé** : **« Bon rapport qualité–prix, orienté IA et preuve de ROI »** — cible PME et e-commerçants qui veulent optimiser leurs flux sans passer par des plateformes lourdes et chères (Lengow/Channable) ni rester sur du pur technique (DataFeedWatch).

**Communication client** : privilégier les **faits** (prix, ce qui est inclus, garanties, chiffres) ; pas de comparaison avec des concurrents ni de revendication « meilleur » — le client doit ressentir la valeur. Pitch factuel et tableau features (usage interne) : `ROADMAP_COMMERCIALISATION.md`.
