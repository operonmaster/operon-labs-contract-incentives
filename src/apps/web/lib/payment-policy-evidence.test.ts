import { buildBusinessEvaluationId, buildPaymentIntentId } from "@operon-labs/hedera-executor";
import { describe, expect, it } from "vitest";
import { buildPaymentPolicyEvidence, toPaymentPolicyFailureCode } from "./payment-policy-evidence";
import type { PaymentPlanPolicy } from "./payment-policy-store";

const paymentPolicy: PaymentPlanPolicy = {
  planId: "acme-health-ppo",
  planName: "Acme Health PPO",
  status: "active",
  version: "v1",
  businessEvaluationAttestation: true,
  duplicatePaymentPrevention: true,
  maxPaymentPerRequest: true,
  paymentToken: "HBAR",
  maxPaymentAmount: 7,
  paymentEnvelopeIntegrity: true
};

describe("payment policy evidence builder", () => {
  it("builds the shared payment-policy audit evidence used by incentive workflows", () => {
    const umRequestId = "PA-260618-0902-EVID001";
    const businessPolicyId = "appeals-packet-quality-v1";
    const incentiveEvaluationId = buildBusinessEvaluationId({ umRequestId, businessPolicyId });
    const paymentIntentId = buildPaymentIntentId({
      umRequestId,
      caseId: umRequestId,
      incentiveEvaluationId,
      businessPolicyId,
      paymentPolicyId: paymentPolicy.planId
    });

    const evidence = buildPaymentPolicyEvidence({
      row: {
        id: incentiveEvaluationId,
        umRequestId,
        incentiveValue: 6,
        currency: "HBAR",
        walletId: "0.0.9049549",
        policyId: businessPolicyId
      },
      paymentPolicy,
      outcome: "paid",
      failureCode: null,
      paymentIntentId,
      transactionId: "0.0.6870566@1781978400.000000002"
    });

    expect(evidence).toMatchObject({
      incentiveEvaluationId,
      umRequestId,
      caseId: umRequestId,
      planId: "acme-health-ppo",
      paymentPolicyId: "acme-health-ppo",
      businessPolicyId,
      runtime: "hedera-agent-kit-policy",
      outcome: "paid",
      failureCode: null,
      requestedPayment: {
        amount: 6,
        token: "HBAR",
        recipientWalletId: "0.0.9049549"
      },
      paymentIntentId,
      transactionId: "0.0.6870566@1781978400.000000002"
    });
    expect(evidence.controls).toEqual([
      expect.objectContaining({ id: "businessEvaluationAttestation", status: "passed" }),
      expect.objectContaining({ id: "paymentToken", status: "passed", expected: "HBAR", actual: "HBAR" }),
      expect.objectContaining({ id: "maxPaymentPerRequest", status: "passed", expected: "<= 7 HBAR", actual: "6 HBAR" }),
      expect.objectContaining({ id: "duplicatePaymentPrevention", status: "passed" }),
      expect.objectContaining({ id: "paymentEnvelopeIntegrity", status: "passed" })
    ]);
  });

  it("marks only the failing payment control when settlement policy execution rejects", () => {
    const evidence = buildPaymentPolicyEvidence({
      row: {
        id: "ie_PA-260618-0902-EVID002_appeals-packet-quality-v1",
        umRequestId: "PA-260618-0902-EVID002",
        incentiveValue: 8,
        currency: "HBAR",
        walletId: "0.0.9049549",
        policyId: "appeals-packet-quality-v1"
      },
      paymentPolicy,
      outcome: "blocked",
      failureCode: "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX",
      paymentIntentId: "pi_PA-260618-0902-EVID002_ie_PA-260618-0902-EVID002_appeals-packet-quality-v1_appeals-packet-quality-v1_acme-health-ppo",
      transactionId: null
    });

    expect(evidence.controls).toEqual([
      expect.objectContaining({ id: "businessEvaluationAttestation", status: "passed" }),
      expect.objectContaining({ id: "paymentToken", status: "passed" }),
      expect.objectContaining({
        id: "maxPaymentPerRequest",
        status: "failed",
        failureCode: "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX"
      }),
      expect.objectContaining({ id: "duplicatePaymentPrevention", status: "not_run" }),
      expect.objectContaining({ id: "paymentEnvelopeIntegrity", status: "not_run" })
    ]);
  });

  it("normalizes unknown settlement errors into a payment-policy failure code", () => {
    expect(toPaymentPolicyFailureCode(new Error("HEDERA_POLICY_RECIPIENT_MISMATCH"))).toBe("HEDERA_POLICY_RECIPIENT_MISMATCH");
    expect(toPaymentPolicyFailureCode(null)).toBe("PAYMENT_POLICY_EXECUTION_FAILED");
  });
});
