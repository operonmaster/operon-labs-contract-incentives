import { PolicyConsole } from "../../../components/provider-documentation/PolicyConsole";
import { SpecialtyRxUseCaseNavigation } from "../../../components/specialty-rx/SpecialtyRxUseCaseNavigation";
import {
  buildBusinessPolicyCards,
  buildHederaAgentKitPlanPolicyCards,
  specialtyRxFulfillmentBusinessPolicyType
} from "../../../lib/policy-view-model";
import { paymentPolicyStore } from "../../../lib/payment-policy-store";
import { policyStore } from "../../../lib/policy-store";
import { buildPageMetadata } from "../../../lib/site-seo";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("/specialty-rx/policies");

export default async function SpecialtyRxPoliciesPage() {
  const businessPolicies = await policyStore.listPolicies(specialtyRxFulfillmentBusinessPolicyType);
  const paymentPolicies = await paymentPolicyStore.listPolicies();

  return (
    <PolicyConsole
      businessPolicies={businessPolicies.flatMap(buildBusinessPolicyCards)}
      businessPolicyDescription="Business contract policies define specialty pharmacy fulfillment SLA criteria after an approved pharmacy PA. Drug choice, fill volume, adherence, and steering metrics are excluded from payout."
      boundaryStatement="Specialty Rx policies reward contracted post-approval operating milestones only. Payment policies remain plan-level Hedera Agent Kit settlement controls before any approved payment leaves the treasury."
      eyebrow="Specialty Rx policy catalog"
      paymentPolicies={paymentPolicies.map(buildHederaAgentKitPlanPolicyCards)}
      paymentPolicyDescription="Payment policies remain plan-level Hedera Agent Kit settlement controls selected from centrally maintained payment policy blocks."
      title="Specialty Rx fulfillment policies"
      useCaseNavigation={<SpecialtyRxUseCaseNavigation activeView="policies" />}
    />
  );
}
