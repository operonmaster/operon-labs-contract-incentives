import { NextResponse } from "next/server";
import { delegateUmWorkflow } from "../../../../../../lib/delegate-um-workflow";
import { enforcePublicDemoMutationRateLimit } from "../../../../../../lib/public-demo-mutation-rate-limit";

export async function POST(request: Request, context: { params: Promise<{ umRequestId: string }> }) {
  const { umRequestId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const reviewerId = getReviewerId(body);
  const rateLimitResponse = enforcePublicDemoMutationRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    return NextResponse.json(await delegateUmWorkflow.startReview(umRequestId, reviewerId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DELEGATE_REVIEW_START_FAILED" },
      { status: 400 }
    );
  }
}

function getReviewerId(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "reviewer-ana";
  }

  const reviewerId = (value as Record<string, unknown>).reviewerId;
  return typeof reviewerId === "string" && reviewerId.trim().length > 0
    ? reviewerId.trim()
    : "reviewer-ana";
}
