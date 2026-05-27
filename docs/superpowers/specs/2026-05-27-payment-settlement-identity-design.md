# Payment Settlement Identity Design

## Purpose

Provider Documentation Completeness and Delegate UM SLA Bonus can both evaluate the same UM request. The current settlement model uses the raw PA/UM request id as the payment intent id, so the first paid workflow reserves `paymentIntents/{umRequestId}` and the second workflow is blocked as a duplicate even when it is a different business incentive.

This design replaces PA-id settlement identity with deterministic hashed identities. The dev Firestore dataset can be purged, so the implementation does not need mixed legacy compatibility for active demo records.

## Decision

Use clean deterministic ids for each layer:

```text
businessEvaluationId = ie_${sha256(umRequestId | businessPolicyId).slice(0, 32)}
paymentIntentId = pi_${sha256(umRequestId | businessPolicyId | paymentPolicyId).slice(0, 32)}
paymentPolicyEvidenceId = paymentIntentId
```

The raw `umRequestId` remains the healthcare workflow identity and Hedera transaction memo. It is not the Firestore document id for business evaluations, payment intents, or payment policy evidence.

## Identity Fields

Every persisted settlement-facing document stores the identity fields explicitly:

```ts
{
  id: "pi_...",
  umRequestId: "PA-260527-1132-GNJNP7AE",
  caseId: "PA-260527-1132-GNJNP7AE",
  businessPolicyId: "delegate-um-summit-pharmacy-sla-bonus-v1",
  paymentPolicyId: "summit-health-hmo"
}
```

`businessPolicyId` is the incentive policy that approved or rejected the business incentive. `paymentPolicyId` is the plan-level Hedera Agent Kit settlement policy. In the current app, `paymentPolicyId` equals the plan id, but the code must treat it as a payment-policy identity rather than a generic plan field.

## Firestore Shape

Keep these collections unchanged:

- `incentivePolicies`
- `paymentPolicies`
- patient, coverage, CRD, DTR, questionnaire, and other reference data collections

Purge and recreate these dev/demo collections under the new model:

- `umRequests`
- `pasClaims`
- `auditEvents`
- `incentiveEvaluations`
- `paymentPolicyEvidences`
- `paymentIntents`

New document ids:

- `incentiveEvaluations/{businessEvaluationId}`
- `paymentPolicyEvidences/{paymentIntentId}`
- `paymentIntents/{paymentIntentId}`

`pasClaims/{umRequestId}`, `umRequests/{umRequestId}`, and `auditEvents/{umRequestId}-{eventType}` remain PA/UM-request keyed because they describe the underlying healthcare workflow, not a distinct incentive settlement.

## Data Flow

Provider Documentation:

1. A UM request is submitted.
2. The provider documentation business policy evaluates policy-safe evidence.
3. The workflow derives `businessEvaluationId` from `umRequestId + businessPolicyId`.
4. The workflow persists `incentiveEvaluations/{businessEvaluationId}`.
5. The workflow loads the plan payment policy and derives `paymentIntentId` from `umRequestId + businessPolicyId + paymentPolicyId`.
6. Hedera Agent Kit duplicate prevention reserves `paymentIntents/{paymentIntentId}`.
7. Runtime control evidence is written to `paymentPolicyEvidences/{paymentIntentId}`.

Delegate UM:

1. A delegated UM request is determined.
2. The delegate SLA bonus business policy evaluates the determination evidence.
3. It uses the same identity derivation rules as Provider Documentation.
4. A Delegate UM incentive for the same `umRequestId` gets a different `businessPolicyId`, so it gets a different `businessEvaluationId` and `paymentIntentId`.
5. Duplicate prevention blocks only repeated settlement of the same business incentive under the same payment policy.

## Duplicate Prevention

The duplicate boundary is:

```text
same umRequestId + same businessPolicyId + same paymentPolicyId
```

Allowed:

- Same UM request with Provider Documentation and Delegate UM incentives.
- Same business policy across different UM requests.
- Same UM request and business policy under a different payment policy, if that ever exists.

Blocked:

- Retrying the same UM request, same business policy, and same payment policy after an intent has already been reserved or submitted.

## Validation

Validation must enforce these invariants:

- `caseId`, `umRequestId`, and `incentiveEvaluationId` must refer to the same canonical PA/UM request where those fields are present.
- `businessPolicyId` must be present for every business evaluation, payment intent, and payment policy evidence.
- `paymentPolicyId` must be present for every payment intent and payment policy evidence.
- `paymentIntent.id` must equal `buildPaymentIntentId({ umRequestId, businessPolicyId, paymentPolicyId })`.
- `paymentPolicyEvidence.paymentIntentId` must equal its document id and the derived payment intent id.
- `incentiveEvaluation.id` must equal `buildBusinessEvaluationId({ umRequestId, businessPolicyId })`.

The executor must expose shared helper functions for id construction so stores and tests do not duplicate hash logic.

## UI And Audit Behavior

The UI must continue to show the readable UM request id prominently. Payment intent ids may be shown as opaque `pi_...` identifiers in detail modals. The transaction memo must remain the PA/UM request id, so HashScan still connects the on-chain transfer to the demo request without exposing PHI.

Rows for Provider Documentation and Delegate UM must no longer overwrite each other in `incentiveEvaluations`. If a screen lists rows by UM request, it must filter or group by `evaluationType` as needed rather than assuming one row per PA id.

## Purge Plan

Because this is a dev project, active legacy records can be deleted instead of migrated. The purge must delete only request/evaluation/settlement collections:

```text
umRequests
pasClaims
auditEvents
incentiveEvaluations
paymentPolicyEvidences
paymentIntents
```

The purge must not delete policy or reference collections. It must be implemented as an explicit script or documented one-off command that prints the target project, database, and collection names before deletion. It must not run automatically during tests, builds, or app startup.

## Documentation Updates

Update these docs to reflect the new identity model:

- `README.md`
- `docs/standards/nextjs-standard.md`
- `docs/operon-labs-infra-pas-firestore-scope.md`
- `docs/operon-labs-infra-hedera-settlement-scope.md`
- `docs/Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md`

Historical superpowers plans can remain historical, but the new implementation plan must supersede them.

## Testing Requirements

Tests must prove:

- Same `umRequestId` plus different `businessPolicyId` produces different payment intent ids.
- Same `umRequestId`, `businessPolicyId`, and `paymentPolicyId` produces the same payment intent id.
- Duplicate prevention blocks only the same triplet.
- Provider Documentation and Delegate UM can both settle for the same UM request without intent collision.
- Store validation rejects mismatched hashed ids.
- Firestore persistence preserves hashed ids and does not canonicalize them back to raw PA ids.
- Payment policy evidence can reference hashed payment intent ids.

## Out Of Scope

- Production migration for historical records.
- Mainnet settlement behavior.
- Changing the Hedera transaction memo away from the PA/UM request id.
- Changing policy ids or payment policy ids.
