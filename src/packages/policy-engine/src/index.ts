export type Currency = "HBAR" | "USDC";

export type PolicyDecision = "approved" | "blocked" | "manual_review";

export interface EvaluationRequest {
  evaluationType: string;
  submitter: {
    type: string;
    id: string;
  };
  requestObject: Record<string, unknown>;
}

export interface SubmitterRules {
  allowedSubmitterTypes: string[];
  allowedSubmitters: string[];
  walletMap: Record<string, string>;
}

export interface ApprovalRule {
  field: string;
  operator: "equals" | "in";
  value: unknown;
  reasonCode: string;
}

export interface PaymentFormula {
  baseAmount: number;
  maxPerRequest: number;
  monthlyCap: number;
}

export interface IncentivePolicy {
  id: string;
  evaluationType: string;
  currency: Currency;
  submitterRules: SubmitterRules;
  requiredEvidence: string[];
  approvalRules: ApprovalRule[];
  paymentFormula: PaymentFormula;
  requiresHumanApproval: boolean;
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
  walletId: string | null;
  requiresHumanApproval: boolean;
  reasonCodes: string[];
}

export function evaluatePolicy(input: EvaluatePolicyInput): PolicyEvaluationResult {
  const { policy, request, monthToDateAmount } = input;
  const reasonCodes: string[] = [];
  const walletId = policy.submitterRules.walletMap[request.submitter.id] ?? null;

  if (request.evaluationType !== policy.evaluationType) {
    reasonCodes.push("EVALUATION_TYPE_MISMATCH");
  }

  if (!policy.submitterRules.allowedSubmitterTypes.includes(request.submitter.type)) {
    reasonCodes.push("SUBMITTER_TYPE_NOT_ALLOWED");
  }

  if (!policy.submitterRules.allowedSubmitters.includes(request.submitter.id)) {
    reasonCodes.push("SUBMITTER_NOT_ALLOWED");
  }

  if (walletId === null) {
    reasonCodes.push("WALLET_NOT_APPROVED");
  }

  for (const field of policy.requiredEvidence) {
    if (!(field in request.requestObject)) {
      reasonCodes.push(`MISSING_FIELD_${toReasonToken(field)}`);
    }
  }

  for (const rule of policy.approvalRules) {
    const actual = request.requestObject[rule.field];
    if (rule.operator === "equals" && actual !== rule.value) {
      reasonCodes.push(rule.reasonCode);
    }
    if (rule.operator === "in" && (!Array.isArray(rule.value) || !rule.value.includes(actual))) {
      reasonCodes.push(rule.reasonCode);
    }
  }

  const proposedAmount = Math.min(policy.paymentFormula.baseAmount, policy.paymentFormula.maxPerRequest);
  if (monthToDateAmount + proposedAmount > policy.paymentFormula.monthlyCap) {
    reasonCodes.push("MONTHLY_CAP_EXCEEDED");
  }

  const blocked = reasonCodes.length > 0;

  return {
    decision: blocked ? "blocked" : "approved",
    policyId: policy.id,
    policyVersion: extractPolicyVersion(policy.id),
    amount: blocked ? 0 : proposedAmount,
    currency: policy.currency,
    walletId: blocked ? null : walletId,
    requiresHumanApproval: policy.requiresHumanApproval,
    reasonCodes
  };
}

function extractPolicyVersion(policyId: string): string {
  const match = policyId.match(/-(v\d+)$/);
  return match?.[1] ?? "v1";
}

function toReasonToken(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toUpperCase();
}
