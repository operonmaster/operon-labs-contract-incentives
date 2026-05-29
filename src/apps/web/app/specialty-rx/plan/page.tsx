import type { Metadata } from "next";
import { SpecialtyRxPlanConsole } from "../../../components/specialty-rx/SpecialtyRxPlanConsole";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Specialty Rx Plan Console",
  description: "Plan-side audit view for specialty fulfillment SLA events and settlement outcomes."
};

export default async function SpecialtyRxPlanPage({
  searchParams
}: {
  searchParams?: Promise<{ fulfillmentCaseId?: string }>;
}) {
  const params = await searchParams;

  return <SpecialtyRxPlanConsole initialFulfillmentCaseId={params?.fulfillmentCaseId ?? null} />;
}
