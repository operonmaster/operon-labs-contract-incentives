import { SpecialtyRxPlanConsole } from "../../../components/specialty-rx/SpecialtyRxPlanConsole";
import { buildPageMetadata } from "../../../lib/site-seo";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("/specialty-rx/plan");

export default function SpecialtyRxPlanPage() {
  return <SpecialtyRxPlanConsole />;
}
