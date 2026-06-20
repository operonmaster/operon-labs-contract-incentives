# Operon Labs Infra Scope: Hedera Testnet Settlement

## Purpose

`operon-labs-contract-incentives` now supports real Hedera Agent Kit settlement for policy-approved incentive payments. Terraform and secret operations remain outside this public repo, in `operon-labs-infra`.

This document describes the GCP and Hedera prerequisites needed for the deployed Cloud Run service to execute current policy-approved HBAR testnet payments from the plan/operator wallet to the approved recipient wallet.

## Runtime Behavior

The app defaults to real Hedera settlement unless `HEDERA_SETTLEMENT_MODE=simulated` is explicitly set.

Approved Provider Documentation and Delegate UM events follow this settlement path:

1. Provider submits a PAS-style prior authorization.
2. The server records the PAS claim and emits `PAS_SUBMITTED`.
3. The incentive agent fetches policy-safe evidence by the canonical PA/UM request ID.
4. The deterministic policy evaluates evidence, amount, token symbol, submitter, and wallet mapping.
5. The payment policy layer runs the plan-level Hedera Agent Kit controls and stores the control-level result in `paymentPolicyEvidences/{paymentIntentId}`.
6. The Hedera executor calls Hedera Agent Kit `transfer_hbar_tool` with a single recipient, a capped amount, and a non-PHI memo containing only the readable PA/UM request id.
7. The real transaction ID is stored in `incentiveEvaluations/{businessEvaluationId}` and shown in the plan audit console.

Blocked policy outcomes do not call Hedera.

Plan audit surfaces use one shared policy outcome data model across Provider Documentation and Delegate UM. `businessPolicyStatus` is `approved` or `rejected` for final outcomes. `paymentPolicyStatus` is `paid` or `blocked` for final outcomes. Null means that policy surface has not produced a final outcome yet. Internal enum values such as `payment_failed`, `auto_executed`, `blocked_by_policy`, and `execution_failed` remain execution/backward-compatibility details, not policy outcome statuses.

## Settlement Identity Contract

Healthcare workflow records keep the readable PA/UM request id. Settlement-facing documents use deterministic opaque ids:

```text
businessEvaluationId = ie_sha256(umRequestId | businessPolicyId)
paymentIntentId = pi_sha256(umRequestId | businessPolicyId | paymentPolicyId)
```

Example persisted payment intent:

```json
{
  "id": "pi_1f2e3d4c5b6a79800112233445566778",
  "umRequestId": "PA-260527-1132-GNJNP7AE",
  "caseId": "PA-260527-1132-GNJNP7AE",
  "incentiveEvaluationId": "ie_0123456789abcdef0123456789abcdef",
  "businessPolicyId": "delegate-um-summit-pharmacy-sla-bonus-v1",
  "paymentPolicyId": "summit-health-hmo"
}
```

The PA/UM request id remains in `umRequestId`, `caseId`, and the Hedera transaction memo. Duplicate prevention blocks only the same `umRequestId + businessPolicyId + paymentPolicyId` triplet, so Provider Documentation and Delegate UM can both settle for the same request when they have different business policies.

## Hedera Testnet Accounts

Create or choose two Hedera testnet accounts:

- Plan/operator account: pays incentives and transaction fees.
- Approved recipient account: receives the demo incentive.

The current app policies expect approved recipients to match:

```text
lakeside-provider-admin -> 0.0.9049549
northstar-um -> 0.0.9049549
```

For real deployment, either:

- create/use testnet account `0.0.9049549` if available in the demo setup, or
- update the app policy and seeded wallet mapping to the actual recipient account before deployment.

The operator account must be funded with enough HBAR for demo transfers and fees. The current provider-documentation policy is bootstrapped as:

```text
5 HBAR per eligible PA
500 HBAR monthly cap
```

The policy model can represent other token symbols such as `USDC`, `OPER`, or `OPRN`, but the deployed real settlement adapter in this scope is HBAR-only. Non-HBAR real settlement requires a future HTS token-transfer executor and token-specific infra values.

## Secret Manager

Create these Secret Manager secrets in `operon-labs-nonprod`:

```text
contract-incentives-hedera-operator-account-id
contract-incentives-hedera-operator-private-key
contract-incentives-hedera-allowed-recipient-account-ids
```

Recommended contents:

```text
contract-incentives-hedera-operator-account-id = 0.0.<operator>
contract-incentives-hedera-operator-private-key = <operator private key>
contract-incentives-hedera-allowed-recipient-account-ids = 0.0.<provider recipient>
```

Do not commit secret payloads, `.env` files, wallet private keys, or Terraform variable files containing wallet private keys to any repo. Prefer creating secret versions out-of-band through `gcloud secrets versions add`, CI secret injection, or another approved secret-loading process.

## Cloud Run Service Account IAM

Grant the existing Cloud Run runtime service account permission to read only these Hedera secrets:

```text
roles/secretmanager.secretAccessor
```

Scope the binding to the two specific secrets when practical. Do not grant broad project-level secret access unless the existing Operon Labs Terraform module already standardizes on that pattern.

The same Cloud Run service account still needs the Firestore access described in `docs/operon-labs-infra-pas-firestore-scope.md`.

## Cloud Run Environment Variables

Set these env vars on the `contract-incentives-web` Cloud Run service:

```text
HEDERA_SETTLEMENT_MODE=real
HEDERA_NETWORK=testnet
HEDERA_BLOCKED_RECIPIENT_ACCOUNT_IDS=
```

Inject these from Secret Manager:

```text
HEDERA_OPERATOR_ACCOUNT_ID=<secret: contract-incentives-hedera-operator-account-id>
HEDERA_OPERATOR_PRIVATE_KEY=<secret: contract-incentives-hedera-operator-private-key>
```

Keep the existing Firestore env vars:

```text
PAS_STORE_BACKEND=firestore
UM_REFERENCE_STORE_BACKEND=firestore
POLICY_STORE_BACKEND=firestore
PAYMENT_POLICY_STORE_BACKEND=firestore
PAYMENT_POLICY_EVIDENCE_STORE_BACKEND=firestore
PAYMENT_INTENT_STORE_BACKEND=firestore
GCP_PROJECT_ID=operon-labs-nonprod
FIRESTORE_DATABASE_ID=(default)
```

## App-Side Validation Contract

The app blocks real HBAR settlement before network execution when:

- the policy token symbol is not `HBAR`; HTS token transfer is not implemented yet.
- amount is zero, negative, or above the plan-level `paymentPolicies/{planId}.maxPaymentAmount`.
- token does not match the plan-level `paymentPolicies/{planId}.paymentToken`.
- the recorded incentive evaluation is missing or references an inactive business policy.
- the same `umRequestId + businessPolicyId + paymentPolicyId` settlement intent already exists.
- recipient wallet is listed in `HEDERA_BLOCKED_RECIPIENT_ACCOUNT_IDS`.
- real mode is missing operator credentials.
- `HEDERA_NETWORK` is anything other than `testnet`.

The Hedera Agent Kit runner also attaches a custom Agent Kit `AbstractPolicy` for the HBAR transfer tool. The policy rejects transfer calls that do not match the approved payment intent: recorded business evaluation, no duplicate payment intent for the same settlement triplet, single expected recipient, expected source account, expected amount/token, max plan payment amount, and expected PA/UM request memo.

## Terraform Implementation Notes

Recommended Terraform shape:

- Create Secret Manager secrets without committing secret versions.
- Grant the Cloud Run service account secret accessor on the two secrets.
- Add literal env vars for settlement mode, network, Firestore-backed Hedera policy storage, and optional recipient blocklist.
- Add secret env vars for operator account ID and private key.
- Keep service creation in Terraform; keep image deployment in the app repo deploy script.

Suggested naming:

```text
service account: operon-labs-contract-incentives-web
Cloud Run service: contract-incentives-web
region: us-central1
project: operon-labs-nonprod
```

## Deployment Verification

After Terraform and deployment:

1. Submit an eligible `Knee MRI after injury` PA in `/provider-documentation`.
2. Open `/provider-documentation/incentives`.
3. Confirm the row shows `Paid`, `5.00 HBAR`, and a non-simulated Hedera transaction ID.
4. Open the HashScan testnet transaction link from the audit modal.
5. Submit an ineligible full-body MRI PA and confirm the row shows `Blocked`, `0.00 HBAR`, and no transaction.
