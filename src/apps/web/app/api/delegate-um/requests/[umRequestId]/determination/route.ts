import type { CompleteClinicalReviewInput } from "@operon-labs/um-platform";
import { NextResponse } from "next/server";
import { delegateUmWorkflow } from "../../../../../../lib/delegate-um-workflow";
import { enforcePublicDemoMutationRateLimit } from "../../../../../../lib/public-demo-mutation-rate-limit";

export async function POST(request: Request, context: { params: Promise<{ umRequestId: string }> }) {
  const body = await request.json().catch(() => null);
  const input = parseDeterminationInput(body);

  if (!input) {
    return NextResponse.json({ error: "INVALID_DETERMINATION" }, { status: 400 });
  }

  const rateLimitResponse = enforcePublicDemoMutationRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { umRequestId } = await context.params;

  try {
    return NextResponse.json(await delegateUmWorkflow.completeDetermination(umRequestId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DELEGATE_DETERMINATION_FAILED" },
      { status: 400 }
    );
  }
}

function parseDeterminationInput(value: unknown): CompleteClinicalReviewInput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const outcomeStatus = candidate.outcomeStatus;
  const approvalReasonCode = candidate.approvalReasonCode;
  const denialReasonCode = candidate.denialReasonCode;

  if (outcomeStatus !== "approved" && outcomeStatus !== "denied") {
    return null;
  }

  if (
    typeof candidate.clinicalDocumentationReviewed !== "boolean" ||
    typeof candidate.medicalNecessityCriteriaMet !== "boolean" ||
    typeof candidate.planPolicyRequirementsChecked !== "boolean" ||
    typeof candidate.decisionRationaleDocumented !== "boolean"
  ) {
    return null;
  }

  if (
    approvalReasonCode !== undefined &&
    approvalReasonCode !== null &&
    typeof approvalReasonCode !== "string"
  ) {
    return null;
  }

  if (
    denialReasonCode !== undefined &&
    denialReasonCode !== null &&
    typeof denialReasonCode !== "string"
  ) {
    return null;
  }

  if (outcomeStatus === "approved" && typeof approvalReasonCode === "string" && approvalReasonCode.trim().length === 0) {
    return null;
  }

  if (outcomeStatus === "denied" && typeof denialReasonCode === "string" && denialReasonCode.trim().length === 0) {
    return null;
  }

  return {
    outcomeStatus,
    clinicalDocumentationReviewed: candidate.clinicalDocumentationReviewed,
    medicalNecessityCriteriaMet: candidate.medicalNecessityCriteriaMet,
    planPolicyRequirementsChecked: candidate.planPolicyRequirementsChecked,
    decisionRationaleDocumented: candidate.decisionRationaleDocumented,
    approvalReasonCode: typeof approvalReasonCode === "string" ? approvalReasonCode.trim() : approvalReasonCode ?? null,
    denialReasonCode: typeof denialReasonCode === "string" ? denialReasonCode.trim() : denialReasonCode ?? null
  };
}
