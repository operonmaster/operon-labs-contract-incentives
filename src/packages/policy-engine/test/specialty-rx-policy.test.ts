import { describe, expect, it } from "vitest";
import { evaluatePolicy, type EvaluationRequest, type IncentivePolicy } from "../src/index";

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
  effectivePeriod: {
    startsOn: "2026-05-01",
    endsOn: null
  },
  incentiveScope: {
    eligibleRequestTypes: ["pharmacy_benefit"]
  },
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: false,
    requiresDtrCompletionWhenRequested: false,
    requiresShipmentScheduledWithinSla: true,
    requiresDeliveryClosureEvidence: true,
    requiresColdChainEvidenceWhenRequired: true,
    requiresRemsAuthorizationWhenRequired: true,
    prohibitsAvoidableFulfillmentException: true
  },
  payout: {
    token: "HBAR",
    amountPerEligibleRequest: 5,
    monthlyCap: 700,
    coldChainHandlingAddOn: {
      amount: 2,
      maxPerRequest: 7
    }
  },
  settlement: {
    mode: "auto",
    recipientWalletId: "0.0.9049549",
    requiresHumanApproval: false
  }
};

const approvedRequest: EvaluationRequest = {
  evaluationType: "specialty_rx_fulfillment_sla",
  submitter: {
    id: "atlas-specialty-rx"
  },
  requestObject: {
    fulfillmentCaseId: "RXF-260526-0900-DELEGATE",
    umRequestId: "PA-260526-0900-DELEGATE",
    planId: "acme-health-ppo",
    pharmacyId: "atlas-specialty-rx",
    requestType: "pharmacy_benefit",
    paOutcomeStatus: "approved",
    state: "fulfilled",
    intakeComplete: true,
    clearToFillComplete: true,
    clearToFillAt: "2026-06-18T16:00:00.000Z",
    shipmentScheduledAt: "2026-06-19T09:30:00.000Z",
    deliveryConfirmedAt: "2026-06-20T14:00:00.000Z",
    scheduleSlaHours: 24,
    shipmentScheduledWithinSla: true,
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
};

describe("specialty_rx_fulfillment_sla policy", () => {
  it("approves clean fulfillment and adds the cold-chain handling amount", () => {
    const result = evaluatePolicy({ policy, request: approvedRequest, monthToDateAmount: 0 });

    expect(result).toMatchObject({
      decision: "approved",
      policyId: "specialty-rx-fulfillment-sla-v1",
      amount: 7,
      currency: "HBAR",
      walletId: "0.0.9049549",
      reasonCodes: []
    });
  });

  it("blocks late shipment from the clear-to-fill timestamp", () => {
    const result = evaluatePolicy({
      policy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          shipmentScheduledWithinSla: false
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: ["SHIPMENT_SLA_EXCEEDED"]
    });
  });

  it("does not treat delivery timing as the paid fulfillment SLA", () => {
    const result = evaluatePolicy({
      policy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          deliveryConfirmedAt: "2026-06-22T17:00:00.000Z"
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "approved",
      amount: 7,
      walletId: "0.0.9049549",
      reasonCodes: []
    });
  });

  it("blocks missing delivery closure evidence without using delivery SLA reason codes", () => {
    const result = evaluatePolicy({
      policy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          deliveryConfirmedAt: null
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: ["DELIVERY_CLOSURE_EVIDENCE_MISSING"]
    });
    expect(result.reasonCodes).not.toContain("DELIVERY_SLA_EXCEEDED");
  });

  it("blocks prohibited commercial metrics and PHI payment metadata", () => {
    const result = evaluatePolicy({
      policy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          drugChoiceMetricUsed: true,
          fillVolumeMetricUsed: true,
          pharmacySteeringMetricUsed: true,
          patientAdherenceMetricUsed: true,
          containsPhi: true
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: [
        "PROHIBITED_DRUG_CHOICE_METRIC",
        "PROHIBITED_FILL_VOLUME_METRIC",
        "PROHIBITED_PHARMACY_STEERING_METRIC",
        "PROHIBITED_PATIENT_ADHERENCE_METRIC",
        "PHI_IN_PAYMENT_METADATA"
      ]
    });
  });

  it("treats documented external blockers as not applicable instead of pharmacy failure", () => {
    const result = evaluatePolicy({
      policy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          state: "exception",
          externalBlockerDocumented: true
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "not_applicable",
      amount: 0,
      walletId: null,
      reasonCodes: ["EXTERNAL_BLOCKER_DOCUMENTED"]
    });
  });

  it("does not let external blockers hide contract or payment-safety failures", () => {
    const result = evaluatePolicy({
      policy,
      request: {
        ...approvedRequest,
        submitter: {
          id: "unknown-specialty-rx"
        },
        requestObject: {
          ...approvedRequest.requestObject,
          planId: "wrong-plan",
          pharmacyId: "unknown-specialty-rx",
          externalBlockerDocumented: true,
          drugChoiceMetricUsed: true,
          containsPhi: true
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: [
        "PLAN_NOT_IN_CONTRACT",
        "SPECIALTY_PHARMACY_NOT_IN_CONTRACT",
        "PROHIBITED_DRUG_CHOICE_METRIC",
        "PHI_IN_PAYMENT_METADATA"
      ]
    });
  });

  it("routes manual specialty policies to manual review", () => {
    const result = evaluatePolicy({
      policy: {
        ...policy,
        settlement: {
          ...policy.settlement,
          mode: "manual",
          requiresHumanApproval: true
        }
      },
      request: approvedRequest,
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "manual_review",
      amount: 0,
      walletId: null,
      requiresHumanApproval: true,
      reasonCodes: ["MANUAL_REVIEW_REQUIRED"]
    });
  });

  it("enforces the monthly cap after cold-chain add-on calculation", () => {
    const result = evaluatePolicy({ policy, request: approvedRequest, monthToDateAmount: 698 });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: ["MONTHLY_CAP_EXCEEDED"]
    });
  });
});
