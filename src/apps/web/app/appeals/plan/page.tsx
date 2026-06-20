import { AppealsPlanConsole } from "../../../components/appeals/AppealsPlanConsole";
import { buildPageMetadata } from "../../../lib/site-seo";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("/appeals/plan");

export default async function AppealsPlanPage({ searchParams }: { searchParams?: Promise<{ appealId?: string }> }) {
  const params = await searchParams;

  return <AppealsPlanConsole initialAppealId={params?.appealId ?? null} />;
}
