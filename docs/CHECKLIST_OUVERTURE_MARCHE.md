# Checklist ouverture d’un nouveau marché

À utiliser pour **chaque nouveau pays ou région** (UK, Nordics, DE, US, etc.). Cocher au fur et à mesure.

## 1. Technique

| # | Tâche | Réf. |
|---|--------|------|
| 1.1 | Ajouter la locale dans `frontend/src/i18n/locales.ts` (ACTIVE_LOCALES ou PLANNED_LOCALES) | `frontend/src/i18n/locales.ts` |
| 1.2 | Créer le fichier de messages `frontend/src/messages/{locale}.json` (ou prévoir fallback) | `frontend/src/messages/` |
| 1.3 | Définir LOCALE_META (currency, dateStyle, label, languageTag) pour la locale | `frontend/src/i18n/locales.ts` |
| 1.4 | Si nouvelle devise : ajouter la grille dans `frontend/src/config/plans.ts` (PLANS_BY_CURRENCY) et getCurrencyForLocale | `frontend/src/config/plans.ts` |
| 1.5 | Vérifier formats (date, nombre, devise) avec `frontend/src/lib/format.ts` | `frontend/src/lib/format.ts` |

## 2. SEO & contenu

| # | Tâche | Réf. |
|---|--------|------|
| 2.1 | Contenu marketing (home, LP) traduit ou adapté pour la locale | `frontend/src/messages/`, pages `[locale]/(marketing)/` |
| 2.2 | Métadonnées (title, description) et hreflang mis à jour (sitemap, layout) | `frontend/src/app/[locale]/(marketing)/layout.tsx`, `lp-metadata.tsx` |
| 2.3 | Sitemap inclut les URLs de la nouvelle locale | `frontend/src/app/sitemap.ts` si applicable |

## 3. Tarification & facturation

| # | Tâche | Réf. |
|---|--------|------|
| 3.1 | Grille tarifaire dans la devise du marché (déjà en place si config/plans + getCurrencyForLocale) | `frontend/src/config/plans.ts` |
| 3.2 | Stripe : créer les prix dans la devise cible (priceId) si facturation locale | `backend-marketing/routes/onboarding-billing.js`, env Stripe |
| 3.3 | Page tarifs et facturation affichent la bonne devise selon locale ou pays compte | Page tarifs, API billing |

## 4. Légal

| # | Tâche | Réf. |
|---|--------|------|
| 4.1 | Mentions légales / Legal information adaptées à la juridiction | `docs/LEGAL_JURIDICTIONS.md`, pages `legal/mentions` |
| 4.2 | Politique de confidentialité (RGPD, UK GDPR, etc.) | `legal/privacy` |
| 4.3 | CGU / Terms of use adaptées au droit local | `legal/terms` |
| 4.4 | Politique cookies et bandeau consentement si requis | `legal/cookies` |

## 5. Produit & canaux

| # | Tâche | Réf. |
|---|--------|------|
| 5.1 | Canaux (Amazon, GMC, etc.) pour le pays ajoutés dans `backend-marketing/config/channels-by-market.js` si nouveau | `backend-marketing/config/channels-by-market.js`, `CANAUX_PAR_MARCHE.md` |
| 5.2 | Export / flux compatibles avec le marché (devise, format, règles) | Backend export, GMC/Amazon |

## 6. Emails & support

| # | Tâche | Réf. |
|---|--------|------|
| 6.1 | Templates email dans la langue du marché (sujet + corps) | `backend-marketing/email/email-service.js`, EMAIL_TEMPLATES |
| 6.2 | Passer la locale utilisateur aux appels sendWelcomeEmail, etc. (inscription, reset password) | Backend auth/register, forgot-password |
| 6.3 | Support : langue(s) et créneaux indiqués (voir `docs/SUPPORT_PAR_MARCHE.md`) | Doc support |

## 7. Go-to-market

| # | Tâche |
|---|--------|
| 7.1 | Page ou section dédiée au pays/région si pertinent (pricing, contact) |
| 7.2 | Communication (site, annonce) et suivi (analytics, feedback) |

---

**Référence** : roadmap internationale `docs/ROADMAP_INTERNATIONALISATION_SAAS.md`.
