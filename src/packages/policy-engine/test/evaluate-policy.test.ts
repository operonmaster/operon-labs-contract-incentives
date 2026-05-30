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

const delegatePolicy: IncentivePolicy = {
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
  effectivePeriod: {
    startsOn: "2026-05-01",
    endsOn: null
  },
  incentiveScope: {
    eligibleRequestTypes: ["outpatient_service", "pharmacy_benefit"]
  },
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: false,
    requiresDtrCompletionWhenRequested: false,
    requiresDeterminationWithinSla: true,
    requiresClinicalReviewCompletion: true
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

const approvedDelegateRequest: EvaluationRequest = {
  evaluationType: "delegate_um_sla_bonus",
  submitter: {
    id: "northstar-um"
  },
  requestObject: {
    umRequestId: "PA-260526-0900-AAAA1111",
    planId: "acme-health-ppo",
    delegateVendorId: "northstar-um",
    requestType: "outpatient_service",
    state: "determined",
    outcomeStatusPresent: true,
    outcomeStatus: "approved",
    completedWithinSla: true,
    slaHours: 24,
    clinicalDocumentationReviewed: true,
    medicalNecessityCriteriaMet: true,
    planPolicyRequirementsChecked: true,
    decisionRationaleDocumented: true,
    auditReady: true
  }
};

const appealsPolicy = {
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
} satisfies IncentivePolicy;

const completeAppealRequest = {
  evaluationType: "appeals_packet_quality",
  submitter: { id: "lakeside-provider-admin" },
  requestObject: {
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
  }
} satisfies EvaluationRequest;

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

  it("approves delegate UM SLA bonus for approved and denied determinations when review evidence passes", () => {
    const approved = evaluatePolicy({
      policy: delegatePolicy,
      request: approvedDelegateRequest,
      monthToDateAmount: 0
    });
    const denied = evaluatePolicy({
      policy: delegatePolicy,
      request: {
        ...approvedDelegateRequest,
        requestObject: {
          ...approvedDelegateRequest.requestObject,
          outcomeStatus: "denied"
        }
      },
      monthToDateAmount: 0
    });

    expect(approved).toMatchObject({
      decision: "approved",
      amount: 5,
      currency: "HBAR",
      walletId: "0.0.9049549",
      reasonCodes: []
    });
    expect(denied).toMatchObject({
      decision: "approved",
      amount: 5,
      walletId: "0.0.9049549",
      reasonCodes: []
    });
  });

  it("does not block delegate UM SLA bonus policies based on UM request PHI markers", () => {
    const result = evaluatePolicy({
      policy: delegatePolicy,
      request: {
        ...approvedDelegateRequest,
        requestObject: {
          ...approvedDelegateRequest.requestObject,
          containsPhi: true
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "approved",
      amount: 5,
      walletId: "0.0.9049549",
      reasonCodes: []
    });
  });

  it("routes delegate UM SLA policies requiring manual settlement to manual review", () => {
    const result = evaluatePolicy({
      policy: {
        ...delegatePolicy,
        settlement: {
          ...delegatePolicy.settlement,
          mode: "manual",
          requiresHumanApproval: true
        }
      },
      request: approvedDelegateRequest,
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

  it("blocks delegate UM SLA bonus when request type is excluded before eligible scope is applied", () => {
    const exclusionOnly = evaluatePolicy({
      policy: {
        ...delegatePolicy,
        incentiveScope: {
          excludedRequestTypes: ["inpatient_admission"]
        }
      },
      request: {
        ...approvedDelegateRequest,
        requestObject: {
          ...approvedDelegateRequest.requestObject,
          requestType: "inpatient_admission"
        }
      },
      monthToDateAmount: 0
    });
    const exclusionWins = evaluatePolicy({
      policy: {
        ...delegatePolicy,
        incentiveScope: {
          eligibleRequestTypes: ["outpatient_service", "inpatient_admission"],
          excludedRequestTypes: ["inpatient_admission"]
        }
      },
      request: {
        ...approvedDelegateRequest,
        requestObject: {
          ...approvedDelegateRequest.requestObject,
          requestType: "inpatient_admission"
        }
      },
      monthToDateAmount: 0
    });

    expect(exclusionOnly).toMatchObject({
      decision: "blocked",
      amount: 0,
      reasonCodes: ["REQUEST_TYPE_EXCLUDED"]
    });
    expect(exclusionWins).toMatchObject({
      decision: "blocked",
      amount: 0,
      reasonCodes: ["REQUEST_TYPE_EXCLUDED"]
    });
  });

  it("blocks delegate UM SLA bonus when SLA is exceeded", () => {
    const late = evaluatePolicy({
      policy: delegatePolicy,
      request: {
        ...approvedDelegateRequest,
        requestObject: {
          ...approvedDelegateRequest.requestObject,
          completedWithinSla: false
        }
      },
      monthToDateAmount: 0
    });

    expect(late).toMatchObject({
      decision: "blocked",
      amount: 0,
      reasonCodes: expect.arrayContaining(["SLA_EXCEEDED"])
    });
  });

  it("approves complete appeals packet readiness evidence without using outcome", () => {
    const result = evaluatePolicy({ policy: appealsPolicy, request: completeAppealRequest, monthToDateAmount: 0 });

    expect(result).toMatchObject({
      decision: "approved",
      amount: 6,
      walletId: "0.0.9049549",
      reasonCodes: []
    });
  });

  it("blocks appeals incentives when outcome or cost metrics are used", () => {
    const result = evaluatePolicy({
      policy: appealsPolicy,
      request: {
        ...completeAppealRequest,
        requestObject: {
          ...completeAppealRequest.requestObject,
          appealOutcomeUsed: true,
          costSavingsMetricUsed: true,
          denialReversalMetricUsed: true
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: expect.arrayContaining([
        "PROHIBITED_APPEAL_OUTCOME_METRIC",
        "PROHIBITED_COST_SAVINGS_METRIC",
        "PROHIBITED_DENIAL_REVERSAL_METRIC"
      ])
    });
  });

  it("blocks appeals incentives when outcome safety flags or PHI markers are missing or non-boolean", () => {
    const {
      appealOutcomeUsed: _appealOutcomeUsed,
      costSavingsMetricUsed: _costSavingsMetricUsed,
      denialReversalMetricUsed: _denialReversalMetricUsed,
      containsPhi: _containsPhi,
      ...missingSafetyFlags
    } = completeAppealRequest.requestObject;
    const missing = evaluatePolicy({
      policy: appealsPolicy,
      request: {
        ...completeAppealRequest,
        requestObject: missingSafetyFlags
      },
      monthToDateAmount: 0
    });
    const nonBoolean = evaluatePolicy({
      policy: appealsPolicy,
      request: {
        ...completeAppealRequest,
        requestObject: {
          ...completeAppealRequest.requestObject,
          appealOutcomeUsed: "false",
          costSavingsMetricUsed: "false",
          denialReversalMetricUsed: "false",
          containsPhi: "false"
        }
      },
      monthToDateAmount: 0
    });

    for (const result of [missing, nonBoolean]) {
      expect(result).toMatchObject({
        decision: "blocked",
        amount: 0,
        walletId: null,
        reasonCodes: expect.arrayContaining([
          "PROHIBITED_APPEAL_OUTCOME_METRIC",
          "PROHIBITED_COST_SAVINGS_METRIC",
          "PROHIBITED_DENIAL_REVERSAL_METRIC",
          "PHI_IN_PAYMENT_METADATA"
        ])
      });
    }
  });

  it("enforces appeals request type eligibility and exclusions", () => {
    const notEligible = evaluatePolicy({
      policy: {
        ...appealsPolicy,
        incentiveScope: {
          eligibleRequestTypes: ["outpatient_service"]
        }
      },
      request: completeAppealRequest,
      monthToDateAmount: 0
    });
    const excluded = evaluatePolicy({
      policy: {
        ...appealsPolicy,
        incentiveScope: {
          eligibleRequestTypes: ["pharmacy_benefit"],
          excludedRequestTypes: ["pharmacy_benefit"]
        }
      },
      request: completeAppealRequest,
      monthToDateAmount: 0
    });

    expect(notEligible).toMatchObject({
      decision: "blocked",
      amount: 0,
      reasonCodes: expect.arrayContaining(["REQUEST_TYPE_NOT_ELIGIBLE"])
    });
    expect(excluded).toMatchObject({
      decision: "blocked",
      amount: 0,
      reasonCodes: expect.arrayContaining(["REQUEST_TYPE_EXCLUDED"])
    });
  });

  it("requires timestamp evidence when appeals SLA flags are true", () => {
    const result = evaluatePolicy({
      policy: appealsPolicy,
      request: {
        ...completeAppealRequest,
        requestObject: {
          ...completeAppealRequest.requestObject,
          acknowledgedAt: null,
          packetReadyAt: null,
          acknowledgedWithinSla: true,
          packetReadyWithinSla: true
        }
      },
      monthToDateAmount: 0
    });

    expect(result).toMatchObject({
      decision: "blocked",
      amount: 0,
      reasonCodes: expect.arrayContaining(["ACKNOWLEDGEMENT_SLA_EXCEEDED", "PACKET_READINESS_SLA_EXCEEDED"])
    });
  });
});
