# SEO FeedPlug

## Mise en place (février 2025)

### ✅ Implémenté

- **Images OG/Twitter** : Génération dynamique à `/og-image` (1200×630) et `/logo` (200×200) pour les partages sociaux et le schéma Organization
- **Métadonnées** : Home, doc et sous-pages avec title, description, keywords, Open Graph, Twitter cards
- **JSON-LD** : Organization (avec sameAs), WebSite, FAQPage sur la home ; BreadcrumbList sur les pages doc
- **Hreflang** : fr/en avec canonicals
- **Sitemap** : `/sitemap.xml` avec home et pages doc
- **robots.txt** : Règles d’indexation
- **Noindex** : login, register, forgot-password, reset-password
- **Page 404** : Page custom avec liens vers Accueil et Documentation
- **Redirect www** : www.feedplug.com → feedplug.com (301)
- **LP problématiques** : Landing pages par canal — Google Shopping, Amazon, Rakuten, Cdiscount (`/optimiser-flux-*`)

### Images personnalisées

Pour utiliser vos propres visuels, ajoutez-les dans `frontend/public/` puis mettez à jour `frontend/src/lib/seo.ts` :

1. **`og-image.png`** (1200×630 px) — prévisualisation sur réseaux sociaux  
   → `ogImage: \`${siteUrl}/og-image.png\``
2. **`logo.png`** (min. 112×112 px) — logo pour Google (schéma Organization)  
   → `logo: \`${siteUrl}/logo.png\``

Sans ces fichiers, les routes dynamiques `/og-image` et `/logo` servent des images par défaut.

### Configuration

Le fichier `frontend/src/lib/seo.ts` centralise :

- `seo.siteUrl` : URL de base du site
- `seo.ogImage` : URL de l’image OG
- `seo.logo` : URL du logo
- `seo.socialUrls` : Liens réseaux sociaux (LinkedIn, Twitter, etc.) pour le schéma Organization `sameAs`
- `createDocMetadata()` : helper pour les pages de documentation
