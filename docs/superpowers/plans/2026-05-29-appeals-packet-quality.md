# Appeals Packet Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Appeals Packet Quality demo with a provider appeals console, one `AppealCase` per denied PA, an inner packet-readiness workflow, plan audit rows, policies, and policy-bound settlement.

**Architecture:** Mirror Specialty Rx: keep the original `UMRequest` as the source PA, create a separate linked `AppealCase` entity for appeal workflow state, and use `umRequestId` as the Hedera settlement identity while carrying `appealId` for traceability. Business policy evaluation lives in `@operon-labs/policy-engine` and `@operon-labs/incentive-agent`; app workflow, persistence, routes, and UI live under `src/apps/web`.

**Tech Stack:** TypeScript, Next.js App Router, Vitest, Firestore-compatible store abstractions, shared `useIncentiveWorklist`, Hedera executor payment policy path.

---

## File Structure

Create:

- `src/apps/web/lib/appeals-store.ts` - memory/Firestore store for `AppealCase` records and Appeals plan audit rows.
- `src/apps/web/lib/appeals-input.ts` - request-body parsers for Appeals API step routes.
- `src/apps/web/lib/appeals-workflow.ts` - Appeals workqueue, workflow transitions, policy evaluation, plan row recovery, and payment execution.
- `src/apps/web/lib/appeals-workflow.test.ts` - workflow TDD coverage.
- `src/apps/web/lib/appeals-routes.test.ts` - API parser/route TDD coverage.
- `src/apps/web/components/appeals/AppealsConsole.tsx` - provider appeals PA list and workflow modal host.
- `src/apps/web/components/appeals/AppealsWorkflowModal.tsx` - stepper modal for appeal packet workflow.
- `src/apps/web/components/appeals/AppealsPlanConsole.tsx` - plan audit console for appeal packet events.
- `src/apps/web/components/appeals/AppealsPlanDetailsModal.tsx` - audit details modal with workflow, business policy, payment policy, and evidence sections.
- `src/apps/web/components/appeals/AppealsUseCaseNavigation.tsx` - three-view navigation.
- `src/apps/web/components/appeals/appeals-formatters.ts` - status, SLA, and badge formatting helpers.
- `src/apps/web/components/appeals/AppealsConsole.test.tsx` - UI rendering/source tests.
- `src/apps/web/components/appeals/AppealsPlanConsole.test.tsx` - plan audit modal/source tests.
- `src/apps/web/app/api/appeals/prior-auths/route.ts`
- `src/apps/web/app/api/appeals/cases/route.ts`
- `src/apps/web/app/api/appeals/workqueue/route.ts`
- `src/apps/web/app/api/appeals/cases/[appealId]/acknowledge/route.ts`
- `src/apps/web/app/api/appeals/cases/[appealId]/intake/route.ts`
- `src/apps/web/app/api/appeals/cases/[appealId]/original-decision/route.ts`
- `src/apps/web/app/api/appeals/cases/[appealId]/missing-info/route.ts`
- `src/apps/web/app/api/appeals/cases/[appealId]/packet/route.ts`
- `src/apps/web/app/api/appeals/cases/[appealId]/evidence-index/route.ts`
- `src/apps/web/app/api/appeals/cases/[appealId]/route-reviewer/route.ts`
- `src/apps/web/app/api/appeals/plan/route.ts`
- `src/apps/web/app/appeals/plan/page.tsx`
- `src/apps/web/app/appeals/policies/page.tsx`

Modify:

- `src/apps/web/app/appeals/page.tsx` - replace static `DemoPage` with `AppealsConsole`.
- `src/packages/policy-engine/src/index.ts` - add Appeals eligibility criteria and evaluation branch.
- `src/packages/policy-engine/test/evaluate-policy.test.ts` - add Appeals policy tests.
- `src/packages/incentive-agent/src/index.ts` - add Appeals evidence/event evaluator and update demo request.
- `src/packages/incentive-agent/test/provider-documentation-event.test.ts` or new `appeals-event.test.ts` - add Appeals agent tests.
- `src/apps/web/lib/policy-store.ts` - seed default Appeals business policy.
- `src/apps/web/lib/policy-view-model.ts` and `src/apps/web/lib/policy-view-model.test.ts` - add Appeals policy catalog cards.
- `src/apps/web/components/demo-catalog.ts` and `src/apps/web/components/demo-catalog.test.ts` - mark Appeals active.
- `src/apps/web/app/styles.css` - add only Appeals-specific layout tweaks that cannot reuse existing classes.
- `README.md` and `docs/Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md` - document the active Appeals demo and SLA semantics.

---

### Task 1: Policy Engine And Incentive Agent

**Files:**
- Modify: `src/packages/policy-engine/src/index.ts`
- Modify: `src/packages/policy-engine/test/evaluate-policy.test.ts`
- Modify: `src/packages/incentive-agent/src/index.ts`
- Create: `src/packages/incentive-agent/test/appeals-event.test.ts`

- [ ] **Step 1: Write failing policy-engine tests**

Append tests that prove Appeals approves complete packet evidence and blocks outcome/cost metrics:

```ts
const appealsPolicy = {
  policyId: "appeals-packet-quality-v1",
  version: "v1",
  status: "active",
  evaluationType: "appeals_packet_quality",
  contractPair: {
    planId: "acme-health-ppo",
    planName: "Acme Health PPO",
    providerId: "lakeside-provider-admin",
    providerName: "Lakeside Provider Admin"
  },
  effectivePeriod: { startsOn: "2026-05-01", endsOn: null },
  incentiveScope: { eligibleRequestTypes: ["pharmacy_benefit", "outpatient_service"] },
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: false,
    requiresDtrCompletionWhenRequested: false,
    requiresAppealPacketReadyWithinSla: true,
    requiresAppealAcknowledgementWithinSla: true,
    requiresAppealPacketQualityAudit: true,
    prohibitsAppealOutcomeIncentive: true
  },
  payout: { token: "HBAR", amountPerEligibleRequest: 6, monthlyCap: 700 },
  settlement: { mode: "auto", recipientWalletId: "0.0.9049549", requiresHumanApproval: false }
} satisfies IncentivePolicy;

const completeAppealRequest = {
  evaluationType: "appeals_packet_quality",
  submitter: { id: "lakeside-provider-admin" },
  requestObject: {
    appealId: "APL-260526-0900-DENIED01",
    umRequestId: "PA-260526-0900-DENIED01",
    planId: "acme-health-ppo",
    submitterId: "lakeside-provider-admin",
    requestType: "pharmacy_benefit",
    originalOutcomeStatus: "denied",
    appealReceivedAt: "2026-06-18T16:00:00.000Z",
    acknowledgedAt: "2026-06-18T17:00:00.000Z",
    packetReadyAt: "2026-06-19T15:00:00.000Z",
    acknowledgedWithinSla: true,
    packetReadyWithinSla: true,
    requiredDocumentsPresent: true,
    clinicalRationaleIncluded: true,
    policyCitationIncluded: true,
    priorDecisionSummaryIncluded: true,
    evidenceIndexComplete: true,
    qualityAuditPassed: true,
    noReworkRequired: true,
    appealOutcomeUsed: false,
    costSavingsMetricUsed: false,
    denialReversalMetricUsed: false,
    containsPhi: false
  }
} satisfies EvaluationRequest;

it("approves complete appeals packet readiness evidence without using outcome", () => {
  const result = evaluatePolicy({ policy: appealsPolicy, request: completeAppealRequest, monthToDateAmount: 0 });

  expect(result).toMatchObject({
    decision: "approved",
    amount: 6,
    walletId: "0.0.9049549",
    reasonCodes: []
  });
});

it("blocks appeals incentives when outcome or cost metrics are used", () => {
  const result = evaluatePolicy({
    policy: appealsPolicy,
    request: {
      ...completeAppealRequest,
      requestObject: {
        ...completeAppealRequest.requestObject,
        appealOutcomeUsed: true,
        costSavingsMetricUsed: true,
        denialReversalMetricUsed: true
      }
    },
    monthToDateAmount: 0
  });

  expect(result).toMatchObject({
    decision: "blocked",
    amount: 0,
    walletId: null,
    reasonCodes: expect.arrayContaining([
      "PROHIBITED_APPEAL_OUTCOME_METRIC",
      "PROHIBITED_COST_SAVINGS_METRIC",
      "PROHIBITED_DENIAL_REVERSAL_METRIC"
    ])
  });
});
```

- [ ] **Step 2: Run policy-engine tests to verify RED**

Run:

```bash
npm test -- src/packages/policy-engine/test/evaluate-policy.test.ts
```

Expected: fails because `IncentivePolicy["eligibilityCriteria"]` does not include Appeals fields and `evaluatePolicy` has no Appeals branch.

- [ ] **Step 3: Implement Appeals policy evaluation**

In `IncentivePolicy["eligibilityCriteria"]`, add optional fields:

```ts
requiresAppealPacketReadyWithinSla?: boolean;
requiresAppealAcknowledgementWithinSla?: boolean;
requiresAppealPacketQualityAudit?: boolean;
prohibitsAppealOutcomeIncentive?: boolean;
```

In `evaluatePolicy`, route `appeals_packet_quality` before the generic branch:

```ts
if (policy.evaluationType === "appeals_packet_quality") {
  return evaluateAppealsPacketQualityPolicy(input);
}
```

Add `evaluateAppealsPacketQualityPolicy(input)` with these checks:

```ts
if (request.evaluationType !== policy.evaluationType) reasonCodes.push("EVALUATION_TYPE_MISMATCH");
if (policy.status !== "active") reasonCodes.push("POLICY_INACTIVE");
if (request.requestObject.planId !== policy.contractPair.planId) reasonCodes.push("PLAN_NOT_IN_CONTRACT");
if (request.submitter.id !== policy.contractPair.providerId || request.requestObject.submitterId !== policy.contractPair.providerId) {
  reasonCodes.push("APPEALS_SUBMITTER_NOT_IN_CONTRACT");
}
if (request.requestObject.originalOutcomeStatus !== "denied") reasonCodes.push("LINKED_PA_NOT_DENIED");
if (policy.eligibilityCriteria.requiresAppealAcknowledgementWithinSla && request.requestObject.acknowledgedWithinSla !== true) {
  reasonCodes.push("ACKNOWLEDGEMENT_SLA_EXCEEDED");
}
if (policy.eligibilityCriteria.requiresAppealPacketReadyWithinSla && request.requestObject.packetReadyWithinSla !== true) {
  reasonCodes.push("PACKET_READINESS_SLA_EXCEEDED");
}
if (request.requestObject.requiredDocumentsPresent !== true) reasonCodes.push("REQUIRED_DOCUMENTS_MISSING");
if (request.requestObject.clinicalRationaleIncluded !== true) reasonCodes.push("CLINICAL_RATIONALE_MISSING");
if (request.requestObject.policyCitationIncluded !== true) reasonCodes.push("POLICY_CITATION_MISSING");
if (request.requestObject.priorDecisionSummaryIncluded !== true) reasonCodes.push("PRIOR_DECISION_SUMMARY_MISSING");
if (request.requestObject.evidenceIndexComplete !== true) reasonCodes.push("EVIDENCE_INDEX_INCOMPLETE");
if (policy.eligibilityCriteria.requiresAppealPacketQualityAudit && request.requestObject.qualityAuditPassed !== true) {
  reasonCodes.push("QUALITY_AUDIT_FAILED");
}
if (request.requestObject.noReworkRequired !== true) reasonCodes.push("REWORK_REQUIRED");
if (policy.eligibilityCriteria.prohibitsAppealOutcomeIncentive && request.requestObject.appealOutcomeUsed === true) {
  reasonCodes.push("PROHIBITED_APPEAL_OUTCOME_METRIC");
}
if (request.requestObject.costSavingsMetricUsed === true) reasonCodes.push("PROHIBITED_COST_SAVINGS_METRIC");
if (request.requestObject.denialReversalMetricUsed === true) reasonCodes.push("PROHIBITED_DENIAL_REVERSAL_METRIC");
if (request.requestObject.containsPhi === true) reasonCodes.push("PHI_IN_PAYMENT_METADATA");
if (monthToDateAmount + policy.payout.amountPerEligibleRequest > policy.payout.monthlyCap) {
  reasonCodes.push("MONTHLY_CAP_EXCEEDED");
}
```

Use the existing `result(...)` helper exactly like Delegate UM and Specialty Rx.

- [ ] **Step 4: Verify policy-engine GREEN**

Run:

```bash
npm test -- src/packages/policy-engine/test/evaluate-policy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing incentive-agent Appeals event tests**

Create `src/packages/incentive-agent/test/appeals-event.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { IncentivePolicy } from "@operon-labs/policy-engine";
import {
  evaluateAppealsPacketEvent,
  getDemoEvaluationRequest,
  type AppealsPacketEvidence
} from "../src/index";

const policy: IncentivePolicy = {
  policyId: "appeals-packet-quality-v1",
  version: "v1",
  status: "active",
  evaluationType: "appeals_packet_quality",
  contractPair: {
    planId: "acme-health-ppo",
    planName: "Acme Health PPO",
    providerId: "lakeside-provider-admin",
    providerName: "Lakeside Provider Admin"
  },
  effectivePeriod: { startsOn: "2026-05-01", endsOn: null },
  incentiveScope: { eligibleRequestTypes: ["pharmacy_benefit"] },
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: false,
    requiresDtrCompletionWhenRequested: false,
    requiresAppealPacketReadyWithinSla: true,
    requiresAppealAcknowledgementWithinSla: true,
    requiresAppealPacketQualityAudit: true,
    prohibitsAppealOutcomeIncentive: true
  },
  payout: { token: "HBAR", amountPerEligibleRequest: 6, monthlyCap: 700 },
  settlement: { mode: "auto", recipientWalletId: "0.0.9049549", requiresHumanApproval: false }
};

const evidence: AppealsPacketEvidence = {
  appealId: "APL-260526-0900-DENIED01",
  umRequestId: "PA-260526-0900-DENIED01",
  planId: "acme-health-ppo",
  submitterId: "lakeside-provider-admin",
  requestType: "pharmacy_benefit",
  originalOutcomeStatus: "denied",
  appealReceivedAt: "2026-06-18T16:00:00.000Z",
  acknowledgedAt: "2026-06-18T17:00:00.000Z",
  packetReadyAt: "2026-06-19T15:00:00.000Z",
  acknowledgedWithinSla: true,
  packetReadyWithinSla: true,
  requiredDocumentsPresent: true,
  clinicalRationaleIncluded: true,
  policyCitationIncluded: true,
  priorDecisionSummaryIncluded: true,
  evidenceIndexComplete: true,
  qualityAuditPassed: true,
  noReworkRequired: true,
  appealOutcomeUsed: false,
  costSavingsMetricUsed: false,
  denialReversalMetricUsed: false,
  containsPhi: false
};

describe("evaluateAppealsPacketEvent", () => {
  it("pulls policy-safe appeal packet evidence by appealId", () => {
    const getEvidenceByAppealId = vi.fn(() => evidence);

    const evaluation = evaluateAppealsPacketEvent(
      { eventType: "APPEAL_PACKET_READY", appealId: evidence.appealId, umRequestId: evidence.umRequestId },
      { getEvidenceByAppealId, policy, monthToDateAmount: 0 }
    );

    expect(getEvidenceByAppealId).toHaveBeenCalledWith(evidence.appealId);
    expect(evaluation.request.requestObject).toMatchObject({
      appealId: evidence.appealId,
      umRequestId: evidence.umRequestId,
      originalOutcomeStatus: "denied",
      packetReadyWithinSla: true,
      appealOutcomeUsed: false,
      costSavingsMetricUsed: false,
      containsPhi: false
    });
    expect(evaluation.result).toMatchObject({ decision: "approved", amount: 6, reasonCodes: [] });
  });

  it("rejects non-canonical appeal and PA event identifiers before evidence lookup", () => {
    const getEvidenceByAppealId = vi.fn();

    expect(() =>
      evaluateAppealsPacketEvent(
        { eventType: "APPEAL_PACKET_READY", appealId: "appeal-1", umRequestId: evidence.umRequestId },
        { getEvidenceByAppealId, policy, monthToDateAmount: 0 }
      )
    ).toThrow("APPEALS_EVENT_ID_NOT_CANONICAL:appeal-1");
    expect(getEvidenceByAppealId).not.toHaveBeenCalled();
  });

  it("keeps the demo request outcome-safe", () => {
    const request = getDemoEvaluationRequest("appeals_packet_quality");

    expect(request.requestObject).toMatchObject({
      appealId: "APL-260526-0900-DENIED01",
      appealOutcomeUsed: false,
      costSavingsMetricUsed: false,
      denialReversalMetricUsed: false,
      containsPhi: false
    });
  });
});
```

- [ ] **Step 6: Run incentive-agent tests to verify RED**

Run:

```bash
npm test -- src/packages/incentive-agent/test/appeals-event.test.ts
```

Expected: FAIL because `AppealsPacketEvidence` and `evaluateAppealsPacketEvent` do not exist.

- [ ] **Step 7: Implement incentive-agent Appeals evaluator**

In `src/packages/incentive-agent/src/index.ts`, add:

```ts
export interface AppealsPacketEvidence {
  appealId: string;
  umRequestId: string;
  planId: string;
  submitterId: string;
  requestType: string;
  originalOutcomeStatus: "denied" | "approved";
  appealReceivedAt: string;
  acknowledgedAt: string | null;
  packetReadyAt: string | null;
  acknowledgedWithinSla: boolean;
  packetReadyWithinSla: boolean;
  requiredDocumentsPresent: boolean;
  clinicalRationaleIncluded: boolean;
  policyCitationIncluded: boolean;
  priorDecisionSummaryIncluded: boolean;
  evidenceIndexComplete: boolean;
  qualityAuditPassed: boolean;
  noReworkRequired: boolean;
  appealOutcomeUsed: boolean;
  costSavingsMetricUsed: boolean;
  denialReversalMetricUsed: boolean;
  containsPhi: boolean;
}

export interface AppealsPacketEvaluationDependencies {
  getEvidenceByAppealId: (appealId: string) => AppealsPacketEvidence | null;
  policy: IncentivePolicy;
  monthToDateAmount?: number;
}
```

Add `evaluateAppealsPacketEvent(event, dependencies)` that accepts only `APPEAL_PACKET_READY`, asserts `appealId.startsWith("APL-")`, asserts `umRequestId.startsWith("PA-")`, fetches evidence by appeal ID, verifies evidence IDs match event IDs, builds an `EvaluationRequest` with `evaluationType: "appeals_packet_quality"`, and calls `evaluatePolicy`.

Update `demoRequests.appeals_packet_quality` to use `APL-260526-0900-DENIED01`, linked `PA-260526-0900-DENIED01`, plan/submitter/request fields, SLA booleans, packet quality booleans, and prohibited metrics all false.

- [ ] **Step 8: Verify agent GREEN**

Run:

```bash
npm test -- src/packages/incentive-agent/test/appeals-event.test.ts src/packages/policy-engine/test/evaluate-policy.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/packages/policy-engine/src/index.ts src/packages/policy-engine/test/evaluate-policy.test.ts src/packages/incentive-agent/src/index.ts src/packages/incentive-agent/test/appeals-event.test.ts
git commit -m "feat: add appeals packet policy evaluation"
```

---

### Task 2: Appeals Store, Workflow, And API Routes

**Files:**
- Create: `src/apps/web/lib/appeals-store.ts`
- Create: `src/apps/web/lib/appeals-input.ts`
- Create: `src/apps/web/lib/appeals-workflow.ts`
- Create: `src/apps/web/lib/appeals-workflow.test.ts`
- Create: `src/apps/web/lib/appeals-routes.test.ts`
- Create: all `src/apps/web/app/api/appeals/**/route.ts` files listed in File Structure.

- [ ] **Step 1: Write failing workflow tests for PA eligibility and one appeal per PA**

Create `src/apps/web/lib/appeals-workflow.test.ts` with tests that build one pending, one approved, and one denied PA using `createInMemoryUmPlatform()`, `startClinicalReview`, and `completeClinicalReview`.

Core assertions:

```ts
expect(rows).toEqual(expect.arrayContaining([
  expect.objectContaining({ umRequestId: pending.id, eligibilityStatus: "awaiting_determination", canStartAppeal: false }),
  expect.objectContaining({ umRequestId: approved.id, eligibilityStatus: "not_appeal_eligible", canStartAppeal: false }),
  expect.objectContaining({ umRequestId: denied.id, eligibilityStatus: "startable", canStartAppeal: true })
]));

const appeal = await workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-18T16:00:00.000Z"));
const repeated = await workflow.startAppeal(denied.id, { expedited: true }, new Date("2026-06-18T17:00:00.000Z"));

expect(appeal).toMatchObject({
  id: denied.id.replace(/^PA-/, "APL-"),
  umRequestId: denied.id,
  state: "created",
  appealReceivedAt: "2026-06-18T16:00:00.000Z",
  packetReadinessSlaHours: 24,
  expedited: false
});
expect(repeated).toEqual(appeal);
```

- [ ] **Step 2: Run workflow test to verify RED**

Run:

```bash
npm test -- src/apps/web/lib/appeals-workflow.test.ts
```

Expected: FAIL because `appeals-workflow.ts` does not exist.

- [ ] **Step 3: Implement `appeals-store.ts`**

Define:

```ts
export type AppealsStoreBackend = "firestore" | "memory";
export type AppealCaseState = "created" | "acknowledged" | "intake_validated" | "decision_retrieved" | "missing_info_resolved" | "packet_assembled" | "evidence_indexed" | "packet_ready";
export type AppealsSlaStatus = "pending" | "within_sla" | "breached" | "not_applicable";
export type AppealsIncentiveStatus = "pending" | "not_eligible" | "paid" | "payment_failed";
export type AppealsPaymentStatus = "pending" | "auto_executed" | "blocked_by_policy" | "execution_failed";
```

Define `AppealCase` exactly from the design, with the state union above. Define `AppealsPlanAuditRow` in `appeals-workflow.ts` and import it as a type in the store, matching the Specialty Rx store pattern.

Collections:

```ts
const APPEAL_CASES_COLLECTION = "appealCases";
const APPEALS_PLAN_AUDIT_ROWS_COLLECTION = "appealsPlanAuditRows";
```

Implement `createInMemoryAppealsCaseStore`, `createAppealsCaseStoreFromEnv`, `createFirestoreAppealsCaseStore`, `saveCase`, `getCase`, `listCases`, `savePlanRow`, `getPlanRow`, and `listPlanRows`. Validate shapes with `id.startsWith("APL-")`, `umRequestId.startsWith("PA-")`, `source === "provider_started_from_denied_pa"`, and `updatedAt` string.

- [ ] **Step 4: Implement minimal `appeals-workflow.ts` for eligibility and start**

Export:

```ts
export type AppealEligibilityStatus = "awaiting_determination" | "not_appeal_eligible" | "startable" | "open";

export interface AppealsPriorAuthRow {
  umRequest: UMRequest;
  umRequestId: string;
  planDisplay: string;
  requestType: UMRequest["requestType"];
  serviceLabel: string;
  state: UMRequest["state"];
  outcomeStatus: UMRequest["outcomeStatus"];
  eligibilityStatus: AppealEligibilityStatus;
  canStartAppeal: boolean;
  appealCase: AppealCase | null;
}

export interface StartAppealInput {
  expedited?: boolean;
}
```

Implement `listPriorAuthRows()` and `startAppeal(umRequestId, input, now)`:

- Load PAs from persistence or platform.
- Load existing appeal cases from `AppealsCaseStore`.
- `canStartAppeal` is true only when `request.state === "determined"` and `request.outcomeStatus === "denied"` and no appeal exists.
- `startAppeal` throws `UM_REQUEST_NOT_FOUND`, `PA_NOT_DETERMINED`, or `PA_NOT_APPEAL_ELIGIBLE` as designed.
- `startAppeal` returns the existing appeal case if found.
- New appeal ID is `umRequestId.replace(/^PA-/, "APL-")`.
- Standard appeals use `packetReadinessSlaHours: 24`; expedited appeals use `4`.

- [ ] **Step 5: Verify eligibility/start GREEN**

Run:

```bash
npm test -- src/apps/web/lib/appeals-workflow.test.ts
```

Expected: PASS for the first tests.

- [ ] **Step 6: Add failing full workflow and SLA tests**

Add tests for all step transitions:

```ts
await workflow.acknowledgeAppeal(appeal.id, { appealRequestAcknowledged: true }, new Date("2026-06-18T17:00:00.000Z"));
await workflow.validateIntake(appeal.id, {
  appealRequestPresent: true,
  appellantAuthorized: true,
  planMemberMatched: true,
  requestedServiceMatched: true
});
await workflow.retrieveOriginalDecision(appeal.id, {
  denialReasonRetrieved: true,
  priorDecisionSummaryIncluded: true,
  coveragePolicyLocated: true
});
await workflow.resolveMissingInfo(appeal.id, {
  missingInfoRequired: false,
  missingInfoRequested: false,
  missingInfoResolved: true
});
await workflow.assemblePacket(appeal.id, {
  requiredDocumentsPresent: true,
  clinicalRationaleIncluded: true,
  policyCitationIncluded: true,
  evidenceIndexComplete: false,
  qualityAuditPassed: true,
  noReworkRequired: true
});
await workflow.indexEvidence(appeal.id, { evidenceIndexComplete: true, phiSafeForPaymentMetadata: true });
const terminal = await workflow.routeReviewer(appeal.id, {
  reviewerQueueSelected: true,
  reviewerConflictCheckComplete: true
}, new Date("2026-06-19T15:00:00.000Z"));

const [row] = await workflow.listPlanRows();
expect(terminal.state).toBe("packet_ready");
expect(row).toMatchObject({
  appealId: appeal.id,
  umRequestId: denied.id,
  packetReadinessSlaStatus: "within_sla",
  acknowledgementSlaStatus: "within_sla",
  businessPolicyStatus: "approved",
  paymentPolicyStatus: "paid",
  incentiveValue: 6,
  reasonCodes: []
});
```

Add a second test where `acknowledgedAt` is late but `packetReadyAt` is still within 24 hours from `appealReceivedAt`; assert the row blocks with `ACKNOWLEDGEMENT_SLA_EXCEEDED` and does not reset the main packet clock. Add a third test where `packetReadyAt` is beyond 24 hours from `appealReceivedAt`; assert `PACKET_READINESS_SLA_EXCEEDED`.

- [ ] **Step 7: Run workflow test to verify RED**

Run:

```bash
npm test -- src/apps/web/lib/appeals-workflow.test.ts
```

Expected: FAIL because step methods and settlement are not implemented.

- [ ] **Step 8: Implement workflow transitions, evidence, settlement, and plan rows**

Add input interfaces:

```ts
export interface AcknowledgeAppealInput { appealRequestAcknowledged: boolean; }
export interface ValidateAppealIntakeInput { appealRequestPresent: boolean; appellantAuthorized: boolean; planMemberMatched: boolean; requestedServiceMatched: boolean; }
export interface RetrieveOriginalDecisionInput { denialReasonRetrieved: boolean; priorDecisionSummaryIncluded: boolean; coveragePolicyLocated: boolean; }
export interface ResolveMissingInfoInput { missingInfoRequired: boolean; missingInfoRequested: boolean; missingInfoResolved: boolean; }
export interface AssembleAppealPacketInput { requiredDocumentsPresent: boolean; clinicalRationaleIncluded: boolean; policyCitationIncluded: boolean; evidenceIndexComplete: boolean; qualityAuditPassed: boolean; noReworkRequired: boolean; }
export interface IndexAppealEvidenceInput { evidenceIndexComplete: boolean; phiSafeForPaymentMetadata: boolean; }
export interface RouteAppealReviewerInput { reviewerQueueSelected: boolean; reviewerConflictCheckComplete: boolean; }
```

Implement each method as a single state transition that validates current state, validates required booleans, updates the nested evidence object, sets `updatedAt`, and saves the case.

Build `AppealsPlanAuditRow` with:

- `evaluationType: "appeals_packet_quality"`
- `appealCase`
- `appealId`
- `umRequestId`
- `planId`
- `submitterId`
- `requestType`
- `serviceLabel`
- `state`
- `appealReceivedAt`
- `acknowledgedAt`
- `packetReadyAt`
- `acknowledgementSlaStatus`
- `packetReadinessSlaStatus`
- policy/payment lifecycle fields matching Specialty Rx

Policy controls:

```ts
const APPEALS_POLICY_CONTROLS = [
  "Denied PA linked before appeal packet incentive",
  "Appeal receipt starts packet-readiness SLA",
  "Acknowledgement is a sub-SLA milestone",
  "Packet readiness evidence complete",
  "Final appeal outcome excluded from incentive"
];
```

In `settleAppealPacket`, call `evaluateAppealsPacketEvent({ eventType: "APPEAL_PACKET_READY", appealId, umRequestId }, ...)`, build `businessEvaluationId` with `umRequestId`, and call `executePolicyBoundPayment` using `caseId: umRequestId`, `triggerEvent: "APPEAL_PACKET_READY"`, and `policyControls: APPEALS_POLICY_CONTROLS`.

Use the Specialty Rx payment failure/idempotency pattern: if a terminal row is already paid or has a submitted payment intent, return it instead of executing a second transfer.

- [ ] **Step 9: Verify workflow GREEN**

Run:

```bash
npm test -- src/apps/web/lib/appeals-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 10: Write failing API parser/route tests**

Create `src/apps/web/lib/appeals-routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { POST as acknowledgePost } from "../app/api/appeals/cases/[appealId]/acknowledge/route";
import { POST as intakePost } from "../app/api/appeals/cases/[appealId]/intake/route";
import { POST as originalDecisionPost } from "../app/api/appeals/cases/[appealId]/original-decision/route";
import { POST as missingInfoPost } from "../app/api/appeals/cases/[appealId]/missing-info/route";
import { POST as packetPost } from "../app/api/appeals/cases/[appealId]/packet/route";
import { POST as evidenceIndexPost } from "../app/api/appeals/cases/[appealId]/evidence-index/route";
import { POST as routeReviewerPost } from "../app/api/appeals/cases/[appealId]/route-reviewer/route";
import type { NextRequest } from "next/server";

function postRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/appeals/cases/APL-1/x", {
    method: "POST",
    body: JSON.stringify(body)
  }) as unknown as NextRequest;
}

const context = { params: Promise.resolve({ appealId: "APL-1" }) };

describe("appeals API routes", () => {
  it("uses appeals workflow APIs instead of generic payment routes", () => {
    const route = readFileSync(
      path.join(process.cwd(), "src/apps/web/app/api/appeals/cases/[appealId]/route-reviewer/route.ts"),
      "utf8"
    );

    expect(route).toContain("appealsWorkflow.routeReviewer");
    expect(route).not.toContain("/api/payments/approve");
  });

  it("rejects malformed step bodies with 400 before reaching the workflow", async () => {
    const cases = [
      { handler: acknowledgePost, expectedError: "INVALID_APPEAL_ACKNOWLEDGEMENT" },
      { handler: intakePost, expectedError: "INVALID_APPEAL_INTAKE" },
      { handler: originalDecisionPost, expectedError: "INVALID_APPEAL_ORIGINAL_DECISION" },
      { handler: missingInfoPost, expectedError: "INVALID_APPEAL_MISSING_INFO" },
      { handler: packetPost, expectedError: "INVALID_APPEAL_PACKET" },
      { handler: evidenceIndexPost, expectedError: "INVALID_APPEAL_EVIDENCE_INDEX" },
      { handler: routeReviewerPost, expectedError: "INVALID_APPEAL_REVIEWER_ROUTING" }
    ];

    for (const { handler, expectedError } of cases) {
      const response = await handler(postRequest({ notAValidField: true }), context);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: expectedError });
    }
  });
});
```

- [ ] **Step 11: Run API tests to verify RED**

Run:

```bash
npm test -- src/apps/web/lib/appeals-routes.test.ts
```

Expected: FAIL because routes/parsers do not exist.

- [ ] **Step 12: Implement `appeals-input.ts` and API routes**

Implement parser helpers with the same `asRecord`, `allBooleans`, and string-null guard style as `specialty-rx-input.ts`.

Each route should match this pattern:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { appealsWorkflow } from "../../../../../../lib/appeals-workflow";
import { parseAcknowledgeAppealInput } from "../../../../../../lib/appeals-input";

interface RouteContext {
  params: Promise<{ appealId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const input = parseAcknowledgeAppealInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "INVALID_APPEAL_ACKNOWLEDGEMENT" }, { status: 400 });
  }

  try {
    const { appealId } = await context.params;
    return NextResponse.json(await appealsWorkflow.acknowledgeAppeal(appealId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "APPEAL_ACKNOWLEDGEMENT_FAILED" },
      { status: 400 }
    );
  }
}
```

Use analogous imports/methods/error codes for the other six routes. Add `GET /api/appeals/prior-auths`, `POST /api/appeals/cases`, `GET /api/appeals/workqueue`, and `GET /api/appeals/plan` with the same response shapes as Specialty Rx (`{ rows: ... }` for workqueue/plan/prior-auths).

- [ ] **Step 13: Verify API GREEN**

Run:

```bash
npm test -- src/apps/web/lib/appeals-routes.test.ts src/apps/web/lib/appeals-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 14: Commit Task 2**

```bash
git add src/apps/web/lib/appeals-store.ts src/apps/web/lib/appeals-input.ts src/apps/web/lib/appeals-workflow.ts src/apps/web/lib/appeals-workflow.test.ts src/apps/web/lib/appeals-routes.test.ts src/apps/web/app/api/appeals
git commit -m "feat: add appeals workflow and API"
```

---

### Task 3: Appeals Provider And Plan UI

**Files:**
- Create: `src/apps/web/components/appeals/AppealsConsole.tsx`
- Create: `src/apps/web/components/appeals/AppealsWorkflowModal.tsx`
- Create: `src/apps/web/components/appeals/AppealsPlanConsole.tsx`
- Create: `src/apps/web/components/appeals/AppealsPlanDetailsModal.tsx`
- Create: `src/apps/web/components/appeals/AppealsUseCaseNavigation.tsx`
- Create: `src/apps/web/components/appeals/appeals-formatters.ts`
- Create: `src/apps/web/components/appeals/AppealsConsole.test.tsx`
- Create: `src/apps/web/components/appeals/AppealsPlanConsole.test.tsx`
- Modify: `src/apps/web/app/appeals/page.tsx`
- Create: `src/apps/web/app/appeals/plan/page.tsx`
- Create: `src/apps/web/app/appeals/policies/page.tsx`
- Modify: `src/apps/web/app/styles.css`

- [ ] **Step 1: Write failing provider UI tests**

Create `AppealsConsole.test.tsx`:

```ts
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AppealsWorkflowModal } from "./AppealsWorkflowModal";
import type { AppealCase } from "../../lib/appeals-store";

describe("AppealsConsole", () => {
  it("loads appeal prior-auth rows through the shared worklist hook", () => {
    const source = readFileSync(path.join(process.cwd(), "src/apps/web/components/appeals/AppealsConsole.tsx"), "utf8");

    expect(source).toContain('endpoint: "/api/appeals/prior-auths"');
    expect(source).toContain("getRowId: (row) => row.umRequestId");
    expect(source).toContain("Start appeal");
    expect(source).toContain("Open appeal");
  });

  it("renders the provider appeal workflow steps", () => {
    const markup = renderToStaticMarkup(
      createElement(AppealsWorkflowModal, {
        appealCase: buildAppealCase(),
        onClose: () => undefined,
        onUpdated: () => undefined
      })
    );

    expect(markup).toContain("Acknowledge Receipt");
    expect(markup).toContain("Validate Intake");
    expect(markup).toContain("Retrieve Original PA Decision");
    expect(markup).toContain("Resolve Missing Info");
    expect(markup).toContain("Assemble Packet");
    expect(markup).toContain("Index Evidence");
    expect(markup).toContain("Route Reviewer");
  });
});

function buildAppealCase(): AppealCase {
  return {
    id: "APL-260526-0900-DENIED01",
    umRequestId: "PA-260526-0900-DENIED01",
    source: "provider_started_from_denied_pa",
    planId: "acme-health-ppo",
    providerId: "lakeside-provider-admin",
    submitterId: "lakeside-provider-admin",
    requestType: "pharmacy_benefit",
    serviceCode: "humira_adalimumab",
    serviceLabel: "Humira (adalimumab)",
    originalOutcomeStatus: "denied",
    originalDenialReasonCode: "PLAN_CRITERIA_NOT_MET",
    state: "created",
    appealReceivedAt: "2026-06-18T16:00:00.000Z",
    acknowledgedAt: null,
    packetReadyAt: null,
    packetReadinessSlaHours: 24,
    acknowledgementSlaBusinessHours: 2,
    expedited: false,
    intake: { appealRequestPresent: false, appellantAuthorized: false, planMemberMatched: false, requestedServiceMatched: false },
    originalDecision: { denialReasonRetrieved: false, priorDecisionSummaryIncluded: false, coveragePolicyLocated: false },
    missingInfo: { missingInfoRequired: false, missingInfoRequested: false, missingInfoResolved: true },
    packet: { requiredDocumentsPresent: false, clinicalRationaleIncluded: false, policyCitationIncluded: false, evidenceIndexComplete: false, qualityAuditPassed: false, noReworkRequired: false },
    routing: { reviewerQueueSelected: false, reviewerConflictCheckComplete: false, finalDecisionOutsideIncentive: true },
    updatedAt: "2026-06-18T16:00:00.000Z"
  };
}
```

- [ ] **Step 2: Run provider UI tests to verify RED**

Run:

```bash
npm test -- src/apps/web/components/appeals/AppealsConsole.test.tsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement provider Appeals console and workflow modal**

Implement `AppealsUseCaseNavigation` with items:

```ts
const items: LabsUseCaseNavItem[] = [
  { id: "provider", label: "Provider Appeals View", href: "/appeals" },
  { id: "plan", label: "Health Plan View", href: "/appeals/plan", param: "appealId" },
  { id: "policies", label: "Policies View", href: "/appeals/policies" }
];
```

Implement `AppealsConsole` as a dense table with columns:

- PA ID
- Plan
- Request type
- Drug/service
- PA state
- PA outcome
- Appeal status
- Action

Use `useIncentiveWorklist<AppealsPriorAuthRow>({ endpoint: "/api/appeals/prior-auths", getRowId: (row) => row.umRequestId, errorMessage: "Unable to load appeal prior authorization rows" })`.

`Start appeal` posts to `/api/appeals/cases` with `{ umRequestId: row.umRequestId, expedited: false }`, then opens the workflow modal with the returned case. `Open appeal` opens `row.appealCase`.

Implement `AppealsWorkflowModal` like `SpecialtyRxWorkflowModal`: compact stepper, active section by `appealCase.state`, POST to the matching route, send all-valid synthetic booleans for each step, close on terminal `packet_ready`.

- [ ] **Step 4: Verify provider UI GREEN**

Run:

```bash
npm test -- src/apps/web/components/appeals/AppealsConsole.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Write failing plan UI tests**

Create `AppealsPlanConsole.test.tsx`:

```ts
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AppealsPlanDetailsModal } from "./AppealsPlanDetailsModal";
import type { AppealsPlanAuditRow } from "../../lib/appeals-workflow";

describe("AppealsPlanConsole", () => {
  it("loads appeals plan rows through the shared incentive worklist hook", () => {
    const source = readFileSync(path.join(process.cwd(), "src/apps/web/components/appeals/AppealsPlanConsole.tsx"), "utf8");

    expect(source).toContain('endpoint: "/api/appeals/plan"');
    expect(source).toContain("getRowId: (row) => row.appealId");
  });

  it("renders appeals packet audit details with separated policy sections", () => {
    const markup = renderToStaticMarkup(
      createElement(AppealsPlanDetailsModal, { row: buildRow(), onClose: () => undefined })
    );

    expect(markup).toContain("Appeal Packet Audit Details");
    expect(markup).toContain("Appeal receipt starts packet-readiness SLA");
    expect(markup).toContain("Final appeal outcome excluded from incentive");
    expect(markup).toContain("Business Policy");
    expect(markup).toContain("Payment Policy");
  });
});

function buildRow(): AppealsPlanAuditRow {
  return {
    evaluationType: "appeals_packet_quality",
    appealCase: {} as AppealsPlanAuditRow["appealCase"],
    appealId: "APL-260526-0900-DENIED01",
    umRequestId: "PA-260526-0900-DENIED01",
    id: "ie_appeals",
    planId: "acme-health-ppo",
    submitterId: "lakeside-provider-admin",
    requestType: "pharmacy_benefit",
    serviceLabel: "Humira (adalimumab)",
    state: "packet_ready",
    appealReceivedAt: "2026-06-18T16:00:00.000Z",
    acknowledgedAt: "2026-06-18T17:00:00.000Z",
    packetReadyAt: "2026-06-19T15:00:00.000Z",
    acknowledgementSlaStatus: "within_sla",
    packetReadinessSlaStatus: "within_sla",
    businessPolicyStatus: "approved",
    paymentPolicyStatus: "paid",
    incentiveStatus: "paid",
    paymentStatus: "auto_executed",
    incentiveValue: 6,
    currency: "HBAR",
    settlementToken: { symbol: "HBAR" },
    reason: "Appeal packet ready within SLA",
    reasonCodes: [],
    policyId: "appeals-packet-quality-v1",
    policyControls: ["Appeal receipt starts packet-readiness SLA", "Final appeal outcome excluded from incentive"],
    policyCriteria: [],
    paymentPolicyId: "acme-health-ppo",
    paymentPolicyControls: [],
    audit: null,
    walletId: "0.0.9049549",
    paymentIntentId: "pi_appeals",
    transactionId: "0.0.123@1"
  };
}
```

- [ ] **Step 6: Run plan UI tests to verify RED**

Run:

```bash
npm test -- src/apps/web/components/appeals/AppealsPlanConsole.test.tsx
```

Expected: FAIL because plan components do not exist.

- [ ] **Step 7: Implement plan console, details modal, pages, and minimal CSS**

Implement `AppealsPlanConsole` by mirroring `SpecialtyRxPlanConsole`, but use:

- endpoint `/api/appeals/plan`
- row ID `row.appealId`
- table title `Appeals packet policy log`
- columns: Appeal ID, Linked PA, Submitter, State, Packet SLA, Business Policy, Payment Policy, Action

Implement `AppealsPlanDetailsModal` with sections:

- case identity
- linked PA
- SLA timestamps
- packet checklist evidence
- business policy
- payment policy

Replace `src/apps/web/app/appeals/page.tsx` with:

```ts
import { AppealsConsole } from "../../components/appeals/AppealsConsole";

export const dynamic = "force-dynamic";

export default function AppealsPage() {
  return <AppealsConsole />;
}
```

Create `/appeals/plan` and `/appeals/policies` pages matching Specialty Rx page patterns. Add CSS only for `.appeals-modal`, `.appeals-stepper`, and any table-width class needed to prevent overflow.

- [ ] **Step 8: Verify UI GREEN**

Run:

```bash
npm test -- src/apps/web/components/appeals/AppealsConsole.test.tsx src/apps/web/components/appeals/AppealsPlanConsole.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```bash
git add src/apps/web/components/appeals src/apps/web/app/appeals src/apps/web/app/styles.css
git commit -m "feat: add appeals provider and plan views"
```

---

### Task 4: Policies Catalog, Demo Catalog, README, Scope Doc

**Files:**
- Modify: `src/apps/web/lib/policy-store.ts`
- Modify: `src/apps/web/lib/policy-view-model.ts`
- Modify: `src/apps/web/lib/policy-view-model.test.ts`
- Modify: `src/apps/web/components/demo-catalog.ts`
- Modify: `src/apps/web/components/demo-catalog.test.ts`
- Modify: `README.md`
- Modify: `docs/Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md`

- [ ] **Step 1: Write failing policy catalog and demo catalog tests**

In `policy-view-model.test.ts`, add:

```ts
it("builds Appeals Packet Quality policy cards with outcome guardrails", () => {
  const policy = defaultIncentivePolicies.appeals_acme_packet_quality;
  const cards = buildBusinessPolicyCards(policy);

  expect(cards[0]).toMatchObject({
    title: "Appeals Packet Quality",
    source: "Plan/provider appeals contract policy",
    appliesTo: "Appeals Packet Quality"
  });
  expect(JSON.stringify(cards)).toContain("packet-readiness SLA");
  expect(JSON.stringify(cards)).toContain("No appeal outcome incentive");
});
```

In `demo-catalog.test.ts`, change the expected Appeals status:

```ts
const appeals = getScenario("appeals");
expect(appeals.status).toBe("active");
expect(appeals.title).toBe("Appeals Packet Quality");
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/apps/web/lib/policy-view-model.test.ts src/apps/web/components/demo-catalog.test.ts
```

Expected: FAIL because Appeals policy cards/default policy are missing and catalog status is dormant.

- [ ] **Step 3: Add default Appeals policy and policy cards**

In `policy-store.ts`, add:

```ts
const APPEALS_SUBMITTER_ID = "lakeside-provider-admin";
const APPEALS_SUBMITTER_WALLET_ID = "0.0.9049549";
```

Add `appeals_acme_packet_quality: appealsPacketQualityPolicy({ policyId: "appeals-packet-quality-v1", planId: "acme-health-ppo" })` to `defaultIncentivePolicies`.

Implement:

```ts
function appealsPacketQualityPolicy({ policyId, planId }: { policyId: string; planId: string }): IncentivePolicy {
  return {
    policyId,
    version: "v1",
    status: "active",
    evaluationType: "appeals_packet_quality",
    contractPair: {
      planId,
      planName: planNameForId(planId),
      providerId: APPEALS_SUBMITTER_ID,
      providerName: providerNameForId(APPEALS_SUBMITTER_ID)
    },
    effectivePeriod: { startsOn: "2026-05-01", endsOn: null },
    incentiveScope: { eligibleRequestTypes: ["pharmacy_benefit", "outpatient_service"] },
    eligibilityCriteria: {
      appliesOnlyToCoveredBenefits: false,
      requiresDtrCompletionWhenRequested: false,
      requiresAppealPacketReadyWithinSla: true,
      requiresAppealAcknowledgementWithinSla: true,
      requiresAppealPacketQualityAudit: true,
      prohibitsAppealOutcomeIncentive: true
    },
    payout: { token: "HBAR", amountPerEligibleRequest: 6, monthlyCap: 700 },
    settlement: { mode: "auto", recipientWalletId: APPEALS_SUBMITTER_WALLET_ID, requiresHumanApproval: false }
  };
}
```

In `policy-view-model.ts`, add `appealsPacketQualityBusinessPolicyType`, `appealsPacketQualityBusinessPolicyTitle`, `buildAppealsPacketQualityBusinessPolicyCards`, and detail sections that explicitly include:

- `Appeal receipt starts packet-readiness SLA`
- `Acknowledgement is a sub-SLA`
- `No appeal outcome incentive`
- `No cost savings or denial reversal metric`

Set `demoScenarios.appeals.status` to `"active"`.

- [ ] **Step 4: Update docs**

In `README.md`, update `/appeals` from static incentive to provider appeals workflow and add:

```md
- `/appeals` - provider appeals console for starting one appeal per denied PA and preparing packet evidence
- `/appeals/plan` - health-plan audit console for appeals packet readiness incentives
- `/appeals/policies` - Appeals Packet Quality business and payment policy catalog
```

In `docs/Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md`, expand the Appeals section with:

- workflow steps from the design
- `appealReceivedAt` as main SLA start
- `acknowledgedAt` as 2-business-hour sub-SLA
- `packetReadyAt` as main SLA stop
- CMS note that the demo SLA is a contract operations milestone, not a replacement for regulatory deadlines

- [ ] **Step 5: Verify catalog/docs tests GREEN**

Run:

```bash
npm test -- src/apps/web/lib/policy-view-model.test.ts src/apps/web/components/demo-catalog.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/apps/web/lib/policy-store.ts src/apps/web/lib/policy-view-model.ts src/apps/web/lib/policy-view-model.test.ts src/apps/web/components/demo-catalog.ts src/apps/web/components/demo-catalog.test.ts README.md docs/Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md
git commit -m "feat: activate appeals packet quality demo"
```

---

### Task 5: Final Verification And Browser QA

**Files:**
- Modify only files needed for verification fixes.

- [ ] **Step 1: Run targeted test suite**

```bash
npm test -- src/packages/policy-engine/test/evaluate-policy.test.ts src/packages/incentive-agent/test/appeals-event.test.ts src/apps/web/lib/appeals-workflow.test.ts src/apps/web/lib/appeals-routes.test.ts src/apps/web/components/appeals/AppealsConsole.test.tsx src/apps/web/components/appeals/AppealsPlanConsole.test.tsx src/apps/web/lib/policy-view-model.test.ts src/apps/web/components/demo-catalog.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full project verification**

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: all commands pass.

- [ ] **Step 3: Start local server**

Run:

```bash
npm run dev:simulated
```

Expected: Next.js dev server starts. If port 3000 is occupied, use the next available URL printed by Next.

- [ ] **Step 4: Browser verification**

Use the in-app Browser to verify:

- `/appeals` loads a provider appeals console, not the old static DemoPage.
- The page shows pending/approved/denied PA rows with disabled/enabled actions.
- A denied PA can start an appeal and open the workflow modal.
- Workflow step labels fit without overlap on desktop and mobile widths.
- Completing the workflow removes or updates the active appeal case and creates a plan row.
- `/appeals/plan` shows the Appeals packet policy log and details modal.
- `/appeals/policies` shows Appeals Packet Quality policy cards and Hedera Agent Kit payment policy cards.

- [ ] **Step 5: Fix any verification issues with TDD where possible**

For each found behavior bug, add or update a failing test first, run it to confirm RED, make the smallest fix, then re-run targeted and relevant full verification.

- [ ] **Step 6: Final status**

Run:

```bash
git status --short
```

Expected: clean or only intentional verification-fix files pending. If fixes were made, commit:

```bash
git add <fixed-files>
git commit -m "fix: polish appeals packet quality verification"
```

---

## Self-Review Notes

- Spec coverage: This plan covers the separate `AppealCase`, one appeal per PA, provider PA selection/start, all inner workflow steps, `appealReceivedAt` main SLA, acknowledgement sub-SLA, packet-readiness stop, policy evidence, routes, provider UI, plan UI, policies page, docs, tests, and browser verification.
- Type consistency: The plan uses `appeals_packet_quality`, `AppealCase`, `AppealsPlanAuditRow`, `APL-*`, `PA-*`, `appealReceivedAt`, `acknowledgedAt`, `packetReadyAt`, `packetReadinessSlaStatus`, and `acknowledgementSlaStatus` consistently.
- Scope: Weekday business-hour SLA math is implemented for Appeals. Multiple appeal levels and real document upload remain deferred by design.
