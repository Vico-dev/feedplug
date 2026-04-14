# Diffusion des produits dans les LLM — Feeds push

## Contexte : un canal à part entière

La découverte des produits via les chatbots IA (ChatGPT, Perplexity, Gemini, etc.) est un **canal de distribution distinct** des marketplaces classiques (Google Shopping, Amazon, Meta). Les utilisateurs demandent « Où acheter des chaussures de trail ? » directement dans l’IA — les marchands doivent y être présents.

**Périmètre Feedplug :** Les pages produits de nos clients ne sont pas accessibles (et ne doivent pas le rester). On ne gère pas le crawl de leurs sites. Les canaux LLM s’adressent ici uniquement via **feeds push** — envoi des flux produits vers les plateformes.

---

## Paysage des canaux LLM (état 2026)

| Plateforme | Feed push dédié | Format | Statut | Inscription |
|------------|------------------|--------|--------|-------------|
| **ChatGPT** | Oui | JSON, CSV, TSV, XML | Mature, spec officielle | [chatgpt.com/merchants](https://chatgpt.com/merchants) |
| **Perplexity** | Oui | CSV (SFTP ou URL) | Merchant Program actif | Formulaire marchands (grands retailers) |
| **Google Gemini** | Via Merchant API | Content API / Merchant API | Shopping dans Gemini, partenaires Etsy/Wayfair | Google Merchant Center |
| **Claude (Anthropic)** | Non | — | Pas de feed marchand annoncé | — |
| **Meta (IG/FB)** | Via catalog existant | Meta Catalog | Commerce IA sur catalog produit existant | Business Manager |

### Détails par plateforme

- **ChatGPT** : Product Feed Spec officielle, Agentic Commerce Protocol, Instant Checkout (Stripe). Expansion internationale prévue en 2026.
- **Perplexity** : Merchant Program gratuit, feeds CSV via SFTP ou URL, « Buy with Pro » + PayPal/Venmo. Enrichissement des attributs (texture, couleur, matériaux) important pour le matching IA.
- **Google Gemini** : Shopping intégré au chatbot (2026), nouveaux formats « Direct Offers ». Content API for Shopping → Merchant API (successeur officiel, sunset Content API août 2026). Réutilisation du catalog Google Shopping existant.
- **Claude** : Pas d’API feed marchand publique. Utilisé plutôt pour enrichissement produit (descriptions, tags) côté marchand, pas pour la distribution vers un assistant IA grand public.
- **Meta** : Pas de feed IA dédié. Le catalog produit existant alimente Advantage+ et les outils IA de recommandation (GEM, CommerceMM).

### Agentic Commerce Protocol (ACP)

Standard ouvert (Apache 2.0) initié par OpenAI et Stripe. Spécifie les flux commerce entre acheteurs, agents IA et marchands. Pour l’instant principalement adopté par ChatGPT ; d’autres plateformes pourraient s’y rallier à terme.

---

## ChatGPT — Product Feed Spec OpenAI (focus principal)

OpenAI propose une **Product Feed Spec** officielle. Les marchands envoient des flux structurés (JSON, CSV, TSV, XML) vers un endpoint autorisé par HTTPS.

- **Inscription :** [chatgpt.com/merchants](https://chatgpt.com/merchants)
- **Documentation :** [developers.openai.com/commerce/product-feeds](https://developers.openai.com/commerce/product-feeds)
- **Spec détaillée :** [Agentic Commerce Protocol — Product Feed Spec](https://agentic-commerce-protocol.com/docs/commerce/specs/feed)

### Livraison

| Aspect | Détail |
|--------|--------|
| Format | JSON, CSV, TSV ou XML (OpenAI recommande `jsonl.gz` ou `csv.gz`) |
| Transport | HTTPS vers endpoint autorisé (allow-list) |
| Fréquence | Mises à jour acceptées toutes les 15 minutes |
| Modèle | Push par le marchand ; noms de fichiers stables |

---

## Marche à suivre après export Feedplug

Une fois le flux **téléchargé** depuis Feedplug, voici les étapes pour le faire apparaître dans ChatGPT.

### Étape 1 — Postuler au programme marchands

L’accès ChatGPT Shopping est **sur candidature**.

1. Aller sur [chatgpt.com/merchants](https://chatgpt.com/merchants)
2. Remplir le formulaire d’inscription
3. Attendre la réponse d’OpenAI (quelques jours à quelques semaines)

### Étape 2 — Validation et préparation du flux

En attendant la réponse, préparer le flux :

1. **Vérifier le contenu** du fichier exporté :
   - Tous les champs requis sont-ils remplis pour chaque produit ?
   - Les URLs (`url`, `image_url`, `seller_url`, `return_policy`) renvoient-elles bien en HTTP 200 ?
2. **Valider sur un échantillon** : commencer avec ~100 produits pour tester le parsing
3. **Choisir un nom de fichier fixe** : ex. `feed-chatgpt-{marchand}.json` — à garder identique à chaque mise à jour

### Étape 3 — Livrer le flux (après approbation)

Une fois partenaire accepté, OpenAI indique **comment** livrer le flux :

| Option | Description |
|--------|-------------|
| **SFTP** | Envoi vers un serveur SFTP fourni par OpenAI |
| **Upload fichier** | Dépose via une interface dédiée |
| **URL hébergée** | Lien vers un fichier accessible en HTTPS, mis à jour régulièrement |

**Points importants :**
- Garder **le même nom de fichier** à chaque mise à jour (remplacer le contenu)
- Mettre à jour **au moins une fois par jour**
- Formats préférés : `jsonl.gz` ou `csv.gz` (compression gzip)

### Étape 4 — Automatisation (recommandé)

Pour une mise à jour quotidienne sans action manuelle :

1. **Option A** : exporter le flux via l’API Feedplug (`GET /ingestion/feeds/:id/export?platform=chatgpt&format=json`), le compresser en `.gz`, puis le pousser vers SFTP ou une URL hébergée
2. **Option B** : quand Feedplug proposera un **push automatique** vers ChatGPT (après partenariat), configurer une tâche planifiée

### Résumé visuel

```
[Feedplug] → Télécharger flux JSON/CSV
     ↓
[Postuler] → chatgpt.com/merchants
     ↓
[Préparer] → Valider champs, nom fichier stable
     ↓
[Approuvé] → Livrer via SFTP / Upload / URL hébergée
     ↓
[Mettre à jour] → Au moins 1×/jour
```

### Ce que vous pouvez faire dès maintenant (sans approbation)

- **Valider** : vérifier que le JSON/CSV exporté contient bien tous les champs requis
- **Préparer la candidature** : rassembler les infos marchand (seller_url, return_policy, etc.) pour le formulaire
- **Échantillon** : envoyer un flux de ~100 produits avec la candidature si OpenAI le demande
- **Automatisation** : préparer un script/cron qui exporte, compresse (.gz) et pousse vers SFTP/URL une fois par jour

---

## Champs requis (Product Feed Spec)

| Champ | Type | Contraintes | Exemple |
|-------|------|-------------|---------|
| `item_id` | String | Max 100 chars, stable | `SKU12345` |
| `title` | String | Max 150 chars | `Chaussures Trail Homme Noir` |
| `description` | String | Max 5 000 chars, texte seul | `Chaussure imperméable avec semelle absorbant les chocs…` |
| `url` | URL | RFC 1738, HTTP 200 | `https://example.com/produit/SKU12345` |
| `brand` | String | Max 70 chars | `Nike` |
| `image_url` | URL | JPEG/PNG, HTTPS | `https://example.com/image.jpg` |
| `price` | Number + devise | ISO 4217 | `79.99 EUR` |
| `availability` | Enum | `in_stock`, `out_of_stock`, etc. | `in_stock` |
| `group_id` | String | Max 70 chars | `SHOE123GROUP` |
| `listing_has_variations` | Boolean | — | `true` |
| `is_eligible_search` | Boolean | Contrôle l’apparition en recherche | `true` |
| `is_eligible_checkout` | Boolean | Checkout direct (optionnel) | `false` |
| `seller_name` | String | Max 70 chars | `Ma Boutique` |
| `seller_url` | URL | Page marchand | `https://example.com` |
| `return_policy` | URL | Politique de retour | `https://example.com/retours` |
| `target_countries` | List | ISO 3166-1 alpha-2 | `["FR"]` |
| `store_country` | String | Pays du magasin | `FR` |

---

## Bonnes pratiques (OpenAI)

### Contenu
- Descriptions factuelles, concises, en texte ou bullets
- Pas de champs optionnels si les données sont instables
- URLs valides et encodées (ex. espaces → `%20`)

### Variants
- Un `item_id` unique par variant
- Même `group_id` pour les variants liés
- `variant_dict` avec attributs (couleur, taille, etc.)
- Champs `url`, `title`, `description`, `image_url` spécifiques par variant

### Livraison
- Pipeline en snapshot (mise à jour complète, idéalement quotidienne)
- Mêmes noms de fichiers à chaque push
- Rafraîchissement possible toutes les 15 minutes

### Lancement
- `is_eligible_search=true` et `is_eligible_checkout=false` au départ
- Petit échantillon (~100 produits) pour validation avant passage en prod

---

## Intégration dans Feedplug

### Canaux LLM à adresser

| Canal | Priorité | Format feed | Connecteur |
|-------|----------|-------------|------------|
| `chatgpt` | Haute | JSON, CSV, TSV, XML | Push endpoint OpenAI |
| `perplexity` | Moyenne | CSV | SFTP ou URL |
| `gemini` | Via google | Catalog existant | Réutiliser flux GMC si client éligible |

### Canal `chatgpt`

Pour aligner avec les autres canaux (google, meta, amazon, etc.) :

1. **Nouveau canal :** `chatgpt`
2. **Template de feed :** génération JSON (ou CSV/TSV/XML) conforme à la Product Feed Spec OpenAI
3. **Connexion :** push vers l’endpoint OpenAI (après approbation partenaire)

### Mapping Feedplug → Product Feed Spec (ChatGPT)

| Champ Feedplug / source | Champ Product Feed Spec |
|-------------------------|-------------------------|
| `id` / `sku` | `item_id` |
| `title` | `title` |
| `description` | `description` |
| `link` | `url` |
| `brand` | `brand` |
| `image_link` | `image_url` |
| `price` + `currency` | `price` |
| `availability` | `availability` |
| `product_group_id` | `group_id` |
| variants | `listing_has_variations` |

### Flux de travail

```
[Source produit] → [Mapping canal chatgpt] → [Génération feed JSON/CSV/TSV/XML]
                                              ↓
                                    [Push vers endpoint OpenAI]
```

---

## Actions Feedplug

| Priorité | Action |
|----------|--------|
| **Moyen terme** | Ajouter le canal `chatgpt` dans le moteur de règles et les exports |
| **Moyen terme** | Créer un template de feed conforme à la Product Feed Spec OpenAI |
| **Moyen terme** | Explorer le canal `perplexity` (CSV, SFTP/URL) |
| **Long terme** | Postuler à [chatgpt.com/merchants](https://chatgpt.com/merchants) pour l’accès au endpoint et Instant Checkout |
| **Long terme** | Surveiller les annonces Claude / autres LLM pour éventuels feeds marchands |

---

## Références

**ChatGPT / OpenAI**
- [OpenAI Product Feeds](https://developers.openai.com/commerce/product-feeds)
- [OpenAI Product Feeds — Best practices](https://developers.openai.com/commerce/product-feeds/best-practices)
- [OpenAI Product Feed Spec](https://developers.openai.com/commerce/product-feeds/spec)
- [Agentic Commerce Protocol](https://agentic-commerce-protocol.com/)

**Perplexity**
- [Perplexity Merchant Program](https://www.perplexity.ai/) (inscription via formulaire marchands)

**Google Gemini**
- [Content API for Shopping](https://developers.google.com/shopping-content) → [Merchant API](https://developers.google.com/shopping-content) (successeur, sunset Content API août 2026)
