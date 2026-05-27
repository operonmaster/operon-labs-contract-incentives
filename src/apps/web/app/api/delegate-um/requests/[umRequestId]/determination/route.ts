import type { CompleteClinicalReviewInput } from "@operon-labs/um-platform";
import { NextResponse } from "next/server";
import { delegateUmWorkflow } from "../../../../../../lib/delegate-um-workflow";

export async function POST(request: Request, context: { params: Promise<{ umRequestId: string }> }) {
  const body = await request.json().catch(() => null);
  const input = parseDeterminationInput(body);

  if (!input) {
    return NextResponse.json({ error: "INVALID_DETERMINATION" }, { status: 400 });
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
  const denialReasonCode = candidate.denialReasonCode;

  if (outcomeStatus !== "approved" && outcomeStatus !== "denied") {
    return null;
  }

  if (
    typeof candidate.medicalNecessityReviewed !== "boolean" ||
    typeof candidate.policyCriteriaChecked !== "boolean" ||
    typeof candidate.rationaleCaptured !== "boolean"
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

  if (outcomeStatus === "denied" && typeof denialReasonCode === "string" && denialReasonCode.trim().length === 0) {
    return null;
  }

  return {
    outcomeStatus,
    medicalNecessityReviewed: candidate.medicalNecessityReviewed,
    policyCriteriaChecked: candidate.policyCriteriaChecked,
    rationaleCaptured: candidate.rationaleCaptured,
    denialReasonCode: typeof denialReasonCode === "string" ? denialReasonCode.trim() : denialReasonCode ?? null
  };
}
