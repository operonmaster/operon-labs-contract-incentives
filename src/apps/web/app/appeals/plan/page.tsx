import type { Metadata } from "next";
import { AppealsPlanConsole } from "../../../components/appeals/AppealsPlanConsole";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Appeals Plan Console",
  description: "Plan-side audit view for appeals packet SLA events and settlement outcomes."
};

export default async function AppealsPlanPage({ searchParams }: { searchParams?: Promise<{ appealId?: string }> }) {
  const params = await searchParams;

  return <AppealsPlanConsole initialAppealId={params?.appealId ?? null} />;
}
