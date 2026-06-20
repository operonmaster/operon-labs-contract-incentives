import { NextResponse, type NextRequest } from "next/server";
import { parseRouteAppealReviewerInput } from "../../../../../../lib/appeals-input";
import { appealsWorkflow } from "../../../../../../lib/appeals-workflow";
import { enforcePublicDemoMutationRateLimit } from "../../../../../../lib/public-demo-mutation-rate-limit";

interface RouteContext {
  params: Promise<{ appealId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const input = parseRouteAppealReviewerInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "INVALID_APPEAL_REVIEWER_ROUTING" }, { status: 400 });
  }

  const rateLimitResponse = enforcePublicDemoMutationRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { appealId } = await context.params;
    return NextResponse.json(await appealsWorkflow.routeReviewer(appealId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "APPEAL_REVIEWER_ROUTING_FAILED" },
      { status: 400 }
    );
  }
}
