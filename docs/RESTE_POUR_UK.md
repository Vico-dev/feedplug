# Ce qu’il reste pour s’exporter au UK

Vous avez déjà **l’essentiel** en place (i18n, EN, devises, canaux, emails EN, structure légale). Voici ce qui reste pour être **prêt UK** au sens « on peut vendre et opérer au Royaume-Uni ».

---

## Déjà en place

| Domaine | État |
|--------|------|
| **Langue EN** | Marketing (home, LP, tarifs, legal) + dashboard entièrement en EN. |
| **Devises / formats** | `format.ts` (currency, date, nombre) ; grille GBP dans `config/plans.ts` (42 £ / 129 £ / 349 £). |
| **Tarifs multi-devise** | Page tarifs utilise `getCurrencyForLocale(locale)` ; pour afficher en £ il suffit que la locale (ou le « marché ») soit associée à la GBP (voir ci‑dessous). |
| **Canaux** | Amazon UK + GMC dans `channels-by-market.js` ; export backend déjà prévu. |
| **Emails EN** | Templates FR/EN dans `email-service.js` (welcome, reset password, sync, export, etc.). |
| **Légal (structure)** | Pages `/legal/mentions`, `/legal/privacy`, `/legal/terms`, `/legal/cookies` avec contenu bilingue (placeholders). |
| **Support** | Doc `SUPPORT_PAR_MARCHE.md` ; support EN possible dès maintenant. |

---

## À faire pour le UK (ordre recommandé)

### 1. Décider comment on « cible » le UK (devise + SEO)

- **Option A** : Garder la locale `en` et considérer que « EN = UK » pour la première phase.  
  - Dans `frontend/src/config/plans.ts`, mettre **`en: 'GBP'`** dans `getCurrencyForLocale` (au lieu de `EUR`) pour que la page tarifs en anglais affiche les prix en £.  
  - Pas de changement de routing, pas de nouvelle locale.
- **Option B** : Ajouter la locale **`en-GB`** (recommandé si vous voulez plus tard distinguer US/CA/AU).  
  - Ajouter `en-GB` à `ACTIVE_LOCALES` dans `i18n/locales.ts`, et `LOCALE_META['en-GB']` (déjà là : GBP, en-GB).  
  - Soit créer `messages/en-GB.json` (copie de `en.json` au besoin), soit garder le fallback sur `en`.  
  - Les utilisateurs UK accèdent en `/en-GB/...` ou vous redirigez selon la géo.

**Recommandation courte** : Option A pour lancer vite (EN = UK, affichage en £) ; Option B si vous prévoyez bientôt US/CA avec une autre locale.

---

### 2. Légal UK (obligatoire pour vendre au UK)

| Tâche | Détail |
|--------|--------|
| **Terms of use (UK)** | Rédiger ou adapter les CGU au droit anglais (juridiction, tribunal, Consumer Rights Act si B2C). Page `legal/terms` : version EN déjà en placeholder ; y mettre le vrai texte UK. |
| **Privacy policy (UK)** | UK GDPR + ICO : responsable du traitement, finalités, bases légales, droits (accès, rectification, effacement, portabilité, plainte ICO), durée de conservation, sous-traitants. Page `legal/privacy`. |
| **Legal information / Mentions** | Éditeur, siège, contact ; si société UK : company number, VAT. Page `legal/mentions`. |
| **Cookies** | Politique cookies lisible en EN ; bandeau ou gestion du consentement si vous utilisez des cookies non essentiels (analytics, etc.). |

À faire avec un juriste ou un template sérieux (UK). Réf. `docs/LEGAL_JURIDICTIONS.md`.

---

### 3. Stripe & facturation (si vous facturez en £)

| Tâche | Détail |
|--------|--------|
| **Prix Stripe en GBP** | Créer dans le dashboard Stripe les prix en GBP (ex. 42 £, 129 £, 349 £) et récupérer les `priceId`. |
| **Backend** | Dans `backend-marketing/routes/onboarding-billing.js`, selon pays du compte ou devise choisie, utiliser le bon `priceId` (EUR ou GBP). Aujourd’hui un seul set de `PLANS` en EUR ; il faudra soit un second set GBP, soit une logique « pays → currency → priceId ». |
| **TVA UK** | Règles UK (VAT) si vous êtes assujetti ; à clarifier avec un expert compta. |

---

### 4. Emails : passer la locale à l’inscription et au reset password

Les templates EN existent, mais il faut **passer la locale** (ou la langue préférée) aux fonctions d’email :

- Lors de l’**inscription** : récupérer la locale (header `Accept-Language` ou préférence utilisateur) et appeler `sendWelcomeEmail(email, firstName, 'en')` pour un utilisateur EN/UK.
- Lors du **reset password** : idem (locale depuis le lien ou la session).

Réf. `backend-marketing/email/email-service.js` (toutes les fonctions acceptent déjà un paramètre `locale`).

---

### 5. SEO & contenu « UK » (recommandé)

| Tâche | Détail |
|--------|--------|
| **Contenu marketing** | Sur la home et les LP en EN, ajouter des références au UK (ex. « United Kingdom », « UK sellers », « GBP ») pour le référencement et la confiance. |
| **Hreflang** | Si vous ajoutez `en-GB`, mettre à jour le layout marketing et le sitemap avec `en-GB` et `x-default`. Si vous restez en `en` = UK, un seul `en` suffit. |
| **Sitemap** | S’assurer que les URLs EN (ou en-GB) sont bien présentes. |

---

### 6. Support & communication

- Mettre à jour **`docs/SUPPORT_PAR_MARCHE.md`** : ajouter une section UK (langue : English, créneaux, contact).
- Sur le site (footer ou page contact) : indiquer que le support est disponible en **English** (et éventuellement « for UK customers »).

---

### 7. Produit & export (vérifications)

- **GMC UK** : confirmer que l’export Google Merchant Center permet bien de cibler le UK (ou la locale en-GB) et que les flux sont conformes.
- **Catalogue** : l’affichage des prix utilise déjà `formatCurrency` et la devise du canal/item ; pour les comptes UK, les canaux UK (Amazon UK, GMC UK) afficheront la GBP. Rien de bloquant si les données sont en GBP.

---

## Synthèse : ordre pour lancer le UK

1. **Décision devise** : Option A (en → GBP) ou B (en-GB). Mettre à jour `getCurrencyForLocale` (et éventuellement `ACTIVE_LOCALES`).
2. **Légal UK** : Terms, Privacy, Legal, Cookies (rédaction / validation juridique).
3. **Emails** : brancher la locale (ou la langue) sur l’inscription et le reset password.
4. **Stripe** : prix GBP + logique backend si vous facturez en £.
5. **SEO / contenu** : touches UK sur les pages EN + hreflang/sitemap si en-GB.
6. **Support** : doc + mention sur le site.

Une fois 1, 2 et 3 faits, vous pouvez **proposer le produit au UK** (démo, early adopters) même sans facturation automatique en £ (facture manuelle en GBP possible). Les points 4, 5 et 6 rendent l’offre UK complète et scalable.

**Références** : `ROADMAP_INTERNATIONALISATION_SAAS.md` (T1 UK), `CHECKLIST_OUVERTURE_MARCHE.md`, `LEGAL_JURIDICTIONS.md`.
