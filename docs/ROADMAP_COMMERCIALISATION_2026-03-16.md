# Roadmap Commercialisation FeedPlug

Date de mise a jour : 16 mars 2026
Auteur : CTO audit operationnel

## 1. Lecture executive

FeedPlug est proche d'une mise en commercialisation, mais pas encore au niveau d'un produit "commercialisable sereinement" sans encadrement fort.

Ce qui est solide aujourd'hui :

- Frontend Next.js qui build en production
- Backend production operationnel sur `backend-marketing`
- Parcours coeur presents : auth, onboarding, import, catalogue, enrichissement IA, export GMC, push GMC, push Amazon, page tarifs, choose-plan, Stripe webhook, dashboard, monitoring health
- Infra de deploiement Cloud Build + smoke tests backend

Ce qui bloque encore une bascule commerciale propre :

- La discipline qualite est insuffisante : lint frontend en echec massif, typescript ignore les erreurs au build, couverture de tests tres faible
- La chaine CI principale est obsolete et pointe encore vers l'ancien socle
- Le produit raconte deux histoires cote billing : "manuel" dans le dashboard, Stripe/checkout dans l'app
- La dette structurelle est elevee sur 2 fichiers critiques tres volumineux
- Le scope commercial doit etre serre et aligne avec ce qui est vraiment stabilise

Conclusion CTO :

- Oui pour une ouverture commerciale pilote a court terme
- Non pour une commercialisation large sans sprint de fiabilisation et sans cadrage du scope vendu

## 2. Etat reel constate dans le depot

### Signaux positifs

- Le frontend build en prod avec `npm run build`
- Le backend charge syntaxiquement avec `node --check`
- Les flux billing Stripe existent : sauvegarde billing, checkout session, webhook, gestion `billingStatus`
- Les exports multi-canal existent dans l'UI : GMC, Meta CSV, Amazon CSV + push
- Les checks de sante et la supervision GCP sont presents

### Signaux de risque

- `frontend/next.config.ts` ignore les erreurs TypeScript via `typescript.ignoreBuildErrors = true`
- `npm run lint` dans `frontend/` remonte 131 problemes dont 70 erreurs
- Il n'existe qu'un seul fichier de test automatise cote front : `frontend/e2e/catalogue-product.spec.ts`
- Le workflow GitHub Actions principal cible encore le projet legacy racine, pas la stack reelle `frontend` + `backend-marketing`
- Le backend principal reste un monolithe de plus de 11k lignes (`backend-marketing/server-minimal.js`)
- Le composant catalogue est lui aussi critique et massif (`frontend/src/components/catalogue/catalogue-workbench.tsx`)
- La page dashboard `Facturation` affiche une gestion manuelle alors que l'app embarque aussi un parcours Stripe complet

## 3. Decision de go-to-market

### Scope vendable immediatement

Vendre uniquement :

- Import CSV / Shopify
- Gestion catalogue
- Enrichissement IA
- Score qualite
- Export CSV multi-canal
- Push automatique GMC
- Push Amazon uniquement si le flux est valide de bout en bout sur un compte test

Ne pas vendre comme promesse standard sans validation supplementaire :

- Meta en push
- Reporting ROI / performance avance
- Couverture test enterprise
- Parcours billing totalement unifie et self-serve

### Feu tricolore

- Produit : orange
- Billing : orange
- Qualite / release : rouge
- Infra / observabilite : vert-orange
- Capacite a signer des pilotes : vert

## 4. Priorites par ordre reel

## P0 - 7 jours - Rendre la commercialisation pilotable

Objectif : pouvoir signer des premiers clients sans dette operationnelle immediate.

### P0.1 - Clarifier le produit vendu

Sous-taches :

- Verrouiller la promesse commerciale officielle : GMC stable, Amazon en beta controlee, Meta en export CSV seulement
- Aligner site, sales deck, page tarifs, onboarding et docs avec ce scope
- Retirer toute formulation qui laisse penser que tous les canaux sont equivalemment matures

Critere de sortie :

- Une seule narration produit sur le site, dans l'app et dans le pitch commercial

Responsables :

- CTO
- Product / Marketing

### P0.2 - Unifier la strategie billing

Sous-taches :

- Choisir explicitement entre "billing manuel pilote" et "self-serve Stripe"
- Si pilote manuel : retirer ou masquer les points d'entree checkout non necessaires pour les comptes standards
- Si self-serve Stripe : remplacer la page dashboard facturation manuelle par le statut reel abonnement/paiement
- Tester les etats `pending`, `active`, `payment_failed`, `trialEndsAt`, `paymentGraceUntil`
- Definir le support en cas d'echec SEPA / carte

Critere de sortie :

- Aucun client ne voit une information contradictoire entre dashboard, choose-plan et statut d'acces

Responsables :

- CTO
- Backend
- Frontend

### P0.3 - Mettre la release sous controle

Sous-taches :

- Creer un vrai pipeline pour `frontend` et `backend-marketing`
- Faire tourner au minimum : lint frontend, build frontend, verification syntax backend, smoke tests post-deploiement
- Isoler ou archiver le workflow legacy qui ne reflete plus la production
- Ajouter une definition claire du "release gate"

Critere de sortie :

- Une PR ne peut pas etre mergee sans passer les controles de la stack reelle

Responsables :

- CTO
- DevOps / Backend

### P0.4 - Corriger l'hygiene frontend minimale

Sous-taches :

- Faire tomber le lint de 70 erreurs a 0 erreur
- Traiter d'abord les erreurs bloquantes :
- `@typescript-eslint/no-explicit-any`
- `react/no-unescaped-entities`
- `@typescript-eslint/no-require-imports`
- `@next/next/no-html-link-for-pages`
- Stabiliser les pages admin, parametres, forgot/reset password, composants catalogue et connecteurs
- Garder les warnings react hooks et `img` en lot P1 si necessaire

Critere de sortie :

- `npm run lint` passe dans `frontend/`

Responsables :

- Frontend lead

### P0.5 - Definir une recette commerciale

Sous-taches :

- Ecrire le runbook de demo
- Ecrire le runbook de vente pilote
- Ecrire la checklist d'onboarding client
- Tester 3 parcours complets :
- inscription
- import Shopify ou CSV
- enrichissement + export + push

Critere de sortie :

- Une personne non technique peut faire une demo en suivant une procedure simple

Responsables :

- CTO
- Product
- Ops

## P1 - 2 a 3 semaines - Fiabiliser avant volume

Objectif : passer d'un pilote vendable a un produit exploitable sans surcharge support.

### P1.1 - Restaurer la verite TypeScript

Sous-taches :

- Retirer `ignoreBuildErrors` du frontend
- Corriger les erreurs de typage remontantes
- Normaliser les types des reponses API cote front

Critere de sortie :

- Le build frontend passe sans bypass TypeScript

### P1.2 - Etendre la couverture de tests

Sous-taches :

- Ajouter des tests Playwright pour :
- login / register / forgot password / reset password
- onboarding
- import CSV
- export flux
- choose-plan / billing status
- Ajouter des tests backend sur :
- plan limits
- pricing grid
- webhook billing
- auth critique
- push export logs

Critere de sortie :

- Au moins 1 test automatise par parcours critique business

### P1.3 - Decouper les zones a forte dette

Sous-taches :

- Sortir le billing du monolithe backend si ce n'est pas deja effectif partout
- Commencer l'extraction du domaine exports / platforms de `server-minimal.js`
- Decouper `catalogue-workbench.tsx` en sous-modules lisibles

Critere de sortie :

- Les zones les plus modifiees ne sont plus concentrees dans deux mega-fichiers

### P1.4 - Durcir l'observabilite

Sous-taches :

- Verifier les alertes Sentry reelles
- Definir les alertes operationnelles minimales : health KO, push KO, checkout KO, webhook KO
- Relier le runbook incident a ces alertes

Critere de sortie :

- Un incident critique remonte automatiquement et un runbook existe

## P2 - 3 a 6 semaines - Industrialiser la commercialisation

Objectif : ouvrir plus largement sans dilution produit ni surcout support.

### P2.1 - Completer l'offre de canaux reellement supportes

Sous-taches :

- Valider Amazon en production sur plusieurs cas reels
- Statuer sur Meta : CSV seul ou push supporte
- Afficher la maturite de chaque canal dans l'UI

### P2.2 - Billing exploitable a volume

Sous-taches :

- Portail client ou page abonnement claire
- Historique et statut de facturation
- Gestion self-serve des changements de plan si retenu

### P2.3 - Gouvernance produit

Sous-taches :

- Definir un cycle release hebdomadaire
- Tenir un changelog client
- Tenir un backlog "bugs avant features"

## 5. Plan d'execution recommande

## Semaine 1

- Cadrage scope commercial
- Decision billing
- Creation pipeline reelle
- Traitement des erreurs lint frontend les plus critiques
- Recette manuelle complete

Livrable :

- Produit pilotable pour beta payante

## Semaine 2

- Fin des erreurs lint
- Mise en coherence billing
- E2E supplementaires sur auth, onboarding, export
- Packaging demo + sales ops

Livrable :

- Ouverture commerciale pilote

## Semaine 3

- Retrait du bypass TypeScript
- Tests backend ciblant pricing / limits / webhook
- Alerting incident finalise

Livrable :

- Base plus sure pour signer plusieurs comptes

## Semaines 4 a 6

- Refactor des zones critiques
- Industrialisation billing
- Stabilisation des canaux secondaires
- Renforcement de la couverture de tests

Livrable :

- Commercialisation elargie

## 6. Workstreams et responsables

### Stream A - Produit / GTM

- DRI : CTO + Product
- Mission : scope, promesse commerciale, demo, onboarding client, docs de vente

### Stream B - Frontend fiabilisation

- DRI : Frontend lead
- Mission : lint a zero erreur, TypeScript, parcours critiques, coherence billing

### Stream C - Backend / Billing / Exports

- DRI : Backend lead
- Mission : webhook, statut abonnement, limites de plan, export logs, stabilite routes critiques

### Stream D - Release engineering

- DRI : DevOps / CTO
- Mission : pipeline reelle, smoke tests, rollback, alerting, release checklist

## 7. Backlog operatif pret a assigner

### Lot A - Release

- [ ] Remplacer ou completer `.github/workflows/ci-cd.yml` pour cibler `frontend/` et `backend-marketing/`
- [ ] Definir les checks obligatoires de merge
- [ ] Ajouter une checklist release standard

### Lot B - Billing

- [ ] Statuer "manuel pilote" vs "self-serve Stripe"
- [ ] Aligner `facturation`, `choose-plan`, gating dashboard et support client
- [ ] Tester les webhooks et les transitions d'etat

### Lot C - Frontend hygiene

- [ ] Corriger les erreurs eslint admin/accounts
- [ ] Corriger les erreurs eslint admin/ai-keys
- [ ] Corriger les erreurs eslint parametres
- [ ] Corriger les erreurs eslint forgot/reset password
- [ ] Corriger les erreurs eslint catalogue-workbench
- [ ] Corriger les erreurs eslint connecteurs et formulaires

### Lot D - Qualite

- [ ] Ajouter tests Playwright auth
- [ ] Ajouter tests Playwright onboarding
- [ ] Ajouter tests Playwright import/export
- [ ] Ajouter tests backend pricing / plan limits
- [ ] Ajouter tests backend webhook billing

### Lot E - Dette structurelle

- [ ] Extraire le domaine billing / plans / access si encore disperse
- [ ] Extraire le domaine platforms / exports
- [ ] Decouper le workbench catalogue

## 8. Criteres de passage en commercialisation

Go pilote payant :

- `frontend` build
- `frontend` lint sans erreur
- pipeline reelle active
- billing coherent
- 3 parcours critiques testes
- demo exploitable

Go commercialisation elargie :

- TypeScript sans bypass
- couverture tests des parcours business
- alerting incident actif
- support et docs de runbook finalises
- scope canaux documente sans ambiguite

## 9. Recommandation finale

La meilleure trajectoire n'est pas de lancer plus de features maintenant.

La meilleure trajectoire est :

1. Fermer les incoherences produit et billing
2. Mettre la release sous controle
3. Assainir le frontend
4. Tester les parcours qui font rentrer l'argent
5. Puis seulement accelerer sur les canaux et la performance

Si cette sequence est respectee, FeedPlug peut ouvrir une commercialisation pilote dans les 10 jours et une commercialisation plus large sous 4 a 6 semaines.
