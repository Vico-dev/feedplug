# Audit CRO — Tunnel de conversion Feedplug

> Objectif : lever tous les freins entre l'arrivée d'un prospect et le 1er paiement.
> 4 audits croisés (LP / pricing / signup-activation / tunnel d'audit de flux), ancrés dans le code réel. Aucun fichier modifié.

## Verdict
Le produit contient déjà la matière du « aha » (chiffre de douleur, diagnostic en clair, projection de gains), mais **le tunnel l'enterre et casse sa propre promesse « audit gratuit »** à chaque étape. La majorité des fixes = retirer de la friction + remonter en surface ce qui existe.

## Le « golden path » à reconstruire (ordre de priorité)
1. **Landing** → montrer la douleur vite (pré-score sans formulaire)
2. **Signup** → supprimer les étapes mortes → connexion directe
3. **Aha** → héroïser le chiffre « X produits refusés » + projeter « 312 → 8 »
4. **Paiement** → réassurance + cohérence essai + checkout court + offre agence
5. **Mesure** → instrumenter `store_connected`

---

## P0 — Tueurs de conversion

### [P0-1] Le hook « audit gratuit » ne tient pas sa promesse
- **Où** : `src/app/[locale]/(marketing)/audit-flux/page.tsx` — form 3 étapes (prénom/nom/fonction/entreprise/email + URL) avant tout résultat (`stepOneValid` l.169) ; l.516/519 « le scoring performance reste réservé à l'offre payante » ; l.540-541 « les données servent à qualifier le lead et préparer la suite commerciale ».
- **Frein** : friction max au pire moment + message qui tue la confiance.
- **Fix** : champ unique URL → pré-score gratuit affiché AVANT l'email ; email pour « recevoir le rapport complet » ; fonction/entreprise optionnels ou post-valeur ; retirer la mention « qualifier le lead » de la page publique.

### [P0-2] Le 1er écran (dashboard) ne révèle aucune douleur
- **Où** : `src/app/[locale]/(dashboard)/dashboard/page.tsx:197-349` — KPIs = dernier import / nb produits / **score moyen X/100** / taux succès. Quick actions (l.471-535) ne pointent jamais vers `/catalogue`.
- **Frein** : tableau de bord d'activité au lieu d'un diagnostic ; « 64/100 » n'est pas anxiogène.
- **Fix** : bloc hero rouge **« X produits ne passeront pas sur Google »** (= `catalogueSummary.toFix`/`notPublished`, déjà calculés l.663-674) + 2-3 causes (`topIssues`) + CTA unique → `/catalogue?smartView=to_fix`.

### [P0-3] Le diagnostic chiffré relégué en sidebar 360px
- **Où** : `src/components/catalogue/catalogue-workbench.tsx:2552` `xl:grid-cols-[minmax(0,1fr)_360px]` ; panneau « État du catalogue » + « Actions prioritaires » (l.2654-2758) coincé en colonne droite ; pleine largeur donnée au header « table d'opérations » (l.2567-2570).
- **Frein** : la révélation (score + top issues) est visuellement secondaire ; la page se présente comme un tableur.
- **Fix** : au 1er chargement, sortir le panneau de la grille et l'afficher pleine largeur comme un écran de résultat d'audit (gros score, bandeau produits bloqués, 3 `priorityActions` en cartes). Table au scroll.

### [P0-4] Le chiffre choc « 312 → 8 » n'existe nulle part au niveau catalogue
- **Où** : matière éparpillée — score « Potentiel +X » par produit seulement (`product-quality-score-card.tsx:160-269`), « Gain +X pts » par champ (`product-gains-section.tsx:88-95`) ; `byDimension`/`globalScore` existent (l.641-646) mais aucun avant/après volume.
- **Frein** : la preuve de valeur qui convertit (réduction du volume de produits cassés) n'est jamais montrée.
- **Fix** : encart « Potentiel catalogue » : « 312 produits ne passent pas → en corrigeant les 2 causes principales, 8 resteraient bloqués = +304 diffusables ». Calculable depuis `toFix`/`missingCategory`/`missingImage`/`missingBrand` (l.665-672).

### [P0-5] Incohérence de la durée d'essai (30j / 14j / rien)
- **Où** : « 30 jours » `fr.json:564,634`, `register/page.tsx:185,206`, `onboarding/page.tsx:453` ; « 14 jours » `legal/terms/page.tsx:28,94`, `embedded/_shopify-plans.ts` (`trialDays:14`) ; **rien** dans `choose-plan/page.tsx`.
- **Frein** : crédibilité détruite juste avant l'achat + risque juridique (DGCCRF).
- **Fix** : trancher une seule durée (ou « 1er mois symbolique design partner ») et la propager d'une source unique, y compris sur `choose-plan`.

### [P0-6] Étapes mortes entre signup et valeur (7-12 clics, 2 formulaires)
- **Où** : double « nom d'entreprise » (`register/page.tsx:358-385` optionnel **puis** `onboarding/page.tsx:227,259-272` obligatoire) ; page Sources vide intermédiaire (`sources/page.tsx:1067`) ; aha seulement sur `/catalogue?feed=…`.
- **Frein** : formulaire administratif + détours pile dans le « aha-gap ».
- **Fix** : pré-remplir `companyName` depuis le register + `hasCompletedCompanyInfo=true` ; « Connecter ma 1re source » → modal de connexion ouvert (`?connect=shopify|csv`) ; après import → auto-redirect `/catalogue?smartView=to_fix`.

### [P0-7] `store_connected` non instrumenté
- **Où** : seul `sign_up` est tracké (`register/page.tsx:154`) ; aucune émission à `sources/page.tsx:415-432` (OAuth), `:910` (CSV), PrestaShop.
- **Frein** : activation non mesurable → aucune optim testable.
- **Fix** : `trackEvent('store_connected', {connector, method})` aux 3 points + `source_create_started` à l'ouverture du modal.

---

## P1 — Freins majeurs

- **[P1] CTA chaos / pas de CTA persistant** — `MarketingNav.tsx:493-517` n'a aucun bouton CTA (juste « Accès client » → login) ; LP via `LPPageContent.tsx` CTA → `/demo` ; comparatifs → `/demo`. → CTA unique **« Auditer mon flux gratuitement »** en bouton fixe dans la nav + sur toutes les LP, « Demander une démo » en secondaire (agences).
- **[P1] Aucune réassurance sur LP / audit / paiement** — « sans CB » existe sur la home (`fr.json hero.ctaSub`) et `/tarifs`, absent des LP, comparatifs, `audit-flux`, et `choose-plan` (l.310-319, 532-551). → micro-copy « Sans carte bancaire · Sans engagement · 5 min » sous chaque CTA + bandeau réassurance sur choose-plan.
- **[P1] Faux chiffres présentés comme résultats clients (0 client)** — `socialProof.metrics` « -80% rejets », `lpGoogleShopping.useCase` « 52→78 », cas « e-commerçant mode »/« vendeur beauté ». → requalifier en promesses produit assumées (« Ce que Feedplug vous permet de viser »), retirer les personnages fictifs.
- **[P1] Checkout B2B lourd avant Stripe** — `choose-plan/page.tsx:474-528` : 9 champs (5 obligatoires) + `handleBillingSubmit` bloquant, alors que Stripe Checkout collecte déjà adresse + TVA. → parcours 2 étapes (Configurer → Payer), profil facturation post-paiement.
- **[P1] Configurateur 30 combinaisons sans ancrage, incohérent avec Shopify** — web `pricing-grid-v2.ts` (39-849€ HT, IA add-on 49€) vs Shopify `_shopify-plans.ts` (Starter 29 / Pro 79 / Business 199 / Premium 499, IA incluse). Pas de plan « recommandé » côté web (`choose-plan:354-471`). → 3-4 cartes packagées nommées, « Pro » mis en avant, IA = bénéfice inclus, aligner web↔Shopify.
- **[P1] Aucune offre agence** — pricing mono-compte (ICP agence forcé dans un plan marchand). → carte/CTA « Agences & multi-comptes → parlons-en » + prise de RDV.
- **[P1] CSV (happy path) plus dur que Shopify** — `sources/page.tsx:946-959` : nommer + upload + « Analyser » + valider mapping ; bloqué tant que `csvAnalysisReady` faux (`:852-855`). → auto-nommer (code déjà capable `:723-730`), analyse au drop, auto-accepter `suggestedMapping`, ne demander que si `missingRequiredFields`.
- **[P1] Tour 8 étapes détourne de l'activation** — `onboarding-tour.tsx:35-338`, proposé à égalité avec l'action principale (`onboarding/page.tsx:566`) ; state local vs serveur (risque réaffichage). → tour réduit à 2 étapes (« connecte une source » → « voici ton audit »), option secondaire ; remplacer par checklist d'activation.
- **[P1] Formulaire register trop lourd** — 5 champs + confirm password (`register/page.tsx:472`) alors que le toggle œil existe (`:426`). → Email + Mot de passe + Nom ; retirer « confirmer » et « entreprise ». Vérifier que Google Sign-in (`hasGoogleAuth`) est actif en prod.
- **[P1] Diagnostic encore semi-charabia** — `product-quality-details-section.tsx` « Saturation X% », « Score vendeuse 62/100 ». → format Cause → Conséquence Google → Action (« Sans catégorie → non éligible Shopping → compléter avec l'IA »). `recommendation`/`impact` existent dans `topIssues` (l.983-984).
- **[P1] Design hétérogène sur la fiche produit** — emojis 🔴🟡🚨, `bg-red-50 border-red-500`, « Score vendeuse » (`product-quality-*`) vs workbench sobre. → aligner sur le design system (variables CSS, Badge, icônes lucide). Quick win fort halo, critique pour les agences.
- **[P1] Boucle de valeur jamais bouclée** — diagnostic `/catalogue`, fix `/catalogue/[id]`, masse `/optimiser`, push `/flux` éclatés. → après correction, bandeau « 142 produits corrigés → Pousser vers Google » avec CTA direct.

---

## P2 — Optimisations
- CTA final homepage qui scrolle vers le haut au lieu de convertir (`page.tsx:1027`).
- Hero homepage surchargé (4 actions concurrentes : `page.tsx:402-451,622-652`).
- Pas de prix annuel (aucun levier d'engagement / -churn).
- Surcharge cognitive du workbench au 1er usage (drag-fill, colonnes custom) → mode « Audit » par défaut, « Édition avancée » en toggle.
- Paywall en redirect dur en fin de trial → préférer audit en lecture seule + push verrouillé (« passe en payant pour pousser tes 312 corrigés »).
- « Pour qui » implicite sur les LP channel ; footer sans CTA ; stats à zéro affichées au-dessus de l'action sur compte vide (`sources:1017-1059`).

---

## Top 5 à plus fort impact (si on ne fait que ça)
1. **Héroïser le chiffre de douleur** dès le dashboard ET en haut du catalogue (P0-2 + P0-3) — la donnée existe déjà.
2. **Réparer le hook « audit gratuit »** : pré-score sans formulaire (P0-1).
3. **Supprimer les étapes mortes signup→connexion→aha** + auto-redirect vers l'écran de douleur (P0-6).
4. **Trancher la durée d'essai + réassurance sur choose-plan** (P0-5 + P1 réassurance).
5. **Instrumenter `store_connected`** pour piloter le reste (P0-7).
