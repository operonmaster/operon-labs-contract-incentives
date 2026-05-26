import { describe, expect, it } from "vitest";
import { evaluatePolicy, type EvaluationRequest, type IncentivePolicy } from "../src/index";

const basePolicy: IncentivePolicy = {
  policyId: "plcy_8K2M4Q6R9T1V3X5Z7B0C",
  version: "v1",
  status: "active",
  evaluationType: "provider_documentation_completeness",
  contractPair: {
    planId: "acme-health-ppo",
    planName: "Acme Health PPO",
    providerId: "lakeside-provider-admin",
    providerName: "Lakeside Provider Admin"
  },
  effectivePeriod: {
    startsOn: "2026-05-01",
    endsOn: null
  },
  incentiveScope: {
    eligibleRequestTypes: ["outpatient_service"],
    includedServiceCodes: {
      cpt: ["73721"],
      ndc: []
    }
  },
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: true,
    requiresDtrCompletionWhenRequested: true
  },
  payout: {
    token: "HBAR",
    amountPerEligibleRequest: 5,
    monthlyCap: 500
  },
  settlement: {
    mode: "auto",
    recipientWalletId: "0.0.9049549",
    requiresHumanApproval: false
  }
};

const approvedRequest: EvaluationRequest = {
  evaluationType: "provider_documentation_completeness",
  submitter: {
    id: "lakeside-provider-admin"
  },
  requestObject: {
    caseId: "PA-260524-2102-AAAA1111",
    planId: "acme-health-ppo",
    providerId: "lakeside-provider-admin",
    requestType: "outpatient_service",
    codingSystem: "CPT",
    billingCode: "73721",
    coveredBenefit: true,
    dtrRequested: true,
    dtrTemplateCompleted: true
  }
};

describe("evaluatePolicy", () => {
  it("approves a pair-scoped DTR completion incentive and computes the flat payout", () => {
    const result = evaluatePolicy({
      policy: basePolicy,
      request: approvedRequest,
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "approved",
      policyId: "plcy_8K2M4Q6R9T1V3X5Z7B0C",
      policyVersion: "v1",
      amount: 5,
      currency: "HBAR",
      walletId: "0.0.9049549",
      requiresHumanApproval: false,
      reasonCodes: []
    });
  });

  it("uses the policy payout token as the settlement currency", () => {
    const result = evaluatePolicy({
      policy: {
        ...basePolicy,
        payout: {
          ...basePolicy.payout,
          token: "OPRN"
        }
      },
      request: approvedRequest,
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      amount: 5,
      currency: "OPRN",
      settlementToken: {
        symbol: "OPRN"
      }
    });
  });

  it("routes manual settlement policies to manual review instead of approval", () => {
    const result = evaluatePolicy({
      policy: {
        ...basePolicy,
        settlement: {
          ...basePolicy.settlement,
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

  it("blocks when the submitting provider is not the contract provider", () => {
    const result = evaluatePolicy({
      policy: basePolicy,
      request: {
        ...approvedRequest,
        submitter: {
          id: "unknown-provider"
        },
        requestObject: {
          ...approvedRequest.requestObject,
          providerId: "unknown-provider"
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: ["PROVIDER_NOT_IN_CONTRACT"]
    });
  });

  it("enforces request type and service code scope with configured inclusion lists", () => {
    const notIncludedCovered = evaluatePolicy({
      policy: basePolicy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          billingCode: "76498",
          coveredBenefit: false,
          dtrRequested: false,
          dtrTemplateCompleted: false
        }
      },
      monthToDateAmount: 0
    });
    const notIncluded = evaluatePolicy({
      policy: basePolicy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          billingCode: "99999"
        }
      },
      monthToDateAmount: 0
    });

    expect(notIncludedCovered).toMatchObject({
      decision: "blocked",
      reasonCodes: expect.arrayContaining(["SERVICE_CODE_NOT_INCLUDED", "BENEFIT_NOT_COVERED"])
    });
    expect(notIncluded).toMatchObject({
      decision: "blocked",
      reasonCodes: expect.arrayContaining(["SERVICE_CODE_NOT_INCLUDED"])
    });
  });

  it("supports exclusion-only request type and service code policies", () => {
    const exclusionPolicy: IncentivePolicy = {
      ...basePolicy,
      incentiveScope: {
        excludedRequestTypes: ["inpatient_admission"],
        excludedServiceCodes: {
          cpt: ["76498"],
          ndc: []
        }
      }
    };

    const result = evaluatePolicy({
      policy: exclusionPolicy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          billingCode: "76498"
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "blocked",
      reasonCodes: ["SERVICE_CODE_EXCLUDED"]
    });
  });

  it("treats covered services without a requested DTR as not applicable to this policy", () => {
    const result = evaluatePolicy({
      policy: basePolicy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          dtrRequested: false,
          dtrTemplateCompleted: false
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "not_applicable",
      amount: 0,
      walletId: null,
      reasonCodes: ["DTR_NOT_REQUESTED"]
    });
  });

  it("blocks requested DTR submissions that were not completed", () => {
    const result = evaluatePolicy({
      policy: basePolicy,
      request: {
        ...approvedRequest,
        requestObject: {
          ...approvedRequest.requestObject,
          dtrTemplateCompleted: false
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: ["DTR_TEMPLATE_INCOMPLETE"]
    });
  });

  it("blocks payments that would exceed the monthly cap", () => {
    const result = evaluatePolicy({
      policy: basePolicy,
      request: approvedRequest,
      monthToDateAmount: 500
    });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      reasonCodes: ["MONTHLY_CAP_EXCEEDED"]
    });
  });
});
