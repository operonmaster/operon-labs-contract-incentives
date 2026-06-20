# Operon Labs Contract Incentives

Healthcare operations often depend on work performed by one organization that creates value for another. A provider completes prior-authorization documentation that helps a health plan avoid rework. A delegated UM vendor makes a timely determination on a pharmacy request. A specialty pharmacy coordinates fulfillment after approval. An appeals team assembles a complete packet before a filing deadline.

Those handoffs are usually governed by contracts, portals, spreadsheets, and retrospective audits. The incentive logic is hard to verify in real time: who did the work, whether the work met the contract rules, whether payment is allowed, and whether the payment stayed inside agreed limits.

Operon Labs Contract Incentives demonstrates a policy-gated agent for these multi-party healthcare workflows. Each demo flow turns a synthetic healthcare event into policy-safe evidence, evaluates whether a contract incentive was earned, and then allows a Hedera Agent Kit policy to either execute bounded HBAR testnet settlement or block payment with an audit reason.

The repo uses synthetic data only and keeps the public submission focused on app code, mock policies, Hedera Agent Kit policy integration, and Hedera testnet settlement.

## Policy Model

The demo separates contract eligibility from payment execution with a two-policy model.

The business policy decides whether a healthcare workflow event earned an incentive. It reads policy-safe evidence, such as whether required documentation was completed, whether a delegated review happened within the SLA, or whether an appeal packet is ready. It computes the incentive amount, token symbol, policy reason codes, and the intended recipient.

The payment policy decides whether the agent is allowed to execute settlement. It is implemented as a Hedera Agent Kit `AbstractPolicy` around the HBAR transfer tool. It checks runtime controls such as allowed recipient, source account, exact amount, plan-level maximum, single-recipient transfer shape, duplicate-payment prevention, testnet-only execution, and non-PHI memo content.

This split is intentional. A workflow can pass the business policy but still be blocked by the payment policy if the transfer would violate a payment guardrail. The plan audit console shows both layers so reviewers can see whether a case failed because the work did not qualify, or because the payment controls stopped execution.

## Use Cases

### Provider Documentation Completeness

Prior authorization often stalls because required clinical documentation is missing, incomplete, or submitted after the fact. That creates avoidable rework for providers, plans, and patients.

In this flow, a provider selects a patient, plan, and requested service, checks coverage requirements, completes payer-requested documentation, and submits a synthetic PAS-style prior authorization. The business policy rewards complete, covered requests and blocks missing documentation or non-covered benefits. The payment policy then enforces HBAR settlement limits, including a plan-level maximum that can block a business-approved incentive when the requested transfer is too large.

Regulatory context: this use case supports 2024 CMS Interoperability and Prior Authorization Final Rule (CMS-0057-F) compliance readiness for non-drug items and services. It demonstrates coverage requirement discovery, documentation requirement collection, PAS-style prior authorization submission, payer-specific denial reasons, and auditable policy evidence that can help organizations operationalize CMS-0057-F prior authorization API workflows.

Demo links:

- https://contract-incentives.demo.labs.operon.cloud/provider-documentation - provider prior-authorization workflow
- https://contract-incentives.demo.labs.operon.cloud/provider-documentation/incentives - plan audit console
- https://contract-incentives.demo.labs.operon.cloud/provider-documentation/policies - policy catalog

### Delegate UM SLA Bonus

Health plans often delegate pharmacy utilization-management work to external vendors, but the operational incentive should be tied to timely, audit-ready completion, not to whether the request is approved or denied.

In this flow, eligible pharmacy prior-authorization work moves into a delegated UM workqueue. The vendor starts the review, records the determination, and the business policy checks whether the review was completed within the SLA with the required audit trail. The incentive is outcome-agnostic: the demo rewards compliant review execution, not denial volume or cost avoidance. Settlement still has to pass the Hedera payment policy.

Demo links:

- https://contract-incentives.demo.labs.operon.cloud/delegate-um - delegated UM workqueue
- https://contract-incentives.demo.labs.operon.cloud/delegate-um/plan - plan audit console
- https://contract-incentives.demo.labs.operon.cloud/delegate-um/policies - policy catalog

### Specialty Rx Fulfillment SLA

Approval is not the end of a specialty medication workflow. After a pharmacy-benefit PA is approved, delays can still occur during intake, benefits checks, prescription validation, shipment scheduling, delivery confirmation, or exception handling.

In this flow, an approved pharmacy PA becomes a specialty fulfillment case. The specialty pharmacy progresses through intake, clear-to-fill, shipment, and fulfillment checkpoints. The business policy rewards clean post-approval fulfillment execution and documents external blockers separately from avoidable exceptions. Payment is only attempted for qualifying fulfillment events and remains subject to the same HBAR transfer guardrails.

Regulatory context: this use case supports readiness for the 2026 CMS Interoperability Standards and Prior Authorization for Drugs Proposed Rule (CMS-0062-P). It connects drug-related prior authorization, documentation requirements, decision timeframes, denial-reason transparency, and public reporting concepts to a concrete specialty pharmacy workflow with policy-controlled incentives.

Demo links:

- https://contract-incentives.demo.labs.operon.cloud/specialty-rx - specialty pharmacy workflow
- https://contract-incentives.demo.labs.operon.cloud/specialty-rx/plan - plan audit console
- https://contract-incentives.demo.labs.operon.cloud/specialty-rx/policies - policy catalog

### Appeals Packet Quality

Appeals are time-sensitive and document-heavy. A provider or appeals team can create real value by assembling a complete, well-indexed appeal package, but the incentive should not depend on whether the appeal is ultimately won or lost.

In this flow, the provider appeals console starts from a denied prior authorization. The workflow validates the appeal request, confirms member and service alignment, retrieves the original decision context, resolves missing information, assembles the packet, and indexes the evidence. The business policy rewards packet readiness and excludes the final appeal outcome from payout logic. The payment policy then determines whether the resulting HBAR settlement is allowed.

Demo links:

- https://contract-incentives.demo.labs.operon.cloud/appeals - provider appeals console
- https://contract-incentives.demo.labs.operon.cloud/appeals/plan - plan audit console
- https://contract-incentives.demo.labs.operon.cloud/appeals/policies - policy catalog

## Structure

```text
src/
  apps/web/                  Next.js demo app and API routes
  mock-data/                 Demo payloads for each incentive workflow
  packages/audit-log/        Audit record and hash helpers
  packages/hedera-executor/  Hedera Agent Kit policy-bound payment executor
  packages/incentive-agent/  Demo orchestration over policies and requests
  packages/policy-engine/    Deterministic policy evaluator
  packages/um-platform/      Synthetic CRD/DTR/PAS prior-auth platform
```

## Hedera Bounty Submission Links

- Maintainer: Pavel Grebenshikov (`operonmaster`)
- Public repository: https://github.com/operonmaster/operon-labs-contract-incentives
- Live demo: https://contract-incentives.demo.labs.operon.cloud/
- Hedera Agent Kit feedback: https://github.com/hashgraph/hedera-agent-kit-js/issues/944

## License

Source code and documentation in this repository are licensed under the Apache License 2.0. Operon names, logos, private infrastructure, secrets, deployment materials, and production customer implementations are not included in that license grant.

### Provider Documentation Two-Page Demo

Open two browser pages:

- https://contract-incentives.demo.labs.operon.cloud/provider-documentation - provider portal prior-auth wizard
- https://contract-incentives.demo.labs.operon.cloud/provider-documentation/incentives - health-plan audit console

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

No wallet private keys, secret names, Terraform variables, service-account keys, or private deployment scripts belong in this public repo. Deployment and operator-runbook details are intentionally kept outside this public bounty repository.

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
