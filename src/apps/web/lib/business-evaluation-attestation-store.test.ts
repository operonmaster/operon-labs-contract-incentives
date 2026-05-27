import { describe, expect, it, vi } from "vitest";
import { buildBusinessEvaluationId } from "@operon-labs/hedera-executor";
import { createBusinessEvaluationAttestationStore } from "./business-evaluation-attestation-store";
import type { PolicyStore } from "./policy-store";

describe("business evaluation attestation store", () => {
  it("looks up paid business evaluations by UM request and business policy", async () => {
    const umRequestId = "PA-260527-1215-ATTEST1";
    const businessPolicyId = "provider-documentation-completeness-v1";
    const planId = "summit-health-hmo";
    const incentiveEvaluationId = buildBusinessEvaluationId({ umRequestId, businessPolicyId });
    const source = {
      getIncentiveRow: vi.fn(async () => ({
        id: incentiveEvaluationId,
        umRequestId,
        caseId: umRequestId,
        planId,
        policyId: businessPolicyId,
        incentiveStatus: "paid",
        incentiveValue: 5,
        currency: "HBAR" as const,
        walletId: "0.0.9049549",
        audit: {
          policyVersion: "2026-05-24"
        }
      }))
    };

    const store = createBusinessEvaluationAttestationStore(source, createPolicyStore())!;

    await expect(
      store.getAttestation({
        incentiveEvaluationId,
        umRequestId,
        caseId: umRequestId,
        planId,
        businessPolicyId
      })
    ).resolves.toMatchObject({
      incentiveEvaluationId,
      umRequestId,
      caseId: umRequestId,
      planId,
      businessPolicyId,
      businessPolicyVersion: "2026-05-24",
      businessPolicyStatus: "active",
      amount: 5,
      currency: "HBAR",
      walletId: "0.0.9049549"
    });
    expect(source.getIncentiveRow).toHaveBeenCalledWith(umRequestId, businessPolicyId);
  });

  it("rejects attestation lookups whose evaluation id does not match the UM request and policy", async () => {
    const umRequestId = "PA-260527-1215-ATTEST2";
    const businessPolicyId = "provider-documentation-completeness-v1";
    const source = {
      getIncentiveRow: vi.fn()
    };
    const store = createBusinessEvaluationAttestationStore(source, createPolicyStore())!;

    await expect(
      store.getAttestation({
        incentiveEvaluationId: buildBusinessEvaluationId({
          umRequestId,
          businessPolicyId: "delegate-um-summit-pharmacy-sla-bonus-v1"
        }),
        umRequestId,
        caseId: umRequestId,
        planId: "summit-health-hmo",
        policyId: businessPolicyId
      })
    ).resolves.toBeNull();
    expect(source.getIncentiveRow).not.toHaveBeenCalled();
  });
});

function createPolicyStore(): PolicyStore {
  return {
    backend: "memory",
    async seedDefaults() {},
    async getPolicy() {
      return null;
    },
    async getPolicyById(policyId) {
      return {
        policyId,
        status: "active"
      } as Awaited<ReturnType<PolicyStore["getPolicyById"]>>;
    },
    async findPolicy() {
      return null;
    },
    async findPolicies() {
      return [];
    },
    async listPolicies() {
      return [];
    },
    async savePolicy() {}
  };
}
