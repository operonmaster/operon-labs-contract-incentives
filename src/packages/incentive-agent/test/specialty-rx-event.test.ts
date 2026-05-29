import { describe, expect, it, vi } from "vitest";
import type { IncentivePolicy } from "@operon-labs/policy-engine";
import {
  evaluateSpecialtyRxFulfillmentEvent,
  getDemoEvaluationRequest,
  type SpecialtyRxFulfillmentEvidence
} from "../src/index";

const policy: IncentivePolicy = {
  policyId: "specialty-rx-fulfillment-sla-v1",
  version: "v1",
  status: "active",
  evaluationType: "specialty_rx_fulfillment_sla",
  contractPair: {
    planId: "acme-health-ppo",
    planName: "Acme Health PPO",
    providerId: "atlas-specialty-rx",
    providerName: "Atlas Specialty Rx"
  },
  effectivePeriod: { startsOn: "2026-05-01", endsOn: null },
  incentiveScope: { eligibleRequestTypes: ["pharmacy_benefit"] },
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: false,
    requiresDtrCompletionWhenRequested: false,
    requiresShipmentScheduledWithinSla: true,
    requiresDeliveryConfirmedWithinSla: true,
    requiresColdChainEvidenceWhenRequired: true,
    requiresRemsAuthorizationWhenRequired: true,
    prohibitsAvoidableFulfillmentException: true
  },
  payout: {
    token: "HBAR",
    amountPerEligibleRequest: 5,
    monthlyCap: 700,
    coldChainHandlingAddOn: { amount: 2, maxPerRequest: 7 }
  },
  settlement: { mode: "auto", recipientWalletId: "0.0.9049549", requiresHumanApproval: false }
};

const evidence: SpecialtyRxFulfillmentEvidence = {
  fulfillmentCaseId: "RXF-260526-0900-DELEGATE",
  umRequestId: "PA-260526-0900-DELEGATE",
  planId: "acme-health-ppo",
  pharmacyId: "atlas-specialty-rx",
  requestType: "pharmacy_benefit",
  paOutcomeStatus: "approved",
  state: "fulfilled",
  clearToFillAt: "2026-06-18T16:00:00.000Z",
  shipmentScheduledAt: "2026-06-19T09:30:00.000Z",
  deliveryConfirmedAt: "2026-06-20T14:00:00.000Z",
  scheduleSlaHours: 24,
  deliverySlaHours: 72,
  intakeComplete: true,
  clearToFillComplete: true,
  shipmentScheduledWithinSla: true,
  deliveryConfirmedWithinSla: true,
  remsRequired: false,
  remsAuthorizationConfirmed: true,
  coldChainRequired: true,
  coldChainPackoutValidated: true,
  temperatureLogValid: true,
  avoidableFulfillmentException: false,
  externalBlockerDocumented: false,
  drugChoiceMetricUsed: false,
  fillVolumeMetricUsed: false,
  pharmacySteeringMetricUsed: false,
  patientAdherenceMetricUsed: false,
  containsPhi: false
};

describe("evaluateSpecialtyRxFulfillmentEvent", () => {
  it("pulls evidence by fulfillmentCaseId and builds the policy request", () => {
    const getEvidence = vi.fn(() => evidence);

    const evaluation = evaluateSpecialtyRxFulfillmentEvent(
      {
        eventType: "SPECIALTY_FULFILLMENT_COMPLETED",
        fulfillmentCaseId: evidence.fulfillmentCaseId,
        umRequestId: evidence.umRequestId
      },
      {
        getEvidenceByFulfillmentCaseId: getEvidence,
        policy,
        monthToDateAmount: 0
      }
    );

    expect(getEvidence).toHaveBeenCalledWith(evidence.fulfillmentCaseId);
    expect(evaluation.request).toMatchObject({
      evaluationType: "specialty_rx_fulfillment_sla",
      submitter: { id: "atlas-specialty-rx" },
      requestObject: {
        fulfillmentCaseId: evidence.fulfillmentCaseId,
        umRequestId: evidence.umRequestId,
        planId: "acme-health-ppo",
        pharmacyId: "atlas-specialty-rx",
        requestType: "pharmacy_benefit",
        paOutcomeStatus: "approved",
        state: "fulfilled",
        clearToFillAt: "2026-06-18T16:00:00.000Z",
        shipmentScheduledAt: "2026-06-19T09:30:00.000Z",
        deliveryConfirmedAt: "2026-06-20T14:00:00.000Z",
        scheduleSlaHours: 24,
        deliverySlaHours: 72,
        intakeComplete: true,
        clearToFillComplete: true,
        shipmentScheduledWithinSla: true,
        deliveryConfirmedWithinSla: true,
        remsRequired: false,
        remsAuthorizationConfirmed: true,
        coldChainRequired: true,
        coldChainPackoutValidated: true,
        temperatureLogValid: true,
        avoidableFulfillmentException: false,
        externalBlockerDocumented: false,
        drugChoiceMetricUsed: false,
        fillVolumeMetricUsed: false,
        pharmacySteeringMetricUsed: false,
        patientAdherenceMetricUsed: false,
        containsPhi: false
      }
    });
    expect(evaluation.result).toMatchObject({
      decision: "approved",
      amount: 7,
      reasonCodes: []
    });
  });

  it("rejects unsupported event types before evidence lookup", () => {
    const getEvidence = vi.fn();

    expect(() =>
      evaluateSpecialtyRxFulfillmentEvent(
        {
          eventType: "UM_REQUEST_DETERMINED",
          fulfillmentCaseId: evidence.fulfillmentCaseId,
          umRequestId: evidence.umRequestId
        },
        { getEvidenceByFulfillmentCaseId: getEvidence, policy, monthToDateAmount: 0 }
      )
    ).toThrow("UNSUPPORTED_SPECIALTY_RX_EVENT");
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("rejects non-canonical fulfillment case ids before evidence lookup", () => {
    const getEvidence = vi.fn();
    const fulfillmentCaseId = "CASE-260526-0900-EVENT01";

    expect(() =>
      evaluateSpecialtyRxFulfillmentEvent(
        {
          eventType: "SPECIALTY_FULFILLMENT_COMPLETED",
          fulfillmentCaseId,
          umRequestId: evidence.umRequestId
        },
        { getEvidenceByFulfillmentCaseId: getEvidence, policy, monthToDateAmount: 0 }
      )
    ).toThrow(`SPECIALTY_RX_EVENT_ID_NOT_CANONICAL:${fulfillmentCaseId}`);
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("rejects non-canonical UM request ids before evidence lookup", () => {
    const getEvidence = vi.fn();
    const umRequestId = "UMR-260526-0900-EVENT01";

    expect(() =>
      evaluateSpecialtyRxFulfillmentEvent(
        {
          eventType: "SPECIALTY_FULFILLMENT_COMPLETED",
          fulfillmentCaseId: evidence.fulfillmentCaseId,
          umRequestId
        },
        { getEvidenceByFulfillmentCaseId: getEvidence, policy, monthToDateAmount: 0 }
      )
    ).toThrow(`SPECIALTY_RX_UM_REQUEST_ID_NOT_CANONICAL:${umRequestId}`);
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("throws when specialty Rx evidence is missing for the fulfillmentCaseId", () => {
    const getEvidence = vi.fn(() => null);
    const missingFulfillmentCaseId = "RXF-260526-0900-MISSING1";

    expect(() =>
      evaluateSpecialtyRxFulfillmentEvent(
        {
          eventType: "SPECIALTY_FULFILLMENT_COMPLETED",
          fulfillmentCaseId: missingFulfillmentCaseId,
          umRequestId: evidence.umRequestId
        },
        { getEvidenceByFulfillmentCaseId: getEvidence, policy, monthToDateAmount: 0 }
      )
    ).toThrow(`SPECIALTY_RX_EVIDENCE_NOT_FOUND:${missingFulfillmentCaseId}`);
    expect(getEvidence).toHaveBeenCalledWith(missingFulfillmentCaseId);
  });

  it("rejects mismatched evidence ids", () => {
    const eventCaseId = "RXF-260526-0900-EVENT01";

    expect(() =>
      evaluateSpecialtyRxFulfillmentEvent(
        {
          eventType: "SPECIALTY_FULFILLMENT_COMPLETED",
          fulfillmentCaseId: eventCaseId,
          umRequestId: evidence.umRequestId
        },
        {
          getEvidenceByFulfillmentCaseId: () => ({
            ...evidence,
            fulfillmentCaseId: "RXF-260526-0900-OTHER01"
          }),
          policy,
          monthToDateAmount: 0
        }
      )
    ).toThrow(`SPECIALTY_RX_EVIDENCE_ID_MISMATCH:${eventCaseId}`);
  });

  it("rejects evidence whose UM request id does not match the event", () => {
    const eventCaseId = "RXF-260526-0900-EVENT02";

    expect(() =>
      evaluateSpecialtyRxFulfillmentEvent(
        {
          eventType: "SPECIALTY_FULFILLMENT_COMPLETED",
          fulfillmentCaseId: eventCaseId,
          umRequestId: evidence.umRequestId
        },
        {
          getEvidenceByFulfillmentCaseId: () => ({
            ...evidence,
            fulfillmentCaseId: eventCaseId,
            umRequestId: "PA-260526-0900-OTHER02"
          }),
          policy,
          monthToDateAmount: 0
        }
      )
    ).toThrow(`SPECIALTY_RX_EVIDENCE_ID_MISMATCH:${eventCaseId}`);
  });
});

describe("specialty Rx demo requests", () => {
  it("returns the specialty Rx fulfillment SLA demo request", () => {
    expect(getDemoEvaluationRequest("specialty_rx_fulfillment_sla")).toMatchObject({
      evaluationType: "specialty_rx_fulfillment_sla",
      submitter: { id: "atlas-specialty-rx" },
      requestObject: {
        fulfillmentCaseId: "RXF-260526-0900-DELEGATE",
        umRequestId: "PA-260526-0900-DELEGATE",
        planId: "acme-health-ppo",
        pharmacyId: "atlas-specialty-rx",
        requestType: "pharmacy_benefit",
        paOutcomeStatus: "approved",
        state: "fulfilled",
        containsPhi: false
      }
    });
  });

  it("does not register the provider directory quality demo request", () => {
    expect(() => getDemoEvaluationRequest("provider_directory_quality")).toThrow(
      "No demo scenario registered for provider_directory_quality"
    );
  });
});
