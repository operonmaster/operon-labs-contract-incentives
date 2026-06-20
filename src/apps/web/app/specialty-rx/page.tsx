import { SpecialtyRxConsole } from "../../components/specialty-rx/SpecialtyRxConsole";
import { buildPageMetadata } from "../../lib/site-seo";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("/specialty-rx");

export default function SpecialtyRxPage() {
  return <SpecialtyRxConsole />;
}
