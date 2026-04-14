# Chaos Monkey — Résilience et tests de panne

En staging (ou dev), on peut déclencher des **pannes volontaires** pour vérifier que la prod reste solide : health en 503, Sentry qui reçoit les erreurs, pas de crash silencieux.

## Activation

- **Staging / dev** : `CHAOS_MONKEY_ENABLED=true` (et `NODE_ENV` ≠ `production`).
- **Production** : ne **jamais** mettre `CHAOS_MONKEY_ENABLED=true`. Le code refuse d’activer le chaos si `NODE_ENV=production`.

## Scénarios

| Scénario   | Effet |
|-----------|--------|
| `db_fail` | La prochaine requête qui touche la DB (ex. `GET /api/v1/health`) simule une erreur DB → health en 503, Sentry reçoit l’erreur. |
| `latency` | La prochaine requête est retardée (défaut 5 s). Pour tester timeouts client / load balancer. |
| `error500`| La prochaine requête reçoit une 500 immédiate. |
| `timeout` | La prochaine requête ne répond jamais (connexion qui reste ouverte). |

Chaque scénario ne s’exécute **qu’une fois** (one-shot), puis est désactivé.

## API (admin uniquement)

- **GET /api/v1/chaos/status**  
  - Auth : JWT, rôle `OWNER`.  
  - Réponse : `enabled`, `production`, `scenarios`, message.

- **POST /api/v1/chaos/trigger**  
  - Auth : JWT, rôle `OWNER`.  
  - Body : `{ "scenario": "db_fail" | "latency" | "error500" | "timeout", "ms": 5000 }` (optionnel pour `latency`).  
  - Réponse : `{ "ok": true, "scenario": "...", "message": "..." }`.  
  - En prod ou si chaos désactivé : 400.

## Exemple de test (staging)

```bash
# 1) Activer le chaos (staging uniquement)
export CHAOS_MONKEY_ENABLED=true
export NODE_ENV=development

# 2) Déclencher une panne DB
curl -X POST https://staging.feedplug.com/api/v1/chaos/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scenario":"db_fail"}'

# 3) Appeler le health → doit retourner 503 et erreur côté Sentry
curl -s https://staging.feedplug.com/api/v1/health | jq .
```

## Résilience associée (sans chaos)

- **Timeouts** : fetch CSV (ingestion) avec `lib/resilience.js` (60 s par défaut) ; health DB avec timeout 5 s.
- **Handlers globaux** : `unhandledRejection` et `uncaughtException` loggés et envoyés à Sentry ; sur `uncaughtException` le process exit 1 après 1 s pour redémarrage propre par le process manager.
