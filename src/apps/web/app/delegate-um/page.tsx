import { DelegateVendorConsole } from "../../components/delegate-um/DelegateVendorConsole";
import { buildPageMetadata } from "../../lib/site-seo";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("/delegate-um");

export default function DelegateUmPage() {
  return <DelegateVendorConsole />;
}
