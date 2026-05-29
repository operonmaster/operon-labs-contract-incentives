import { NextResponse, type NextRequest } from "next/server";
import { specialtyRxWorkflow, type ConfirmFulfillmentInput } from "../../../../../../lib/specialty-rx-workflow";

interface RouteContext {
  params: Promise<{ fulfillmentCaseId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { fulfillmentCaseId } = await context.params;
    const input = (await request.json()) as ConfirmFulfillmentInput;
    return NextResponse.json(await specialtyRxWorkflow.confirmFulfillment(fulfillmentCaseId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SPECIALTY_RX_FULFILLMENT_FAILED" },
      { status: 400 }
    );
  }
}
