# Hedera Settlement Runtime Scope

## Purpose

`operon-labs-contract-incentives` supports Hedera Agent Kit settlement for policy-approved HBAR testnet incentive payments.

This public document describes the runtime contract only. Private deployment automation, cloud project IDs, service-account emails, secret resource names, Terraform variables, and wallet private keys must stay outside this repository.

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

The policy model can represent other token symbols such as `USDC`, `OPER`, or `OPRN`, but the submitted real settlement adapter in this scope is HBAR-only. Non-HBAR real settlement requires a future HTS token-transfer executor and token-specific runtime configuration.

## Secret Injection

Inject these values from the deployment environment or a managed secret store:

```text
HEDERA_OPERATOR_ACCOUNT_ID=0.0.<operator>
HEDERA_OPERATOR_PRIVATE_KEY=<operator-private-key>
HEDERA_ALLOWED_RECIPIENT_ACCOUNT_IDS=0.0.<provider-recipient>
```

Do not commit secret payloads, `.env` files, wallet private keys, cloud secret names, service-account keys, or Terraform variable files to this repository.

## Runtime Identity

Use a runtime identity with the least privilege needed to read only the settlement secrets and Firestore collections required by the app. Do not use service-account key files.

The same runtime identity still needs the Firestore access described in `docs/firestore-persistence-runtime-scope.md`.

## Runtime Environment Variables

Set these non-secret env vars in the deployment environment:

```text
HEDERA_SETTLEMENT_MODE=real
HEDERA_NETWORK=testnet
HEDERA_BLOCKED_RECIPIENT_ACCOUNT_IDS=
```

Keep the existing Firestore env vars:

```text
PAS_STORE_BACKEND=firestore
UM_REFERENCE_STORE_BACKEND=firestore
POLICY_STORE_BACKEND=firestore
PAYMENT_POLICY_STORE_BACKEND=firestore
PAYMENT_POLICY_EVIDENCE_STORE_BACKEND=firestore
PAYMENT_INTENT_STORE_BACKEND=firestore
GCP_PROJECT_ID=<your-gcp-project-id>
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

## Deployment Boundary

Deployment tooling should live outside this public repo. Keep project IDs, service-account identifiers, managed secret names, IAM bindings, Terraform state, and CI/CD release scripts in private operational systems.

## Deployment Verification

After deployment:

1. Submit an eligible `Knee MRI after injury` PA in `/provider-documentation`.
2. Open `/provider-documentation/incentives`.
3. Confirm the row shows `Paid`, `5.00 HBAR`, and a non-simulated Hedera transaction ID.
4. Open the HashScan testnet transaction link from the audit modal.
5. Submit an ineligible full-body MRI PA and confirm the row shows `Blocked`, `0.00 HBAR`, and no transaction.
