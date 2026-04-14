# Récupération des images produits (anti-403)

Beaucoup de marchands et CDN bloquent les requêtes qui n’ont pas l’en-tête **Referer** de leur domaine (protection anti-hotlink). On doit pouvoir récupérer les images partout : front, flux, lifestyle, batch.

## 1. Referer sur l’URL image

Lors de tout téléchargement d’image par URL :

- **Sans page produit** : on utilise l’**origin de l’URL image** comme Referer (ex. `https://cdn.merchant.com/`).
- **Avec page produit** : on utilise l’**origin de la page produit** (ex. `https://www.boutique.fr`) pour maximiser les chances que le CDN accepte.

C’est géré dans `optimization/lifestyle-image-generator.js` :

- `downloadImageAsBase64(url, { refererOrigin })` : si `refererOrigin` est fourni, il est utilisé comme Referer ; sinon c’est l’origin de `url`.
- User-Agent type Chrome pour ressembler à un navigateur.

## 2. API lifestyle : productPageUrl

`POST /api/v1/enrichment/generate-lifestyle-image`

Body possible :

- `imageUrl` ou `imageBase64`
- `productPageUrl` (optionnel) : URL de la page produit (ex. lien du flux). Le backend en déduit `refererOrigin` et l’envoie en Referer lors du téléchargement de l’image.

Le front envoie `product?.url ?? product?.link` en `productPageUrl` pour que le backend puisse contourner l’anti-hotlink.

## 3. Proxy image (usage universel)

`POST /api/v1/enrichment/proxy-image`

- **Body** : `{ imageUrl, productPageUrl? }`
- **Comportement** : télécharge l’image avec Referer (origin de `productPageUrl` ou de `imageUrl`), la stocke en GCS (`proxy/<accountId>/<hash>.ext`), renvoie une **URL signée** (24 h).
- **Usage** : partout où on a besoin d’une URL d’image “qui marche” (affichage front, flux, batch, autre backends). Un seul appel par (imageUrl, referer) ; les suivants peuvent réutiliser le même fichier GCS (même hash).

Exemple :

```json
POST /api/v1/enrichment/proxy-image
{ "imageUrl": "https://cdn.merchant.com/img/123.jpg", "productPageUrl": "https://www.merchant.com/product/123" }
→ { "url": "https://storage.googleapis.com/...?X-Goog-Signature=...", "contentType": "image/jpeg" }
```

## 4. Frontend

- **Lifestyle** : envoi de `productPageUrl` (url / link du produit) dans la requête generate-lifestyle-image.
- **Image produit dans le drawer** : si l’image ne charge pas (`onError`), le front appelle `proxy-image` avec l’URL image et l’URL de la page produit, puis affiche l’URL signée renvoyée.

## 5. Flux / batch

Pour tout traitement qui a besoin du fichier image (ingestion, scoring, export, etc.) :

- Soit utiliser `downloadImageAsBase64(imageUrl, { refererOrigin })` (module `lifestyle-image-generator`) en passant l’origin de la page produit si disponible (ex. `item.url` ou `item.link`).
- Soit appeler l’API `proxy-image` (avec auth) et utiliser l’URL signée retournée pour télécharger ou afficher l’image.
