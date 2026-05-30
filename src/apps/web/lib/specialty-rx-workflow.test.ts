import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBusinessEvaluationId,
  buildPaymentIntentId,
  executePolicyBoundPayment,
  type PaymentIntent,
  type PaymentApprovalRequest
} from "@operon-labs/hedera-executor";
import { createInMemoryUmPlatform } from "@operon-labs/um-platform";
import {
  createSpecialtyRxWorkflow,
  type SpecialtyRxWorkflow
} from "./specialty-rx-workflow";
import { createInMemorySpecialtyRxCaseStore, type SpecialtyRxCaseStore } from "./specialty-rx-store";
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

  it("lists pending fulfillment cases in the plan view before settlement", async () => {
    const { workflow, umRequest } = await createApprovedSpecialtyRxCase("PA-260526-0900-RX121212");
    const [created] = await workflow.listWorkqueue();

    await expect(workflow.listPlanRows()).resolves.toEqual([
      expect.objectContaining({
        fulfillmentCaseId: created!.id,
        umRequestId: umRequest.id,
        state: "intake_triage",
        fulfillmentSlaStatus: "pending",
        businessPolicyStatus: null,
        paymentPolicyStatus: null,
        incentiveStatus: "pending",
        paymentStatus: "pending",
        reason: "Pending fulfillment"
      })
    ]);
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("advances through all four workflow steps and settles a paid fulfillment row", async () => {
    const { workflow, umRequest } = await createApprovedSpecialtyRxCase("PA-260526-0900-RX222222");
    const [created] = await workflow.listWorkqueue();

    await workflow.completeIntake(created!.id, {
      prescriptionPresent: true,
      assignedPharmacyConfirmed: true,
      therapyMetadataPresent: true,
      handoffDataComplete: true
    }, new Date("2026-06-18T15:00:00.000Z"));
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
      fulfillmentSlaStartedAt: "2026-06-18T16:00:00.000Z",
      clearToFillAt: "2026-06-18T16:00:00.000Z",
      businessPolicyStatus: "approved",
      paymentPolicyStatus: "paid",
      incentiveValue: 7,
      reasonCodes: []
    });
    expect(row!.policyControls).toContain("Clear-to-fill timestamp starts Fulfillment SLA");
    expect(row!.policyControls).not.toContain("Intake completion starts Fulfillment SLA");
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

  it("pays when shipment is within 24 hours of clear-to-fill even if intake was earlier", async () => {
    const { workflow, umRequest } = await createApprovedSpecialtyRxCase("PA-260526-0900-RX242424");
    const [created] = await workflow.listWorkqueue();

    await workflow.completeIntake(created!.id, {
      prescriptionPresent: true,
      assignedPharmacyConfirmed: true,
      therapyMetadataPresent: true,
      handoffDataComplete: true
    }, new Date("2026-06-18T08:00:00.000Z"));
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
      new Date("2026-06-19T09:00:00.000Z")
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
      new Date("2026-06-19T10:00:00.000Z")
    );
    await workflow.confirmFulfillment(
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
      new Date("2026-06-19T11:00:00.000Z")
    );

    const [row] = await workflow.listPlanRows();

    expect(row).toMatchObject({
      fulfillmentCaseId: created!.id,
      umRequestId: umRequest.id,
      fulfillmentSlaStartedAt: "2026-06-19T09:00:00.000Z",
      clearToFillAt: "2026-06-19T09:00:00.000Z",
      shipmentScheduledAt: "2026-06-19T10:00:00.000Z",
      fulfillmentSlaStatus: "within_sla",
      businessPolicyStatus: "approved",
      paymentPolicyStatus: "paid",
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 7,
      reasonCodes: []
    });
    expect(row!.policyCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "shipmentScheduledWithinSla",
          actual: "Yes",
          passed: true
        })
      ])
    );
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        umRequestId: umRequest.id,
        triggerEvent: "SPECIALTY_FULFILLMENT_COMPLETED",
        amount: 7,
        walletId: "0.0.9049549"
      }),
      expect.any(Object)
    );
  });

  it("blocks settlement when shipment is outside 24 hours from clear-to-fill", async () => {
    const { workflow, umRequest } = await createApprovedSpecialtyRxCase("PA-260526-0900-RX242425");
    const [created] = await workflow.listWorkqueue();

    await workflow.completeIntake(created!.id, {
      prescriptionPresent: true,
      assignedPharmacyConfirmed: true,
      therapyMetadataPresent: true,
      handoffDataComplete: true
    }, new Date("2026-06-18T08:00:00.000Z"));
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
      new Date("2026-06-19T09:00:00.000Z")
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
      new Date("2026-06-20T10:00:00.000Z")
    );
    await workflow.confirmFulfillment(
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
      new Date("2026-06-20T11:00:00.000Z")
    );

    const [row] = await workflow.listPlanRows();

    expect(row).toMatchObject({
      fulfillmentCaseId: created!.id,
      umRequestId: umRequest.id,
      fulfillmentSlaStartedAt: "2026-06-19T09:00:00.000Z",
      clearToFillAt: "2026-06-19T09:00:00.000Z",
      shipmentScheduledAt: "2026-06-20T10:00:00.000Z",
      fulfillmentSlaStatus: "breached",
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      reasonCodes: ["SHIPMENT_SLA_EXCEEDED"]
    });
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("pays when shipment meets the Fulfillment SLA even if delivery closes after the old delivery window", async () => {
    const { workflow, umRequest } = await createApprovedSpecialtyRxCase("PA-260526-0900-RX232323");
    const [created] = await workflow.listWorkqueue();

    await completeHappyPathBeforeFulfillment(workflow, created!.id);
    await workflow.confirmFulfillment(
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
      new Date("2026-06-22T17:00:00.000Z")
    );

    const [row] = await workflow.listPlanRows();

    expect(row).toMatchObject({
      fulfillmentCaseId: created!.id,
      umRequestId: umRequest.id,
      fulfillmentSlaStatus: "within_sla",
      businessPolicyStatus: "approved",
      paymentPolicyStatus: "paid",
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 7,
      reasonCodes: []
    });
    expect(row).not.toHaveProperty("deliverySlaStatus");
    expect(row!.reasonCodes).not.toContain("DELIVERY_SLA_EXCEEDED");
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        umRequestId: umRequest.id,
        triggerEvent: "SPECIALTY_FULFILLMENT_COMPLETED",
        amount: 7,
        walletId: "0.0.9049549"
      }),
      expect.any(Object)
    );
  });

  it("persists paid plan rows across workflow re-instantiation with the same Specialty Rx store", async () => {
    const caseStore = createInMemorySpecialtyRxCaseStore();
    const { workflow, platform } = await createApprovedSpecialtyRxCase(
      "PA-260526-0900-RX888888",
      undefined,
      undefined,
      caseStore
    );
    const [created] = await workflow.listWorkqueue();

    await completeHappyPathBeforeFulfillment(workflow, created!.id);
    await workflow.confirmFulfillment(
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

    const restartedWorkflow = createSpecialtyRxWorkflow(
      platform,
      undefined,
      caseStore,
      createInMemoryPolicyStore({
        specialty_rx_acme_fulfillment_sla: defaultIncentivePolicies.specialty_rx_acme_fulfillment_sla
      }),
      undefined,
      createInMemoryPaymentPolicyStore(defaultPaymentPlanPolicies)
    );

    await expect(restartedWorkflow.listPlanRows()).resolves.toEqual([
      expect.objectContaining({
        fulfillmentCaseId: created!.id,
        businessPolicyStatus: "approved",
        paymentPolicyStatus: "paid",
        incentiveStatus: "paid",
        paymentStatus: "auto_executed"
      })
    ]);
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("recovers a terminal fulfilled case with a missing in-memory plan row through listPlanRows", async () => {
    const caseStore = createInMemorySpecialtyRxCaseStore();
    const { workflow, platform } = await createApprovedSpecialtyRxCase(
      "PA-260526-0900-RX999999",
      undefined,
      undefined,
      caseStore
    );
    const [created] = await workflow.listWorkqueue();

    await completeHappyPathBeforeFulfillment(workflow, created!.id);
    const scheduled = await caseStore.getCase(created!.id);
    await caseStore.saveCase({
      ...scheduled!,
      state: "fulfilled",
      deliveryConfirmedAt: "2026-06-20T14:00:00.000Z",
      fulfillment: {
        shipped: true,
        deliveryConfirmed: true,
        deliveryAttemptDocumented: true,
        temperatureLogValid: true,
        avoidableFulfillmentException: false,
        externalBlockerDocumented: false,
        exceptionReasonCode: null
      },
      updatedAt: "2026-06-20T14:00:00.000Z"
    });

    const restartedWorkflow = createSpecialtyRxWorkflow(
      platform,
      undefined,
      caseStore,
      createInMemoryPolicyStore({
        specialty_rx_acme_fulfillment_sla: defaultIncentivePolicies.specialty_rx_acme_fulfillment_sla
      }),
      undefined,
      createInMemoryPaymentPolicyStore(defaultPaymentPlanPolicies)
    );

    await expect(restartedWorkflow.listPlanRows()).resolves.toEqual([
      expect.objectContaining({
        fulfillmentCaseId: created!.id,
        businessPolicyStatus: "approved",
        paymentPolicyStatus: "paid",
        incentiveStatus: "paid",
        paymentStatus: "auto_executed"
      })
    ]);
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("recovers a paid terminal case from a submitted payment intent when the plan row is missing", async () => {
    const caseStore = createInMemorySpecialtyRxCaseStore();
    const { workflow, platform, umRequest } = await createApprovedSpecialtyRxCase(
      "PA-260526-0900-RX101010",
      undefined,
      undefined,
      caseStore
    );
    const [created] = await workflow.listWorkqueue();

    await completeHappyPathBeforeFulfillment(workflow, created!.id);
    const scheduled = await caseStore.getCase(created!.id);
    await caseStore.saveCase({
      ...scheduled!,
      state: "fulfilled",
      deliveryConfirmedAt: "2026-06-20T14:00:00.000Z",
      fulfillment: {
        shipped: true,
        deliveryConfirmed: true,
        deliveryAttemptDocumented: true,
        temperatureLogValid: true,
        avoidableFulfillmentException: false,
        externalBlockerDocumented: false,
        exceptionReasonCode: null
      },
      updatedAt: "2026-06-20T14:00:00.000Z"
    });

    const businessPolicyId = "specialty-rx-fulfillment-sla-v1";
    const incentiveEvaluationId = buildBusinessEvaluationId({
      umRequestId: umRequest.id,
      businessPolicyId
    });
    const paymentIntentId = buildPaymentIntentId({
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      incentiveEvaluationId,
      businessPolicyId,
      paymentPolicyId: "acme-health-ppo"
    });
    const submittedIntent: PaymentIntent = {
      id: paymentIntentId,
      auditId: "audit-specialty-rx-recovery",
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      incentiveEvaluationId,
      planId: "acme-health-ppo",
      policyId: businessPolicyId,
      businessPolicyId,
      paymentPolicyId: "acme-health-ppo",
      policyVersion: "v1",
      triggerEvent: "SPECIALTY_FULFILLMENT_COMPLETED",
      token: "HBAR",
      amount: 7,
      sourceAccountId: "0.0.6870566",
      recipientAccountId: "0.0.9049549",
      transactionMemo: umRequest.id,
      status: "submitted",
      transactionId: "0.0.6870566@1781978400.000000001",
      createdAt: "2026-06-20T14:00:00.000Z",
      updatedAt: "2026-06-20T14:00:01.000Z"
    };
    const paymentIntentStore = {
      reserveIntent: vi.fn(async () => ({
        allowed: false,
        reasonCode: "DUPLICATE_PAYMENT_BLOCKED",
        intent: submittedIntent
      })),
      markIntentSubmitted: vi.fn(async () => undefined),
      markIntentFailed: vi.fn(async () => undefined),
      getIntent: vi.fn(async (intentId: string) => intentId === paymentIntentId ? submittedIntent : null)
    };
    executePolicyBoundPaymentMock.mockRejectedValueOnce(new Error("DUPLICATE_PAYMENT_BLOCKED"));

    const restartedWorkflow = createSpecialtyRxWorkflow(
      platform,
      undefined,
      caseStore,
      createInMemoryPolicyStore({
        specialty_rx_acme_fulfillment_sla: defaultIncentivePolicies.specialty_rx_acme_fulfillment_sla
      }),
      paymentIntentStore,
      createInMemoryPaymentPolicyStore(defaultPaymentPlanPolicies)
    );

    await expect(restartedWorkflow.listPlanRows()).resolves.toEqual([
      expect.objectContaining({
        fulfillmentCaseId: created!.id,
        paymentPolicyStatus: "paid",
        paymentIntentId,
        transactionId: submittedIntent.transactionId
      })
    ]);
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
    expect(paymentIntentStore.getIntent).toHaveBeenCalledWith(paymentIntentId);
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

  it("rejects fulfilled state without delivery confirmation unless an exception is documented", async () => {
    const { workflow } = await createApprovedSpecialtyRxCase("PA-260526-0900-RX777777");
    const [created] = await workflow.listWorkqueue();

    await completeHappyPathBeforeFulfillment(workflow, created!.id);

    await expect(
      workflow.confirmFulfillment(created!.id, {
        shipped: true,
        deliveryConfirmed: false,
        deliveryAttemptDocumented: true,
        temperatureLogValid: true,
        avoidableFulfillmentException: false,
        externalBlockerDocumented: false,
        exceptionReasonCode: null
      })
    ).rejects.toThrow("SPECIALTY_RX_DELIVERY_NOT_CONFIRMED");
    await expect(workflow.listWorkqueue()).resolves.toEqual([
      expect.objectContaining({
        id: created!.id,
        state: "shipment_scheduled"
      })
    ]);
    await expect(workflow.listPlanRows()).resolves.toEqual([
      expect.objectContaining({
        fulfillmentCaseId: created!.id,
        state: "shipment_scheduled",
        businessPolicyStatus: null,
        paymentPolicyStatus: null,
        incentiveStatus: "pending",
        paymentStatus: "pending"
      })
    ]);
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("ignores non-input shipment fields so a request body cannot flip cold-chain eligibility", async () => {
    const { workflow } = await createApprovedSpecialtyRxCase("PA-260526-0900-RX555555");
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

    const updated = await workflow.scheduleShipment(created!.id, {
      patientContactAttemptDocumented: true,
      addressConfirmed: true,
      deliveryWindowConfirmed: true,
      coldChainPackoutValidated: true,
      courierScheduled: true,
      // Attacker-supplied fields outside ScheduleShipmentInput must not persist.
      coldChainRequired: false,
      maliciousKey: "x"
    } as never);

    expect(updated.shipment.coldChainRequired).toBe(true);
    expect(updated.shipment).not.toHaveProperty("maliciousKey");
    expect(Object.keys(updated.shipment).sort()).toEqual(
      [
        "addressConfirmed",
        "coldChainPackoutValidated",
        "coldChainRequired",
        "courierScheduled",
        "deliveryWindowConfirmed",
        "patientContactAttemptDocumented"
      ].sort()
    );
  });
});

async function createApprovedSpecialtyRxCase(
  caseId: string,
  policyStore = createInMemoryPolicyStore({
    specialty_rx_acme_fulfillment_sla: defaultIncentivePolicies.specialty_rx_acme_fulfillment_sla
  }),
  paymentPolicyStore = createInMemoryPaymentPolicyStore(defaultPaymentPlanPolicies),
  caseStore: SpecialtyRxCaseStore = createInMemorySpecialtyRxCaseStore()
): Promise<{
  workflow: SpecialtyRxWorkflow;
  platform: ReturnType<typeof createInMemoryUmPlatform>;
  umRequest: ReturnType<ReturnType<typeof createInMemoryUmPlatform>["submitPriorAuth"]>;
}> {
  const platform = createInMemoryUmPlatform({ generateCaseId: () => caseId });
  const workflow = createSpecialtyRxWorkflow(
    platform,
    undefined,
    caseStore,
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

  return { workflow, platform, umRequest };
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
  }, new Date("2026-06-18T15:00:00.000Z"));
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
