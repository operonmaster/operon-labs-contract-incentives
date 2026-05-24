# Provider Portal Linear PA Flow Redesign

## Goal

Rework `/provider-documentation` so it feels like a simplified provider prior authorization portal instead of a standards-first demo. The provider user should move through a linear request workflow: select patient, select the patient's plan, select the requested service, check payer requirements, answer or skip a requested assessment, review, and submit.

The UI should not use CRD, DTR, PAS, or incentive terminology. Those concepts remain visible in code, tests, docs, and the plan-side incentive console, but the provider-facing experience should look like normal payer portal work.

## Research Basis

The design is based on current provider portal and Da Vinci workflow patterns:

- Provider PA portals commonly start by attaching or selecting a member before entering request details. A Health Alliance portal guide describes selecting an authorization type, searching for a member, reviewing eligibility, then selecting the correct authorization template and request details.
- Availity-style PA submission guidance shows a stepper-like flow where users proceed through request, service, provider/facility, diagnosis/procedure, attachment, and submit/review steps.
- HL7 Da Vinci CRD positions coverage and requirement discovery before PA submission, returning guidance such as whether a service is covered, whether PA is required, and whether forms/templates are needed.
- HL7 Da Vinci DTR supports payer-requested questionnaires or documentation capture after requirements are discovered.
- HL7 Da Vinci PAS expects the provider or designated agent to be able to review patient information before clinical data is submitted.

Reference URLs:

- https://www.hl7.org/fhir/us/davinci-crd/STU2/usecases.html
- https://hl7.org/fhir/us/davinci-pas/STU2.1/usecases.html
- https://build.fhir.org/ig/HL7/davinci-dtr/branches/__default/en/burden.html
- https://www.healthalliance.org/documents/2469
- https://www.availity.com/end-to-end-authorizations/

## Provider-Facing Flow

### Step 1: Patient

The first screen in the workflow is a native dropdown:

- placeholder: `Select patient`
- option: `Maya Chen`

Until a patient is selected, the plan and service steps are disabled.

### Step 2: Health Plan

After `Maya Chen` is selected, the health plan dropdown becomes available:

- placeholder: `Select health plan`
- option: `Acme Health PPO`

The UI should make it feel like the plan came from the selected patient's eligibility record. For this demo, only one plan is available.

### Step 3: Service

After patient and plan are selected, the service dropdown becomes available:

- placeholder: `Select service`
- option: `Knee MRI after injury`
- option: `Full-body wellness MRI screening`

The primary action on this step is `Next: check requirements`. This action performs the existing coverage/requirements check, but the button and result copy should not say CRD.

### Step 4: Requirements Result

The requirements result appears after `Next: check requirements`.

For `Knee MRI after injury`:

- show `Coverage confirmed`
- show `Prior authorization required`
- show `Additional assessment required before submission`
- expose an `Open assessment` action
- expose a `Continue to review` action only after the requirements result exists

For `Full-body wellness MRI screening`:

- show `Not covered benefit`
- explain that the plan does not cover full-body wellness screening MRI without symptoms
- require an acknowledgement checkbox
- allow the provider to continue to review and submit after acknowledgement
- do not show the assessment modal

### Step 5: Assessment Modal

The assessment modal is shown only for the covered knee MRI path.

The modal should feel like payer-required clinical questions, not a standards demo. It contains four simple yes/no or checkbox items:

- symptoms began after injury or persistent knee pain is documented
- conservative therapy was attempted
- exam findings support the imaging request
- clinical note is attached or available in the chart

The modal has two actions:

- `Save assessment`: marks the assessment complete
- `Skip assessment`: closes the modal and marks the assessment skipped

Skipping the assessment must not block final PA submission. It should create a realistic incomplete-documentation path: the provider can still submit, but the plan-side incentive outcome is not eligible with `0 USDC`.

### Step 6: Review And Submit

The final screen summarizes:

- patient
- health plan
- service
- coverage/requirements result
- assessment status when applicable
- submission warning when applicable

For covered knee MRI with completed assessment:

- review status: assessment complete
- submit action enabled
- result: `Submitted / pending`
- plan-side incentive result: eligible pending approval, `3 USDC`

For covered knee MRI with skipped assessment:

- review status: assessment skipped
- warning: `Assessment was skipped. The request can still be submitted, but supporting documentation is incomplete.`
- submit action enabled
- result: `Submitted / pending`
- plan-side incentive result: not eligible, `0 USDC`

For full-body wellness MRI:

- review status: not covered benefit acknowledged
- warning: `This service is not covered by the selected plan. The request will be submitted with a not-covered reason.`
- submit action enabled after acknowledgement
- result: `Denied - not covered benefit`
- plan-side incentive result: not eligible, `0 USDC`

## Internal Standards Mapping

The provider UI hides standards names, but the implementation should preserve the demo mapping:

- Step 4 requirements check maps to the CRD-style coverage requirements call.
- Step 5 assessment maps to DTR-style questionnaire capture.
- Step 6 submit maps to PAS-style prior authorization submission.
- Plan-side incentive evaluation remains asynchronous after submission and continues to use only `caseId` as the event payload.

## Component Design

Keep the page at `/provider-documentation`, but remodel `ProviderDocumentationWizard` as a true linear wizard.

Recommended state model:

- `step`: current wizard step
- `patientId`: `null | "patient-maya-chen"`
- `planId`: `null | "acme-health-ppo"`
- `serviceCode`: current service code
- `requirementsChecked`: boolean
- `assessmentStatus`: `"not_required" | "not_started" | "complete" | "skipped"`
- `acknowledgedNotCovered`: boolean
- `submitted`: prior auth result or null
- `submitting`: boolean
- `error`: string or null
- `assessmentModalOpen`: boolean

The component should render one main form surface with a horizontal step indicator and a right-side or lower summary panel. Avoid stacked disconnected panels for every stage; provider portals generally feel like a single request form moving forward.

## Data Model Changes

The current UM platform only accepts complete DTR answers for `knee_mri`. To support the skipped-assessment path, update the synthetic UM platform so a knee MRI can be submitted with omitted or incomplete DTR data.

Expected behavior:

- complete DTR answers produce evidence fields `dtrTemplateCompleted`, `attachmentChecklistComplete`, and `fhirFieldsPresent` as `true`
- skipped or incomplete DTR answers produce those evidence fields as `false`
- PA result for knee MRI remains `submitted_pending` because the service is covered and PA was submitted
- incentive agent blocks positive incentive because required documentation evidence is missing

Do not pass assessment answers directly to the incentive agent. The agent must still pull policy-safe evidence from the UM platform by `caseId`.

## Error Handling

The provider portal should block only missing setup data:

- no patient selected
- no health plan selected
- no service selected
- requirements not checked
- not-covered service not acknowledged

The provider portal should not block covered knee MRI submission solely because the assessment was skipped.

Submission errors from `/api/um/prior-auths` should display in a concise alert near the submit button and keep the user on the review step.

Changing patient, plan, or service after requirements are checked should reset downstream state:

- requirements result
- assessment status
- acknowledgement
- submitted result
- error

## Plan-Side Console Impact

The plan incentives page should keep its current role:

- list submitted PA requests
- show PA result
- show incentive status
- show incentive value
- show reason codes
- allow approval only for eligible rows

It should now support three visible rows/outcomes during a full demo:

| Provider path | PA result | Incentive status | Value | Expected reason |
| --- | --- | --- | --- | --- |
| Knee MRI, assessment complete | Submitted / pending | Eligible - pending approval | `3 USDC` | Complete DTR + PAS before cutoff |
| Knee MRI, assessment skipped | Submitted / pending | Not eligible | `0 USDC` | Missing required documentation |
| Full-body wellness MRI | Denied - not covered | Not eligible | `0 USDC` | Non-covered benefit |

## Testing

Add or update tests before implementation.

UM platform tests:

- covered knee MRI can be submitted with complete assessment and produces complete evidence
- covered knee MRI can be submitted with skipped/missing assessment and produces incomplete evidence
- full-body wellness MRI still requires acknowledgement and produces not-covered evidence

Workflow tests:

- complete knee MRI creates an eligible `3 USDC` row
- skipped-assessment knee MRI creates a submitted PA and `0 USDC` not-eligible row with missing documentation reason
- full-body MRI creates a denied PA and `0 USDC` row

Route tests:

- prior-auth submission accepts a covered knee MRI request without DTR answers
- plan-side approval still rejects not-eligible rows

Manual browser verification:

- patient and plan dropdown gating
- service selection reset behavior
- covered complete-assessment path
- covered skipped-assessment path
- not-covered acknowledged path
- plan console reflects all submitted rows after refresh

## Out Of Scope

- real payer portal authentication
- real eligibility lookup
- multiple patients or multiple plans
- real CRD/DTR/PAS API integration
- uploading real attachments
- exposing incentive information inside the provider portal
