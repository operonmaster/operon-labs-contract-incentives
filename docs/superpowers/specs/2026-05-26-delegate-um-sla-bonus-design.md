# Delegate UM SLA Bonus Use Case Design

## Status

Approved on 2026-05-26.

## Purpose

Design the Delegate UM SLA Bonus use case as the next lifecycle step after prior authorization intake. The central design decision is that Operon's UM platform should not use PAS `Claim` as its internal operating object. PAS remains the standards-facing intake and audit record. The platform normalizes each accepted PAS submission into a first-class `UMRequest`, and both Provider Documentation Completeness and Delegate UM SLA Bonus operate from that shared aggregate.

The demo should make three ideas clear:

- PAS submissions can enter the platform through standards-aligned FHIR artifacts.
- Operon works from a lean UM domain object, `UMRequest`, rather than exposing FHIR/X12 complexity to product workflows.
- Delegate SLA incentives reward timely, audit-ready review completion, not approval rate, denial rate, utilization, savings, or any other outcome-based metric.

## Standards Position

Da Vinci PAS uses FHIR `Claim` with `use = preauthorization` for prior authorization submission and `ClaimResponse` for the payer response. In this design, those resources remain important as import/export and audit artifacts:

- PAS `Claim`: source submission used to create a `UMRequest`.
- PAS `ClaimResponse`: standards-facing representation of the completed clinical determination.
- `UMRequest`: Operon's canonical internal UM aggregate.

Reference material:

- https://hl7.org/fhir/us/davinci-pas/STU2.1/specification.html
- https://hl7.org/fhir/us/davinci-pas/STU2.1/StructureDefinition-profile-claim.html
- https://build.fhir.org/ig/HL7/davinci-pas/en/StructureDefinition-profile-claimresponse-definitions.html
- https://build.fhir.org/ig/HL7/davinci-pas/branches/__default/en/StructureDefinition-extension-reviewAction.html

FHIR `Task` is intentionally not used as the core platform abstraction. It is too generic for the product domain and would force delegate workqueue, SLA clocks, clinical review, and incentive evidence into workflow metadata rather than a clear UM business object.

## Current Repo Baseline

The current Provider Documentation implementation uses `PriorAuthRecord` as the internal PA object. It is defined in `src/packages/um-platform/src/index.ts` and is used by:

- the UM platform package for synthetic PA submission and evidence building
- `pas-fhir.ts` for PAS bundle generation
- `pas-persistence.ts` for Firestore persistence
- `provider-documentation-workflow.ts` for incentive evaluation
- the Provider Documentation React wizard for submitted state

This design replaces that role with `UMRequest`. `PriorAuthRecord` should not remain the primary domain object. The implementation should rename and reshape the current domain usage into `UMRequest`. Raw PAS intake and audit storage should use a separate PAS-specific artifact such as `PasSubmissionRecord` when that distinction is needed.

ID strategy: the PA case ID is the canonical UM request ID. `UMRequest.id`, event `caseId`, event `umRequestId`, FHIR PAS bundle IDs, persistence document IDs, incentive evaluation IDs, and payment attestation IDs all use the same `PA-*` value. Do not generate `UMR-*` IDs. If compatibility fields remain, they must carry the same value as `UMRequest.id`.

## Core Architecture

Canonical data flow:

```text
PAS submission
  -> raw PAS/FHIR audit record
  -> normalized UMRequest
  -> Provider Documentation evidence
  -> Delegate UM workqueue/review
  -> policy evidence
  -> incentive/payment evaluation
```

Logical boundaries:

- `@operon-labs/um-platform` owns `UMRequest`, PAS intake normalization, state transitions, SLA clock calculation, and evidence builders.
- Web routes call UM platform workflows and APIs.
- React components render views and trigger workflow actions, but do not compute policy eligibility.
- Incentive agent receives event metadata and pulls evidence by `umRequestId`.
- Policy engine evaluates deterministic evidence only and does not inspect raw PAS bundles.
- Payment execution remains policy-bound and separate from business evidence generation.

## UMRequest Model

`UMRequest` is the platform aggregate for prior authorization work.

```ts
type UMRequest = {
  id: string;
  source: "pas_fhir";

  planId: string;
  planDisplay: string;
  providerId: string;
  providerDisplay: string;
  delegateVendorId: string | null;

  requestType: "outpatient_service" | "pharmacy_benefit" | "inpatient_admission";
  serviceCode: string;
  serviceLabel: string;
  codingSystem: "CPT" | "NDC";
  billingCode: string;

  state: "pend" | "in_clinical_review" | "determined";
  outcomeStatus: null | "approved" | "denied";

  submittedAt: string;
  pendStartedAt: string;
  reviewStartedAt: string | null;
  determinedAt: string | null;
  slaDeadlineAt: string;
  slaHours: 24;

  documentation: {
    coverageChecked: boolean;
    coveredBenefit: boolean;
    dtrRequested: boolean;
    dtrCompleted: boolean;
    attachmentChecklistComplete: boolean;
    fhirFieldsPresent: boolean;
  };

  clinicalReview: {
    reviewerId: string | null;
    medicalNecessityReviewed: boolean;
    policyCriteriaChecked: boolean;
    rationaleCaptured: boolean;
    denialReasonCode: string | null;
  };

  auditRefs: {
    pasClaimBundleId: string;
    pasClaimResponseBundleId: string | null;
  };
};
```

SLA behavior:

- First iteration SLA is hard-coded to 24 hours.
- `pendStartedAt` starts the clock.
- `slaDeadlineAt = pendStartedAt + 24 hours`.
- `completedWithinSla = determinedAt <= slaDeadlineAt`.
- Breached requests can still be determined, but they are not eligible for the Delegate UM SLA Bonus.

## State Machine

Allowed states:

```text
pend -> in_clinical_review -> determined
```

State rules:

- `pend`: created from an accepted PAS submission and visible in the delegate workqueue.
- `in_clinical_review`: reviewer has opened/started the case.
- `determined`: reviewer completed the review and selected `approved` or `denied`.

Outcome rules:

- `outcomeStatus` is null until `determined`.
- `approved` and `denied` are both valid terminal outcomes.
- Denied determinations require `clinicalReview.denialReasonCode`.
- Outcome must be present for policy eligibility, but the outcome value must not affect payout.

Events:

```text
PAS_SUBMITTED
UM_REQUEST_CREATED
UM_REQUEST_REVIEW_STARTED
UM_REQUEST_DETERMINED
```

## Provider Documentation Migration

Provider Documentation Completeness should be migrated to use `UMRequest` as its evidence source.

Flow:

```text
Provider completes CRD/DTR/PAS flow
  -> PAS submission accepted
  -> raw PAS bundle stored for audit
  -> UMRequest created
  -> UMRequest.documentation populated
  -> PAS_SUBMITTED and UM_REQUEST_CREATED emitted
  -> provider documentation policy evaluates UMRequest documentation evidence
```

Provider Documentation policy evidence:

```ts
{
  evaluationType: "provider_documentation_completeness",
  submitter: { id: "lakeside-provider-admin" },
  requestObject: {
    umRequestId: "PA-260526-0001",
    id: "PA-260526-0001",
    planId: "acme-health-ppo",
    providerId: "lakeside-provider-admin",
    requestType: "outpatient_service",
    codingSystem: "CPT",
    billingCode: "73721",
    coveredBenefit: true,
    dtrRequested: true,
    dtrCompleted: true,
    attachmentChecklistComplete: true,
    fhirFieldsPresent: true,
    outcomeStatusUsedForPayment: false,
    containsPhi: false
  }
}
```

The existing Provider Documentation UX keeps its basic two-tab demo story. The difference is architectural: the plan-side incentive console reads policy evidence derived from `UMRequest`, not directly from `PriorAuthRecord`.

## Delegate UM SLA Bonus Flow

Delegate UM starts from `UMRequest`, not from raw PAS records.

Demo scope: pharmacy prior authorizations are delegated when `UMRequest.requestType === "pharmacy_benefit"`. This is intentionally a request-type adoption rule, not a service-code rule and not a provider-submitted delegation override. Outpatient service requests remain Provider Documentation cases unless a future scope explicitly adds outpatient delegation.

Flow:

```text
UMRequest enters pend
  -> delegate vendor workqueue shows pend UMRequests
  -> reviewer opens one UMRequest
  -> state moves to in_clinical_review
  -> reviewer completes clinical review
  -> state moves to determined
  -> outcomeStatus is approved or denied
  -> UM_REQUEST_DETERMINED emitted
  -> delegate SLA policy evaluates clocks and audit evidence
```

Delegate SLA policy evidence:

```ts
{
  evaluationType: "delegate_um_sla_bonus",
  submitter: { id: "northstar-um" },
  requestObject: {
    umRequestId: "PA-260526-0001",
    planId: "acme-health-ppo",
    delegateVendorId: "northstar-um",
    requestType: "pharmacy_benefit",
    state: "determined",
    outcomeStatusPresent: true,
    outcomeStatusUsedForPayment: false,
    completedWithinSla: true,
    slaHours: 24,
    clinicalReviewCompleted: true,
    medicalNecessityReviewed: true,
    policyCriteriaChecked: true,
    rationaleCaptured: true,
    auditReady: true,
    containsPhi: false
  }
}
```

Policy stance:

- Both approved and denied determinations are eligible if all non-outcome criteria pass.
- The incentive is for timely, audit-ready delegate review completion.
- Approval/denial rate and cost/utilization savings must not be payout criteria.

## Delegate Vendor View

Route: `/delegate-um`

Primary job: let the delegated UM vendor work pending pharmacy benefit `UMRequest` cases.

View elements:

- Workqueue for `UMRequest.state = "pend"` or `UMRequest.state = "in_clinical_review"`.
- Columns: canonical PA/UM request ID, service, plan, submitted time, SLA deadline, time remaining, state.
- Row action to open review.
- Review panel with request summary, documentation completeness summary, SLA clock, reviewer checklist, outcome selector, and submit determination action.
- Outcome selector supports `Approved` and `Denied`.
- Denial reason is required only for denied determinations.

## Health Plan View

Route: `/delegate-um/plan`

Primary job: let the plan monitor delegate performance and payment eligibility.

View elements:

- Determined and pending `UMRequest` rows.
- SLA status: within SLA, breached, pending.
- Outcome status shown as operational context, not payment basis.
- Policy evaluation status: eligible, not eligible, pending determination.
- Detail modal with source PAS audit reference, lifecycle timestamps, clinical review checklist, policy reason codes, and payment/audit trace.

## Policies View

Route: `/delegate-um/policies`

Primary job: show business policy and payment policy separately.

Business policy: `delegate-um-sla-bonus-v1`.

Hard-coded first-iteration criteria:

- Submitter is approved delegate vendor `northstar-um`.
- `UMRequest.state = "determined"`.
- `outcomeStatus` is present.
- Outcome value is not used to determine payment amount.
- Clinical review checklist is complete.
- Determination completed within 24 hours of `pendStartedAt`.
- No PHI in payment metadata.
- No denial-rate, approval-rate, utilization, or savings metric is used in payment basis.

Initial payout is `5 HBAR` per eligible request with a monthly cap that matches the current business policy pattern.

## Error And Edge States

PAS and normalization:

- PAS accepted but `UMRequest` creation fails: show intake error and do not emit downstream policy event.
- Missing raw PAS audit reference: block policy eligibility with `PAS_AUDIT_RECORD_MISSING`.

Clinical review:

- Review submitted without complete checklist: keep `in_clinical_review`, return `CLINICAL_REVIEW_INCOMPLETE`.
- Denied outcome without denial reason: return `DENIAL_REASON_REQUIRED`.
- Determination after 24 hours: allow determination, policy returns zero with `SLA_EXCEEDED`.

Policy:

- Outcome missing: return zero with `OUTCOME_STATUS_MISSING`.
- Outcome appears in payout basis: return zero with `PROHIBITED_OUTCOME_METRIC`.
- Missing clinical review evidence: return zero with `CLINICAL_REVIEW_INCOMPLETE`.
- Missing audit reference: return zero with `PAS_AUDIT_RECORD_MISSING`.

## Testing And Verification

Focused tests:

- PAS submission creates raw audit record and `UMRequest`.
- Existing Provider Documentation evidence is derived from `UMRequest`.
- Provider Documentation happy path still pays from documentation completeness.
- Delegate workqueue lists `pend` `UMRequest` rows.
- Starting review moves `pend -> in_clinical_review`.
- Completing review moves `in_clinical_review -> determined`.
- Approved and denied both qualify when SLA/checklist pass.
- SLA breach blocks payment.
- Missing denial reason blocks denied determination.
- Policy evidence proves outcome is present but not used for payment.

Manual verification:

- Submit a provider documentation PA.
- Confirm the submitted PAS created a `UMRequest`.
- Confirm Provider Documentation Health Plan view still shows incentive evaluation.
- Open Delegate Vendor view and see the same `UMRequest` in the workqueue.
- Complete review as approved within SLA and verify policy eligibility.
- Submit another request, complete review as denied within SLA with denial reason, and verify policy eligibility.
- Submit or force an overdue request and verify zero-value `SLA_EXCEEDED`.

## Out Of Scope

- Multiple delegate vendors.
- Delegate reassignment and escalation.
- Configurable SLA by plan, vendor, line of business, or urgency.
- Clinical policy automation.
- Partial approvals.
- Peer-to-peer workflow.
- Real PAS endpoint integration.
- Real patient data or PHI handling.
- Member/provider notification workflows.
- Production-grade event bus.
- Full ClaimResponse export validation.
