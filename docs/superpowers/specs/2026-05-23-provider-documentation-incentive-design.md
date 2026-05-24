# Provider Documentation Incentive Use Case Design

## Purpose

Build a provider-documentation demo that feels like a normal prior authorization workflow while showing how a plan-side contract incentive can be triggered asynchronously after PAS submission. The provider portal does not initiate payment, does not send policy evidence to the agent, and does not frame documentation completion as a direct payment action.

The demo makes three ideas obvious:

- CRD/DTR/PAS can improve completeness before a PA request is submitted.
- The plan can evaluate provider-documentation incentive eligibility after PAS submission using contract-defined evidence from its UM platform.
- Hedera payment execution is controlled by policy, allowed counterparties, caps, reason codes, and human approval.

## User Experience Direction

Use a forked guided wizard on `/provider-documentation`.

The same synthetic patient, ordering provider, facility, and plan context are used for both service choices. The user chooses one service:

- `Knee MRI after injury`: covered service, PA required, DTR documentation can be completed, PAS is submitted, and incentive eligibility is positive.
- `Full-body wellness MRI screening`: not covered benefit, provider can acknowledge the warning and submit anyway, PAS is submitted with a denial/not-covered reason, and incentive value is guaranteed to be zero.

The provider portal shows a neutral documentation completeness gauge. It does not show wallets, Hedera, direct payment language, or incentive value while the provider is documenting the PA request.

## Provider Portal Flow

Route: `/provider-documentation`

### 1. Case Setup

The provider user opens a new prior authorization wizard.

Displayed data:

- synthetic adult patient
- ordering provider
- facility
- payer/plan context
- service selector

Actions:

- choose `Knee MRI after injury`
- choose `Full-body wellness MRI screening`
- click `Check coverage requirements`

### 2. CRD-Style Coverage Check

For `Knee MRI after injury`:

- CRD status: covered service
- prior authorization required
- DTR documentation template returned
- required documentation shown:
  - symptom duration
  - conservative therapy tried
  - physical exam findings
  - clinical note attachment

For `Full-body wellness MRI screening`:

- CRD status: not covered benefit
- reason code: `BENEFIT_NOT_COVERED`
- UI warning: full-body wellness MRI screening without symptoms is not covered by this plan
- provider must acknowledge the warning before submitting

### 3. DTR-Style Documentation

For the knee MRI path only, the provider answers or confirms DTR-style prompts.

Evidence captured in UM platform state:

- DTR template completed
- required questions answered
- attachment checklist complete
- clinical note attached
- required FHIR/profile fields present

The documentation gauge advances through:

- coverage requirements checked
- DTR documentation complete
- attachments ready
- PAS submitted before cutoff

### 4. PAS Submission

Both service choices can produce a PAS submission.

For `Knee MRI after injury`:

- PAS status: submitted
- PA result shown to provider: submitted / pending
- no approval or denial outcome is needed for positive incentive eligibility

For `Full-body wellness MRI screening`:

- PAS status: submitted
- PA result shown to provider: denied / not covered benefit
- denial reason: `BENEFIT_NOT_COVERED`
- incentive result is guaranteed zero

After PAS, the provider sees a normal submission confirmation with the PA ID. The provider portal does not call incentive or payment APIs directly.

## Plan-Side Incentives Console

Route: `/provider-documentation/incentives`

The plan-side page is a PA incentive worklist for submitted PA requests. It is intended to be shown in a second browser tab/window during the demo.

Primary table columns:

- PA ID
- submitted timestamp
- provider group
- service
- PA result
- incentive status
- incentive value
- reason
- action

Example rows:

| PA ID | Service | PA Result | Incentive Status | Value | Reason |
| --- | --- | --- | --- | --- | --- |
| `synthetic-pa-20931` | Knee MRI | Submitted / pending | Eligible - pending approval | `3 USDC` | Complete DTR + PAS before cutoff |
| `synthetic-pa-20932` | Full-body wellness MRI | Denied - not covered benefit | Not eligible | `0 USDC` | Non-covered benefit |
| `synthetic-pa-20933` | Knee MRI | Submitted / pending | Not eligible | `0 USDC` | Missing required documentation |

Clicking a row opens details:

- event received: `PAS_SUBMITTED`
- evidence source: UM Platform Evidence API
- policy ID and version
- policy checks and pass/fail status
- reason codes
- payment proposal if eligible
- human approval action if eligible and pending
- Hedera transaction/audit record after approval

## Logical Components

Even though the first implementation can live inside one Next.js app, the design preserves four logical boundaries: provider portal, synthetic UM platform, incentive agent, and policy/payment execution.

### Provider Portal

Responsibilities:

- run the guided PA wizard
- perform CRD/DTR/PAS-style interactions through app APIs
- display neutral documentation completeness
- submit PA requests
- show provider-facing PA status

The provider portal must not:

- call payment APIs
- send rich policy evidence to the incentive agent
- show direct payment value while documentation is in progress

### Synthetic UM Platform

Responsibilities:

- store submitted PA requests
- own CRD/DTR/PAS state
- create a simulated `PAS_SUBMITTED` event after PAS submission
- expose submitted requests to the plan-side worklist
- expose policy-safe evidence by PA ID

Conceptual APIs:

- `POST /api/um/prior-auths`
- `GET /api/um/prior-auths`
- `GET /api/um/prior-auths/[caseId]/evidence`

### Incentive Agent

Trigger input:

```json
{
  "eventType": "PAS_SUBMITTED",
  "caseId": "synthetic-pa-20931"
}
```

Responsibilities:

- receive the simulated UM platform event
- call the UM Platform Evidence API by `caseId`
- evaluate provider-documentation policy
- produce reason codes and payment proposal
- never use UI-submitted rich evidence as the source of truth
- never use approval/denial outcome as a positive payment criterion

### Policy Engine And Hedera Executor

Responsibilities:

- deterministically evaluate policy checks
- compute incentive value
- enforce approved submitter and wallet mapping
- enforce value caps
- require human approval before payment execution
- execute simulated or testnet Hedera payment
- record audit trail

## Evidence Model

The agent receives only event metadata and pulls evidence from the UM platform.

UM Platform Evidence API returns policy-safe evidence for the case ID, such as:

```json
{
  "caseId": "synthetic-pa-20931",
  "submitter": {
    "type": "provider_admin_team",
    "id": "lakeside-provider-admin"
  },
  "serviceCode": "knee_mri",
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
}
```

For the full-body wellness MRI path, the evidence includes:

- `serviceCode: "full_body_wellness_mri"`
- `crdCoverageChecked: true`
- `crdCoveredBenefit: false`
- `pasSubmitted: true`
- `paResult: "denied_not_covered"`
- `denialReason: "BENEFIT_NOT_COVERED"`
- policy result: not eligible
- incentive value: `0 USDC`

## Provider Documentation Policy

Policy ID: `provider-documentation-completeness-v1`

Positive eligibility requires:

- submitter type is approved
- submitter ID maps to an approved wallet
- CRD coverage was checked
- service is a covered benefit
- DTR template was completed
- attachment checklist is complete
- required FHIR/profile fields are present
- PAS was submitted
- PAS was submitted before the initial decision/cutoff
- approval/denial outcome is not used as a positive payment criterion
- referral volume metric is not used
- no PHI is included in payment metadata
- request is within per-request and monthly caps

Guaranteed zero incentive cases:

- service is not a covered benefit
- PAS was not submitted
- DTR template incomplete
- attachment checklist incomplete
- required FHIR/profile fields missing
- submitted after cutoff
- outcome/referral/volume metric appears in payment basis
- PHI appears in payment metadata

## Demo Behavior

The intended demo sequence uses two browser pages.

1. Open `/provider-documentation` in one page.
2. Open `/provider-documentation/incentives` in another page.
3. In provider portal, select `Knee MRI after injury`.
4. Complete CRD/DTR/PAS flow.
5. Switch to plan-side console and refresh or observe the submitted request.
6. Show eligible incentive row and detail panel.
7. Approve payment and show transaction/audit state.
8. Return to provider portal, select `Full-body wellness MRI screening`.
9. Acknowledge not-covered warning and submit.
10. Switch to plan-side console and show zero-incentive row with `BENEFIT_NOT_COVERED`.

The incentives console includes auto-refresh plus a manual refresh control for demo reliability.

## Error And Edge States

Provider portal:

- no service selected: disable coverage check
- knee MRI DTR incomplete: disable PAS submission or show missing requirements
- full-body MRI warning not acknowledged: disable submit
- submission failed: show retryable provider-safe error

Plan incentives console:

- no events yet: empty state with explanation
- event received but evidence unavailable: show pending evidence retrieval
- evidence retrieval failed: show retry action
- policy rejected: show reason codes and zero value
- payment approval failed: keep row pending and show retryable error

## Testing And Verification

Expected focused tests:

- knee MRI CRD returns covered / PA required / DTR template
- full-body MRI CRD returns not covered reason
- full-body MRI requires acknowledgement before submission
- knee MRI PAS submission emits `PAS_SUBMITTED`
- full-body MRI PAS submission emits `PAS_SUBMITTED`
- incentive agent receives only `caseId` and event type, then pulls evidence
- knee MRI complete case evaluates to eligible `3 USDC`
- full-body MRI case evaluates to not eligible `0 USDC`
- missing DTR evidence evaluates to not eligible `0 USDC`
- provider portal does not call payment approval endpoint
- plan-side approval executes payment only for eligible pending rows

Manual verification:

- run provider portal happy path
- run provider portal non-covered path
- verify plan worklist rows and detail panels
- verify payment approval/audit display

## Out Of Scope For This Iteration

- real CRD/DTR/PAS API integration
- real patient data
- real PHI handling
- production-grade event bus
- persistent database
- provider-facing payment status
- using PA approval as a positive incentive condition
