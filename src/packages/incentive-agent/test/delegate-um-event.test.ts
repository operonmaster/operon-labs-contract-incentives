import { describe, expect, it, vi } from "vitest";
import type { IncentivePolicy } from "@operon-labs/policy-engine";
import { evaluateDelegateUmSlaEvent, type DelegateUmSlaEvidence } from "../src/index";

const policy: IncentivePolicy = {
  policyId: "delegate-um-sla-bonus-v1",
  version: "v1",
  status: "active",
  evaluationType: "delegate_um_sla_bonus",
  contractPair: {
    planId: "acme-health-ppo",
    planName: "Acme Health PPO",
    providerId: "northstar-um",
    providerName: "Northstar UM"
  },
  effectivePeriod: { startsOn: "2026-05-01", endsOn: null },
  incentiveScope: { eligibleRequestTypes: ["pharmacy_benefit"] },
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: false,
    requiresDtrCompletionWhenRequested: false,
    requiresDeterminationWithinSla: true,
    requiresClinicalReviewCompletion: true
  },
  payout: { token: "HBAR", amountPerEligibleRequest: 5, monthlyCap: 500 },
  settlement: { mode: "auto", recipientWalletId: "0.0.9049549", requiresHumanApproval: false }
};

const evidence: DelegateUmSlaEvidence = {
  umRequestId: "PA-260526-0900-AAAA1111",
  id: "PA-260526-0900-AAAA1111",
  planId: "acme-health-ppo",
  delegateVendorId: "northstar-um",
  requestType: "pharmacy_benefit",
  state: "determined",
  outcomeStatus: "denied",
  outcomeStatusPresent: true,
  completedWithinSla: true,
  slaHours: 24,
  clinicalDocumentationReviewed: true,
  medicalNecessityCriteriaMet: true,
  planPolicyRequirementsChecked: true,
  decisionRationaleDocumented: true,
  auditReady: true
};

describe("evaluateDelegateUmSlaEvent", () => {
  it("pulls delegate evidence by umRequestId and approves denied determinations without using outcome value", () => {
    const getEvidence = vi.fn(() => evidence);

    const evaluation = evaluateDelegateUmSlaEvent(
      { eventType: "UM_REQUEST_DETERMINED", umRequestId: evidence.umRequestId },
      { getEvidenceByUmRequestId: getEvidence, policy, monthToDateAmount: 0 }
    );

    expect(getEvidence).toHaveBeenCalledWith(evidence.umRequestId);
    expect(evaluation.request).toMatchObject({
      evaluationType: "delegate_um_sla_bonus",
      submitter: { id: "northstar-um" },
      requestObject: {
        umRequestId: evidence.umRequestId,
        id: evidence.id,
        planId: "acme-health-ppo",
        delegateVendorId: "northstar-um",
        requestType: "pharmacy_benefit",
        state: "determined",
        outcomeStatus: "denied",
        outcomeStatusPresent: true,
        completedWithinSla: true,
        slaHours: 24,
        clinicalDocumentationReviewed: true,
        medicalNecessityCriteriaMet: true,
        planPolicyRequirementsChecked: true,
        decisionRationaleDocumented: true,
        auditReady: true
      }
    });
    expect(evaluation.request.requestObject).not.toHaveProperty("containsPhi");
    expect(evaluation.request.requestObject).not.toHaveProperty("outcomeStatusUsedForPayment");
    expect(evaluation.result).toMatchObject({
      decision: "approved",
      amount: 5,
      walletId: "0.0.9049549",
      reasonCodes: []
    });
  });

  it("throws before evidence lookup for unsupported events", () => {
    const getEvidence = vi.fn();

    expect(() =>
      evaluateDelegateUmSlaEvent(
        { eventType: "UM_REQUEST_CREATED", umRequestId: evidence.umRequestId },
        { getEvidenceByUmRequestId: getEvidence, policy, monthToDateAmount: 0 }
      )
    ).toThrow("UNSUPPORTED_DELEGATE_UM_EVENT");
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("rejects UM request events whose caseId does not match the umRequestId before evidence lookup", () => {
    const getEvidence = vi.fn();
    const umRequestId = "PA-260526-0900-EVENT001";

    expect(() =>
      evaluateDelegateUmSlaEvent(
        {
          eventType: "UM_REQUEST_DETERMINED",
          umRequestId,
          caseId: "PA-260526-0900-OTHER001"
        },
        { getEvidenceByUmRequestId: getEvidence, policy, monthToDateAmount: 0 }
      )
    ).toThrow(`DELEGATE_UM_EVENT_ID_MISMATCH:${umRequestId}`);
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("rejects matching legacy UMR ids before evidence lookup", () => {
    const getEvidence = vi.fn();
    const umRequestId = "UMR-260526-0900-LEGACY1";

    expect(() =>
      evaluateDelegateUmSlaEvent(
        {
          eventType: "UM_REQUEST_DETERMINED",
          umRequestId,
          caseId: umRequestId
        },
        { getEvidenceByUmRequestId: getEvidence, policy, monthToDateAmount: 0 }
      )
    ).toThrow(`DELEGATE_UM_EVENT_ID_NOT_CANONICAL:${umRequestId}`);
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("throws when delegate evidence is missing for the umRequestId", () => {
    const getEvidence = vi.fn(() => null);
    const missingUmRequestId = "PA-260526-0900-MISSING1";

    expect(() =>
      evaluateDelegateUmSlaEvent(
        { eventType: "UM_REQUEST_DETERMINED", umRequestId: missingUmRequestId },
        { getEvidenceByUmRequestId: getEvidence, policy, monthToDateAmount: 0 }
      )
    ).toThrow(`DELEGATE_UM_EVIDENCE_NOT_FOUND:${missingUmRequestId}`);
    expect(getEvidence).toHaveBeenCalledWith(missingUmRequestId);
  });

  it("rejects evidence whose canonical ids do not match the event UM request id", () => {
    const eventUmRequestId = "PA-260526-0900-EVENT001";
    const mismatchedEvidence: DelegateUmSlaEvidence = {
      ...evidence,
      id: "PA-260526-0900-OTHER001",
      umRequestId: "PA-260526-0900-OTHER001"
    };

    expect(() =>
      evaluateDelegateUmSlaEvent(
        { eventType: "UM_REQUEST_DETERMINED", umRequestId: eventUmRequestId },
        { getEvidenceByUmRequestId: () => mismatchedEvidence, policy, monthToDateAmount: 0 }
      )
    ).toThrow(`DELEGATE_UM_EVIDENCE_ID_MISMATCH:${eventUmRequestId}`);
  });
});
