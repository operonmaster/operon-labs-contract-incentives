import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPaymentIntentId,
  executePolicyBoundPayment,
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
    await workflow.retrieveOriginalDecision(appeal.id, {
      denialReasonRetrieved: true,
      priorDecisionSummaryIncluded: true,
      coveragePolicyLocated: true
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

  it("blocks settlement when acknowledgement is late without resetting packet readiness clock", async () => {
    const { workflow, denied } = await createDeniedAppealFixture("PA-260618-0902-DENIED03");
    const appeal = await workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-18T16:00:00.000Z"));

    await completeAppealPacket(workflow, appeal.id, {
      acknowledgedAt: new Date("2026-06-18T19:30:00.000Z"),
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

  it("blocks settlement when packet readiness is beyond the appeal receipt clock", async () => {
    const { workflow, denied } = await createDeniedAppealFixture("PA-260618-0902-DENIED04");
    const appeal = await workflow.startAppeal(denied.id, { expedited: false }, new Date("2026-06-18T16:00:00.000Z"));

    await completeAppealPacket(workflow, appeal.id, {
      acknowledgedAt: new Date("2026-06-18T17:00:00.000Z"),
      packetReadyAt: new Date("2026-06-19T17:30:00.000Z")
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

async function createDeniedAppealFixture(caseId: string) {
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
      createInMemoryAppealsCaseStore(),
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
  await workflow.retrieveOriginalDecision(appealId, {
    denialReasonRetrieved: true,
    priorDecisionSummaryIncluded: true,
    coveragePolicyLocated: true
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
