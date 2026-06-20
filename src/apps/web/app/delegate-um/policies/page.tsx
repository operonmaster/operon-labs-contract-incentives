import { DelegateUseCaseNavigation } from "../../../components/delegate-um/DelegateUseCaseNavigation";
import { PolicyConsole } from "../../../components/provider-documentation/PolicyConsole";
import {
  buildBusinessPolicyCards,
  buildHederaAgentKitPlanPolicyCards,
  delegateUmSlaBonusBusinessPolicyType
} from "../../../lib/policy-view-model";
import { paymentPolicyStore } from "../../../lib/payment-policy-store";
import { policyStore } from "../../../lib/policy-store";
import { buildPageMetadata } from "../../../lib/site-seo";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("/delegate-um/policies");

export default async function DelegateUmPoliciesPage() {
  const businessPolicies = await policyStore.listPolicies(delegateUmSlaBonusBusinessPolicyType);
  const paymentPolicies = await paymentPolicyStore.listPolicies();

  return (
    <PolicyConsole
      businessPolicies={businessPolicies.flatMap(buildBusinessPolicyCards)}
      businessPolicyDescription="Business contract policies define delegate SLA bonus criteria by plan and request type. Coverage and clinical decisions stay in the delegated UM workflow; this view shows incentive structure only."
      boundaryStatement="Delegate UM policies describe plan/delegate SLA bonus agreements for delegated UM determinations. Payment policies remain plan-level Hedera Agent Kit settlement controls before any approved payment leaves the treasury."
      eyebrow="Delegate policy catalog"
      paymentPolicies={paymentPolicies.map(buildHederaAgentKitPlanPolicyCards)}
      paymentPolicyDescription="Payment policies remain plan-level Hedera Agent Kit settlement controls selected from centrally maintained payment policy blocks."
      title="Delegate UM SLA Bonus Policies"
      useCaseNavigation={<DelegateUseCaseNavigation activeView="policies" />}
    />
  );
}
