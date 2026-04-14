# Glossaire produit & i18n

Termes utilisés dans l’interface et les communications FeedPlug, avec équivalents par langue. À utiliser pour garder une **cohérence** entre FR, EN et les futures locales.

## Termes métier (produit)

| Concept | FR | EN (UK/US) | Notes |
|--------|----|------------|-------|
| Flux produit | flux (produit) | product feed / feed | « Feed » seul acceptable en EN. |
| Catalogue | catalogue | catalog | US : catalog ; UK souvent catalogue. |
| Source | source | source | Idem. |
| Enrichissement | enrichissement | enrichment | Enrichment IA. |
| Score qualité | score qualité | quality score | |
| Export | export | export | |
| Canal | canal | channel | Ex. canal Amazon, channel. |
| Marketplace | marketplace | marketplace | Inchangé. |
| Plan / abonnement | plan, abonnement | plan, subscription | |
| Facturation | facturation | billing | |
| Essai gratuit | essai gratuit | free trial | |

## UI courante

| Concept | FR | EN |
|--------|----|----|
| Commencer / Démarrer | Commencer | Get started / Start |
| Sauvegarder | Enregistrer / Sauvegarder | Save |
| Annuler | Annuler | Cancel |
| Supprimer | Supprimer | Delete |
| Modifier | Modifier | Edit |
| Recommandé | Recommandé | Recommended |
| Mois (période) | mois | month / mo. |
| Produits | produits | products |
| Support | support | support |

## Légal & footer

| Concept | FR | EN |
|--------|----|----|
| Mentions légales | Mentions légales | Legal information / Legal |
| Confidentialité | Confidentialité | Privacy |
| Conditions d’utilisation | Conditions d’utilisation | Terms of use / Terms |
| Cookies | Cookies | Cookies |
| Politique de confidentialité | Politique de confidentialité | Privacy policy |

## Ton & bonnes pratiques

- **FR** : tutoiement ou vouvoiement à fixer une fois pour toute l’app (ex. « Votre compte », « Commencez l’import »).
- **EN** : ton neutre et professionnel ; « You » / « Your ».
- Éviter le mot-à-mot : adapter les CTA et les phrases courtes (ex. « Commencer l’essai gratuit » → « Start free trial »).
- Chiffres et devises : utiliser les utilitaires de format (`frontend/src/lib/format.ts`) pour respecter la locale (séparateurs, symboles).

## Où sont les textes

- **Marketing (FR/EN)** : `frontend/src/messages/fr.json`, `en.json`.
- **Emails** : `backend-marketing/email/email-service.js` (EMAIL_TEMPLATES par locale).
- **Légal** : pages dans `frontend/src/app/[locale]/(marketing)/legal/` ; contenu à rédiger par juridiction (voir `LEGAL_JURIDICTIONS.md`).

Ce glossaire peut être étendu (DE, ES, etc.) au fil de l’ouverture des marchés.
