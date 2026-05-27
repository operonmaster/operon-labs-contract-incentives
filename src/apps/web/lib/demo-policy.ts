import { getDemoEvaluationRequest } from "@operon-labs/incentive-agent";
import type { EvaluationRequest, IncentivePolicy } from "@operon-labs/policy-engine";
import type { PolicyStore } from "./policy-store";

type DemoPolicyStore = Pick<PolicyStore, "findPolicy" | "getPolicy">;

export async function findDemoPolicy(
  evaluationType: string,
  store: DemoPolicyStore
): Promise<IncentivePolicy | null> {
  return findPolicyForEvaluationRequest(getDemoEvaluationRequest(evaluationType), store);
}

export async function findPolicyForEvaluationRequest(
  request: EvaluationRequest,
  store: DemoPolicyStore
): Promise<IncentivePolicy | null> {
  if (request.evaluationType === "delegate_um_sla_bonus") {
    const planId = stringValue(request.requestObject.planId);
    const delegateVendorId = stringValue(request.requestObject.delegateVendorId);
    const requestType = stringValue(request.requestObject.requestType);

    if (!planId || !delegateVendorId || !requestType || request.submitter.id !== delegateVendorId) {
      return null;
    }

    return store.findPolicy({
      evaluationType: request.evaluationType,
      planId,
      providerId: delegateVendorId,
      requestType
    });
  }

  if (request.evaluationType === "provider_documentation_completeness") {
    const planId = stringValue(request.requestObject.planId);
    const providerId = stringValue(request.requestObject.providerId);
    const requestType = stringValue(request.requestObject.requestType);

    if (!planId || !providerId || !requestType) {
      return null;
    }

    return store.findPolicy({
      evaluationType: request.evaluationType,
      planId,
      providerId,
      requestType
    });
  }

  return store.getPolicy(request.evaluationType);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
