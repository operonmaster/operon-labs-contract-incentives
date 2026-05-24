import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProviderDocumentationWorkflow } from "./provider-documentation-workflow";
import { executePolicyBoundPayment } from "@operon-labs/hedera-executor";
import { createInMemoryUmPlatform } from "@operon-labs/um-platform";

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

describe("provider documentation workflow", () => {
  beforeEach(() => {
    executePolicyBoundPaymentMock.mockClear();
  });

  it("submits knee MRI and automatically settles the eligible policy payment", async () => {
    const workflow = createProviderDocumentationWorkflow();

    const submitted = await workflow.submitPriorAuth({
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const rows = await workflow.listIncentiveRows();

    expect(submitted.caseId).toBe("synthetic-pa-20931");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      caseId: "synthetic-pa-20931",
      serviceLabel: "Knee MRI after injury",
      paResult: "submitted_pending",
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 3,
      currency: "USDC",
      reason: "Complete DTR + PAS before cutoff"
    });
    expect(rows[0]!.transactionId).toContain("testnet-");
    expect(rows[0]!.policyControls).toEqual(
      expect.arrayContaining([
        "Allowed submitter and recipient wallet",
        "3 USDC max per PA request",
        "300 USDC monthly cap",
        "No PHI or prohibited outcome metrics"
      ])
    );
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
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    expect(submitted.caseId).toBe("synthetic-pa-20931");
    expect(workflow.listPriorAuths()).toHaveLength(1);
  });

  it("submits full-body wellness MRI and creates a zero-value blocked policy row", async () => {
    const workflow = createProviderDocumentationWorkflow();

    await workflow.submitPriorAuth({
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
      currency: "USDC",
      reason: "Non-covered benefit"
    });
    expect(rows[0]!.transactionId).toBeNull();
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("submits knee MRI with skipped assessment as zero-value blocked policy row", async () => {
    const workflow = createProviderDocumentationWorkflow();

    const submitted = await workflow.submitPriorAuth({
      serviceCode: "knee_mri"
    });
    const rows = await workflow.listIncentiveRows();

    expect(submitted).toMatchObject({
      caseId: "synthetic-pa-20931",
      paResult: "submitted_pending"
    });
    expect(rows[0]).toMatchObject({
      caseId: "synthetic-pa-20931",
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

    await workflow.submitPriorAuth({
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
    const fetched = await workflow.getIncentiveRow("synthetic-pa-20931");

    expect(relisted.audit.createdAt).toBe(listed.audit.createdAt);
    expect(fetched?.audit.createdAt).toBe(listed.audit.createdAt);
    expect(relisted.transactionId).toBe(listed.transactionId);
    expect(fetched?.transactionId).toBe(listed.transactionId);
  });

  it("does not execute duplicate payments across repeated incentive reads", async () => {
    const workflow = createProviderDocumentationWorkflow();

    await workflow.submitPriorAuth({
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const firstPaid = await workflow.getIncentiveRow("synthetic-pa-20931");
    const secondPaid = await workflow.getIncentiveRow("synthetic-pa-20931");

    expect(secondPaid?.transactionId).toBe(firstPaid?.transactionId);
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });
});
