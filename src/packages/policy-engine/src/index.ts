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
    requiresShipmentScheduledWithinSla?: boolean;
    requiresDeliveryConfirmedWithinSla?: boolean;
    requiresColdChainEvidenceWhenRequired?: boolean;
    requiresRemsAuthorizationWhenRequired?: boolean;
    prohibitsAvoidableFulfillmentException?: boolean;
  };
  payout: {
    token: TokenSymbol;
    amountPerEligibleRequest: number;
    monthlyCap: number;
    coldChainHandlingAddOn?: {
      amount: number;
      maxPerRequest: number;
    };
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

  if (policy.evaluationType === "specialty_rx_fulfillment_sla") {
    return evaluateSpecialtyRxFulfillmentPolicy(input);
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
  const excludedRequestTypes = policy.incentiveScope.excludedRequestTypes ?? [];
  const eligibleRequestTypes = policy.incentiveScope.eligibleRequestTypes ?? [];
  if (excludedRequestTypes.includes(requestType)) {
    reasonCodes.push("REQUEST_TYPE_EXCLUDED");
  } else if (eligibleRequestTypes.length > 0 && !eligibleRequestTypes.includes(requestType)) {
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
    if (request.requestObject.clinicalDocumentationReviewed !== true) {
      reasonCodes.push("CLINICAL_DOCUMENTATION_NOT_REVIEWED");
    }

    if (request.requestObject.medicalNecessityCriteriaMet !== true) {
      reasonCodes.push("MEDICAL_NECESSITY_CRITERIA_NOT_MET");
    }

    if (request.requestObject.planPolicyRequirementsChecked !== true) {
      reasonCodes.push("PLAN_POLICY_REQUIREMENTS_NOT_CHECKED");
    }

    if (request.requestObject.decisionRationaleDocumented !== true) {
      reasonCodes.push("DECISION_RATIONALE_NOT_DOCUMENTED");
    }
  }

  if (request.requestObject.auditReady !== true) {
    reasonCodes.push("PAS_AUDIT_RECORD_MISSING");
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

function evaluateSpecialtyRxFulfillmentPolicy(input: EvaluatePolicyInput): PolicyEvaluationResult {
  const { policy, request, monthToDateAmount } = input;
  const reasonCodes: string[] = [];
  const token = policy.payout.token;
  const externalBlockerDocumented = request.requestObject.externalBlockerDocumented === true;

  if (request.evaluationType !== policy.evaluationType) {
    reasonCodes.push("EVALUATION_TYPE_MISMATCH");
  }

  if (policy.status !== "active") {
    reasonCodes.push("POLICY_INACTIVE");
  }

  if (request.requestObject.planId !== policy.contractPair.planId) {
    reasonCodes.push("PLAN_NOT_IN_CONTRACT");
  }

  if (request.submitter.id !== policy.contractPair.providerId || request.requestObject.pharmacyId !== policy.contractPair.providerId) {
    reasonCodes.push("SPECIALTY_PHARMACY_NOT_IN_CONTRACT");
  }

  const requestType = String(request.requestObject.requestType ?? "");
  const excludedRequestTypes = policy.incentiveScope.excludedRequestTypes ?? [];
  const eligibleRequestTypes = policy.incentiveScope.eligibleRequestTypes ?? [];
  if (excludedRequestTypes.includes(requestType)) {
    reasonCodes.push("REQUEST_TYPE_EXCLUDED");
  } else if (eligibleRequestTypes.length > 0 && !eligibleRequestTypes.includes(requestType)) {
    reasonCodes.push("REQUEST_TYPE_NOT_ELIGIBLE");
  }

  if (request.requestObject.paOutcomeStatus !== "approved") {
    reasonCodes.push("LINKED_PA_NOT_APPROVED");
  }

  if (request.requestObject.state !== "fulfilled" && !externalBlockerDocumented) {
    reasonCodes.push("FULFILLMENT_NOT_COMPLETE");
  }

  if (request.requestObject.intakeComplete !== true) {
    reasonCodes.push("INTAKE_INCOMPLETE");
  }

  if (request.requestObject.clearToFillComplete !== true || typeof request.requestObject.clearToFillAt !== "string") {
    reasonCodes.push("CLEAR_TO_FILL_INCOMPLETE");
  }

  if (request.requestObject.drugChoiceMetricUsed === true) {
    reasonCodes.push("PROHIBITED_DRUG_CHOICE_METRIC");
  }

  if (request.requestObject.fillVolumeMetricUsed === true) {
    reasonCodes.push("PROHIBITED_FILL_VOLUME_METRIC");
  }

  if (request.requestObject.pharmacySteeringMetricUsed === true) {
    reasonCodes.push("PROHIBITED_PHARMACY_STEERING_METRIC");
  }

  if (request.requestObject.patientAdherenceMetricUsed === true) {
    reasonCodes.push("PROHIBITED_PATIENT_ADHERENCE_METRIC");
  }

  if (request.requestObject.containsPhi === true) {
    reasonCodes.push("PHI_IN_PAYMENT_METADATA");
  }

  if (
    policy.eligibilityCriteria.requiresColdChainEvidenceWhenRequired &&
    request.requestObject.coldChainRequired === true &&
    (request.requestObject.coldChainPackoutValidated !== true || request.requestObject.temperatureLogValid !== true)
  ) {
    reasonCodes.push("COLD_CHAIN_EVIDENCE_INVALID");
  }

  if (
    policy.eligibilityCriteria.requiresRemsAuthorizationWhenRequired &&
    request.requestObject.remsRequired === true &&
    request.requestObject.remsAuthorizationConfirmed !== true
  ) {
    reasonCodes.push("REMS_AUTHORIZATION_MISSING");
  }

  if (policy.eligibilityCriteria.prohibitsAvoidableFulfillmentException && request.requestObject.avoidableFulfillmentException === true) {
    reasonCodes.push("AVOIDABLE_FULFILLMENT_EXCEPTION");
  }

  if (externalBlockerDocumented && reasonCodes.length === 0) {
    return result({
      decision: "not_applicable",
      policy,
      reasonCodes: ["EXTERNAL_BLOCKER_DOCUMENTED"],
      token
    });
  }

  if (
    policy.eligibilityCriteria.requiresShipmentScheduledWithinSla &&
    request.requestObject.shipmentScheduledWithinSla !== true &&
    !externalBlockerDocumented
  ) {
    reasonCodes.push("SHIPMENT_SLA_EXCEEDED");
  }

  if (
    policy.eligibilityCriteria.requiresDeliveryConfirmedWithinSla &&
    request.requestObject.deliveryConfirmedWithinSla !== true &&
    !externalBlockerDocumented
  ) {
    reasonCodes.push("DELIVERY_SLA_EXCEEDED");
  }

  const amount = specialtyRxFulfillmentAmount(policy, request);
  if (monthToDateAmount + amount > policy.payout.monthlyCap) {
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
    token,
    amountOverride: amount
  });
}

function specialtyRxFulfillmentAmount(policy: IncentivePolicy, request: EvaluationRequest): number {
  const baseAmount = policy.payout.amountPerEligibleRequest;
  const addOn = policy.payout.coldChainHandlingAddOn;
  if (
    !addOn ||
    request.requestObject.coldChainRequired !== true ||
    request.requestObject.coldChainPackoutValidated !== true ||
    request.requestObject.temperatureLogValid !== true
  ) {
    return baseAmount;
  }

  return Math.min(baseAmount + addOn.amount, addOn.maxPerRequest);
}

function result({
  decision,
  policy,
  reasonCodes,
  token,
  amountOverride
}: {
  decision: PolicyDecision;
  policy: IncentivePolicy;
  reasonCodes: string[];
  token: TokenSymbol;
  amountOverride?: number;
}): PolicyEvaluationResult {
  const approved = decision === "approved";

  return {
    decision,
    policyId: policy.policyId,
    policyVersion: policy.version,
    amount: approved ? (amountOverride ?? policy.payout.amountPerEligibleRequest) : 0,
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
