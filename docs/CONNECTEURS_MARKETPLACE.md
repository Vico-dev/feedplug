# Connecteurs marketplace — Push API automatique

> Remplacer le flow CSV manuel par des connecteurs OAuth/API qui poussent les produits directement vers les plateformes cibles.

---

## État actuel vs cible

| Plateforme | Actuel | Cible |
|------------|--------|-------|
| **Google Merchant Center** | ✅ OAuth + Push Content API | ✅ Déjà connecteur complet |
| **Amazon** | Export CSV manuel | Connecteur OAuth SP-API + Push Listings/Feeds |
| **Cdiscount** | Export CSV manuel | Connecteur Octopia REST API (clientId + clientSecret) |
| **Rakuten** | Export CSV manuel | Connecteur webservice (login + token) + push fichier |

---

## 1. Amazon — Connecteur SP-API ✅

**Implémenté (février 2026) :**
- OAuth LWA : auth-url, connect-init, connect (cookie), login, callback
- Connexion manuelle : `POST /platforms/amazon/connect` avec `{ refresh_token, seller_id }`
- `POST /api/v1/platforms/amazon/push/:feedId?channel=amazon_fr` (Listings Items API)
- Frontend : carte « Connecter Amazon », boutons « Push Amazon » avec menu par canal (FR, UK, DE, IT, ES)
- Refresh token automatique (`refreshAmazonToken`)

**Variables d'environnement requises :**
- `AMAZON_LWA_CLIENT_ID`, `AMAZON_LWA_CLIENT_SECRET` (obligatoires pour connexion)
- `AMAZON_APPLICATION_ID` (OAuth — app enregistrée dans Seller Central)
- `AMAZON_REDIRECT_URI`, `AMAZON_LOGIN_URI` (configurés dans l'app Amazon)
- `APP_URL` (ex. https://app.feedplug.com)

---

## 2. Cdiscount — Connecteur Octopia REST API

**Authentification :** Pas d'OAuth classique. Le vendeur crée des credentials dans l’espace Cdiscount/Octopia :
- `clientId` + `clientSecret` (API Credentials Management : dev.octopia-io.net)
- Le vendeur saisit ces credentials dans FeedPlug

**Flow :**
1. Page « Connecter Cdiscount » : formulaire clientId + clientSecret
2. Test de connexion (appel API simple)
3. Stockage dans `PlatformConnection` (platform = 'cdiscount')
4. Push : appels REST Octopia pour créer/mettre à jour les offres produits

**Doc :** https://developer.octopia-io.net/

**Effort estimé :** 2–3 jours

---

## 3. Rakuten — Connecteur webservice

**Authentification :** 
- `login` (identifiant vendeur) + `token` (généré dans le back-office Rakuten)
- Pas d'OAuth — formulaire de config

**Push :** 
- Rakuten expose un webservice d’import : `POST` multipart avec le fichier CSV/TXT
- On peut **automatiser** : générer le CSV côté backend → `POST` direct vers `https://ws.fr.shopping.rakuten.com/stock_ws?action=import&login=...&pwd=...&version=...`
- Le vendeur n’a plus qu’à déclencher « Push vers Rakuten » — plus de téléchargement manuel

**Flow :**
1. Page « Connecter Rakuten » : formulaire login + token
2. Stockage dans `PlatformConnection` (platform = 'rakuten')
3. Push : génération CSV normalisé + envoi POST au webservice Rakuten

**Effort estimé :** 1,5–2 jours

---

## Architecture commune des connecteurs

```
┌─────────────────────────────────────────────────────────────────┐
│  Page Flux                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │ Connecter   │  │ Connecter   │  │ Connecter   │  ...          │
│  │ GMC         │  │ Amazon      │  │ Cdiscount   │               │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Boutons Push par canal (ex: Push vers Amazon FR, Rakuten)  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (server-minimal.js)                                     │
│                                                                  │
│  PlatformConnection (gmc, amazon, cdiscount, rakuten)            │
│                                                                  │
│  POST /platforms/{platform}/push/:feedId                         │
│    → Récupère tokens/config                                      │
│    → Charge FeedItems                                            │
│    → Applique règles + normalisation                             │
│    → Push vers l'API cible (Content API, SP-API, Octopia, etc.)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Ordre de priorisation recommandé

| # | Tâche | Effort | Impact |
|---|-------|--------|--------|
| 1 | **Rakuten connecteur** | 1,5–2 j | Push automatique via webservice (le plus simple) |
| 2 | **Amazon connecteur** | 2–3 j | Complète le flow existant, forte demande |
| 3 | **Cdiscount connecteur** | 2–3 j | Octopia REST API |

**Pourquoi Rakuten en premier ?** Le push se fait par envoi de fichier au webservice — pas de mapping produit par produit. On réutilise la normalisation CSV existante et on automise l’envoi.

---

## Prochaines étapes

1. Valider ce plan et l’ordre (Rakuten → Amazon → Cdiscount).
2. Créer la table / migration si besoin (ExportChannel pour canaux multi-marchés ?).
3. Implémenter le connecteur Rakuten (config + push webservice).
4. Puis Amazon (OAuth LWA + push).
5. Puis Cdiscount (Octopia REST).
