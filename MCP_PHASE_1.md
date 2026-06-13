# MCP FeedPlug — Phase 1 (spec)

Statut : cadrage validé — **build post-lancement**.
Modèle retenu : **A — MCP par compte** (pas de couche agence cross-compte).

## 1. Contexte & objectif

FeedPlug est un SaaS self-serve multi-tenant. La phase 1 expose chaque compte à
un agent IA via un serveur MCP, pour automatiser le travail récurrent de gestion
de flux produit (audit qualité, détection d'erreurs GMC, suggestions
d'optimisation).

Cible : un marchand self-serve — ou une agence opérant sur le compte d'un
client — branche son agent (Claude Desktop, agent custom…) sur *ce* compte.

La phase 2 (« catalogue actif consommable par l'IA ») réutilisera le même
substrat : token scopé + surface de lecture du catalogue.

## 2. Principe — Modèle A

- Un **token API scopé par compte**.
- Un **endpoint MCP** qui consomme ce token et résout le `accountId`.
- Une agence gérant N clients branche N connexions MCP (une par compte). Pas de
  notion d'organisation cross-compte en phase 1.

## 3. Hors périmètre phase 1

- Accès cross-compte / console agence unifiée (Modèle B — éventuelle phase 3).
- Écritures en masse non supervisées.
- Push destructif vers les canaux (Amazon, GMC) — réservé à une étape ultérieure
  avec confirmation explicite.

## 4. Brique 1 — Token API scopé

Prérequis principal : rien n'existe aujourd'hui (l'auth se fait par cookie JWT).

### Modèle de données

Table `api_token` :

| Colonne      | Type        | Notes                                   |
|--------------|-------------|-----------------------------------------|
| `id`         | TEXT PK     |                                         |
| `accountid`  | TEXT        | scoping multi-tenant                    |
| `token_hash` | TEXT        | hash du token (jamais stocké en clair)  |
| `scopes`     | TEXT[]      | `read`, `optimize`                      |
| `label`      | TEXT        | libellé saisi par l'utilisateur         |
| `createdat`  | TIMESTAMPTZ |                                         |
| `lastusedat` | TIMESTAMPTZ | observabilité                           |
| `revokedat`  | TIMESTAMPTZ | NULL = actif                            |

### Endpoints

- `POST /api/v1/account/api-tokens` — génère un token (valeur en clair renvoyée
  **une seule fois**), préfixe `fp_`.
- `GET /api/v1/account/api-tokens` — liste (sans la valeur).
- `DELETE /api/v1/account/api-tokens/:id` — révoque.

### Authentification

- En-tête `Authorization: Bearer fp_…`.
- Middleware : hash du token → recherche `api_token` actif → injecte
  `req.accountId` (réutilise le scoping existant) + `req.tokenScopes`.
- Constant-time compare, rejet si `revokedat` non NULL.

### UI

Paramètres → **API & intégrations** : création, libellé, copie unique,
révocation, date de dernière utilisation.

## 5. Brique 2 — Serveur MCP

Service séparé `feedplug-mcp` (SDK MCP). Adaptateur fin : il traduit les appels
MCP en appels HTTP vers l'API FeedPlug, authentifiés par le token du compte.
Quelques jours de travail une fois la brique 1 prête.

## 6. Brique 3 — Outils exposés

Lecture d'abord ; une seule écriture, rollbackable.

| Outil                   | Type    | Scope      | Risque   |
|-------------------------|---------|------------|----------|
| `get_catalogue_health`  | read    | `read`     | nul      |
| `list_products`         | read    | `read`     | nul      |
| `get_product`           | read    | `read`     | nul      |
| `list_gmc_errors`       | read    | `read`     | nul      |
| `list_channel_issues`   | read    | `read`     | nul      |
| `get_feed_status`       | read    | `read`     | nul      |
| `suggest_optimizations` | preview | `optimize` | faible   |
| `apply_optimization`    | write   | `optimize` | modéré   |

`apply_optimization` écrit dans une **révision** (`lib/revisions.js`) — donc
réversible. Aucun push canal exposé.

## 7. Séquencement

1. Brique 1 — token scopé (modèle de données + endpoints + UI). *Substrat
   commun avec la phase 2.*
2. Mapper la surface de lecture sur les endpoints existants.
3. Brique 2 — serveur MCP.
4. Dogfooding sur les comptes clients d'Agence Inconnu.

## 8. Lien avec la phase 2

La brique 1 livrée, chaque compte dispose déjà d'un token scopé et d'une surface
de lecture du catalogue. La phase 2 (catalogue exposé à des agents tiers) devient
quasi gratuite : même endpoint, en lecture, scope élargi.

## 9. Décisions ouvertes

- Le MCP est-il un palier payant (« agency / pro tier ») ou inclus ?
- Limite de débit par token (rate limit dédié).
- Le serveur MCP est-il hébergé par FeedPlug (remote MCP) ou distribué en local
  aux clients ? Recommandation : remote, pour maîtriser versions et observabilité.
