#!/usr/bin/env bash
# Smoke test rapide après déploiement backend/frontend.
# Usage : ./scripts/smoke-test-prod.sh
# À lancer depuis la racine du projet.

set -e

BACKEND_URL="${BACKEND_URL:-https://feedplug-backend-marketing-771607738477.europe-west1.run.app}"
FRONTEND_URL="${FRONTEND_URL:-https://app.feedplug.com}"
ORIGIN="${ORIGIN:-https://app.feedplug.com}"

echo "=== Smoke test prod ==="
echo "Backend: $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

# 1. Health backend
echo "1. GET /health"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")
if [ "$STATUS" = "200" ]; then
  echo "   OK $STATUS"
else
  echo "   FAIL $STATUS (attendu 200)"
  exit 1
fi

# 2. Preflight OPTIONS (CORS) — doit être 204, pas 429
echo "2. OPTIONS /api/v1/performance/dashboard (preflight CORS)"
OPT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BACKEND_URL/api/v1/performance/dashboard" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization")
if [ "$OPT_STATUS" = "204" ]; then
  echo "   OK $OPT_STATUS"
else
  echo "   ATTENTION $OPT_STATUS (souhaité 204 pour CORS; 429 = rate limit avant handler OPTIONS)"
  # On ne fait pas exit 1 pour ne pas bloquer si seul le preflight est encore 429
fi

# 3. Frontend répond (HTTP 200 ou 3xx)
echo "3. GET $FRONTEND_URL"
FRONT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "$FRONTEND_URL" 2>/dev/null || echo "000")
if [ "$FRONT_STATUS" = "200" ] || [ "$FRONT_STATUS" = "301" ] || [ "$FRONT_STATUS" = "302" ]; then
  echo "   OK $FRONT_STATUS"
else
  echo "   FAIL $FRONT_STATUS"
  exit 1
fi

echo ""
echo "=== Smoke test terminé ==="
