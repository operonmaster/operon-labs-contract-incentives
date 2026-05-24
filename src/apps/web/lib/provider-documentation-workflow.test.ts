import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProviderDocumentationWorkflow } from "./provider-documentation-workflow";
import { executeApprovedPayment } from "@operon-labs/hedera-executor";
import { createInMemoryUmPlatform } from "@operon-labs/um-platform";

vi.mock("@operon-labs/hedera-executor", () => ({
  executeApprovedPayment: vi.fn(async (request: { auditId: string; currency: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 5));

    return {
      status: "simulated",
      network: "testnet",
      transactionId: `testnet-${request.auditId}-${request.currency.toLowerCase()}-${Date.now()}`
    };
  })
}));

const executeApprovedPaymentMock = vi.mocked(executeApprovedPayment);

describe("provider documentation workflow", () => {
  beforeEach(() => {
    executeApprovedPaymentMock.mockClear();
  });

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

  it("does not block provider submission when incentive evidence processing is unavailable", () => {
    const platform = createInMemoryUmPlatform();
    const workflow = createProviderDocumentationWorkflow({
      ...platform,
      getEvidence() {
        throw new Error("INCENTIVE_EVIDENCE_UNAVAILABLE");
      }
    });

    const submitted = workflow.submitPriorAuth({
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

  it("preserves audit metadata across repeated list and get reads", async () => {
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
    const listed = workflow.listIncentiveRows()[0];
    await new Promise((resolve) => setTimeout(resolve, 5));
    const relisted = workflow.listIncentiveRows()[0];
    const fetched = workflow.getIncentiveRow("synthetic-pa-20931");

    expect(relisted.audit.createdAt).toBe(listed.audit.createdAt);
    expect(fetched?.audit.createdAt).toBe(listed.audit.createdAt);
  });

  it("returns existing paid rows for repeat approvals without executing payment again", async () => {
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
    const firstPaid = await workflow.approvePayment("synthetic-pa-20931");
    const secondPaid = await workflow.approvePayment("synthetic-pa-20931");

    expect(secondPaid).toBe(firstPaid);
    expect(secondPaid.transactionId).toBe(firstPaid.transactionId);
    expect(executeApprovedPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent approvals for the same case", async () => {
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
    const [firstPaid, secondPaid] = await Promise.all([
      workflow.approvePayment("synthetic-pa-20931"),
      workflow.approvePayment("synthetic-pa-20931")
    ]);

    expect(secondPaid.transactionId).toBe(firstPaid.transactionId);
    expect(executeApprovedPaymentMock).toHaveBeenCalledTimes(1);
  });
});
