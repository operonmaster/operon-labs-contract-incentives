import { PlanIncentivesConsole } from "../../../components/provider-documentation/PlanIncentivesConsole";
import { buildPageMetadata } from "../../../lib/site-seo";

export const metadata = buildPageMetadata("/provider-documentation/incentives");

export default async function ProviderDocumentationIncentivesPage({
  searchParams
}: {
  searchParams?: Promise<{ umRequestId?: string }>;
}) {
  const params = await searchParams;

  return <PlanIncentivesConsole initialUmRequestId={params?.umRequestId ?? null} />;
}
