import type { Metadata } from "next";
import { PlanIncentivesConsole } from "../../../components/provider-documentation/PlanIncentivesConsole";

export const metadata: Metadata = {
  title: "Plan Incentives Console",
  description: "Plan-side worklist for reviewing provider documentation incentive events and approving testnet payments."
};

export default function ProviderDocumentationIncentivesPage() {
  return <PlanIncentivesConsole />;
}
