import { ProviderDocumentationWizard } from "../../components/provider-documentation/ProviderDocumentationWizard";
import { buildPageMetadata } from "../../lib/site-seo";

export const metadata = buildPageMetadata("/provider-documentation");

export default function ProviderDocumentationPage() {
  return <ProviderDocumentationWizard />;
}
