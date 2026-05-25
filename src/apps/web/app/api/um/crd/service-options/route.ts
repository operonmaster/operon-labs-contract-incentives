import { NextResponse } from "next/server";
import { umReferenceDataStore } from "../../../../../lib/um-reference-data";

const defaultPlanId = "acme-health-ppo";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const planId = url.searchParams.get("planId") || defaultPlanId;

  return NextResponse.json({ services: await umReferenceDataStore.listCrdServiceOptions(planId) });
}
