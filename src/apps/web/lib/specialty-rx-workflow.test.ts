import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPaymentIntentId,
  executePolicyBoundPayment,
  type PaymentApprovalRequest
} from "@operon-labs/hedera-executor";
import { createInMemoryUmPlatform } from "@operon-labs/um-platform";
import {
  createSpecialtyRxWorkflow,
  type SpecialtyRxWorkflow
} from "./specialty-rx-workflow";
import { createInMemorySpecialtyRxCaseStore } from "./specialty-rx-store";
import { createInMemoryPaymentPolicyStore, defaultPaymentPlanPolicies } from "./payment-policy-store";
import { createInMemoryPolicyStore, defaultIncentivePolicies } from "./policy-store";

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
    executePolicyBoundPaymentMock.mockImplementation(async (request: PaymentApprovalRequest) => {
      const paymentIntentId = buildPaymentIntentId(request);

      return {
        status: "simulated",
        network: "testnet",
        transactionId: `testnet-${request.auditId}-${request.currency.toLowerCase()}`,
        runtime: "hedera-agent-kit-policy",
        paymentIntentId
      };
    });
  });

  it("creates fulfillment workqueue cases only from approved pharmacy UM requests", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260526-0900-RX111111" });
    const workflow = createSpecialtyRxWorkflow(platform, undefined, createInMemorySpecialtyRxCaseStore());
    const umRequest = platform.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide"
    });

    await platform.startClinicalReview(umRequest.id, "reviewer-ana");
    await platform.completeClinicalReview(umRequest.id, {
      outcomeStatus: "approved",
      clinicalDocumentationReviewed: true,
      medicalNecessityCriteriaMet: true,
      planPolicyRequirementsChecked: true,
      decisionRationaleDocumented: true
    });

    await expect(workflow.listWorkqueue()).resolves.toEqual([
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
    const { workflow, umRequest } = await createApprovedSpecialtyRxCase("PA-260526-0900-RX222222");
    const [created] = await workflow.listWorkqueue();

    await workflow.completeIntake(created!.id, {
      prescriptionPresent: true,
      assignedPharmacyConfirmed: true,
      therapyMetadataPresent: true,
      handoffDataComplete: true
    });
    await workflow.clearToFill(
      created!.id,
      {
        benefitsOrClaimCheckCompleted: true,
        prescriptionValid: true,
        prescriberClarificationRequired: false,
        prescriberClarificationResolved: true,
        remsRequired: false,
        remsAuthorizationConfirmed: true,
        inventoryAvailable: true,
        copayOrPaymentReady: true
      },
      new Date("2026-06-18T16:00:00.000Z")
    );
    await workflow.scheduleShipment(
      created!.id,
      {
        patientContactAttemptDocumented: true,
        addressConfirmed: true,
        deliveryWindowConfirmed: true,
        coldChainPackoutValidated: true,
        courierScheduled: true
      },
      new Date("2026-06-19T09:30:00.000Z")
    );
    const terminalCase = await workflow.confirmFulfillment(
      created!.id,
      {
        shipped: true,
        deliveryConfirmed: true,
        deliveryAttemptDocumented: true,
        temperatureLogValid: true,
        avoidableFulfillmentException: false,
        externalBlockerDocumented: false,
        exceptionReasonCode: null
      },
      new Date("2026-06-20T14:00:00.000Z")
    );
    const [row] = await workflow.listPlanRows();

    expect(terminalCase.state).toBe("fulfilled");
    expect(row).toMatchObject({
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
    const { workflow } = await createApprovedSpecialtyRxCase("PA-260526-0900-RX333333");
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
    });
    await workflow.scheduleShipment(created!.id, {
      patientContactAttemptDocumented: true,
      addressConfirmed: false,
      deliveryWindowConfirmed: false,
      coldChainPackoutValidated: true,
      courierScheduled: false
    });
    await workflow.confirmFulfillment(created!.id, {
      shipped: false,
      deliveryConfirmed: false,
      deliveryAttemptDocumented: true,
      temperatureLogValid: false,
      avoidableFulfillmentException: false,
      externalBlockerDocumented: true,
      exceptionReasonCode: "PATIENT_UNREACHABLE"
    });
    const [row] = await workflow.listPlanRows();

    expect(row).toMatchObject({
      state: "exception",
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveValue: 0,
      reasonCodes: ["EXTERNAL_BLOCKER_DOCUMENTED"]
    });
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("does not raise a lower stored payment policy max during settlement", async () => {
    executePolicyBoundPaymentMock.mockImplementation(async (request, options) => {
      if (options?.planPolicy && request.amount > options.planPolicy.maxPaymentAmount) {
        throw new Error("HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX");
      }

      return {
        status: "simulated",
        network: "testnet",
        transactionId: `testnet-${request.auditId}-${request.currency.toLowerCase()}`,
        runtime: "hedera-agent-kit-policy",
        paymentIntentId: buildPaymentIntentId(request)
      };
    });

    const lowMaxPaymentPolicyStore = createInMemoryPaymentPolicyStore({
      "acme-health-ppo": {
        ...defaultPaymentPlanPolicies["acme-health-ppo"],
        maxPaymentAmount: 6
      }
    });
    const { workflow } = await createApprovedSpecialtyRxCase(
      "PA-260526-0900-RX444444",
      undefined,
      lowMaxPaymentPolicyStore
    );
    const [created] = await workflow.listWorkqueue();

    await completeHappyPathBeforeFulfillment(workflow, created!.id);
    await workflow.confirmFulfillment(created!.id, {
      shipped: true,
      deliveryConfirmed: true,
      deliveryAttemptDocumented: true,
      temperatureLogValid: true,
      avoidableFulfillmentException: false,
      externalBlockerDocumented: false,
      exceptionReasonCode: null
    });
    const [row] = await workflow.listPlanRows();

    expect(row).toMatchObject({
      businessPolicyStatus: "approved",
      paymentPolicyStatus: "blocked",
      incentiveStatus: "payment_failed",
      paymentStatus: "execution_failed",
      incentiveValue: 7
    });
    expect(row!.paymentPolicyControls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "maxPaymentPerRequest",
          status: "failed",
          expected: "<= 6 HBAR",
          actual: "7 HBAR",
          failureCode: "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX"
        })
      ])
    );
  });

  it("deduplicates concurrent fulfillment settlement for the same case", async () => {
    executePolicyBoundPaymentMock.mockImplementation(async (request) => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      return {
        status: "simulated",
        network: "testnet",
        transactionId: `testnet-${request.auditId}-${request.currency.toLowerCase()}`,
        runtime: "hedera-agent-kit-policy",
        paymentIntentId: buildPaymentIntentId(request)
      };
    });

    const { workflow } = await createApprovedSpecialtyRxCase("PA-260526-0900-RX555555");
    const [created] = await workflow.listWorkqueue();

    await completeHappyPathBeforeFulfillment(workflow, created!.id);
    await Promise.all([
      workflow.confirmFulfillment(
        created!.id,
        {
          shipped: true,
          deliveryConfirmed: true,
          deliveryAttemptDocumented: true,
          temperatureLogValid: true,
          avoidableFulfillmentException: false,
          externalBlockerDocumented: false,
          exceptionReasonCode: null
        },
        new Date("2026-06-20T14:00:00.000Z")
      ),
      workflow.confirmFulfillment(
        created!.id,
        {
          shipped: true,
          deliveryConfirmed: true,
          deliveryAttemptDocumented: true,
          temperatureLogValid: true,
          avoidableFulfillmentException: false,
          externalBlockerDocumented: false,
          exceptionReasonCode: null
        },
        new Date("2026-06-20T14:00:00.000Z")
      )
    ]);

    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("blocks settlement when multiple specialty policies match", async () => {
    const duplicatePolicy = {
      ...defaultIncentivePolicies.specialty_rx_acme_fulfillment_sla,
      policyId: "specialty-rx-fulfillment-sla-v1-duplicate"
    };
    const { workflow } = await createApprovedSpecialtyRxCase(
      "PA-260526-0900-RX666666",
      createInMemoryPolicyStore({
        specialty_rx_acme_fulfillment_sla: defaultIncentivePolicies.specialty_rx_acme_fulfillment_sla,
        specialty_rx_acme_fulfillment_sla_duplicate: duplicatePolicy
      })
    );
    const [created] = await workflow.listWorkqueue();

    await completeHappyPathBeforeFulfillment(workflow, created!.id);
    await workflow.confirmFulfillment(created!.id, {
      shipped: true,
      deliveryConfirmed: true,
      deliveryAttemptDocumented: true,
      temperatureLogValid: true,
      avoidableFulfillmentException: false,
      externalBlockerDocumented: false,
      exceptionReasonCode: null
    });
    const [row] = await workflow.listPlanRows();

    expect(row).toMatchObject({
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveValue: 0,
      reasonCodes: ["MULTIPLE_POLICY_MATCHES"]
    });
    expect(row!.audit).not.toBeNull();
    expect(row!.policyCriteria.length).toBeGreaterThan(0);
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });
});

async function createApprovedSpecialtyRxCase(
  caseId: string,
  policyStore = createInMemoryPolicyStore({
    specialty_rx_acme_fulfillment_sla: defaultIncentivePolicies.specialty_rx_acme_fulfillment_sla
  }),
  paymentPolicyStore = createInMemoryPaymentPolicyStore(defaultPaymentPlanPolicies)
): Promise<{
  workflow: SpecialtyRxWorkflow;
  umRequest: ReturnType<ReturnType<typeof createInMemoryUmPlatform>["submitPriorAuth"]>;
}> {
  const platform = createInMemoryUmPlatform({ generateCaseId: () => caseId });
  const workflow = createSpecialtyRxWorkflow(
    platform,
    undefined,
    createInMemorySpecialtyRxCaseStore(),
    policyStore,
    undefined,
    paymentPolicyStore
  );
  const umRequest = platform.submitPriorAuth({
    requestType: "pharmacy_benefit",
    serviceCode: "wegovy_semaglutide"
  });

  await platform.startClinicalReview(umRequest.id, "reviewer-ana");
  await platform.completeClinicalReview(umRequest.id, {
    outcomeStatus: "approved",
    clinicalDocumentationReviewed: true,
    medicalNecessityCriteriaMet: true,
    planPolicyRequirementsChecked: true,
    decisionRationaleDocumented: true
  });

  return { workflow, umRequest };
}

async function completeHappyPathBeforeFulfillment(
  workflow: SpecialtyRxWorkflow,
  fulfillmentCaseId: string
): Promise<void> {
  await workflow.completeIntake(fulfillmentCaseId, {
    prescriptionPresent: true,
    assignedPharmacyConfirmed: true,
    therapyMetadataPresent: true,
    handoffDataComplete: true
  });
  await workflow.clearToFill(
    fulfillmentCaseId,
    {
      benefitsOrClaimCheckCompleted: true,
      prescriptionValid: true,
      prescriberClarificationRequired: false,
      prescriberClarificationResolved: true,
      remsRequired: false,
      remsAuthorizationConfirmed: true,
      inventoryAvailable: true,
      copayOrPaymentReady: true
    },
    new Date("2026-06-18T16:00:00.000Z")
  );
  await workflow.scheduleShipment(
    fulfillmentCaseId,
    {
      patientContactAttemptDocumented: true,
      addressConfirmed: true,
      deliveryWindowConfirmed: true,
      coldChainPackoutValidated: true,
      courierScheduled: true
    },
    new Date("2026-06-19T09:30:00.000Z")
  );
}
