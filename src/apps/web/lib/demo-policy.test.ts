import { getDemoEvaluationRequest } from "@operon-labs/incentive-agent";
import type { EvaluationRequest } from "@operon-labs/policy-engine";
import { describe, expect, it } from "vitest";
import { findPolicyForEvaluationRequest } from "./demo-policy";
import { createInMemoryPolicyStore, defaultIncentivePolicies } from "./policy-store";

describe("demo policy selection", () => {
  it("selects delegate UM policy by plan, delegate partner, and request type", async () => {
    const request: EvaluationRequest = {
      ...getDemoEvaluationRequest("delegate_um_sla_bonus"),
      requestObject: {
        ...getDemoEvaluationRequest("delegate_um_sla_bonus").requestObject,
        planId: "summit-health-hmo",
        delegateVendorId: "northstar-um",
        requestType: "outpatient_service"
      }
    };

    const policy = await findPolicyForEvaluationRequest(request, createInMemoryPolicyStore(defaultIncentivePolicies));

    expect(policy?.policyId).toBe("delegate-um-summit-outpatient-sla-bonus-v1");
  });

  it("does not select a delegate UM policy when the submitter and delegated partner disagree", async () => {
    const request: EvaluationRequest = {
      ...getDemoEvaluationRequest("delegate_um_sla_bonus"),
      submitter: { id: "other-delegate" },
      requestObject: {
        ...getDemoEvaluationRequest("delegate_um_sla_bonus").requestObject,
        planId: "acme-health-ppo",
        delegateVendorId: "northstar-um",
        requestType: "pharmacy_benefit"
      }
    };

    const policy = await findPolicyForEvaluationRequest(request, createInMemoryPolicyStore(defaultIncentivePolicies));

    expect(policy).toBeNull();
  });

  it("selects provider documentation policy by plan, provider, and request type", async () => {
    const request: EvaluationRequest = {
      ...getDemoEvaluationRequest("provider_documentation_completeness"),
      requestObject: {
        ...getDemoEvaluationRequest("provider_documentation_completeness").requestObject,
        planId: "summit-health-hmo",
        providerId: "lakeside-provider-admin",
        requestType: "pharmacy_benefit"
      }
    };

    const policy = await findPolicyForEvaluationRequest(request, createInMemoryPolicyStore(defaultIncentivePolicies));

    expect(policy?.policyId).toBe("plcy_5R1T8W3Y6B0D9F2H4K7M");
  });
});
