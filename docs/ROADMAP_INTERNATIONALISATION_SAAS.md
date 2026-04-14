# Roadmap internationalisation FeedPlug

**Objectif** : préparer les prérequis puis ouvrir les marchés dans l’ordre UK → Nordics → reste Europe, pour ensuite viser les pays anglophones (US, Canada) et l’Amérique latine (Espagne, Portugal comme tremplin).

**Contexte actuel** : Next.js avec **next-intl**, locales **FR** (défaut) et **EN**, marketing + LP en FR/EN, dashboard partiellement traduit, tarifs en **EUR**, backend avec canaux Amazon FR/UK/DE/IT/ES déjà modélisés.

---

## Vue d’ensemble des phases

| Phase | Marché cible | Objectif | Porte ouverte vers |
|-------|--------------|----------|---------------------|
| **T0** | — | Prérequis techniques & process (one-time) | Tous les marchés |
| **T1** | UK | Premier marché non-FR, validation process i18n/legal | Anglophonie, Nordics |
| **T2** | Nordics (SE, NO, DK, FI) | Europe du Nord, forte maturité e-commerce | — |
| **T3** | Reste Europe (DE, IT, ES, NL, etc.) | Couverture UE | — |
| **T4** | US, Canada, Amérique latine | Anglophonie globale + ES/PT (Brésil, LATAM) | Monde |

---

## T0 — Prérequis à l’ouverture de tout nouveau marché

À traiter **une fois** ; chaque nouveau pays en bénéficie.

### 0.1 Technique & produit

| # | Prérequis | Détail | Réf. actuelle |
|---|-----------|--------|----------------|
| 1 | **Architecture i18n scalable** | Pouvoir ajouter une locale sans refonte. Actuellement `locales: ['fr','en']` dans `frontend/src/i18n/routing.ts` ; prévoir `en-GB`, `de`, `es`, etc. et stratégie fallback (ex. `en-GB` → `en`). | `frontend/src/i18n/routing.ts`, `frontend/src/i18n.ts` |
| 2 | **Devises & formats** | Données déjà en `currency` (ISO 4217). À prévoir : affichage prix par marché (GBP, SEK, USD…), formats date/heure et nombres par locale. | Backend : `currency` sur FeedItem ; frontend : catalogue affiche `EUR` en dur par endroits |
| 3 | **Tarification multi-devise** | Grille actuelle en EUR (49 / 149 / 399 €). Pour UK : proposer GBP (ou EUR avec mention). Pour Stripe : multi-currency / multi-price selon pays ou segment. | `docs/COUTS_ET_TARIFS_PLANS.md`, `backend-marketing/routes/onboarding-billing.js` |
| 4 | **Canaux & marketplaces par pays** | Déjà : Amazon FR/UK/DE/IT/ES dans le backend. Documenter la matrice pays ↔ canaux (GMC, Amazon, etc.) et s’assurer que l’UI propose les bons canaux selon la région du compte ou du flux. | `backend-marketing/server-minimal.js` (amazon_*), `backend-marketing/docs/AMAZON_CANAUX_DESIGN.md` |
| 5 | **Emails & notifications** | Langue des emails (onboarding, facturation, alertes) selon préférence utilisateur ou locale du compte. | À définir (templates par locale) |

### 0.2 Légal & conformité

| # | Prérequis | Détail |
|---|-----------|--------|
| 6 | **Mentions / CGV / Privacy par juridiction** | FR : déjà liens footer (legal, privacy, terms). UK : vérifier besoin de pages dédiées (UK law, ICO pour la data). UE : RGPD couvre déjà ; garder une version EN pour UK/IE. |
| 7 | **Consentement & cookies** | Politique cookies et bandeau conforme au pays (ePrivacy + RGPD en UE ; UK post-Brexit similaire). |
| 8 | **Facturation & TVA** | Règles TVA par pays (UE OSS, UK, hors UE). À clarifier avec un expert compta/fiscal ; impact sur Stripe et sur les mentions légales. |

### 0.3 Process & contenu

| # | Prérequis | Détail |
|---|-----------|--------|
| 9 | **Process d’ouverture de marché** | Checklist type : (1) locale + messages, (2) SEO (hreflang, contenu), (3) légal, (4) tarifs/devise, (5) support, (6) lancement. |
| 10 | **Glossaire & ton de marque** | Termes produit cohérents (feed, catalogue, channel, etc.) et ton par langue ; éviter le mot-à-mot. |
| 11 | **Support** | Langue(s) du support (FR/EN minimum) ; heures de réponse et canal (email, chat) par zone. |

---

## T1 — Ouverture marché UK

**Objectif** : premier marché non-France, en anglais, avec devise locale (GBP) et conformité UK. Valide le process pour les marchés suivants.

### Pourquoi le UK en premier

- Langue **EN** déjà en place (marketing, LP, messages).
- Grande maturité e-commerce et marketplaces (Amazon UK, GMC UK).
- Après Brexit : juridiction distincte (UK GDPR, ICO) — bon exercice pour la suite.
- Tremplin naturel vers US/Canada et autres pays anglophones.

### Jalons T1

| Jalon | Livrable | Effort indicatif |
|-------|----------|------------------|
| **T1.1** | **Locale EN dédiée UK** | Décider : garder `en` générique ou ajouter `en-GB`. Recommandation : garder `en` avec `en-GB` en alias SEO (hreflang) si besoin. Vérifier formats date/nombre UK (DD/MM/YYYY, etc.). | 0,5 j |
| **T1.2** | **Contenu & SEO UK** | Page d’accueil / LP adaptées au UK (références « UK », « United Kingdom », « GBP »). Hreflang `en-GB` si sous-locale. Sitemap et métadonnées. | 1 j |
| **T1.3** | **Tarification GBP** | Grille équivalente en GBP (ex. 49 € → ~42 £, ou prix ronds 45 £ / 130 £ / 350 £). Page tarifs et facturation : affichage GBP pour comptes UK (ou choix devise). Stripe : prix en GBP si facturation UK. | 1 j |
| **T1.4** | **Légal UK** | Pages ou sections : Terms (UK), Privacy (UK GDPR / ICO), Legal. Vérifier exigences ICO et UK Consumer Rights. | 1–2 j |
| **T1.5** | **Produit** | Amazon UK déjà présent côté backend. S’assurer que GMC UK (ou équivalent) est documenté et que l’export/flux couvre le marché UK. Catalogue : affichage prix en GBP quand canal/marché = UK. | 0,5 j |
| **T1.6** | **Support & communication** | Support en anglais ; mention UK sur le site (pricing, contact). Option : numéro ou fuseau pour UK. | 0,5 j |

**Livrable T1** : site et app prêts pour des clients UK (inscription, tarifs en GBP, légal UK, export/flux UK), avec process réutilisable pour les prochains marchés.

---

## T2 — Marchés nordics (SE, NO, DK, FI)

**Objectif** : proposer FeedPlug en Europe du Nord (langues + devises + SEO).

### Spécificités

- **Langues** : suédois (SE), norvégien (NO), danois (DK), finnois (FI). Coût de traduction plus élevé ; priorisation possible (ex. SE puis NO/DK, FI en dernier).
- **Devises** : SEK, NOK, DKK, EUR (Finlande). Formats nombres/dates à adapter.
- **E-commerce** : forte pénétration marketplaces et comparateurs ; canaux à valider (Amazon SE/NO ? GMC par pays).

### Jalons T2

| Jalon | Livrable | Effort indicatif |
|-------|----------|------------------|
| **T2.1** | **Choix des langues** | Décider ordre : ex. SE → DK → NO → FI, ou SE + EN pour les Nordics (beaucoup lisent l’anglais). | — |
| **T2.2** | **Locales + messages** | Ajout `sv`, `da`, `no`, `fi` dans next-intl ; fichiers `messages/sv.json` etc. Traduction des clés marketing + dashboard (prioriser parcours critique). | 2–4 j selon nombre de langues |
| **T2.3** | **Tarifs & devises** | Grille en SEK/NOK/DKK/EUR (FI). Stripe multi-currency ou prix par pays. | 1 j |
| **T2.4** | **SEO & contenu** | Contenu marketing par langue ; hreflang (fr, en, sv, da, no, fi, x-default). | 1–2 j |
| **T2.5** | **Légal** | RGPD suffit pour l’UE/EEE ; adapter mentions légales et politique de confidentialité par langue si besoin. | 0,5 j |
| **T2.6** | **Canaux** | Vérifier marketplaces et comparateurs pertinents (Amazon.se, etc.) et les intégrer si roadmap produit le permet. | Selon roadmap produit |

---

## T3 — Reste de l’Europe (DE, IT, ES, NL, etc.)

**Objectif** : couvrir les grands marchés UE (Allemagne, Italie, Espagne, Pays-Bas, etc.).

### Ordre suggéré

1. **DE** (Allemagne) — plus gros marché e-commerce UE.
2. **ES** (Espagne) — tremplin Amérique latine + langue déjà utile pour LATAM.
3. **IT** (Italie).
4. **NL** (Pays-Bas), puis autres (PL, BE, etc.) selon priorité business.

### Jalons T3 (par langue, à répliquer)

| Jalon | Livrable |
|-------|----------|
| **T3.x.1** | Locale + messages (de, es, it, nl…) |
| **T3.x.2** | Tarifs en EUR (ou devise locale si hors zone euro) |
| **T3.x.3** | SEO & contenu localisé, hreflang |
| **T3.x.4** | Légal (RGPD + mentions dans la langue) |
| **T3.x.5** | Canaux / marketplaces (Amazon DE/IT/ES déjà en backend) |

**Gain** : Espagne (ES) ouvre la porte à l’Amérique latine (même langue) et au Portugal (proche) pour le Brésil (PT-BR à traiter ensuite si besoin).

---

## T4 — Anglophonie globale (US, Canada) & Amérique latine

### T4a — US & Canada

- **Langue** : anglais déjà en place ; variantes US/CA (orthographe, termes) optionnelles au début.
- **Devises** : USD, CAD. Stripe US/CA.
- **Légal** : états américains (privacy laws), Canada (PIPEDA, provinces). À faire avec un avocat local.
- **Produit** : GMC US/CA, Amazon US/CA ; vérifier canaux et flux.

### T4b — Amérique latine (Espagne & Portugal comme tremplin)

- **ES** (déjà prévu en T3) : base pour **Espagne** + **Amérique latine hispanophone** (MX, AR, CO, CL, etc.). Adapter SEO et positionnement (LATAM vs Espagne).
- **PT** : **Portugal** (EUR) puis **Brésil** (BRL, PT-BR). Locale `pt` puis variante `pt-BR` si besoin.
- **Légal** : LGPD (Brésil), lois locales par pays ; facturation et TVA selon pays.
- **Canaux** : Mercado Libre, Amazon MX/BR, etc. — à prioriser selon roadmap produit.

---

## Synthèse : ordre et dépendances

```
T0 (prérequis) ──────────────────────────────────────────────────────────┐
    │                                                                     │
    ▼                                                                     │
T1 UK ──────► Process validé, EN + GBP + légal UK                        │
    │                                                                     │
    ▼                                                                     │
T2 Nordics ──► SE, NO, DK, FI (locales + devises + SEO)                   │  Réutilisé
    │                                                                     │  à chaque
    ▼                                                                     │  nouveau
T3 Europe ───► DE, ES, IT, NL… (même pattern : locale, SEO, légal)       │  marché
    │                                                                     │
    ├──► ES ouvre la porte LATAM hispanophone                             │
    │                                                                     │
    ▼                                                                     │
T4a US/CA ──► Anglophonie, USD/CAD, légal US/CA                           │
T4b LATAM ──► ES (LATAM) + PT/PT-BR (Brésil), LGPD, canaux locaux         │
```

---

## Checklist type « Ouverture d’un nouveau marché »

À remplir pour chaque nouveau pays (UK, SE, DE, etc.) :

- [ ] **Technique** : locale ajoutée (ou alias), messages traduits, formats date/devise/nombres.
- [ ] **SEO** : contenu marketing, hreflang, sitemap, métadonnées.
- [ ] **Tarifs** : grille dans la devise du pays, Stripe si applicable.
- [ ] **Légal** : Terms, Privacy, Legal (et cookies) adaptés à la juridiction.
- [ ] **Produit** : canaux et marketplaces du pays disponibles et documentés.
- [ ] **Support** : langue(s) et créneaux couverts.
- [ ] **Go-to-market** : page pays/région, communication, suivi.

---

## Références internes

- **i18n** : `frontend/src/i18n/routing.ts`, `frontend/src/i18n/locales.ts`, `frontend/src/i18n.ts`, `frontend/src/messages/*.json`
- **Formats (devise, date, nombres)** : `frontend/src/lib/format.ts`
- **Tarifs multi-devise** : `frontend/src/config/plans.ts`, `docs/COUTS_ET_TARIFS_PLANS.md`, page tarifs
- **Canaux par pays** : `backend-marketing/config/channels-by-market.js`, `backend-marketing/docs/CANAUX_PAR_MARCHE.md`
- **Emails par langue** : `backend-marketing/email/email-service.js` (paramètre `locale`, `EMAIL_TEMPLATES`)
- **Légal** : `frontend/src/app/[locale]/(marketing)/legal/`, `docs/LEGAL_JURIDICTIONS.md`
- **Process** : `docs/CHECKLIST_OUVERTURE_MARCHE.md`, `docs/GLOSSAIRE_I18N.md`, `docs/SUPPORT_PAR_MARCHE.md`
- **Canaux Amazon** : `backend-marketing/server-minimal.js`, `backend-marketing/docs/AMAZON_CANAUX_DESIGN.md`
- **SEO** : `docs/AUDIT_SEO_LLM.md`, `docs/STRATEGIE_SEO_GEO_FEEDPLUG.md`, `frontend/src/lib/lp-metadata.tsx`
- **Opérationnel** : `docs/RESTE_A_FAIRE_OPERATIONNEL.md`

---

*Document créé pour préparer l’internationalisation du SaaS FeedPlug (UK → Nordics → Europe → anglophonie & LATAM). À mettre à jour au fil des décisions (locales exactes, ordre des marchés, choix juridiques).*
