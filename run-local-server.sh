#!/usr/bin/env bash
set -euo pipefail

# ANSI colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_ID="${GCP_PROJECT_ID:-operon-labs-nonprod}"
PORT="${1:-3000}"
LOCAL_URL="http://localhost:${PORT}"
FIRESTORE_DATABASE_ID="${FIRESTORE_DATABASE_ID:-(default)}"
SECRET_OPERATOR_ACCOUNT_ID="${HEDERA_OPERATOR_ACCOUNT_ID_SECRET:-contract-incentives-hedera-operator-account-id}"
SECRET_OPERATOR_PRIVATE_KEY="${HEDERA_OPERATOR_PRIVATE_KEY_SECRET:-contract-incentives-hedera-operator-private-key}"
SECRET_ALLOWED_RECIPIENTS="${HEDERA_ALLOWED_RECIPIENT_ACCOUNT_IDS_SECRET:-contract-incentives-hedera-allowed-recipient-account-ids}"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Operon Labs Contract Incentives${NC}"
echo -e "${BLUE}  Local Development Server${NC}"
echo -e "${CYAN}  Mode: Next.js + Firestore + Hedera testnet${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo -e "${RED}Missing required command: $1${NC}" >&2
    exit 1
  fi
}

require_gcloud_auth() {
  if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" --project "$PROJECT_ID" | grep -q .; then
    echo -e "${RED}No active gcloud account.${NC}" >&2
    echo -e "${YELLOW}Run: gcloud auth login pavel@operon.cloud${NC}" >&2
    exit 1
  fi

  if ! gcloud auth application-default print-access-token --quiet >/dev/null 2>&1; then
    echo -e "${RED}Application Default Credentials are not available.${NC}" >&2
    echo -e "${YELLOW}Run: gcloud auth application-default login${NC}" >&2
    exit 1
  fi
}

read_secret() {
  local secret_name="$1"

  gcloud secrets versions access latest \
    --secret="$secret_name" \
    --project="$PROJECT_ID" \
    --quiet
}

require_command gcloud
require_gcloud_auth

if [ ! -d "${ROOT_DIR}/node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  cd "${ROOT_DIR}"
  npm install
  echo ""
else
  cd "${ROOT_DIR}"
fi

echo -e "${YELLOW}Loading local runtime values from GCP Secret Manager...${NC}"

export GCP_PROJECT_ID="$PROJECT_ID"
export FIRESTORE_DATABASE_ID="$FIRESTORE_DATABASE_ID"
export PAS_STORE_BACKEND="${PAS_STORE_BACKEND:-firestore}"
export UM_REFERENCE_STORE_BACKEND="${UM_REFERENCE_STORE_BACKEND:-firestore}"
export POLICY_STORE_BACKEND="${POLICY_STORE_BACKEND:-firestore}"
export PAYMENT_INTENT_STORE_BACKEND="${PAYMENT_INTENT_STORE_BACKEND:-firestore}"
export HEDERA_SETTLEMENT_MODE="real"
export HEDERA_NETWORK="${HEDERA_NETWORK:-testnet}"
export HEDERA_MAX_PAYMENT_HBAR="${HEDERA_MAX_PAYMENT_HBAR:-5}"
export HEDERA_BLOCKED_RECIPIENT_ACCOUNT_IDS="${HEDERA_BLOCKED_RECIPIENT_ACCOUNT_IDS:-}"
export HEDERA_OPERATOR_ACCOUNT_ID
export HEDERA_OPERATOR_PRIVATE_KEY
export HEDERA_ALLOWED_RECIPIENT_ACCOUNT_IDS

HEDERA_OPERATOR_ACCOUNT_ID="$(read_secret "$SECRET_OPERATOR_ACCOUNT_ID")"
HEDERA_OPERATOR_PRIVATE_KEY="$(read_secret "$SECRET_OPERATOR_PRIVATE_KEY")"
HEDERA_ALLOWED_RECIPIENT_ACCOUNT_IDS="$(read_secret "$SECRET_ALLOWED_RECIPIENTS")"

echo ""
echo -e "${GREEN}Starting local Next.js server...${NC}"
echo -e "${GREEN}   URL: ${LOCAL_URL}${NC}"
echo ""
echo -e "${YELLOW}Notes:${NC}"
echo -e "   • GCP Secret Manager values are loaded into this process environment only."
echo -e "   • No .env.local or other local secret file is written."
echo -e "   • Firestore uses Application Default Credentials."
echo -e "   • Eligible demo submissions can execute Hedera testnet HBAR transfers."
echo -e "   • Press Ctrl+C to stop the server."
echo ""
echo -e "${BLUE}========================================${NC}"
echo ""

exec npm --workspace @operon-labs/web run dev -- --port "$PORT"
