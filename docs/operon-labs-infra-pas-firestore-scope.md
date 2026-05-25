# Operon Labs Infra Scope: Firestore PAS Persistence

## Purpose

`operon-labs-contract-incentives` currently stores submitted prior authorization requests and incentive rows in the Next.js process memory. For the first deployed Operon Labs use case, the app should keep its simple one-service shape but persist submitted PAS-style prior authorization requests in Firestore.

This document is the infra handoff for `operon-labs-infra`. It describes the GCP resources, IAM, runtime configuration, and app contract needed by the public application repo. Terraform implementation should live in `operon-labs-infra`, not in this public app repo.

## Recommended Architecture

Keep one public Next.js Cloud Run service for the demo:

1. Browser submits the provider portal form to the Next.js app.
2. Next.js server route maps the request into a PAS-style FHIR Bundle.
3. Next.js server code writes the record to Firestore using the Cloud Run service account.
4. The incentive workflow reads policy-safe evidence derived from the stored PAS record.
5. The agent receives only `caseId` and policy-safe evidence, not full FHIR or PHI-bearing payloads.

Do not add a separate backend API service for this first version. A separate API service can be introduced later if multiple apps need the same backend, if service-to-service authentication becomes a useful demo point, or if we want the public Next app to become UI-only.

## Target GCP Project

Use the existing Operon Labs non-production project:

- Project ID: `operon-labs-nonprod`
- Environment: nonprod/demo
- Repo that declares infra: `operon-labs-infra`
- App repo that consumes infra: `operon-labs-contract-incentives`

## GCP Resources To Declare

### Firestore Database

Create or enable a Firestore database for PAS persistence.

Recommended starting point:

- Firestore mode: Native mode
- Database ID: `(default)`
- Location: choose the same standard location used by the project, preferably aligned with the Cloud Run region or existing Operon Labs standards

Notes:

- Google documentation states that client libraries and gcloud use the `(default)` database if a database is not specified.
- Terraform can manage Firestore databases with `google_firestore_database`.
- Use Native mode for this app-style document persistence use case.

### Cloud Run Service Account

Create a dedicated user-managed service account for the app Cloud Run service.

Suggested service account:

- Account ID: `operon-labs-contract-incentives-web`
- Display name: `Operon Labs Contract Incentives Web`
- Purpose: runtime identity for the public Next.js Cloud Run service

Cloud Run should run as this service account. Do not use service account keys.

### IAM

Grant the Cloud Run runtime service account only the access it needs.

Required:

- Firestore document read/write access for the app runtime service account

Pragmatic demo role:

- `roles/datastore.user` on project `operon-labs-nonprod`

Stricter future option:

- custom role with only the Firestore document permissions required by the adapter, if we decide the demo needs tighter IAM.

Do not grant browser clients direct Firestore access. All Firestore access must go through server-side Next.js route handlers or server-only modules.

### Cloud Run Runtime Environment Variables

The infra deployment should set these env vars on the Next.js Cloud Run service:

```bash
PAS_STORE_BACKEND=firestore
UM_REFERENCE_STORE_BACKEND=firestore
POLICY_STORE_BACKEND=firestore
GCP_PROJECT_ID=operon-labs-nonprod
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

- `firestore`: default local and deployed persistence/reference data
- `memory`: explicit local/test fallback

The app will choose transactional persistence using `PAS_STORE_BACKEND`, patient/CRD/DTR reference storage using `UM_REFERENCE_STORE_BACKEND`, and policy storage using `POLICY_STORE_BACKEND`.

Expected app behavior:

- If `PAS_STORE_BACKEND` is missing, use Firestore in `operon-labs-nonprod`.
- If `PAS_STORE_BACKEND=memory`, use in-process memory for isolated tests or offline demos.
- If `PAS_STORE_BACKEND=firestore`, use `GCP_PROJECT_ID` when set, otherwise default to `operon-labs-nonprod`.
- If `UM_REFERENCE_STORE_BACKEND` is missing, use Firestore in `operon-labs-nonprod`.
- If `UM_REFERENCE_STORE_BACKEND=memory`, use seeded in-process patient, CRD, and DTR reference data for isolated tests or offline demos.
- If `POLICY_STORE_BACKEND` is missing, use Firestore in `operon-labs-nonprod`.
- If `POLICY_STORE_BACKEND=memory`, use seeded in-process policies for isolated tests only.
- Use `FIRESTORE_DATABASE_ID` when provided, otherwise default to `(default)`.
- Never require service account key files in deployed Cloud Run.

## Firestore Collection Design

Use simple collections. Avoid complex subcollection schemes for the first version.

Reference-data collections:

- `patients/{patientId}` stores demo Patient display and active Coverage context.
- `coverageRequirementRules/{planId}_{requestType}_{serviceCode}` stores Da Vinci CRD coverage, PA requirement, billing code, covered-benefit status, and optional `documentationTemplateId` reference rules.
- `questionnaires/{questionnaireId}` stores FHIR Questionnaire templates used by DTR, including numbered questions and answer options.

Transactional collections:

### `incentivePolicies/{evaluationType}`

Stores the active policy object used by runtime evaluation and payment controls. The document id is the `evaluationType`, for example `provider_documentation_completeness`.

Shape:

```json
{
  "evaluationType": "provider_documentation_completeness",
  "policyId": "provider-documentation-completeness-v1",
  "status": "active",
  "policy": {
    "id": "provider-documentation-completeness-v1",
    "evaluationType": "provider_documentation_completeness",
    "submitterRules": {
      "allowedSubmitterTypes": ["provider_admin_team"],
      "allowedSubmitters": ["lakeside-provider-admin"],
      "walletMap": {
        "lakeside-provider-admin": "0.0.9049549"
      }
    },
    "requiredEvidence": ["caseId", "requestType"],
    "approvalRules": [],
    "paymentFormula": {
      "baseAmount": 5,
      "maxPerRequest": 5,
      "monthlyCap": 500,
      "token": {
        "symbol": "HBAR"
      }
    },
    "requiresHumanApproval": false
  },
  "updatedAt": "2026-05-24T00:00:00.000Z",
  "updatedBy": "operon-labs-contract-incentives"
}
```

Runtime evaluation reads the current Firestore document on each evaluation. Do not use YAML policy files as a runtime source of truth.

### `pasClaims/{caseId}`

Stores the submitted prior authorization record, policy-safe evidence projection, and PAS-style synthetic FHIR Bundle. The implemented app shape is intentionally nested so the domain record, policy evidence, and FHIR artifact stay distinct.

Shape:

```json
{
  "record": {
    "caseId": "PA-260524-2102-AAAA1111",
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
    "requestType": "outpatient_service",
    "serviceCode": "knee_mri",
    "codingSystem": "CPT",
    "billingCode": "73721",
    "crdCoverageChecked": true,
    "crdCoveredBenefit": true,
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
    "id": "pas-PA-260524-2102-AAAA1111",
    "type": "collection",
    "entry": [
      {
        "resource": {
          "resourceType": "Claim",
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
  "submittedAt": "2026-05-24T00:00:00.000Z",
  "storedAt": "2026-05-24T00:00:00.000Z"
}
```

### `incentiveEvaluations/{caseId}`

Stores plan-side policy evaluation and payment/audit results.

Shape:

```json
{
  "caseId": "PA-260524-2102-AAAA1111",
  "submittedAt": "2026-05-24T00:00:00.000Z",
  "policyId": "provider-documentation-completeness-v1",
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

Private infra repo:

- owns Firestore database declaration
- owns Cloud Run service account declaration
- owns IAM bindings
- owns runtime env var configuration
- owns deployment wiring

Runtime:

- Cloud Run service identity authenticates to Firestore.
- No browser-to-Firestore access.
- No service account key file.
- No PHI should be sent to the incentive agent or Hedera-facing policy/payment layer.

## Terraform Work Items For `operon-labs-infra`

1. Add an app/runtime service account for `operon-labs-contract-incentives`.
2. Enable required APIs if not already enabled:
   - Firestore API
   - Cloud Run API
   - IAM API
   - Artifact Registry API if this repo deploys app images through GCP build/deploy flow
3. Declare Firestore Native database or verify existing `(default)` database is managed/imported.
4. Grant the app runtime service account `roles/datastore.user`.
5. Configure the Cloud Run service to run as that service account.
6. Set runtime env vars:
   - `PAS_STORE_BACKEND=firestore`
   - `UM_REFERENCE_STORE_BACKEND=firestore`
   - `POLICY_STORE_BACKEND=firestore`
   - `GCP_PROJECT_ID=operon-labs-nonprod`
   - `FIRESTORE_DATABASE_ID=(default)`
7. Add outputs useful to the app/deploy pipeline:
   - app service account email
   - Firestore database ID
   - project ID
   - Cloud Run service name/URL, if Cloud Run is declared here

## Suggested Terraform Resource Names

These names are suggestions; align them with existing `operon-labs-infra` conventions if different.

```hcl
resource "google_service_account" "contract_incentives_web" {
  account_id   = "operon-labs-contract-incentives-web"
  display_name = "Operon Labs Contract Incentives Web"
}

resource "google_firestore_database" "default" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"
}

resource "google_project_iam_member" "contract_incentives_firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.contract_incentives_web.email}"
}
```

Cloud Run resource/module should attach:

```hcl
service_account_name = google_service_account.contract_incentives_web.email

env = {
  PAS_STORE_BACKEND          = "firestore"
  UM_REFERENCE_STORE_BACKEND = "firestore"
  GCP_PROJECT_ID             = var.project_id
  FIRESTORE_DATABASE_ID = "(default)"
}
```

## Local Development Contract

Offline local development can explicitly opt out of Firestore:

```bash
PAS_STORE_BACKEND=memory npm run dev
```

For fully offline local reference data too:

```bash
PAS_STORE_BACKEND=memory UM_REFERENCE_STORE_BACKEND=memory npm run dev
```

Firestore local/dev defaults can be made explicit with:

```bash
PAS_STORE_BACKEND=firestore
UM_REFERENCE_STORE_BACKEND=firestore
POLICY_STORE_BACKEND=firestore
GCP_PROJECT_ID=operon-labs-nonprod
FIRESTORE_DATABASE_ID=(default)
```

For local Firestore testing, use developer ADC from `gcloud auth application-default login` only if needed. Do not commit credentials or key files.

## Acceptance Criteria

Infra is ready when:

1. Firestore Native database exists in `operon-labs-nonprod`.
2. The app Cloud Run service runs as a dedicated service account.
3. That service account can create/read/update documents in the planned collections.
4. The deployed app has the Firestore env vars set.
5. Submitting a PA in the deployed app writes a `pasClaims/{caseId}` document.
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
