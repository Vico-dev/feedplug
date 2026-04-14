# Audit SEO & visibilité moteurs LLM — FeedPlug

> Audit réalisé en février 2025

---

## 1. SEO classique — ce qui est en place

### ✅ Bien couvert

| Élément | Statut | Détail |
|--------|--------|--------|
| **Métadonnées** | ✅ | Title, description, keywords sur home, LP, docs |
| **Open Graph** | ✅ | Images, title, description, url sur toutes les pages indexables |
| **Twitter Cards** | ✅ | summary_large_image sur les pages marketing |
| **Canonical** | ✅ | URLs canoniques sur home (hreflang) et LP |
| **Hreflang** | ✅ | Home et LP (Google Shopping, Amazon, Rakuten, Cdiscount, Diffusion canaux) : fr, en, x-default |
| **Sitemap** | ✅ | `/sitemap.xml` — home, LP, docs |
| **robots.txt** | ✅ | Allow /, disallow login/register/api/oauth, sitemap |
| **Noindex** | ✅ | login, register, forgot-password, reset-password |
| **Redirect www** | ✅ | www.feedplug.com → feedplug.com (301) |
| **Page 404** | ✅ | Page custom avec liens Accueil, Docs |

### JSON-LD (Schema.org)

| Schéma | Où | Statut |
|--------|-----|--------|
| **Organization** | Home | ✅ + sameAs, logo, description |
| **WebSite** | Home | ✅ + SearchAction vers /docs |
| **FAQPage** | Home | ✅ 6 questions (flux, optimisation, marketplaces, etc.) |
| **BreadcrumbList** | LP, Docs | ✅ |
| **HowTo** | LP (5 pages canal + diffusion) | ✅ |

### Points d’attention

1. ~~**LP sans hreflang**~~ ✅ **Corrigé** — Les LP (Google Shopping, Amazon, Rakuten, Cdiscount, Diffusion canaux) ont des versions FR et EN avec hreflang (fr, en, x-default). URLs : /optimiser-flux-* (FR) et /en/optimiser-flux-* (EN).

2. **Docs sans locale** — `/docs`, `/docs/faq` : pas de préfixe /fr. Idem si c’est voulu.

---

## 2. Visibilité moteurs LLM (ChatGPT, Perplexity, Gemini)

### GEO (Generative Engine Optimization)

Les moteurs LLM (ChatGPT Search, Perplexity, etc.) privilégient :
- Données structurées (JSON-LD)
- Contenu explicite et bien organisé
- FAQ en format Q&A
- Autorité du domaine (backlinks, E-E-A-T)
- Contenu assez long (1500–2900+ mots pour de meilleures citations)

### ✅ Déjà en place

| Signal | Statut |
|--------|--------|
| **Organization + WebSite** | ✅ Identité claire pour les LLM |
| **FAQPage (home)** | ✅ 6 Q&R utilisables pour citations |
| **BreadcrumbList** | ✅ Hiérarchie et contexte |
| **Sitemap** | ✅ Découverte des URLs |
| **Structure HTML** | ✅ H1, sections, contenu lisible |
| **Canonical / noindex** | ✅ Pas de duplication parasite |

### Manques pour les LLM

| Manque | Impact | Priorité |
|--------|--------|----------|
| **FAQPage sur /docs/faq** | ✅ **Corrigé** — FAQPage JSON-LD ajouté avec les 12 Q&R. | — |
| **SoftwareApplication** | ✅ **Corrigé** — Schéma sur la home (nom, catégorie, description). | — |
| **FAQ home enrichie** | ✅ **Corrigé** — 6 questions (Google, Amazon, Cdiscount/Rakuten, flux, marketplaces, nouveaux canaux). | — |
| **LP + HowTo** | ✅ **Corrigé** — LP enrichies (cas d'usage, FAQ), schémas HowTo sur toutes les LP. | — |
| **Page À propos** | Pas de page /about ou /apropos pour E-E-A-T. | Moyenne |

---

## 3. Recommandations prioritaires

### P0 — Rapide

1. ~~**Ajouter FAQPage sur /docs/faq**~~ ✅ **Fait** — FAQPage JSON-LD avec les 12 Q&R (source partagée : `lib/faq-docs.ts`).

### P1 — Court terme

2. **Page À propos** — Créer `/apropos` ou `/about` avec : qui vous êtes, mission, équipe, contact. Renforce E-E-A-T.

3. ~~**Schéma SoftwareApplication**~~ ✅ **Fait** — Sur la home.

4. ~~**Enrichir la FAQ home**~~ ✅ **Fait** — 6 questions (fr + en).

### P2 — Moyen terme

5. ~~**Contenu des LP**~~ ✅ **Fait** — Allonger les LP à 1200–1500 mots (cas d’usage, exemples, FAQ intégrée) pour de meilleures citations LLM.

6. ~~**Schémas HowTo**~~ ✅ **Fait** — HowTo sur toutes les LP.

---

## 4. Checklist rapide par type de page

| Page | Title | Description | OG | Canonical | JSON-LD | Noindex |
|------|-------|-------------|-----|-----------|---------|---------|
| Home /fr, /en | ✅ | ✅ | ✅ | ✅ | Org, Web, FAQ | — |
| LP Google Shopping | ✅ | ✅ | ✅ | ✅ fr/en | Breadcrumb, HowTo, hreflang | — |
| LP Amazon | ✅ | ✅ | ✅ | ✅ fr/en | Breadcrumb, HowTo, hreflang | — |
| LP Rakuten | ✅ | ✅ | ✅ | ✅ fr/en | Breadcrumb, HowTo, hreflang | — |
| LP Cdiscount | ✅ | ✅ | ✅ | ✅ fr/en | Breadcrumb, HowTo, hreflang | — |
| LP Diffusion canaux | ✅ | ✅ | ✅ | ✅ fr/en | Breadcrumb, HowTo, hreflang | — |
| Docs (toutes) | ✅ | ✅ | ✅ | ✅ | Breadcrumb | — |
| Docs /faq | ✅ | ✅ | ✅ | ✅ | Breadcrumb | — |
| Login, Register | — | — | — | — | — | ✅ |

---

## 5. Résumé

- **SEO classique** : Bien structuré, métadonnées et schémas en place sur les pages principales. LP en FR + EN avec hreflang (fr, en, x-default).
- **LLM** : Organization, WebSite, SoftwareApplication, FAQPage (home 6 questions + docs/faq 12 Q&R), HowTo et BreadcrumbList sur les 5 LP. Contenu bilingue pour citations.
- **Restant (optionnel)** : Page À propos pour E-E-A-T.
