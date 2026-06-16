#!/usr/bin/env bash
#
# deploy.sh - Deploy contract-incentives-web to Cloud Run.
#
# This follows the Operon platform website deployment pattern: Terraform owns
# service configuration and this script updates the container image plus labels.

set -euo pipefail

SERVICE_NAME="${1:?Service name required}"
ENVIRONMENT="${2:?Environment required (nonprod)}"
IMAGE_FULL="${3:?Full image reference required}"
COMMIT_SHA="${4:?Commit SHA required}"
PROJECT_ID="${5:?Project ID required}"
LABEL_UPDATES="${6:-}"
LABEL_REMOVALS="${7:-}"
REGION="${REGION:-us-central1}"

case "$ENVIRONMENT" in
  nonprod) ;;
  *) echo "Error: invalid environment '$ENVIRONMENT' (expected nonprod)"; exit 1 ;;
esac

echo "=================================================="
echo "Deploying ${SERVICE_NAME} (${ENVIRONMENT})"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Image : ${IMAGE_FULL}"
echo "Commit: ${COMMIT_SHA}"
if [ -n "$LABEL_UPDATES" ]; then
  echo "Label updates: ${LABEL_UPDATES}"
fi
if [ -n "$LABEL_REMOVALS" ]; then
  echo "Removing labels: ${LABEL_REMOVALS}"
fi
echo "=================================================="

if ! gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(metadata.name)" >/dev/null 2>&1; then
  echo "Error: Cloud Run service '${SERVICE_NAME}' does not exist in ${PROJECT_ID}/${REGION}."
  echo "Build and push the image first, then apply the operon-labs-infra web-app layer so Terraform creates the service."
  exit 1
fi

CMD=(gcloud run deploy "${SERVICE_NAME}"
  --image="${IMAGE_FULL}"
  --region="${REGION}"
  --project="${PROJECT_ID}"
  --cpu-throttling
  --quiet)

if [ -n "$LABEL_UPDATES" ]; then
  CMD+=("--update-labels=${LABEL_UPDATES}")
fi

if [ -n "$LABEL_REMOVALS" ]; then
  CMD+=("--remove-labels=${LABEL_REMOVALS}")
fi

echo "Executing: ${CMD[*]}"
"${CMD[@]}"

echo "Deployment complete"
