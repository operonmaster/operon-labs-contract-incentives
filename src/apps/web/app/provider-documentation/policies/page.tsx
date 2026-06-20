import { PolicyConsole } from "../../../components/provider-documentation/PolicyConsole";
import {
  buildHederaAgentKitPlanPolicyCards,
  buildProviderDocumentationBusinessPolicyCards,
  providerDocumentationBusinessPolicyType
} from "../../../lib/policy-view-model";
import { paymentPolicyStore } from "../../../lib/payment-policy-store";
import { policyStore } from "../../../lib/policy-store";
import { buildPageMetadata } from "../../../lib/site-seo";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("/provider-documentation/policies");

export default async function ProviderDocumentationPoliciesPage({
  searchParams
}: {
  searchParams?: Promise<{ umRequestId?: string }>;
}) {
  const params = await searchParams;
  const businessPolicies = await policyStore.listPolicies(providerDocumentationBusinessPolicyType);
  const paymentPolicies = await paymentPolicyStore.listPolicies();

  return (
    <PolicyConsole
      businessPolicies={businessPolicies.flatMap(buildProviderDocumentationBusinessPolicyCards)}
      paymentPolicies={paymentPolicies.map(buildHederaAgentKitPlanPolicyCards)}
      initialUmRequestId={params?.umRequestId ?? null}
    />
  );
}
