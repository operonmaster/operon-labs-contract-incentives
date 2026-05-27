export type TokenSymbol = "HBAR" | "USDC" | "OPER" | "OPRN" | (string & {});
export type Currency = TokenSymbol;

export type PolicyDecision = "approved" | "blocked" | "manual_review" | "not_applicable";
export type PolicyStatus = "active" | "inactive";
export type SettlementMode = "auto" | "manual";

export interface EvaluationRequest {
  evaluationType: string;
  submitter: {
    id: string;
  };
  requestObject: Record<string, unknown>;
}

export interface ServiceCodeSet {
  cpt: string[];
  ndc: string[];
}

export interface IncentivePolicy {
  policyId: string;
  version: string;
  status: PolicyStatus;
  evaluationType: string;
  contractPair: {
    planId: string;
    planName: string;
    providerId: string;
    providerName: string;
  };
  effectivePeriod: {
    startsOn: string;
    endsOn: string | null;
  };
  incentiveScope: {
    eligibleRequestTypes?: string[];
    excludedRequestTypes?: string[];
    includedServiceCodes?: ServiceCodeSet;
    excludedServiceCodes?: ServiceCodeSet;
  };
  eligibilityCriteria: {
    appliesOnlyToCoveredBenefits: boolean;
    requiresDtrCompletionWhenRequested: boolean;
    requiresDeterminationWithinSla?: boolean;
    requiresClinicalReviewCompletion?: boolean;
    prohibitsOutcomeBasedPayment?: boolean;
  };
  payout: {
    token: TokenSymbol;
    amountPerEligibleRequest: number;
    monthlyCap: number;
  };
  settlement: {
    mode: SettlementMode;
    recipientWalletId: string;
    requiresHumanApproval: boolean;
  };
}

export interface SettlementToken {
  symbol: TokenSymbol;
  hederaTokenId?: string;
  displayName?: string;
  decimals?: number;
}

export interface EvaluatePolicyInput {
  policy: IncentivePolicy;
  request: EvaluationRequest;
  monthToDateAmount: number;
}

export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  policyId: string;
  policyVersion: string;
  amount: number;
  currency: Currency;
  settlementToken: SettlementToken;
  walletId: string | null;
  requiresHumanApproval: boolean;
  reasonCodes: string[];
}

export function evaluatePolicy(input: EvaluatePolicyInput): PolicyEvaluationResult {
  const { policy, request, monthToDateAmount } = input;
  const reasonCodes: string[] = [];
  const token = policy.payout.token;

  if (policy.evaluationType === "delegate_um_sla_bonus") {
    return evaluateDelegateUmSlaPolicy(input);
  }

  if (request.evaluationType !== policy.evaluationType) {
    reasonCodes.push("EVALUATION_TYPE_MISMATCH");
  }

  if (policy.status !== "active") {
    reasonCodes.push("POLICY_INACTIVE");
  }

  if (request.requestObject.planId !== policy.contractPair.planId) {
    reasonCodes.push("PLAN_NOT_IN_CONTRACT");
  }

  const providerId = String(request.requestObject.providerId ?? request.submitter.id);
  if (providerId !== policy.contractPair.providerId || request.submitter.id !== policy.contractPair.providerId) {
    reasonCodes.push("PROVIDER_NOT_IN_CONTRACT");
  }

  const requestType = String(request.requestObject.requestType ?? "");
  const excludedRequestTypes = policy.incentiveScope.excludedRequestTypes ?? [];
  const eligibleRequestTypes = policy.incentiveScope.eligibleRequestTypes ?? [];
  if (excludedRequestTypes.includes(requestType)) {
    reasonCodes.push("REQUEST_TYPE_EXCLUDED");
  } else if (eligibleRequestTypes.length > 0 && !eligibleRequestTypes.includes(requestType)) {
    reasonCodes.push("REQUEST_TYPE_NOT_ELIGIBLE");
  }

  const codeGroup = codingSystemToServiceCodeGroup(request.requestObject.codingSystem);
  const billingCode = String(request.requestObject.billingCode ?? "");
  const excludedCodes = policy.incentiveScope.excludedServiceCodes?.[codeGroup] ?? [];
  const includedCodes = policy.incentiveScope.includedServiceCodes?.[codeGroup] ?? [];

  if (excludedCodes.includes(billingCode)) {
    reasonCodes.push("SERVICE_CODE_EXCLUDED");
  } else if (includedCodes.length > 0 && !includedCodes.includes(billingCode)) {
    reasonCodes.push("SERVICE_CODE_NOT_INCLUDED");
  }

  if (policy.eligibilityCriteria.appliesOnlyToCoveredBenefits && request.requestObject.coveredBenefit !== true) {
    reasonCodes.push("BENEFIT_NOT_COVERED");
  }

  if (policy.eligibilityCriteria.requiresDtrCompletionWhenRequested) {
    if (request.requestObject.coveredBenefit === true && request.requestObject.dtrRequested !== true) {
      return result({
        decision: "not_applicable",
        policy,
        reasonCodes: ["DTR_NOT_REQUESTED"],
        token
      });
    }

    if (request.requestObject.dtrRequested === true && request.requestObject.dtrTemplateCompleted !== true) {
      reasonCodes.push("DTR_TEMPLATE_INCOMPLETE");
    }
  }

  if (monthToDateAmount + policy.payout.amountPerEligibleRequest > policy.payout.monthlyCap) {
    reasonCodes.push("MONTHLY_CAP_EXCEEDED");
  }

  const blocked = reasonCodes.length > 0;
  if (!blocked && (policy.settlement.mode === "manual" || policy.settlement.requiresHumanApproval)) {
    return result({
      decision: "manual_review",
      policy,
      reasonCodes: ["MANUAL_REVIEW_REQUIRED"],
      token
    });
  }

  return result({
    decision: blocked ? "blocked" : "approved",
    policy,
    reasonCodes,
    token
  });
}

function evaluateDelegateUmSlaPolicy(input: EvaluatePolicyInput): PolicyEvaluationResult {
  const { policy, request, monthToDateAmount } = input;
  const reasonCodes: string[] = [];
  const token = policy.payout.token;

  if (request.evaluationType !== policy.evaluationType) {
    reasonCodes.push("EVALUATION_TYPE_MISMATCH");
  }

  if (policy.status !== "active") {
    reasonCodes.push("POLICY_INACTIVE");
  }

  if (request.requestObject.planId !== policy.contractPair.planId) {
    reasonCodes.push("PLAN_NOT_IN_CONTRACT");
  }

  if (request.submitter.id !== policy.contractPair.providerId || request.requestObject.delegateVendorId !== policy.contractPair.providerId) {
    reasonCodes.push("DELEGATE_VENDOR_NOT_IN_CONTRACT");
  }

  const requestType = String(request.requestObject.requestType ?? "");
  const eligibleRequestTypes = policy.incentiveScope.eligibleRequestTypes ?? [];
  if (eligibleRequestTypes.length > 0 && !eligibleRequestTypes.includes(requestType)) {
    reasonCodes.push("REQUEST_TYPE_NOT_ELIGIBLE");
  }

  if (request.requestObject.state !== "determined") {
    reasonCodes.push("UM_REQUEST_NOT_DETERMINED");
  }

  if (request.requestObject.outcomeStatusPresent !== true || typeof request.requestObject.outcomeStatus !== "string") {
    reasonCodes.push("OUTCOME_STATUS_MISSING");
  }

  if (policy.eligibilityCriteria.requiresDeterminationWithinSla && request.requestObject.completedWithinSla !== true) {
    reasonCodes.push("SLA_EXCEEDED");
  }

  if (policy.eligibilityCriteria.requiresClinicalReviewCompletion) {
    if (request.requestObject.clinicalReviewCompleted !== true) {
      reasonCodes.push("CLINICAL_REVIEW_INCOMPLETE");
    }

    if (request.requestObject.medicalNecessityReviewed !== true) {
      reasonCodes.push("MEDICAL_NECESSITY_NOT_REVIEWED");
    }

    if (request.requestObject.policyCriteriaChecked !== true) {
      reasonCodes.push("POLICY_CRITERIA_NOT_CHECKED");
    }

    if (request.requestObject.rationaleCaptured !== true) {
      reasonCodes.push("RATIONALE_NOT_CAPTURED");
    }
  }

  if (request.requestObject.auditReady !== true) {
    reasonCodes.push("PAS_AUDIT_RECORD_MISSING");
  }

  if (policy.eligibilityCriteria.prohibitsOutcomeBasedPayment && request.requestObject.outcomeStatusUsedForPayment !== false) {
    reasonCodes.push("PROHIBITED_OUTCOME_METRIC");
  }

  if (request.requestObject.containsPhi !== false) {
    reasonCodes.push("PHI_IN_PAYMENT_METADATA");
  }

  if (monthToDateAmount + policy.payout.amountPerEligibleRequest > policy.payout.monthlyCap) {
    reasonCodes.push("MONTHLY_CAP_EXCEEDED");
  }

  return result({
    decision: reasonCodes.length > 0 ? "blocked" : "approved",
    policy,
    reasonCodes,
    token
  });
}

function result({
  decision,
  policy,
  reasonCodes,
  token
}: {
  decision: PolicyDecision;
  policy: IncentivePolicy;
  reasonCodes: string[];
  token: TokenSymbol;
}): PolicyEvaluationResult {
  const approved = decision === "approved";

  return {
    decision,
    policyId: policy.policyId,
    policyVersion: policy.version,
    amount: approved ? policy.payout.amountPerEligibleRequest : 0,
    currency: token,
    settlementToken: {
      symbol: token
    },
    walletId: approved ? policy.settlement.recipientWalletId : null,
    requiresHumanApproval: policy.settlement.requiresHumanApproval,
    reasonCodes
  };
}

function codingSystemToServiceCodeGroup(value: unknown): keyof ServiceCodeSet {
  return String(value).toUpperCase() === "NDC" ? "ndc" : "cpt";
}
