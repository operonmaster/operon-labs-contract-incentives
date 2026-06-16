# Specialty Rx Fulfillment SLA Use Case Design

## Status

Design direction approved on 2026-05-28. Written spec pending user review before implementation planning.

## Purpose

Add the third normal-path demo use case after Provider Documentation Completeness and Delegate UM SLA Bonus. The first two use cases show clean prior authorization intake and timely delegated pharmacy PA review. This use case continues the same case downstream into specialty pharmacy fulfillment.

The demo should make three ideas clear:

- A specialty pharmacy can be rewarded for clean post-approval execution after a pharmacy PA is approved.
- The incentive is tied to operational SLA evidence, not the drug selected, fill volume, adherence, approval rate, denial rate, or patient steering.
- The same policy/payment layer can evaluate multiple healthcare operations incentives across a single PA lifecycle.

This use case replaces Provider Directory Data Quality in the demo catalog. Appeals Packet Quality remains an exception-path use case for denied, failed, or appealed work rather than the third normal-path step.

## Real-World Position

Specialty pharmacy fulfillment is not just shipment after PA approval. A realistic specialty pharmacy workflow includes intake validation, prescription and benefit readiness, prescriber clarification, REMS or safe-use checks when applicable, patient/contact coordination, inventory and special-handling checks, shipment scheduling, delivery evidence, and exception handling.

Reference material:

- https://nabp.pharmacy/programs/accreditations/specialty-pharmacy/
- https://nabp.pharmacy/wp-content/uploads/2020/11/Specialty-Pharmacy-Standards-Summary.pdf
- https://www.ashp.org/-/media/assets/products-services/ASHP-Accreditation-Programs/docs/Accreditation-Standard-Specialty-Pharmacy-Practice.pdf
- https://www.fda.gov/drugs/risk-evaluation-and-mitigation-strategies-rems/roles-different-participants-rems
- https://www.cms.gov/medicare/prescription-drug-coverage/prescriptiondrugcovcontra/downloads/qaspecialtyaccess_051706.pdf
- https://oig.hhs.gov/faqs/general-questions-regarding-certain-fraud-and-abuse-authorities/

Product stance:

- The specialty pharmacy must be a contracted, already-assigned pharmacy or fulfillment partner.
- The incentive must not reward routing a patient to a specific pharmacy unless that assignment already exists outside the incentive.
- The incentive must not reward prescribing, drug choice, fill volume, therapy continuation, medication adherence, or reduced spend.
- The policy may reward timely completion of contracted fulfillment milestones after the case is clear to fill.
- No PHI should appear in settlement metadata, payment memo fields, policy document IDs, or on-chain payloads.

## Current Repo Baseline

The accepted repo pattern is:

```text
PAS/FHIR submission
  -> normalized UMRequest
  -> use-case evidence
  -> deterministic business policy evaluation
  -> payment policy controls
  -> Hedera settlement/audit trail
```

Provider Documentation Completeness and Delegate UM SLA Bonus already use `UMRequest` as the canonical PA/UM aggregate. Specialty pharmacy fulfillment should not replace or overload `UMRequest`. It should introduce a downstream fulfillment aggregate that references the approved pharmacy PA request.

New object:

```ts
type SpecialtyFulfillmentCase = {
  id: string;
  umRequestId: string;
  source: "delegate_um_approved";

  planId: string;
  pharmacyId: string;
  pharmacyDisplay: string;
  requestType: "pharmacy_benefit";
  serviceCode: string;
  serviceLabel: string;
  codingSystem: "NDC";
  billingCode: string;

  state:
    | "intake_triage"
    | "clear_to_fill"
    | "shipment_scheduled"
    | "fulfilled"
    | "exception";

  paApprovalReceivedAt: string;
  intakeStartedAt: string;
  clearToFillAt: string | null;
  shipmentScheduledAt: string | null;
  deliveryConfirmedAt: string | null;
  exceptionRecordedAt: string | null;

  scheduleSlaHours: 24;
  deliverySlaHours: 72;

  intake: {
    approvedPaLinked: boolean;
    prescriptionPresent: boolean;
    assignedPharmacyConfirmed: boolean;
    therapyMetadataPresent: boolean;
    handoffDataComplete: boolean;
  };

  clearToFill: {
    benefitsOrClaimCheckCompleted: boolean;
    prescriptionValid: boolean;
    prescriberClarificationRequired: boolean;
    prescriberClarificationResolved: boolean;
    remsRequired: boolean;
    remsAuthorizationConfirmed: boolean;
    inventoryAvailable: boolean;
    copayOrPaymentReady: boolean;
  };

  shipment: {
    patientContactAttemptDocumented: boolean;
    addressConfirmed: boolean;
    deliveryWindowConfirmed: boolean;
    coldChainRequired: boolean;
    coldChainPackoutValidated: boolean;
    courierScheduled: boolean;
  };

  fulfillment: {
    shipped: boolean;
    deliveryConfirmed: boolean;
    deliveryAttemptDocumented: boolean;
    temperatureLogValid: boolean;
    avoidableFulfillmentException: boolean;
    externalBlockerDocumented: boolean;
    exceptionReasonCode: string | null;
  };
};
```

`SpecialtyFulfillmentCase.id` can use an `RXF-*` prefix, but `umRequestId` remains the cross-use-case identity that ties the full chain together.

## Core Architecture

Canonical data flow:

```text
Provider submits pharmacy PA
  -> UMRequest created
  -> Provider Documentation evidence evaluated
  -> PBM/delegate reviews pharmacy PA
  -> UMRequest determined approved
  -> SpecialtyFulfillmentCase created
  -> Specialty pharmacy operator completes fulfillment workflow
  -> Specialty Rx Fulfillment SLA evidence evaluated
  -> business policy/payment policy settlement path
```

Logical boundaries:

- `@operon-labs/um-platform` owns `UMRequest` and delegate PA determination state.
- A new fulfillment workflow module owns `SpecialtyFulfillmentCase` state transitions and evidence building.
- The specialty pharmacy UI renders a workqueue and step-by-step workflow, but does not compute payment eligibility.
- The incentive agent receives a fulfillment completion event and pulls policy-safe fulfillment evidence by fulfillment case ID.
- The policy engine evaluates deterministic evidence only.
- Payment execution remains policy-bound and separate from business evidence generation.

The first implementation can live in the existing Next.js app, following the Provider Documentation and Delegate UM workflow pattern. It does not need a new event bus or production integration layer.

## User Experience

Route: `/specialty-rx`

Primary job: let the specialty pharmacy operator work approved pharmacy PA fulfillment cases.

The page should start with a workqueue of `SpecialtyFulfillmentCase` rows. Each row represents a downstream fulfillment case already created from an approved pharmacy-benefit `UMRequest`.

Workqueue columns:

- fulfillment case ID
- linked PA/UM request ID
- plan
- therapy/service label
- state
- clear-to-fill status
- shipment SLA status
- delivery SLA status
- last updated timestamp

Opening a row launches a guided fulfillment workflow. The visible steps are:

1. Intake & Triage
2. Clear To Fill
3. Schedule Shipment
4. Confirm Fulfillment

The behind-the-scenes case creation step should not appear as a first workflow step. It is system handoff from the approved Delegate UM case into the specialty pharmacy workqueue.

## Workflow Steps

### 1. Intake & Triage

Purpose: confirm the downstream case is complete enough for specialty pharmacy operations to start.

User-facing checks:

- approved PA is linked
- prescription is present
- assigned specialty pharmacy is confirmed
- therapy/service metadata is present
- handoff data is complete

State behavior:

- Cases enter the workqueue in `intake_triage`.
- The operator cannot proceed if required handoff data is missing.
- Missing handoff data creates an external or upstream exception, not an avoidable fulfillment exception by default.

This step answers: "Do we have a valid case to work?"

### 2. Clear To Fill

Purpose: confirm all pre-dispense blockers are resolved.

User-facing checks:

- benefits or pharmacy claim readiness checked
- prescription is valid
- prescriber clarification resolved when required
- REMS or safe-use authorization confirmed when required
- inventory is available
- copay/payment readiness is confirmed if modeled

State behavior:

- Completing this step sets `clearToFillAt`.
- The primary fulfillment SLA starts at `clearToFillAt`, not `paApprovalReceivedAt`.
- The operator cannot proceed to shipment if a required pre-dispense blocker remains unresolved.

This step answers: "Are we legally and operationally allowed to dispense now?"

### 3. Schedule Shipment

Purpose: confirm the specialty pharmacy can ship correctly within the contractual SLA.

User-facing checks:

- patient contact attempt is documented
- address is confirmed
- delivery window is confirmed
- cold-chain requirement is identified
- cold-chain packout is validated when required
- courier is scheduled

State behavior:

- Completing this step sets `shipmentScheduledAt`.
- `shipmentScheduledWithinSla = shipmentScheduledAt <= clearToFillAt + scheduleSlaHours`.
- Shipment scheduling can fail with a documented external blocker, such as patient unreachable or address not confirmed.

This step answers: "Can we ship this correctly within the SLA?"

### 4. Confirm Fulfillment

Purpose: record fulfillment completion or a documented exception.

User-facing checks:

- shipment status is recorded
- delivery confirmation or delivery attempt evidence is present
- temperature log is valid when cold-chain applies
- exception is classified
- avoidable fulfillment exception is explicitly marked false for eligible cases

State behavior:

- Successful completion sets `deliveryConfirmedAt` and moves the case to `fulfilled`.
- `deliveryConfirmedWithinSla = deliveryConfirmedAt <= clearToFillAt + deliverySlaHours`.
- An avoidable fulfillment exception moves the case to `exception` and blocks payment.
- A documented external blocker may make the case not payable, but should not be shown as pharmacy-caused failure.

This step answers: "Was fulfillment completed cleanly, or was there a documented exception?"

## Specialty Pharmacy Plan View

Route: `/specialty-rx/plan`

Primary job: let the health plan monitor specialty pharmacy fulfillment SLA evidence and payment outcomes.

View elements:

- rows for pending, fulfilled, and exception fulfillment cases
- linked PA/UM request ID
- fulfillment state
- schedule SLA status: pending, within SLA, breached, not applicable
- delivery SLA status: pending, within SLA, breached, not applicable
- business policy status
- payment policy status
- incentive value
- reason codes
- transaction/audit reference when settlement succeeds

Detail modal:

- linked UM request summary
- delegate determination context
- fulfillment lifecycle timestamps
- four-step checklist evidence
- external blocker or avoidable exception classification
- business policy criteria
- payment policy controls
- payment intent ID and transaction ID when available

## Policies View

Route: `/specialty-rx/policies`

Primary job: show the business policy and payment policy separately.

Business policy: `specialty-rx-fulfillment-sla-v1`.

Evaluation type:

```text
specialty_rx_fulfillment_sla
```

Submitter:

```json
{
  "type": "specialty_pharmacy",
  "id": "atlas-specialty-rx"
}
```

Hard-coded first-iteration criteria:

- Submitter is contracted specialty pharmacy `atlas-specialty-rx`.
- Linked `UMRequest.requestType = "pharmacy_benefit"`.
- Linked `UMRequest.outcomeStatus = "approved"`.
- The fulfillment case references the linked `umRequestId`.
- Intake and clear-to-fill checklists are complete.
- `clearToFillAt` is present.
- Shipment is scheduled within 24 hours of `clearToFillAt`.
- Delivery is confirmed within 72 hours of `clearToFillAt`, or a delivery attempt is documented under an allowed external-blocker rule.
- Cold-chain evidence is valid when cold-chain applies.
- REMS authorization is confirmed when REMS applies.
- No avoidable fulfillment exception is recorded.
- Drug choice, fill volume, pharmacy steering, patient adherence, approval/denial outcome, and savings metrics are not used for payout.
- Settlement metadata does not contain PHI.

Initial payout:

- `5 HBAR` base payment per eligible fulfilled case.
- `2 HBAR` cold-chain handling add-on when cold-chain is required and validated.
- `7 HBAR` maximum per request.
- `700 HBAR` monthly cap.

The cold-chain add-on is a handling complexity adjustment for documented special handling. It is not tied to choosing a specific drug, increasing fill volume, or routing a patient to a specific pharmacy.

## Evidence Model

The agent receives only event metadata and pulls policy-safe evidence from the fulfillment workflow.

Trigger event:

```json
{
  "eventType": "SPECIALTY_FULFILLMENT_COMPLETED",
  "fulfillmentCaseId": "RXF-260526-0900-DELEGATE",
  "umRequestId": "PA-260526-0900-DELEGATE"
}
```

Policy-safe evidence:

```json
{
  "evaluationType": "specialty_rx_fulfillment_sla",
  "submitter": {
    "id": "atlas-specialty-rx"
  },
  "requestObject": {
    "fulfillmentCaseId": "RXF-260526-0900-DELEGATE",
    "umRequestId": "PA-260526-0900-DELEGATE",
    "planId": "acme-health-ppo",
    "pharmacyId": "atlas-specialty-rx",
    "requestType": "pharmacy_benefit",
    "paOutcomeStatus": "approved",
    "state": "fulfilled",
    "clearToFillAt": "2026-06-18T16:00:00Z",
    "shipmentScheduledAt": "2026-06-19T09:30:00Z",
    "deliveryConfirmedAt": "2026-06-20T14:00:00Z",
    "scheduleSlaHours": 24,
    "deliverySlaHours": 72,
    "intakeComplete": true,
    "clearToFillComplete": true,
    "shipmentScheduledWithinSla": true,
    "deliveryConfirmedWithinSla": true,
    "remsRequired": false,
    "remsAuthorizationConfirmed": true,
    "coldChainRequired": true,
    "coldChainPackoutValidated": true,
    "temperatureLogValid": true,
    "avoidableFulfillmentException": false,
    "externalBlockerDocumented": false,
    "drugChoiceMetricUsed": false,
    "fillVolumeMetricUsed": false,
    "pharmacySteeringMetricUsed": false,
    "patientAdherenceMetricUsed": false,
    "containsPhi": false
  }
}
```

## Error And Edge States

Case creation:

- Delegate UM determination is denied: do not create a normal-path fulfillment case.
- Delegate UM determination is missing: do not create fulfillment case; return `LINKED_UM_REQUEST_NOT_DETERMINED`.
- Linked `UMRequest` is not pharmacy benefit: return `REQUEST_TYPE_NOT_ELIGIBLE`.
- Linked approved PA has no contracted specialty pharmacy assignment: return `SPECIALTY_PHARMACY_NOT_ASSIGNED`.

Intake:

- Missing prescription: keep case in `intake_triage`; return `PRESCRIPTION_MISSING`.
- Handoff data incomplete: keep case in `intake_triage`; return `HANDOFF_DATA_INCOMPLETE`.

Clear to fill:

- Benefits or claim readiness not checked: return `BENEFITS_OR_CLAIM_CHECK_MISSING`.
- Prescriber clarification required but unresolved: return `PRESCRIBER_CLARIFICATION_OPEN`.
- REMS required but authorization missing: return `REMS_AUTHORIZATION_MISSING`.
- Inventory unavailable: return `INVENTORY_UNAVAILABLE`.

Shipment:

- Shipment scheduled after 24 hours from `clearToFillAt`: policy returns zero with `SHIPMENT_SLA_EXCEEDED`.
- Patient unreachable with documented attempts: classify as external blocker and return `EXTERNAL_BLOCKER_DOCUMENTED`.
- Cold-chain required but packout not validated: return `COLD_CHAIN_PACKOUT_MISSING`.

Fulfillment:

- Delivery confirmed after 72 hours from `clearToFillAt`: policy returns zero with `DELIVERY_SLA_EXCEEDED`.
- Temperature log invalid for cold-chain shipment: return `TEMPERATURE_LOG_INVALID`.
- Avoidable fulfillment exception recorded: return `AVOIDABLE_FULFILLMENT_EXCEPTION`.
- External blocker documented: do not show as pharmacy-caused failure; policy can return `not_applicable` or zero with `EXTERNAL_BLOCKER_DOCUMENTED`.

Policy safety:

- Drug choice metric present: return `PROHIBITED_DRUG_CHOICE_METRIC`.
- Fill volume metric present: return `PROHIBITED_FILL_VOLUME_METRIC`.
- Pharmacy steering metric present: return `PROHIBITED_PHARMACY_STEERING_METRIC`.
- Patient adherence metric present: return `PROHIBITED_PATIENT_ADHERENCE_METRIC`.
- PHI present in payment metadata: return `PHI_IN_PAYMENT_METADATA`.

## Testing And Verification

Focused tests:

- Approved pharmacy-benefit `UMRequest` can create a `SpecialtyFulfillmentCase`.
- Denied `UMRequest` does not create a normal-path fulfillment case.
- Non-pharmacy-benefit `UMRequest` does not create a fulfillment case.
- Specialty pharmacy workqueue lists intake, clear-to-fill, shipment, and exception cases.
- Intake cannot advance when prescription or handoff data is missing.
- Clear-to-fill cannot advance when REMS, prescriber clarification, or inventory blockers remain open.
- Completing clear-to-fill sets `clearToFillAt`.
- Shipment SLA uses `clearToFillAt`, not `paApprovalReceivedAt`.
- Shipment scheduled within 24 hours qualifies for schedule SLA.
- Shipment scheduled after 24 hours blocks payment.
- Cold-chain required and valid adds the handling add-on.
- Cold-chain required with invalid temperature evidence blocks payment.
- Delivery within 72 hours qualifies for delivery SLA.
- Avoidable fulfillment exception blocks payment.
- External blocker is distinguished from avoidable fulfillment exception.
- Prohibited drug choice, fill volume, pharmacy steering, patient adherence, and PHI flags block payment.
- Provider Documentation and Delegate UM flows continue to work for the same linked PA request.

Manual verification:

- Submit a pharmacy PA through Provider Documentation.
- Complete Delegate UM review as approved within SLA.
- Confirm a `SpecialtyFulfillmentCase` appears in the specialty pharmacy workqueue.
- Open the case and complete Intake & Triage.
- Complete Clear To Fill and verify the SLA clock starts there.
- Schedule shipment within SLA.
- Confirm fulfillment with valid cold-chain evidence and verify the policy-paid row.
- Repeat with late shipment and verify zero-value `SHIPMENT_SLA_EXCEEDED`.
- Repeat with avoidable fulfillment exception and verify zero-value `AVOIDABLE_FULFILLMENT_EXCEPTION`.
- Repeat with documented patient-unreachable exception and verify it is not presented as pharmacy-caused failure.

## Out Of Scope

- Manufacturer hub workflows.
- Patient/member-facing portals or direct patient incentives.
- Real pharmacy claim adjudication.
- Real REMS integration.
- Real courier or temperature sensor integration.
- Refill management and adherence programs.
- Multi-pharmacy assignment logic.
- Specialty pharmacy selection or steering.
- Production-grade event bus.
- Token-transfer support for non-HBAR payout tokens.
- Appeals Packet Quality implementation.
