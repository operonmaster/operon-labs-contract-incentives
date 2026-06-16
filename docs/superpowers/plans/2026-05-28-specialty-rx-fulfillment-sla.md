# Specialty Rx Fulfillment SLA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Specialty Rx Fulfillment SLA as the third normal-path use case, replacing Provider Directory Data Quality in the demo menu.

**Architecture:** Add `SpecialtyFulfillmentCase` as a downstream workflow object linked to approved pharmacy-benefit `UMRequest` records. Reuse the existing pattern: workflow evidence -> incentive-agent event adapter -> deterministic business policy -> plan-level Hedera payment policy -> plan audit row.

**Tech Stack:** TypeScript, Next.js App Router, React, Vitest, Firestore-compatible stores, `@operon-labs/policy-engine`, `@operon-labs/incentive-agent`, `@operon-labs/hedera-executor`.

---

## File Structure

Create:

- `src/apps/web/lib/specialty-rx-store.ts` - Firestore and in-memory persistence for `SpecialtyFulfillmentCase`.
- `src/apps/web/lib/specialty-rx-store.test.ts` - store normalization and memory-store tests.
- `src/apps/web/lib/specialty-rx-workflow.ts` - fulfillment workflow, evidence builder, plan rows, settlement path.
- `src/apps/web/lib/specialty-rx-workflow.test.ts` - workflow state, SLA, policy, payment, and exception tests.
- `src/packages/policy-engine/test/specialty-rx-policy.test.ts` - business policy evaluator tests.
- `src/packages/incentive-agent/test/specialty-rx-event.test.ts` - event adapter tests.
- `src/apps/web/app/api/specialty-rx/workqueue/route.ts` - workqueue API.
- `src/apps/web/app/api/specialty-rx/plan/route.ts` - plan audit API.
- `src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/intake/route.ts` - Intake & Triage API.
- `src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/clear-to-fill/route.ts` - Clear To Fill API.
- `src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/shipment/route.ts` - Schedule Shipment API.
- `src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/fulfillment/route.ts` - Confirm Fulfillment API.
- `src/apps/web/app/specialty-rx/page.tsx` - specialty pharmacy workqueue page.
- `src/apps/web/app/specialty-rx/plan/page.tsx` - health-plan specialty fulfillment audit page.
- `src/apps/web/app/specialty-rx/policies/page.tsx` - specialty policy catalog page.
- `src/apps/web/components/specialty-rx/SpecialtyRxConsole.tsx` - operator workqueue.
- `src/apps/web/components/specialty-rx/SpecialtyRxWorkflowModal.tsx` - four-step workflow modal.
- `src/apps/web/components/specialty-rx/SpecialtyRxPlanConsole.tsx` - plan audit table.
- `src/apps/web/components/specialty-rx/SpecialtyRxPlanDetailsModal.tsx` - audit details modal.
- `src/apps/web/components/specialty-rx/SpecialtyRxUseCaseNavigation.tsx` - use-case nav.
- `src/apps/web/components/specialty-rx/specialty-rx-formatters.ts` - formatting helpers.
- `src/apps/web/components/specialty-rx/SpecialtyRxConsole.test.tsx` - operator console tests.
- `src/apps/web/components/specialty-rx/SpecialtyRxPlanConsole.test.tsx` - plan console tests.

Modify:

- `src/packages/policy-engine/src/index.ts` - add specialty evaluator and payout add-on support.
- `src/packages/incentive-agent/src/index.ts` - add fulfillment evidence and event evaluation.
- `src/apps/web/lib/demo-policy.ts` - route specialty requests to pair-scoped policy lookup.
- `src/apps/web/lib/demo-policy.test.ts` - policy lookup coverage.
- `src/apps/web/lib/policy-store.ts` - seed specialty fulfillment policy.
- `src/apps/web/lib/policy-view-model.ts` - make policy console display specialty criteria cleanly.
- `src/apps/web/lib/policy-view-model.test.ts` - view model coverage.
- `src/apps/web/components/demo-catalog.ts` - replace provider-directory card with specialty-rx.
- `src/apps/web/components/demo-catalog.test.ts` - catalog route expectations.
- `src/apps/web/app/styles.css` - small specialty-specific workflow/table layout styles.
- `README.md` - route list and demo walkthrough.
- `docs/Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md` - replace Provider Directory with Specialty Rx.

Delete:

- `src/apps/web/app/provider-directory/page.tsx`
- `src/mock-data/provider-directory/approved.json`

---

### Task 1: Policy Engine Evaluator

**Files:**

- Modify: `src/packages/policy-engine/src/index.ts`
- Create: `src/packages/policy-engine/test/specialty-rx-policy.test.ts`

- [ ] **Step 1: Write the failing policy tests**

Create `src/packages/policy-engine/test/specialty-rx-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluatePolicy, type EvaluationRequest, type IncentivePolicy } from "../src/index";

const policy: IncentivePolicy = {
  policyId: "specialty-rx-fulfillment-sla-v1",
  version: "v1",
  status: "active",
  evaluationType: "specialty_rx_fulfillment_sla",
  contractPair: {
    planId: "acme-health-ppo",
    planName: "Acme Health PPO",
    providerId: "atlas-specialty-rx",
    providerName: "Atlas Specialty Rx"
  },
  effectivePeriod: {
    startsOn: "2026-05-01",
    endsOn: null
  },
  incentiveScope: {
    eligibleRequestTypes: ["pharmacy_benefit"]
  },
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: false,
    requiresDtrCompletionWhenRequested: false,
    requiresShipmentScheduledWithinSla: true,
    requiresDeliveryConfirmedWithinSla: true,
    requiresColdChainEvidenceWhenRequired: true,
    requiresRemsAuthorizationWhenRequired: true,
    prohibitsAvoidableFulfillmentException: true
  },
  payout: {
    token: "HBAR",
    amountPerEligibleRequest: 5,
    monthlyCap: 700,
    coldChainHandlingAddOn: {
      amount: 2,
      maxPerRequest: 7
    }
  },
  settlement: {
    mode: "auto",
    recipientWalletId: "0.0.9049549",
    requiresHumanApproval: false
  }
};

const approvedRequest: EvaluationRequest = {
  evaluationType: "specialty_rx_fulfillment_sla",
  submitter: {
    id: "atlas-specialty-rx"
  },
  requestObject: {
    fulfillmentCaseId: "RXF-260526-0900-DELEGATE",
    umRequestId: "PA-260526-0900-DELEGATE",
    planId: "acme-health-ppo",
    pharmacyId: "atlas-specialty-rx",
    requestType: "pharmacy_benefit",
    paOutcomeStatus: "approved",
    state: "fulfilled",
    intakeComplete: true,
    clearToFillComplete: true,
    clearToFillAt: "2026-06-18T16:00:00.000Z",
    shipmentScheduledAt: "2026-06-19T09:30:00.000Z",
    deliveryConfirmedAt: "2026-06-20T14:00:00.000Z",
    scheduleSlaHours: 24,
    deliverySlaHours: 72,
    shipmentScheduledWithinSla: true,
    deliveryConfirmedWithinSla: true,
    remsRequired: false,
    remsAuthorizationConfirmed: true,
    coldChainRequired: true,
    coldChainPackoutValidated: true,
    temperatureLogValid: true,
    avoidableFulfillmentException: false,
    externalBlockerDocumented: false,
    drugChoiceMetricUsed: false,
    fillVolumeMetricUsed: false,
    pharmacySteeringMetricUsed: false,
    patientAdherenceMetricUsed: false,
    containsPhi: false
  }
};

describe("specialty_rx_fulfillment_sla policy", () => {
  it("approves clean fulfillment and adds the cold-chain handling amount", () => {
    const result = evaluatePolicy({
      policy,
      request: approvedRequest,
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "approved",
      policyId: "specialty-rx-fulfillment-sla-v1",
      amount: 7,
      currency: "HBAR",
      walletId: "0.0.9049549",
      reasonCodes: []
    });
  });

  it("blocks late shipment from the clear-to-fill timestamp", () => {
    const result = evaluatePolicy({
      policy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          shipmentScheduledWithinSla: false
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: ["SHIPMENT_SLA_EXCEEDED"]
    });
  });

  it("blocks prohibited commercial metrics and PHI payment metadata", () => {
    const result = evaluatePolicy({
      policy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          drugChoiceMetricUsed: true,
          fillVolumeMetricUsed: true,
          pharmacySteeringMetricUsed: true,
          patientAdherenceMetricUsed: true,
          containsPhi: true
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: [
        "PROHIBITED_DRUG_CHOICE_METRIC",
        "PROHIBITED_FILL_VOLUME_METRIC",
        "PROHIBITED_PHARMACY_STEERING_METRIC",
        "PROHIBITED_PATIENT_ADHERENCE_METRIC",
        "PHI_IN_PAYMENT_METADATA"
      ]
    });
  });

  it("treats documented external blockers as not applicable instead of pharmacy failure", () => {
    const result = evaluatePolicy({
      policy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          state: "exception",
          externalBlockerDocumented: true,
          deliveryConfirmedWithinSla: false
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "not_applicable",
      amount: 0,
      walletId: null,
      reasonCodes: ["EXTERNAL_BLOCKER_DOCUMENTED"]
    });
  });

  it("enforces the monthly cap after cold-chain add-on calculation", () => {
    const result = evaluatePolicy({
      policy,
      request: approvedRequest,
      monthToDateAmount: 698
    });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: ["MONTHLY_CAP_EXCEEDED"]
    });
  });
});
```

- [ ] **Step 2: Run policy tests and verify they fail**

Run:

```bash
npm test -- src/packages/policy-engine/test/specialty-rx-policy.test.ts
```

Expected: FAIL with unsupported evaluator behavior. The first failure should show that `coldChainHandlingAddOn` is not part of the current policy model or that the generic provider evaluator returns wrong contract reason codes.

- [ ] **Step 3: Extend policy model types**

Modify `src/packages/policy-engine/src/index.ts`:

```ts
export interface IncentivePolicy {
  policyId: string;
  version: string;
  status: PolicyStatus;
  evaluationType: string;
  contractPair: {
    planId: string;
    planName: string;
    providerId: string;
    providerName: string;
  };
  effectivePeriod: {
    startsOn: string;
    endsOn: string | null;
  };
  incentiveScope: {
    eligibleRequestTypes?: string[];
    excludedRequestTypes?: string[];
    includedServiceCodes?: ServiceCodeSet;
    excludedServiceCodes?: ServiceCodeSet;
  };
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: boolean;
    requiresDtrCompletionWhenRequested: boolean;
    requiresDeterminationWithinSla?: boolean;
    requiresClinicalReviewCompletion?: boolean;
    requiresShipmentScheduledWithinSla?: boolean;
    requiresDeliveryConfirmedWithinSla?: boolean;
    requiresColdChainEvidenceWhenRequired?: boolean;
    requiresRemsAuthorizationWhenRequired?: boolean;
    prohibitsAvoidableFulfillmentException?: boolean;
  };
  payout: {
    token: TokenSymbol;
    amountPerEligibleRequest: number;
    monthlyCap: number;
    coldChainHandlingAddOn?: {
      amount: number;
      maxPerRequest: number;
    };
  };
  settlement: {
    mode: SettlementMode;
    recipientWalletId: string;
    requiresHumanApproval: boolean;
  };
}
```

- [ ] **Step 4: Route specialty evaluations before generic provider logic**

In `evaluatePolicy`, add this branch after the existing delegate branch:

```ts
if (policy.evaluationType === "specialty_rx_fulfillment_sla") {
  return evaluateSpecialtyRxFulfillmentPolicy(input);
}
```

- [ ] **Step 5: Implement the specialty evaluator**

Add this function below `evaluateDelegateUmSlaPolicy`:

```ts
function evaluateSpecialtyRxFulfillmentPolicy(input: EvaluatePolicyInput): PolicyEvaluationResult {
  const { policy, request, monthToDateAmount } = input;
  const reasonCodes: string[] = [];
  const token = policy.payout.token;

  if (request.evaluationType !== policy.evaluationType) {
    reasonCodes.push("EVALUATION_TYPE_MISMATCH");
  }

  if (policy.status !== "active") {
    reasonCodes.push("POLICY_INACTIVE");
  }

  if (request.requestObject.planId !== policy.contractPair.planId) {
    reasonCodes.push("PLAN_NOT_IN_CONTRACT");
  }

  if (request.submitter.id !== policy.contractPair.providerId || request.requestObject.pharmacyId !== policy.contractPair.providerId) {
    reasonCodes.push("SPECIALTY_PHARMACY_NOT_IN_CONTRACT");
  }

  const requestType = String(request.requestObject.requestType ?? "");
  const excludedRequestTypes = policy.incentiveScope.excludedRequestTypes ?? [];
  const eligibleRequestTypes = policy.incentiveScope.eligibleRequestTypes ?? [];
  if (excludedRequestTypes.includes(requestType)) {
    reasonCodes.push("REQUEST_TYPE_EXCLUDED");
  } else if (eligibleRequestTypes.length > 0 && !eligibleRequestTypes.includes(requestType)) {
    reasonCodes.push("REQUEST_TYPE_NOT_ELIGIBLE");
  }

  if (request.requestObject.paOutcomeStatus !== "approved") {
    reasonCodes.push("LINKED_PA_NOT_APPROVED");
  }

  if (request.requestObject.state !== "fulfilled" && request.requestObject.externalBlockerDocumented !== true) {
    reasonCodes.push("FULFILLMENT_NOT_COMPLETE");
  }

  if (request.requestObject.intakeComplete !== true) {
    reasonCodes.push("INTAKE_INCOMPLETE");
  }

  if (request.requestObject.clearToFillComplete !== true || typeof request.requestObject.clearToFillAt !== "string") {
    reasonCodes.push("CLEAR_TO_FILL_INCOMPLETE");
  }

  if (policy.eligibilityCriteria.requiresShipmentScheduledWithinSla && request.requestObject.shipmentScheduledWithinSla !== true) {
    reasonCodes.push("SHIPMENT_SLA_EXCEEDED");
  }

  if (policy.eligibilityCriteria.requiresDeliveryConfirmedWithinSla && request.requestObject.deliveryConfirmedWithinSla !== true) {
    reasonCodes.push("DELIVERY_SLA_EXCEEDED");
  }

  if (
    policy.eligibilityCriteria.requiresColdChainEvidenceWhenRequired &&
    request.requestObject.coldChainRequired === true &&
    (request.requestObject.coldChainPackoutValidated !== true || request.requestObject.temperatureLogValid !== true)
  ) {
    reasonCodes.push("COLD_CHAIN_EVIDENCE_INVALID");
  }

  if (
    policy.eligibilityCriteria.requiresRemsAuthorizationWhenRequired &&
    request.requestObject.remsRequired === true &&
    request.requestObject.remsAuthorizationConfirmed !== true
  ) {
    reasonCodes.push("REMS_AUTHORIZATION_MISSING");
  }

  if (policy.eligibilityCriteria.prohibitsAvoidableFulfillmentException && request.requestObject.avoidableFulfillmentException === true) {
    reasonCodes.push("AVOIDABLE_FULFILLMENT_EXCEPTION");
  }

  if (request.requestObject.drugChoiceMetricUsed === true) {
    reasonCodes.push("PROHIBITED_DRUG_CHOICE_METRIC");
  }

  if (request.requestObject.fillVolumeMetricUsed === true) {
    reasonCodes.push("PROHIBITED_FILL_VOLUME_METRIC");
  }

  if (request.requestObject.pharmacySteeringMetricUsed === true) {
    reasonCodes.push("PROHIBITED_PHARMACY_STEERING_METRIC");
  }

  if (request.requestObject.patientAdherenceMetricUsed === true) {
    reasonCodes.push("PROHIBITED_PATIENT_ADHERENCE_METRIC");
  }

  if (request.requestObject.containsPhi === true) {
    reasonCodes.push("PHI_IN_PAYMENT_METADATA");
  }

  if (request.requestObject.externalBlockerDocumented === true) {
    return result({
      decision: "not_applicable",
      policy,
      reasonCodes: ["EXTERNAL_BLOCKER_DOCUMENTED"],
      token
    });
  }

  const amount = specialtyRxFulfillmentAmount(policy, request);
  if (monthToDateAmount + amount > policy.payout.monthlyCap) {
    reasonCodes.push("MONTHLY_CAP_EXCEEDED");
  }

  const blocked = reasonCodes.length > 0;
  if (!blocked && (policy.settlement.mode === "manual" || policy.settlement.requiresHumanApproval)) {
    return result({
      decision: "manual_review",
      policy,
      reasonCodes: ["MANUAL_REVIEW_REQUIRED"],
      token
    });
  }

  return result({
    decision: blocked ? "blocked" : "approved",
    policy,
    reasonCodes,
    token,
    amountOverride: amount
  });
}
```

- [ ] **Step 6: Allow evaluator-specific amount overrides**

Update the `result` helper signature and approved amount calculation:

```ts
function result({
  decision,
  policy,
  reasonCodes,
  token,
  amountOverride
}: {
  decision: PolicyDecision;
  policy: IncentivePolicy;
  reasonCodes: string[];
  token: TokenSymbol;
  amountOverride?: number;
}): PolicyEvaluationResult {
  const approved = decision === "approved";
  const amount = approved ? amountOverride ?? policy.payout.amountPerEligibleRequest : 0;

  return {
    decision,
    policyId: policy.policyId,
    policyVersion: policy.version,
    amount,
    currency: token,
    settlementToken: { symbol: token },
    walletId: approved ? policy.settlement.recipientWalletId : null,
    requiresHumanApproval: policy.settlement.requiresHumanApproval,
    reasonCodes
  };
}
```

Add the amount helper:

```ts
function specialtyRxFulfillmentAmount(policy: IncentivePolicy, request: EvaluationRequest): number {
  const baseAmount = policy.payout.amountPerEligibleRequest;
  const addOn = policy.payout.coldChainHandlingAddOn;

  if (
    addOn &&
    request.requestObject.coldChainRequired === true &&
    request.requestObject.coldChainPackoutValidated === true &&
    request.requestObject.temperatureLogValid === true
  ) {
    return Math.min(baseAmount + addOn.amount, addOn.maxPerRequest);
  }

  return baseAmount;
}
```

- [ ] **Step 7: Run policy tests**

Run:

```bash
npm test -- src/packages/policy-engine/test/specialty-rx-policy.test.ts src/packages/policy-engine/test/evaluate-policy.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit policy engine slice**

Run:

```bash
git add src/packages/policy-engine/src/index.ts src/packages/policy-engine/test/specialty-rx-policy.test.ts
git commit -m "feat: add specialty rx fulfillment policy evaluator"
```

### Task 2: Incentive Agent Event Adapter

**Files:**

- Modify: `src/packages/incentive-agent/src/index.ts`
- Create: `src/packages/incentive-agent/test/specialty-rx-event.test.ts`

- [ ] **Step 1: Write the failing event adapter tests**

Create `src/packages/incentive-agent/test/specialty-rx-event.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { IncentivePolicy } from "@operon-labs/policy-engine";
import { evaluateSpecialtyRxFulfillmentEvent, type SpecialtyRxFulfillmentEvidence } from "../src/index";

const policy: IncentivePolicy = {
  policyId: "specialty-rx-fulfillment-sla-v1",
  version: "v1",
  status: "active",
  evaluationType: "specialty_rx_fulfillment_sla",
  contractPair: {
    planId: "acme-health-ppo",
    planName: "Acme Health PPO",
    providerId: "atlas-specialty-rx",
    providerName: "Atlas Specialty Rx"
  },
  effectivePeriod: { startsOn: "2026-05-01", endsOn: null },
  incentiveScope: { eligibleRequestTypes: ["pharmacy_benefit"] },
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: false,
    requiresDtrCompletionWhenRequested: false,
    requiresShipmentScheduledWithinSla: true,
    requiresDeliveryConfirmedWithinSla: true,
    requiresColdChainEvidenceWhenRequired: true,
    requiresRemsAuthorizationWhenRequired: true,
    prohibitsAvoidableFulfillmentException: true
  },
  payout: {
    token: "HBAR",
    amountPerEligibleRequest: 5,
    monthlyCap: 700,
    coldChainHandlingAddOn: { amount: 2, maxPerRequest: 7 }
  },
  settlement: { mode: "auto", recipientWalletId: "0.0.9049549", requiresHumanApproval: false }
};

const evidence: SpecialtyRxFulfillmentEvidence = {
  fulfillmentCaseId: "RXF-260526-0900-DELEGATE",
  umRequestId: "PA-260526-0900-DELEGATE",
  planId: "acme-health-ppo",
  pharmacyId: "atlas-specialty-rx",
  requestType: "pharmacy_benefit",
  paOutcomeStatus: "approved",
  state: "fulfilled",
  clearToFillAt: "2026-06-18T16:00:00.000Z",
  shipmentScheduledAt: "2026-06-19T09:30:00.000Z",
  deliveryConfirmedAt: "2026-06-20T14:00:00.000Z",
  scheduleSlaHours: 24,
  deliverySlaHours: 72,
  intakeComplete: true,
  clearToFillComplete: true,
  shipmentScheduledWithinSla: true,
  deliveryConfirmedWithinSla: true,
  remsRequired: false,
  remsAuthorizationConfirmed: true,
  coldChainRequired: true,
  coldChainPackoutValidated: true,
  temperatureLogValid: true,
  avoidableFulfillmentException: false,
  externalBlockerDocumented: false,
  drugChoiceMetricUsed: false,
  fillVolumeMetricUsed: false,
  pharmacySteeringMetricUsed: false,
  patientAdherenceMetricUsed: false,
  containsPhi: false
};

describe("evaluateSpecialtyRxFulfillmentEvent", () => {
  it("pulls evidence by fulfillmentCaseId and builds the policy request", () => {
    const getEvidence = vi.fn(() => evidence);

    const evaluation = evaluateSpecialtyRxFulfillmentEvent(
      {
        eventType: "SPECIALTY_FULFILLMENT_COMPLETED",
        fulfillmentCaseId: evidence.fulfillmentCaseId,
        umRequestId: evidence.umRequestId
      },
      {
        getEvidenceByFulfillmentCaseId: getEvidence,
        policy,
        monthToDateAmount: 0
      }
    );

    expect(getEvidence).toHaveBeenCalledWith(evidence.fulfillmentCaseId);
    expect(evaluation.request).toMatchObject({
      evaluationType: "specialty_rx_fulfillment_sla",
      submitter: { id: "atlas-specialty-rx" },
      requestObject: {
        fulfillmentCaseId: evidence.fulfillmentCaseId,
        umRequestId: evidence.umRequestId,
        planId: "acme-health-ppo",
        pharmacyId: "atlas-specialty-rx",
        requestType: "pharmacy_benefit",
        paOutcomeStatus: "approved",
        state: "fulfilled",
        shipmentScheduledWithinSla: true,
        deliveryConfirmedWithinSla: true,
        coldChainRequired: true,
        containsPhi: false
      }
    });
    expect(evaluation.result).toMatchObject({
      decision: "approved",
      amount: 7,
      reasonCodes: []
    });
  });

  it("rejects unsupported event types before evidence lookup", () => {
    const getEvidence = vi.fn();

    expect(() =>
      evaluateSpecialtyRxFulfillmentEvent(
        {
          eventType: "UM_REQUEST_DETERMINED",
          fulfillmentCaseId: evidence.fulfillmentCaseId,
          umRequestId: evidence.umRequestId
        },
        { getEvidenceByFulfillmentCaseId: getEvidence, policy, monthToDateAmount: 0 }
      )
    ).toThrow("UNSUPPORTED_SPECIALTY_RX_EVENT");
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("rejects mismatched evidence ids", () => {
    const eventCaseId = "RXF-260526-0900-EVENT01";

    expect(() =>
      evaluateSpecialtyRxFulfillmentEvent(
        {
          eventType: "SPECIALTY_FULFILLMENT_COMPLETED",
          fulfillmentCaseId: eventCaseId,
          umRequestId: evidence.umRequestId
        },
        {
          getEvidenceByFulfillmentCaseId: () => ({
            ...evidence,
            fulfillmentCaseId: "RXF-260526-0900-OTHER01"
          }),
          policy,
          monthToDateAmount: 0
        }
      )
    ).toThrow(`SPECIALTY_RX_EVIDENCE_ID_MISMATCH:${eventCaseId}`);
  });
});
```

- [ ] **Step 2: Run event tests and verify they fail**

Run:

```bash
npm test -- src/packages/incentive-agent/test/specialty-rx-event.test.ts
```

Expected: FAIL with `evaluateSpecialtyRxFulfillmentEvent` not exported.

- [ ] **Step 3: Add specialty evidence types and dependency interface**

In `src/packages/incentive-agent/src/index.ts`, add:

```ts
export interface SpecialtyRxFulfillmentEvidence {
  fulfillmentCaseId: string;
  umRequestId: string;
  planId: string;
  pharmacyId: string;
  requestType: string;
  paOutcomeStatus: "approved" | "denied";
  state: "intake_triage" | "clear_to_fill" | "shipment_scheduled" | "fulfilled" | "exception";
  clearToFillAt: string | null;
  shipmentScheduledAt: string | null;
  deliveryConfirmedAt: string | null;
  scheduleSlaHours: 24;
  deliverySlaHours: 72;
  intakeComplete: boolean;
  clearToFillComplete: boolean;
  shipmentScheduledWithinSla: boolean;
  deliveryConfirmedWithinSla: boolean;
  remsRequired: boolean;
  remsAuthorizationConfirmed: boolean;
  coldChainRequired: boolean;
  coldChainPackoutValidated: boolean;
  temperatureLogValid: boolean;
  avoidableFulfillmentException: boolean;
  externalBlockerDocumented: boolean;
  drugChoiceMetricUsed: boolean;
  fillVolumeMetricUsed: boolean;
  pharmacySteeringMetricUsed: boolean;
  patientAdherenceMetricUsed: boolean;
  containsPhi: boolean;
}

export interface SpecialtyRxFulfillmentEvaluationDependencies {
  getEvidenceByFulfillmentCaseId: (fulfillmentCaseId: string) => SpecialtyRxFulfillmentEvidence | null;
  policy: IncentivePolicy;
  monthToDateAmount?: number;
}
```

- [ ] **Step 4: Implement the event adapter**

In `src/packages/incentive-agent/src/index.ts`, add:

```ts
export function evaluateSpecialtyRxFulfillmentEvent(
  event: { eventType: string; fulfillmentCaseId: string; umRequestId: string },
  dependencies: SpecialtyRxFulfillmentEvaluationDependencies
): DemoEvaluation {
  if (event.eventType !== "SPECIALTY_FULFILLMENT_COMPLETED") {
    throw new Error("UNSUPPORTED_SPECIALTY_RX_EVENT");
  }
  assertSpecialtyRxEventIds(event);

  const evidence = dependencies.getEvidenceByFulfillmentCaseId(event.fulfillmentCaseId);
  if (!evidence) {
    throw new Error(`SPECIALTY_RX_EVIDENCE_NOT_FOUND:${event.fulfillmentCaseId}`);
  }
  assertSpecialtyRxEvidenceMatchesEvent(evidence, event);

  const request: EvaluationRequest = {
    evaluationType: "specialty_rx_fulfillment_sla",
    submitter: { id: evidence.pharmacyId },
    requestObject: {
      fulfillmentCaseId: evidence.fulfillmentCaseId,
      umRequestId: evidence.umRequestId,
      planId: evidence.planId,
      pharmacyId: evidence.pharmacyId,
      requestType: evidence.requestType,
      paOutcomeStatus: evidence.paOutcomeStatus,
      state: evidence.state,
      clearToFillAt: evidence.clearToFillAt,
      shipmentScheduledAt: evidence.shipmentScheduledAt,
      deliveryConfirmedAt: evidence.deliveryConfirmedAt,
      scheduleSlaHours: evidence.scheduleSlaHours,
      deliverySlaHours: evidence.deliverySlaHours,
      intakeComplete: evidence.intakeComplete,
      clearToFillComplete: evidence.clearToFillComplete,
      shipmentScheduledWithinSla: evidence.shipmentScheduledWithinSla,
      deliveryConfirmedWithinSla: evidence.deliveryConfirmedWithinSla,
      remsRequired: evidence.remsRequired,
      remsAuthorizationConfirmed: evidence.remsAuthorizationConfirmed,
      coldChainRequired: evidence.coldChainRequired,
      coldChainPackoutValidated: evidence.coldChainPackoutValidated,
      temperatureLogValid: evidence.temperatureLogValid,
      avoidableFulfillmentException: evidence.avoidableFulfillmentException,
      externalBlockerDocumented: evidence.externalBlockerDocumented,
      drugChoiceMetricUsed: evidence.drugChoiceMetricUsed,
      fillVolumeMetricUsed: evidence.fillVolumeMetricUsed,
      pharmacySteeringMetricUsed: evidence.pharmacySteeringMetricUsed,
      patientAdherenceMetricUsed: evidence.patientAdherenceMetricUsed,
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

Add assertions near the existing delegate assertions:

```ts
function assertSpecialtyRxEventIds(event: { fulfillmentCaseId: string; umRequestId: string }): void {
  if (!event.fulfillmentCaseId.startsWith("RXF-")) {
    throw new Error(`SPECIALTY_RX_EVENT_ID_NOT_CANONICAL:${event.fulfillmentCaseId}`);
  }
  if (!event.umRequestId.startsWith("PA-")) {
    throw new Error(`SPECIALTY_RX_UM_REQUEST_ID_NOT_CANONICAL:${event.umRequestId}`);
  }
}

function assertSpecialtyRxEvidenceMatchesEvent(
  evidence: SpecialtyRxFulfillmentEvidence,
  event: { fulfillmentCaseId: string; umRequestId: string }
): void {
  if (evidence.fulfillmentCaseId !== event.fulfillmentCaseId || evidence.umRequestId !== event.umRequestId) {
    throw new Error(`SPECIALTY_RX_EVIDENCE_ID_MISMATCH:${event.fulfillmentCaseId}`);
  }
}
```

- [ ] **Step 5: Replace demo request entry**

In `demoRequests`, remove `provider_directory_quality` and add:

```ts
specialty_rx_fulfillment_sla: {
  evaluationType: "specialty_rx_fulfillment_sla",
  submitter: { id: "atlas-specialty-rx" },
  requestObject: {
    fulfillmentCaseId: "RXF-260526-0900-DELEGATE",
    umRequestId: "PA-260526-0900-DELEGATE",
    planId: "acme-health-ppo",
    pharmacyId: "atlas-specialty-rx",
    requestType: "pharmacy_benefit",
    paOutcomeStatus: "approved",
    state: "fulfilled",
    clearToFillAt: "2026-06-18T16:00:00.000Z",
    shipmentScheduledAt: "2026-06-19T09:30:00.000Z",
    deliveryConfirmedAt: "2026-06-20T14:00:00.000Z",
    scheduleSlaHours: 24,
    deliverySlaHours: 72,
    intakeComplete: true,
    clearToFillComplete: true,
    shipmentScheduledWithinSla: true,
    deliveryConfirmedWithinSla: true,
    remsRequired: false,
    remsAuthorizationConfirmed: true,
    coldChainRequired: true,
    coldChainPackoutValidated: true,
    temperatureLogValid: true,
    avoidableFulfillmentException: false,
    externalBlockerDocumented: false,
    drugChoiceMetricUsed: false,
    fillVolumeMetricUsed: false,
    pharmacySteeringMetricUsed: false,
    patientAdherenceMetricUsed: false,
    containsPhi: false
  }
}
```

- [ ] **Step 6: Run event adapter tests**

Run:

```bash
npm test -- src/packages/incentive-agent/test/specialty-rx-event.test.ts src/packages/incentive-agent/test/delegate-um-event.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit incentive-agent slice**

Run:

```bash
git add src/packages/incentive-agent/src/index.ts src/packages/incentive-agent/test/specialty-rx-event.test.ts
git commit -m "feat: add specialty rx incentive event adapter"
```

### Task 3: Policy Store, Lookup, And Catalog Replacement

**Files:**

- Modify: `src/apps/web/lib/policy-store.ts`
- Modify: `src/apps/web/lib/demo-policy.ts`
- Modify: `src/apps/web/lib/demo-policy.test.ts`
- Modify: `src/apps/web/components/demo-catalog.ts`
- Modify: `src/apps/web/components/demo-catalog.test.ts`
- Delete: `src/apps/web/app/provider-directory/page.tsx`
- Delete: `src/mock-data/provider-directory/approved.json`

- [ ] **Step 1: Update demo catalog tests first**

In `src/apps/web/components/demo-catalog.test.ts`, update route expectations so the active/dormant list contains `specialty-rx` and does not contain `provider-directory`:

```ts
expect(demoScenarios.map((scenario) => scenario.slug)).toEqual([
  "provider-documentation",
  "delegate-um",
  "specialty-rx",
  "appeals"
]);

expect(demoScenarios.find((scenario) => scenario.slug === "specialty-rx")).toMatchObject({
  title: "Specialty Rx Fulfillment SLA",
  submitter: "Specialty pharmacy",
  evaluationType: "specialty_rx_fulfillment_sla",
  status: "active"
});
expect(demoScenarios.some((scenario) => scenario.slug === "provider-directory")).toBe(false);
```

- [ ] **Step 2: Update demo catalog**

In `src/apps/web/components/demo-catalog.ts`, replace the provider-directory entry with:

```ts
{
  slug: "specialty-rx",
  title: "Specialty Rx Fulfillment SLA",
  submitter: "Specialty pharmacy",
  purpose: "Reward contracted specialty pharmacy fulfillment that clears, schedules, and confirms approved therapy within SLA without avoidable exceptions.",
  evaluationType: "specialty_rx_fulfillment_sla",
  status: "active"
}
```

Keep `appeals` after specialty-rx with `status: "dormant"`.

- [ ] **Step 3: Add policy lookup test**

In `src/apps/web/lib/demo-policy.test.ts`, add:

```ts
it("finds specialty rx policies by plan, pharmacy, and request type", async () => {
  const store = createInMemoryPolicyStore({
    specialty_rx_acme_fulfillment_sla: defaultIncentivePolicies.specialty_rx_acme_fulfillment_sla
  });

  await expect(findDemoPolicy("specialty_rx_fulfillment_sla", store)).resolves.toMatchObject({
    policyId: "specialty-rx-fulfillment-sla-v1",
    evaluationType: "specialty_rx_fulfillment_sla",
    contractPair: {
      planId: "acme-health-ppo",
      providerId: "atlas-specialty-rx"
    }
  });
});
```

- [ ] **Step 4: Add specialty policy defaults**

In `src/apps/web/lib/policy-store.ts`, add constants near the existing provider/delegate constants:

```ts
const SPECIALTY_PHARMACY_ID = "atlas-specialty-rx";
const SPECIALTY_PHARMACY_WALLET_ID = "0.0.9049549";
```

Add the default policy inside `defaultIncentivePolicies`:

```ts
specialty_rx_acme_fulfillment_sla: specialtyRxFulfillmentSlaPolicy({
  policyId: "specialty-rx-fulfillment-sla-v1",
  planId: "acme-health-ppo"
})
```

Add the policy factory near `delegateUmSlaBonusPolicy`:

```ts
function specialtyRxFulfillmentSlaPolicy({
  planId,
  policyId
}: {
  policyId: string;
  planId: string;
}): IncentivePolicy {
  return {
    policyId,
    version: "v1",
    status: "active",
    evaluationType: "specialty_rx_fulfillment_sla",
    contractPair: {
      planId,
      planName: planNameForId(planId),
      providerId: SPECIALTY_PHARMACY_ID,
      providerName: providerNameForId(SPECIALTY_PHARMACY_ID)
    },
    effectivePeriod: {
      startsOn: "2026-05-01",
      endsOn: null
    },
    incentiveScope: {
      eligibleRequestTypes: ["pharmacy_benefit"]
    },
    eligibilityCriteria: {
      appliesOnlyToCoveredBenefits: false,
      requiresDtrCompletionWhenRequested: false,
      requiresShipmentScheduledWithinSla: true,
      requiresDeliveryConfirmedWithinSla: true,
      requiresColdChainEvidenceWhenRequired: true,
      requiresRemsAuthorizationWhenRequired: true,
      prohibitsAvoidableFulfillmentException: true
    },
    payout: {
      token: "HBAR",
      amountPerEligibleRequest: 5,
      monthlyCap: 700,
      coldChainHandlingAddOn: {
        amount: 2,
        maxPerRequest: 7
      }
    },
    settlement: {
      mode: "auto",
      recipientWalletId: SPECIALTY_PHARMACY_WALLET_ID,
      requiresHumanApproval: false
    }
  };
}
```

Update `providerNameForId`:

```ts
case SPECIALTY_PHARMACY_ID:
  return "Atlas Specialty Rx";
```

- [ ] **Step 5: Add specialty request lookup**

In `src/apps/web/lib/demo-policy.ts`, add before the provider-documentation branch:

```ts
if (request.evaluationType === "specialty_rx_fulfillment_sla") {
  const planId = stringValue(request.requestObject.planId);
  const pharmacyId = stringValue(request.requestObject.pharmacyId);
  const requestType = stringValue(request.requestObject.requestType);

  if (!planId || !pharmacyId || !requestType || request.submitter.id !== pharmacyId) {
    return null;
  }

  return store.findPolicy({
    evaluationType: request.evaluationType,
    planId,
    providerId: pharmacyId,
    requestType
  });
}
```

- [ ] **Step 6: Delete Provider Directory artifacts**

Run:

```bash
git rm src/apps/web/app/provider-directory/page.tsx src/mock-data/provider-directory/approved.json
```

- [ ] **Step 7: Run focused catalog and lookup tests**

Run:

```bash
npm test -- src/apps/web/components/demo-catalog.test.ts src/apps/web/lib/demo-policy.test.ts src/apps/web/lib/policy-store.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit catalog and policy defaults**

Run:

```bash
git add src/apps/web/lib/policy-store.ts src/apps/web/lib/demo-policy.ts src/apps/web/lib/demo-policy.test.ts src/apps/web/components/demo-catalog.ts src/apps/web/components/demo-catalog.test.ts
git add -u src/apps/web/app/provider-directory/page.tsx src/mock-data/provider-directory/approved.json
git commit -m "feat: replace provider directory with specialty rx policy"
```

### Task 4: Specialty Rx Store And Workflow

**Files:**

- Create: `src/apps/web/lib/specialty-rx-store.ts`
- Create: `src/apps/web/lib/specialty-rx-store.test.ts`
- Create: `src/apps/web/lib/specialty-rx-workflow.ts`
- Create: `src/apps/web/lib/specialty-rx-workflow.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `src/apps/web/lib/specialty-rx-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInMemorySpecialtyRxCaseStore, type SpecialtyFulfillmentCase } from "./specialty-rx-store";

const caseRecord: SpecialtyFulfillmentCase = {
  id: "RXF-260526-0900-DELEGATE",
  umRequestId: "PA-260526-0900-DELEGATE",
  source: "delegate_um_approved",
  planId: "acme-health-ppo",
  pharmacyId: "atlas-specialty-rx",
  pharmacyDisplay: "Atlas Specialty Rx",
  requestType: "pharmacy_benefit",
  serviceCode: "wegovy_semaglutide",
  serviceLabel: "Wegovy semaglutide",
  codingSystem: "NDC",
  billingCode: "0169-4525-14",
  state: "intake_triage",
  paApprovalReceivedAt: "2026-06-18T10:00:00.000Z",
  intakeStartedAt: "2026-06-18T10:05:00.000Z",
  clearToFillAt: null,
  shipmentScheduledAt: null,
  deliveryConfirmedAt: null,
  exceptionRecordedAt: null,
  scheduleSlaHours: 24,
  deliverySlaHours: 72,
  intake: {
    approvedPaLinked: true,
    prescriptionPresent: true,
    assignedPharmacyConfirmed: true,
    therapyMetadataPresent: true,
    handoffDataComplete: true
  },
  clearToFill: {
    benefitsOrClaimCheckCompleted: false,
    prescriptionValid: false,
    prescriberClarificationRequired: false,
    prescriberClarificationResolved: true,
    remsRequired: false,
    remsAuthorizationConfirmed: true,
    inventoryAvailable: false,
    copayOrPaymentReady: false
  },
  shipment: {
    patientContactAttemptDocumented: false,
    addressConfirmed: false,
    deliveryWindowConfirmed: false,
    coldChainRequired: true,
    coldChainPackoutValidated: false,
    courierScheduled: false
  },
  fulfillment: {
    shipped: false,
    deliveryConfirmed: false,
    deliveryAttemptDocumented: false,
    temperatureLogValid: false,
    avoidableFulfillmentException: false,
    externalBlockerDocumented: false,
    exceptionReasonCode: null
  },
  updatedAt: "2026-06-18T10:05:00.000Z"
};

describe("specialty rx case store", () => {
  it("saves, lists, and returns defensive copies", async () => {
    const store = createInMemorySpecialtyRxCaseStore();
    await store.saveCase(caseRecord);

    const listed = await store.listCases();
    listed[0]!.state = "fulfilled";

    await expect(store.getCase(caseRecord.id)).resolves.toMatchObject({
      id: caseRecord.id,
      state: "intake_triage"
    });
  });
});
```

- [ ] **Step 2: Write failing workflow tests**

Create `src/apps/web/lib/specialty-rx-workflow.test.ts` with these core tests:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPaymentIntentId, executePolicyBoundPayment, type PaymentApprovalRequest } from "@operon-labs/hedera-executor";
import { createInMemoryUmPlatform } from "@operon-labs/um-platform";
import { createInMemoryPolicyStore, defaultIncentivePolicies } from "./policy-store";
import { createInMemorySpecialtyRxCaseStore } from "./specialty-rx-store";
import { createSpecialtyRxWorkflow } from "./specialty-rx-workflow";

vi.mock("@operon-labs/hedera-executor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@operon-labs/hedera-executor")>();
  return {
    ...actual,
    executePolicyBoundPayment: vi.fn()
  };
});

const executePolicyBoundPaymentMock = vi.mocked(executePolicyBoundPayment);

describe("specialty rx workflow", () => {
  beforeEach(() => {
    executePolicyBoundPaymentMock.mockReset();
    executePolicyBoundPaymentMock.mockImplementation(async (request: PaymentApprovalRequest) => ({
      status: "simulated",
      network: "testnet",
      transactionId: `testnet-${request.auditId}-${request.currency.toLowerCase()}`,
      runtime: "hedera-agent-kit-policy",
      paymentIntentId: buildPaymentIntentId(request)
    }));
  });

  it("creates fulfillment workqueue cases only from approved pharmacy UM requests", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-RX111111" });
    const caseStore = createInMemorySpecialtyRxCaseStore();
    const workflow = createSpecialtyRxWorkflow(platform, undefined, caseStore);
    const umRequest = platform.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide"
    });
    platform.startClinicalReview(umRequest.id, "reviewer-ana");
    platform.completeClinicalReview(umRequest.id, {
      outcomeStatus: "approved",
      clinicalDocumentationReviewed: true,
      medicalNecessityCriteriaMet: true,
      planPolicyRequirementsChecked: true,
      decisionRationaleDocumented: true,
      approvalReasonCode: "POLICY_CRITERIA_MET"
    });

    const rows = await workflow.listWorkqueue();

    expect(rows).toEqual([
      expect.objectContaining({
        id: "RXF-260526-0900-RX111111",
        umRequestId: umRequest.id,
        state: "intake_triage",
        pharmacyId: "atlas-specialty-rx",
        requestType: "pharmacy_benefit"
      })
    ]);
  });

  it("advances through all four workflow steps and settles a paid fulfillment row", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-RX222222" });
    const caseStore = createInMemorySpecialtyRxCaseStore();
    const workflow = createSpecialtyRxWorkflow(
      platform,
      undefined,
      caseStore,
      createInMemoryPolicyStore({
        specialty_rx_acme_fulfillment_sla: defaultIncentivePolicies.specialty_rx_acme_fulfillment_sla
      })
    );
    const umRequest = platform.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide"
    });
    platform.startClinicalReview(umRequest.id, "reviewer-ana");
    platform.completeClinicalReview(umRequest.id, {
      outcomeStatus: "approved",
      clinicalDocumentationReviewed: true,
      medicalNecessityCriteriaMet: true,
      planPolicyRequirementsChecked: true,
      decisionRationaleDocumented: true
    });
    const [created] = await workflow.listWorkqueue();

    await workflow.completeIntake(created!.id, {
      prescriptionPresent: true,
      assignedPharmacyConfirmed: true,
      therapyMetadataPresent: true,
      handoffDataComplete: true
    });
    await workflow.clearToFill(created!.id, {
      benefitsOrClaimCheckCompleted: true,
      prescriptionValid: true,
      prescriberClarificationRequired: false,
      prescriberClarificationResolved: true,
      remsRequired: false,
      remsAuthorizationConfirmed: true,
      inventoryAvailable: true,
      copayOrPaymentReady: true
    }, new Date("2026-06-18T16:00:00.000Z"));
    await workflow.scheduleShipment(created!.id, {
      patientContactAttemptDocumented: true,
      addressConfirmed: true,
      deliveryWindowConfirmed: true,
      coldChainRequired: true,
      coldChainPackoutValidated: true,
      courierScheduled: true
    }, new Date("2026-06-19T09:30:00.000Z"));
    const fulfilled = await workflow.confirmFulfillment(created!.id, {
      shipped: true,
      deliveryConfirmed: true,
      deliveryAttemptDocumented: true,
      temperatureLogValid: true,
      avoidableFulfillmentException: false,
      externalBlockerDocumented: false,
      exceptionReasonCode: null
    }, new Date("2026-06-20T14:00:00.000Z"));
    const [planRow] = await workflow.listPlanRows();

    expect(fulfilled.state).toBe("fulfilled");
    expect(planRow).toMatchObject({
      fulfillmentCaseId: created!.id,
      umRequestId: umRequest.id,
      businessPolicyStatus: "approved",
      paymentPolicyStatus: "paid",
      incentiveValue: 7,
      reasonCodes: []
    });
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        umRequestId: umRequest.id,
        caseId: umRequest.id,
        businessPolicyId: "specialty-rx-fulfillment-sla-v1",
        triggerEvent: "SPECIALTY_FULFILLMENT_COMPLETED",
        amount: 7,
        walletId: "0.0.9049549"
      }),
      expect.any(Object)
    );
  });

  it("keeps external blockers distinct from avoidable pharmacy exceptions", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-RX333333" });
    const workflow = createSpecialtyRxWorkflow(platform, undefined, createInMemorySpecialtyRxCaseStore());
    const umRequest = platform.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide"
    });
    platform.startClinicalReview(umRequest.id, "reviewer-ana");
    platform.completeClinicalReview(umRequest.id, {
      outcomeStatus: "approved",
      clinicalDocumentationReviewed: true,
      medicalNecessityCriteriaMet: true,
      planPolicyRequirementsChecked: true,
      decisionRationaleDocumented: true
    });
    const [created] = await workflow.listWorkqueue();

    await workflow.completeIntake(created!.id, {
      prescriptionPresent: true,
      assignedPharmacyConfirmed: true,
      therapyMetadataPresent: true,
      handoffDataComplete: true
    });
    await workflow.clearToFill(created!.id, {
      benefitsOrClaimCheckCompleted: true,
      prescriptionValid: true,
      prescriberClarificationRequired: false,
      prescriberClarificationResolved: true,
      remsRequired: false,
      remsAuthorizationConfirmed: true,
      inventoryAvailable: true,
      copayOrPaymentReady: true
    }, new Date("2026-06-18T16:00:00.000Z"));
    await workflow.scheduleShipment(created!.id, {
      patientContactAttemptDocumented: true,
      addressConfirmed: false,
      deliveryWindowConfirmed: false,
      coldChainRequired: true,
      coldChainPackoutValidated: true,
      courierScheduled: false
    }, new Date("2026-06-19T09:30:00.000Z"));
    await workflow.confirmFulfillment(created!.id, {
      shipped: false,
      deliveryConfirmed: false,
      deliveryAttemptDocumented: true,
      temperatureLogValid: true,
      avoidableFulfillmentException: false,
      externalBlockerDocumented: true,
      exceptionReasonCode: "PATIENT_UNREACHABLE"
    }, new Date("2026-06-20T14:00:00.000Z"));
    const [planRow] = await workflow.listPlanRows();

    expect(planRow).toMatchObject({
      state: "exception",
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveValue: 0,
      reasonCodes: ["EXTERNAL_BLOCKER_DOCUMENTED"]
    });
  });
});
```

- [ ] **Step 3: Run workflow tests and verify they fail**

Run:

```bash
npm test -- src/apps/web/lib/specialty-rx-store.test.ts src/apps/web/lib/specialty-rx-workflow.test.ts
```

Expected: FAIL with missing modules.

- [ ] **Step 4: Implement the case store**

Create `src/apps/web/lib/specialty-rx-store.ts` with:

```ts
import type { FirestoreDatabase } from "./pas-persistence";

export type SpecialtyRxStoreBackend = "firestore" | "memory";
export type SpecialtyFulfillmentState = "intake_triage" | "clear_to_fill" | "shipment_scheduled" | "fulfilled" | "exception";

export interface SpecialtyFulfillmentCase {
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
  state: SpecialtyFulfillmentState;
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
  updatedAt: string;
}

export interface SpecialtyRxCaseStore {
  backend: SpecialtyRxStoreBackend;
  saveCase(caseRecord: SpecialtyFulfillmentCase): Promise<void>;
  getCase(fulfillmentCaseId: string): Promise<SpecialtyFulfillmentCase | null>;
  listCases(): Promise<SpecialtyFulfillmentCase[]>;
}
```

Add memory and Firestore implementations in the same file:

```ts
const SPECIALTY_FULFILLMENT_CASES_COLLECTION = "specialtyFulfillmentCases";
const DEFAULT_GCP_PROJECT_ID = "operon-labs-nonprod";
const DEFAULT_FIRESTORE_DATABASE_ID = "(default)";

export function createInMemorySpecialtyRxCaseStore(cases: SpecialtyFulfillmentCase[] = []): SpecialtyRxCaseStore {
  const records = new Map(cases.map((caseRecord) => [caseRecord.id, copyCase(caseRecord)]));

  return {
    backend: "memory",
    async saveCase(caseRecord) {
      records.set(caseRecord.id, copyCase(caseRecord));
    },
    async getCase(fulfillmentCaseId) {
      const caseRecord = records.get(fulfillmentCaseId);
      return caseRecord ? copyCase(caseRecord) : null;
    },
    async listCases() {
      return [...records.values()].map(copyCase).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    }
  };
}

export function createSpecialtyRxCaseStoreFromEnv(env: Record<string, string | undefined> = process.env): SpecialtyRxCaseStore {
  const backend = env.SPECIALTY_RX_STORE_BACKEND?.trim().toLowerCase() || env.PAS_STORE_BACKEND?.trim().toLowerCase() || "firestore";

  if (backend === "memory") {
    return createInMemorySpecialtyRxCaseStore();
  }

  if (backend !== "firestore") {
    throw new Error(`UNSUPPORTED_SPECIALTY_RX_STORE_BACKEND:${backend}`);
  }

  return createFirestoreSpecialtyRxCaseStore({
    projectId: env.GCP_PROJECT_ID?.trim() || env.GOOGLE_CLOUD_PROJECT?.trim() || DEFAULT_GCP_PROJECT_ID,
    databaseId: env.FIRESTORE_DATABASE_ID?.trim() || DEFAULT_FIRESTORE_DATABASE_ID
  });
}

export function createFirestoreSpecialtyRxCaseStore(
  config: { projectId: string; databaseId: string },
  firestore?: FirestoreDatabase
): SpecialtyRxCaseStore {
  let firestoreClient = firestore ?? null;

  async function getFirestore(): Promise<FirestoreDatabase> {
    if (!firestoreClient) {
      const { Firestore } = await import("@google-cloud/firestore");
      firestoreClient = new Firestore({
        projectId: config.projectId,
        databaseId: config.databaseId
      }) as FirestoreDatabase;
    }

    return firestoreClient;
  }

  return {
    backend: "firestore",
    async saveCase(caseRecord) {
      await (await getFirestore()).collection(SPECIALTY_FULFILLMENT_CASES_COLLECTION).doc(caseRecord.id).set(copyCase(caseRecord));
    },
    async getCase(fulfillmentCaseId) {
      const snapshot = await (await getFirestore()).collection(SPECIALTY_FULFILLMENT_CASES_COLLECTION).doc(fulfillmentCaseId).get();
      return snapshot.exists ? normalizeCase(snapshot.data()) : null;
    },
    async listCases() {
      const snapshot = await (await getFirestore()).collection(SPECIALTY_FULFILLMENT_CASES_COLLECTION).get();
      return snapshot.docs
        .map((doc) => normalizeCase(doc.data()))
        .filter((caseRecord): caseRecord is SpecialtyFulfillmentCase => caseRecord !== null)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    }
  };
}

function normalizeCase(value: unknown): SpecialtyFulfillmentCase | null {
  if (!isSpecialtyFulfillmentCase(value)) {
    return null;
  }

  return copyCase(value);
}

function isSpecialtyFulfillmentCase(value: unknown): value is SpecialtyFulfillmentCase {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SpecialtyFulfillmentCase>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.startsWith("RXF-") &&
    typeof candidate.umRequestId === "string" &&
    candidate.umRequestId.startsWith("PA-") &&
    candidate.source === "delegate_um_approved" &&
    candidate.requestType === "pharmacy_benefit" &&
    candidate.codingSystem === "NDC" &&
    typeof candidate.updatedAt === "string"
  );
}

function copyCase(caseRecord: SpecialtyFulfillmentCase): SpecialtyFulfillmentCase {
  return structuredClone(caseRecord);
}
```

- [ ] **Step 5: Implement workflow types and seeding**

Create `src/apps/web/lib/specialty-rx-workflow.ts` with:

```ts
import { createAuditRecord, type AuditRecord } from "@operon-labs/audit-log";
import {
  buildBusinessEvaluationId,
  buildPaymentIntentId,
  executePolicyBoundPayment,
  type PaymentApprovalRequest,
  type PaymentIntentStore
} from "@operon-labs/hedera-executor";
import { evaluateSpecialtyRxFulfillmentEvent, type SpecialtyRxFulfillmentEvidence } from "@operon-labs/incentive-agent";
import type { Currency, SettlementToken } from "@operon-labs/policy-engine";
import { createInMemoryUmPlatform, type UMRequest, type UmPlatform } from "@operon-labs/um-platform";
import { createBusinessEvaluationAttestationStore } from "./business-evaluation-attestation-store";
import { createPasPersistenceStoreFromEnv, type UmPasPersistenceStore } from "./pas-persistence";
import { createPaymentIntentStoreFromEnv } from "./payment-intent-store";
import { createPaymentPolicyStoreFromEnv, type PaymentPlanPolicy, type PaymentPolicyStore } from "./payment-policy-store";
import {
  createPaymentPolicyEvidenceStoreFromEnv,
  type PaymentPolicyControlEvidence,
  type PaymentPolicyEvidenceStore
} from "./payment-policy-evidence-store";
import { createPolicyStoreFromEnv, type PolicyStore } from "./policy-store";
import {
  businessPolicyStatusFromIncentiveStatus,
  paymentPolicyStatusFromPaymentStatus,
  type BusinessPolicyStatus,
  type PaymentPolicyStatus,
  type PolicyCriterionMatch
} from "./provider-documentation-workflow";
import {
  createSpecialtyRxCaseStoreFromEnv,
  type SpecialtyFulfillmentCase,
  type SpecialtyRxCaseStore
} from "./specialty-rx-store";
import { umPlatform } from "./um-platform-singleton";

export type SpecialtyRxSlaStatus = "pending" | "within_sla" | "breached" | "not_applicable";
export type SpecialtyRxIncentiveStatus = "pending" | "not_eligible" | "paid" | "payment_failed";
export type SpecialtyRxPaymentStatus = "pending" | "auto_executed" | "blocked_by_policy" | "execution_failed";

export interface CompleteIntakeInput {
  prescriptionPresent: boolean;
  assignedPharmacyConfirmed: boolean;
  therapyMetadataPresent: boolean;
  handoffDataComplete: boolean;
}

export interface ClearToFillInput {
  benefitsOrClaimCheckCompleted: boolean;
  prescriptionValid: boolean;
  prescriberClarificationRequired: boolean;
  prescriberClarificationResolved: boolean;
  remsRequired: boolean;
  remsAuthorizationConfirmed: boolean;
  inventoryAvailable: boolean;
  copayOrPaymentReady: boolean;
}

export interface ScheduleShipmentInput {
  patientContactAttemptDocumented: boolean;
  addressConfirmed: boolean;
  deliveryWindowConfirmed: boolean;
  coldChainRequired: boolean;
  coldChainPackoutValidated: boolean;
  courierScheduled: boolean;
}

export interface ConfirmFulfillmentInput {
  shipped: boolean;
  deliveryConfirmed: boolean;
  deliveryAttemptDocumented: boolean;
  temperatureLogValid: boolean;
  avoidableFulfillmentException: boolean;
  externalBlockerDocumented: boolean;
  exceptionReasonCode: string | null;
}

export interface SpecialtyRxPlanAuditRow {
  evaluationType: "specialty_rx_fulfillment_sla";
  fulfillmentCase: SpecialtyFulfillmentCase;
  fulfillmentCaseId: string;
  umRequestId: string;
  id: string;
  planId: string;
  pharmacyId: string;
  pharmacyDisplay: string;
  requestType: "pharmacy_benefit";
  serviceLabel: string;
  state: SpecialtyFulfillmentCase["state"];
  clearToFillAt: string | null;
  shipmentScheduledAt: string | null;
  deliveryConfirmedAt: string | null;
  scheduleSlaStatus: SpecialtyRxSlaStatus;
  deliverySlaStatus: SpecialtyRxSlaStatus;
  businessPolicyStatus: BusinessPolicyStatus | null;
  paymentPolicyStatus: PaymentPolicyStatus | null;
  incentiveStatus: SpecialtyRxIncentiveStatus;
  paymentStatus: SpecialtyRxPaymentStatus;
  incentiveValue: number;
  currency: Currency;
  settlementToken: SettlementToken;
  reason: string;
  reasonCodes: string[];
  policyId: string | null;
  policyControls: string[];
  policyCriteria: PolicyCriterionMatch[];
  paymentPolicyId: string | null;
  paymentPolicyControls: PaymentPolicyControlEvidence[];
  audit: AuditRecord | null;
  walletId: string | null;
  paymentIntentId: string | null;
  transactionId: string | null;
}
```

- [ ] **Step 6: Implement workflow API and state transitions**

In the same file, add:

```ts
export interface SpecialtyRxWorkflow {
  listWorkqueue(): Promise<SpecialtyFulfillmentCase[]>;
  listPlanRows(): Promise<SpecialtyRxPlanAuditRow[]>;
  completeIntake(fulfillmentCaseId: string, input: CompleteIntakeInput): Promise<SpecialtyFulfillmentCase>;
  clearToFill(fulfillmentCaseId: string, input: ClearToFillInput, now?: Date): Promise<SpecialtyFulfillmentCase>;
  scheduleShipment(fulfillmentCaseId: string, input: ScheduleShipmentInput, now?: Date): Promise<SpecialtyFulfillmentCase>;
  confirmFulfillment(fulfillmentCaseId: string, input: ConfirmFulfillmentInput, now?: Date): Promise<SpecialtyFulfillmentCase>;
}

const SPECIALTY_PHARMACY_ID = "atlas-specialty-rx";
const SPECIALTY_PHARMACY_DISPLAY = "Atlas Specialty Rx";
const SCHEDULE_SLA_HOURS = 24 as const;
const DELIVERY_SLA_HOURS = 72 as const;

export function createSpecialtyRxWorkflow(
  platform: UmPlatform = createInMemoryUmPlatform(),
  persistence: UmPasPersistenceStore | undefined = createPasPersistenceStoreFromEnv(),
  caseStore: SpecialtyRxCaseStore = createSpecialtyRxCaseStoreFromEnv(),
  policyStore: PolicyStore = createPolicyStoreFromEnv(),
  paymentIntentStore: PaymentIntentStore | undefined = createPaymentIntentStoreFromEnv(),
  paymentPolicyStore: PaymentPolicyStore = createPaymentPolicyStoreFromEnv(),
  paymentPolicyEvidenceStore: PaymentPolicyEvidenceStore | undefined = createPaymentPolicyEvidenceStoreFromEnv()
): SpecialtyRxWorkflow {
  const rows = new Map<string, SpecialtyRxPlanAuditRow>();
  const settlementsInFlight = new Map<string, Promise<SpecialtyRxPlanAuditRow>>();

  async function listRequests(): Promise<UMRequest[]> {
    return persistence ? persistence.listUmRequests() : platform.listUmRequests();
  }

  async function ensureCasesFromApprovedRequests(): Promise<SpecialtyFulfillmentCase[]> {
    const existingCases = await caseStore.listCases();
    const existingByUmRequestId = new Map(existingCases.map((caseRecord) => [caseRecord.umRequestId, caseRecord]));
    const approvedRequests = (await listRequests()).filter(isApprovedPharmacyRequest);

    for (const request of approvedRequests) {
      if (!existingByUmRequestId.has(request.id)) {
        await caseStore.saveCase(buildCaseFromApprovedRequest(request));
      }
    }

    return caseStore.listCases();
  }

  return {
    async listWorkqueue() {
      return (await ensureCasesFromApprovedRequests())
        .filter((caseRecord) => caseRecord.state !== "fulfilled" && caseRecord.state !== "exception")
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    async listPlanRows() {
      const cases = await ensureCasesFromApprovedRequests();
      return cases
        .map((caseRecord) => rows.get(caseRecord.id) ?? buildPendingRow(caseRecord))
        .sort((left, right) => right.fulfillmentCase.updatedAt.localeCompare(left.fulfillmentCase.updatedAt));
    },
    async completeIntake(fulfillmentCaseId, input) {
      const caseRecord = await requireCase(caseStore, fulfillmentCaseId);
      if (caseRecord.state !== "intake_triage") {
        throw new Error(`SPECIALTY_RX_CASE_NOT_IN_INTAKE:${fulfillmentCaseId}`);
      }
      assertIntakeComplete(input);

      const updated = touchCase({
        ...caseRecord,
        state: "clear_to_fill",
        intake: {
          approvedPaLinked: true,
          prescriptionPresent: input.prescriptionPresent,
          assignedPharmacyConfirmed: input.assignedPharmacyConfirmed,
          therapyMetadataPresent: input.therapyMetadataPresent,
          handoffDataComplete: input.handoffDataComplete
        }
      });
      await caseStore.saveCase(updated);
      return updated;
    },
    async clearToFill(fulfillmentCaseId, input, now = new Date()) {
      const caseRecord = await requireCase(caseStore, fulfillmentCaseId);
      if (caseRecord.state !== "clear_to_fill") {
        throw new Error(`SPECIALTY_RX_CASE_NOT_CLEARABLE:${fulfillmentCaseId}`);
      }
      assertClearToFillComplete(input);

      const updated = touchCase({
        ...caseRecord,
        state: "shipment_scheduled",
        clearToFillAt: now.toISOString(),
        clearToFill: input
      });
      await caseStore.saveCase(updated);
      return updated;
    },
    async scheduleShipment(fulfillmentCaseId, input, now = new Date()) {
      const caseRecord = await requireCase(caseStore, fulfillmentCaseId);
      if (caseRecord.state !== "shipment_scheduled" || !caseRecord.clearToFillAt) {
        throw new Error(`SPECIALTY_RX_CASE_NOT_READY_TO_SHIP:${fulfillmentCaseId}`);
      }

      const updated = touchCase({
        ...caseRecord,
        shipmentScheduledAt: now.toISOString(),
        shipment: input
      });
      await caseStore.saveCase(updated);
      return updated;
    },
    async confirmFulfillment(fulfillmentCaseId, input, now = new Date()) {
      const caseRecord = await requireCase(caseStore, fulfillmentCaseId);
      if (caseRecord.state !== "shipment_scheduled" || !caseRecord.clearToFillAt) {
        throw new Error(`SPECIALTY_RX_CASE_NOT_READY_TO_FULFILL:${fulfillmentCaseId}`);
      }

      const terminalState = input.avoidableFulfillmentException || input.externalBlockerDocumented ? "exception" : "fulfilled";
      const updated = touchCase({
        ...caseRecord,
        state: terminalState,
        deliveryConfirmedAt: input.deliveryConfirmed ? now.toISOString() : null,
        exceptionRecordedAt: terminalState === "exception" ? now.toISOString() : null,
        fulfillment: input
      });
      await caseStore.saveCase(updated);

      const row = await settleFulfillment(updated, {
        rows,
        policyStore,
        paymentIntentStore,
        paymentPolicyStore,
        paymentPolicyEvidenceStore
      });
      rows.set(updated.id, row);
      return updated;
    }
  };
}

export const specialtyRxWorkflow = createSpecialtyRxWorkflow(umPlatform);
```

- [ ] **Step 7: Add helpers, evidence, settlement, and row builders**

Continue in `specialty-rx-workflow.ts` with helpers named exactly as used above:

```ts
function isApprovedPharmacyRequest(request: UMRequest): boolean {
  return request.requestType === "pharmacy_benefit" && request.state === "determined" && request.outcomeStatus === "approved";
}

function buildCaseFromApprovedRequest(request: UMRequest): SpecialtyFulfillmentCase {
  const now = new Date().toISOString();
  return {
    id: request.id.replace(/^PA-/, "RXF-"),
    umRequestId: request.id,
    source: "delegate_um_approved",
    planId: request.planId,
    pharmacyId: SPECIALTY_PHARMACY_ID,
    pharmacyDisplay: SPECIALTY_PHARMACY_DISPLAY,
    requestType: "pharmacy_benefit",
    serviceCode: request.serviceCode,
    serviceLabel: request.serviceLabel,
    codingSystem: "NDC",
    billingCode: request.billingCode,
    state: "intake_triage",
    paApprovalReceivedAt: request.determinedAt ?? request.submittedAt,
    intakeStartedAt: now,
    clearToFillAt: null,
    shipmentScheduledAt: null,
    deliveryConfirmedAt: null,
    exceptionRecordedAt: null,
    scheduleSlaHours: SCHEDULE_SLA_HOURS,
    deliverySlaHours: DELIVERY_SLA_HOURS,
    intake: {
      approvedPaLinked: true,
      prescriptionPresent: false,
      assignedPharmacyConfirmed: false,
      therapyMetadataPresent: true,
      handoffDataComplete: false
    },
    clearToFill: {
      benefitsOrClaimCheckCompleted: false,
      prescriptionValid: false,
      prescriberClarificationRequired: false,
      prescriberClarificationResolved: true,
      remsRequired: false,
      remsAuthorizationConfirmed: true,
      inventoryAvailable: false,
      copayOrPaymentReady: false
    },
    shipment: {
      patientContactAttemptDocumented: false,
      addressConfirmed: false,
      deliveryWindowConfirmed: false,
      coldChainRequired: true,
      coldChainPackoutValidated: false,
      courierScheduled: false
    },
    fulfillment: {
      shipped: false,
      deliveryConfirmed: false,
      deliveryAttemptDocumented: false,
      temperatureLogValid: false,
      avoidableFulfillmentException: false,
      externalBlockerDocumented: false,
      exceptionReasonCode: null
    },
    updatedAt: now
  };
}

function buildSpecialtyRxEvidence(caseRecord: SpecialtyFulfillmentCase): SpecialtyRxFulfillmentEvidence {
  return {
    fulfillmentCaseId: caseRecord.id,
    umRequestId: caseRecord.umRequestId,
    planId: caseRecord.planId,
    pharmacyId: caseRecord.pharmacyId,
    requestType: caseRecord.requestType,
    paOutcomeStatus: "approved",
    state: caseRecord.state,
    clearToFillAt: caseRecord.clearToFillAt,
    shipmentScheduledAt: caseRecord.shipmentScheduledAt,
    deliveryConfirmedAt: caseRecord.deliveryConfirmedAt,
    scheduleSlaHours: caseRecord.scheduleSlaHours,
    deliverySlaHours: caseRecord.deliverySlaHours,
    intakeComplete: Object.values(caseRecord.intake).every(Boolean),
    clearToFillComplete: Object.entries(caseRecord.clearToFill).every(([key, value]) => (
      key === "prescriberClarificationRequired" || key === "remsRequired" ? true : value === true
    )),
    shipmentScheduledWithinSla: isWithinSla(caseRecord.clearToFillAt, caseRecord.shipmentScheduledAt, caseRecord.scheduleSlaHours),
    deliveryConfirmedWithinSla: isWithinSla(caseRecord.clearToFillAt, caseRecord.deliveryConfirmedAt, caseRecord.deliverySlaHours),
    remsRequired: caseRecord.clearToFill.remsRequired,
    remsAuthorizationConfirmed: caseRecord.clearToFill.remsAuthorizationConfirmed,
    coldChainRequired: caseRecord.shipment.coldChainRequired,
    coldChainPackoutValidated: caseRecord.shipment.coldChainPackoutValidated,
    temperatureLogValid: caseRecord.fulfillment.temperatureLogValid,
    avoidableFulfillmentException: caseRecord.fulfillment.avoidableFulfillmentException,
    externalBlockerDocumented: caseRecord.fulfillment.externalBlockerDocumented,
    drugChoiceMetricUsed: false,
    fillVolumeMetricUsed: false,
    pharmacySteeringMetricUsed: false,
    patientAdherenceMetricUsed: false,
    containsPhi: false
  };
}
```

For `settleFulfillment`, mirror `settleDetermination` in `delegate-um-workflow.ts` with these specialty-specific values:

```ts
const evidence = buildSpecialtyRxEvidence(caseRecord);
const policies = await dependencies.policyStore.findPolicies({
  evaluationType: "specialty_rx_fulfillment_sla",
  planId: evidence.planId,
  providerId: evidence.pharmacyId,
  requestType: evidence.requestType,
  submittedAt: caseRecord.clearToFillAt ?? caseRecord.paApprovalReceivedAt
});
const evaluation = evaluateSpecialtyRxFulfillmentEvent(
  {
    eventType: "SPECIALTY_FULFILLMENT_COMPLETED",
    fulfillmentCaseId: caseRecord.id,
    umRequestId: caseRecord.umRequestId
  },
  {
    getEvidenceByFulfillmentCaseId: () => evidence,
    policy: policies[0]!,
    monthToDateAmount: 0
  }
);
const businessEvaluationId = buildBusinessEvaluationId({
  umRequestId: caseRecord.umRequestId,
  businessPolicyId: evaluation.result.policyId
});
```

Use `caseRecord.umRequestId` for `PaymentApprovalRequest.umRequestId`, `caseId`, transaction memo identity, and business attestation lookup. Use `caseRecord.id` only in audit row fields and request object.

- [ ] **Step 8: Run workflow tests**

Run:

```bash
npm test -- src/apps/web/lib/specialty-rx-store.test.ts src/apps/web/lib/specialty-rx-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit workflow slice**

Run:

```bash
git add src/apps/web/lib/specialty-rx-store.ts src/apps/web/lib/specialty-rx-store.test.ts src/apps/web/lib/specialty-rx-workflow.ts src/apps/web/lib/specialty-rx-workflow.test.ts
git commit -m "feat: add specialty rx fulfillment workflow"
```

### Task 5: API Routes

**Files:**

- Create: `src/apps/web/app/api/specialty-rx/workqueue/route.ts`
- Create: `src/apps/web/app/api/specialty-rx/plan/route.ts`
- Create: `src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/intake/route.ts`
- Create: `src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/clear-to-fill/route.ts`
- Create: `src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/shipment/route.ts`
- Create: `src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/fulfillment/route.ts`
- Create: route tests next to the app route pattern or add cases to existing app route tests if the repo has nearby route test helpers.

- [ ] **Step 1: Create workqueue route**

Create `src/apps/web/app/api/specialty-rx/workqueue/route.ts`:

```ts
import { NextResponse } from "next/server";
import { specialtyRxWorkflow } from "../../../../lib/specialty-rx-workflow";

export async function GET() {
  return NextResponse.json({
    rows: await specialtyRxWorkflow.listWorkqueue()
  });
}
```

- [ ] **Step 2: Create plan route**

Create `src/apps/web/app/api/specialty-rx/plan/route.ts`:

```ts
import { NextResponse } from "next/server";
import { specialtyRxWorkflow } from "../../../../lib/specialty-rx-workflow";

export async function GET() {
  return NextResponse.json({
    rows: await specialtyRxWorkflow.listPlanRows()
  });
}
```

- [ ] **Step 3: Create intake route**

Create `src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/intake/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { specialtyRxWorkflow, type CompleteIntakeInput } from "../../../../../../../lib/specialty-rx-workflow";

interface RouteContext {
  params: Promise<{
    fulfillmentCaseId: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { fulfillmentCaseId } = await context.params;
    const input = (await request.json()) as CompleteIntakeInput;
    return NextResponse.json(await specialtyRxWorkflow.completeIntake(fulfillmentCaseId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SPECIALTY_RX_INTAKE_FAILED" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 4: Create clear-to-fill route**

Create `src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/clear-to-fill/route.ts` using the same context shape:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { specialtyRxWorkflow, type ClearToFillInput } from "../../../../../../../lib/specialty-rx-workflow";

interface RouteContext {
  params: Promise<{
    fulfillmentCaseId: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { fulfillmentCaseId } = await context.params;
    const input = (await request.json()) as ClearToFillInput;
    return NextResponse.json(await specialtyRxWorkflow.clearToFill(fulfillmentCaseId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SPECIALTY_RX_CLEAR_TO_FILL_FAILED" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 5: Create shipment and fulfillment routes**

Create shipment route:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { specialtyRxWorkflow, type ScheduleShipmentInput } from "../../../../../../../lib/specialty-rx-workflow";

interface RouteContext {
  params: Promise<{
    fulfillmentCaseId: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { fulfillmentCaseId } = await context.params;
    const input = (await request.json()) as ScheduleShipmentInput;
    return NextResponse.json(await specialtyRxWorkflow.scheduleShipment(fulfillmentCaseId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SPECIALTY_RX_SHIPMENT_FAILED" },
      { status: 400 }
    );
  }
}
```

Create fulfillment route:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { specialtyRxWorkflow, type ConfirmFulfillmentInput } from "../../../../../../../lib/specialty-rx-workflow";

interface RouteContext {
  params: Promise<{
    fulfillmentCaseId: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { fulfillmentCaseId } = await context.params;
    const input = (await request.json()) as ConfirmFulfillmentInput;
    return NextResponse.json(await specialtyRxWorkflow.confirmFulfillment(fulfillmentCaseId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SPECIALTY_RX_FULFILLMENT_FAILED" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 6: Add route smoke tests**

Add file-source smoke tests matching the existing route test style:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("specialty rx API routes", () => {
  it("uses specialty rx workflow APIs instead of generic payment routes", () => {
    const route = readFileSync(
      path.join(process.cwd(), "src/apps/web/app/api/specialty-rx/cases/[fulfillmentCaseId]/fulfillment/route.ts"),
      "utf8"
    );

    expect(route).toContain("specialtyRxWorkflow.confirmFulfillment");
    expect(route).not.toContain("/api/payments/approve");
  });
});
```

Save as `src/apps/web/lib/specialty-rx-routes.test.ts`.

- [ ] **Step 7: Run route tests**

Run:

```bash
npm test -- src/apps/web/lib/specialty-rx-routes.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit route slice**

Run:

```bash
git add src/apps/web/app/api/specialty-rx src/apps/web/lib/specialty-rx-routes.test.ts
git commit -m "feat: add specialty rx workflow routes"
```

### Task 6: Specialty Pharmacy Operator UI

**Files:**

- Create: `src/apps/web/app/specialty-rx/page.tsx`
- Create: `src/apps/web/components/specialty-rx/SpecialtyRxConsole.tsx`
- Create: `src/apps/web/components/specialty-rx/SpecialtyRxWorkflowModal.tsx`
- Create: `src/apps/web/components/specialty-rx/SpecialtyRxUseCaseNavigation.tsx`
- Create: `src/apps/web/components/specialty-rx/specialty-rx-formatters.ts`
- Create: `src/apps/web/components/specialty-rx/SpecialtyRxConsole.test.tsx`
- Modify: `src/apps/web/app/styles.css`

- [ ] **Step 1: Create formatters**

Create `src/apps/web/components/specialty-rx/specialty-rx-formatters.ts`:

```ts
import type { SpecialtyFulfillmentCase } from "../../lib/specialty-rx-store";
import type { SpecialtyRxPlanAuditRow } from "../../lib/specialty-rx-workflow";

export function formatFulfillmentState(state: SpecialtyFulfillmentCase["state"]): string {
  switch (state) {
    case "intake_triage":
      return "Intake & Triage";
    case "clear_to_fill":
      return "Clear To Fill";
    case "shipment_scheduled":
      return "Shipment Scheduled";
    case "fulfilled":
      return "Fulfilled";
    case "exception":
      return "Exception";
  }
}

export function formatSlaStatus(status: SpecialtyRxPlanAuditRow["scheduleSlaStatus"]): string {
  switch (status) {
    case "within_sla":
      return "Within SLA";
    case "breached":
      return "Breached";
    case "not_applicable":
      return "Not applicable";
    case "pending":
      return "Pending";
  }
}

export function specialtySlaBadgeVariant(status: SpecialtyRxPlanAuditRow["scheduleSlaStatus"]): "info" | "success" | "warning" | "neutral" {
  if (status === "within_sla") {
    return "success";
  }
  if (status === "breached") {
    return "warning";
  }
  if (status === "not_applicable") {
    return "neutral";
  }
  return "info";
}
```

- [ ] **Step 2: Create use-case navigation**

Create `src/apps/web/components/specialty-rx/SpecialtyRxUseCaseNavigation.tsx`:

```tsx
import Link from "next/link";

type SpecialtyRxUseCaseView = "pharmacy" | "plan" | "policies";

export function SpecialtyRxUseCaseNavigation({
  activeView,
  fulfillmentCaseId
}: {
  activeView: SpecialtyRxUseCaseView;
  fulfillmentCaseId?: string | null;
}) {
  const planHref = fulfillmentCaseId ? `/specialty-rx/plan?fulfillmentCaseId=${encodeURIComponent(fulfillmentCaseId)}` : "/specialty-rx/plan";

  return (
    <nav className="use-case-nav" aria-label="Specialty Rx use case views">
      <Link aria-current={activeView === "pharmacy" ? "page" : undefined} href="/specialty-rx">
        Specialty Pharmacy View
      </Link>
      <Link aria-current={activeView === "plan" ? "page" : undefined} href={planHref}>
        Health Plan View
      </Link>
      <Link aria-current={activeView === "policies" ? "page" : undefined} href="/specialty-rx/policies">
        Policies View
      </Link>
    </nav>
  );
}
```

- [ ] **Step 3: Create operator console test**

Create `src/apps/web/components/specialty-rx/SpecialtyRxConsole.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpecialtyRxWorkflowModal } from "./SpecialtyRxWorkflowModal";
import type { SpecialtyFulfillmentCase } from "../../lib/specialty-rx-store";

const caseRecord: SpecialtyFulfillmentCase = {
  id: "RXF-260526-0900-DELEGATE",
  umRequestId: "PA-260526-0900-DELEGATE",
  source: "delegate_um_approved",
  planId: "acme-health-ppo",
  pharmacyId: "atlas-specialty-rx",
  pharmacyDisplay: "Atlas Specialty Rx",
  requestType: "pharmacy_benefit",
  serviceCode: "wegovy_semaglutide",
  serviceLabel: "Wegovy semaglutide",
  codingSystem: "NDC",
  billingCode: "0169-4525-14",
  state: "intake_triage",
  paApprovalReceivedAt: "2026-06-18T10:00:00.000Z",
  intakeStartedAt: "2026-06-18T10:05:00.000Z",
  clearToFillAt: null,
  shipmentScheduledAt: null,
  deliveryConfirmedAt: null,
  exceptionRecordedAt: null,
  scheduleSlaHours: 24,
  deliverySlaHours: 72,
  intake: {
    approvedPaLinked: true,
    prescriptionPresent: false,
    assignedPharmacyConfirmed: false,
    therapyMetadataPresent: true,
    handoffDataComplete: false
  },
  clearToFill: {
    benefitsOrClaimCheckCompleted: false,
    prescriptionValid: false,
    prescriberClarificationRequired: false,
    prescriberClarificationResolved: true,
    remsRequired: false,
    remsAuthorizationConfirmed: true,
    inventoryAvailable: false,
    copayOrPaymentReady: false
  },
  shipment: {
    patientContactAttemptDocumented: false,
    addressConfirmed: false,
    deliveryWindowConfirmed: false,
    coldChainRequired: true,
    coldChainPackoutValidated: false,
    courierScheduled: false
  },
  fulfillment: {
    shipped: false,
    deliveryConfirmed: false,
    deliveryAttemptDocumented: false,
    temperatureLogValid: false,
    avoidableFulfillmentException: false,
    externalBlockerDocumented: false,
    exceptionReasonCode: null
  },
  updatedAt: "2026-06-18T10:05:00.000Z"
};

describe("SpecialtyRxWorkflowModal", () => {
  it("declares the four specialty pharmacy workflow steps", () => {
    render(<SpecialtyRxWorkflowModal caseRecord={caseRecord} onClose={() => undefined} onUpdated={() => undefined} />);

    expect(screen.getByText("Intake & Triage")).toBeTruthy();
    expect(screen.getByText("Clear To Fill")).toBeTruthy();
    expect(screen.getByText("Schedule Shipment")).toBeTruthy();
    expect(screen.getByText("Confirm Fulfillment")).toBeTruthy();
  });
});
```

- [ ] **Step 4: Create workflow modal**

Create `src/apps/web/components/specialty-rx/SpecialtyRxWorkflowModal.tsx` with the four visible step sections. Use controlled checkbox state and submit to the API route for the current case state:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { LabsBadge } from "../labs-ui";
import type { SpecialtyFulfillmentCase } from "../../lib/specialty-rx-store";
import { formatFulfillmentState } from "./specialty-rx-formatters";

export function SpecialtyRxWorkflowModal({
  caseRecord,
  onClose,
  onUpdated
}: {
  caseRecord: SpecialtyFulfillmentCase;
  onClose: () => void;
  onUpdated: (caseRecord: SpecialtyFulfillmentCase) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  async function postStep(path: string, body: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/specialty-rx/cases/${encodeURIComponent(caseRecord.id)}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as SpecialtyFulfillmentCase | { error?: string };
      if (!response.ok || !("id" in payload)) {
        setError("error" in payload && payload.error ? payload.error : "Unable to update fulfillment case");
        return;
      }
      onUpdated(payload);
    } catch {
      setError("Unable to update fulfillment case");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop audit-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-modal="true"
        aria-labelledby="specialty-rx-title"
        className="modal plan-audit-modal specialty-rx-modal"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-toolbar">
          <div>
            <span className="eyebrow">Specialty pharmacy fulfillment</span>
            <h2 id="specialty-rx-title">{caseRecord.serviceLabel}</h2>
            <p className="delegate-review-id-line">
              <span>{caseRecord.id}</span>
              <LabsBadge variant="info">{formatFulfillmentState(caseRecord.state)}</LabsBadge>
            </p>
          </div>
          <button ref={closeButtonRef} className="row-action" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {error ? <p className="error-text" role="alert">{error}</p> : null}

        <ol className="stepper compact-stepper specialty-rx-stepper" aria-label="Specialty pharmacy steps">
          {["Intake & Triage", "Clear To Fill", "Schedule Shipment", "Confirm Fulfillment"].map((label) => (
            <li key={label} className={stepClassName(caseRecord, label)}>
              <strong>{label.slice(0, 1)}</strong>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        {caseRecord.state === "intake_triage" ? (
          <section className="delegate-review-section">
            <h3>Intake & Triage</h3>
            <p>Confirm the downstream case has the approved PA, prescription, assigned pharmacy, therapy details, and handoff data needed to start fulfillment.</p>
            <button
              className="primary-button"
              disabled={submitting}
              type="button"
              onClick={() => void postStep("intake", {
                prescriptionPresent: true,
                assignedPharmacyConfirmed: true,
                therapyMetadataPresent: true,
                handoffDataComplete: true
              })}
            >
              Complete Intake & Triage
            </button>
          </section>
        ) : null}

        {caseRecord.state === "clear_to_fill" ? (
          <section className="delegate-review-section">
            <h3>Clear To Fill</h3>
            <p>Resolve benefit, prescription, prescriber, REMS, inventory, and payment readiness blockers before the fulfillment SLA starts.</p>
            <button
              className="primary-button"
              disabled={submitting}
              type="button"
              onClick={() => void postStep("clear-to-fill", {
                benefitsOrClaimCheckCompleted: true,
                prescriptionValid: true,
                prescriberClarificationRequired: false,
                prescriberClarificationResolved: true,
                remsRequired: false,
                remsAuthorizationConfirmed: true,
                inventoryAvailable: true,
                copayOrPaymentReady: true
              })}
            >
              Mark Clear To Fill
            </button>
          </section>
        ) : null}

        {caseRecord.state === "shipment_scheduled" && !caseRecord.shipmentScheduledAt ? (
          <section className="delegate-review-section">
            <h3>Schedule Shipment</h3>
            <p>Document contact attempt, address, delivery window, cold-chain handling, and courier scheduling.</p>
            <button
              className="primary-button"
              disabled={submitting}
              type="button"
              onClick={() => void postStep("shipment", {
                patientContactAttemptDocumented: true,
                addressConfirmed: true,
                deliveryWindowConfirmed: true,
                coldChainRequired: true,
                coldChainPackoutValidated: true,
                courierScheduled: true
              })}
            >
              Schedule Shipment
            </button>
          </section>
        ) : null}

        {caseRecord.state === "shipment_scheduled" && caseRecord.shipmentScheduledAt ? (
          <section className="delegate-review-section">
            <h3>Confirm Fulfillment</h3>
            <p>Record delivery evidence, temperature log status, and exception classification.</p>
            <button
              className="primary-button"
              disabled={submitting}
              type="button"
              onClick={() => void postStep("fulfillment", {
                shipped: true,
                deliveryConfirmed: true,
                deliveryAttemptDocumented: true,
                temperatureLogValid: true,
                avoidableFulfillmentException: false,
                externalBlockerDocumented: false,
                exceptionReasonCode: null
              })}
            >
              Confirm Fulfillment
            </button>
          </section>
        ) : null}
      </section>
    </div>
  );
}

function stepClassName(caseRecord: SpecialtyFulfillmentCase, label: string): string {
  const activeByState: Record<SpecialtyFulfillmentCase["state"], string> = {
    intake_triage: "Intake & Triage",
    clear_to_fill: "Clear To Fill",
    shipment_scheduled: caseRecord.shipmentScheduledAt ? "Confirm Fulfillment" : "Schedule Shipment",
    fulfilled: "Confirm Fulfillment",
    exception: "Confirm Fulfillment"
  };
  return activeByState[caseRecord.state] === label ? "active" : "";
}
```

- [ ] **Step 5: Create operator console and page**

Create `src/apps/web/components/specialty-rx/SpecialtyRxConsole.tsx` modeled after `DelegateVendorConsole.tsx`, using `/api/specialty-rx/workqueue`, table title `Specialty fulfillment workqueue`, and row action `Open workflow`.

Create `src/apps/web/app/specialty-rx/page.tsx`:

```tsx
import { SpecialtyRxConsole } from "../../components/specialty-rx/SpecialtyRxConsole";

export const dynamic = "force-dynamic";

export default function SpecialtyRxPage() {
  return <SpecialtyRxConsole />;
}
```

- [ ] **Step 6: Add focused styles**

Append to `src/apps/web/app/styles.css`:

```css
.specialty-rx-modal {
  max-width: 980px;
  overflow: visible;
}

.specialty-rx-stepper {
  margin-bottom: 20px;
}

.specialty-rx-console .hero p {
  max-width: 780px;
}
```

- [ ] **Step 7: Run UI tests**

Run:

```bash
npm test -- src/apps/web/components/specialty-rx/SpecialtyRxConsole.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit operator UI**

Run:

```bash
git add src/apps/web/app/specialty-rx/page.tsx src/apps/web/components/specialty-rx src/apps/web/app/styles.css
git commit -m "feat: add specialty rx pharmacy workflow UI"
```

### Task 7: Plan View, Policies View, And Docs

**Files:**

- Create: `src/apps/web/app/specialty-rx/plan/page.tsx`
- Create: `src/apps/web/app/specialty-rx/policies/page.tsx`
- Create: `src/apps/web/components/specialty-rx/SpecialtyRxPlanConsole.tsx`
- Create: `src/apps/web/components/specialty-rx/SpecialtyRxPlanDetailsModal.tsx`
- Create: `src/apps/web/components/specialty-rx/SpecialtyRxPlanConsole.test.tsx`
- Modify: `src/apps/web/lib/policy-view-model.ts`
- Modify: `src/apps/web/lib/policy-view-model.test.ts`
- Modify: `README.md`
- Modify: `docs/Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md`

- [ ] **Step 1: Add plan console test**

Create `src/apps/web/components/specialty-rx/SpecialtyRxPlanConsole.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpecialtyRxPlanDetailsModal } from "./SpecialtyRxPlanDetailsModal";
import type { SpecialtyRxPlanAuditRow } from "../../lib/specialty-rx-workflow";

const row: SpecialtyRxPlanAuditRow = {
  evaluationType: "specialty_rx_fulfillment_sla",
  fulfillmentCase: {} as SpecialtyRxPlanAuditRow["fulfillmentCase"],
  fulfillmentCaseId: "RXF-260526-0900-DELEGATE",
  umRequestId: "PA-260526-0900-DELEGATE",
  id: "ie_specialty",
  planId: "acme-health-ppo",
  pharmacyId: "atlas-specialty-rx",
  pharmacyDisplay: "Atlas Specialty Rx",
  requestType: "pharmacy_benefit",
  serviceLabel: "Wegovy semaglutide",
  state: "fulfilled",
  clearToFillAt: "2026-06-18T16:00:00.000Z",
  shipmentScheduledAt: "2026-06-19T09:30:00.000Z",
  deliveryConfirmedAt: "2026-06-20T14:00:00.000Z",
  scheduleSlaStatus: "within_sla",
  deliverySlaStatus: "within_sla",
  businessPolicyStatus: "approved",
  paymentPolicyStatus: "paid",
  incentiveStatus: "paid",
  paymentStatus: "auto_executed",
  incentiveValue: 7,
  currency: "HBAR",
  settlementToken: { symbol: "HBAR" },
  reason: "Fulfillment completed within SLA",
  reasonCodes: [],
  policyId: "specialty-rx-fulfillment-sla-v1",
  policyControls: ["Contracted specialty pharmacy wallet"],
  policyCriteria: [],
  paymentPolicyId: "acme-health-ppo",
  paymentPolicyControls: [],
  audit: null,
  walletId: "0.0.9049549",
  paymentIntentId: "pi_specialty",
  transactionId: "0.0.123@1.2"
};

describe("SpecialtyRxPlanDetailsModal", () => {
  it("shows fulfillment timestamps, SLA statuses, and policy separation", () => {
    const markup = renderToStaticMarkup(<SpecialtyRxPlanDetailsModal row={row} onClose={() => undefined} />);

    expect(markup).toContain("RXF-260526-0900-DELEGATE");
    expect(markup).toContain("PA-260526-0900-DELEGATE");
    expect(markup).toContain("Clear To Fill");
    expect(markup).toContain("Business policy");
    expect(markup).toContain("Payment policy");
  });
});
```

- [ ] **Step 2: Create plan console and details modal**

Implement `SpecialtyRxPlanConsole.tsx` by mirroring `DelegatePlanConsole.tsx`, but use:

```ts
interface SpecialtyRxRowsResponse {
  rows: SpecialtyRxPlanAuditRow[];
}

const response = await fetch("/api/specialty-rx/plan", {
  cache: "no-store"
});
```

Columns:

- Fulfillment case ID
- Linked PA
- Pharmacy
- State
- Schedule SLA
- Delivery SLA
- Business Policy
- Payment Policy
- Action

Create `SpecialtyRxPlanDetailsModal.tsx` with sections:

- Case identity
- Linked UM request
- Fulfillment timestamps
- Fulfillment evidence
- Business policy
- Payment policy

- [ ] **Step 3: Create plan page**

Create `src/apps/web/app/specialty-rx/plan/page.tsx`:

```tsx
import { SpecialtyRxPlanConsole } from "../../../components/specialty-rx/SpecialtyRxPlanConsole";

export const dynamic = "force-dynamic";

export default function SpecialtyRxPlanPage({
  searchParams
}: {
  searchParams: Promise<{ fulfillmentCaseId?: string }>;
}) {
  return searchParams.then((params) => (
    <SpecialtyRxPlanConsole initialFulfillmentCaseId={params.fulfillmentCaseId ?? null} />
  ));
}
```

- [ ] **Step 4: Create policies page**

Create `src/apps/web/app/specialty-rx/policies/page.tsx`:

```tsx
import { PolicyConsole } from "../../../components/provider-documentation/PolicyConsole";
import { SpecialtyRxUseCaseNavigation } from "../../../components/specialty-rx/SpecialtyRxUseCaseNavigation";
import { specialtyRxFulfillmentBusinessPolicyType } from "../../../lib/policy-view-model";
import { paymentPolicyStore } from "../../../lib/payment-policy-store";
import { policyStore } from "../../../lib/policy-store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Specialty Rx Fulfillment SLA policies",
  description: "Read-only specialty pharmacy fulfillment SLA and Hedera Agent Kit policy catalog."
};

export default async function SpecialtyRxPoliciesPage() {
  const businessPolicies = await policyStore.listPolicies(specialtyRxFulfillmentBusinessPolicyType);
  const paymentPolicies = await paymentPolicyStore.listPolicies();

  return (
    <PolicyConsole
      activeNavigation={<SpecialtyRxUseCaseNavigation activeView="policies" />}
      businessPolicies={businessPolicies}
      businessPolicyDescription="Business contract policies define specialty pharmacy fulfillment SLA criteria after an approved pharmacy PA. Drug choice, fill volume, adherence, and steering metrics are excluded from payout."
      boundaryStatement="Specialty Rx policies reward contracted post-approval operating milestones only. Payment policies remain plan-level Hedera Agent Kit settlement controls before any approved payment leaves the treasury."
      eyebrow="Specialty Rx policy catalog"
      paymentPolicies={paymentPolicies}
      paymentPolicyDescription="Payment policies remain plan-level Hedera Agent Kit settlement controls selected from centrally maintained payment policy blocks."
      title="Specialty Rx fulfillment policies"
    />
  );
}
```

- [ ] **Step 5: Add policy view model support**

In `src/apps/web/lib/policy-view-model.ts`, export:

```ts
export const specialtyRxFulfillmentBusinessPolicyType = "specialty_rx_fulfillment_sla";
```

Where policy descriptions or criteria labels are mapped, add labels for:

```ts
requiresShipmentScheduledWithinSla: "Shipment scheduled within SLA",
requiresDeliveryConfirmedWithinSla: "Delivery confirmed within SLA",
requiresColdChainEvidenceWhenRequired: "Cold-chain evidence required when applicable",
requiresRemsAuthorizationWhenRequired: "REMS authorization required when applicable",
prohibitsAvoidableFulfillmentException: "No avoidable fulfillment exception"
```

Add a test in `src/apps/web/lib/policy-view-model.test.ts` asserting that the specialty policy view contains `Specialty Rx Fulfillment SLA`, `Cold-chain evidence`, and `No avoidable fulfillment exception`.

- [ ] **Step 6: Update docs**

In `README.md`, replace the provider-directory route line:

```md
- `/specialty-rx` - specialty pharmacy fulfillment SLA workflow
- `/specialty-rx/plan` - health-plan audit console for specialty fulfillment incentives
- `/specialty-rx/policies` - specialty fulfillment business and payment policy catalog
```

In `docs/Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md`, replace the Provider Directory section with:

```md
### Demo App 3: Specialty Rx Fulfillment SLA

Business purpose: reward a contracted specialty pharmacy for clean post-approval fulfillment execution after an approved pharmacy prior authorization.

Workflow:

1. Intake & Triage
2. Clear To Fill
3. Schedule Shipment
4. Confirm Fulfillment

Policy guardrails:

- incentive starts from clear-to-fill execution readiness
- no drug-choice, fill-volume, adherence, savings, or pharmacy-steering payout basis
- cold-chain add-on is a handling complexity adjustment
- external blockers are separated from avoidable pharmacy exceptions
- no PHI appears in settlement metadata
```

- [ ] **Step 7: Run plan/policy/doc tests**

Run:

```bash
npm test -- src/apps/web/components/specialty-rx/SpecialtyRxPlanConsole.test.tsx src/apps/web/lib/policy-view-model.test.ts src/apps/web/components/demo-catalog.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit plan and policy UI slice**

Run:

```bash
git add src/apps/web/app/specialty-rx/plan/page.tsx src/apps/web/app/specialty-rx/policies/page.tsx src/apps/web/components/specialty-rx src/apps/web/lib/policy-view-model.ts src/apps/web/lib/policy-view-model.test.ts README.md docs/Operon_Labs_Contract_Incentives_Hedera_Bounty_Scope.md
git commit -m "feat: add specialty rx plan and policy views"
```

### Task 8: Full Verification And Browser QA

**Files:**

- Modify only files needed to fix verification failures found in this task.

- [ ] **Step 1: Run the full automated suite**

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 2: Start the local dev server**

Run:

```bash
npm run dev:simulated
```

Expected: Next.js starts on a local port. Keep the session running for browser QA.

- [ ] **Step 3: Browser verify the catalog**

Open the app in the in-app browser and verify:

- Home page shows `Specialty Rx Fulfillment SLA`.
- Home page does not show `Provider Directory Data Quality`.
- `/specialty-rx` renders a specialty pharmacy workqueue page.
- `/specialty-rx/plan` renders the health-plan specialty fulfillment audit page.
- `/specialty-rx/policies` renders the specialty policy catalog.

- [ ] **Step 4: Browser verify the full normal path**

Using simulated settlement mode:

- Submit a pharmacy-benefit PA through `/provider-documentation`.
- Complete the linked review in `/delegate-um` as approved.
- Open `/specialty-rx` and confirm the linked `RXF-*` case appears.
- Complete Intake & Triage.
- Complete Clear To Fill.
- Schedule Shipment.
- Confirm Fulfillment.
- Open `/specialty-rx/plan` and confirm the row is business-policy approved and payment-policy paid.

- [ ] **Step 5: Browser verify responsive layout**

Check desktop and mobile viewport screenshots for:

- no overlapping text in the workqueue tables
- modal stepper labels fit
- action buttons fit on mobile
- policy catalog text does not overflow cards or modal rows

- [ ] **Step 6: Stop dev server**

Stop the dev server session with `Ctrl-C`.

- [ ] **Step 7: Commit verification fixes**

If verification required fixes, commit them:

```bash
git status --short
git add src/apps/web/app/styles.css src/apps/web/components/specialty-rx src/apps/web/app/specialty-rx src/apps/web/lib/specialty-rx-workflow.ts src/apps/web/lib/specialty-rx-store.ts
git commit -m "fix: polish specialty rx fulfillment verification"
```

If the verification fixes touched a different Specialty Rx file, stage that exact file instead of the broad path above. If no fixes were required, do not create an empty commit.

---

## Execution Notes

- Keep the main chat as the controller for this repo. If using subagents, each worker gets one task and must not spawn nested agents.
- Do not change Provider Documentation or Delegate UM behavior except where tests prove the Specialty Rx chain needs the linked approved pharmacy PA.
- Use `caseRecord.umRequestId` as the settlement identity and Hedera transaction memo path. Use `fulfillmentCaseId` for UI, workflow, and evidence traceability.
- Keep `Provider Directory Data Quality` out of the catalog and route list after this implementation.
- Keep Appeals Packet Quality as dormant exception-path context.

## Plan Self-Review

- Spec coverage: the plan covers `SpecialtyFulfillmentCase`, workqueue, the four visible workflow steps, plan view, policies view, policy evidence, error states, catalog replacement, docs, and verification.
- Completeness scan: the plan names concrete files, identifiers, commands, route paths, and policy fields.
- Type consistency: the plan uses `specialty_rx_fulfillment_sla`, `SpecialtyFulfillmentCase`, `RXF-*`, `PA-*`, `atlas-specialty-rx`, `clearToFillAt`, `shipmentScheduledWithinSla`, and `deliveryConfirmedWithinSla` consistently across policy, agent, workflow, routes, and UI.
