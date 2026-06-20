import { PolicyConsole } from "../../../components/provider-documentation/PolicyConsole";
import { AppealsUseCaseNavigation } from "../../../components/appeals/AppealsUseCaseNavigation";
import {
  buildBusinessPolicyCards,
  buildHederaAgentKitPlanPolicyCards
} from "../../../lib/policy-view-model";
import { paymentPolicyStore } from "../../../lib/payment-policy-store";
import { policyStore } from "../../../lib/policy-store";
import { buildPageMetadata } from "../../../lib/site-seo";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("/appeals/policies");

export default async function AppealsPoliciesPage() {
  const businessPolicies = await policyStore.listPolicies("appeals_packet_quality");
  const paymentPolicies = await paymentPolicyStore.listPolicies();

  return (
    <PolicyConsole
      businessPolicies={businessPolicies.flatMap(buildBusinessPolicyCards)}
      businessPolicyDescription="Business contract policies define appeals packet readiness criteria after a denied prior authorization. Final appeal outcome is excluded from payout."
      boundaryStatement="Appeals policies reward contracted packet-readiness operating milestones only. Payment policies remain plan-level Hedera Agent Kit settlement controls before any approved payment leaves the treasury."
      eyebrow="Appeals policy catalog"
      paymentPolicies={paymentPolicies.map(buildHederaAgentKitPlanPolicyCards)}
      paymentPolicyDescription="Payment policies remain plan-level Hedera Agent Kit settlement controls selected from centrally maintained payment policy blocks."
      title="Appeals packet policies"
      useCaseNavigation={<AppealsUseCaseNavigation activeView="policies" />}
    />
  );
}
