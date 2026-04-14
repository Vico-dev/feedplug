# Brief UX – Page Produit FeedPlug

## Rôle de la page
- Point central de pilotage d’un produit
- Source unique de vérité du flux
- Outil de décision diffusion / non-diffusion
- Interface d’optimisation continue orientée Google (et autres canaux)

**Si cette page est bien faite, FeedPlug n’est plus un outil de flux, c’est un outil de performance produit.**

---

## 1. Attendus fonctionnels (MUST)
- Visualiser l’état de qualité global du produit
- Comprendre pourquoi le produit est bon / mauvais
- Identifier les manquements aux standards Google
- Modifier n’importe quel champ du flux
- Sauvegarder ces modifications (override FeedPlug)
- Enrichir automatiquement les champs via IA + scraping
- Décider sur quels canaux le produit est diffusé
- Voir les impacts immédiats sur le score

---

## 2. Structure globale (scroll vertical)
1. **Header produit** – Identité + score global
2. **Bloc Scoring produit** – Score global + scores par axe, cliquables → scroll vers champs
3. **Bloc Conformité Google** – Attendus / manquements (checklist dynamique)
4. **Bloc Données produit** – Flux complet éditable (valeur + source)
5. **Bloc Enrichissement IA FeedPlug** – Propositions avec Prévisualiser / Appliquer
6. **Bloc Diffusion par canal** – Statut par canal (actif / inactif + raison)
7. (Optionnel) Bloc Impact / potentiel

---

## 3. Header produit
- Image produit, Nom, Marque, GTIN / SKU, Catégorie principale
- **Score global** : `SCORE PRODUIT : 82 / 100` + couleur (vert / orange / rouge)
- Mention : « Éligible Google Shopping » (ou non)
- Un seul score principal, lisible sans scroller

---

## 4. Bloc Scoring produit
- Axes (Google-centric) : Données produit, SEO/Titre, Images, Attributs Google, Prix & dispo, Conformité Google Shopping
- Affichage type : `Données produit 92`, `SEO / Titre 68`, etc. avec couleur
- **Cliquer sur un axe** → scroll vers les champs concernés

---

## 5. Bloc Conformité Google
- Checklist dynamique : ✔ conforme, ✖ manquant, ⚠ warning
- Chaque item : statut (OK / Warning / Bloquant), explication courte, **lien vers le champ** à corriger
- Différencier **requis** vs **recommandé**

---

## 6. Bloc Données produit
- **Tous** les champs du flux (Google standard + custom)
- Pour chaque champ : **Valeur actuelle** + **Source** (Flux marchand vs Valeur enrichie par FeedPlug)
- Chaque champ **éditable inline**, sauvegarde immédiate ou bouton Enregistrer
- Possibilité de **revenir à la valeur d’origine** (flux)

---

## 7. Bloc Enrichissement IA
- Propositions par champ (titre, description, attributs Google)
- **Jamais auto-appliqué** sans validation
- Toujours **prévisualisable**
- Boutons [ Prévisualiser ] [ Appliquer ] (par champ ou « Appliquer tout »)
- Score impact visible après application

---

## 8. Bloc Diffusion par canal
- Par canal : Statut (actif / inactif), Raison, Actions (activer / désactiver, corriger pour ce canal)
- Ex. Google Shopping activé, Amazon désactivé + raison

---

## 9. Sauvegarde & logique data
- FeedPlug **ne modifie pas** le flux source
- FeedPlug crée une **couche d’enrichissement** (versionnée, traçable, réversible)
- Label clair : **« Valeur enrichie par FeedPlug »** quand la valeur vient de l’override / enrichissement
