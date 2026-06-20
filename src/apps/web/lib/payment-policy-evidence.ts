import type { Currency } from "@operon-labs/policy-engine";
import type { PaymentPlanPolicy } from "./payment-policy-store";
import {
  type PaymentPolicyControlEvidence,
  type PaymentPolicyEvidence,
  type PaymentPolicyEvidenceOutcome
} from "./payment-policy-evidence-store";

export interface PaymentPolicyEvidenceRow {
  id: string;
  umRequestId: string;
  caseId?: string;
  incentiveValue: number;
  currency: Currency;
  walletId: string | null;
  policyId: string | null;
}

export function buildPaymentPolicyEvidence({
  row,
  paymentPolicy,
  outcome,
  failureCode,
  paymentIntentId,
  transactionId
}: {
  row: PaymentPolicyEvidenceRow;
  paymentPolicy: PaymentPlanPolicy;
  outcome: PaymentPolicyEvidenceOutcome;
  failureCode: string | null;
  paymentIntentId: string;
  transactionId: string | null;
}): PaymentPolicyEvidence {
  const now = new Date().toISOString();

  return {
    incentiveEvaluationId: row.id,
    umRequestId: row.umRequestId,
    caseId: row.caseId ?? row.umRequestId,
    planId: paymentPolicy.planId,
    paymentPolicyId: paymentPolicy.planId,
    businessPolicyId: row.policyId ?? "",
    runtime: "hedera-agent-kit-policy",
    outcome,
    failureCode,
    requestedPayment: {
      amount: row.incentiveValue,
      token: row.currency,
      recipientWalletId: row.walletId ?? "Not assigned"
    },
    controls: buildPaymentPolicyControlEvidence({
      row,
      paymentPolicy,
      outcome,
      failureCode
    }),
    paymentIntentId,
    transactionId,
    createdAt: now,
    updatedAt: now
  };
}

export function buildPaymentPolicyControlEvidence({
  row,
  paymentPolicy,
  outcome,
  failureCode
}: {
  row: PaymentPolicyEvidenceRow;
  paymentPolicy: PaymentPlanPolicy;
  outcome: PaymentPolicyEvidenceOutcome;
  failureCode: string | null;
}): PaymentPolicyControlEvidence[] {
  const amount = row.incentiveValue;
  const token = row.currency;
  const success = outcome === "paid";

  return [
    {
      id: "businessEvaluationAttestation",
      label: "Business evaluation attestation",
      status: paymentPolicy.businessEvaluationAttestation
        ? paymentControlStatus(failureCode, "BUSINESS_EVALUATION", success || failureCode !== null)
        : "not_run"
    },
    {
      id: "paymentToken",
      label: "Payment token",
      status: paymentPolicy.paymentToken === token && failureCode !== "HEDERA_PAYMENT_TOKEN_NOT_ALLOWED" ? "passed" : "failed",
      expected: paymentPolicy.paymentToken,
      actual: token,
      failureCode: failureCode === "HEDERA_PAYMENT_TOKEN_NOT_ALLOWED" ? failureCode : undefined
    },
    {
      id: "maxPaymentPerRequest",
      label: "Max payment per request",
      status: paymentPolicy.maxPaymentPerRequest
        ? amount > paymentPolicy.maxPaymentAmount || failureCode === "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX"
          ? "failed"
          : "passed"
        : "not_run",
      expected: `<= ${paymentPolicy.maxPaymentAmount} ${paymentPolicy.paymentToken}`,
      actual: `${amount} ${token}`,
      failureCode: failureCode === "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX" ? failureCode : undefined
    },
    {
      id: "duplicatePaymentPrevention",
      label: "Duplicate payment prevention",
      status: paymentPolicy.duplicatePaymentPrevention
        ? failureCode === "DUPLICATE_PAYMENT_BLOCKED"
          ? "failed"
          : success
            ? "passed"
            : "not_run"
        : "not_run",
      failureCode: failureCode === "DUPLICATE_PAYMENT_BLOCKED" ? failureCode : undefined
    },
    {
      id: "paymentEnvelopeIntegrity",
      label: "Payment envelope integrity",
      status: paymentPolicy.paymentEnvelopeIntegrity
        ? isPaymentEnvelopeFailure(failureCode)
          ? "failed"
          : success
            ? "passed"
            : "not_run"
        : "not_run",
      failureCode: isPaymentEnvelopeFailure(failureCode) ? failureCode ?? undefined : undefined
    }
  ];
}

export function toPaymentPolicyFailureCode(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "PAYMENT_POLICY_EXECUTION_FAILED";
}

function paymentControlStatus(
  failureCode: string | null,
  failurePrefix: string,
  evaluated: boolean
): PaymentPolicyControlEvidence["status"] {
  if (!evaluated) {
    return "not_run";
  }

  return failureCode?.startsWith(failurePrefix) ? "failed" : "passed";
}

function isPaymentEnvelopeFailure(failureCode: string | null): boolean {
  return Boolean(
    failureCode &&
      [
        "HEDERA_POLICY_SOURCE_ACCOUNT_MISMATCH",
        "HEDERA_POLICY_RECIPIENT_MISMATCH",
        "HEDERA_POLICY_AMOUNT_MISMATCH",
        "HEDERA_POLICY_MEMO_MISMATCH",
        "BUSINESS_EVALUATION_WALLET_MISMATCH",
        "BUSINESS_EVALUATION_AMOUNT_MISMATCH"
      ].includes(failureCode)
  );
}
