import { describe, expect, it, vi } from "vitest";
import type { IncentivePolicy } from "@operon-labs/policy-engine";
import {
  buildAppealsPacketRequestObject,
  evaluateAppealsPacketEvent,
  getDemoEvaluationRequest,
  type AppealsPacketEvidence
} from "../src/index";

const policy: IncentivePolicy = {
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
  incentiveScope: { eligibleRequestTypes: ["pharmacy_benefit"] },
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

const evidence: AppealsPacketEvidence = {
  appealId: "APL-260526-0900-DENIED01",
  umRequestId: "PA-260526-0900-DENIED01",
  planId: "acme-health-ppo",
  submitterId: "lakeside-provider-admin",
  requestType: "pharmacy_benefit",
  originalOutcomeStatus: "denied",
  appealReceivedAt: "2026-06-18T16:00:00.000Z",
  acknowledgedAt: "2026-06-18T17:00:00.000Z",
  packetReadyAt: "2026-06-19T15:00:00.000Z",
  acknowledgedWithinSla: true,
  packetReadyWithinSla: true,
  requiredDocumentsPresent: true,
  clinicalRationaleIncluded: true,
  policyCitationIncluded: true,
  priorDecisionSummaryIncluded: true,
  evidenceIndexComplete: true,
  qualityAuditPassed: true,
  noReworkRequired: true,
  appealOutcomeUsed: false,
  costSavingsMetricUsed: false,
  denialReversalMetricUsed: false,
  containsPhi: false
};

describe("evaluateAppealsPacketEvent", () => {
  it("builds the policy-facing appeals packet request object", () => {
    const requestObject = buildAppealsPacketRequestObject(evidence);

    expect(requestObject).toMatchObject({
      appealId: evidence.appealId,
      umRequestId: evidence.umRequestId,
      originalOutcomeStatus: "denied",
      packetReadyWithinSla: true,
      appealOutcomeUsed: false,
      costSavingsMetricUsed: false,
      denialReversalMetricUsed: false,
      containsPhi: false
    });
    expect(requestObject).not.toHaveProperty("paymentAmount");
  });

  it("pulls policy-safe appeal packet evidence by appealId", () => {
    const getEvidenceByAppealId = vi.fn(() => evidence);

    const evaluation = evaluateAppealsPacketEvent(
      { eventType: "APPEAL_PACKET_READY", appealId: evidence.appealId, umRequestId: evidence.umRequestId },
      { getEvidenceByAppealId, policy, monthToDateAmount: 0 }
    );

    expect(getEvidenceByAppealId).toHaveBeenCalledWith(evidence.appealId);
    expect(evaluation.request.requestObject).toMatchObject({
      appealId: evidence.appealId,
      umRequestId: evidence.umRequestId,
      originalOutcomeStatus: "denied",
      packetReadyWithinSla: true,
      appealOutcomeUsed: false,
      costSavingsMetricUsed: false,
      containsPhi: false
    });
    expect(evaluation.result).toMatchObject({ decision: "approved", amount: 6, reasonCodes: [] });
  });

  it("rejects non-canonical appeal and PA event identifiers before evidence lookup", () => {
    const getEvidenceByAppealId = vi.fn();

    expect(() =>
      evaluateAppealsPacketEvent(
        { eventType: "APPEAL_PACKET_READY", appealId: "appeal-1", umRequestId: evidence.umRequestId },
        { getEvidenceByAppealId, policy, monthToDateAmount: 0 }
      )
    ).toThrow("APPEALS_EVENT_ID_NOT_CANONICAL:appeal-1");
    expect(getEvidenceByAppealId).not.toHaveBeenCalled();
  });

  it("rejects unsupported event types before evidence lookup", () => {
    const getEvidenceByAppealId = vi.fn();

    expect(() =>
      evaluateAppealsPacketEvent(
        { eventType: "UM_REQUEST_DETERMINED", appealId: evidence.appealId, umRequestId: evidence.umRequestId },
        { getEvidenceByAppealId, policy, monthToDateAmount: 0 }
      )
    ).toThrow("UNSUPPORTED_APPEALS_EVENT");
    expect(getEvidenceByAppealId).not.toHaveBeenCalled();
  });

  it("rejects bare canonical prefixes before evidence lookup", () => {
    const getEvidenceByAppealId = vi.fn();

    expect(() =>
      evaluateAppealsPacketEvent(
        { eventType: "APPEAL_PACKET_READY", appealId: "APL-", umRequestId: evidence.umRequestId },
        { getEvidenceByAppealId, policy, monthToDateAmount: 0 }
      )
    ).toThrow("APPEALS_EVENT_ID_NOT_CANONICAL:APL-");
    expect(() =>
      evaluateAppealsPacketEvent(
        { eventType: "APPEAL_PACKET_READY", appealId: evidence.appealId, umRequestId: "PA-" },
        { getEvidenceByAppealId, policy, monthToDateAmount: 0 }
      )
    ).toThrow("APPEALS_UM_REQUEST_ID_NOT_CANONICAL:PA-");
    expect(getEvidenceByAppealId).not.toHaveBeenCalled();
  });

  it("rejects non-canonical PA identifiers before evidence lookup", () => {
    const getEvidenceByAppealId = vi.fn();

    expect(() =>
      evaluateAppealsPacketEvent(
        { eventType: "APPEAL_PACKET_READY", appealId: evidence.appealId, umRequestId: "um-request-1" },
        { getEvidenceByAppealId, policy, monthToDateAmount: 0 }
      )
    ).toThrow("APPEALS_UM_REQUEST_ID_NOT_CANONICAL:um-request-1");
    expect(getEvidenceByAppealId).not.toHaveBeenCalled();
  });

  it("throws when appeals evidence is missing for the appealId", () => {
    const getEvidenceByAppealId = vi.fn(() => null);

    expect(() =>
      evaluateAppealsPacketEvent(
        { eventType: "APPEAL_PACKET_READY", appealId: evidence.appealId, umRequestId: evidence.umRequestId },
        { getEvidenceByAppealId, policy, monthToDateAmount: 0 }
      )
    ).toThrow(`APPEALS_EVIDENCE_NOT_FOUND:${evidence.appealId}`);
    expect(getEvidenceByAppealId).toHaveBeenCalledWith(evidence.appealId);
  });

  it("rejects evidence whose canonical IDs do not match the event", () => {
    const eventAppealId = "APL-260526-0900-EVENT01";

    expect(() =>
      evaluateAppealsPacketEvent(
        { eventType: "APPEAL_PACKET_READY", appealId: eventAppealId, umRequestId: evidence.umRequestId },
        {
          getEvidenceByAppealId: () => ({
            ...evidence,
            appealId: "APL-260526-0900-OTHER01"
          }),
          policy,
          monthToDateAmount: 0
        }
      )
    ).toThrow(`APPEALS_EVIDENCE_ID_MISMATCH:${eventAppealId}`);
    expect(() =>
      evaluateAppealsPacketEvent(
        { eventType: "APPEAL_PACKET_READY", appealId: eventAppealId, umRequestId: evidence.umRequestId },
        {
          getEvidenceByAppealId: () => ({
            ...evidence,
            appealId: eventAppealId,
            umRequestId: "PA-260526-0900-OTHER01"
          }),
          policy,
          monthToDateAmount: 0
        }
      )
    ).toThrow(`APPEALS_EVIDENCE_ID_MISMATCH:${eventAppealId}`);
  });

  it("keeps the demo request outcome-safe", () => {
    const request = getDemoEvaluationRequest("appeals_packet_quality");

    expect(request.requestObject).toMatchObject({
      appealId: "APL-260526-0900-DENIED01",
      appealOutcomeUsed: false,
      costSavingsMetricUsed: false,
      denialReversalMetricUsed: false,
      containsPhi: false
    });
  });
});
