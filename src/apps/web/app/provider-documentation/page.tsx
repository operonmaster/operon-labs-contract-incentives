import type { Metadata } from "next";
import { ProviderDocumentationWizard } from "../../components/provider-documentation/ProviderDocumentationWizard";

export const metadata: Metadata = {
  title: "Provider Prior Authorization Portal",
  description: "Provider workflow for checking coverage requirements, completing documentation, and submitting prior authorization."
};

export default function ProviderDocumentationPage() {
  return <ProviderDocumentationWizard />;
}
