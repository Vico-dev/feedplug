# Formats de sortie – État et reste à faire

## Formats prêts à ce jour

Tous les formats ci‑dessous sont implémentés côté **backend** (route `GET /api/v1/ingestion/feeds/:id/export`) et utilisables depuis la page **Flux** (bouton Export → CSV). Le modal « Nouveau flux d’export » les affiche comme disponibles et redirige vers la page Flux.

| Plateforme | Format | Paramètres API | Page Flux |
|------------|--------|----------------|-----------|
| **Google Merchant Center (GMC)** | CSV | `platform=gmc` | ✅ Google Merchant Center |
| **Bing / Microsoft** | CSV | `platform=bing` | ✅ Bing / Microsoft |
| **Meta (Facebook / Instagram)** | CSV | `platform=meta` | ✅ Meta (Facebook / Instagram) |
| **Pinterest** | CSV | `platform=pinterest` | ✅ Pinterest |
| **TikTok Shop** | CSV | `platform=tiktok` | ✅ TikTok Shop |
| **Snapchat** | CSV | `platform=snapchat` | ✅ Snapchat |
| **Amazon** | CSV | `platform=amazon&channel=amazon_fr|amazon_uk|amazon_de|amazon_it|amazon_es` | ✅ Amazon FR, UK, DE, IT, ES |
| **Cdiscount** | CSV | `platform=cdiscount` | ✅ Cdiscount |
| **Rakuten** | CSV | `platform=rakuten` | ✅ Rakuten |
| **Yandex Market** | CSV | `platform=yandex` | ✅ Yandex Market |
| **Baidu** | CSV | `platform=baidu` | ✅ Baidu |
| **ChatGPT (Product Feed Spec)** | JSON ou CSV | `platform=chatgpt&format=json|csv` | ✅ ChatGPT (JSON) / ChatGPT (CSV) |
| **Perplexity** | CSV | `platform=perplexity` | ✅ Perplexity |
| **Google Gemini** | CSV | `platform=gemini` | ✅ Google Gemini |

- **Mapping à la source** : Sur la page Sources, vous pouvez choisir la « cible » du mapping (GMC, Meta, Amazon ou Tous) pour afficher les champs attendus par chaque plateforme. Les données restent en format canonique ; l’export adapte le format à la plateforme.
- **Règles & A/B** : Les règles d’optimisation et tests A/B (titres, descriptions, images) sont appliqués à l’export pour les canaux concernés (GMC, Meta, Amazon, ChatGPT, Bing, Pinterest, TikTok, Snapchat, Yandex, Baidu, Perplexity, Gemini).
- **Push** : En plus de l’export fichier, un **Push GMC** et un **Push Amazon** sont disponibles sur la page Flux lorsque les connexions sont configurées.

---

## Reste à faire (optionnel)

### 1. Affiner les formats par plateforme

Les colonnes et normes (disponibilité, condition, etc.) sont alignées sur les specs courantes. Pour certaines plateformes (TikTok, Yandex, Baidu, Perplexity, Gemini), les specs officielles évoluent : à mettre à jour si une plateforme rejette le fichier ou exige des champs supplémentaires.

### 2. Améliorations optionnelles

- **Documentation** : Pour chaque format, un lien vers la spec officielle dans la doc ou l’UI.
- **Validation** : Vérification des champs requis par plateforme avant export (ex. Meta exige au moins un parmi brand/gtin/mpn) et message clair si des produits sont incomplets.
- **Export programmé** : Génération et envoi automatique des fichiers (URL ou push) vers les plateformes selon une fréquence (quotidien, etc.), en plus du téléchargement manuel actuel.

---

## Récapitulatif

- **Prêts** : 14 formats (GMC, Bing, Meta, Pinterest, TikTok, Snapchat, Amazon multi‑marchés, Cdiscount, Rakuten, Yandex, Baidu, ChatGPT JSON/CSV, Perplexity, Gemini), accessibles depuis la page Flux et marqués disponibles dans le modal « Nouveau flux d’export ».
- **Optionnel** : Affiner les specs par plateforme si besoin, documentation des specs, validation pré‑export, export programmé.
