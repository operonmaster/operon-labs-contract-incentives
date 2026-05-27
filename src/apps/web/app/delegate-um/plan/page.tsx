import type { Metadata } from "next";
import { DelegatePlanConsole } from "../../../components/delegate-um/DelegatePlanConsole";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Delegate UM Plan Console",
  description: "Plan-side audit view for delegated pharmacy prior authorization determinations, SLA status, and settlement outcomes."
};

export default async function DelegateUmPlanPage({
  searchParams
}: {
  searchParams?: Promise<{ umRequestId?: string }>;
}) {
  const params = await searchParams;

  return <DelegatePlanConsole initialUmRequestId={params?.umRequestId ?? null} />;
}
