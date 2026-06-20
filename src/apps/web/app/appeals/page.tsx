import { AppealsConsole } from "../../components/appeals/AppealsConsole";
import { buildPageMetadata } from "../../lib/site-seo";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("/appeals");

export default function AppealsPage() {
  return <AppealsConsole />;
}
