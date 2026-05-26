import type { Metadata } from "next";
import { PolicyConsole } from "../../../components/provider-documentation/PolicyConsole";
import {
  buildHederaAgentKitPlanPolicyCards,
  buildProviderDocumentationBusinessPolicyCards,
  providerDocumentationBusinessPolicyType
} from "../../../lib/policy-view-model";
import { paymentPolicyStore } from "../../../lib/payment-policy-store";
import { policyStore } from "../../../lib/policy-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Provider Documentation Policy Catalog",
  description: "Read-only business incentive and Hedera Agent Kit policy catalog for the provider documentation use case."
};

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
      initialCaseId={params?.umRequestId ?? null}
    />
  );
}
