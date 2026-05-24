import type { PriorAuthSubmissionInput } from "@operon-labs/um-platform";
import { NextResponse } from "next/server";
import { providerDocumentationWorkflow } from "../../../../lib/provider-documentation-workflow";

export async function GET() {
  return NextResponse.json(providerDocumentationWorkflow.listPriorAuths());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isPriorAuthSubmissionInput(body)) {
    return NextResponse.json({ error: "INVALID_PRIOR_AUTH_SUBMISSION" }, { status: 400 });
  }

  try {
    const submitted = await providerDocumentationWorkflow.submitPriorAuth(body);
    return NextResponse.json(submitted);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PRIOR_AUTH_SUBMISSION_FAILED" },
      { status: 400 }
    );
  }
}

function isPriorAuthSubmissionInput(value: unknown): value is PriorAuthSubmissionInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const validRequestType =
    candidate.requestType === "outpatient_service" || candidate.requestType === "pharmacy_benefit";
  const validServiceCode =
    candidate.serviceCode === "knee_mri" ||
    candidate.serviceCode === "full_body_wellness_mri" ||
    candidate.serviceCode === "wegovy_semaglutide" ||
    candidate.serviceCode === "humira_adalimumab";

  return validRequestType && validServiceCode;
}
