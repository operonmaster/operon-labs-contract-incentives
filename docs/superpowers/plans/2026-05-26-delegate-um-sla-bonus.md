# Delegate UM SLA Bonus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote `UMRequest` to the canonical UM platform object, migrate Provider Documentation evidence onto it, and build the Delegate UM SLA Bonus workflow, policies, APIs, and views.

**Architecture:** PAS submissions remain the intake and audit boundary, but `@operon-labs/um-platform` normalizes accepted submissions into `UMRequest`. Provider Documentation and Delegate UM both derive policy-safe evidence from `UMRequest`; the incentive agent receives event metadata and pulls evidence by `umRequestId`. Delegate UM adds review state transitions, a 24-hour SLA clock, and policy-bound payment for timely audit-ready determinations, independent of approved or denied outcome.

**Tech Stack:** TypeScript, npm workspaces, Vitest, Next.js App Router, React client components, existing `@operon-labs/um-platform`, `@operon-labs/policy-engine`, `@operon-labs/incentive-agent`, `@operon-labs/hedera-executor`, Firestore-backed stores with memory-test doubles.

---

## Scope Check

This plan intentionally covers two connected pieces because the second cannot be correct without the first:

- Shared foundation: replace `PriorAuthRecord` as the working domain object with `UMRequest`.
- Use case: add Delegate UM SLA Bonus on top of `UMRequest`.

Do not split these into separate implementation branches. If Delegate UM is built against raw PAS records while Provider Documentation still uses `PriorAuthRecord`, the approved design is not satisfied.

## File Structure

- Modify `src/packages/um-platform/src/index.ts`: define `UMRequest`, source PAS IDs, state transitions, SLA fields, review methods, and evidence builders.
- Modify `src/packages/um-platform/src/pas-fhir.ts`: generate PAS `Claim` bundles from `UMRequest` using `sourceCaseId`.
- Modify `src/packages/um-platform/test/provider-documentation.test.ts`: migrate existing tests from `PriorAuthRecord` to `UMRequest` and add state/SLA tests.
- Modify `src/packages/um-platform/test/pas-fhir.test.ts`: verify PAS bundle identity uses `sourceCaseId` while internal workflows use `umRequest.id`.
- Modify `src/apps/web/lib/pas-persistence.ts`: persist `UMRequest`, policy-safe evidence, PAS bundle, and audit events with both source PA ID and UM request ID.
- Modify `src/apps/web/lib/pas-persistence.test.ts`: verify persistence reads/writes `UMRequest`.
- Modify `src/packages/policy-engine/src/index.ts`: add deterministic Delegate UM SLA policy checks while keeping Provider Documentation checks intact.
- Modify `src/packages/policy-engine/test/evaluate-policy.test.ts`: add delegate SLA policy approval/blocking tests.
- Modify `src/apps/web/lib/policy-store.ts`: seed the delegate business policy.
- Modify `src/apps/web/lib/policy-view-model.ts`: support Delegate UM policy cards.
- Modify `src/apps/web/lib/policy-view-model.test.ts`: cover Delegate UM policy display.
- Modify `src/packages/incentive-agent/src/index.ts`: evaluate provider documentation from `UM_REQUEST_CREATED` evidence and add `evaluateDelegateUmSlaEvent`.
- Modify `src/packages/incentive-agent/test/provider-documentation-event.test.ts`: migrate provider evidence tests.
- Create `src/packages/incentive-agent/test/delegate-um-event.test.ts`: verify delegate event evidence and outcome neutrality.
- Modify `src/apps/web/lib/provider-documentation-workflow.ts`: use `UMRequest` and `UM_REQUEST_CREATED`.
- Modify `src/apps/web/lib/provider-documentation-workflow.test.ts`: migrate rows to `umRequestId` and `sourceCaseId`.
- Create `src/apps/web/lib/delegate-um-workflow.ts`: workflow facade for workqueue, review start, determination, policy evaluation, and settlement.
- Create `src/apps/web/lib/delegate-um-workflow.test.ts`: workflow and settlement tests.
- Modify `src/apps/web/app/api/um/prior-auths/route.ts`: return `UMRequest` for the existing provider intake route.
- Modify `src/apps/web/app/api/um/prior-auths/[caseId]/evidence/route.ts`: accept a path parameter that can be either `umRequestId` or `sourceCaseId`.
- Create `src/apps/web/app/api/delegate-um/workqueue/route.ts`.
- Create `src/apps/web/app/api/delegate-um/requests/[umRequestId]/start-review/route.ts`.
- Create `src/apps/web/app/api/delegate-um/requests/[umRequestId]/determination/route.ts`.
- Create `src/apps/web/app/api/delegate-um/plan/route.ts`.
- Create `src/apps/web/lib/delegate-um-routes.test.ts`.
- Replace `src/apps/web/app/delegate-um/page.tsx`: render Delegate Vendor View.
- Create `src/apps/web/app/delegate-um/plan/page.tsx`.
- Create `src/apps/web/components/delegate-um/DelegateUseCaseNavigation.tsx`.
- Create `src/apps/web/components/delegate-um/DelegateVendorConsole.tsx`.
- Create `src/apps/web/components/delegate-um/DelegatePlanConsole.tsx`.
- Create `src/apps/web/components/delegate-um/DelegateReviewModal.tsx`.
- Modify `src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx`: display UM request and source PA IDs.
- Modify `src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx`: display UM request ID and source PA ID.
- Modify `src/apps/web/components/provider-documentation/PlanAuditDetailsModal.tsx`: use `umRequestId`.
- Modify `src/apps/web/components/demo-catalog.ts`: mark Delegate UM active.
- Modify `src/apps/web/app/styles.css`: add delegate console styles without disrupting existing provider views.

## Task 1: Promote UMRequest In The UM Platform

**Files:**
- Modify: `src/packages/um-platform/src/index.ts`
- Modify: `src/packages/um-platform/test/provider-documentation.test.ts`

- [ ] **Step 1: Write failing UMRequest intake tests**

Append these tests to `src/packages/um-platform/test/provider-documentation.test.ts` and update existing assertions in the file from `submitted.caseId` to `submitted.id` where policy evidence is read.

```ts
it("creates a UMRequest from an accepted PAS submission and emits intake events", () => {
  const platform = createInMemoryUmPlatform({
    generateCaseId: () => "PA-260526-0900-AAAA1111"
  });

  const umRequest = platform.submitPriorAuth({
    requestType: "outpatient_service",
    serviceCode: "knee_mri",
    dtr: {
      symptomDurationConfirmed: true,
      conservativeTherapyConfirmed: true,
      examFindingsConfirmed: true,
      clinicalNoteAttached: true
    }
  });

  expect(umRequest).toMatchObject({
    id: "UMR-260526-0900-AAAA1111",
    source: "pas_fhir",
    sourceCaseId: "PA-260526-0900-AAAA1111",
    state: "pend",
    outcomeStatus: null,
    slaHours: 24,
    documentation: {
      coverageChecked: true,
      coveredBenefit: true,
      dtrRequested: true,
      dtrCompleted: true,
      attachmentChecklistComplete: true,
      fhirFieldsPresent: true
    },
    clinicalReview: {
      reviewerId: null,
      medicalNecessityReviewed: false,
      policyCriteriaChecked: false,
      rationaleCaptured: false,
      denialReasonCode: null
    },
    auditRefs: {
      pasClaimBundleId: "pas-PA-260526-0900-AAAA1111",
      pasClaimResponseBundleId: null
    }
  });
  expect(new Date(umRequest.slaDeadlineAt).getTime() - new Date(umRequest.pendStartedAt).getTime()).toBe(24 * 60 * 60 * 1000);
  expect(platform.listEvents()).toEqual([
    {
      eventType: "PAS_SUBMITTED",
      caseId: "PA-260526-0900-AAAA1111",
      umRequestId: "UMR-260526-0900-AAAA1111"
    },
    {
      eventType: "UM_REQUEST_CREATED",
      caseId: "PA-260526-0900-AAAA1111",
      umRequestId: "UMR-260526-0900-AAAA1111"
    }
  ]);
});

it("supports delegate clinical review state transitions with approved and denied outcomes", () => {
  const platform = createInMemoryUmPlatform({
    generateCaseId: () => "PA-260526-0900-BBBB2222"
  });
  const umRequest = platform.submitPriorAuth({
    requestType: "outpatient_service",
    serviceCode: "knee_mri"
  });

  const started = platform.startClinicalReview(umRequest.id, "reviewer-ana");
  expect(started).toMatchObject({
    id: umRequest.id,
    state: "in_clinical_review",
    clinicalReview: {
      reviewerId: "reviewer-ana"
    }
  });

  const determined = platform.completeClinicalReview(umRequest.id, {
    outcomeStatus: "approved",
    medicalNecessityReviewed: true,
    policyCriteriaChecked: true,
    rationaleCaptured: true
  });

  expect(determined).toMatchObject({
    id: umRequest.id,
    state: "determined",
    outcomeStatus: "approved",
    clinicalReview: {
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true,
      denialReasonCode: null
    }
  });
});

it("requires a denial reason when a delegate review is denied", () => {
  const platform = createInMemoryUmPlatform({
    generateCaseId: () => "PA-260526-0900-CCCC3333"
  });
  const umRequest = platform.submitPriorAuth({
    requestType: "outpatient_service",
    serviceCode: "knee_mri"
  });
  platform.startClinicalReview(umRequest.id, "reviewer-ana");

  expect(() =>
    platform.completeClinicalReview(umRequest.id, {
      outcomeStatus: "denied",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true
    })
  ).toThrow("DENIAL_REASON_REQUIRED");
});
```

- [ ] **Step 2: Run the UM platform tests and verify failure**

Run:

```bash
npm test -- src/packages/um-platform/test/provider-documentation.test.ts
```

Expected: FAIL because `UMRequest`, `startClinicalReview`, `completeClinicalReview`, and `umRequest.id` evidence lookup do not exist yet.

- [ ] **Step 3: Replace PriorAuthRecord with UMRequest in the domain package**

In `src/packages/um-platform/src/index.ts`, replace the `PaResult`/`PriorAuthRecord`-centric model with these exported types and methods. Keep `PriorAuthSubmissionInput` because it remains the PAS intake command.

```ts
export type UMRequestState = "pend" | "in_clinical_review" | "determined";
export type UMOutcomeStatus = "approved" | "denied";
export type PasEventType = "PAS_SUBMITTED";
export type UMRequestEventType = "UM_REQUEST_CREATED" | "UM_REQUEST_REVIEW_STARTED" | "UM_REQUEST_DETERMINED";

export interface UMRequest {
  id: string;
  source: "pas_fhir";
  sourceCaseId: string;
  patientId: string;
  patientDisplay: string;
  planId: PlanId;
  planDisplay: string;
  providerId: "lakeside-provider-admin";
  providerDisplay: "Lakeside Provider Admin";
  delegateVendorId: "northstar-um" | null;
  requestType: RequestType;
  serviceCode: ServiceCode;
  serviceLabel: string;
  codingSystem: CodingSystem;
  billingCode: string;
  state: UMRequestState;
  outcomeStatus: UMOutcomeStatus | null;
  submittedAt: string;
  pendStartedAt: string;
  reviewStartedAt: string | null;
  determinedAt: string | null;
  slaDeadlineAt: string;
  slaHours: 24;
  coverage: CoverageRequirements;
  dtr: DtrAnswers | null;
  dtrQuestionnaireResponse: DtrQuestionnaireResponse | null;
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
}

export interface PasSubmittedEvent {
  eventType: PasEventType;
  caseId: string;
  umRequestId: string;
}

export interface UMRequestLifecycleEvent {
  eventType: UMRequestEventType;
  caseId: string;
  umRequestId: string;
}

export type UMPlatformEvent = PasSubmittedEvent | UMRequestLifecycleEvent;

export interface CompleteClinicalReviewInput {
  outcomeStatus: UMOutcomeStatus;
  medicalNecessityReviewed: boolean;
  policyCriteriaChecked: boolean;
  rationaleCaptured: boolean;
  denialReasonCode?: string | null;
}

export interface UmPlatform {
  submitPriorAuth(input: PriorAuthSubmissionInput): UMRequest;
  listUmRequests(): UMRequest[];
  getUmRequest(umRequestId: string): UMRequest | null;
  findUmRequestBySourceCaseId(caseId: string): UMRequest | null;
  listEvents(): UMPlatformEvent[];
  getEvidence(umRequestId: string): ProviderDocumentationEvidence | null;
  startClinicalReview(umRequestId: string, reviewerId: string): UMRequest;
  completeClinicalReview(umRequestId: string, input: CompleteClinicalReviewInput): UMRequest;
}
```

Use these helper functions in the same file. The pure transition helpers let the Firestore-backed workflow update a loaded `UMRequest` without requiring the request to already exist in an in-memory platform map.

```ts
const DEFAULT_DELEGATE_VENDOR_ID = "northstar-um" as const;
const DEFAULT_SLA_HOURS = 24 as const;

export function generateUmRequestId(sourceCaseId: string): string {
  return sourceCaseId.replace(/^PA-/, "UMR-");
}

function addHours(isoTimestamp: string, hours: number): string {
  return new Date(new Date(isoTimestamp).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function buildDocumentation(record: {
  coverage: CoverageRequirements;
  dtr: DtrAnswers | null;
  dtrQuestionnaireResponse: DtrQuestionnaireResponse | null;
}) {
  const dtrCompleted = record.coverage.documentationTemplateId
    ? isCompleteDtr(record.dtr) ||
      isCompleteDtrQuestionnaireResponse(record.dtrQuestionnaireResponse, record.coverage.documentationTemplateId)
    : false;

  return {
    coverageChecked: true,
    coveredBenefit: record.coverage.coveredBenefit,
    dtrRequested: Boolean(record.coverage.documentationTemplateId),
    dtrCompleted,
    attachmentChecklistComplete: dtrCompleted,
    fhirFieldsPresent: dtrCompleted
  };
}

export function startClinicalReviewForRequest(request: UMRequest, reviewerId: string, now: Date = new Date()): UMRequest {
  if (request.state !== "pend" && request.state !== "in_clinical_review") {
    throw new Error("UM_REQUEST_NOT_REVIEWABLE");
  }

  return copyUmRequest({
    ...request,
    state: "in_clinical_review",
    reviewStartedAt: request.reviewStartedAt ?? now.toISOString(),
    clinicalReview: {
      ...request.clinicalReview,
      reviewerId
    }
  });
}

export function completeClinicalReviewForRequest(
  request: UMRequest,
  input: CompleteClinicalReviewInput,
  now: Date = new Date()
): UMRequest {
  if (request.state !== "in_clinical_review") {
    throw new Error("UM_REQUEST_NOT_IN_CLINICAL_REVIEW");
  }

  if (!input.medicalNecessityReviewed || !input.policyCriteriaChecked || !input.rationaleCaptured) {
    throw new Error("CLINICAL_REVIEW_INCOMPLETE");
  }

  if (input.outcomeStatus === "denied" && !input.denialReasonCode) {
    throw new Error("DENIAL_REASON_REQUIRED");
  }

  return copyUmRequest({
    ...request,
    state: "determined",
    outcomeStatus: input.outcomeStatus,
    determinedAt: now.toISOString(),
    clinicalReview: {
      ...request.clinicalReview,
      medicalNecessityReviewed: input.medicalNecessityReviewed,
      policyCriteriaChecked: input.policyCriteriaChecked,
      rationaleCaptured: input.rationaleCaptured,
      denialReasonCode: input.outcomeStatus === "denied" ? input.denialReasonCode ?? null : null
    }
  });
}
```

Inside `createInMemoryUmPlatform`, store `UMRequest` objects in `const requests = new Map<string, UMRequest>();`, push both `PAS_SUBMITTED` and `UM_REQUEST_CREATED` events after submission, and implement review transitions as deterministic mutations over copied objects.

When completing review, enforce these checks:

```ts
if (request.state !== "in_clinical_review") {
  throw new Error("UM_REQUEST_NOT_IN_CLINICAL_REVIEW");
}

if (
  !input.medicalNecessityReviewed ||
  !input.policyCriteriaChecked ||
  !input.rationaleCaptured
) {
  throw new Error("CLINICAL_REVIEW_INCOMPLETE");
}

if (input.outcomeStatus === "denied" && !input.denialReasonCode) {
  throw new Error("DENIAL_REASON_REQUIRED");
}
```

- [ ] **Step 4: Run the UM platform tests and verify they pass**

Run:

```bash
npm test -- src/packages/um-platform/test/provider-documentation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the UMRequest domain migration**

```bash
git add src/packages/um-platform/src/index.ts src/packages/um-platform/test/provider-documentation.test.ts
git commit -m "feat: add um request domain model"
```

## Task 2: Migrate PAS FHIR Mapping And Persistence To UMRequest

**Files:**
- Modify: `src/packages/um-platform/src/pas-fhir.ts`
- Modify: `src/packages/um-platform/test/pas-fhir.test.ts`
- Modify: `src/apps/web/lib/pas-persistence.ts`
- Modify: `src/apps/web/lib/pas-persistence.test.ts`

- [ ] **Step 1: Write failing PAS and persistence tests**

In `src/packages/um-platform/test/pas-fhir.test.ts`, update the first test so it asserts source PA identity and internal UM identity are separated:

```ts
const bundle = buildPasFhirBundle(umRequest, evidence!);
const claim = bundle.entry.find((entry) => entry.resource.resourceType === "Claim")?.resource;

expect(bundle).toMatchObject({
  resourceType: "Bundle",
  id: `pas-${umRequest.sourceCaseId}`,
  type: "collection"
});
expect(claim).toMatchObject({
  id: `claim-${umRequest.sourceCaseId}`,
  identifier: [
    {
      system: "https://operon.cloud/fhir/NamingSystem/prior-auth-case-id",
      value: umRequest.sourceCaseId
    },
    {
      system: "https://operon.cloud/fhir/NamingSystem/um-request-id",
      value: umRequest.id
    }
  ]
});
```

In `src/apps/web/lib/pas-persistence.test.ts`, change stored request expectations to:

```ts
expect(snapshot.data()).toMatchObject({
  umRequest: {
    id: umRequest.id,
    sourceCaseId: umRequest.sourceCaseId
  },
  evidence: {
    umRequestId: umRequest.id,
    sourceCaseId: umRequest.sourceCaseId
  },
  fhirBundle: {
    id: `pas-${umRequest.sourceCaseId}`
  }
});
```

- [ ] **Step 2: Run targeted tests and verify failure**

Run:

```bash
npm test -- src/packages/um-platform/test/pas-fhir.test.ts src/apps/web/lib/pas-persistence.test.ts
```

Expected: FAIL because `buildPasFhirBundle` and `PasPersistenceStore` still expect `PriorAuthRecord`.

- [ ] **Step 3: Update PAS FHIR mapping**

In `src/packages/um-platform/src/pas-fhir.ts`, import `UMRequest` instead of `PriorAuthRecord`, and change the function signature:

```ts
import type { ProviderDocumentationEvidence, RequestType, UMRequest } from "./index";

export function buildPasFhirBundle(umRequest: UMRequest, evidence: ProviderDocumentationEvidence): PasFhirBundle {
  const patientReference = `Patient/${umRequest.patientId}`;
  const providerReference = `Organization/${umRequest.providerId}`;
  const insurerReference = `Organization/${umRequest.planId}`;
  const coverageReference = `Coverage/coverage-${umRequest.sourceCaseId}`;
  const claim: PasFhirClaim = {
    resourceType: "Claim",
    id: `claim-${umRequest.sourceCaseId}`,
    status: "active",
    use: "preauthorization",
    created: umRequest.submittedAt,
    identifier: [
      {
        system: "https://operon.cloud/fhir/NamingSystem/prior-auth-case-id",
        value: umRequest.sourceCaseId
      },
      {
        system: "https://operon.cloud/fhir/NamingSystem/um-request-id",
        value: umRequest.id
      }
    ],
    patient: {
      reference: patientReference,
      display: umRequest.patientDisplay
    },
    provider: {
      reference: providerReference,
      display: umRequest.providerDisplay
    },
    insurer: {
      reference: insurerReference,
      display: umRequest.planDisplay
    },
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: { reference: coverageReference }
      }
    ],
    item: [
      {
        sequence: 1,
        category: requestTypeConcept(umRequest.requestType),
        productOrService: {
          coding: [
            {
              system: codingSystemUri(umRequest.codingSystem),
              code: umRequest.billingCode,
              display: umRequest.serviceLabel
            }
          ],
          text: umRequest.serviceLabel
        }
      }
    ],
    supportingInfo: [
      booleanSupportingInfo(1, "crd-coverage-checked", "Coverage checked", evidence.coverageChecked),
      booleanSupportingInfo(2, "crd-covered-benefit", "Covered benefit", evidence.coveredBenefit),
      booleanSupportingInfo(3, "dtr-template-completed", "DTR template completed", evidence.dtrCompleted),
      booleanSupportingInfo(4, "attachment-checklist-complete", "Attachment checklist complete", evidence.attachmentChecklistComplete),
      booleanSupportingInfo(5, "required-fhir-fields-present", "Required FHIR fields present", evidence.fhirFieldsPresent),
      booleanSupportingInfo(6, "pas-submitted", "PAS submitted", true),
      stringSupportingInfo(7, "um-request-state", "UM request state", umRequest.state),
      stringSupportingInfo(8, "outcome-status", "Outcome status", umRequest.outcomeStatus ?? "none")
    ]
  };

  return {
    resourceType: "Bundle",
    id: `pas-${umRequest.sourceCaseId}`,
    type: "collection",
    timestamp: umRequest.submittedAt,
    entry: buildEntries(claim, umRequest, patientReference, providerReference, insurerReference, coverageReference)
  };
}
```

Move the existing Patient, Organization, and Coverage entry construction into a small `buildEntries(...)` helper so the main function stays readable.

- [ ] **Step 4: Update persistence interfaces**

In `src/apps/web/lib/pas-persistence.ts`, rename stored types and methods:

```ts
import type {
  PasFhirBundle,
  UMPlatformEvent,
  UMRequest,
  ProviderDocumentationEvidence
} from "@operon-labs/um-platform";

export interface StoredPasSubmission {
  umRequest: UMRequest;
  evidence: ProviderDocumentationEvidence;
  fhirBundle: PasFhirBundle;
}

export interface PasPersistenceStore {
  backend: PasStoreBackend;
  savePasSubmission(request: StoredPasSubmission): Promise<void>;
  saveUmRequest(umRequest: UMRequest): Promise<void>;
  listUmRequests(): Promise<UMRequest[]>;
  getUmRequest(umRequestId: string): Promise<UMRequest | null>;
  findUmRequestBySourceCaseId(caseId: string): Promise<UMRequest | null>;
  getEvidence(umRequestId: string): Promise<ProviderDocumentationEvidence | null>;
  listUmEvents(): Promise<UMPlatformEvent[]>;
  saveIncentiveRow(row: IncentiveWorklistRow): Promise<void>;
  listIncentiveRows(): Promise<IncentiveWorklistRow[]>;
  getIncentiveRow(umRequestId: string): Promise<IncentiveWorklistRow | null>;
}
```

Keep Firestore collection names unchanged for continuity, but store documents under `umRequest.id` and include `sourceCaseId` in the document value. For audit events, write one document per event:

```ts
const events: UMPlatformEvent[] = [
  { eventType: "PAS_SUBMITTED", caseId: request.umRequest.sourceCaseId, umRequestId: request.umRequest.id },
  { eventType: "UM_REQUEST_CREATED", caseId: request.umRequest.sourceCaseId, umRequestId: request.umRequest.id }
];
```

Implement `saveUmRequest(umRequest)` by updating the same `pasClaims` document:

```ts
async saveUmRequest(umRequest: UMRequest): Promise<void> {
  const firestore = await this.getFirestore();
  const ref = firestore.collection(PAS_CLAIMS_COLLECTION).doc(umRequest.id);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw new Error(`UM_REQUEST_NOT_FOUND:${umRequest.id}`);
  }

  await ref.set({
    ...(snapshot.data() as Record<string, unknown>),
    umRequest,
    storedAt: new Date().toISOString()
  });
}
```

- [ ] **Step 5: Run targeted tests and verify they pass**

Run:

```bash
npm test -- src/packages/um-platform/test/pas-fhir.test.ts src/apps/web/lib/pas-persistence.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit PAS and persistence migration**

```bash
git add src/packages/um-platform/src/pas-fhir.ts src/packages/um-platform/test/pas-fhir.test.ts src/apps/web/lib/pas-persistence.ts src/apps/web/lib/pas-persistence.test.ts
git commit -m "refactor: persist pas submissions as um requests"
```

## Task 3: Migrate Provider Documentation Evidence And Workflow

**Files:**
- Modify: `src/packages/incentive-agent/src/index.ts`
- Modify: `src/packages/incentive-agent/test/provider-documentation-event.test.ts`
- Modify: `src/apps/web/lib/provider-documentation-workflow.ts`
- Modify: `src/apps/web/lib/provider-documentation-workflow.test.ts`
- Modify: `src/apps/web/app/api/um/prior-auths/route.ts`
- Modify: `src/apps/web/app/api/um/prior-auths/[caseId]/evidence/route.ts`
- Modify: `src/apps/web/lib/provider-documentation-routes.test.ts`

- [ ] **Step 1: Write failing provider evidence tests**

In `src/packages/incentive-agent/test/provider-documentation-event.test.ts`, change the main evidence assertion to:

```ts
const evaluation = evaluateProviderDocumentationEvent(
  { eventType: "UM_REQUEST_CREATED", umRequestId: umRequest.id },
  { getEvidenceByUmRequestId: getEvidence, policy: createProviderDocumentationPolicy(5), monthToDateAmount: 0 }
);

expect(getEvidence).toHaveBeenCalledWith(umRequest.id);
expect(evaluation.request.requestObject).toMatchObject({
  umRequestId: umRequest.id,
  sourceCaseId: umRequest.sourceCaseId,
  planId: "acme-health-ppo",
  providerId: "lakeside-provider-admin",
  requestType: "outpatient_service",
  codingSystem: "CPT",
  billingCode: "73721",
  coveredBenefit: true,
  dtrRequested: true,
  dtrCompleted: true,
  outcomeStatusUsedForPayment: false,
  containsPhi: false
});
expect(evaluation.request.requestObject).not.toHaveProperty("outcomeStatus");
```

In `src/apps/web/lib/provider-documentation-workflow.test.ts`, update the happy path row expectation:

```ts
expect(rows[0]).toMatchObject({
  umRequestId: submitted.id,
  sourceCaseId: submitted.sourceCaseId,
  serviceLabel: "Knee MRI after injury",
  incentiveStatus: "paid",
  paymentStatus: "auto_executed",
  incentiveValue: 5,
  currency: "HBAR",
  reason: "Completed requested DTR"
});
```

- [ ] **Step 2: Run targeted tests and verify failure**

Run:

```bash
npm test -- src/packages/incentive-agent/test/provider-documentation-event.test.ts src/apps/web/lib/provider-documentation-workflow.test.ts src/apps/web/lib/provider-documentation-routes.test.ts
```

Expected: FAIL because provider documentation still looks up evidence by `caseId` and rows still use `caseId`.

- [ ] **Step 3: Update provider evidence and event evaluation**

In `src/packages/incentive-agent/src/index.ts`, replace provider dependency names and event validation:

```ts
export interface ProviderDocumentationEvaluationDependencies {
  getEvidenceByUmRequestId: (umRequestId: string) => ProviderDocumentationEvidence | null;
  policy: IncentivePolicy;
  monthToDateAmount?: number;
}

export function evaluateProviderDocumentationEvent(
  event: { eventType: string; umRequestId: string },
  dependencies: ProviderDocumentationEvaluationDependencies
): DemoEvaluation {
  if (event.eventType !== "UM_REQUEST_CREATED") {
    throw new Error("UNSUPPORTED_PROVIDER_DOCUMENTATION_EVENT");
  }

  const evidence = dependencies.getEvidenceByUmRequestId(event.umRequestId);
  if (!evidence) {
    throw new Error(`PROVIDER_DOCUMENTATION_EVIDENCE_NOT_FOUND:${event.umRequestId}`);
  }

  const request: EvaluationRequest = {
    evaluationType: "provider_documentation_completeness",
    submitter: evidence.submitter,
    requestObject: {
      umRequestId: evidence.umRequestId,
      sourceCaseId: evidence.sourceCaseId,
      planId: evidence.planId,
      providerId: evidence.providerId,
      requestType: evidence.requestType,
      serviceCode: evidence.serviceCode,
      codingSystem: evidence.codingSystem,
      billingCode: evidence.billingCode,
      coveredBenefit: evidence.coveredBenefit,
      dtrRequested: evidence.dtrRequested,
      dtrCompleted: evidence.dtrCompleted,
      dtrTemplateCompleted: evidence.dtrCompleted,
      outcomeStatusUsedForPayment: false,
      containsPhi: false
    }
  };

  return {
    request,
    policy: dependencies.policy,
    result: evaluatePolicy({
      policy: dependencies.policy,
      request,
      monthToDateAmount: dependencies.monthToDateAmount ?? 0
    }),
    explanation: explainDecision(evaluatePolicy({
      policy: dependencies.policy,
      request,
      monthToDateAmount: dependencies.monthToDateAmount ?? 0
    }))
  };
}
```

After adding this, remove the duplicate `evaluatePolicy(...)` call by storing it in `const result = evaluatePolicy(...)` and passing `result` to `explainDecision(result)`.

- [ ] **Step 4: Update provider documentation workflow rows**

In `src/apps/web/lib/provider-documentation-workflow.ts`, rename row identity fields:

```ts
export interface IncentiveWorklistRow {
  umRequestId: string;
  sourceCaseId: string;
  planId?: string;
  planDisplay?: string;
  submittedAt: string;
  providerGroupDisplay: string;
  requestType: RequestType;
  serviceLabel: string;
  serviceCode: ServiceCode;
  outcomeStatus: UMRequest["outcomeStatus"];
  incentiveStatus: IncentiveStatus;
  paymentStatus: PaymentStatus;
  incentiveValue: number;
  currency: Currency;
  settlementToken: SettlementToken;
  reason: string;
  reasonCodes: string[];
  policyId: string;
  policyControls: string[];
  policyCriteria: PolicyCriterionMatch[];
  audit: AuditRecord;
  walletId: string | null;
  paymentIntentId: string | null;
  transactionId: string | null;
}
```

Update event processing to ignore `PAS_SUBMITTED` and process `UM_REQUEST_CREATED`:

```ts
async function processPlatformEvents(umRequestId?: string): Promise<void> {
  const events = persistence ? await persistence.listUmEvents() : platform.listEvents();

  for (const event of events) {
    if (event.eventType !== "UM_REQUEST_CREATED") {
      continue;
    }

    if (!umRequestId || event.umRequestId === umRequestId) {
      try {
        await processEvent(event);
      } catch {
        // Provider submission must not fail because the async incentive layer is unavailable.
      }
    }
  }
}
```

When saving a submitted request, call:

```ts
await persistence?.savePasSubmission({
  umRequest,
  evidence,
  fhirBundle: buildPasFhirBundle(umRequest, evidence)
});
```

- [ ] **Step 5: Update API route compatibility**

In `src/apps/web/app/api/um/prior-auths/route.ts`, keep the route URL but return `UMRequest`:

```ts
export async function GET() {
  return NextResponse.json(await providerDocumentationWorkflow.listUmRequests());
}
```

In `src/apps/web/app/api/um/prior-auths/[caseId]/evidence/route.ts`, resolve either ID form:

```ts
export async function GET(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const evidence = await providerDocumentationWorkflow.getEvidence(caseId);

  if (!evidence) {
    return NextResponse.json({ error: "EVIDENCE_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(evidence);
}
```

The workflow `getEvidence(id)` must first try `umRequestId`, then fall back to `sourceCaseId`.

- [ ] **Step 6: Run provider documentation tests and verify they pass**

Run:

```bash
npm test -- src/packages/incentive-agent/test/provider-documentation-event.test.ts src/apps/web/lib/provider-documentation-workflow.test.ts src/apps/web/lib/provider-documentation-routes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Provider Documentation migration**

```bash
git add src/packages/incentive-agent/src/index.ts src/packages/incentive-agent/test/provider-documentation-event.test.ts src/apps/web/lib/provider-documentation-workflow.ts src/apps/web/lib/provider-documentation-workflow.test.ts src/apps/web/app/api/um/prior-auths/route.ts 'src/apps/web/app/api/um/prior-auths/[caseId]/evidence/route.ts' src/apps/web/lib/provider-documentation-routes.test.ts
git commit -m "refactor: derive provider documentation evidence from um requests"
```

## Task 4: Add Delegate UM Policy Evaluation

**Files:**
- Modify: `src/packages/policy-engine/src/index.ts`
- Modify: `src/packages/policy-engine/test/evaluate-policy.test.ts`
- Modify: `src/apps/web/lib/policy-store.ts`

- [ ] **Step 1: Write failing delegate policy tests**

Append tests to `src/packages/policy-engine/test/evaluate-policy.test.ts`:

```ts
const delegatePolicy: IncentivePolicy = {
  policyId: "delegate-um-sla-bonus-v1",
  version: "v1",
  status: "active",
  evaluationType: "delegate_um_sla_bonus",
  contractPair: {
    planId: "acme-health-ppo",
    planName: "Acme Health PPO",
    providerId: "northstar-um",
    providerName: "Northstar UM"
  },
  effectivePeriod: {
    startsOn: "2026-05-01",
    endsOn: null
  },
  incentiveScope: {
    eligibleRequestTypes: ["outpatient_service", "pharmacy_benefit"]
  },
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: false,
    requiresDtrCompletionWhenRequested: false,
    requiresDeterminationWithinSla: true,
    requiresClinicalReviewCompletion: true,
    prohibitsOutcomeBasedPayment: true
  },
  payout: {
    token: "HBAR",
    amountPerEligibleRequest: 5,
    monthlyCap: 500
  },
  settlement: {
    mode: "auto",
    recipientWalletId: "0.0.9049550",
    requiresHumanApproval: false
  }
};

const approvedDelegateRequest: EvaluationRequest = {
  evaluationType: "delegate_um_sla_bonus",
  submitter: { id: "northstar-um" },
  requestObject: {
    umRequestId: "UMR-260526-0900-AAAA1111",
    planId: "acme-health-ppo",
    delegateVendorId: "northstar-um",
    requestType: "outpatient_service",
    state: "determined",
    outcomeStatusPresent: true,
    outcomeStatus: "approved",
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
};

it("approves delegate UM SLA bonus for approved and denied determinations when review evidence passes", () => {
  const approved = evaluatePolicy({ policy: delegatePolicy, request: approvedDelegateRequest, monthToDateAmount: 0 });
  const denied = evaluatePolicy({
    policy: delegatePolicy,
    request: {
      ...approvedDelegateRequest,
      requestObject: {
        ...approvedDelegateRequest.requestObject,
        outcomeStatus: "denied"
      }
    },
    monthToDateAmount: 0
  });

  expect(approved).toMatchObject({
    decision: "approved",
    amount: 5,
    currency: "HBAR",
    walletId: "0.0.9049550",
    reasonCodes: []
  });
  expect(denied).toMatchObject({
    decision: "approved",
    amount: 5,
    walletId: "0.0.9049550",
    reasonCodes: []
  });
});

it("blocks delegate UM SLA bonus when SLA is exceeded or outcome is used as payment basis", () => {
  const late = evaluatePolicy({
    policy: delegatePolicy,
    request: {
      ...approvedDelegateRequest,
      requestObject: {
        ...approvedDelegateRequest.requestObject,
        completedWithinSla: false
      }
    },
    monthToDateAmount: 0
  });
  const outcomeBased = evaluatePolicy({
    policy: delegatePolicy,
    request: {
      ...approvedDelegateRequest,
      requestObject: {
        ...approvedDelegateRequest.requestObject,
        outcomeStatusUsedForPayment: true
      }
    },
    monthToDateAmount: 0
  });

  expect(late).toMatchObject({
    decision: "blocked",
    amount: 0,
    reasonCodes: expect.arrayContaining(["SLA_EXCEEDED"])
  });
  expect(outcomeBased).toMatchObject({
    decision: "blocked",
    amount: 0,
    reasonCodes: expect.arrayContaining(["PROHIBITED_OUTCOME_METRIC"])
  });
});
```

- [ ] **Step 2: Run policy tests and verify failure**

Run:

```bash
npm test -- src/packages/policy-engine/test/evaluate-policy.test.ts
```

Expected: FAIL because `eligibilityCriteria` has no delegate fields and `evaluatePolicy` does not evaluate delegate SLA criteria.

- [ ] **Step 3: Extend policy types and branch evaluation by type**

In `src/packages/policy-engine/src/index.ts`, add optional delegate criteria:

```ts
eligibilityCriteria: {
  appliesOnlyToCoveredBenefits: boolean;
  requiresDtrCompletionWhenRequested: boolean;
  requiresDeterminationWithinSla?: boolean;
  requiresClinicalReviewCompletion?: boolean;
  prohibitsOutcomeBasedPayment?: boolean;
};
```

At the top of `evaluatePolicy`, after token setup and before provider-specific checks:

```ts
if (policy.evaluationType === "delegate_um_sla_bonus") {
  return evaluateDelegateUmSlaPolicy(input);
}
```

Add a dedicated function:

```ts
function evaluateDelegateUmSlaPolicy(input: EvaluatePolicyInput): PolicyEvaluationResult {
  const { policy, request, monthToDateAmount } = input;
  const reasonCodes: string[] = [];
  const token = policy.payout.token;

  if (request.evaluationType !== policy.evaluationType) reasonCodes.push("EVALUATION_TYPE_MISMATCH");
  if (policy.status !== "active") reasonCodes.push("POLICY_INACTIVE");
  if (request.requestObject.planId !== policy.contractPair.planId) reasonCodes.push("PLAN_NOT_IN_CONTRACT");
  if (request.submitter.id !== policy.contractPair.providerId || request.requestObject.delegateVendorId !== policy.contractPair.providerId) {
    reasonCodes.push("DELEGATE_VENDOR_NOT_IN_CONTRACT");
  }

  const requestType = String(request.requestObject.requestType ?? "");
  const eligibleRequestTypes = policy.incentiveScope.eligibleRequestTypes ?? [];
  if (eligibleRequestTypes.length > 0 && !eligibleRequestTypes.includes(requestType)) {
    reasonCodes.push("REQUEST_TYPE_NOT_ELIGIBLE");
  }

  if (request.requestObject.state !== "determined") reasonCodes.push("UM_REQUEST_NOT_DETERMINED");
  if (request.requestObject.outcomeStatusPresent !== true) reasonCodes.push("OUTCOME_STATUS_MISSING");
  if (policy.eligibilityCriteria.requiresDeterminationWithinSla && request.requestObject.completedWithinSla !== true) {
    reasonCodes.push("SLA_EXCEEDED");
  }
  if (policy.eligibilityCriteria.requiresClinicalReviewCompletion) {
    if (request.requestObject.clinicalReviewCompleted !== true) reasonCodes.push("CLINICAL_REVIEW_INCOMPLETE");
    if (request.requestObject.medicalNecessityReviewed !== true) reasonCodes.push("MEDICAL_NECESSITY_NOT_REVIEWED");
    if (request.requestObject.policyCriteriaChecked !== true) reasonCodes.push("POLICY_CRITERIA_NOT_CHECKED");
    if (request.requestObject.rationaleCaptured !== true) reasonCodes.push("RATIONALE_NOT_CAPTURED");
  }
  if (request.requestObject.auditReady !== true) reasonCodes.push("PAS_AUDIT_RECORD_MISSING");
  if (policy.eligibilityCriteria.prohibitsOutcomeBasedPayment && request.requestObject.outcomeStatusUsedForPayment !== false) {
    reasonCodes.push("PROHIBITED_OUTCOME_METRIC");
  }
  if (request.requestObject.containsPhi !== false) reasonCodes.push("PHI_IN_PAYMENT_METADATA");
  if (monthToDateAmount + policy.payout.amountPerEligibleRequest > policy.payout.monthlyCap) {
    reasonCodes.push("MONTHLY_CAP_EXCEEDED");
  }

  const blocked = reasonCodes.length > 0;
  return result({
    decision: blocked ? "blocked" : "approved",
    policy,
    reasonCodes,
    token
  });
}
```

- [ ] **Step 4: Seed the delegate policy**

In `src/apps/web/lib/policy-store.ts`, add constants and a default policy:

```ts
const DELEGATE_VENDOR_ID = "northstar-um";
const DELEGATE_VENDOR_WALLET_ID = "0.0.9049550";
```

Add to `defaultIncentivePolicies`:

```ts
delegate_um_acme_sla_bonus: {
  policyId: "delegate-um-sla-bonus-v1",
  version: "v1",
  status: "active",
  evaluationType: "delegate_um_sla_bonus",
  contractPair: {
    planId: "acme-health-ppo",
    planName: "Acme Health PPO",
    providerId: DELEGATE_VENDOR_ID,
    providerName: "Northstar UM"
  },
  effectivePeriod: {
    startsOn: "2026-05-01",
    endsOn: null
  },
  incentiveScope: {
    eligibleRequestTypes: ["outpatient_service", "pharmacy_benefit"]
  },
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: false,
    requiresDtrCompletionWhenRequested: false,
    requiresDeterminationWithinSla: true,
    requiresClinicalReviewCompletion: true,
    prohibitsOutcomeBasedPayment: true
  },
  payout: {
    token: "HBAR",
    amountPerEligibleRequest: 5,
    monthlyCap: 500
  },
  settlement: {
    mode: "auto",
    recipientWalletId: DELEGATE_VENDOR_WALLET_ID,
    requiresHumanApproval: false
  }
}
```

- [ ] **Step 5: Run policy tests and verify pass**

Run:

```bash
npm test -- src/packages/policy-engine/test/evaluate-policy.test.ts src/apps/web/lib/policy-store.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit delegate policy evaluation**

```bash
git add src/packages/policy-engine/src/index.ts src/packages/policy-engine/test/evaluate-policy.test.ts src/apps/web/lib/policy-store.ts src/apps/web/lib/policy-store.test.ts
git commit -m "feat: evaluate delegate um sla policy"
```

## Task 5: Add Delegate UM Incentive Agent Evaluation

**Files:**
- Modify: `src/packages/incentive-agent/src/index.ts`
- Create: `src/packages/incentive-agent/test/delegate-um-event.test.ts`

- [ ] **Step 1: Write failing delegate incentive-agent tests**

Create `src/packages/incentive-agent/test/delegate-um-event.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { IncentivePolicy } from "@operon-labs/policy-engine";
import { evaluateDelegateUmSlaEvent, type DelegateUmSlaEvidence } from "../src/index";

const policy: IncentivePolicy = {
  policyId: "delegate-um-sla-bonus-v1",
  version: "v1",
  status: "active",
  evaluationType: "delegate_um_sla_bonus",
  contractPair: {
    planId: "acme-health-ppo",
    planName: "Acme Health PPO",
    providerId: "northstar-um",
    providerName: "Northstar UM"
  },
  effectivePeriod: { startsOn: "2026-05-01", endsOn: null },
  incentiveScope: { eligibleRequestTypes: ["outpatient_service"] },
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: false,
    requiresDtrCompletionWhenRequested: false,
    requiresDeterminationWithinSla: true,
    requiresClinicalReviewCompletion: true,
    prohibitsOutcomeBasedPayment: true
  },
  payout: { token: "HBAR", amountPerEligibleRequest: 5, monthlyCap: 500 },
  settlement: { mode: "auto", recipientWalletId: "0.0.9049550", requiresHumanApproval: false }
};

const evidence: DelegateUmSlaEvidence = {
  umRequestId: "UMR-260526-0900-AAAA1111",
  sourceCaseId: "PA-260526-0900-AAAA1111",
  planId: "acme-health-ppo",
  delegateVendorId: "northstar-um",
  requestType: "outpatient_service",
  state: "determined",
  outcomeStatus: "denied",
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
};

describe("evaluateDelegateUmSlaEvent", () => {
  it("pulls delegate evidence by umRequestId and approves denied determinations without using outcome value", () => {
    const getEvidence = vi.fn(() => evidence);

    const evaluation = evaluateDelegateUmSlaEvent(
      { eventType: "UM_REQUEST_DETERMINED", umRequestId: evidence.umRequestId },
      { getEvidenceByUmRequestId: getEvidence, policy, monthToDateAmount: 0 }
    );

    expect(getEvidence).toHaveBeenCalledWith(evidence.umRequestId);
    expect(evaluation.request).toMatchObject({
      evaluationType: "delegate_um_sla_bonus",
      submitter: { id: "northstar-um" },
      requestObject: {
        umRequestId: evidence.umRequestId,
        outcomeStatus: "denied",
        outcomeStatusUsedForPayment: false,
        completedWithinSla: true
      }
    });
    expect(evaluation.result).toMatchObject({
      decision: "approved",
      amount: 5,
      walletId: "0.0.9049550",
      reasonCodes: []
    });
  });

  it("throws before evidence lookup for unsupported events", () => {
    const getEvidence = vi.fn();

    expect(() =>
      evaluateDelegateUmSlaEvent(
        { eventType: "UM_REQUEST_CREATED", umRequestId: evidence.umRequestId },
        { getEvidenceByUmRequestId: getEvidence, policy, monthToDateAmount: 0 }
      )
    ).toThrow("UNSUPPORTED_DELEGATE_UM_EVENT");
    expect(getEvidence).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the delegate incentive-agent test and verify failure**

Run:

```bash
npm test -- src/packages/incentive-agent/test/delegate-um-event.test.ts
```

Expected: FAIL because `evaluateDelegateUmSlaEvent` and `DelegateUmSlaEvidence` are not exported.

- [ ] **Step 3: Add delegate evidence and evaluator**

In `src/packages/incentive-agent/src/index.ts`, add:

```ts
export interface DelegateUmSlaEvidence {
  umRequestId: string;
  sourceCaseId: string;
  planId: string;
  delegateVendorId: string;
  requestType: string;
  state: string;
  outcomeStatus: "approved" | "denied";
  outcomeStatusPresent: boolean;
  outcomeStatusUsedForPayment: false;
  completedWithinSla: boolean;
  slaHours: 24;
  clinicalReviewCompleted: boolean;
  medicalNecessityReviewed: boolean;
  policyCriteriaChecked: boolean;
  rationaleCaptured: boolean;
  auditReady: boolean;
  containsPhi: false;
}

export interface DelegateUmSlaEvaluationDependencies {
  getEvidenceByUmRequestId: (umRequestId: string) => DelegateUmSlaEvidence | null;
  policy: IncentivePolicy;
  monthToDateAmount?: number;
}

export function evaluateDelegateUmSlaEvent(
  event: { eventType: string; umRequestId: string },
  dependencies: DelegateUmSlaEvaluationDependencies
): DemoEvaluation {
  if (event.eventType !== "UM_REQUEST_DETERMINED") {
    throw new Error("UNSUPPORTED_DELEGATE_UM_EVENT");
  }

  const evidence = dependencies.getEvidenceByUmRequestId(event.umRequestId);
  if (!evidence) {
    throw new Error(`DELEGATE_UM_EVIDENCE_NOT_FOUND:${event.umRequestId}`);
  }

  const request: EvaluationRequest = {
    evaluationType: "delegate_um_sla_bonus",
    submitter: { id: evidence.delegateVendorId },
    requestObject: {
      umRequestId: evidence.umRequestId,
      sourceCaseId: evidence.sourceCaseId,
      planId: evidence.planId,
      delegateVendorId: evidence.delegateVendorId,
      requestType: evidence.requestType,
      state: evidence.state,
      outcomeStatus: evidence.outcomeStatus,
      outcomeStatusPresent: evidence.outcomeStatusPresent,
      outcomeStatusUsedForPayment: evidence.outcomeStatusUsedForPayment,
      completedWithinSla: evidence.completedWithinSla,
      slaHours: evidence.slaHours,
      clinicalReviewCompleted: evidence.clinicalReviewCompleted,
      medicalNecessityReviewed: evidence.medicalNecessityReviewed,
      policyCriteriaChecked: evidence.policyCriteriaChecked,
      rationaleCaptured: evidence.rationaleCaptured,
      auditReady: evidence.auditReady,
      containsPhi: evidence.containsPhi
    }
  };
  const result = evaluatePolicy({
    policy: dependencies.policy,
    request,
    monthToDateAmount: dependencies.monthToDateAmount ?? 0
  });

  return {
    request,
    policy: dependencies.policy,
    result,
    explanation: explainDecision(result)
  };
}
```

- [ ] **Step 4: Run incentive-agent tests and verify pass**

Run:

```bash
npm test -- src/packages/incentive-agent/test/delegate-um-event.test.ts src/packages/incentive-agent/test/provider-documentation-event.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit delegate incentive agent**

```bash
git add src/packages/incentive-agent/src/index.ts src/packages/incentive-agent/test/delegate-um-event.test.ts src/packages/incentive-agent/test/provider-documentation-event.test.ts
git commit -m "feat: add delegate um event evaluation"
```

## Task 6: Build Delegate UM Workflow

**Files:**
- Create: `src/apps/web/lib/delegate-um-workflow.ts`
- Create: `src/apps/web/lib/delegate-um-workflow.test.ts`

- [ ] **Step 1: Write failing workflow tests**

Create `src/apps/web/lib/delegate-um-workflow.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executePolicyBoundPayment } from "@operon-labs/hedera-executor";
import { createInMemoryUmPlatform } from "@operon-labs/um-platform";
import { createDelegateUmWorkflow } from "./delegate-um-workflow";
import { createInMemoryPolicyStore, defaultIncentivePolicies } from "./policy-store";

vi.mock("@operon-labs/hedera-executor", () => ({
  executePolicyBoundPayment: vi.fn(async (request: { auditId: string; currency: string }) => ({
    status: "simulated",
    network: "testnet",
    transactionId: `testnet-${request.auditId}-${request.currency.toLowerCase()}`
  }))
}));

const executePolicyBoundPaymentMock = vi.mocked(executePolicyBoundPayment);

describe("delegate UM workflow", () => {
  beforeEach(() => {
    executePolicyBoundPaymentMock.mockClear();
  });

  it("lists pending UMRequests in the delegate workqueue and starts review", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-AAAA1111" });
    const workflow = createDelegateUmWorkflow(platform);
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });

    await expect(workflow.listWorkqueue()).resolves.toEqual([
      expect.objectContaining({
        umRequestId: umRequest.id,
        sourceCaseId: umRequest.sourceCaseId,
        state: "pend",
        slaStatus: "pending"
      })
    ]);

    const started = await workflow.startReview(umRequest.id, "reviewer-ana");
    expect(started).toMatchObject({
      id: umRequest.id,
      state: "in_clinical_review",
      clinicalReview: { reviewerId: "reviewer-ana" }
    });
  });

  it("settles an approved delegate SLA bonus for a denied determination completed within SLA", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-BBBB2222" });
    const workflow = createDelegateUmWorkflow(
      platform,
      undefined,
      createInMemoryPolicyStore({
        delegate_um_acme_sla_bonus: defaultIncentivePolicies.delegate_um_acme_sla_bonus
      })
    );
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    await workflow.startReview(umRequest.id, "reviewer-ana");

    const row = await workflow.completeDetermination(umRequest.id, {
      outcomeStatus: "denied",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true,
      denialReasonCode: "NOT_MEDICALLY_NECESSARY"
    });

    expect(row).toMatchObject({
      umRequestId: umRequest.id,
      sourceCaseId: umRequest.sourceCaseId,
      outcomeStatus: "denied",
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 5,
      reasonCodes: []
    });
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        incentiveEvaluationId: umRequest.id,
        caseId: umRequest.id,
        triggerEvent: "UM_REQUEST_DETERMINED",
        amount: 5,
        walletId: "0.0.9049550"
      }),
      expect.any(Object)
    );
  });
});
```

- [ ] **Step 2: Run delegate workflow tests and verify failure**

Run:

```bash
npm test -- src/apps/web/lib/delegate-um-workflow.test.ts
```

Expected: FAIL because `delegate-um-workflow.ts` does not exist.

- [ ] **Step 3: Implement delegate workflow types and listing**

Create `src/apps/web/lib/delegate-um-workflow.ts`:

```ts
import { createAuditRecord, type AuditRecord } from "@operon-labs/audit-log";
import { executePolicyBoundPayment, type PaymentIntentStore } from "@operon-labs/hedera-executor";
import { evaluateDelegateUmSlaEvent, type DelegateUmSlaEvidence } from "@operon-labs/incentive-agent";
import type { Currency, SettlementToken } from "@operon-labs/policy-engine";
import {
  createInMemoryUmPlatform,
  completeClinicalReviewForRequest,
  startClinicalReviewForRequest,
  type CompleteClinicalReviewInput,
  type UMRequest,
  type UmPlatform
} from "@operon-labs/um-platform";
import { createBusinessEvaluationAttestationStore } from "./business-evaluation-attestation-store";
import { createPaymentIntentStoreFromEnv } from "./payment-intent-store";
import { createPaymentPolicyStoreFromEnv, type PaymentPolicyStore } from "./payment-policy-store";
import { createPasPersistenceStoreFromEnv, type PasPersistenceStore } from "./pas-persistence";
import { createPolicyStoreFromEnv, type PolicyStore } from "./policy-store";

export type DelegateIncentiveStatus = "pending" | "not_eligible" | "paid" | "payment_failed";
export type DelegatePaymentStatus = "pending" | "auto_executed" | "blocked_by_policy" | "execution_failed";
export type DelegateSlaStatus = "pending" | "within_sla" | "breached";

export interface DelegateUmRow {
  umRequestId: string;
  sourceCaseId: string;
  planId: string;
  planDisplay: string;
  delegateVendorId: string;
  requestType: UMRequest["requestType"];
  serviceLabel: string;
  submittedAt: string;
  pendStartedAt: string;
  slaDeadlineAt: string;
  determinedAt: string | null;
  timeRemainingMs: number;
  state: UMRequest["state"];
  outcomeStatus: UMRequest["outcomeStatus"];
  slaStatus: DelegateSlaStatus;
  incentiveStatus: DelegateIncentiveStatus;
  paymentStatus: DelegatePaymentStatus;
  incentiveValue: number;
  currency: Currency;
  settlementToken: SettlementToken;
  reason: string;
  reasonCodes: string[];
  policyId: string | null;
  audit: AuditRecord | null;
  walletId: string | null;
  paymentIntentId: string | null;
  transactionId: string | null;
}
```

Add factory signature:

```ts
export function createDelegateUmWorkflow(
  platform: UmPlatform = createInMemoryUmPlatform(),
  persistence: PasPersistenceStore | undefined = createPasPersistenceStoreFromEnv(),
  policyStore: PolicyStore = createPolicyStoreFromEnv(),
  paymentIntentStore: PaymentIntentStore | undefined = createPaymentIntentStoreFromEnv(),
  paymentPolicyStore: PaymentPolicyStore = createPaymentPolicyStoreFromEnv()
) {
  const rows = new Map<string, DelegateUmRow>();

  async function listRequests(): Promise<UMRequest[]> {
    return persistence ? persistence.listUmRequests() : platform.listUmRequests();
  }

  async function getRequest(umRequestId: string): Promise<UMRequest | null> {
    return (await persistence?.getUmRequest(umRequestId)) ?? platform.getUmRequest(umRequestId);
  }

  async function saveRequest(umRequest: UMRequest): Promise<void> {
    await persistence?.saveUmRequest(umRequest);
  }

  return {
    async listWorkqueue() {
      return (await listRequests())
        .filter((request) => request.delegateVendorId && request.state !== "determined")
        .map((request) => buildPendingRow(request))
        .sort((left, right) => left.slaDeadlineAt.localeCompare(right.slaDeadlineAt));
    },
    async listPlanRows() {
      return [
        ...(await listRequests()).map((request) => rows.get(request.id) ?? buildPendingRow(request))
      ].sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    },
    async startReview(umRequestId: string, reviewerId: string) {
      const persisted = await getRequest(umRequestId);
      if (!persisted) throw new Error(`UM_REQUEST_NOT_FOUND:${umRequestId}`);
      const started = persistence
        ? startClinicalReviewForRequest(persisted, reviewerId)
        : platform.startClinicalReview(umRequestId, reviewerId);
      await saveRequest(started);
      return started;
    },
    async completeDetermination(umRequestId: string, input: CompleteClinicalReviewInput) {
      const persisted = await getRequest(umRequestId);
      if (!persisted) throw new Error(`UM_REQUEST_NOT_FOUND:${umRequestId}`);
      const request = persistence
        ? completeClinicalReviewForRequest(persisted, input)
        : platform.completeClinicalReview(umRequestId, input);
      await saveRequest(request);
      const row = await settleDetermination(request, rows, policyStore, paymentIntentStore, paymentPolicyStore);
      rows.set(umRequestId, row);
      return row;
    }
  };
}
```

- [ ] **Step 4: Implement evidence, settlement, and row helpers**

In the same file, add helpers:

```ts
function buildDelegateEvidence(request: UMRequest): DelegateUmSlaEvidence {
  const clinicalReviewCompleted =
    request.clinicalReview.medicalNecessityReviewed &&
    request.clinicalReview.policyCriteriaChecked &&
    request.clinicalReview.rationaleCaptured;

  return {
    umRequestId: request.id,
    sourceCaseId: request.sourceCaseId,
    planId: request.planId,
    delegateVendorId: request.delegateVendorId ?? "northstar-um",
    requestType: request.requestType,
    state: request.state,
    outcomeStatus: request.outcomeStatus ?? "approved",
    outcomeStatusPresent: request.outcomeStatus !== null,
    outcomeStatusUsedForPayment: false,
    completedWithinSla:
      request.determinedAt !== null &&
      new Date(request.determinedAt).getTime() <= new Date(request.slaDeadlineAt).getTime(),
    slaHours: request.slaHours,
    clinicalReviewCompleted,
    medicalNecessityReviewed: request.clinicalReview.medicalNecessityReviewed,
    policyCriteriaChecked: request.clinicalReview.policyCriteriaChecked,
    rationaleCaptured: request.clinicalReview.rationaleCaptured,
    auditReady: Boolean(request.auditRefs.pasClaimBundleId),
    containsPhi: false
  };
}

function buildPendingRow(request: UMRequest): DelegateUmRow {
  return {
    umRequestId: request.id,
    sourceCaseId: request.sourceCaseId,
    planId: request.planId,
    planDisplay: request.planDisplay,
    delegateVendorId: request.delegateVendorId ?? "northstar-um",
    requestType: request.requestType,
    serviceLabel: request.serviceLabel,
    submittedAt: request.submittedAt,
    pendStartedAt: request.pendStartedAt,
    slaDeadlineAt: request.slaDeadlineAt,
    determinedAt: request.determinedAt,
    timeRemainingMs: Math.max(0, new Date(request.slaDeadlineAt).getTime() - Date.now()),
    state: request.state,
    outcomeStatus: request.outcomeStatus,
    slaStatus: request.state === "determined" ? "within_sla" : "pending",
    incentiveStatus: "pending",
    paymentStatus: "pending",
    incentiveValue: 0,
    currency: "HBAR",
    settlementToken: { symbol: "HBAR" },
    reason: "Pending determination",
    reasonCodes: [],
    policyId: null,
    audit: null,
    walletId: null,
    paymentIntentId: null,
    transactionId: null
  };
}
```

Implement `settleDetermination(...)` using the same pattern as provider documentation: find a matching `delegate_um_sla_bonus` policy by plan, delegate vendor ID, request type, and submitted timestamp; call `evaluateDelegateUmSlaEvent`; create audit; execute policy-bound payment only for approved rows with wallet.

- [ ] **Step 5: Run delegate workflow tests and verify pass**

Run:

```bash
npm test -- src/apps/web/lib/delegate-um-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit delegate workflow**

```bash
git add src/apps/web/lib/delegate-um-workflow.ts src/apps/web/lib/delegate-um-workflow.test.ts
git commit -m "feat: add delegate um workflow"
```

## Task 7: Add Delegate UM API Routes

**Files:**
- Create: `src/apps/web/app/api/delegate-um/workqueue/route.ts`
- Create: `src/apps/web/app/api/delegate-um/requests/[umRequestId]/start-review/route.ts`
- Create: `src/apps/web/app/api/delegate-um/requests/[umRequestId]/determination/route.ts`
- Create: `src/apps/web/app/api/delegate-um/plan/route.ts`
- Create: `src/apps/web/lib/delegate-um-routes.test.ts`

- [ ] **Step 1: Write failing API route tests**

Create `src/apps/web/lib/delegate-um-routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { POST as submitPriorAuth } from "../app/api/um/prior-auths/route";
import { GET as listWorkqueue } from "../app/api/delegate-um/workqueue/route";
import { POST as startReview } from "../app/api/delegate-um/requests/[umRequestId]/start-review/route";
import { POST as submitDetermination } from "../app/api/delegate-um/requests/[umRequestId]/determination/route";
import { GET as listPlanRows } from "../app/api/delegate-um/plan/route";

describe("delegate UM API routes", () => {
  it("reviews a submitted UMRequest and exposes plan eligibility", async () => {
    const submittedResponse = await submitPriorAuth(
      new Request("http://localhost/api/um/prior-auths", {
        method: "POST",
        body: JSON.stringify({
          patientId: "patient-maya-chen",
          planId: "acme-health-ppo",
          requestType: "outpatient_service",
          serviceCode: "knee_mri"
        })
      })
    );
    const submitted = (await submittedResponse.json()) as { id: string; sourceCaseId: string };

    const workqueueResponse = await listWorkqueue();
    const workqueue = (await workqueueResponse.json()) as { rows: Array<{ umRequestId: string }> };
    expect(workqueue.rows).toEqual(expect.arrayContaining([expect.objectContaining({ umRequestId: submitted.id })]));

    const startResponse = await startReview(
      new Request(`http://localhost/api/delegate-um/requests/${submitted.id}/start-review`, {
        method: "POST",
        body: JSON.stringify({ reviewerId: "reviewer-ana" })
      }),
      { params: Promise.resolve({ umRequestId: submitted.id }) }
    );
    expect(startResponse.status).toBe(200);

    const determinationResponse = await submitDetermination(
      new Request(`http://localhost/api/delegate-um/requests/${submitted.id}/determination`, {
        method: "POST",
        body: JSON.stringify({
          outcomeStatus: "approved",
          medicalNecessityReviewed: true,
          policyCriteriaChecked: true,
          rationaleCaptured: true
        })
      }),
      { params: Promise.resolve({ umRequestId: submitted.id }) }
    );
    const row = (await determinationResponse.json()) as { umRequestId: string; incentiveStatus: string };
    expect(row).toMatchObject({ umRequestId: submitted.id, incentiveStatus: "paid" });

    const planResponse = await listPlanRows();
    const planRows = (await planResponse.json()) as { rows: Array<{ umRequestId: string; sourceCaseId: string }> };
    expect(planRows.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ umRequestId: submitted.id, sourceCaseId: submitted.sourceCaseId })
      ])
    );
  });
});
```

- [ ] **Step 2: Run route test and verify failure**

Run:

```bash
npm test -- src/apps/web/lib/delegate-um-routes.test.ts
```

Expected: FAIL because delegate API route files do not exist.

- [ ] **Step 3: Add a shared UM platform singleton**

Create `src/apps/web/lib/um-platform-singleton.ts` so Provider Documentation and Delegate UM share the same in-memory platform during local simulated runs:

```ts
import { createInMemoryUmPlatform } from "@operon-labs/um-platform";

export const umPlatform = createInMemoryUmPlatform();
```

Use `umPlatform` as the default platform in `provider-documentation-workflow.ts`:

```ts
import { umPlatform } from "./um-platform-singleton";

export const providerDocumentationWorkflow = createProviderDocumentationWorkflow(umPlatform);
```

At the bottom of `src/apps/web/lib/delegate-um-workflow.ts`, export:

```ts
import { umPlatform } from "./um-platform-singleton";

export const delegateUmWorkflow = createDelegateUmWorkflow(umPlatform);
```

- [ ] **Step 4: Implement API routes**

Create `src/apps/web/app/api/delegate-um/workqueue/route.ts`:

```ts
import { NextResponse } from "next/server";
import { delegateUmWorkflow } from "../../../../lib/delegate-um-workflow";

export async function GET() {
  return NextResponse.json({ rows: await delegateUmWorkflow.listWorkqueue() });
}
```

Create `src/apps/web/app/api/delegate-um/requests/[umRequestId]/start-review/route.ts`:

```ts
import { NextResponse } from "next/server";
import { delegateUmWorkflow } from "../../../../../../../lib/delegate-um-workflow";

export async function POST(request: Request, context: { params: Promise<{ umRequestId: string }> }) {
  const { umRequestId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const reviewerId = typeof body.reviewerId === "string" && body.reviewerId.length > 0 ? body.reviewerId : "reviewer-ana";

  try {
    return NextResponse.json(await delegateUmWorkflow.startReview(umRequestId, reviewerId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DELEGATE_REVIEW_START_FAILED" },
      { status: 400 }
    );
  }
}
```

Create `src/apps/web/app/api/delegate-um/requests/[umRequestId]/determination/route.ts` with input validation for `outcomeStatus`, review booleans, and optional `denialReasonCode`. Return `INVALID_DETERMINATION` with status `400` for malformed JSON.

Create `src/apps/web/app/api/delegate-um/plan/route.ts`:

```ts
import { NextResponse } from "next/server";
import { delegateUmWorkflow } from "../../../../lib/delegate-um-workflow";

export async function GET() {
  return NextResponse.json({ rows: await delegateUmWorkflow.listPlanRows() });
}
```

- [ ] **Step 5: Run route tests and verify pass**

Run:

```bash
npm test -- src/apps/web/lib/delegate-um-routes.test.ts src/apps/web/lib/provider-documentation-routes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit delegate API routes**

```bash
git add src/apps/web/lib/delegate-um-routes.test.ts src/apps/web/lib/um-platform-singleton.ts src/apps/web/lib/delegate-um-workflow.ts src/apps/web/lib/provider-documentation-workflow.ts src/apps/web/app/api/delegate-um src/apps/web/lib/provider-documentation-routes.test.ts
git commit -m "feat: expose delegate um api routes"
```

## Task 8: Add Delegate UM Views

**Files:**
- Replace: `src/apps/web/app/delegate-um/page.tsx`
- Create: `src/apps/web/app/delegate-um/plan/page.tsx`
- Create: `src/apps/web/components/delegate-um/DelegateUseCaseNavigation.tsx`
- Create: `src/apps/web/components/delegate-um/DelegateVendorConsole.tsx`
- Create: `src/apps/web/components/delegate-um/DelegatePlanConsole.tsx`
- Create: `src/apps/web/components/delegate-um/DelegateReviewModal.tsx`
- Modify: `src/apps/web/components/demo-catalog.ts`
- Modify: `src/apps/web/app/styles.css`

- [ ] **Step 1: Write lightweight component source tests**

Create `src/apps/web/components/delegate-um/DelegateVendorConsole.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "src/apps/web/components/delegate-um/DelegateVendorConsole.tsx"), "utf8");

describe("DelegateVendorConsole source", () => {
  it("uses UMRequest workqueue APIs and does not call payment endpoints", () => {
    expect(source).toContain("/api/delegate-um/workqueue");
    expect(source).toContain("/api/delegate-um/requests/");
    expect(source).not.toContain("/api/payments");
  });
});
```

Create `src/apps/web/components/delegate-um/DelegatePlanConsole.test.ts` with:

```ts
expect(source).toContain("/api/delegate-um/plan");
expect(source).toContain("Outcome status");
expect(source).toContain("SLA");
```

- [ ] **Step 2: Run component tests and verify failure**

Run:

```bash
npm test -- src/apps/web/components/delegate-um/DelegateVendorConsole.test.ts src/apps/web/components/delegate-um/DelegatePlanConsole.test.ts
```

Expected: FAIL because component files do not exist.

- [ ] **Step 3: Add navigation and pages**

Create `DelegateUseCaseNavigation.tsx`:

```tsx
import Link from "next/link";

type DelegateUseCaseView = "vendor" | "plan" | "policies";

export function DelegateUseCaseNavigation({ activeView }: { activeView: DelegateUseCaseView }) {
  return (
    <nav className="use-case-nav" aria-label="Delegate UM use case views">
      <Link aria-current={activeView === "vendor" ? "page" : undefined} href="/delegate-um">
        Delegate Vendor View
      </Link>
      <Link aria-current={activeView === "plan" ? "page" : undefined} href="/delegate-um/plan">
        Health Plan View
      </Link>
      <Link aria-current={activeView === "policies" ? "page" : undefined} href="/delegate-um/policies">
        Policies View
      </Link>
    </nav>
  );
}
```

Replace `src/apps/web/app/delegate-um/page.tsx`:

```tsx
import type { Metadata } from "next";
import { DelegateVendorConsole } from "../../components/delegate-um/DelegateVendorConsole";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Delegate UM SLA Bonus",
  description: "Delegate vendor workqueue for SLA-bound UMRequest clinical review."
};

export default function DelegateUmPage() {
  return <DelegateVendorConsole />;
}
```

Create the plan page using the same metadata pattern and `DelegatePlanConsole`. The policies page is created in Task 9 after the policy-card view model supports Delegate UM cards.

- [ ] **Step 4: Add DelegateVendorConsole**

Create `DelegateVendorConsole.tsx` as a client component that:

- fetches `/api/delegate-um/workqueue`
- renders rows with UM request ID, source PA ID, service, plan, SLA deadline, time remaining, and state
- opens `DelegateReviewModal`
- refreshes after start review and determination

Use this row type:

```ts
interface DelegateUmRow {
  umRequestId: string;
  sourceCaseId: string;
  planDisplay: string;
  serviceLabel: string;
  submittedAt: string;
  slaDeadlineAt: string;
  timeRemainingMs: number;
  state: "pend" | "in_clinical_review" | "determined";
  outcomeStatus: "approved" | "denied" | null;
}
```

- [ ] **Step 5: Add DelegateReviewModal**

Create `DelegateReviewModal.tsx` with controlled checkboxes:

```tsx
const [medicalNecessityReviewed, setMedicalNecessityReviewed] = useState(false);
const [policyCriteriaChecked, setPolicyCriteriaChecked] = useState(false);
const [rationaleCaptured, setRationaleCaptured] = useState(false);
const [outcomeStatus, setOutcomeStatus] = useState<"approved" | "denied">("approved");
const [denialReasonCode, setDenialReasonCode] = useState("NOT_MEDICALLY_NECESSARY");
```

Disable submit unless all three checklist values are true and, for denied outcome, `denialReasonCode` is non-empty.

- [ ] **Step 6: Add DelegatePlanConsole**

Create `DelegatePlanConsole.tsx` as a client component that fetches `/api/delegate-um/plan` and renders:

- UM request ID
- source PA ID
- plan
- state
- outcome status
- SLA status
- business policy status
- payment status

Use `LabsBadge` variants:

```ts
function slaBadgeVariant(value: string): "success" | "warning" | "neutral" {
  if (value === "within_sla") return "success";
  if (value === "breached") return "warning";
  return "neutral";
}
```

- [ ] **Step 7: Update demo catalog and styles**

In `src/apps/web/components/demo-catalog.ts`, change Delegate UM status:

```ts
{
  slug: "delegate-um",
  title: "Delegate UM SLA Bonus",
  submitter: "Delegated UM vendor",
  purpose: "Reward timely, complete, audit-ready delegated utilization-management work.",
  evaluationType: "delegate_um_sla_bonus",
  status: "active"
}
```

Add CSS classes under the existing worklist/table section in `styles.css`: `.delegate-console`, `.delegate-review-grid`, `.sla-clock`, `.review-checklist`, and `.outcome-toggle`. Use the existing 8px radius, table, panel, badge, and button patterns.

- [ ] **Step 8: Run component tests and typecheck**

Run:

```bash
npm test -- src/apps/web/components/delegate-um/DelegateVendorConsole.test.ts src/apps/web/components/delegate-um/DelegatePlanConsole.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit delegate views**

```bash
git add src/apps/web/app/delegate-um src/apps/web/components/delegate-um src/apps/web/components/demo-catalog.ts src/apps/web/app/styles.css
git commit -m "feat: add delegate um views"
```

## Task 9: Add Delegate Policy Catalog Support

**Files:**
- Modify: `src/apps/web/lib/policy-view-model.ts`
- Modify: `src/apps/web/lib/policy-view-model.test.ts`
- Modify: `src/apps/web/components/provider-documentation/PolicyConsole.tsx`
- Create: `src/apps/web/app/delegate-um/policies/page.tsx`

- [ ] **Step 1: Write failing policy view-model tests**

In `src/apps/web/lib/policy-view-model.test.ts`, add:

```ts
it("builds delegate UM SLA business policy cards", () => {
  const policy = defaultIncentivePolicies.delegate_um_acme_sla_bonus;
  const cards = buildBusinessPolicyCards(policy);

  expect(cards).toEqual([
    expect.objectContaining({
      id: "delegate-um-sla-bonus-v1",
      title: "Delegate UM SLA Bonus",
      appliesTo: "Delegate UM SLA Bonus",
      payoutOrControl: "5 HBAR per eligible UM request",
      previewItems: expect.arrayContaining([
        { label: "Plan", value: "Acme Health PPO" },
        { label: "Delegate", value: "Northstar UM" },
        { label: "SLA", value: "24 hours" }
      ])
    })
  ]);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
npm test -- src/apps/web/lib/policy-view-model.test.ts
```

Expected: FAIL because only Provider Documentation cards are supported.

- [ ] **Step 3: Generalize business policy cards**

In `policy-view-model.ts`, add:

```ts
export function buildBusinessPolicyCards(policy: IncentivePolicy | null | undefined): PolicySummary[] {
  if (!policy) return [];

  if (policy.evaluationType === "delegate_um_sla_bonus") {
    return buildDelegateUmBusinessPolicyCards(policy);
  }

  return buildProviderDocumentationBusinessPolicyCards(policy);
}
```

Add `buildDelegateUmBusinessPolicyCards(policy)` with title `Delegate UM SLA Bonus`, `Provider` label changed to `Delegate`, and detail items:

```ts
{
  title: "Eligibility criteria",
  items: [
    "UM request is determined: Yes",
    "Outcome status is present: Yes",
    "Outcome value affects payment: No",
    "Clinical review checklist complete: Yes",
    "Completed within SLA: 24 hours",
    "PHI in payment metadata: No"
  ]
}
```

- [ ] **Step 4: Update policy console title props**

In `PolicyConsole.tsx`, add optional props:

```ts
interface PolicyConsoleProps {
  businessPolicies: PolicySummary[];
  paymentPolicies: PolicySummary[];
  initialCaseId?: string | null;
  title?: string;
  eyebrow?: string;
  boundaryStatement?: string;
}
```

Default to existing Provider Documentation values so existing tests stay stable.

- [ ] **Step 5: Wire Delegate policies page**

In `src/apps/web/app/delegate-um/policies/page.tsx`, load:

```tsx
const businessPolicies = await policyStore.listPolicies("delegate_um_sla_bonus");
const paymentPolicies = await paymentPolicyStore.listPolicies();

return (
  <PolicyConsole
    businessPolicies={businessPolicies.flatMap(buildBusinessPolicyCards)}
    paymentPolicies={paymentPolicies.map(buildHederaAgentKitPlanPolicyCards)}
    title="Delegate UM SLA Bonus Policies"
    eyebrow="Policy catalog"
    boundaryStatement="Business contract policies define delegate SLA bonus criteria. Payment policies are plan-level Hedera Agent Kit settlement guardrails."
  />
);
```

- [ ] **Step 6: Run policy UI tests and verify pass**

Run:

```bash
npm test -- src/apps/web/lib/policy-view-model.test.ts src/apps/web/components/provider-documentation/PolicyConsole.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit policy catalog support**

```bash
git add src/apps/web/lib/policy-view-model.ts src/apps/web/lib/policy-view-model.test.ts src/apps/web/components/provider-documentation/PolicyConsole.tsx src/apps/web/components/provider-documentation/PolicyConsole.test.ts src/apps/web/app/delegate-um/policies/page.tsx
git commit -m "feat: show delegate um policies"
```

## Task 10: Update Provider Documentation UI For UMRequest IDs

**Files:**
- Modify: `src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx`
- Modify: `src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx`
- Modify: `src/apps/web/components/provider-documentation/PlanAuditDetailsModal.tsx`
- Modify: related component tests under `src/apps/web/components/provider-documentation`

- [ ] **Step 1: Write source-level UI regression tests**

Update existing provider documentation component tests so source checks assert:

```ts
expect(source).toContain("sourceCaseId");
expect(source).toContain("umRequestId");
expect(source).not.toContain("submitted.caseId");
```

For `PlanAuditDetailsModal.test.ts`, assert the modal labels both IDs:

```ts
expect(source).toContain("UM request ID");
expect(source).toContain("Source PA ID");
```

- [ ] **Step 2: Run provider component tests and verify failure**

Run:

```bash
npm test -- src/apps/web/components/provider-documentation
```

Expected: FAIL because provider components still display only `caseId`.

- [ ] **Step 3: Update provider wizard submitted state**

In `ProviderDocumentationWizard.tsx`, import `UMRequest` and use:

```ts
const [submitted, setSubmitted] = useState<UMRequest | null>(null);
```

In the submission confirmation, display:

```tsx
<div>
  <dt>UM request ID</dt>
  <dd>{submitted.id}</dd>
</div>
<div>
  <dt>Source PA ID</dt>
  <dd>{submitted.sourceCaseId}</dd>
</div>
```

When linking to health plan view, use `submitted.id` as the query parameter.

- [ ] **Step 4: Update plan console and modal**

In `PlanIncentivesConsole.tsx`, display `row.umRequestId` and `row.sourceCaseId` in separate columns. Rename `selectedCaseId` to `selectedUmRequestId` and `detailsCaseId` to `detailsUmRequestId`.

In `PlanAuditDetailsModal.tsx`, replace PA result display with:

```tsx
<div>
  <dt>UM request ID</dt>
  <dd className="mono-cell">{row.umRequestId}</dd>
</div>
<div>
  <dt>Source PA ID</dt>
  <dd className="mono-cell">{row.sourceCaseId}</dd>
</div>
```

- [ ] **Step 5: Run provider component tests and typecheck**

Run:

```bash
npm test -- src/apps/web/components/provider-documentation
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit provider UI ID migration**

```bash
git add src/apps/web/components/provider-documentation
git commit -m "refactor: show um request ids in provider documentation"
```

## Task 11: Full Verification

**Files:**
- Modify only if tests expose a specific defect in a previous task.

- [ ] **Step 1: Run package tests**

Run:

```bash
npm test -- src/packages/um-platform/test/provider-documentation.test.ts src/packages/um-platform/test/pas-fhir.test.ts src/packages/policy-engine/test/evaluate-policy.test.ts src/packages/incentive-agent/test/provider-documentation-event.test.ts src/packages/incentive-agent/test/delegate-um-event.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run app library and route tests**

Run:

```bash
npm test -- src/apps/web/lib/provider-documentation-workflow.test.ts src/apps/web/lib/delegate-um-workflow.test.ts src/apps/web/lib/provider-documentation-routes.test.ts src/apps/web/lib/delegate-um-routes.test.ts src/apps/web/lib/pas-persistence.test.ts src/apps/web/lib/policy-store.test.ts src/apps/web/lib/policy-view-model.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full automated checks**

Run:

```bash
npm test
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Start the dev server**

Run:

```bash
npm run dev:simulated
```

Expected: Next.js starts and prints a local URL, normally `http://localhost:3000`.

- [ ] **Step 5: Manual browser verification**

Open the local URL and verify:

- `/provider-documentation`: submit a knee MRI PA and see both UM request ID and source PA ID.
- `/provider-documentation/incentives`: see provider documentation incentive row tied to the UM request.
- `/delegate-um`: see the same UM request in the delegate workqueue, start review, complete approved determination.
- `/delegate-um/plan`: see paid delegate SLA bonus with `within_sla`.
- `/delegate-um`: submit/review a denied determination with denial reason and verify it also qualifies.
- Force an overdue case in a test or local fixture and verify `SLA_EXCEEDED` yields zero value.
- `/delegate-um/policies`: see Delegate UM SLA Bonus business policy and payment policy controls.

- [ ] **Step 6: Commit final fixes if verification required changes**

If Step 1 through Step 5 required fixes, commit only those files:

```bash
git add <changed-files>
git commit -m "fix: complete delegate um verification"
```

If no fixes were required, do not create an empty commit.
