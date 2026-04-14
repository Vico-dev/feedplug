# Moteur de règles + Édition en masse – Synthèse des choix

Document de référence qui consolide les décisions pour le moteur de règles, l’édition en masse, l’historisation et l’A/B par canal.

---

## 1. Source de vérité et édition en masse

- **Catalogue = FeedItem** (backend-marketing, ingestion). Les modifications en masse mettent à jour les **FeedItem** (et **customFields**).
- **Synchronisation Nest** : si le module Nest `Product` reste utilisé ailleurs, il faudra le maintenir aligné (sync après mise à jour FeedItem).
- **Historisation** : obligatoire pour pouvoir **revenir en arrière** en cas de problème.
  - Stocker un historique des modifications (qui, quand, quels champs, quelles valeurs avant/après) par item ou par opération d’édition en masse.
  - Permettre une **restauration** (rollback) à une version précédente (ex. « restaurer au 01/02 » ou « annuler la dernière édition en masse »).
- **Retour au flux d’origine** : l’utilisateur doit pouvoir **revenir aux valeurs du flux** (ré-ingestion) pour un produit ou un ensemble de produits (ex. « réinitialiser les champs modifiés manuellement / par règles et repartir du flux »).

*Détail technique (tables d’historique, format des snapshots) à préciser en phase de conception détaillée.*

---

## 2. Canaux (clarification)

**Question posée** : As-tu déjà des « canaux » explicites en base (table ExportChannel, ou 1 flux = 1 canal) ?

**Réponse retenue** :
- **Aujourd’hui** : un seul canal en pratique = **GMC** (Google Merchant Center). Pas de table « canal » dédiée ; l’export part vers GMC.
- **Demain** : il faut concevoir pour **plusieurs canaux** : GMC, **Amazon**, **Meta**, **TikTok Shop**, etc. Chaque canal = une **destination d’export** (où on envoie le catalogue ou un flux dérivé).

**Implication** : introduire une notion explicite de **canal** (ex. table **ExportChannel** ou équivalent) avec au minimum :
- `id`, `accountId`, `platform` (e.g. `gmc`, `amazon`, `meta`, `tiktok_shop`), `label`, `config`, `isActive`.
- Les règles et l’A/B test « par canal » s’attachent à un ou plusieurs de ces canaux (voir `MOTEUR_REGLES_SCOPE.md`).

---

## 3. Exécution des règles

**Les deux modes** sont requis :

| Mode | Quand | Usage |
|------|--------|--------|
| **Automatique** | À chaque synchro / ingestion | Règles permanentes (ex. déduction brand, mapping catégorie). |
| **À la demande** | Bouton « Appliquer les règles » (ou équivalent) | Règles « campagne » ou ponctuelles, sans attendre la prochaine synchro. |

**Planification dans le temps** :
- **Date de début** et **date de fin** paramétrables pour une règle (ex. promo -10 % sur catégorie X **du 15/03 au 22/03**).
- **Option « sans fin »** : pas de date de fin (règle active jusqu’à désactivation manuelle).
- À l’exécution (synchro, export ou « Appliquer les règles »), on n’applique que les règles dont la date courante est dans `[startDate, endDate]` (ou sans endDate si null).

---

## 4. Priorité de livraison

1. **Phase 1** : Moteur de règles + édition en masse (sans A/B canal), avec historisation et retour au flux.
2. **Phase 2** : Corrélation avec l’enrichissement IA (titres, descriptions, etc.).
3. **Phase 3** : A/B test par canal.

---

## 5. A/B test par canal

**Les deux niveaux** doivent être supportés (configurable) :

| Niveau | Description |
|--------|-------------|
| **Par produit** | Chaque produit se voit affecter aléatoirement la variante A ou B (ex. titre A vs titre B). |
| **Par segment** | Un segment = variante A, un autre = variante B (ex. catégorie X → A, catégorie Y → B). |

L’A/B est attaché à un **canal** (ex. GMC, Amazon) : au moment de l’export vers ce canal, on choisit pour chaque produit quelle variante envoyer (A ou B), selon la config du test (aléatoire ou segment).

---

## 6. Récapitulatif des docs liés

- **Périmètre des règles (flux + canaux)** : `MOTEUR_REGLES_SCOPE.md`
- **Canaux Amazon (design)** : `AMAZON_CANAUX_DESIGN.md`
- **Ce document** : synthèse des choix (source de vérité, historisation, canaux, exécution, priorité, A/B).
