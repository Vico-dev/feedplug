# FeedPlug Release Smoke Test

Cette checklist doit être exécutée avant tout déploiement orienté produit ou sécurité.

## Auth

- Se connecter avec un compte valide.
- Recharger la page et vérifier que la session est conservée.
- Laisser expirer la session ou simuler un refresh token, puis vérifier que la navigation reste fonctionnelle.
- Se déconnecter et vérifier que les routes dashboard ne sont plus accessibles.

## Onboarding

- Ouvrir le dashboard avec un compte ayant déjà complété les informations entreprise.
- Vérifier qu'aucune boucle de redirection ne se produit.
- Ouvrir `/onboarding` et vérifier que les informations entreprise existantes se chargent.

## Catalogue

- Ouvrir `/catalogue` et vérifier que la page charge sans `429`, sans écran vide et sans scroll horizontal global.
- Vérifier que les chips reflètent le flux complet et non la pagination affichée.
- Tester recherche, changement de flux, filtres et vue par défaut.
- Revenir sur le catalogue après ouverture d'une fiche produit et vérifier que le contexte est conservé.

## Fiche produit

- Ouvrir une fiche produit depuis le catalogue.
- Vérifier que les informations principales s'affichent sans erreur bloquante.
- Vérifier que le score, l'historique et l'enrichissement se chargent sans casser la page.
- Sauvegarder une modification simple puis recharger la page.

## Editeur en masse

- Sélectionner plusieurs produits dans le catalogue.
- Ouvrir `Modifier les produits`.
- Modifier une cellule, utiliser la navigation clavier et enregistrer.
- Tester un collage multi-cellules simple.
- Vérifier que les changements sont visibles au retour catalogue.

## Flux et synchronisation

- Lancer une synchronisation de flux.
- Vérifier le toast de résultat.
- Vérifier que le catalogue se recharge correctement après la synchronisation.

## Diffusion et IA

- Activer ou désactiver la diffusion sur une sélection.
- Lancer une optimisation IA sur une sélection.
- Vérifier qu'aucune erreur utilisateur trompeuse n'apparaît et que les modifications sont persistées.

## Billing minimum

- Ouvrir la zone facturation.
- Vérifier que l'état du plan et les accès de base sont cohérents.

## Validation finale

- Aucun `429` en usage normal.
- Aucun faux message `Prisma non disponible`.
- Aucun compteur catalogue incohérent.
- Aucun débordement horizontal pleine page sur desktop.
