# Next steps FeedPlug

Deux pistes en parallèle possibles : **opérationnel (première vente)** et **internationalisation**.

---

## ✅ Dashboard i18n (fait)

- **Dashboard sous [locale]** : les routes app (catalogue, sources, flux, paramètres, etc.) sont sous `app/[locale]/(dashboard)/`. Sur le domaine app, le middleware next-intl applique la locale (FR par défaut, EN via `/en/...`).
- **Sidebar & layout** : libellés de menu traduits (`dashboard.nav.*`), message de chargement (`dashboard.loading`).
- **Pages** : titres et sous-titres traduits pour Dashboard, Catalogue, Sources, Flux, Paramètres, Facturation, Scoring canaux, Notifications, Rapports. Toasts principaux sur Sources (sync, pause, erreur).
- **Messages** : namespace `dashboard` dans `fr.json` et `en.json` (nav, common, catalogue, sources, flux, parametres, facturation, etc.).
- **À compléter en 2e pass** (optionnel) : fiche produit / product-drawer (alertes, labels), paramètres (onglets, rôles, boutons), admin (titres, messages), optimiser (noRules, etc.), libellés de champs catalogue (`dashboard.fields.*`) dans les composants qui utilisent `getFieldLabel`.

---

## Piste 1 — Être opérationnel (première vente)

**Réf.** : `docs/RESTE_A_FAIRE_OPERATIONNEL.md`

| Priorité | Action | Détail |
|----------|--------|--------|
| 🔴 **Bloquant** | Config prod | `NEXT_PUBLIC_API_URL` et SMTP configurés en prod (voir `backend-marketing/DEPLOI_CHECKLIST.md`). |
| 🟠 **Recommandé** | Tests E2E manuels | Flow : inscription → import → enrichissement → export GMC. Documenter les cas. |
| 🟠 | Documentation vendeur | 1-pager produit, arguments de vente, limites (GMC), process facturation manuelle. |
| 🟠 | Alertes Sentry | Configurer Slack/email selon `SENTRY_ALERTES.md`. |
| 🟡 | Compte démo | Données propres, compte démo pour commerciaux. |
| 🟡 | Onboarding | Parcours clair après inscription (sources, premiers flux). |
| 🟡 | Polish UX | Parcours critiques, messages d’erreur, états de chargement. |

---

## Piste 2 — Internationalisation (suite au T0)

**Réf.** : `docs/ROADMAP_INTERNATIONALISATION_SAAS.md`

### Immédiat (finir de brancher le T0)

| Action | Détail |
|--------|--------|
| **Passer la locale aux emails** | Lors de l’inscription et du reset password : récupérer la locale (header `Accept-Language` ou préférence) et appeler `sendWelcomeEmail(..., locale)`, `sendPasswordResetEmail(..., locale)`. Voir `backend-marketing/email/email-service.js`. |
| **Contenu juridique FR** | Rédiger les vrais textes pour mentions légales, confidentialité, CGU, cookies (France/UE). Les pages existent sous `frontend/src/app/[locale]/(marketing)/legal/`. Voir `docs/LEGAL_JURIDICTIONS.md`. |

### Ensuite : T1 UK

| Jalon | Action |
|-------|--------|
| T1.1 | Décider `en` vs `en-GB` (reco : garder `en`, hreflang `en-GB` si besoin). Formats UK (date, nombre) déjà gérés par `frontend/src/lib/format.ts`. |
| T1.2 | Adapter le contenu marketing pour le UK (références UK, GBP). Hreflang + sitemap. |
| T1.3 | Tarifs GBP : déjà en place dans `frontend/src/config/plans.ts`. Stripe : créer les prix en GBP si facturation UK. |
| T1.4 | Légal UK : Terms, Privacy (UK GDPR / ICO). Rédaction ou validation juridique. |
| T1.5 | Vérifier GMC UK et export ; catalogue affiche GBP pour canal UK (utiliser `formatCurrency` + devise canal). |
| T1.6 | Support EN + mention UK sur le site. Mettre à jour `docs/SUPPORT_PAR_MARCHE.md`. |

### Après T1

- **T2 Nordics** : locales (sv, da, no, fi), messages, devises (SEK, NOK, DKK, EUR), SEO, légal (RGPD).
- **T3 Europe** : DE, ES, IT, NL… (même pattern : locale, SEO, légal, canaux).
- **T4** : US/Canada (USD, CAD, légal US/CA) ; Amérique latine (ES + PT/PT-BR).

---

## Ordre suggéré (si une seule piste à la fois)

1. **Config prod** (bloquant première vente).
2. **Tests E2E** + **doc vendeur** (démo et vente).
3. **Locale → emails** + **légal FR** (finir T0, sans bloquer la vente FR).
4. **T1 UK** quand vous visez explicitement le UK.

---

**Checklist ouverture marché** (réutilisable) : `docs/CHECKLIST_OUVERTURE_MARCHE.md`.
