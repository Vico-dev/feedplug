# Fiche produit — Pas de recul & pistes d’amélioration

## Ce qui fonctionne déjà bien
- Header avec identité, prix/dispo/stock, score visible sans scroll
- Score par axe (4 dimensions) cliquables → scroll vers les sections
- Conformité Google avec checklist et bouton « Corriger » → scroll champ
- Champs éditables avec source (flux vs enrichi) et « Revenir à la valeur du flux »
- Bouton « Optimiser » par champ (titre → modal, autres → scroll enrichissement)
- Bloc Enrichissement IA avec prévisualisation avant/après et « Appliquer tout »
- Diffusion par canal avec Switch (Google activable/désactivable)
- Skeleton au chargement
- Historique des modifications + « Revenir au flux d’origine »

---

## 1. Structure & hiérarchie (impact élevé)

### 1.1 Trop de scroll pour l’action
- **Problème** : Pour corriger un champ, il faut souvent scroller (conformité → « Corriger » → données produit). La page est très longue (header → score → conformité → données → enrichissement → diffusion → historique).
- **Pistes** :
  - **Ancre / sommaire fixe** (onglets ou menu latéral) : « Résumé », « Conformité », « Données », « Enrichissement », « Diffusion », « Historique » pour sauter directement à une section.
  - **Bloc « À corriger » compact** sous le header : liste des 3–5 manquements prioritaires avec lien direct vers le champ (comme la conformité mais résumé en 1 bloc court).

### 1.2 Double entrée « Données produit »
- **Problème** : Il y a une Card « Données produit » (titre + description) puis immédiatement en dessous la grille image + champs. Visuellement on a l’impression de deux blocs. Le titre de section est coupé du contenu.
- **Piste** : Fusionner en une seule Card : titre « Données produit » dans le CardHeader, puis directement la grille (image + champs) dans le CardContent.

### 1.3 Ordre des blocs vs. workflow
- **Brief** : « Décider sur quels canaux le produit est diffusé » et « Optimiser facilement ».
- **Piste** : Placer **Diffusion par canal** plus haut (après Score / Conformité), pour que « activer/désactiver » soit visible sans descendre jusqu’en bas. Enchaînement logique : état produit → conformité → diffusion → détail des données → enrichissement → historique.

---

## 2. Contenu & données (impact élevé)

### 2.1 Champs en lecture seule
- **Problème** : Catégorie Google, Type de produit, Disponibilité, Attributs produit (couleur, taille, etc.), ID de groupe sont affichés en lecture seule. Pour les aligner sur le brief (« modifier n’importe quel champ »), ils devraient être éditables (avec source flux/enrichi si pertinent).
- **Piste** : Étendre l’édition à ces champs (ProductFieldWithSource ou équivalent) et les inclure dans la sauvegarde item.

### 2.2 Lien « Corriger » / axe → quel champ ?
- **Problème** : Les 4 axes scrollent tous vers « donnees » ou « conformite ». Un axe « SEO / Titre » pourrait scroller vers le champ Titre, « Images » vers le bloc image. Aujourd’hui le scroll est peu précis.
- **Piste** : Faire en sorte que chaque axe scroll vers un bloc ou un champ précis (ex. SEO → ref du champ titre, Images → ref du bloc image, Conformité GMC → section conformité).

### 2.3 Score non calculé
- **Problème** : Si le score n’est pas dispo, on affiche un bouton « Calculer le score » dans le header. L’utilisateur peut ne pas le voir ou ne pas comprendre qu’il doit cliquer.
- **Piste** : Calcul systématique du score au chargement (déjà le cas côté API) ; si échec, message clair + bouton « Réessayer » et éventuellement afficher les infos produit sans score (avec mention « Score indisponible »).

---

## 3. Optimisation & enrichissement (impact moyen)

### 3.1 « Optimiser » dans la barre sticky
- **Problème** : Un seul bouton « Optimiser » ouvre uniquement la modal Titre. Les autres optimisations (description, marque, etc.) passent par le scroll vers Enrichissement.
- **Piste** : Menu déroulant « Optimiser » : « Optimiser le titre », « Aller à l’enrichissement » (scroll), ou « Enrichir tous les champs » (action directe si l’API le permet).

### 3.2 Appliquer un seul champ enrichi
- **Problème** : Dans Enrichissement IA, on a « Prévisualiser » par champ et « Appliquer tout ». Impossible d’appliquer uniquement le champ « description » ou « marque » sans tout appliquer.
- **Piste** : Bouton « Appliquer » par ligne (par champ) en plus de « Appliquer tout », avec appel API ciblé si le backend le supporte (sinon appliquer tout et documenter la limite).

### 3.3 Impact du score après enrichissement
- **Brief** : « Voir les impacts immédiats sur le score ».
- **Problème** : Après « Appliquer tout », le score n’est pas recalculé automatiquement (ou pas mis en évidence).
- **Piste** : Après enrichissement réussi : recalcul du score (GET /score) et mise à jour de l’affichage ; optionnel : petit message « Score mis à jour : 72 → 78 ».

---

## 4. Diffusion & canaux (impact moyen)

### 4.1 Persistance des préférences
- **Problème** : Le Switch Google Shopping (activer/désactiver) est stocké uniquement en state React ; au rechargement, la préférence est perdue.
- **Piste** : API PATCH/POST pour enregistrer l’exclusion par canal par item (ex. `channel_overrides` ou table ItemChannel), puis chargement de cet état au fetch item.

### 4.2 Raison de désactivation
- **Brief** : « Raison » par canal (ex. « Amazon désactivé + raison »).
- **Piste** : Si l’utilisateur désactive Google pour ce produit, proposer une raison optionnelle (select ou texte libre) : « Hors gamme », « Test », « Rupture longue », etc., et l’afficher dans la liste des canaux.

---

## 5. UX & accessibilité (impact moyen)

### 5.1 Feedback sauvegarde
- **Problème** : Après « Enregistrer », pas de toast ni message de succès visible (seul le rechargement des données peut indiquer que c’est sauvegardé).
- **Piste** : Toast ou bannière courte « Modifications enregistrées » après succès de la sauvegarde.

### 5.2 Mode édition
- **Problème** : Le passage en mode « Modifier » change tous les champs en formulaire d’un coup ; pas d’édition inline champ par champ (cliquer pour éditer un seul champ).
- **Piste** (optionnel) : Édition inline : clic sur la valeur ou sur un icône « crayon » ouvre l’édition de ce champ uniquement, avec « Enregistrer » / « Annuler » sur le champ, pour réduire la friction.

### 5.3 Images supplémentaires
- **Problème** : Pas d’indication de source (flux vs enrichi) ni d’action « Optimiser » sur les images (remplacement par une meilleure image IA, si la feature existe).
- **Piste** : Aligner avec le reste (source, optimiser) si le backend propose des enrichissements image.

---

## 6. Technique & maintenabilité (impact faible à moyen)

### 6.1 Taille du composant page
- **Problème** : La page produit est un très gros fichier (plus de 1200 lignes), ce qui rend les évolutions et les revues difficiles.
- **Piste** : Extraire des sous-composants : `ProductHeader`, `ProductScoreAxes`, `ProductConformity`, `ProductDataGrid`, `ProductEnrichment`, `ProductChannels`, `ProductHistory`, et garder dans la page la logique (state, fetch, handlers) et l’assemblage.

### 6.2 Gestion d’erreurs
- **Problème** : Plusieurs `alert()` pour les erreurs (score, enrichissement). Peu cohérent avec une UI moderne.
- **Piste** : Remplacer par des toasts ou des Alert inline dans la section concernée (conformité, enrichissement, etc.).

### 6.3 Types
- **Problème** : `productScore` en `any`, et des `(item as any)` pour certains champs.
- **Piste** : Définir des types (ex. `ProductScore`, `QualityDetails`) et les utiliser pour le state et les réponses API.

---

## Synthèse des priorités

| Priorité | Amélioration | Effort estimé |
|----------|--------------|----------------|
| **P0** | Persister les préférences de diffusion (API + chargement) | Moyen |
| **P0** | Feedback clair après sauvegarde (toast « Modifications enregistrées ») | Faible |
| **P1** | Sommaire / ancres pour sauter aux sections (ou bloc « À corriger » sous le header) | Moyen |
| **P1** | Recalcul + affichage du score après enrichissement | Faible |
| **P1** | Appliquer un seul champ enrichi (bouton par ligne) si l’API le permet | Moyen |
| **P2** | Remonter le bloc Diffusion (après Conformité) | Faible |
| **P2** | Rendre éditables Catégorie Google, Type produit, Disponibilité, attributs | Moyen |
| **P2** | Menu « Optimiser » (Titre / Enrichissement / Tout) dans la barre sticky | Faible |
| **P3** | Découper la page en sous-composants | Moyen |
| **P3** | Édition inline champ par champ (optionnel) | Élevé |
| **P3** | Remplacer `alert()` par toasts / Alert inline | Faible |

Ce document peut servir de backlog pour les prochaines itérations sur la fiche produit.
