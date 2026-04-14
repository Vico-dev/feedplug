# Audit des traductions du site FeedPlug

**Date :** 2026-02-27  
**Locales actives :** `fr`, `en`, `es`

---

## 1. Fichiers de messages (fr / en / es)

- **Clés :** 469 clés dans chaque fichier — **alignés** (même structure).
- Les trois fichiers `src/messages/fr.json`, `en.json`, `es.json` ont les mêmes clés.

---

## 2. Ce qui est bien traduit

| Zone | Fichier / Route | Statut |
|------|------------------|--------|
| **Marketing (pages publiques)** | `[locale]/(marketing)/page.tsx` | ✅ Utilise `useTranslations()` (hero, form, nav, footer, etc.) |
| **Page tarifs** | `[locale]/(marketing)/tarifs/page.tsx` | ✅ Namespace `tarifs` utilisé partout |
| **Landing pages (LP)** | `LPPageContent.tsx`, pages sous `optimiser-flux-*`, `diffusion-nouveaux-canaux`, `distribution-assistants-ia` | ✅ Textes via `useTranslations(namespace)` |
| **Page intégrations** | `[locale]/(marketing)/integrations/page.tsx` | ✅ Traductions utilisées |
| **Sidebar dashboard** | `components/layout/sidebar.tsx` | ✅ `dashboard.nav.*` |
| **Layout dashboard** | `[locale]/(dashboard)/layout.tsx` | ✅ Titres depuis messages |
| **Pages légales** | `[locale]/(marketing)/legal/*` | ✅ Contenu selon locale (fr / en) — à étendre en es si besoin |

---

## 3. Ce qui n’est pas (ou pas entièrement) traduit

### 3.1 Pages **sans** segment `[locale]` (hors i18n)

Ces pages sont servies sans préfixe de langue et contiennent du **français en dur** :

| Page | Route | Contenu non traduit |
|------|--------|----------------------|
| **Choix de plan** | `/choose-plan` | Formulaire (nombre de produits, canaux, raison sociale, adresse, code postal, ville, email facturation, paiement Stripe) |
| **Onboarding** | `/onboarding` | Étapes, labels (Raison sociale, Adresse, Code postal, Sources, Flux d’export), messages d’erreur |
| **Inscription** | `/register` | Titre « Créer un compte », bouton « Créer mon compte », « Voir les tarifs » |

**Recommandation :** Soit déplacer ces pages sous `[locale]` et utiliser les messages, soit garder en français si c’est un flux post-login ciblé FR.

---

### 3.2 Dashboard sous `[locale]` — textes en dur

Les pages sous `app/[locale]/(dashboard)/` utilisent déjà `useTranslations("dashboard")` pour une partie des textes, mais il reste des **chaînes en français** non passées par les messages.

#### **Dashboard (page d’accueil)** — `[locale]/(dashboard)/dashboard/page.tsx`

- « Dernier import », « Source / synchronisation »
- « Produits importés », « Total catalogue »
- « Score moyen », « Bon » / « À améliorer » / « À optimiser »
- « +X sur 30j », « Synchros réussies », « 10 derniers runs »
- « Évolution du score (30 jours) », « L’évolution s’affichera après les prochaines synchronisations »
- « Enrichissement IA », « Titres optimisés », « Descriptions enrichies », « Couverture titres »
- « Résumé », « sources », « flux », « Actions rapides »
- « Ajouter une source », « Optimiser avec l’IA », « Exporter un flux »
- « Erreur » (dans le catch)
- Autres libellés (tableau dernières synchros, etc.)

#### **Flux** — `[locale]/(dashboard)/flux/page.tsx`

- Statuts : « Actif », « Erreur », « En attente », « Inactif »
- « Limite atteinte : X canal(s) utilisé(s)… », « Total : X produits »
- « Connexion... », « Connecter Google », « Connecter Amazon »
- « Synchronisation en cours », « Aucun flux actif », « Aucun flux »
- « Chargement des flux… »
- Messages d’erreur (alert) : « Erreur connexion Amazon », « Erreur lors de la connexion GMC », etc.

#### **Sources** — `[locale]/(dashboard)/sources/page.tsx`

- « Sources connectées », « Flux configurés », « Sélectionnez un connecteur »
- « Import CSV/XML », « Importez via fichier ou URL publique »
- « Flux de sortie cible », « Colonnes non mappées », « Nom de la source * », etc.
- Toasts et messages d’erreur en français

#### **Catalogue** — `[locale]/(dashboard)/catalogue/page.tsx`

- « Produits totaux », « Score global du catalogue », « Scores par dimension »
- « Taux de complétion », « Produits enrichis », « Champs complétés », « Enrichissements IA »
- « Flux », « Sélectionner un flux », « Recherche serveur », « Image », « Prix », « Tous », « Avec image », « Sans image », etc.
- Tri : « Plus récents », « Plus anciens », « Titre A → Z », etc.
- « Enrichissement automatique du catalogue », « Options d’enrichissement »

#### **Admin Comptes** — `[locale]/(dashboard)/admin/accounts/page.tsx`

- « Aucun compte trouvé », « Ne pas modifier la date d’essai »
- « Chargement des comptes… », messages d’erreur

#### **Autres**

- **Onboarding tour** (`components/onboarding/onboarding-tour.tsx`) : titres « Sources de données », « Flux d’export », texte « Prochaine étape » en dur.

---

## 4. Actions recommandées

1. **Conserver l’alignement des messages**  
   À chaque nouvelle clé dans `fr.json`, ajouter la même clé dans `en.json` et `es.json`.

2. **Dashboard (sous [locale])**  
   - Ajouter dans `dashboard.dashboardPage` (et équivalents) les clés manquantes pour la page d’accueil dashboard, les statuts flux, les libellés sources, etc.
   - Remplacer en dur dans les pages sous `[locale]/(dashboard)/` par `t('dashboard...')` (ou namespace dédié).

3. **Pages sans [locale]**  
   - Décider si `/choose-plan`, `/onboarding`, `/register` doivent être multilingues.
   - Si oui : les déplacer sous `[locale]` ou introduire un sélecteur de langue et des namespaces dédiés.

4. **Légal / mentions**  
   - Vérifier que les pages sous `[locale]/(marketing)/legal/*` ont bien du contenu en espagnol (ou fallback) si vous ciblez l’es.

---

## 5. Résumé

| Catégorie | Statut |
|-----------|--------|
| **Messages (fr / en / es)** | ✅ Mêmes 469 clés |
| **Marketing + Tarifs** | ✅ Traduits via messages |
| **Dashboard (sidebar, layout)** | ✅ Traduits |
| **Dashboard (page d’accueil)** | ✅ Traduit (dashboardPage.*) |
| **Flux (page)** | ✅ Traduit (fluxPage.* : statuts, limite, CTA, chargement) |
| **Dashboard (sources, catalogue, admin)** | ⚠️ Partiellement : encore du texte en dur |
| **Pages sans [locale]** (choose-plan, onboarding, register) | ❌ Non traduites (français uniquement) |

Pour que « l’ensemble du site » soit traduit, il faut remplacer les textes en dur des pages sous `[locale]/(dashboard)/` par des clés de traduction et, si besoin, étendre les traductions aux pages actuellement hors `[locale]`.
