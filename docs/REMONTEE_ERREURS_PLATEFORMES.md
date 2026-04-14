# Remontée des erreurs par plateforme – État et suite

## Ce qui existe aujourd’hui

### 1. Erreurs au moment du **Push** (GMC et Amazon)

Quand vous faites **Push GMC** ou **Push Amazon** depuis la page Flux :

- **Backend** : Les réponses des APIs (Content API batch pour GMC, Listings API pour Amazon) sont parsées. Chaque erreur par produit est collectée (`productId` / `sku` + message).
- **Réponse API** : Le backend renvoie `{ succeeded, failed, total, errors: [...] }` (jusqu’à 10 erreurs dans la réponse).
- **Persistance** : Chaque push est enregistré dans la table **ExportLog** (accountId, feedId, platform, status, totalProducts, succeeded, failed, errorMessage en JSON).
- **Frontend** : Après un push, un bandeau affiche « Push terminé — X produits envoyés, Y erreurs ». En revanche, **la liste détaillée des erreurs** (quel produit, quel message) **n’est pas affichée** : elle est dans `pushResult.errors` mais pas rendue à l’écran.

### 2. Historique des exports (backend uniquement)

- **Route** : `GET /api/v1/platforms/export-logs` renvoie les 20 derniers exports (tous plateformes) avec succeeded/failed/errorMessage.
- **Frontend** : Cette route **n’est pas utilisée** : pas de page « Historique des exports » ni de bloc « Dernières erreurs » sur la page Flux.

### 3. Connecteurs « statut produit » (NestJS, non branchés au flux actuel)

- **Google** (`src/modules/export/connectors/google.connector.ts`) : `getProductStatus(merchantId, accessToken, productId)` permet de récupérer le statut d’un produit dans GMC (donc théoriquement les infos de rejet / avertissement).
- **Amazon** : `getProductStatus(marketplaceId, accessToken, sku)` existe aussi.
- Ces modules ne sont pas utilisés par le backend Express (server-minimal.js) qui fait le push. Il n’y a donc **pas aujourd’hui** de job ou d’écran qui « synchronise » les erreurs depuis GMC ou Amazon après coup.

---

## Ce qui manque pour une vraie « remontée d’erreurs » exploitable

| Besoin | État | À faire |
|--------|------|--------|
| Voir les erreurs du **dernier push** (liste produit + message) | Données présentes dans la réponse, pas affichées | Afficher `pushResult.errors` dans le bandeau (liste dépliable ou modal) après un push GMC/Amazon. |
| Consulter l’**historique** des exports et des erreurs | ExportLog en base + API, pas d’UI | Appeler `GET /api/v1/platforms/export-logs` et ajouter un bloc « Derniers exports » ou une page « Historique exports » avec détail des erreurs. |
| **Sync périodique** des erreurs depuis les plateformes | Non implémenté | Utiliser les APIs plateforme (GMC productstatuses / productstatuses/list, Amazon Listings ou Reports) pour récupérer les produits en erreur ou rejetés et les afficher (ex. « 12 produits en erreur GMC » avec lien vers la fiche pour corriger). |
| Lien **erreur → fiche produit** pour corriger | Partiel | Dans les erreurs de push on a productId/sku ; ajouter un lien vers `/catalogue?feed=…` ou la fiche produit pour ouvrir et corriger. |
| **Meta / autres canaux** | Aucune remontée | Pas de push API Meta ni d’API « catalogue issues » branchée ; idem pour les autres canaux (export fichier uniquement). |

---

## Recommandation pour la commercialisation

- **Court terme (rapide)**  
  - Afficher la liste des erreurs après un push (modal ou liste dépliable avec produit + message, et lien vers la fiche produit si possible).  
  - Exposer l’historique des exports (export-logs) dans l’UI (page Flux ou page dédiée) avec détail des erreurs.  
  → Le client voit immédiatement quels produits ont échoué et pourquoi, et peut les corriger.

- **Moyen terme**  
  - Connecter les APIs « statut / erreurs » des plateformes (GMC, puis Amazon) pour une **sync périodique** (ou au clic « Actualiser les erreurs ») et afficher une vue « Erreurs par plateforme » (ex. « 5 produits rejetés GMC », liste avec message + lien fiche).  
  → Remontée d’erreurs même sans refaire un push (produits rejetés après modération, etc.).

En résumé : **on a déjà la remontée d’erreurs au moment du push et la persistance (ExportLog)** ; il manque l’**affichage** de ces erreurs dans l’UI et, pour aller plus loin, une **sync dédiée** depuis les APIs plateformes pour afficher et corriger les erreurs de façon centralisée.
