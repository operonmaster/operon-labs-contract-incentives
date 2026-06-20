import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBusinessEvaluationId,
  buildPaymentIntentId,
  executePolicyBoundPayment,
  type PaymentIntent,
  type PaymentApprovalRequest
} from "@operon-labs/hedera-executor";
import type { IncentivePolicy } from "@operon-labs/policy-engine";
import { createInMemoryUmPlatform, type UMRequest } from "@operon-labs/um-platform";
import { createInMemoryAppealsCaseStore } from "./appeals-store";
import { createAppealsWorkflow } from "./appeals-workflow";
import { createInMemoryPaymentPolicyStore, defaultPaymentPlanPolicies } from "./payment-policy-store";
import { createInMemoryPolicyStore } from "./policy-store";

vi.mock("@operon-labs/hedera-executor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@operon-labs/hedera-executor")>();

  return {
    ...actual,
    executePolicyBoundPayment: vi.fn()
  };
});

const executePolicyBoundPaymentMock = vi.mocked(executePolicyBoundPayment);

const appealsPolicy: IncentivePolicy = {
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
};

describe("appeals workflow", () => {
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

  it("lists PA appeal eligibility and creates one deterministic appeal per denied PA", async () => {
    const { workflow, pending, approved, denied } = await createEligibilityFixture();

    const rows = await workflow.listPriorAuthRows();

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        umRequestId: pending.id,
        eligibilityStatus: "awaiting_determination",
        canStartAppeal: false
      }),
      expect.objectContaining({
        umRequestId: approved.id,
        eligibilityStatus: "not_appeal_eligible",
        canStartAppeal: false
      }),
      expect.objectContaining({
        umRequestId: denied.id,
        eligibilityStatus: "startable",
        canStartAppeal: true
      })
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
  });

  it("preserves the first appeal SLA clock when startAppeal is called concurrently", async () => {
    const { workflow, denied } = await createDeniedAppealFixture("PA-260618-0902-RACE0001");

    const [first, repeated] = await Promise.all([
      workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-18T16:00:00.000Z")),
      workflow.startAppeal(denied.id, { expedited: true }, new Date("2026-06-18T17:00:00.000Z"))
    ]);

    expect(first).toMatchObject({
      id: denied.id.replace(/^PA-/, "APL-"),
      appealReceivedAt: "2026-06-18T16:00:00.000Z",
      packetReadinessSlaHours: 24,
      expedited: false
    });
    expect(repeated).toEqual(first);
    await expect(workflow.listWorkqueue()).resolves.toEqual([
      expect.objectContaining({
        id: first.id,
        appealReceivedAt: "2026-06-18T16:00:00.000Z",
        packetReadinessSlaHours: 24,
        expedited: false
      })
    ]);
  });

  it("advances through all appeal packet steps and settles a paid packet row", async () => {
    const { workflow, denied } = await createDeniedAppealFixture("PA-260618-0902-DENIED02");
    const appeal = await workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-18T16:00:00.000Z"));

    await workflow.acknowledgeAppeal(appeal.id, { appealRequestAcknowledged: true }, new Date("2026-06-18T17:00:00.000Z"));
    await workflow.validateIntake(appeal.id, {
      appealRequestPresent: true,
      appellantAuthorized: true,
      planMemberMatched: true,
      requestedServiceMatched: true
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
  });

  it("resolves missing appeal information directly after intake validation", async () => {
    const { workflow, denied } = await createDeniedAppealFixture("PA-260618-0902-SKIPOD01");
    const appeal = await workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-18T16:00:00.000Z"));

    await workflow.acknowledgeAppeal(appeal.id, { appealRequestAcknowledged: true });
    await workflow.validateIntake(appeal.id, {
      appealRequestPresent: true,
      appellantAuthorized: true,
      planMemberMatched: true,
      requestedServiceMatched: true
    });

    await expect(workflow.resolveMissingInfo(appeal.id, {
      missingInfoRequired: false,
      missingInfoRequested: false,
      missingInfoResolved: true
    })).resolves.toEqual(expect.objectContaining({
      state: "missing_info_resolved",
      originalDecision: {
        denialReasonRetrieved: true,
        priorDecisionSummaryIncluded: true,
        coveragePolicyLocated: true
      }
    }));
  });

  it("keeps legacy decision-retrieved appeal cases eligible for missing-info resolution", async () => {
    const { workflow, denied } = await createDeniedAppealFixture("PA-260618-0902-LEGACY01");
    const appeal = await workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-18T16:00:00.000Z"));

    await workflow.acknowledgeAppeal(appeal.id, { appealRequestAcknowledged: true });
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

    await expect(workflow.resolveMissingInfo(appeal.id, {
      missingInfoRequired: false,
      missingInfoRequested: false,
      missingInfoResolved: true
    })).resolves.toEqual(expect.objectContaining({ state: "missing_info_resolved" }));
  });

  it("blocks settlement when acknowledgement is late without resetting packet readiness clock", async () => {
    const { workflow, denied } = await createDeniedAppealFixture("PA-260618-0902-DENIED03");
    const appeal = await workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-18T16:00:00.000Z"));

    await completeAppealPacket(workflow, appeal.id, {
      acknowledgedAt: new Date("2026-06-19T10:30:00.000Z"),
      packetReadyAt: new Date("2026-06-19T15:00:00.000Z")
    });

    const [row] = await workflow.listPlanRows();
    expect(row).toMatchObject({
      appealId: appeal.id,
      acknowledgementSlaStatus: "breached",
      packetReadinessSlaStatus: "within_sla",
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      reasonCodes: ["ACKNOWLEDGEMENT_SLA_EXCEEDED"]
    });
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("uses business-hour acknowledgement clock across weekends", async () => {
    const { workflow, denied } = await createDeniedAppealFixture("PA-260619-1600-BUSACK1");
    const appeal = await workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-19T16:00:00.000Z"));

    await completeAppealPacket(workflow, appeal.id, {
      acknowledgedAt: new Date("2026-06-22T10:00:00.000Z"),
      packetReadyAt: new Date("2026-06-22T15:00:00.000Z")
    });

    const [row] = await workflow.listPlanRows();
    expect(row).toMatchObject({
      appealId: appeal.id,
      acknowledgementSlaStatus: "within_sla"
    });
    expect(row.reasonCodes).not.toContain("ACKNOWLEDGEMENT_SLA_EXCEEDED");
  });

  it("uses business-hour packet-readiness clock across weekends", async () => {
    const { workflow, denied } = await createDeniedAppealFixture("PA-260619-1600-BUSPKT1");
    const appeal = await workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-19T16:00:00.000Z"));

    await completeAppealPacket(workflow, appeal.id, {
      acknowledgedAt: new Date("2026-06-19T16:30:00.000Z"),
      packetReadyAt: new Date("2026-06-22T15:00:00.000Z")
    });

    const [row] = await workflow.listPlanRows();
    expect(row).toMatchObject({
      appealId: appeal.id,
      packetReadinessSlaStatus: "within_sla",
      businessPolicyStatus: "approved"
    });
    expect(row.reasonCodes).not.toContain("PACKET_READINESS_SLA_EXCEEDED");
  });

  it("blocks settlement when packet readiness is beyond the appeal receipt clock", async () => {
    const { workflow, denied } = await createDeniedAppealFixture("PA-260618-0902-DENIED04");
    const appeal = await workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-18T16:00:00.000Z"));

    await completeAppealPacket(workflow, appeal.id, {
      acknowledgedAt: new Date("2026-06-18T17:00:00.000Z"),
      packetReadyAt: new Date("2026-06-23T16:30:00.000Z")
    });

    const [row] = await workflow.listPlanRows();
    expect(row).toMatchObject({
      appealId: appeal.id,
      acknowledgementSlaStatus: "within_sla",
      packetReadinessSlaStatus: "breached",
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      reasonCodes: ["PACKET_READINESS_SLA_EXCEEDED"]
    });
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("recovers a terminal packet-ready appeal with a missing plan row from a submitted payment intent", async () => {
    const caseStore = createInMemoryAppealsCaseStore();
    const { workflow, platform, denied } = await createDeniedAppealFixture(
      "PA-260618-0902-RECOVER1",
      caseStore
    );
    const appeal = await workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-18T16:00:00.000Z"));
    await completeAppealPacket(workflow, appeal.id, {
      acknowledgedAt: new Date("2026-06-18T17:00:00.000Z"),
      packetReadyAt: new Date("2026-06-19T15:00:00.000Z")
    });

    const terminalCase = await caseStore.getCase(appeal.id);
    const recoveredCaseStore = createInMemoryAppealsCaseStore([terminalCase!]);
    const businessPolicyId = "appeals-packet-quality-v1";
    const incentiveEvaluationId = buildBusinessEvaluationId({
      umRequestId: denied.id,
      businessPolicyId
    });
    const paymentIntentId = buildPaymentIntentId({
      umRequestId: denied.id,
      caseId: denied.id,
      incentiveEvaluationId,
      businessPolicyId,
      paymentPolicyId: "acme-health-ppo"
    });
    const submittedIntent: PaymentIntent = {
      id: paymentIntentId,
      auditId: "audit-appeals-recovery",
      umRequestId: denied.id,
      caseId: denied.id,
      incentiveEvaluationId,
      planId: "acme-health-ppo",
      policyId: businessPolicyId,
      businessPolicyId,
      paymentPolicyId: "acme-health-ppo",
      policyVersion: "v1",
      triggerEvent: "APPEAL_PACKET_READY",
      token: "HBAR",
      amount: 6,
      sourceAccountId: "0.0.6870566",
      recipientAccountId: "0.0.9049549",
      transactionMemo: denied.id,
      status: "submitted",
      transactionId: "0.0.6870566@1781978400.000000002",
      createdAt: "2026-06-19T15:00:00.000Z",
      updatedAt: "2026-06-19T15:00:01.000Z"
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
    executePolicyBoundPaymentMock.mockClear();
    executePolicyBoundPaymentMock.mockRejectedValueOnce(new Error("DUPLICATE_PAYMENT_BLOCKED"));

    const restartedWorkflow = createAppealsWorkflow(
      platform,
      undefined,
      recoveredCaseStore,
      createInMemoryPolicyStore({ appeals_acme_packet_quality: appealsPolicy }),
      paymentIntentStore,
      createInMemoryPaymentPolicyStore(defaultPaymentPlanPolicies)
    );

    await expect(restartedWorkflow.routeReviewer(appeal.id, {
      reviewerQueueSelected: true,
      reviewerConflictCheckComplete: true
    })).resolves.toEqual(expect.objectContaining({ state: "packet_ready" }));
    await expect(restartedWorkflow.listPlanRows()).resolves.toEqual([
      expect.objectContaining({
        appealId: appeal.id,
        paymentPolicyStatus: "paid",
        paymentIntentId,
        transactionId: submittedIntent.transactionId
      })
    ]);
    expect(executePolicyBoundPaymentMock).toHaveBeenCalledTimes(1);
    expect(paymentIntentStore.getIntent).toHaveBeenCalledWith(paymentIntentId);
  });

  it("blocks settlement with audit detail when multiple appeals policies match", async () => {
    const platform = createInMemoryUmPlatform({ generateCaseId: () => "PA-260618-0902-DUPPOL1" });
    const denied = determineRequest(
      platform,
      platform.submitPriorAuth({ requestType: "pharmacy_benefit", serviceCode: "wegovy_semaglutide" }),
      "denied"
    );
    const duplicatePolicy: IncentivePolicy = {
      ...appealsPolicy,
      policyId: "appeals-packet-quality-v1-duplicate"
    };
    const workflow = createAppealsWorkflow(
      platform,
      undefined,
      createInMemoryAppealsCaseStore(),
      createInMemoryPolicyStore({
        appeals_acme_packet_quality: appealsPolicy,
        appeals_acme_packet_quality_duplicate: duplicatePolicy
      }),
      undefined,
      createInMemoryPaymentPolicyStore(defaultPaymentPlanPolicies)
    );
    const appeal = await workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-18T16:00:00.000Z"));

    await completeAppealPacket(workflow, appeal.id, {
      acknowledgedAt: new Date("2026-06-18T17:00:00.000Z"),
      packetReadyAt: new Date("2026-06-19T15:00:00.000Z")
    });

    const [row] = await workflow.listPlanRows();

    expect(row).toMatchObject({
      appealId: appeal.id,
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      reasonCodes: ["MULTIPLE_POLICY_MATCHES"],
      policyId: appealsPolicy.policyId,
      transactionId: null
    });
    expect(row!.audit).not.toBeNull();
    expect(row!.policyCriteria.length).toBeGreaterThan(0);
    expect(row!.policyControls.length).toBeGreaterThan(0);
    expect(executePolicyBoundPaymentMock).not.toHaveBeenCalled();
  });

  it("retains the deterministic payment intent id on failed execution rows", async () => {
    executePolicyBoundPaymentMock.mockRejectedValueOnce(new Error("HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX"));
    const { workflow, denied } = await createDeniedAppealFixture("PA-260618-0902-PAYFAIL1");
    const appeal = await workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-18T16:00:00.000Z"));

    await completeAppealPacket(workflow, appeal.id, {
      acknowledgedAt: new Date("2026-06-18T17:00:00.000Z"),
      packetReadyAt: new Date("2026-06-19T15:00:00.000Z")
    });

    const [row] = await workflow.listPlanRows();
    const businessPolicyId = "appeals-packet-quality-v1";
    const incentiveEvaluationId = buildBusinessEvaluationId({
      umRequestId: denied.id,
      businessPolicyId
    });
    const paymentIntentId = buildPaymentIntentId({
      umRequestId: denied.id,
      caseId: denied.id,
      incentiveEvaluationId,
      businessPolicyId,
      paymentPolicyId: "acme-health-ppo"
    });

    expect(row).toMatchObject({
      id: incentiveEvaluationId,
      appealId: appeal.id,
      businessPolicyStatus: "approved",
      paymentPolicyStatus: "blocked",
      incentiveStatus: "payment_failed",
      paymentStatus: "execution_failed",
      paymentPolicyId: "acme-health-ppo",
      paymentIntentId,
      transactionId: null
    });
  });
});

async function createEligibilityFixture() {
  const ids = [
    "PA-260618-0900-PENDING1",
    "PA-260618-0901-APPROVE1",
    "PA-260618-0902-DENIED01"
  ];
  const platform = createInMemoryUmPlatform({ generateCaseId: () => ids.shift()! });
  const pending = platform.submitPriorAuth({ requestType: "pharmacy_benefit", serviceCode: "wegovy_semaglutide" });
  const approved = determineRequest(
    platform,
    platform.submitPriorAuth({ requestType: "pharmacy_benefit", serviceCode: "wegovy_semaglutide" }),
    "approved"
  );
  const denied = determineRequest(
    platform,
    platform.submitPriorAuth({ requestType: "pharmacy_benefit", serviceCode: "wegovy_semaglutide" }),
    "denied"
  );

  return {
    workflow: createAppealsWorkflow(platform, undefined, createInMemoryAppealsCaseStore()),
    pending,
    approved,
    denied
  };
}

async function createDeniedAppealFixture(
  caseId: string,
  caseStore = createInMemoryAppealsCaseStore()
) {
  const platform = createInMemoryUmPlatform({ generateCaseId: () => caseId });
  const denied = determineRequest(
    platform,
    platform.submitPriorAuth({ requestType: "pharmacy_benefit", serviceCode: "wegovy_semaglutide" }),
    "denied"
  );

  return {
    platform,
    denied,
    workflow: createAppealsWorkflow(
      platform,
      undefined,
      caseStore,
      createInMemoryPolicyStore({ appeals_acme_packet_quality: appealsPolicy }),
      undefined,
      createInMemoryPaymentPolicyStore(defaultPaymentPlanPolicies)
    )
  };
}

async function completeAppealPacket(
  workflow: ReturnType<typeof createAppealsWorkflow>,
  appealId: string,
  timestamps: { acknowledgedAt: Date; packetReadyAt: Date }
): Promise<void> {
  await workflow.acknowledgeAppeal(appealId, { appealRequestAcknowledged: true }, timestamps.acknowledgedAt);
  await workflow.validateIntake(appealId, {
    appealRequestPresent: true,
    appellantAuthorized: true,
    planMemberMatched: true,
    requestedServiceMatched: true
  });
  await workflow.resolveMissingInfo(appealId, {
    missingInfoRequired: false,
    missingInfoRequested: false,
    missingInfoResolved: true
  });
  await workflow.assemblePacket(appealId, {
    requiredDocumentsPresent: true,
    clinicalRationaleIncluded: true,
    policyCitationIncluded: true,
    evidenceIndexComplete: false,
    qualityAuditPassed: true,
    noReworkRequired: true
  });
  await workflow.indexEvidence(appealId, { evidenceIndexComplete: true, phiSafeForPaymentMetadata: true });
  await workflow.routeReviewer(appealId, {
    reviewerQueueSelected: true,
    reviewerConflictCheckComplete: true
  }, timestamps.packetReadyAt);
}

function determineRequest(
  platform: ReturnType<typeof createInMemoryUmPlatform>,
  request: UMRequest,
  outcomeStatus: "approved" | "denied"
): UMRequest {
  platform.startClinicalReview(request.id, "reviewer-appeals");
  return platform.completeClinicalReview(request.id, {
    outcomeStatus,
    clinicalDocumentationReviewed: true,
    medicalNecessityCriteriaMet: true,
    planPolicyRequirementsChecked: true,
    decisionRationaleDocumented: true,
    approvalReasonCode: outcomeStatus === "approved" ? "MEETS_CRITERIA" : null,
    denialReasonCode: outcomeStatus === "denied" ? "PLAN_CRITERIA_NOT_MET" : null
  });
}
