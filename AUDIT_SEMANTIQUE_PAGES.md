# Audit sémantique des pages — FeedPlug

**Objectif** : identifier les lacunes de contenu et de sémantique qui limitent le positionnement sur les moteurs de recherche, et prioriser les actions.

**Périmètre** : pages indexables (home FR/EN, documentation /docs et sous-pages). Exclus : app (dashboard, login, etc.).

---

## 1. Synthèse

| Problème | Impact | Priorité |
|----------|--------|----------|
| Volume de texte faible sur la home (peu de paragraphes longs) | Google privilégie les pages qui répondent en profondeur à une intention | P1 |
| Docs : ~300–600 mots/page, peu de variantes et de long tail | Pages doc peu compétitives sur des requêtes ciblées | P1 |
| Peu de contenu dédié marketplaces (Amazon, Cdiscount, Mirakl) dans le corps des pages | Requêtes "flux Amazon", "export Cdiscount" non couvertes | P1 |
| Pas de blog ni de pages comparatives (vs Lengow, Channable) | Long tail et requêtes alternatives non captées | P2 |
| Page /docs : contenu minimal (H1 + liens) | Pas de texte riche pour "documentation feed produits", "guide flux" | P2 |
| Glossaire et FAQ doc : bons signaux mais isolés, pas de maillage thématique fort | Sous-exploitation du potentiel sémantique | P3 |

---

## 2. État des lieux par type de page

### 2.1 Home (/, /fr, /en)

**Structure** : H1 (hero) → description → ligne canaux → formulaire → Problème (H2) → Fonctionnalités (H2, 4 blocs) → Valeur (H2) → Expansion (H2, 2 blocs + cas d’usage) → Fonctionnalités avancées (H2, 3 blocs + bénéfices) → FAQ (H2, 3 Q/R) → CTA.

**Points positifs**
- Métadonnées (title, description, keywords) et JSON-LD (Organization, WebSite, FAQPage) en place.
- Mots-clés head présents (flux produits, Google Merchant Center, marketplaces, Amazon) dans le title, la description et la ligne canaux.
- Une FAQ dédiée avec schéma FAQPage.
- Structure H1/H2 claire.

**Lacunes sémantiques**
- **Peu de texte continu** : la majorité du contenu est en courtes phrases, listes à puces et titres. Peu de paragraphes de 80–150 mots qui développent un sujet (ex. "Pourquoi centraliser ses flux produits", "Comment FeedPlug simplifie l’export vers Google et les marketplaces").
- **Variantes et synonymes limités** : "gestion flux produits", "feed produits", "catalogue produits", "export multi-canal", "optimisation feed" pourraient être davantage déclinés dans le corps de page.
- **Intention "comment faire" peu servie** : une seule question FAQ "Comment optimiser mon feed Google Shopping ?". Pas de bloc dédié "Comment ça marche" ou "En 3 étapes" avec du texte riche.
- **Données / preuves absentes** : aucun chiffre (ex. "réduction des erreurs", "temps gagné") ni citation qui renforceraient la pertinence et la citabilité (GEO).

**Volume texte estimé (corps, hors formulaire/nav)** : ~600–800 mots. Pour une home cible "solution B2B", 800–1 500 mots de texte structuré sont souvent un minimum pour bien ranker sur des requêtes génériques.

---

### 2.2 Documentation — page d’index (/docs)

**Structure** : H1 "Documentation FeedPlug" → 1 paragraphe (2 lignes) → liste de liens vers les sous-pages (titre + courte description par lien).

**Métadonnées** : title "Documentation", description et keywords corrects (feed produit, Google Merchant Center, etc.), canonical OK.

**Lacunes**
- **Contenu textuel minimal** : ~50 mots de corps. La page ne répond pas en profondeur aux requêtes "documentation feed produits", "guide gestion flux produits", "aide Google Merchant Center".
- **Aucun H2 thématique** : pas de blocs "Pour commencer", "Sources et import", "Export et canaux", etc. avec 2–3 phrases chacun pour enrichir la sémantique et le maillage interne.
- **Opportunité** : ajouter 2–3 paragraphes (150–250 mots) présentant la doc (pour qui, quoi : import, optimisation, export Google / marketplaces) et des ancres vers les pages clés.

---

### 2.3 Documentation — sous-pages (/docs/sources, /docs/export, etc.)

**Pages auditées** : Sources, Export, Score, Glossaire, FAQ, Démarrage, Catalogue (et autres via les layouts).

**Points communs**
- Chaque page a un **H1**, un **chapô** (1 paragraphe), puis **4–6 H2** avec 1–3 paragraphes ou listes par section.
- **Métadonnées** : title, description, keywords par page (createDocMetadata), canonical, OG.
- **Liens internes** : présents (vers /docs/score, /docs/export, etc.).

**Volume moyen** : ~350–550 mots par page (sources, export, score, etc.). Pour des requêtes comme "importer flux produits Shopify", "exporter vers Google Merchant Center", des pages de 600–1 000 mots avec sous-H3 et variantes sont plus compétitives.

**Lacunes par thème**

| Page | Lacunes sémantiques |
|------|----------------------|
| **/docs/sources** | Peu de variantes ( "connexion Shopify", "import catalogue", "synchronisation flux"). Aucune mention des marketplaces comme source future. |
| **/docs/export** | Google Merchant Center et Google Shopping bien présents ; **marketplaces (Amazon, Cdiscount, Mirakl) seulement évoquées en "arrivent prochainement"**. Pas de section "Export vers les marketplaces" ni de mots-clés "flux Amazon", "export Cdiscount", "feed marketplace". |
| **/docs/score** | Bonne densité "score", "qualité", "conformité GMC". Manque : "score qualité feed", "audit feed Google Shopping", "améliorer son feed". |
| **/docs/glossaire** | Définitions utiles (flux produit, GMC, GTIN, etc.) mais **pas de texte d’introduction riche** (50+ mots) ni de variantes (ex. "feed produit", "product feed", "flux catalogue"). |
| **/docs/faq** | Bonne couverture (connexion, synchro, score, GMC, IA). Peu de questions orientées "marketplace" ou "multi-canal". |
| **/docs/demarrage** | Étapes claires ; peu de texte explicatif autour de chaque étape (pourquoi, bénéfice). |
| **/docs/catalogue** | Vue d’ensemble correcte ; manque de liens avec "optimisation catalogue", "enrichissement catalogue". |

**Manques transversaux**
- **Aucun H3** : les pages restent à 2 niveaux (H1 → H2). Des H3 permettent de cibler des long tails (ex. "Format du flux Google Merchant Center", "Fréquence de mise à jour du feed").
- **Synonymes et variantes** : peu de répétition naturelle de "feed", "flux produit", "catalogue", "export", "canal", "marketplace", "Google Shopping", "GMC" dans le corps.
- **Une seule langue** : la doc est en français uniquement ; pas de version /en/docs pour le SEO EN.

---

### 2.4 Pages absentes (stratégie SEO)

D’après la stratégie SEO/GEO déjà définie, les pages suivantes sont **recommandées mais absentes** :

- **/tarifs** (ou /pricing) : intention "FeedPlug prix", "tarif feed".
- **/fonctionnalites** (ou /features) : page dédiée "fonctionnalités" avec blocs texte (optimisation, distribution, score, marketplaces).
- **/pourquoi-feedplug** : différenciation "simple, data-centric", cas d’usage.
- **/integrations** ou **/marketplaces** : liste des canaux (Google, Meta, Amazon, Cdiscount, Mirakl, Fnac) avec 1–2 phrases par canal ; cible "flux Amazon", "export Cdiscount", etc.
- **/blog** : aucun article ; pas de capture du long tail ("comment optimiser son feed Google Shopping", "erreurs Google Merchant Center", "alternative Lengow").
- **Pages comparatives** : /feedplug-vs-lengow, /feedplug-vs-channable (forte intention, peu de concurrence sur des requêtes "alternative X").

---

## 3. Recommandations prioritaires

### P1 — Enrichir le contenu existant (rapide)

1. **Home**
   - Ajouter **un bloc "Comment ça marche"** (ou "En 3 étapes") avec 2–3 paragraphes de 60–100 mots : centraliser → optimiser (score, IA) → distribuer (Google, Meta, marketplaces). Y intégrer les variantes : "flux produits", "feed", "catalogue", "export multi-canal", "Google Merchant Center", "marketplaces".
   - Enrichir **une section "Pourquoi FeedPlug"** (ou étendre la section Valeur) avec 1–2 paragraphes sur la simplicité, la data et la couverture canaux (SEA + marketplaces).
   - Si possible : **1 chiffre ou témoignage** (ex. "X % de réduction des erreurs", "opérationnel en moins de Y minutes") pour renforcer E-E-A-T et GEO.

2. **/docs (index)**
   - Ajouter **2–3 paragraphes** (150–250 mots) sous le H1 : à qui s’adresse la doc, quoi y trouver (importer, optimiser, scorer, exporter vers Google Shopping et marketplaces), avec liens vers Sources, Export, Score, Glossaire.
   - Ajouter **2–3 H2** ("Pour commencer", "Export et canaux", "Référence") avec 2–4 phrases chacun + liens internes.

3. **/docs/export**
   - Ajouter une **section "Export vers les marketplaces"** (même si "bientôt") : expliquer que FeedPlug prépare les exports vers Amazon, Cdiscount, Mirakl, Fnac, et que le même catalogue alimente Google et les marketplaces. Intégrer les expressions "flux marketplace", "feed Amazon", "export Cdiscount", "catalogue multi-canal".
   - Enrichir la section "Format des flux" avec 1–2 phrases sur les attributs (title, description, image, prix, availability, condition) pour renforcer "conformité Google Merchant Center" et "feed XML".

### P2 — Nouvelles pages et structure

4. **Page /fonctionnalites** (ou intégrer dans la home)
   - Une page dédiée avec H1 "Fonctionnalités" et blocs (Optimisation, Distribution, Score, Alertes) avec 80–120 mots par bloc. Mention explicite "Google, Meta, Amazon et marketplaces".

5. **Page /integrations** ou **/marketplaces**
   - Liste des canaux (Google Shopping, GMC, Meta, Amazon, Cdiscount, Mirakl, Fnac) avec pour chacun 2–4 phrases (à quoi ça sert, comment FeedPlug s’intègre). Cible directe des requêtes "flux Amazon", "export Cdiscount", "feed marketplace".

6. **Blog (minimum 2–3 articles)**
   - "Comment optimiser son feed Google Shopping en 2025" (800–1 200 mots).
   - "Erreurs Google Merchant Center : causes et solutions" (600–900 mots).
   - "Flux produits et marketplaces : bonnes pratiques" (500–800 mots).

### P3 — Approfondissement

7. **Docs : ajouter des H3** sur les pages les plus stratégiques (Export, Score, Sources) pour cibler des long tails (ex. "Fréquence de mise à jour du flux", "Champs obligatoires Google Merchant Center").

8. **Glossaire** : ajouter 2–3 termes (ex. "Marketplace", "Feed XML", "Product feed") et un paragraphe d’intro de 60–80 mots avec variantes.

9. **Pages comparatives** : créer /feedplug-vs-lengow et /feedplug-vs-channable (tableau + 2–3 paragraphes par page, honnêtes).

10. **Doc en anglais** : si le marché EN est visé, dupliquer la doc sous /en/docs (ou [locale]/docs) avec hreflang.

---

## 4. Métriques à suivre (post-modifications)

- **Volume de mots** : viser ~1 000+ mots sur la home (corps), 600–1 000 sur les docs clés (Export, Score, Sources), 150–250 sur /docs index.
- **Mots-clés** : dans Search Console, suivre les requêtes cibles (flux produits, feed Google Shopping, Google Merchant Center, flux marketplace, feed Amazon, etc.) et les positions.
- **Indexation** : nombre d’URLs indexées, erreurs de couverture.
- **Rich results** : présence des FAQ en extraits sur la home.

---

*Audit sémantique FeedPlug — à combiner avec la stratégie SEO/GEO (STRATEGIE_SEO_GEO_FEEDPLUG.md) et l’audit technique (AUDIT_SEO_FEEDPLUG.md).*
