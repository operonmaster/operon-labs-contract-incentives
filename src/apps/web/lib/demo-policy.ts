import type { IncentivePolicy } from "@operon-labs/policy-engine";
import type { PolicyStore } from "./policy-store";

export async function findDemoPolicy(
  evaluationType: string,
  store: Pick<PolicyStore, "findPolicy" | "getPolicy">
): Promise<IncentivePolicy | null> {
  if (evaluationType === "delegate_um_sla_bonus") {
    return store.findPolicy({
      evaluationType,
      planId: "acme-health-ppo",
      providerId: "northstar-um",
      requestType: "pharmacy_benefit"
    });
  }

  return store.getPolicy(evaluationType);
}
