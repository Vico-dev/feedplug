# Sécurité Multi-Content : Isolation Données Prospect vs Client

## Problème résolu (15 février 2026)

Un client créant un compte (OWNER de son entreprise) pouvait accéder aux **données prospect** (leads marketing) qui sont des données internes FeedPlug. C'était une fuite de données critique.

## Cause

La vérification `req.user.role === 'OWNER'` était utilisée pour protéger les endpoints admin (leads, feature-ideas, diagnostic, etc.). Mais dans un système multi-tenant, **chaque client est OWNER de son propre compte** — donc tous les clients voyaient le menu et les données.

## Solution : notion de Staff FeedPlug

Distinction entre :
- **OWNER client** = propriétaire d'un compte client (ne doit PAS voir les données prospect)
- **Staff FeedPlug** = administrateurs internes (accès leads, diagnostic, etc.)

### Critères Staff

Un utilisateur est considéré **staff** si :
1. Son **email** figure dans `FEEDPLUG_STAFF_EMAILS` (variable d'env, liste séparée par virgules)
2. Ou son **accountId** figure dans `FEEDPLUG_STAFF_ACCOUNT_IDS` (ex: `default-account`)

### Configuration (.env)

```env
# Emails autorisés à accéder aux données prospect
FEEDPLUG_STAFF_EMAILS=admin@feedplug.com,victor@agence-inconnu.fr

# IDs de comptes considérés comme staff (compte démo/admin)
FEEDPLUG_STAFF_ACCOUNT_IDS=default-account
```

### Endpoints protégés par requireStaffAccess

- `GET /api/v1/admin/accounts` — Liste de tous les comptes (visu admin)
- `GET /api/v1/marketing/leads` — Liste des leads prospect
- `PUT /api/v1/marketing/leads/:id` — Mise à jour d'un lead
- `GET /api/v1/marketing/feature-ideas` — Idées feature
- `GET /api/v1/diagnostic` — Diagnostic technique
- `GET /api/v1/inspect-table/:tableName` — Inspection tables
- `POST /api/v1/cleanup-feed-table` — Nettoyage
- `POST /api/v1/fix-schema` — Correction schéma
- `GET /api/v1/chaos/status` — Chaos Monkey
- `POST /api/v1/chaos/trigger` — Chaos Monkey
- `POST /api/v1/admin/apply-enrichment-migration` — Migration admin

### Frontend

- Sidebar : les liens Leads, Idées feature, Clés API IA ne s'affichent que si `user.isStaff === true`
- Pages `/admin/leads`, `/admin/feature-ideas`, `/admin/ai-keys` : redirection vers `/dashboard` si non staff

### API /auth/me et login/register

L'objet utilisateur inclut maintenant `isStaff: boolean` pour que le frontend sache afficher ou masquer les menus admin.

## Vérification

1. Créer un compte client (inscription normale) → `isStaff` doit être `false`, pas d'accès aux leads
2. Se connecter avec un compte du `default-account` ou un email dans FEEDPLUG_STAFF_EMAILS → `isStaff` doit être `true`, accès aux leads
