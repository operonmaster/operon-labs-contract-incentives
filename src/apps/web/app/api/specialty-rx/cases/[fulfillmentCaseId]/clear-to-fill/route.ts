import { NextResponse, type NextRequest } from "next/server";
import { specialtyRxWorkflow } from "../../../../../../lib/specialty-rx-workflow";
import { parseClearToFillInput } from "../../../../../../lib/specialty-rx-input";
import { enforcePublicDemoMutationRateLimit } from "../../../../../../lib/public-demo-mutation-rate-limit";

interface RouteContext {
  params: Promise<{ fulfillmentCaseId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const input = parseClearToFillInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "INVALID_CLEAR_TO_FILL" }, { status: 400 });
  }

  const rateLimitResponse = enforcePublicDemoMutationRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { fulfillmentCaseId } = await context.params;
    return NextResponse.json(await specialtyRxWorkflow.clearToFill(fulfillmentCaseId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SPECIALTY_RX_CLEAR_TO_FILL_FAILED" },
      { status: 400 }
    );
  }
}
