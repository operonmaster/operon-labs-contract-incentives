# Operon Labs Contract Incentives

Policy-gated healthcare operations incentive demo for the Hedera AI Agent Bounty Campaign. The demo keeps the public repo focused on app code, mock policies, Hedera Agent Kit integration points, and Hedera testnet settlement without exposing private infrastructure or wallet keys.

## Structure

```text
docs/
  Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md
  standards/nextjs-standard.md
src/
  apps/web/                  Next.js demo app and API routes
  mock-data/                 Demo payloads for each incentive workflow
  packages/audit-log/        Audit record and hash helpers
  packages/hedera-executor/  Hedera Agent Kit policy-bound payment executor
  packages/incentive-agent/  Demo orchestration over policies and requests
  packages/policy-engine/    Deterministic policy evaluator
  packages/um-platform/      Synthetic CRD/DTR/PAS prior-auth platform
```

## Demo Surfaces

- `/` - demo catalog
- `/delegate-um` - delegated utilization management SLA bonus
- `/provider-documentation` - provider documentation completeness incentive
- `/provider-documentation/incentives` - health-plan audit console for provider documentation incentives
- `/appeals` - provider appeals console for starting one appeal per denied PA and preparing packet evidence
- `/appeals/plan` - health-plan audit console for appeals packet readiness incentives
- `/appeals/policies` - Appeals Packet Quality business and payment policy catalog
- `/specialty-rx` - specialty pharmacy fulfillment SLA workflow
- `/specialty-rx/plan` - health-plan audit console for specialty fulfillment incentives
- `/specialty-rx/policies` - specialty fulfillment business and payment policy catalog

## Bounty Submission Links

- Maintainer: Pavel Grebenshikov (`operonmaster`)
- Public repository: https://github.com/operonmaster/operon-labs-contract-incentives
- Live demo: https://contract-incentives.demo.labs.operon.cloud/
- Hedera Agent Kit feedback: https://github.com/hashgraph/hedera-agent-kit-js/issues/944

### Provider Documentation Two-Page Demo

Open two browser pages:

- `/provider-documentation` - provider portal prior-auth wizard
- `/provider-documentation/incentives` - health-plan audit console

Demo sequence:

1. In the provider portal, select `Maya Chen`, `Acme Health PPO`, and `Knee MRI after injury`.
2. Check requirements, complete the assessment, and submit the prior authorization.
3. Use the top navigation or confirmation CTA to open the health-plan audit console.
4. Review the `5 HBAR` policy-paid row and inspect the Hedera testnet transaction details.
5. Return to the provider portal and submit a second `Knee MRI after injury` request, but skip the assessment.
6. In the plan console, review the `0 HBAR` policy-blocked row with missing documentation reasons.
7. Return to the provider portal and submit `Full-body wellness MRI screening` after acknowledging the not-covered warning.
8. In the plan console, review the `0 HBAR` policy-blocked row with `BENEFIT_NOT_COVERED`.
9. Select `Andre Williams`, `Summit Health HMO`, and `Knee MRI after injury` to see an approved `20 HBAR` business policy blocked by the plan-level Hedera Agent Kit `7 HBAR` request maximum.

## API Routes

- `POST /api/evaluations` - evaluates a demo request against a versioned policy
- `POST /api/payments/approve` - disabled deprecated generic payment route; provider-documentation settlement must use the PAS-triggered policy path
- `GET /api/audit/[id]` - returns a deterministic demo audit record
- `GET /api/um/prior-auths` - lists synthetic prior-auth submissions
- `POST /api/um/prior-auths` - submits a synthetic prior-auth request for a valid patient/plan coverage selection
- `GET /api/um/prior-auths/[caseId]/evidence` - returns policy-safe UM evidence
- `GET /api/um/patients` - returns seeded patient and coverage context for the provider portal
- `GET /api/provider-documentation/incentives` - lists plan-side incentive audit rows
- `POST /api/provider-documentation/incentives/[caseId]/approve` - deprecated demo route; provider-documentation payments auto-settle after policy approval

Provider-documentation incentives are triggered asynchronously after `PAS_SUBMITTED`. The agent receives only the PA `caseId`, pulls policy-safe evidence from the synthetic UM Platform, and records either an automatic testnet transaction or a zero-value policy block.

## Hedera Settlement

Provider-documentation incentives are policy-defined: the business policy owns the amount, cap, recipient wallet mapping, and token symbol. Most bootstrapped demo policies compute a `5 HBAR` incentive for eligible provider-documentation requests. The Summit outpatient policy intentionally computes `20 HBAR` so the plan-level Hedera Agent Kit controls can block settlement because it exceeds the `7 HBAR` per-request maximum.

The policy model can represent `HBAR`, `USDC`, `OPER`, `OPRN`, or another token symbol. Real settlement for non-HBAR tokens requires a future HTS token-transfer executor; those policy evaluations should not be treated as settled until that adapter exists.

Real Hedera settlement requires explicit runtime configuration from the deployment environment:

```bash
HEDERA_SETTLEMENT_MODE=real
HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ACCOUNT_ID=<operator-account-id>
HEDERA_OPERATOR_PRIVATE_KEY=<operator-private-key>
HEDERA_BLOCKED_RECIPIENT_ACCOUNT_IDS=
PUBLIC_DEMO_MUTATION_RATE_LIMIT=enabled
```

The Hedera Agent Kit execution policy is intentionally narrower than the healthcare business policy. CRD/DTR/PAS eligibility is evaluated before settlement and recorded in Firestore. Settlement-facing documents use deterministic opaque ids: `incentiveEvaluations/{businessEvaluationId}` where `businessEvaluationId = ie_sha256(umRequestId | businessPolicyId)`, and `paymentIntents/{paymentIntentId}` / `paymentPolicyEvidences/{paymentIntentId}` where `paymentIntentId = pi_sha256(umRequestId | businessPolicyId | paymentPolicyId)`. The readable PA/UM request id remains in `umRequestId`, `caseId`, and the Hedera transaction memo.

Provider Documentation and Delegate UM can both pay for the same UM request because they use different `businessPolicyId` values. Duplicate prevention blocks only a repeat of the same `umRequestId + businessPolicyId + paymentPolicyId` settlement triplet.

Public demo mutation routes include a process-local guard for basic abuse control: one accepted mutation per client per second and ten accepted mutations per client per rolling minute. It is intended to reduce uncontrolled demo data creation; use an external shared limiter if the hosted service needs hard global limits across multiple Cloud Run instances.

Monthly caps remain part of the policy model and UI language. Persisted month-to-date aggregation across paid rows is intentionally future production hardening rather than a current demo feature.

For tests or offline demos only:

```bash
HEDERA_SETTLEMENT_MODE=simulated
```

No wallet private keys, secret names, Terraform variables, service-account keys, or private deployment scripts belong in this public repo. See `docs/hedera-settlement-runtime-scope.md` for the public runtime contract.

## PAS Persistence

Firestore-backed persistence requires an explicit cloud project at runtime. The app does not hardcode a public default project:

```bash
PAS_STORE_BACKEND=firestore
UM_REFERENCE_STORE_BACKEND=firestore
POLICY_STORE_BACKEND=firestore
PAYMENT_POLICY_STORE_BACKEND=firestore
PAYMENT_POLICY_EVIDENCE_STORE_BACKEND=firestore
PAYMENT_INTENT_STORE_BACKEND=firestore
GCP_PROJECT_ID=<your-gcp-project-id>
FIRESTORE_DATABASE_ID=(default)
```

For isolated test runs or offline demos, explicitly opt out with `PAS_STORE_BACKEND=memory`.

UM reference data, incentive policies, payment policies, payment-policy evidence, and payment-intent settlement controls also default to Firestore. Use `UM_REFERENCE_STORE_BACKEND=memory`, `POLICY_STORE_BACKEND=memory`, `PAYMENT_POLICY_STORE_BACKEND=memory`, `PAYMENT_POLICY_EVIDENCE_STORE_BACKEND=memory`, and `PAYMENT_INTENT_STORE_BACKEND=memory` only for isolated tests or offline demos.

The Firestore adapter writes:

- `incentivePolicies/{policyId}` with pair-scoped business policy objects used by runtime evaluation and payment controls.
- `paymentPolicies/{planId}` with flat plan-level Agent Kit settlement-control switches and limits.
- `paymentPolicyEvidences/{paymentIntentId}` with the runtime output of the Hedera Agent Kit payment policy checks.
- `pasClaims/{umRequestId}` with the prior-auth record, policy-safe evidence, and PAS-style FHIR `Bundle` containing the `Claim`.
- `auditEvents/{umRequestId}-PAS_SUBMITTED` for auditable async incentive processing.
- `incentiveEvaluations/{businessEvaluationId}` with business-policy outcomes keyed by `umRequestId + businessPolicyId`.
- `paymentIntents/{paymentIntentId}` with durable settlement reservations keyed by `umRequestId + businessPolicyId + paymentPolicyId`.

The UM reference adapter auto-seeds these demo reference collections when they are missing:

- `patients/{patientId}` for Patient-anchored display and active Coverage context.
- `coverageRequirementRules/{planId}_{requestType}_{serviceCode}` for Da Vinci CRD coverage and PA requirement reference rules.
- `questionnaires/{questionnaireId}` for FHIR Questionnaire templates used by the DTR flow.

Full FHIR bundles stay server-side. The incentive agent receives policy-safe evidence only.

For development resets after the settlement identity model changes, use:

```bash
node scripts/purge-demo-settlement-state.mjs --dry-run
node scripts/purge-demo-settlement-state.mjs --confirm
```

The purge script deletes only `umRequests`, `pasClaims`, `auditEvents`, `incentiveEvaluations`, `paymentPolicyEvidences`, and `paymentIntents`. It does not touch `incentivePolicies`, `paymentPolicies`, or reference-data collections.

## Local Development

For local UI work without cloud persistence or Hedera transfers:

```bash
nvm use
npm install
npm run dev:simulated
```

For a cloud-backed local run, set the required environment variables outside the repo and then run:

```bash
npm run dev
```

Do not commit `.env`, `.env.local`, private keys, cloud project IDs, secret names, or deployment-only scripts. Keep operator-specific startup and deployment automation outside this public repository.

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
