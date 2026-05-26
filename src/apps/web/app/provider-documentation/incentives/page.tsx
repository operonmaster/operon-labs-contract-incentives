import type { Metadata } from "next";
import { PlanIncentivesConsole } from "../../../components/provider-documentation/PlanIncentivesConsole";

export const metadata: Metadata = {
  title: "Plan Incentives Console",
  description: "Plan-side audit console for reviewing provider documentation incentive events and policy-bound testnet payments."
};

export default async function ProviderDocumentationIncentivesPage({
  searchParams
}: {
  searchParams?: Promise<{ caseId?: string }>;
}) {
  const params = await searchParams;

  return <PlanIncentivesConsole initialUmRequestId={params?.caseId ?? null} />;
}
