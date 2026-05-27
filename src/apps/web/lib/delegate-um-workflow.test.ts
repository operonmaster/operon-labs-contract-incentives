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
        id: umRequest.id,
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
      id: umRequest.id,
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
