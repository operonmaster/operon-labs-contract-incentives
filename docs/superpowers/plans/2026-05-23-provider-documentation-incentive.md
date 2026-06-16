# Provider Documentation Incentive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the forked provider-documentation prior-auth demo with a separate plan-side incentives worklist driven by simulated `PAS_SUBMITTED` events.

**Architecture:** Keep the first implementation inside the existing Next.js/npm workspace, but preserve logical boundaries. The provider portal submits PA requests through a synthetic UM Platform package; the UM Platform emits `PAS_SUBMITTED`; the incentive agent receives only `{ eventType, caseId }`, pulls policy-safe evidence from the UM Platform by PA ID, evaluates policy, and the plan-side console approves eligible payments.

**Tech Stack:** Next.js App Router, React client components, TypeScript, npm workspaces, Vitest, existing `@operon-labs/policy-engine`, `@operon-labs/incentive-agent`, `@operon-labs/audit-log`, and `@operon-labs/hedera-executor`.

---

## File Structure

- Create `src/packages/um-platform/package.json`: workspace package manifest.
- Create `src/packages/um-platform/src/index.ts`: synthetic UM Platform domain model, CRD/DTR/PAS submission rules, in-memory state helpers, and evidence API functions.
- Create `src/packages/um-platform/test/provider-documentation.test.ts`: TDD coverage for service fork, acknowledgement, PAS events, and evidence shape.
- Modify `tsconfig.json`: add path alias for `@operon-labs/um-platform`.
- Modify `src/packages/incentive-agent/src/index.ts`: add provider-documentation event evaluation that pulls evidence by `caseId`; update provider policy required evidence and reason codes.
- Create `src/packages/incentive-agent/test/provider-documentation-event.test.ts`: tests proving the agent receives only event metadata, pulls evidence, approves knee MRI, and blocks full-body MRI with zero value.
- Create `src/apps/web/lib/provider-documentation-workflow.ts`: app-level singleton orchestration for UM submissions, event processing, plan worklist rows, details, and payment approval.
- Create `src/apps/web/lib/provider-documentation-workflow.test.ts`: tests for event processing and payment approval rules.
- Create `src/apps/web/app/api/um/prior-auths/route.ts`: `POST` PA submission and `GET` submitted PA list.
- Create `src/apps/web/app/api/um/prior-auths/[caseId]/evidence/route.ts`: policy-safe evidence endpoint.
- Create `src/apps/web/app/api/provider-documentation/incentives/route.ts`: plan worklist endpoint.
- Create `src/apps/web/app/api/provider-documentation/incentives/[caseId]/approve/route.ts`: plan approval endpoint.
- Replace `src/apps/web/app/provider-documentation/page.tsx`: render dedicated provider portal route instead of generic `DemoPage`.
- Create `src/apps/web/app/provider-documentation/incentives/page.tsx`: render plan-side incentives route.
- Create `src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx`: client-side provider wizard.
- Create `src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx`: client-side plan worklist and detail panel.
- Modify `src/apps/web/app/styles.css`: add compact operational UI styles for wizard, readiness rail, worklist, details, and buttons.
- Modify `README.md`: document the two-page provider-documentation demo flow.

---

## Task 1: Synthetic UM Platform Package

**Files:**
- Create: `src/packages/um-platform/package.json`
- Create: `src/packages/um-platform/src/index.ts`
- Create: `src/packages/um-platform/test/provider-documentation.test.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Write the failing UM Platform tests**

Create `src/packages/um-platform/test/provider-documentation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createInMemoryUmPlatform,
  getCoverageRequirements,
  type PriorAuthSubmissionInput
} from "../src/index";

describe("provider documentation UM Platform", () => {
  it("returns covered PA-required CRD requirements for knee MRI", () => {
    expect(getCoverageRequirements("knee_mri")).toMatchObject({
      serviceCode: "knee_mri",
      coveredBenefit: true,
      priorAuthRequired: true,
      documentationTemplateId: "knee-mri-pa-dtr-v1",
      reasonCode: null
    });
  });

  it("returns not-covered CRD requirements for full-body wellness MRI", () => {
    expect(getCoverageRequirements("full_body_wellness_mri")).toMatchObject({
      serviceCode: "full_body_wellness_mri",
      coveredBenefit: false,
      priorAuthRequired: true,
      documentationTemplateId: null,
      reasonCode: "BENEFIT_NOT_COVERED"
    });
  });

  it("requires acknowledgement before full-body wellness MRI submission", () => {
    const platform = createInMemoryUmPlatform();
    const input: PriorAuthSubmissionInput = {
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: false
    };

    expect(() => platform.submitPriorAuth(input)).toThrow("NOT_COVERED_ACKNOWLEDGEMENT_REQUIRED");
  });

  it("submits knee MRI and exposes policy-safe evidence", () => {
    const platform = createInMemoryUmPlatform();

    const submitted = platform.submitPriorAuth({
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    expect(submitted).toMatchObject({
      caseId: "synthetic-pa-20931",
      serviceCode: "knee_mri",
      paResult: "submitted_pending"
    });
    expect(platform.listEvents()).toEqual([
      {
        eventType: "PAS_SUBMITTED",
        caseId: "synthetic-pa-20931"
      }
    ]);
    expect(platform.getEvidence("synthetic-pa-20931")).toMatchObject({
      caseId: "synthetic-pa-20931",
      serviceCode: "knee_mri",
      crdCoverageChecked: true,
      crdCoveredBenefit: true,
      dtrTemplateCompleted: true,
      attachmentChecklistComplete: true,
      fhirFieldsPresent: true,
      pasSubmitted: true,
      submittedBeforeInitialDecision: true,
      approvalOutcomeUsed: false,
      referralVolumeMetricUsed: false,
      containsPhi: false
    });
  });

  it("submits full-body wellness MRI with denial reason and zero-eligible evidence", () => {
    const platform = createInMemoryUmPlatform();
    platform.submitPriorAuth({
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    const submitted = platform.submitPriorAuth({
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });

    expect(submitted).toMatchObject({
      caseId: "synthetic-pa-20932",
      serviceCode: "full_body_wellness_mri",
      paResult: "denied_not_covered",
      denialReason: "BENEFIT_NOT_COVERED"
    });
    expect(platform.getEvidence("synthetic-pa-20932")).toMatchObject({
      serviceCode: "full_body_wellness_mri",
      crdCoveredBenefit: false,
      pasSubmitted: true,
      denialReason: "BENEFIT_NOT_COVERED"
    });
  });
});
```

- [ ] **Step 2: Run the UM Platform tests and verify they fail**

Run:

```bash
npm test -- src/packages/um-platform/test/provider-documentation.test.ts
```

Expected: FAIL with module resolution errors because `src/packages/um-platform/src/index.ts` does not exist yet.

- [ ] **Step 3: Add the UM Platform package manifest**

Create `src/packages/um-platform/package.json`:

```json
{
  "name": "@operon-labs/um-platform",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

- [ ] **Step 4: Add the UM Platform implementation**

Create `src/packages/um-platform/src/index.ts`:

```ts
export type ServiceCode = "knee_mri" | "full_body_wellness_mri";
export type PaResult = "submitted_pending" | "denied_not_covered";
export type PasEventType = "PAS_SUBMITTED";

export interface CoverageRequirements {
  serviceCode: ServiceCode;
  serviceLabel: string;
  coveredBenefit: boolean;
  priorAuthRequired: boolean;
  documentationTemplateId: string | null;
  requiredDocumentation: string[];
  reasonCode: "BENEFIT_NOT_COVERED" | null;
}

export interface DtrAnswers {
  symptomDurationConfirmed: boolean;
  conservativeTherapyConfirmed: boolean;
  examFindingsConfirmed: boolean;
  clinicalNoteAttached: boolean;
}

export interface PriorAuthSubmissionInput {
  serviceCode: ServiceCode;
  dtr?: DtrAnswers;
  acknowledgedNotCovered?: boolean;
}

export interface PriorAuthRecord {
  caseId: string;
  patientId: "patient-maya-chen";
  patientDisplay: "Maya Chen";
  providerGroupId: "lakeside-provider-admin";
  providerGroupDisplay: "Lakeside Provider Admin";
  serviceCode: ServiceCode;
  serviceLabel: string;
  submittedAt: string;
  coverage: CoverageRequirements;
  dtr: DtrAnswers | null;
  pasSubmitted: true;
  submittedBeforeInitialDecision: boolean;
  paResult: PaResult;
  denialReason: "BENEFIT_NOT_COVERED" | null;
}

export interface PasSubmittedEvent {
  eventType: PasEventType;
  caseId: string;
}

export interface ProviderDocumentationEvidence {
  caseId: string;
  submitter: {
    type: "provider_admin_team";
    id: "lakeside-provider-admin";
  };
  serviceCode: ServiceCode;
  crdCoverageChecked: boolean;
  crdCoveredBenefit: boolean;
  dtrTemplateCompleted: boolean;
  attachmentChecklistComplete: boolean;
  fhirFieldsPresent: boolean;
  pasSubmitted: boolean;
  submittedBeforeInitialDecision: boolean;
  paResult: PaResult;
  denialReason: "BENEFIT_NOT_COVERED" | null;
  paResultUsedForPositivePayment: false;
  approvalOutcomeUsed: false;
  referralVolumeMetricUsed: false;
  containsPhi: false;
}

export interface UmPlatform {
  submitPriorAuth(input: PriorAuthSubmissionInput): PriorAuthRecord;
  listPriorAuths(): PriorAuthRecord[];
  listEvents(): PasSubmittedEvent[];
  getEvidence(caseId: string): ProviderDocumentationEvidence | null;
}

export function getCoverageRequirements(serviceCode: ServiceCode): CoverageRequirements {
  if (serviceCode === "knee_mri") {
    return {
      serviceCode,
      serviceLabel: "Knee MRI after injury",
      coveredBenefit: true,
      priorAuthRequired: true,
      documentationTemplateId: "knee-mri-pa-dtr-v1",
      requiredDocumentation: [
        "Symptom duration",
        "Conservative therapy tried",
        "Physical exam findings",
        "Clinical note attachment"
      ],
      reasonCode: null
    };
  }

  return {
    serviceCode,
    serviceLabel: "Full-body wellness MRI screening",
    coveredBenefit: false,
    priorAuthRequired: true,
    documentationTemplateId: null,
    requiredDocumentation: [],
    reasonCode: "BENEFIT_NOT_COVERED"
  };
}

export function createInMemoryUmPlatform(): UmPlatform {
  const records = new Map<string, PriorAuthRecord>();
  const events: PasSubmittedEvent[] = [];
  let nextSequence = 20931;

  return {
    submitPriorAuth(input) {
      const coverage = getCoverageRequirements(input.serviceCode);

      if (input.serviceCode === "knee_mri" && !isCompleteDtr(input.dtr)) {
        throw new Error("DTR_DOCUMENTATION_INCOMPLETE");
      }

      if (input.serviceCode === "full_body_wellness_mri" && input.acknowledgedNotCovered !== true) {
        throw new Error("NOT_COVERED_ACKNOWLEDGEMENT_REQUIRED");
      }

      const caseId = `synthetic-pa-${nextSequence}`;
      nextSequence += 1;

      const record: PriorAuthRecord = {
        caseId,
        patientId: "patient-maya-chen",
        patientDisplay: "Maya Chen",
        providerGroupId: "lakeside-provider-admin",
        providerGroupDisplay: "Lakeside Provider Admin",
        serviceCode: input.serviceCode,
        serviceLabel: coverage.serviceLabel,
        submittedAt: new Date().toISOString(),
        coverage,
        dtr: input.dtr ?? null,
        pasSubmitted: true,
        submittedBeforeInitialDecision: true,
        paResult: coverage.coveredBenefit ? "submitted_pending" : "denied_not_covered",
        denialReason: coverage.coveredBenefit ? null : "BENEFIT_NOT_COVERED"
      };

      records.set(caseId, record);
      events.push({ eventType: "PAS_SUBMITTED", caseId });
      return record;
    },
    listPriorAuths() {
      return Array.from(records.values());
    },
    listEvents() {
      return [...events];
    },
    getEvidence(caseId) {
      const record = records.get(caseId);
      if (!record) {
        return null;
      }

      const dtrComplete = record.serviceCode === "knee_mri" ? isCompleteDtr(record.dtr) : false;

      return {
        caseId: record.caseId,
        submitter: {
          type: "provider_admin_team",
          id: "lakeside-provider-admin"
        },
        serviceCode: record.serviceCode,
        crdCoverageChecked: true,
        crdCoveredBenefit: record.coverage.coveredBenefit,
        dtrTemplateCompleted: dtrComplete,
        attachmentChecklistComplete: dtrComplete,
        fhirFieldsPresent: dtrComplete,
        pasSubmitted: record.pasSubmitted,
        submittedBeforeInitialDecision: record.submittedBeforeInitialDecision,
        paResult: record.paResult,
        denialReason: record.denialReason,
        paResultUsedForPositivePayment: false,
        approvalOutcomeUsed: false,
        referralVolumeMetricUsed: false,
        containsPhi: false
      };
    }
  };
}

function isCompleteDtr(dtr: DtrAnswers | null | undefined): boolean {
  return (
    dtr?.symptomDurationConfirmed === true &&
    dtr.conservativeTherapyConfirmed === true &&
    dtr.examFindingsConfirmed === true &&
    dtr.clinicalNoteAttached === true
  );
}
```

- [ ] **Step 5: Add the TypeScript path alias**

Modify `tsconfig.json` paths:

```json
"@operon-labs/um-platform": ["src/packages/um-platform/src/index.ts"]
```

Keep the existing aliases unchanged.

- [ ] **Step 6: Run the UM Platform tests and verify they pass**

Run:

```bash
npm test -- src/packages/um-platform/test/provider-documentation.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 7: Commit Task 1**

```bash
git add tsconfig.json src/packages/um-platform
git commit -m "feat: add synthetic um platform package"
```

---

## Task 2: Provider Documentation Event Evaluation In Incentive Agent

**Files:**
- Modify: `src/packages/incentive-agent/src/index.ts`
- Create: `src/packages/incentive-agent/test/provider-documentation-event.test.ts`

- [ ] **Step 1: Write the failing incentive-agent tests**

Create `src/packages/incentive-agent/test/provider-documentation-event.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createInMemoryUmPlatform } from "@operon-labs/um-platform";
import { evaluateProviderDocumentationEvent } from "../src/index";

describe("evaluateProviderDocumentationEvent", () => {
  it("pulls evidence by caseId and approves complete knee MRI documentation", () => {
    const platform = createInMemoryUmPlatform();
    const priorAuth = platform.submitPriorAuth({
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const getEvidence = vi.fn(platform.getEvidence);

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "PAS_SUBMITTED", caseId: priorAuth.caseId },
      { getEvidenceByCaseId: getEvidence, monthToDateAmount: 0 }
    );

    expect(getEvidence).toHaveBeenCalledWith("synthetic-pa-20931");
    expect(evaluation.request.requestObject).toMatchObject({
      caseId: "synthetic-pa-20931",
      crdCoveredBenefit: true,
      dtrTemplateCompleted: true,
      pasSubmitted: true
    });
    expect(evaluation.result).toMatchObject({
      decision: "approved",
      amount: 3,
      currency: "USDC",
      walletId: "0.0.23456",
      reasonCodes: []
    });
  });

  it("blocks full-body wellness MRI with zero incentive", () => {
    const platform = createInMemoryUmPlatform();
    const priorAuth = platform.submitPriorAuth({
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "PAS_SUBMITTED", caseId: priorAuth.caseId },
      { getEvidenceByCaseId: platform.getEvidence, monthToDateAmount: 0 }
    );

    expect(evaluation.result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: expect.arrayContaining([
        "SERVICE_NOT_COVERED",
        "DTR_TEMPLATE_INCOMPLETE",
        "ATTACHMENT_CHECKLIST_INCOMPLETE",
        "FHIR_FIELDS_MISSING"
      ])
    });
  });

  it("rejects non-PAS events before evidence lookup", () => {
    const getEvidence = vi.fn();

    expect(() =>
      evaluateProviderDocumentationEvent(
        { eventType: "OTHER_EVENT", caseId: "synthetic-pa-99999" },
        { getEvidenceByCaseId: getEvidence, monthToDateAmount: 0 }
      )
    ).toThrow("UNSUPPORTED_PROVIDER_DOCUMENTATION_EVENT");
    expect(getEvidence).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
npm test -- src/packages/incentive-agent/test/provider-documentation-event.test.ts
```

Expected: FAIL because `evaluateProviderDocumentationEvent` does not exist.

- [ ] **Step 3: Add provider-documentation event types and policy**

In `src/packages/incentive-agent/src/index.ts`, import UM evidence types:

```ts
import type { ProviderDocumentationEvidence, PasSubmittedEvent } from "@operon-labs/um-platform";
```

Add these exports near the existing interfaces:

```ts
export interface ProviderDocumentationEvaluationDependencies {
  getEvidenceByCaseId: (caseId: string) => ProviderDocumentationEvidence | null;
  monthToDateAmount?: number;
}
```

Replace the current `provider_documentation_completeness` policy in `demoPolicies` with:

```ts
provider_documentation_completeness: {
  id: "provider-documentation-completeness-v1",
  evaluationType: "provider_documentation_completeness",
  currency: "USDC",
  submitterRules: {
    allowedSubmitterTypes: ["provider_admin_team"],
    allowedSubmitters: ["lakeside-provider-admin"],
    walletMap: {
      "lakeside-provider-admin": "0.0.23456"
    }
  },
  requiredEvidence: [
    "caseId",
    "crdCoverageChecked",
    "crdCoveredBenefit",
    "dtrTemplateCompleted",
    "attachmentChecklistComplete",
    "fhirFieldsPresent",
    "pasSubmitted",
    "submittedBeforeInitialDecision",
    "paResultUsedForPositivePayment",
    "approvalOutcomeUsed",
    "referralVolumeMetricUsed",
    "containsPhi"
  ],
  approvalRules: [
    { field: "crdCoverageChecked", operator: "equals", value: true, reasonCode: "CRD_COVERAGE_NOT_CHECKED" },
    { field: "crdCoveredBenefit", operator: "equals", value: true, reasonCode: "SERVICE_NOT_COVERED" },
    { field: "dtrTemplateCompleted", operator: "equals", value: true, reasonCode: "DTR_TEMPLATE_INCOMPLETE" },
    { field: "attachmentChecklistComplete", operator: "equals", value: true, reasonCode: "ATTACHMENT_CHECKLIST_INCOMPLETE" },
    { field: "fhirFieldsPresent", operator: "equals", value: true, reasonCode: "FHIR_FIELDS_MISSING" },
    { field: "pasSubmitted", operator: "equals", value: true, reasonCode: "PAS_NOT_SUBMITTED" },
    { field: "submittedBeforeInitialDecision", operator: "equals", value: true, reasonCode: "SUBMITTED_AFTER_INITIAL_DECISION" },
    { field: "paResultUsedForPositivePayment", operator: "equals", value: false, reasonCode: "PROHIBITED_PA_RESULT_METRIC" },
    { field: "approvalOutcomeUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_OUTCOME_METRIC" },
    { field: "referralVolumeMetricUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_REFERRAL_VOLUME_METRIC" },
    { field: "containsPhi", operator: "equals", value: false, reasonCode: "PHI_BLOCKED" }
  ],
  paymentFormula: { baseAmount: 3, maxPerRequest: 3, monthlyCap: 300 },
  requiresHumanApproval: true
}
```

Replace the current `provider_documentation_completeness` request in `demoRequests` with:

```ts
provider_documentation_completeness: {
  evaluationType: "provider_documentation_completeness",
  submitter: { type: "provider_admin_team", id: "lakeside-provider-admin" },
  requestObject: {
    caseId: "synthetic-pa-20931",
    serviceCode: "knee_mri",
    crdCoverageChecked: true,
    crdCoveredBenefit: true,
    dtrTemplateCompleted: true,
    attachmentChecklistComplete: true,
    fhirFieldsPresent: true,
    pasSubmitted: true,
    submittedBeforeInitialDecision: true,
    paResultUsedForPositivePayment: false,
    approvalOutcomeUsed: false,
    referralVolumeMetricUsed: false,
    containsPhi: false
  }
}
```

- [ ] **Step 4: Add the event evaluation function**

Add this function to `src/packages/incentive-agent/src/index.ts`:

```ts
export function evaluateProviderDocumentationEvent(
  event: PasSubmittedEvent | { eventType: string; caseId: string },
  dependencies: ProviderDocumentationEvaluationDependencies
): DemoEvaluation {
  if (event.eventType !== "PAS_SUBMITTED") {
    throw new Error("UNSUPPORTED_PROVIDER_DOCUMENTATION_EVENT");
  }

  const evidence = dependencies.getEvidenceByCaseId(event.caseId);
  if (!evidence) {
    throw new Error(`PROVIDER_DOCUMENTATION_EVIDENCE_NOT_FOUND:${event.caseId}`);
  }

  const policy = demoPolicies.provider_documentation_completeness;
  const request: EvaluationRequest = {
    evaluationType: "provider_documentation_completeness",
    submitter: evidence.submitter,
    requestObject: {
      caseId: evidence.caseId,
      serviceCode: evidence.serviceCode,
      crdCoverageChecked: evidence.crdCoverageChecked,
      crdCoveredBenefit: evidence.crdCoveredBenefit,
      dtrTemplateCompleted: evidence.dtrTemplateCompleted,
      attachmentChecklistComplete: evidence.attachmentChecklistComplete,
      fhirFieldsPresent: evidence.fhirFieldsPresent,
      pasSubmitted: evidence.pasSubmitted,
      submittedBeforeInitialDecision: evidence.submittedBeforeInitialDecision,
      paResultUsedForPositivePayment: evidence.paResultUsedForPositivePayment,
      approvalOutcomeUsed: evidence.approvalOutcomeUsed,
      referralVolumeMetricUsed: evidence.referralVolumeMetricUsed,
      containsPhi: evidence.containsPhi
    }
  };

  const result = evaluatePolicy({
    policy,
    request,
    monthToDateAmount: dependencies.monthToDateAmount ?? 0
  });

  return {
    request,
    policy,
    result,
    explanation: explainDecision(result)
  };
}
```

- [ ] **Step 5: Run the incentive-agent tests and verify they pass**

Run:

```bash
npm test -- src/packages/incentive-agent/test/provider-documentation-event.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Run existing policy tests**

Run:

```bash
npm test -- src/packages/policy-engine/test/evaluate-policy.test.ts
```

Expected: PASS, existing tests unchanged.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/packages/incentive-agent
git commit -m "feat: evaluate provider documentation events"
```

---

## Task 3: Web Workflow Orchestration And API Routes

**Files:**
- Create: `src/apps/web/lib/provider-documentation-workflow.ts`
- Create: `src/apps/web/lib/provider-documentation-workflow.test.ts`
- Create: `src/apps/web/app/api/um/prior-auths/route.ts`
- Create: `src/apps/web/app/api/um/prior-auths/[caseId]/evidence/route.ts`
- Create: `src/apps/web/app/api/provider-documentation/incentives/route.ts`
- Create: `src/apps/web/app/api/provider-documentation/incentives/[caseId]/approve/route.ts`

- [ ] **Step 1: Write the failing workflow tests**

Create `src/apps/web/lib/provider-documentation-workflow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createProviderDocumentationWorkflow } from "./provider-documentation-workflow";

describe("provider documentation workflow", () => {
  it("submits knee MRI and creates an eligible pending incentive row", () => {
    const workflow = createProviderDocumentationWorkflow();

    const submitted = workflow.submitPriorAuth({
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const rows = workflow.listIncentiveRows();

    expect(submitted.caseId).toBe("synthetic-pa-20931");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      caseId: "synthetic-pa-20931",
      serviceLabel: "Knee MRI after injury",
      paResult: "submitted_pending",
      incentiveStatus: "eligible_pending_approval",
      incentiveValue: 3,
      currency: "USDC",
      reason: "Complete DTR + PAS before cutoff"
    });
  });

  it("submits full-body wellness MRI and creates a zero-value not-eligible row", () => {
    const workflow = createProviderDocumentationWorkflow();

    workflow.submitPriorAuth({
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });
    const rows = workflow.listIncentiveRows();

    expect(rows[0]).toMatchObject({
      serviceLabel: "Full-body wellness MRI screening",
      paResult: "denied_not_covered",
      incentiveStatus: "not_eligible",
      incentiveValue: 0,
      currency: "USDC",
      reason: "Non-covered benefit"
    });
  });

  it("approves payment only for eligible pending rows", async () => {
    const workflow = createProviderDocumentationWorkflow();

    workflow.submitPriorAuth({
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const paid = await workflow.approvePayment("synthetic-pa-20931");

    expect(paid).toMatchObject({
      caseId: "synthetic-pa-20931",
      incentiveStatus: "paid",
      incentiveValue: 3
    });
    expect(paid.transactionId).toContain("testnet-");
  });

  it("blocks payment approval for zero-value rows", async () => {
    const workflow = createProviderDocumentationWorkflow();

    workflow.submitPriorAuth({
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });

    await expect(workflow.approvePayment("synthetic-pa-20931")).rejects.toThrow("PAYMENT_NOT_ELIGIBLE");
  });
});
```

- [ ] **Step 2: Run the workflow tests and verify they fail**

Run:

```bash
npm test -- src/apps/web/lib/provider-documentation-workflow.test.ts
```

Expected: FAIL because `provider-documentation-workflow.ts` does not exist.

- [ ] **Step 3: Implement the workflow module**

Create `src/apps/web/lib/provider-documentation-workflow.ts`:

```ts
import { createAuditRecord, type AuditRecord } from "@operon-labs/audit-log";
import { executeApprovedPayment } from "@operon-labs/hedera-executor";
import { evaluateProviderDocumentationEvent } from "@operon-labs/incentive-agent";
import {
  createInMemoryUmPlatform,
  getCoverageRequirements,
  type DtrAnswers,
  type PriorAuthRecord,
  type PriorAuthSubmissionInput,
  type ProviderDocumentationEvidence,
  type ServiceCode,
  type UmPlatform
} from "@operon-labs/um-platform";

export type IncentiveStatus = "eligible_pending_approval" | "not_eligible" | "paid";

export interface IncentiveWorklistRow {
  caseId: string;
  submittedAt: string;
  providerGroupDisplay: string;
  serviceLabel: string;
  serviceCode: ServiceCode;
  paResult: PriorAuthRecord["paResult"];
  denialReason: PriorAuthRecord["denialReason"];
  incentiveStatus: IncentiveStatus;
  incentiveValue: number;
  currency: "USDC";
  reason: string;
  reasonCodes: string[];
  policyId: string;
  audit: AuditRecord;
  walletId: string | null;
  transactionId: string | null;
}

export interface ProviderDocumentationWorkflow {
  getCoverageRequirements: typeof getCoverageRequirements;
  submitPriorAuth(input: PriorAuthSubmissionInput): PriorAuthRecord;
  listPriorAuths(): PriorAuthRecord[];
  getEvidence(caseId: string): ProviderDocumentationEvidence | null;
  listIncentiveRows(): IncentiveWorklistRow[];
  getIncentiveRow(caseId: string): IncentiveWorklistRow | null;
  approvePayment(caseId: string): Promise<IncentiveWorklistRow>;
}

export function createProviderDocumentationWorkflow(platform: UmPlatform = createInMemoryUmPlatform()): ProviderDocumentationWorkflow {
  const rows = new Map<string, IncentiveWorklistRow>();

  function processRecord(record: PriorAuthRecord): IncentiveWorklistRow {
    const existing = rows.get(record.caseId);
    if (existing?.incentiveStatus === "paid") {
      return existing;
    }

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "PAS_SUBMITTED", caseId: record.caseId },
      { getEvidenceByCaseId: platform.getEvidence, monthToDateAmount: 0 }
    );
    const audit = createAuditRecord({
      request: evaluation.request,
      result: evaluation.result,
      transactionId: existing?.transactionId ?? null
    });
    const row: IncentiveWorklistRow = {
      caseId: record.caseId,
      submittedAt: record.submittedAt,
      providerGroupDisplay: record.providerGroupDisplay,
      serviceLabel: record.serviceLabel,
      serviceCode: record.serviceCode,
      paResult: record.paResult,
      denialReason: record.denialReason,
      incentiveStatus: evaluation.result.decision === "approved" ? "eligible_pending_approval" : "not_eligible",
      incentiveValue: evaluation.result.amount,
      currency: "USDC",
      reason: summarizeReason(record, evaluation.result.reasonCodes),
      reasonCodes: evaluation.result.reasonCodes,
      policyId: evaluation.result.policyId,
      audit,
      walletId: evaluation.result.walletId,
      transactionId: existing?.transactionId ?? null
    };

    rows.set(record.caseId, row);
    return row;
  }

  return {
    getCoverageRequirements,
    submitPriorAuth(input) {
      const record = platform.submitPriorAuth(input);
      processRecord(record);
      return record;
    },
    listPriorAuths() {
      return platform.listPriorAuths();
    },
    getEvidence(caseId) {
      return platform.getEvidence(caseId);
    },
    listIncentiveRows() {
      for (const record of platform.listPriorAuths()) {
        processRecord(record);
      }
      return Array.from(rows.values()).sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    },
    getIncentiveRow(caseId) {
      const record = platform.listPriorAuths().find((candidate) => candidate.caseId === caseId);
      return record ? processRecord(record) : null;
    },
    async approvePayment(caseId) {
      const row = this.getIncentiveRow(caseId);
      if (!row || row.incentiveStatus !== "eligible_pending_approval" || !row.walletId) {
        throw new Error("PAYMENT_NOT_ELIGIBLE");
      }

      const payment = await executeApprovedPayment({
        auditId: row.audit.id,
        amount: row.incentiveValue,
        currency: row.currency,
        walletId: row.walletId
      });
      const paid: IncentiveWorklistRow = {
        ...row,
        incentiveStatus: "paid",
        reason: "Hedera transaction recorded",
        transactionId: payment.transactionId,
        audit: {
          ...row.audit,
          transactionId: payment.transactionId
        }
      };

      rows.set(caseId, paid);
      return paid;
    }
  };
}

export const providerDocumentationWorkflow = createProviderDocumentationWorkflow();

function summarizeReason(record: PriorAuthRecord, reasonCodes: string[]): string {
  if (record.denialReason === "BENEFIT_NOT_COVERED") {
    return "Non-covered benefit";
  }

  if (reasonCodes.length === 0) {
    return "Complete DTR + PAS before cutoff";
  }

  if (reasonCodes.includes("DTR_TEMPLATE_INCOMPLETE") || reasonCodes.includes("ATTACHMENT_CHECKLIST_INCOMPLETE")) {
    return "Missing required documentation";
  }

  return reasonCodes.join(", ");
}
```

- [ ] **Step 4: Run the workflow tests and verify they pass**

Run:

```bash
npm test -- src/apps/web/lib/provider-documentation-workflow.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Add UM submission API route**

Create `src/apps/web/app/api/um/prior-auths/route.ts`:

```ts
import { NextResponse } from "next/server";
import { providerDocumentationWorkflow } from "../../../../lib/provider-documentation-workflow";
import type { PriorAuthSubmissionInput } from "@operon-labs/um-platform";

export async function GET() {
  return NextResponse.json(providerDocumentationWorkflow.listPriorAuths());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isPriorAuthSubmissionInput(body)) {
    return NextResponse.json({ error: "INVALID_PRIOR_AUTH_SUBMISSION" }, { status: 400 });
  }

  try {
    const submitted = providerDocumentationWorkflow.submitPriorAuth(body);
    return NextResponse.json(submitted);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PRIOR_AUTH_SUBMISSION_FAILED" },
      { status: 400 }
    );
  }
}

function isPriorAuthSubmissionInput(value: unknown): value is PriorAuthSubmissionInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.serviceCode === "knee_mri" || candidate.serviceCode === "full_body_wellness_mri";
}
```

- [ ] **Step 6: Add UM evidence API route**

Create `src/apps/web/app/api/um/prior-auths/[caseId]/evidence/route.ts`:

```ts
import { NextResponse } from "next/server";
import { providerDocumentationWorkflow } from "../../../../../../lib/provider-documentation-workflow";

export async function GET(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const evidence = providerDocumentationWorkflow.getEvidence(caseId);

  if (!evidence) {
    return NextResponse.json({ error: "EVIDENCE_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(evidence);
}
```

- [ ] **Step 7: Add incentives worklist API route**

Create `src/apps/web/app/api/provider-documentation/incentives/route.ts`:

```ts
import { NextResponse } from "next/server";
import { providerDocumentationWorkflow } from "../../../../lib/provider-documentation-workflow";

export async function GET() {
  return NextResponse.json({
    rows: providerDocumentationWorkflow.listIncentiveRows()
  });
}
```

- [ ] **Step 8: Add payment approval API route**

Create `src/apps/web/app/api/provider-documentation/incentives/[caseId]/approve/route.ts`:

```ts
import { NextResponse } from "next/server";
import { providerDocumentationWorkflow } from "../../../../../../lib/provider-documentation-workflow";

export async function POST(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;

  try {
    const row = await providerDocumentationWorkflow.approvePayment(caseId);
    return NextResponse.json(row);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PAYMENT_APPROVAL_FAILED" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 9: Run workflow tests and typecheck**

Run:

```bash
npm test -- src/apps/web/lib/provider-documentation-workflow.test.ts
npm run typecheck
```

Expected: both commands PASS.

- [ ] **Step 10: Commit Task 3**

```bash
git add src/apps/web/lib src/apps/web/app/api/um src/apps/web/app/api/provider-documentation
git commit -m "feat: add provider documentation workflow APIs"
```

---

## Task 4: Provider Portal Wizard Page

**Files:**
- Modify: `src/apps/web/app/provider-documentation/page.tsx`
- Create: `src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx`
- Modify: `src/apps/web/app/styles.css`

- [ ] **Step 1: Replace the route with a dedicated provider portal page**

Modify `src/apps/web/app/provider-documentation/page.tsx`:

```tsx
import { ProviderDocumentationWizard } from "../../components/provider-documentation/ProviderDocumentationWizard";

export default function ProviderDocumentationPage() {
  return <ProviderDocumentationWizard />;
}
```

- [ ] **Step 2: Create the provider wizard client component**

Create `src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DtrAnswers, PriorAuthRecord, ServiceCode } from "@operon-labs/um-platform";

const completeDtr: DtrAnswers = {
  symptomDurationConfirmed: true,
  conservativeTherapyConfirmed: true,
  examFindingsConfirmed: true,
  clinicalNoteAttached: true
};

export function ProviderDocumentationWizard() {
  const [serviceCode, setServiceCode] = useState<ServiceCode | null>(null);
  const [coverageChecked, setCoverageChecked] = useState(false);
  const [dtrComplete, setDtrComplete] = useState(false);
  const [acknowledgedNotCovered, setAcknowledgedNotCovered] = useState(false);
  const [submitted, setSubmitted] = useState<PriorAuthRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isKneeMri = serviceCode === "knee_mri";
  const isFullBody = serviceCode === "full_body_wellness_mri";
  const readiness = useMemo(() => {
    const items = [
      { label: "Coverage requirements checked", complete: coverageChecked },
      { label: "DTR documentation complete", complete: isKneeMri && dtrComplete },
      { label: "Attachments ready", complete: isKneeMri && dtrComplete },
      { label: "PAS submitted before cutoff", complete: submitted !== null }
    ];
    return items;
  }, [coverageChecked, dtrComplete, isKneeMri, submitted]);

  async function submitPriorAuth() {
    setError(null);
    const body =
      serviceCode === "knee_mri"
        ? { serviceCode, dtr: completeDtr }
        : { serviceCode, acknowledgedNotCovered };

    const response = await fetch("/api/um/prior-auths", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to submit prior authorization");
      return;
    }

    setSubmitted(payload);
  }

  return (
    <main className="workspace">
      <Link className="back" href="/">
        Back to demos
      </Link>
      <section className="hero compact">
        <span className="eyebrow">Provider portal</span>
        <h1>New prior authorization</h1>
        <p>Submit a synthetic PA request while CRD and DTR keep documentation complete before PAS submission.</p>
      </section>

      <div className="two-column">
        <section className="panel">
          <h2>Case setup</h2>
          <div className="summary-grid">
            <div><span className="label">Patient</span><strong>Maya Chen</strong></div>
            <div><span className="label">Ordering provider</span><strong>Dr. Elena Ruiz</strong></div>
            <div><span className="label">Facility</span><strong>Lakeside Imaging Center</strong></div>
            <div><span className="label">Plan</span><strong>Acme Health PPO</strong></div>
          </div>

          <div className="choice-grid">
            <button className={`choice ${serviceCode === "knee_mri" ? "selected" : ""}`} onClick={() => {
              setServiceCode("knee_mri");
              setCoverageChecked(false);
              setSubmitted(null);
            }}>
              <strong>Knee MRI after injury</strong>
              <span>Covered service, PA required, DTR documentation available.</span>
            </button>
            <button className={`choice ${serviceCode === "full_body_wellness_mri" ? "selected" : ""}`} onClick={() => {
              setServiceCode("full_body_wellness_mri");
              setCoverageChecked(false);
              setSubmitted(null);
            }}>
              <strong>Full-body wellness MRI screening</strong>
              <span>Not covered benefit; provider may acknowledge and submit anyway.</span>
            </button>
          </div>

          <button className="primary-button" disabled={!serviceCode} onClick={() => setCoverageChecked(true)}>
            Check coverage requirements
          </button>
        </section>

        <aside className="panel">
          <h2>Documentation completeness</h2>
          <ol className="checklist">
            {readiness.map((item) => (
              <li key={item.label} className={item.complete ? "complete" : ""}>{item.label}</li>
            ))}
          </ol>
        </aside>
      </div>

      {coverageChecked && isKneeMri ? (
        <section className="panel">
          <h2>CRD result</h2>
          <span className="status approved">Covered service - PA required</span>
          <p>Documentation required: symptom duration, conservative therapy, exam findings, and clinical note attachment.</p>
          <button className="primary-button" onClick={() => setDtrComplete(true)}>Complete DTR documentation</button>
        </section>
      ) : null}

      {coverageChecked && isFullBody ? (
        <section className="panel warning-panel">
          <h2>CRD result</h2>
          <span className="status blocked">Not covered benefit</span>
          <p>Full-body wellness MRI screening without symptoms is not covered by this plan. The PA can still be submitted with a not-covered denial reason.</p>
          <label className="checkbox-row">
            <input type="checkbox" checked={acknowledgedNotCovered} onChange={(event) => setAcknowledgedNotCovered(event.target.checked)} />
            Acknowledge and submit anyway
          </label>
        </section>
      ) : null}

      {coverageChecked ? (
        <section className="panel">
          <h2>PAS submission</h2>
          <p>{isKneeMri ? "Review the complete DTR packet and submit PAS." : "Submit the PA with the non-covered benefit reason."}</p>
          <button
            className="primary-button"
            disabled={(isKneeMri && !dtrComplete) || (isFullBody && !acknowledgedNotCovered) || submitted !== null}
            onClick={submitPriorAuth}
          >
            Submit prior authorization
          </button>
          {error ? <p className="error-text">{error}</p> : null}
          {submitted ? (
            <div className="result-box">
              <strong>Prior authorization submitted</strong>
              <p>PA ID: {submitted.caseId}</p>
              <p>Status: {submitted.paResult === "denied_not_covered" ? "Denied - not covered benefit" : "Submitted / pending"}</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 3: Add provider wizard styles**

Append to `src/apps/web/app/styles.css`:

```css
.workspace {
  max-width: 1240px;
}

.hero.compact h1 {
  font-size: clamp(34px, 5vw, 52px);
}

.two-column {
  align-items: start;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) 340px;
}

.summary-grid,
.choice-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
}

.label {
  color: var(--muted);
  display: block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.choice,
.primary-button {
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
}

.choice {
  background: #fff;
  border: 1px solid var(--line);
  color: var(--ink);
  display: grid;
  gap: 8px;
  padding: 16px;
  text-align: left;
}

.choice span {
  color: var(--muted);
}

.choice.selected {
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(36, 87, 214, 0.12);
}

.primary-button {
  background: var(--blue);
  border: 0;
  color: white;
  font-weight: 700;
  padding: 10px 14px;
  width: fit-content;
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.checklist {
  display: grid;
  gap: 10px;
  list-style: none;
  padding: 0;
}

.checklist li {
  color: var(--muted);
}

.checklist li.complete {
  color: var(--green);
  font-weight: 700;
}

.warning-panel {
  border-color: #f0c36d;
}

.checkbox-row {
  align-items: center;
  display: flex;
  gap: 8px;
}

.result-box {
  background: #eef4ff;
  border: 1px solid #c9d8ff;
  border-radius: 8px;
  padding: 14px;
}

.error-text {
  color: #b42318;
  font-weight: 700;
}

@media (max-width: 860px) {
  .two-column {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 4: Run typecheck and lint**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/apps/web/app/provider-documentation/page.tsx src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx src/apps/web/app/styles.css
git commit -m "feat: add provider documentation wizard"
```

---

## Task 5: Plan-Side Incentives Console

**Files:**
- Create: `src/apps/web/app/provider-documentation/incentives/page.tsx`
- Create: `src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx`
- Modify: `src/apps/web/app/styles.css`

- [ ] **Step 1: Create the plan-side route**

Create `src/apps/web/app/provider-documentation/incentives/page.tsx`:

```tsx
import { PlanIncentivesConsole } from "../../../components/provider-documentation/PlanIncentivesConsole";

export default function ProviderDocumentationIncentivesPage() {
  return <PlanIncentivesConsole />;
}
```

- [ ] **Step 2: Create the plan-side client component**

Create `src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { IncentiveWorklistRow } from "../../lib/provider-documentation-workflow";

export function PlanIncentivesConsole() {
  const [rows, setRows] = useState<IncentiveWorklistRow[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const selected = rows.find((row) => row.caseId === selectedCaseId) ?? rows[0] ?? null;

  async function refreshRows() {
    setLoading(true);
    const response = await fetch("/api/provider-documentation/incentives", { cache: "no-store" });
    const payload = await response.json();
    setRows(payload.rows ?? []);
    setLoading(false);
  }

  async function approve(caseId: string) {
    const response = await fetch(`/api/provider-documentation/incentives/${caseId}/approve`, {
      method: "POST"
    });
    if (!response.ok) {
      await refreshRows();
      return;
    }
    await refreshRows();
  }

  useEffect(() => {
    void refreshRows();
    const id = window.setInterval(() => {
      void refreshRows();
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="workspace">
      <Link className="back" href="/provider-documentation">
        Provider portal
      </Link>
      <section className="hero compact">
        <span className="eyebrow">Plan contract incentives console</span>
        <h1>Provider documentation incentives</h1>
        <p>Review PAS-submitted requests, policy results, incentive value, and Hedera payment approval.</p>
      </section>

      <section className="panel">
        <div className="toolbar">
          <h2>Submitted PA requests</h2>
          <button className="primary-button" onClick={refreshRows}>{loading ? "Refreshing" : "Refresh events"}</button>
        </div>
        {rows.length === 0 ? (
          <p>No PAS-submitted requests yet. Submit one from the provider portal tab.</p>
        ) : (
          <div className="table-wrap">
            <table className="worklist">
              <thead>
                <tr>
                  <th>PA ID</th>
                  <th>Provider group</th>
                  <th>Service</th>
                  <th>PA result</th>
                  <th>Incentive status</th>
                  <th>Value</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.caseId} className={selected?.caseId === row.caseId ? "selected-row" : ""} onClick={() => setSelectedCaseId(row.caseId)}>
                    <td>{row.caseId}</td>
                    <td>{row.providerGroupDisplay}</td>
                    <td>{row.serviceLabel}</td>
                    <td>{formatPaResult(row.paResult)}</td>
                    <td>{formatIncentiveStatus(row.incentiveStatus)}</td>
                    <td>{row.incentiveValue} {row.currency}</td>
                    <td>{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected ? (
        <section className="panel">
          <h2>Policy details</h2>
          <div className="summary-grid">
            <div><span className="label">Event</span><strong>PAS_SUBMITTED</strong></div>
            <div><span className="label">Evidence source</span><strong>UM Platform API</strong></div>
            <div><span className="label">Policy</span><strong>{selected.policyId}</strong></div>
            <div><span className="label">Audit</span><strong>{selected.audit.id}</strong></div>
          </div>
          <ul>
            <li>Reason codes: {selected.reasonCodes.length === 0 ? "none" : selected.reasonCodes.join(", ")}</li>
            <li>Wallet: {selected.walletId ?? "not eligible"}</li>
            <li>Transaction: {selected.transactionId ?? "not executed"}</li>
          </ul>
          {selected.incentiveStatus === "eligible_pending_approval" ? (
            <button className="primary-button" onClick={() => approve(selected.caseId)}>
              Approve testnet payment
            </button>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function formatPaResult(value: IncentiveWorklistRow["paResult"]): string {
  return value === "denied_not_covered" ? "Denied - not covered benefit" : "Submitted / pending";
}

function formatIncentiveStatus(value: IncentiveWorklistRow["incentiveStatus"]): string {
  if (value === "eligible_pending_approval") {
    return "Eligible - pending approval";
  }
  if (value === "paid") {
    return "Paid";
  }
  return "Not eligible";
}
```

- [ ] **Step 3: Add worklist styles**

Append to `src/apps/web/app/styles.css`:

```css
.toolbar {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.table-wrap {
  overflow-x: auto;
}

.worklist {
  border-collapse: collapse;
  min-width: 980px;
  width: 100%;
}

.worklist th,
.worklist td {
  border-bottom: 1px solid var(--line);
  padding: 12px;
  text-align: left;
  vertical-align: top;
}

.worklist th {
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0;
  text-transform: uppercase;
}

.worklist tbody tr {
  cursor: pointer;
}

.worklist tbody tr:hover,
.worklist .selected-row {
  background: #eef4ff;
}
```

- [ ] **Step 4: Run typecheck and build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both PASS. Build output includes `/provider-documentation` and `/provider-documentation/incentives`.

- [ ] **Step 5: Commit Task 5**

```bash
git add src/apps/web/app/provider-documentation/incentives src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx src/apps/web/app/styles.css
git commit -m "feat: add plan incentive worklist"
```

---

## Task 6: Docs, End-To-End Verification, And Final Polish

**Files:**
- Modify: `README.md`
- Modify: `README.md`

- [ ] **Step 1: Update README demo instructions**

Add this section to `README.md` after "Demo Surfaces":

```markdown
### Provider Documentation Two-Page Demo

Open two browser pages:

- `/provider-documentation` - provider portal prior-auth wizard
- `/provider-documentation/incentives` - plan-side incentives worklist

Demo sequence:

1. In the provider portal, submit `Knee MRI after injury`.
2. In the plan console, refresh events and review the eligible `3 USDC` incentive row.
3. Approve the testnet payment and inspect the audit/transaction details.
4. Return to the provider portal and submit `Full-body wellness MRI screening` after acknowledging the not-covered warning.
5. In the plan console, refresh events and review the `0 USDC` not-eligible row with `BENEFIT_NOT_COVERED`.
```

- [ ] **Step 2: Run all automated verification**

Run:

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

Expected:

- `npm run lint`: PASS
- `npm test`: PASS, including UM Platform, incentive-agent, workflow, and existing policy tests
- `npm run typecheck`: PASS
- `npm run build`: PASS

- [ ] **Step 3: Start local dev server**

Run:

```bash
npm --workspace @operon-labs/web run dev -- --hostname 127.0.0.1
```

Expected: Next reports a local URL such as `http://127.0.0.1:3000`.

- [ ] **Step 4: Manual browser verification**

Verify these flows in the browser:

```text
Provider portal happy path:
1. Open http://127.0.0.1:3000/provider-documentation.
2. Select Knee MRI after injury.
3. Click Check coverage requirements.
4. Click Complete DTR documentation.
5. Click Submit prior authorization.
6. Confirm a PA ID appears and status is Submitted / pending.

Plan console happy path:
1. Open http://127.0.0.1:3000/provider-documentation/incentives.
2. Click Refresh events.
3. Confirm the knee MRI row shows Eligible - pending approval and 3 USDC.
4. Open/select the row.
5. Click Approve testnet payment.
6. Confirm status changes to Paid and a testnet transaction ID appears.

Provider portal negative path:
1. Open http://127.0.0.1:3000/provider-documentation.
2. Select Full-body wellness MRI screening.
3. Click Check coverage requirements.
4. Confirm not-covered warning appears.
5. Check Acknowledge and submit anyway.
6. Click Submit prior authorization.
7. Confirm status is Denied - not covered benefit.

Plan console negative path:
1. Return to http://127.0.0.1:3000/provider-documentation/incentives.
2. Click Refresh events.
3. Confirm the full-body wellness MRI row shows Not eligible and 0 USDC.
4. Confirm reason is Non-covered benefit or reason code BENEFIT_NOT_COVERED/SERVICE_NOT_COVERED.
```

- [ ] **Step 5: Run audit and record status**

Run:

```bash
npm audit --audit-level=moderate
```

Expected current status for this scaffold: FAIL on Next's nested `postcss <8.5.10` advisory. Do not run `npm audit fix --force` because npm currently suggests a breaking downgrade to `next@9.3.3`.

- [ ] **Step 6: Commit Task 6**

```bash
git add README.md
git commit -m "docs: document provider documentation demo"
```

- [ ] **Step 7: Final status check**

Run:

```bash
git status --short --branch
```

Expected: no unexpected unstaged changes except any pre-existing scaffold files intentionally left uncommitted by the current branch owner.
