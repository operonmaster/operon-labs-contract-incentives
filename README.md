# Operon Labs Contract Incentives

Policy-gated healthcare operations incentive demo for the Hedera hackathon. The demo keeps the public repo focused on app code, mock policies, Hedera Agent Kit integration points, and a simulated testnet execution boundary.

## Structure

```text
docs/
  Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md
  standards/nextjs-standard.md
src/
  apps/web/                  Next.js demo app and API routes
  mock-data/                 Demo payloads for each incentive workflow
  packages/audit-log/        Audit record and hash helpers
  packages/hedera-executor/  Simulated Hedera payment executor
  packages/incentive-agent/  Demo orchestration over policies and requests
  packages/policy-engine/    Deterministic policy evaluator
  packages/um-platform/      Synthetic CRD/DTR/PAS prior-auth platform
  policies/                  Versioned YAML incentive policies
```

## Demo Surfaces

- `/` - demo catalog
- `/delegate-um` - delegated utilization management SLA bonus
- `/provider-documentation` - provider documentation completeness incentive
- `/provider-documentation/incentives` - health-plan audit console for provider documentation incentives
- `/appeals` - appeals packet quality incentive
- `/provider-directory` - provider directory quality incentive

### Provider Documentation Two-Page Demo

Open two browser pages:

- `/provider-documentation` - provider portal prior-auth wizard
- `/provider-documentation/incentives` - health-plan audit console

Demo sequence:

1. In the provider portal, select `Maya Chen`, `Acme Health PPO`, and `Knee MRI after injury`.
2. Check requirements, complete the assessment, and submit the prior authorization.
3. Use the top navigation or confirmation CTA to open the health-plan audit console.
4. Review the `3 USDC` policy-paid row and inspect the Hedera testnet transaction details.
5. Return to the provider portal and submit a second `Knee MRI after injury` request, but skip the assessment.
6. In the plan console, review the `0 USDC` policy-blocked row with missing documentation reasons.
7. Return to the provider portal and submit `Full-body wellness MRI screening` after acknowledging the not-covered warning.
8. In the plan console, review the `0 USDC` policy-blocked row with `BENEFIT_NOT_COVERED`.

## API Routes

- `POST /api/evaluations` - evaluates a demo request against a versioned policy
- `POST /api/payments/approve` - simulates policy-gated payment approval
- `GET /api/audit/[id]` - returns a deterministic demo audit record
- `GET /api/um/prior-auths` - lists synthetic prior-auth submissions
- `POST /api/um/prior-auths` - submits a synthetic prior-auth request
- `GET /api/um/prior-auths/[caseId]/evidence` - returns policy-safe UM evidence
- `GET /api/um/patients` - returns seeded patient and coverage context for the provider portal
- `GET /api/provider-documentation/incentives` - lists plan-side incentive audit rows
- `POST /api/provider-documentation/incentives/[caseId]/approve` - deprecated demo route; provider-documentation payments auto-settle after policy approval

Provider-documentation incentives are triggered asynchronously after `PAS_SUBMITTED`. The agent receives only the PA `caseId`, pulls policy-safe evidence from the synthetic UM Platform, and records either an automatic testnet transaction or a zero-value policy block.

## PAS Persistence

Local development and deployed Cloud Run default to Firestore-backed PAS persistence in `operon-labs-nonprod`:

```bash
PAS_STORE_BACKEND=firestore
UM_REFERENCE_STORE_BACKEND=firestore
GCP_PROJECT_ID=operon-labs-nonprod
FIRESTORE_DATABASE_ID=(default)
```

For isolated test runs or offline demos, explicitly opt out with `PAS_STORE_BACKEND=memory`.

UM reference data also defaults to Firestore. Use `UM_REFERENCE_STORE_BACKEND=memory` only for isolated tests or offline demos.

The Firestore adapter writes:

- `pasClaims/{caseId}` with the prior-auth record, policy-safe evidence, and PAS-style FHIR `Bundle` containing the `Claim`.
- `auditEvents/{caseId}-PAS_SUBMITTED` for auditable async incentive processing.
- `incentiveEvaluations/{caseId}` so policy payment outcomes are idempotent across Cloud Run restarts.

The UM reference adapter auto-seeds these demo reference collections when they are missing:

- `patients/{patientId}` for Patient-anchored display and active Coverage context.
- `coverageRequirementRules/{planId}_{requestType}_{serviceCode}` for Da Vinci CRD coverage and PA requirement reference rules.
- `questionnaires/{questionnaireId}` for FHIR Questionnaire templates used by the DTR flow.

Full FHIR bundles stay server-side. The incentive agent receives policy-safe evidence only.

## Local Development

```bash
nvm use
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Container Build And Deployment

The deployment assets follow the Operon platform webapp pattern:

- `Dockerfile` builds a production Next.js standalone server for Cloud Run.
- `Makefile` is the local/CI entrypoint for validation, image build, image push, and deploy.
- `scripts/ci/deploy.sh` updates an existing Terraform-managed Cloud Run service with `--cpu-throttling`.
- `cloudbuild-build.yaml` and `cloudbuild-deploy.yaml` mirror the build/deploy split used by Operon webapps.

Build and push the initial image before applying the `operon-labs-infra` `web-app` layer:

```bash
make ci-build
```

That publishes all tags expected by the deployment flow, including the Terraform bootstrap tag:

```text
us-central1-docker.pkg.dev/operon-labs-nonprod/operon-labs-docker/contract-incentives-web:latest
```

After Terraform creates the Cloud Run service, deploy later revisions with:

```bash
make deploy
```

The deploy script intentionally fails if `contract-incentives-web` does not already exist, so service creation stays in Terraform.
