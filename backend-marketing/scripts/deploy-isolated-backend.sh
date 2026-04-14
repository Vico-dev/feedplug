#!/bin/bash
# Déploie uniquement le backend-marketing en réutilisant la config live du service Cloud Run.
# Utile quand le dépôt parent n'est pas isolé proprement et qu'on veut éviter d'envoyer
# des changements hors backend à Cloud Build.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-feedplug-prod}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-feedplug-backend-marketing}"
MEMORY="${MEMORY:-2Gi}"
CPU="${CPU:-1}"
MAX_INSTANCES="${MAX_INSTANCES:-10}"
TIMEOUT="${TIMEOUT:-300}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend-marketing"
STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/feedplug-backend-deploy.XXXXXX")"
SERVICE_JSON="$STAGING_DIR/service.json"
ENV_FILE="$STAGING_DIR/current-env.yaml"
IMAGE_TAG="oauth-$(date +%Y%m%d-%H%M%S)"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE:$IMAGE_TAG"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

if command -v gcloud &>/dev/null; then
  GCLOUD="gcloud"
elif [ -x "$HOME/google-cloud-sdk/bin/gcloud" ]; then
  GCLOUD="$HOME/google-cloud-sdk/bin/gcloud"
elif [ -x "/Users/victorsoldet/google-cloud-sdk/bin/gcloud" ]; then
  GCLOUD="/Users/victorsoldet/google-cloud-sdk/bin/gcloud"
else
  echo "❌ gcloud introuvable. Installe-le ou ajoute-le au PATH."
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "❌ jq introuvable. Installe-le puis relance le script."
  exit 1
fi

if ! command -v rsync &>/dev/null; then
  echo "❌ rsync introuvable. Installe-le puis relance le script."
  exit 1
fi

if [ ! -d "$BACKEND_DIR" ]; then
  echo "❌ Dossier backend-marketing introuvable: $BACKEND_DIR"
  exit 1
fi

echo "📦 Déploiement backend-marketing isolé"
echo "   Projet : $PROJECT_ID"
echo "   Région : $REGION"
echo "   Service: $SERVICE"
echo ""

"$GCLOUD" config set project "$PROJECT_ID" --quiet >/dev/null || true

echo "🔎 Récupération de la configuration live du service..."
"$GCLOUD" run services describe "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format=json > "$SERVICE_JSON"

SERVICE_URL="$(jq -r '.status.url // empty' "$SERVICE_JSON")"
if [ -z "$SERVICE_URL" ]; then
  echo "❌ Impossible de récupérer l'URL du service Cloud Run."
  exit 1
fi

jq -r '
  .spec.template.spec.containers[0].env[]?
  | select(has("value"))
  | "\(.name): \(.value | @json)"
' "$SERVICE_JSON" > "$ENV_FILE"

SECRET_BINDINGS="$(jq -r '
  [
    .spec.template.spec.containers[0].env[]?
    | select(.valueFrom.secretKeyRef.name != null)
    | "\(.name)=\(.valueFrom.secretKeyRef.name):\(.valueFrom.secretKeyRef.key // "latest")"
  ] | join(",")
' "$SERVICE_JSON")"

if [ ! -s "$ENV_FILE" ]; then
  echo "❌ Aucun env var live trouvé. Déploiement interrompu."
  exit 1
fi

echo "🧪 Vérification locale de syntaxe..."
node -c "$BACKEND_DIR/server-minimal.js" >/dev/null

echo "📁 Préparation d'un package minimal dans $STAGING_DIR ..."
rsync -a \
  --exclude node_modules \
  --exclude '.DS_Store' \
  --exclude '.git' \
  --exclude '*.log' \
  "$BACKEND_DIR"/ "$STAGING_DIR"/

cat > "$STAGING_DIR/.gcloudignore" <<'EOF'
.gcloudignore
node_modules/
.git/
.DS_Store
npm-debug.log
docs/
*.md
EOF

cat > "$STAGING_DIR/.dockerignore" <<'EOF'
node_modules/
.git/
.DS_Store
npm-debug.log
docs/
*.md
!SETUP_DATABASE.md
!CONFIGURATION_FINALE.md
!ETAT_CONFIGURATION.md
EOF

echo "🏗️  Build Cloud Build de l'image $IMAGE ..."
"$GCLOUD" builds submit "$STAGING_DIR" \
  --tag "$IMAGE" \
  --project="$PROJECT_ID"

echo "🚀 Déploiement Cloud Run en réutilisant la config live..."
DEPLOY_ARGS=(
  run deploy "$SERVICE"
  --image "$IMAGE"
  --region "$REGION"
  --platform managed
  --allow-unauthenticated
  --port 8080
  --memory "$MEMORY"
  --cpu "$CPU"
  --cpu-throttling
  --max-instances "$MAX_INSTANCES"
  --timeout "$TIMEOUT"
  --min-instances "$MIN_INSTANCES"
  --env-vars-file "$ENV_FILE"
  --project "$PROJECT_ID"
)

if [ -n "$SECRET_BINDINGS" ]; then
  DEPLOY_ARGS+=(--update-secrets "$SECRET_BINDINGS")
fi

"$GCLOUD" "${DEPLOY_ARGS[@]}"

echo "🔀 Bascule du trafic vers la dernière révision..."
"$GCLOUD" run services update-traffic "$SERVICE" \
  --region="$REGION" \
  --to-latest \
  --project="$PROJECT_ID" >/dev/null

LATEST_URL="$("$GCLOUD" run services describe "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format='value(status.url)')"

LATEST_REVISION="$("$GCLOUD" run services describe "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format='value(status.latestReadyRevisionName)')"

echo "🩺 Smoke tests..."
curl -fsS "$LATEST_URL/health" >/dev/null
curl -fsS "$LATEST_URL/api/v1/health" >/dev/null

echo ""
echo "✅ Déploiement terminé"
echo "   Révision : $LATEST_REVISION"
echo "   URL      : $LATEST_URL"
echo "   Image    : $IMAGE"
echo "   Note     : les env vars et secrets ont été repris depuis la config live."
