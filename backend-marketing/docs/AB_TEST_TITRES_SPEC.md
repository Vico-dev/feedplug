# Spécification : Tests A/B titres produits (statistiquement cohérents)

## Problème actuel

Le flux "Test A/B" de la page Enrichissement IA **n’est pas un vrai test A/B** :
- Un seul bras : on optimise un échantillon et on enregistre directement les titres.
- Aucun **bras témoin (control)** qui garde le titre original pour comparaison.
- Pas de durée minimale, pas de prérequis, pas de restitution type Google Ads.

Pour un test **statistiquement significatif**, il faut :
1. **Bras témoin (control)** : produits qui gardent le titre d’origine (pas de modification).
2. **Bras test (variant)** : produits qui reçoivent le titre optimisé par l’IA.
3. **Affectation aléatoire** et stable (même produit = même bras pendant tout le test).
4. **Durée minimale** et **prérequis** (effectifs, trafic) pour pouvoir conclure.
5. **Restitution** : métriques par bras, significativité, recommandation (appliquer le gagnant / prolonger / ne pas conclure).

---

## Modèle de données

### ABTest

| Champ | Type | Description |
|-------|------|-------------|
| id | cuid | Identifiant |
| accountId | string | Compte |
| name | string | Nom du test (ex. "Titres GMC – Février 2026") |
| feedId | string? | Flux concerné (optionnel = tous les flux du compte) |
| fieldUnderTest | string | Champ testé : `title` (puis plus tard description, etc.) |
| platform | string | Canal : GMC, META, AMAZON, CHATGPT |
| status | enum | draft \| running \| completed \| cancelled |
| startDate | DateTime? | Début effectif du test |
| endDate | DateTime? | Fin prévue ou effective |
| minDurationDays | int | Durée minimale recommandée (ex. 14) |
| controlPercent | int | % en témoin (ex. 50) |
| variantPercent | int | % en variant (ex. 50) |
| prerequisitesMet | boolean? | Prérequis validés au lancement |
| resultSummary | Json? | Résumé des résultats (métriques, p-value, recommandation) |
| createdAt, updatedAt | DateTime | |

### ABTestAssignment

Une ligne par produit dans le test.

| Champ | Type | Description |
|-------|------|-------------|
| id | cuid | Identifiant |
| testId | string | Référence ABTest |
| itemId | string | FeedItem.id |
| arm | enum | control \| variant |
| variantValue | string? | Pour arm=variant : titre optimisé (ou description, etc.) |
| createdAt | DateTime | |

Contrainte unique : `(testId, itemId)`.

---

## Prérequis (guidage utilisateur)

Avant de lancer un test, on vérifie et on affiche :

1. **Effectifs**
   - Minimum **par bras** : ex. 100 produits (configurable).
   - Si "50% / 50%", il faut au moins 200 produits dans le pool pour avoir 100 par bras.
2. **Durée minimale**
   - Ex. **14 jours** pour limiter les biais saisonniers et avoir assez de données.
   - L’utilisateur choisit une date de fin **≥ startDate + minDurationDays** (ou on la propose).
3. **Trafic (si disponible)**
   - Si on a des métriques (impressions GMC, clics) : avertir si trafic trop faible pour conclure en 14 j (placeholder côté métriques pour l’instant).

L’interface doit **bloquer ou avertir** si les prérequis ne sont pas remplis, et expliquer pourquoi.

---

## Flux utilisateur (création de test)

1. **Choix du type** : Test A/B titres (puis plus tard descriptions, etc.).
2. **Sélection des produits**
   - Comme aujourd’hui : aléatoire (X % du catalogue) ou par segment (marques, catégories, prix).
3. **Répartition témoin / variant**
   - Par défaut 50 % / 50 %.
   - Option : 40 % / 60 % ou 33 % / 67 % (slider ou choix prédéfinis).
4. **Prérequis**
   - Affichage : "Au moins N produits par bras (actuellement control: X, variant: Y)."
   - Durée minimale : "Test recommandé sur 14 jours minimum. Fin prévue le …."
   - Si N < 100 par bras : avertissement "Résultats peu significatifs en dessous de 100 produits par bras."
5. **Génération des variantes**
   - Pour les produits affectés au bras **variant** uniquement : appel IA pour générer le titre optimisé.
   - Les **control** ne sont pas modifiés ; on stocke juste l’affectation.
6. **Création du test**
   - Statut `draft` tant que l’utilisateur n’a pas cliqué "Démarrer le test".
   - À "Démarrer" : `status = running`, `startDate = now`, `endDate = startDate + minDurationDays` (ou date choisie).
7. **Export**
   - Lors de l’export vers le canal (ex. GMC) : pour chaque item, si un test `running` existe pour ce canal et ce champ (title), on regarde ABTestAssignment :
     - `arm = control` → exporter le titre **original** (FeedItem.title ou customfields selon source).
     - `arm = variant` → exporter `variantValue` (titre optimisé).

Ainsi, le flux exporté reflète bien les deux bras et les performances en canal (impressions, clics) pourront être comparées côté GMC/Amazon.

---

## Restitution (type Google Ads)

- **Vue centralisée** : liste de tous les tests (draft, running, completed, cancelled) avec nom, canal, dates, statut.
- **Fiche test** (détail d’un test) :
  - Résumé : nom, canal, durée, effectifs control / variant.
  - **Prérequis** : rappel des prérequis et indication "Validés" / "Non validés" au lancement.
  - **Résultats** (quand status = completed ou running avec données) :
    - Tableau ou cartes : Control vs Variant.
    - Métriques : selon données dispo (impressions, clics, CTR, conversions). En premier temps : placeholder "Métriques à connecter (GMC/Amazon)" + score qualité moyen par bras si on le calcule.
  - **Significativité** : si on a des métriques binaires ou continues, afficher un indicateur type "Différence significative au seuil 95 %" (p-value ou intervalle de confiance). Sinon message "Collecte des métriques en cours".
  - **Recommandation** :
    - "Appliquer le variant à tout le catalogue" si variant gagnant et significatif.
    - "Garder le témoin" si control gagnant.
    - "Prolonger le test" si pas encore significatif.
    - "Ne pas conclure (effectifs insuffisants)" si prérequis non remplis ou données manquantes.

---

## Interface analytique centralisée

- **Page "Tests A/B"** (ou "Analytique A/B") accessible depuis le menu (ex. Flux > onglet Tests A/B, ou menu dédié).
- **Liste des tests** : tableau avec colonnes Nom, Canal, Statut, Début, Fin, Effectifs (control / variant), Lien "Voir résultats".
- **Filtres** : statut (draft, running, completed, cancelled), canal.
- **Création** : bouton "Nouveau test A/B" qui redirige vers l’assistant (étape 1 : type = titres, canal, sélection produits, répartition, prérequis, génération variant, démarrage).

---

## Implémentation technique (résumé)

1. **Backend**
   - Modèles Prisma : `ABTest`, `ABTestAssignment`.
   - Routes API : `POST/GET /ab-tests`, `GET /ab-tests/:id`, `POST /ab-tests/:id/start`, `POST /ab-tests/:id/stop`, `GET /ab-tests/:id/results`.
   - Logique d’export : dans le flux d’export GMC (et autres canaux), si un ABTest actif existe pour (account, feed, platform, field=title), pour chaque item exporter le titre selon ABTestAssignment (control = original, variant = variantValue).
2. **Frontend**
   - Assistant création de test (étapes : type/canal → sélection produits → répartition → prérequis + durée → génération variant → création draft → "Démarrer").
   - Page liste des tests A/B (analytique centralisée).
   - Page détail test : résumé, prérequis, résultats (placeholder métriques), recommandation.
3. **Métriques réelles** (phase ultérieure)
   - Connexion GMC/Amazon pour récupérer impressions, clics, etc. par product_id et alimenter resultSummary + calcul de significativité.

Cette spec permet d’avoir un **vrai test A/B** (témoin + variant), un **guidage** (prérequis, durée minimale) et une **restitution** centralisée, évolutive vers des métriques type Google Ads.
