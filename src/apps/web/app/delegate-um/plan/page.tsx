import { DelegatePlanConsole } from "../../../components/delegate-um/DelegatePlanConsole";
import { buildPageMetadata } from "../../../lib/site-seo";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("/delegate-um/plan");

export default function DelegateUmPlanPage() {
  return <DelegatePlanConsole />;
}
