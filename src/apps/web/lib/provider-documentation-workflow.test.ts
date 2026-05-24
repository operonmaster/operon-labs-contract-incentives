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
