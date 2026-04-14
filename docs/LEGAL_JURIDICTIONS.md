# Légal par juridiction

**Objectif** : structurer les contenus juridiques (mentions légales, confidentialité, CGU, cookies) par juridiction pour l’internationalisation.

## Pages créées (placeholders)

| Page        | Route FR (ex.)   | Route EN (ex.)   | Rôle                                      |
|-------------|------------------|------------------|-------------------------------------------|
| Mentions    | `/legal/mentions` | `/en/legal/mentions` | Éditeur, hébergeur, contact                |
| Confidentialité | `/legal/privacy`  | `/en/legal/privacy`  | Politique de confidentialité (RGPD, UK GDPR) |
| CGU         | `/legal/terms`    | `/en/legal/terms`    | Conditions générales d’utilisation        |
| Cookies     | `/legal/cookies`  | `/en/legal/cookies` | Politique cookies (ePrivacy)              |

Le contenu affiché dépend de la **locale** (fr / en). Les textes définitifs doivent être rédigés **par juridiction**.

## Juridictions à couvrir

| Juridiction | Quand           | Points d’attention                                      |
|-------------|-----------------|--------------------------------------------------------|
| **France / UE** | Déjà visé        | RGPD, Loi Confiance Économique, mentions légales FR, CNIL |
| **UK**      | Ouverture UK (T1) | UK GDPR, ICO, Consumer Rights, loi anglaise           |
| **US**      | T4 (US/CA)      | État par état (Californie CCPA, etc.), termes en anglais US |
| **Autres**  | Selon marché    | Données à caractère personnel, consentement cookies   |

## Contenu à rédiger (par page)

### Mentions légales
- Raison sociale, siège, contact
- Hébergeur (nom, adresse)
- Directeur de la publication
- (UK) Company number, VAT si applicable

### Confidentialité
- Identité du responsable du traitement
- Finalités et base légale du traitement
- Durée de conservation
- Droits (accès, rectification, effacement, portabilité, opposition, réclamation CNIL/ICO)
- Sous-traitants et transferts (hors UE/UK si applicable)

### CGU
- Objet et acceptation
- Description des services et abonnement
- Obligations des parties, responsabilité, force majeure
- Résiliation et droit applicable (tribunal compétent)

### Cookies
- Types de cookies (essentiels, analytiques, préférences)
- Finalités et durée
- Consentement et retrait (lien vers paramètres ou outil)
- Cookies tiers (analytics, support, etc.)

## Checklist avant mise en ligne par marché

- [ ] Contenu rédigé ou validé par un juriste pour la juridiction cible
- [ ] Pages accessibles depuis le footer (liens Confidentialité, CGU)
- [ ] Bandeau ou gestion du consentement cookies si requis
- [ ] Version EN à jour pour le UK si ouverture UK

## Fichiers

- **Frontend** : `frontend/src/app/[locale]/(marketing)/legal/` (mentions, privacy, terms, cookies)
- **Footer** : liens vers `/legal/privacy` et `/legal/terms` (composant marketing home)
