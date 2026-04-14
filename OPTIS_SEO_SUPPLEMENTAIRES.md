# Optimisations SEO supplémentaires — FeedPlug

Idées pour continuer à faire monter le SEO après les recos déjà appliquées (métadonnées home, FAQ, JSON-LD, sitemap, Comment ça marche, Pourquoi FeedPlug, enrichissement /docs et /docs/export).

---

## Impact fort / à prioriser

### 1. Blog + 2–3 articles (long tail + autorité)
- **Pourquoi** : capte "comment optimiser son feed Google Shopping", "erreurs Google Merchant Center", "feed rejeté", "flux marketplace bonnes pratiques" — requêtes à fort volume ou forte intention.
- **Quoi** : créer `/blog` (ou `/fr/blog`) avec 2–3 articles :
  - "Comment optimiser son feed Google Shopping en 2025" (800–1 200 mots)
  - "Erreurs Google Merchant Center : causes et solutions"
  - "Flux produits et marketplaces : bonnes pratiques"
- **Technique** : une page listing + pages `/blog/[slug]`, métadonnées + JSON-LD Article par article, liens internes vers home et /docs/export, /docs/score.

### 2. Page /tarifs (intention "FeedPlug prix")
- **Pourquoi** : requête à forte intention d’achat, souvent en top 3 des recherches marque.
- **Quoi** : une page dédiée avec titres des offres (Starter, Pro, Enterprise), avantages, CTA démo. Mots-clés : "FeedPlug prix", "tarif feed produits", "coût gestion flux".
- **Bonus** : schéma FAQPage si tu mets une mini-FAQ (ex. "Comment est facturé FeedPlug ?").

### 3. Pages comparatives (alternatives Lengow / Channable)
- **Pourquoi** : "alternative Lengow", "FeedPlug vs Channable" = très forte intention, peu de concurrence sur des requêtes longues.
- **Quoi** : `/feedplug-vs-lengow` et `/feedplug-vs-channable` (ou `/comparatif-lengow`). Tableau comparatif honnête (fonctionnalités, prix, simplicité) + 2–3 paragraphes + CTA.
- **Risque** : à faire avec tact (pas de dénigrement), pour rester crédible et partageable.

### 4. Page /integrations ou /marketplaces
- **Pourquoi** : cible directe "flux Amazon", "export Cdiscount", "feed marketplace", "connecteur Shopify feed".
- **Quoi** : une page listant les canaux (Google Shopping, GMC, Meta, Amazon, Cdiscount, Mirakl, Fnac, Rakuten, Shopify) avec 2–4 phrases par canal + lien vers /docs/export. Title/description dédiés.

### 5. Lien interne home → docs (ancres thématiques)
- **Pourquoi** : renforce le maillage et la pertinence des pages doc, fait remonter un peu de "jus" vers les guides.
- **Quoi** : dans le bloc "Comment ça marche" (étape Distribuez), ajouter un lien "Voir le guide Export et flux" vers `/docs/export`. Dans "Optimisez", un lien "Score FeedPlug" vers `/docs/score`. Optionnel : en bas de la home, un bloc "Ressources" avec liens vers /docs, /docs/demarrage, /docs/faq.

---

## Impact moyen / bon rapport effort–gain

### 6. Chiffre ou preuve sur la home (E-E-A-T + GEO)
- **Pourquoi** : un chiffre concret ("réduction des rejets", "temps de mise en place") améliore la confiance et la citabilité dans les réponses IA.
- **Quoi** : une phrase du type "Nos utilisateurs mettent en place leur premier flux en moins de 15 minutes" ou "Réduction typique des rejets Google après optimisation" (à adapter selon tes vrais chiffres). À placer dans "Pourquoi FeedPlug" ou en encadré.

### 7. Breadcrumbs sur les pages doc (JSON-LD + affichage)
- **Pourquoi** : meilleure compréhension du site par Google, parfois affichage en SERP (breadcrumb).
- **Quoi** : schéma BreadcrumbList sur chaque page doc (Accueil > Documentation > Export et flux). Optionnel : affichage visuel en haut de la page doc.

### 8. Dernière mise à jour sur les pages doc
- **Pourquoi** : signal de fraîcheur pour Google et utilisateurs.
- **Quoi** : une ligne "Dernière mise à jour : [date]" en bas de chaque page doc (ou dans le layout). Optionnel : `lastmod` déjà dans le sitemap — cohérent si tu mets à jour le contenu.

### 9. Enrichir la FAQ home (1–2 questions de plus)
- **Pourquoi** : plus de chances d’apparaître en extrait FAQ en SERP et dans les réponses IA.
- **Quoi** : ajouter par exemple "Pourquoi choisir FeedPlug plutôt qu’un tableur ?" et "FeedPlug gère-t-il les marketplaces ?" (si pas déjà couvert). Mettre à jour le JSON-LD FAQPage en conséquence.

### 10. Page /fonctionnalites
- **Pourquoi** : page dédiée "fonctionnalités" pour les requêtes "logiciel flux produits", "fonctionnalités feed".
- **Quoi** : H1 "Fonctionnalités", blocs (Centralisation, Optimisation, Score, Distribution, Marketplaces) avec 80–120 mots par bloc, liens vers /docs.

---

## Technique / crawl / perfs

### 11. Core Web Vitals
- **Quoi** : vérifier LCP, CLS, INP sur la home et /docs (Lighthouse ou PageSpeed Insights). Utiliser `next/image` pour toutes les images avec width/height. Éviter les polices ou scripts bloquants.
- **Impact** : facteur de classement et UX.

### 12. Sitemap : ajouter les nouvelles URLs
- **Quoi** : dès que tu crées /tarifs, /blog, /integrations, pages comparatives, les ajouter dans `frontend/src/app/sitemap.ts` avec une priorité et une fréquence adaptées.

### 13. Schéma SoftwareApplication (optionnel)
- **Quoi** : ajouter un JSON-LD SoftwareApplication sur la home (nom, description, applicationCategory, offre). Peut aider pour les requêtes "logiciel", "app feed produits".

---

## Autorité / netlinking (hors site)

- **Avis** : inciter les clients à laisser un avis sur G2, Capterra, Google. Les profils + avis renvoient souvent du trafic et renforcent la marque.
- **Presse / partenaires** : un communiqué ou un article invité (e-commerce, retail) avec un lien vers feedplug.com.
- **Répertoires SaaS** : s’inscrire dans des listes "meilleur outil feed produits", "alternatives Lengow" (avec votre URL).

---

## Récap par priorité

| Priorité | Action | Effort estimé |
|----------|--------|----------------|
| 1 | Blog + 2–3 articles | Moyen (rédaction + structure) |
| 2 | Page /tarifs | Faible |
| 3 | Pages comparatives (vs Lengow, Channable) | Moyen |
| 4 | Page /integrations ou /marketplaces | Faible |
| 5 | Liens internes home → docs | Faible |
| 6 | Chiffre / preuve sur la home | Faible |
| 7 | Breadcrumbs doc + dernière MAJ | Faible |
| 8 | FAQ home + JSON-LD | Faible |
| 9 | Page /fonctionnalites | Moyen |
| 10 | CWV + sitemap + SoftwareApplication | Faible à moyen |

En enchaînant d’abord 4, 5, 6 et 8 (effort faible), tu renforces déjà la sémantique et le maillage. En parallèle, préparer le blog et les pages comparatives donne le plus de marge pour "faire péter" le SEO sur le long terme.
