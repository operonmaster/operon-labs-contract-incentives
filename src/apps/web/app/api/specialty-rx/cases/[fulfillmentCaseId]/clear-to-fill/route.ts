import { NextResponse, type NextRequest } from "next/server";
import { specialtyRxWorkflow, type ClearToFillInput } from "../../../../../../lib/specialty-rx-workflow";

interface RouteContext {
  params: Promise<{ fulfillmentCaseId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { fulfillmentCaseId } = await context.params;
    const input = (await request.json()) as ClearToFillInput;
    return NextResponse.json(await specialtyRxWorkflow.clearToFill(fulfillmentCaseId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SPECIALTY_RX_CLEAR_TO_FILL_FAILED" },
      { status: 400 }
    );
  }
}
