# Firestore Persistence Runtime Scope

## Purpose

`operon-labs-contract-incentives` can persist submitted prior authorization requests, policy-safe evidence, policy outcomes, and settlement controls in Firestore.

This public document describes the app/runtime contract only. Private deployment automation, cloud project IDs, service-account emails, IAM bindings, Terraform variables, and release scripts must stay outside this repository.

## Recommended Architecture

Keep one public Next.js Cloud Run service for the demo:

1. Browser submits the provider portal form to the Next.js app.
2. Next.js server route maps the request into a PAS-style FHIR Bundle.
3. Next.js server code writes the record to Firestore using the Cloud Run service account.
4. The incentive workflow reads policy-safe evidence derived from the stored PAS record.
5. The agent receives only the canonical PA/UM request ID and policy-safe evidence, not full FHIR or PHI-bearing payloads.

Do not add a separate backend API service for this first version. A separate API service can be introduced later if multiple apps need the same backend, if service-to-service authentication becomes a useful demo point, or if we want the public Next app to become UI-only.

## Runtime Project Configuration

Firestore mode requires an explicit project supplied by `GCP_PROJECT_ID` or `GOOGLE_CLOUD_PROJECT`. The app intentionally has no hardcoded public default project.

## Runtime Resources

### Firestore Database

Create or enable a Firestore database for PAS persistence.

Recommended starting point:

- Firestore mode: Native mode
- Database ID: `(default)`
- Location: choose the same standard location used by the deployment environment

Notes:

- Google documentation states that client libraries and gcloud use the `(default)` database if a database is not specified.
- Terraform can manage Firestore databases with `google_firestore_database`.
- Use Native mode for this app-style document persistence use case.

### Runtime Identity

Use a dedicated runtime identity for the app service. Do not use service-account key files.

### IAM

Grant the Cloud Run runtime service account only the access it needs.

Required:

- Firestore document read/write access for the app runtime service account

Pragmatic demo role:

- a Firestore read/write role scoped to the deployment project

Stricter future option:

- custom role with only the Firestore document permissions required by the adapter, if we decide the demo needs tighter IAM.

Do not grant browser clients direct Firestore access. All Firestore access must go through server-side Next.js route handlers or server-only modules.

### Runtime Environment Variables

The deployment environment should set these env vars on the Next.js service:

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

Optional app env vars for later:

```bash
PAS_COLLECTION_PREFIX=contract-incentives
PAS_FHIR_PROFILE_MODE=demo
```

Do not set `GOOGLE_APPLICATION_CREDENTIALS` in Cloud Run. Google client libraries should use Application Default Credentials from the attached Cloud Run service identity.

## Application Contract

The app will add a server-side store abstraction with two implementations:

- `firestore`: cloud-backed persistence/reference data
- `memory`: explicit local/test fallback

The app will choose transactional persistence using `PAS_STORE_BACKEND`, patient/CRD/DTR reference storage using `UM_REFERENCE_STORE_BACKEND`, business policy storage using `POLICY_STORE_BACKEND`, payment policy storage using `PAYMENT_POLICY_STORE_BACKEND`, payment-policy evidence storage using `PAYMENT_POLICY_EVIDENCE_STORE_BACKEND`, and Hedera payment-intent reservation using `PAYMENT_INTENT_STORE_BACKEND`.

Expected app behavior:

- If `PAS_STORE_BACKEND` is missing, use Firestore and require an explicit project id.
- If `PAS_STORE_BACKEND=memory`, use in-process memory for isolated tests or offline demos.
- If `PAS_STORE_BACKEND=firestore`, use `GCP_PROJECT_ID` or `GOOGLE_CLOUD_PROJECT`; otherwise fail with `GCP_PROJECT_ID_REQUIRED`.
- If `UM_REFERENCE_STORE_BACKEND` is missing, use Firestore and require an explicit project id.
- If `UM_REFERENCE_STORE_BACKEND=memory`, use seeded in-process patient, CRD, and DTR reference data for isolated tests or offline demos.
- If `POLICY_STORE_BACKEND` is missing, use Firestore and require an explicit project id.
- If `POLICY_STORE_BACKEND=memory`, use seeded in-process policies for isolated tests only.
- If `PAYMENT_POLICY_STORE_BACKEND` is missing, use Firestore and require an explicit project id.
- If `PAYMENT_POLICY_STORE_BACKEND=memory`, use seeded in-process payment policies for isolated tests only.
- If `PAYMENT_POLICY_EVIDENCE_STORE_BACKEND` is missing, use Firestore and require an explicit project id.
- If `PAYMENT_POLICY_EVIDENCE_STORE_BACKEND=memory`, skip durable payment-policy evidence writes for isolated tests only.
- If `PAYMENT_INTENT_STORE_BACKEND` is missing, use Firestore and require an explicit project id.
- If `PAYMENT_INTENT_STORE_BACKEND=memory`, skip durable payment-intent reservation for isolated tests only.
- Use `FIRESTORE_DATABASE_ID` when provided, otherwise default to `(default)`.
- Never require service account key files in deployed Cloud Run.

## Firestore Collection Design

Use simple collections. Avoid complex subcollection schemes for the first version.

Reference-data collections:

- `patients/{patientId}` stores demo Patient display and active Coverage context.
- `coverageRequirementRules/{planId}_{requestType}_{serviceCode}` stores Da Vinci CRD coverage, PA requirement, billing code, covered-benefit status, and optional `documentationTemplateId` reference rules.
- `questionnaires/{questionnaireId}` stores FHIR Questionnaire templates used by DTR, including numbered questions and answer options.

Transactional collections:

### `incentivePolicies/{policyId}`

Stores pair/request-type-scoped business incentive policies used by runtime evaluation and payment controls. A plan/provider pair can have more than one active policy, usually split by request type, service-code block, or payout. The document id is an opaque policy id, not the `evaluationType`; runtime lookup filters by `evaluationType`, `contractPair.planId`, `contractPair.providerId`, optional `requestType`, `status`, and `effectivePeriod`. Store plan and provider display names alongside ids to keep policy views self-contained.

The demo seed set includes four Provider Documentation Completeness policies:

- Acme Health PPO + Lakeside Provider Admin + outpatient service
- Acme Health PPO + Lakeside Provider Admin + pharmacy benefit
- Summit Health HMO + Lakeside Provider Admin + outpatient service
- Summit Health HMO + Lakeside Provider Admin + pharmacy benefit

Do not store a free-text policy display name. UI labels are generated from the plan name, provider name, and request-type scope.

Shape:

```json
{
  "policyId": "plcy_8K2M4Q6R9T1V3X5Z7B0C",
  "version": "v1",
  "status": "active",
  "evaluationType": "provider_documentation_completeness",
  "contractPair": {
    "planId": "acme-health-ppo",
    "planName": "Acme Health PPO",
    "providerId": "lakeside-provider-admin",
    "providerName": "Lakeside Provider Admin"
  },
  "effectivePeriod": {
    "startsOn": "2026-05-01",
    "endsOn": null
  },
  "incentiveScope": {
    "eligibleRequestTypes": ["outpatient_service"],
    "includedServiceCodes": {
      "cpt": ["73721"],
      "ndc": []
    }
  },
  "eligibilityCriteria": {
    "appliesOnlyToCoveredBenefits": true,
    "requiresDtrCompletionWhenRequested": true
  },
  "payout": {
    "token": "HBAR",
    "amountPerEligibleRequest": 5,
    "monthlyCap": 500
  },
  "settlement": {
    "mode": "auto",
    "recipientWalletId": "0.0.9049549",
    "requiresHumanApproval": false
  },
  "updatedAt": "2026-05-24T00:00:00.000Z",
  "updatedBy": "operon-labs-contract-incentives"
}
```

Runtime evaluation reads current Firestore policy documents during lookup. Do not use YAML policy files as a runtime source of truth. CRD coverage rules and DTR questionnaire rules stay in their own UM reference collections; they do not belong inside the business incentive policy.

### `paymentPolicies/{planId}`

Stores flat plan-level Hedera Agent Kit settlement controls. These documents do not re-run CRD, DTR, or business incentive logic. They select centrally maintained Agent Kit control blocks for a participating plan and provide the token and amount limits used immediately before transfer execution.

The demo seed set includes two policies:

- Acme Health PPO
- Summit Health HMO

Shape:

```json
{
  "planId": "acme-health-ppo",
  "planName": "Acme Health PPO",
  "status": "active",
  "version": "v1",
  "businessEvaluationAttestation": true,
  "duplicatePaymentPrevention": true,
  "maxPaymentPerRequest": true,
  "paymentToken": "HBAR",
  "maxPaymentAmount": 5,
  "paymentEnvelopeIntegrity": true,
  "updatedAt": "2026-05-24T00:00:00.000Z",
  "updatedBy": "operon-labs-contract-incentives"
}
```

The business evaluation attestation control fetches `incentiveEvaluations/{businessEvaluationId}` and `incentivePolicies/{businessPolicyId}` once during payment execution to confirm that the approved evaluation was recorded and that the referenced business policy remains active. It does not fetch PAS evidence or re-evaluate healthcare business criteria. The business evaluation id is deterministic: `businessEvaluationId = ie_sha256(umRequestId | businessPolicyId)`.

### `paymentPolicyEvidences/{paymentIntentId}`

Stores the runtime output of the Hedera Agent Kit payment policy checks. This is the audit bridge between the internal business-policy evaluation and the Hedera settlement attempt. The document id matches the settlement intent id, where `paymentIntentId = pi_sha256(umRequestId | businessPolicyId | paymentPolicyId)`. The readable PA/UM request id remains in `umRequestId`, `caseId`, and the Hedera transaction memo.

Policy outcome status is stored as canonical data, not as display-only labels. `incentiveEvaluations` uses `businessPolicyStatus: "approved" | "rejected" | null` and `paymentPolicyStatus: "paid" | "blocked" | null`; null means the policy surface has not produced a final outcome yet. `paymentPolicyEvidences.outcome` uses the canonical payment-policy outcome, `paid` or `blocked`. Lifecycle fields such as `incentiveStatus`, `paymentStatus`, and `paymentIntents.status` remain execution/backward-compatibility details and are not the policy outcome data model.

Shape:

```json
{
  "paymentIntentId": "pi_1f2e3d4c5b6a79800112233445566778",
  "umRequestId": "PA-260527-1132-GNJNP7AE",
  "caseId": "PA-260527-1132-GNJNP7AE",
  "incentiveEvaluationId": "ie_0123456789abcdef0123456789abcdef",
  "planId": "summit-health-hmo",
  "paymentPolicyId": "summit-health-hmo",
  "businessPolicyId": "delegate-um-summit-pharmacy-sla-bonus-v1",
  "runtime": "hedera-agent-kit-policy",
  "outcome": "paid",
  "failureCode": null,
  "requestedPayment": {
    "amount": 5,
    "token": "HBAR",
    "recipientWalletId": "0.0.9049549"
  },
  "controls": [
    {
      "id": "businessEvaluationAttestation",
      "label": "Business evaluation attestation",
      "status": "passed"
    },
    {
      "id": "maxPaymentPerRequest",
      "label": "Max payment per request",
      "status": "passed",
      "expected": "<= 7 HBAR",
      "actual": "5 HBAR"
    }
  ],
  "transactionId": "0.0.6870566@1779686274.765050870",
  "createdAt": "2026-05-24T00:00:00.000Z",
  "updatedAt": "2026-05-24T00:00:00.000Z"
}
```

### `pasClaims/{umRequestId}`

Stores the submitted prior authorization record, policy-safe evidence projection, and PAS-style synthetic FHIR Bundle. The implemented app shape is intentionally nested so the domain record, policy evidence, and FHIR artifact stay distinct.

Shape:

```json
{
  "umRequest": {
    "id": "PA-260524-2102-AAAA1111",
    "caseId": "PA-260524-2102-AAAA1111",
    "sourceCaseId": "PA-260524-2102-AAAA1111",
    "patientId": "patient-maya-chen",
    "patientDisplay": "Maya Chen",
    "providerGroupId": "lakeside-provider-admin",
    "providerGroupDisplay": "Lakeside Provider Admin",
    "requestType": "outpatient_service",
    "serviceCode": "knee_mri",
    "serviceLabel": "Knee MRI after injury",
    "codingSystem": "CPT",
    "billingCode": "73721",
    "submittedAt": "2026-05-24T00:00:00.000Z",
    "pasSubmitted": true,
    "submittedBeforeInitialDecision": true,
    "paResult": "submitted_pending",
    "denialReason": null
  },
  "evidence": {
    "caseId": "PA-260524-2102-AAAA1111",
    "umRequestId": "PA-260524-2102-AAAA1111",
    "sourceCaseId": "PA-260524-2102-AAAA1111",
    "planId": "acme-health-ppo",
    "providerId": "lakeside-provider-admin",
    "requestType": "outpatient_service",
    "serviceCode": "knee_mri",
    "codingSystem": "CPT",
    "billingCode": "73721",
    "crdCoverageChecked": true,
    "crdCoveredBenefit": true,
    "dtrRequested": true,
    "dtrTemplateCompleted": true,
    "attachmentChecklistComplete": true,
    "fhirFieldsPresent": true,
    "pasSubmitted": true,
    "submittedBeforeInitialDecision": true,
    "paResultUsedForPositivePayment": false,
    "approvalOutcomeUsed": false,
    "referralVolumeMetricUsed": false,
    "containsPhi": false
  },
  "fhirBundle": {
    "resourceType": "Bundle",
    "id": "PA-260524-2102-AAAA1111",
    "type": "collection",
    "entry": [
      {
        "resource": {
          "resourceType": "Claim",
          "id": "PA-260524-2102-AAAA1111",
          "use": "preauthorization"
        }
      }
    ]
  },
  "storedAt": "2026-05-24T00:00:00.000Z"
}
```

### `auditEvents/{eventId}`

Stores auditable PAS lifecycle markers for async incentive processing.

Shape:

```json
{
  "eventType": "PAS_SUBMITTED",
  "caseId": "PA-260524-2102-AAAA1111",
  "umRequestId": "PA-260524-2102-AAAA1111",
  "submittedAt": "2026-05-24T00:00:00.000Z",
  "storedAt": "2026-05-24T00:00:00.000Z"
}
```

### `incentiveEvaluations/{businessEvaluationId}`

Stores plan-side policy evaluation and payment/audit results. The document id is `businessEvaluationId = ie_sha256(umRequestId | businessPolicyId)`, so Provider Documentation and Delegate UM evaluations for the same PA/UM request do not overwrite each other.

Shape:

```json
{
  "id": "ie_0123456789abcdef0123456789abcdef",
  "umRequestId": "PA-260527-1132-GNJNP7AE",
  "caseId": "PA-260527-1132-GNJNP7AE",
  "submittedAt": "2026-05-24T00:00:00.000Z",
  "policyId": "delegate-um-summit-pharmacy-sla-bonus-v1",
  "businessPolicyId": "delegate-um-summit-pharmacy-sla-bonus-v1",
  "paymentPolicyId": "summit-health-hmo",
  "paymentIntentId": "pi_1f2e3d4c5b6a79800112233445566778",
  "businessPolicyStatus": "approved",
  "paymentPolicyStatus": "paid",
  "incentiveStatus": "paid",
  "paymentStatus": "auto_executed",
  "incentiveValue": 5,
  "currency": "HBAR",
  "settlementToken": {
    "symbol": "HBAR"
  },
  "reasonCodes": [],
  "policyCriteria": [],
  "audit": {
    "id": "audit_abc123",
    "transactionId": "0.0.1001@1716500000.000000001"
  },
  "transactionId": "0.0.1001@1716500000.000000001",
  "storedAt": "2026-05-24T00:00:00.000Z"
}
```

Persisting `incentiveEvaluations` is recommended once Firestore is introduced, because otherwise PA requests survive restart but their plan-side payment/audit rows do not.

### `paymentIntents/{paymentIntentId}`

Stores the durable Hedera Agent Kit settlement intent used to prevent duplicate payments at transfer execution time. The document id is `paymentIntentId = pi_sha256(umRequestId | businessPolicyId | paymentPolicyId)`, so duplicate prevention blocks only the same settlement triplet and not every incentive attached to the same PA/UM request.

Shape:

```json
{
  "id": "pi_1f2e3d4c5b6a79800112233445566778",
  "auditId": "audit_abc123",
  "umRequestId": "PA-260527-1132-GNJNP7AE",
  "caseId": "PA-260527-1132-GNJNP7AE",
  "incentiveEvaluationId": "ie_0123456789abcdef0123456789abcdef",
  "planId": "summit-health-hmo",
  "policyId": "delegate-um-summit-pharmacy-sla-bonus-v1",
  "businessPolicyId": "delegate-um-summit-pharmacy-sla-bonus-v1",
  "paymentPolicyId": "summit-health-hmo",
  "policyVersion": "v1",
  "triggerEvent": "UM_REQUEST_DETERMINED",
  "token": "HBAR",
  "amount": 5,
  "sourceAccountId": "0.0.6870566",
  "recipientAccountId": "0.0.9049549",
  "transactionMemo": "PA-260527-1132-GNJNP7AE",
  "status": "submitted",
  "transactionId": "0.0.6870566@1779686274.765050870",
  "createdAt": "2026-05-24T00:00:00.000Z",
  "updatedAt": "2026-05-24T00:00:00.000Z"
}
```

The Agent Kit `AbstractPolicy` blocks execution when this same intent already exists, when the recorded business evaluation cannot be attested, when the transfer envelope is changed, or when the transfer amount exceeds the plan policy maximum. A Provider Documentation incentive and a Delegate UM incentive can both settle for the same `umRequestId` because their `businessPolicyId` values produce different intent ids.

## FHIR/PAS Expectations

The app repo will map the demo submission into a PAS-style FHIR Bundle.

Minimum expected Bundle content:

- `Bundle`
- `Claim` with `use: "preauthorization"`
- synthetic `Patient`
- provider `Organization`
- insurer `Organization`
- Claim item coding:
  - CPT for outpatient services
  - NDC for pharmacy benefit requests

The full FHIR Bundle is for demo/audit legitimacy. The incentive agent should not receive the full Bundle. It should receive only policy-safe evidence derived from the stored request.

## Security Boundary

Public app repo:

- may contain Firestore adapter code
- may contain collection names and env var names
- must not contain Terraform state, service account keys, secrets, private project bootstrapping details, or privileged IAM bindings

Private deployment environment:

- owns Firestore database declaration
- owns runtime identity declaration
- owns IAM bindings
- owns runtime env var configuration
- owns deployment wiring

Runtime:

- runtime identity authenticates to Firestore.
- No browser-to-Firestore access.
- No service account key file.
- No PHI should be sent to the incentive agent or Hedera-facing policy/payment layer.

## Deployment Boundary

Keep Terraform, project IDs, service-account identifiers, IAM bindings, managed secret names, Cloud Build definitions, Makefiles, and deployment scripts outside this public repository. The public source only needs the env var contract and collection schema.

## Local Development Contract

Offline local development can explicitly opt out of Firestore and Hedera transfers:

```bash
npm run dev:simulated
```

Firestore local/dev targets must be explicit:

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

For local Firestore testing, use developer ADC from `gcloud auth application-default login` only if needed. Do not commit credentials or key files.

For dev resets after a settlement identity change, run the app repo purge utility:

```bash
node scripts/purge-demo-settlement-state.mjs --dry-run
node scripts/purge-demo-settlement-state.mjs --confirm
```

The utility deletes only `umRequests`, `pasClaims`, `auditEvents`, `incentiveEvaluations`, `paymentPolicyEvidences`, and `paymentIntents`. It never deletes `incentivePolicies`, `paymentPolicies`, or reference data.

## Acceptance Criteria

Runtime persistence is ready when:

1. Firestore Native database exists in the configured project.
2. The app service runs as a dedicated runtime identity.
3. That runtime identity can create/read/update documents in the planned collections.
4. The deployed app has the Firestore env vars set.
5. Submitting a PA in the deployed app writes a `pasClaims/{umRequestId}` document.
6. Restarting/redeploying the app does not lose submitted PAS requests.
7. Plan-side incentive rows remain available after restart once `incentiveEvaluations` persistence is implemented.
8. No service account keys or Terraform files are introduced into the public app repo.

## References

- Firestore database management: https://cloud.google.com/firestore/native/docs/manage-databases
- Firestore Terraform resource: https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/firestore_database
- Firestore IAM roles: https://docs.cloud.google.com/iam/docs/roles-permissions/firestore
- Cloud Run service identity: https://cloud.google.com/run/docs/configuring/services/service-identity
- Cloud Run service-to-service auth, for possible future split: https://cloud.google.com/run/docs/authenticating/service-to-service
- FHIR R4 resource index: https://hl7.org/fhir/R4/resourcelist.html
- Da Vinci PAS formal specification: https://hl7.org/fhir/us/davinci-pas/STU2.1/specification.html
- Da Vinci CRD foundational requirements: https://hl7.org/fhir/us/davinci-crd/STU2.1/foundation.html
- Da Vinci DTR formal specification: https://hl7.org/fhir/us/davinci-dtr/STU2.1/specification.html
