import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProviderDocumentationWorkflow, type IncentiveWorklistRow } from "./provider-documentation-workflow";
import type { StoredPasRequest } from "./pas-persistence";
import { createInMemoryPolicyStore, defaultIncentivePolicies } from "./policy-store";
import { executePolicyBoundPayment } from "@operon-labs/hedera-executor";
import { buildPasFhirBundle, createInMemoryUmPlatform, getDtrQuestionnaire } from "@operon-labs/um-platform";

vi.mock("@operon-labs/hedera-executor", () => ({
  executePolicyBoundPayment: vi.fn(async (request: { auditId: string; currency: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 5));

    return {
      status: "simulated",
      network: "testnet",
      transactionId: `testnet-${request.auditId}-${request.currency.toLowerCase()}-${Date.now()}`
    };
  })
}));

const executePolicyBoundPaymentMock = vi.mocked(executePolicyBoundPayment);
const PA_CASE_ID_PATTERN = /^PA-\d{6}-\d{4}-[A-Z0-9]{8}$/;

describe("provider documentation workflow", () => {
  beforeEach(() => {
    executePolicyBoundPaymentMock.mockClear();
  });

  it("submits knee MRI and automatically settles the eligible policy payment", async () => {
    const workflow = createProviderDocumentationWorkflow();

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const rows = await workflow.listIncentiveRows();

    expect(submitted.caseId).toMatch(PA_CASE_ID_PATTERN);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      caseId: submitted.caseId,
      serviceLabel: "Knee MRI after injury",
      paResult: "submitted_pending",
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 5,
      currency: "HBAR",
      reason: "Complete DTR + PAS before cutoff"
    });
    expect(rows[0]!.transactionId).toContain("testnet-");
    expect(executePolicyBoundPaymentMock.mock.calls[0]?.[1]).toMatchObject({
      paymentIntentStore: expect.objectContaining({
        backend: "firestore"
      })
    });
    expect(rows[0]!.policyControls).toEqual(
      expect.arrayContaining([
        "Allowed submitter and recipient wallet",
        "Request type limited to outpatient service or pharmacy benefit",
        "5 HBAR max per PA request",
        "500 HBAR monthly cap",
        "No PHI or prohibited outcome metrics"
      ])
    );
    expect(rows[0]!.policyCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Request type is eligible",
          expected: "Outpatient Service or Pharmacy Benefit",
          actual: "Outpatient Service",
          passed: true,
          reasonCode: "REQUEST_TYPE_NOT_ELIGIBLE"
        }),
        expect.objectContaining({
          label: "Recipient wallet is approved",
          expected: "0.0.9049549",
          actual: "0.0.9049549",
          passed: true,
          reasonCode: "WALLET_NOT_APPROVED"
        }),
        expect.objectContaining({
          label: "Service is covered benefit",
          expected: "true",
          actual: "true",
          passed: true,
          reasonCode: "SERVICE_NOT_COVERED"
        }),
        expect.objectContaining({
          label: "DTR assessment completed",
          expected: "true",
          actual: "true",
          passed: true,
          reasonCode: "DTR_TEMPLATE_INCOMPLETE"
        })
      ])
    );
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("settles the policy payment from a completed DTR questionnaire response with yes and no answers", async () => {
    const workflow = createProviderDocumentationWorkflow();
    const questionnaire = getDtrQuestionnaire("knee-mri-pa-dtr-v1");

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtrQuestionnaireResponse: {
        questionnaireId: "knee-mri-pa-dtr-v1",
        answers:
          questionnaire?.questions.map((question, index) => ({
            questionId: question.id,
            value: index === 1 ? "no" : "yes"
          })) ?? []
      }
    });
    const rows = await workflow.listIncentiveRows();

    expect(submitted.dtr).toBeNull();
    expect(submitted.dtrQuestionnaireResponse).toMatchObject({
      questionnaireId: "knee-mri-pa-dtr-v1",
      answers: expect.arrayContaining([
        expect.objectContaining({ questionId: "clinical_indication", value: "no" })
      ])
    });
    expect(rows[0]).toMatchObject({
      caseId: submitted.caseId,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      reason: "Complete DTR + PAS before cutoff"
    });
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("uses the current policy store document for each submitted PA", async () => {
    const policyStore = createInMemoryPolicyStore(defaultIncentivePolicies);
    const workflow = createProviderDocumentationWorkflow(undefined, undefined, policyStore);

    const first = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    await policyStore.savePolicy({
      ...defaultIncentivePolicies.provider_documentation_completeness,
      paymentFormula: {
        ...defaultIncentivePolicies.provider_documentation_completeness.paymentFormula,
        baseAmount: 2,
        maxPerRequest: 2
      }
    });
    const second = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    await expect(workflow.getIncentiveRow(first.caseId)).resolves.toMatchObject({
      incentiveValue: 5,
      currency: "HBAR"
    });
    await expect(workflow.getIncentiveRow(second.caseId)).resolves.toMatchObject({
      incentiveValue: 2,
      currency: "HBAR"
    });
  });

  it("persists submitted prior authorizations as PAS FHIR bundles", async () => {
    const storedRequests: StoredPasRequest[] = [];
    const workflow = createProviderDocumentationWorkflow(undefined, {
      backend: "firestore",
      async savePriorAuth(request) {
        storedRequests.push(request);
      },
      async listPriorAuthRecords() {
        return storedRequests.map((request) => request.record);
      },
      async getPriorAuthRecord(caseId) {
        return storedRequests.find((request) => request.record.caseId === caseId)?.record ?? null;
      },
      async getEvidence(caseId) {
        return storedRequests.find((request) => request.evidence.caseId === caseId)?.evidence ?? null;
      },
      async listPasEvents() {
        return storedRequests.map((request) => ({ eventType: "PAS_SUBMITTED", caseId: request.record.caseId }));
      },
      async saveIncentiveRow() {
        return undefined;
      },
      async listIncentiveRows() {
        return [];
      },
      async getIncentiveRow() {
        return null;
      }
    });

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    await expect(workflow.listPriorAuths()).resolves.toEqual([expect.objectContaining({ caseId: submitted.caseId })]);
    await expect(workflow.getEvidence(submitted.caseId)).resolves.toMatchObject({ caseId: submitted.caseId });
    expect(storedRequests[0]).toMatchObject({
      record: { caseId: submitted.caseId },
      evidence: { caseId: submitted.caseId },
      fhirBundle: {
        resourceType: "Bundle",
        entry: expect.arrayContaining([
          expect.objectContaining({ resource: expect.objectContaining({ resourceType: "Claim" }) })
        ])
      }
    });
  });

  it("skips persisted case-id collisions when the local sequence restarts", async () => {
    const collisionCaseIds = [
      "PA-260524-2102-AAAA1111",
      "PA-260524-2102-BBBB2222",
      "PA-260524-2102-CCCC3333"
    ];
    const previousPlatform = createInMemoryUmPlatform({ generateCaseId: createCaseIdGenerator(collisionCaseIds.slice(0, 2)) });
    const existingKnee = previousPlatform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const existingFullBody = previousPlatform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });
    const storedRequests: StoredPasRequest[] = [existingKnee, existingFullBody].map((record) => ({
      record,
      evidence: previousPlatform.getEvidence(record.caseId)!,
      fhirBundle: buildPasFhirBundle(record, previousPlatform.getEvidence(record.caseId)!)
    }));
    const workflow = createProviderDocumentationWorkflow(createInMemoryUmPlatform({ generateCaseId: createCaseIdGenerator(collisionCaseIds) }), {
      backend: "firestore",
      async savePriorAuth(request) {
        storedRequests.push(request);
      },
      async listPriorAuthRecords() {
        return storedRequests.map((request) => request.record);
      },
      async getPriorAuthRecord(caseId) {
        return storedRequests.find((request) => request.record.caseId === caseId)?.record ?? null;
      },
      async getEvidence(caseId) {
        return storedRequests.find((request) => request.evidence.caseId === caseId)?.evidence ?? null;
      },
      async listPasEvents() {
        return storedRequests.map((request) => ({ eventType: "PAS_SUBMITTED", caseId: request.record.caseId }));
      },
      async saveIncentiveRow() {
        return undefined;
      },
      async listIncentiveRows() {
        return [];
      },
      async getIncentiveRow() {
        return null;
      }
    });

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    expect(submitted.caseId).toBe("PA-260524-2102-CCCC3333");
    expect(storedRequests.map((request) => request.record.caseId)).toEqual(collisionCaseIds);
  });

  it("reprocesses a stale incentive row when a newer PAS claim uses the same case ID", async () => {
    const platform = createInMemoryUmPlatform();
    const record = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const evidence = platform.getEvidence(record.caseId)!;
    const storedRequest: StoredPasRequest = {
      record,
      evidence,
      fhirBundle: buildPasFhirBundle(record, evidence)
    };
    let incentiveRow: IncentiveWorklistRow | null = {
      caseId: record.caseId,
      submittedAt: "2026-05-24T00:00:00.000Z",
      providerGroupDisplay: record.providerGroupDisplay,
      requestType: record.requestType,
      serviceLabel: record.serviceLabel,
      serviceCode: record.serviceCode,
      paResult: "submitted_pending",
      denialReason: null,
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      currency: "USDC",
      settlementToken: { symbol: "USDC" },
      reason: "Old stale evaluation",
      reasonCodes: ["DTR_TEMPLATE_INCOMPLETE"],
      policyId: "provider-documentation-completeness-v1",
      policyControls: [],
      policyCriteria: [],
      audit: {
        id: "audit-stale",
        requestHash: "hash-stale",
        policyId: "provider-documentation-completeness-v1",
        policyVersion: "v1",
        decision: "blocked",
        reasonCodes: ["DTR_TEMPLATE_INCOMPLETE"],
        transactionId: null,
        createdAt: "2026-05-24T00:00:00.000Z"
      },
      walletId: null,
      paymentIntentId: null,
      transactionId: null
    };
    const workflow = createProviderDocumentationWorkflow(createInMemoryUmPlatform(), {
      backend: "firestore",
      async savePriorAuth() {
        return undefined;
      },
      async listPriorAuthRecords() {
        return [storedRequest.record];
      },
      async getPriorAuthRecord(caseId) {
        return caseId === record.caseId ? storedRequest.record : null;
      },
      async getEvidence(caseId) {
        return caseId === record.caseId ? storedRequest.evidence : null;
      },
      async listPasEvents() {
        return [{ eventType: "PAS_SUBMITTED", caseId: record.caseId }];
      },
      async saveIncentiveRow(row) {
        incentiveRow = row;
      },
      async listIncentiveRows() {
        return incentiveRow ? [incentiveRow] : [];
      },
      async getIncentiveRow(caseId) {
        return caseId === record.caseId ? incentiveRow : null;
      }
    });

    const rows = await workflow.listIncentiveRows();

    expect(rows[0]).toMatchObject({
      caseId: record.caseId,
      submittedAt: record.submittedAt,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      currency: "HBAR",
      settlementToken: { symbol: "HBAR" },
      reasonCodes: []
    });
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("does not block provider submission when incentive evidence processing is unavailable", async () => {
    const platform = createInMemoryUmPlatform();
    const workflow = createProviderDocumentationWorkflow({
      ...platform,
      getEvidence() {
        throw new Error("INCENTIVE_EVIDENCE_UNAVAILABLE");
      }
    });

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    expect(submitted.caseId).toMatch(PA_CASE_ID_PATTERN);
    await expect(workflow.listPriorAuths()).resolves.toHaveLength(1);
  });

  it("submits full-body wellness MRI and creates a zero-value blocked policy row", async () => {
    const workflow = createProviderDocumentationWorkflow();

    await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });
    const rows = await workflow.listIncentiveRows();

    expect(rows[0]).toMatchObject({
      serviceLabel: "Full-body wellness MRI screening",
      paResult: "denied_not_covered",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      currency: "HBAR",
      reason: "Non-covered benefit"
    });
    expect(rows[0]!.transactionId).toBeNull();
    expect(rows[0]!.policyCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Service is covered benefit",
          expected: "true",
          actual: "false",
          passed: false,
          reasonCode: "SERVICE_NOT_COVERED"
        }),
        expect.objectContaining({
          label: "DTR assessment completed",
          expected: "true",
          actual: "false",
          passed: false,
          reasonCode: "DTR_TEMPLATE_INCOMPLETE"
        })
      ])
    );
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("submits pharmacy medication requests and settles eligible request-type policy payment", async () => {
    const workflow = createProviderDocumentationWorkflow();

    await workflow.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "humira_adalimumab",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const rows = await workflow.listIncentiveRows();

    expect(rows[0]).toMatchObject({
      requestType: "pharmacy_benefit",
      serviceLabel: "Humira (adalimumab) Pen",
      serviceCode: "humira_adalimumab",
      incentiveStatus: "paid",
      paymentStatus: "auto_executed"
    });
    expect(rows[0]!.policyCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Request type is eligible",
          expected: "Outpatient Service or Pharmacy Benefit",
          actual: "Pharmacy Benefit",
          passed: true,
          reasonCode: "REQUEST_TYPE_NOT_ELIGIBLE"
        })
      ])
    );
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("submits knee MRI with skipped assessment as zero-value blocked policy row", async () => {
    const workflow = createProviderDocumentationWorkflow();

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const rows = await workflow.listIncentiveRows();

    expect(submitted).toMatchObject({
      paResult: "submitted_pending"
    });
    expect(submitted.caseId).toMatch(PA_CASE_ID_PATTERN);
    expect(rows[0]).toMatchObject({
      caseId: submitted.caseId,
      serviceLabel: "Knee MRI after injury",
      paResult: "submitted_pending",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      reason: "Missing required documentation"
    });
    expect(rows[0]!.reasonCodes).toEqual(
      expect.arrayContaining(["DTR_TEMPLATE_INCOMPLETE", "ATTACHMENT_CHECKLIST_INCOMPLETE", "FHIR_FIELDS_MISSING"])
    );
  });

  it("preserves audit metadata across repeated list and get reads", async () => {
    const workflow = createProviderDocumentationWorkflow();

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const listed = (await workflow.listIncentiveRows())[0];
    await new Promise((resolve) => setTimeout(resolve, 5));
    const relisted = (await workflow.listIncentiveRows())[0];
    const fetched = await workflow.getIncentiveRow(submitted.caseId);

    expect(relisted.audit.createdAt).toBe(listed.audit.createdAt);
    expect(fetched?.audit.createdAt).toBe(listed.audit.createdAt);
    expect(relisted.transactionId).toBe(listed.transactionId);
    expect(fetched?.transactionId).toBe(listed.transactionId);
  });

  it("does not execute duplicate payments across repeated incentive reads", async () => {
    const workflow = createProviderDocumentationWorkflow();

    const submitted = await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const firstPaid = await workflow.getIncentiveRow(submitted.caseId);
    const secondPaid = await workflow.getIncentiveRow(submitted.caseId);

    expect(secondPaid?.transactionId).toBe(firstPaid?.transactionId);
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });
});

function createCaseIdGenerator(caseIds: string[]): () => string {
  let nextIndex = 0;

  return () => {
    const caseId = caseIds[nextIndex];
    nextIndex += 1;

    if (!caseId) {
      throw new Error("CASE_ID_SEQUENCE_EXHAUSTED");
    }

    return caseId;
  };
}
