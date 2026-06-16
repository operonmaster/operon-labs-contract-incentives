import { NextResponse, type NextRequest } from "next/server";
import { specialtyRxWorkflow } from "../../../../../../lib/specialty-rx-workflow";
import { parseConfirmFulfillmentInput } from "../../../../../../lib/specialty-rx-input";

interface RouteContext {
  params: Promise<{ fulfillmentCaseId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const input = parseConfirmFulfillmentInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "INVALID_FULFILLMENT" }, { status: 400 });
  }

  try {
    const { fulfillmentCaseId } = await context.params;
    return NextResponse.json(await specialtyRxWorkflow.confirmFulfillment(fulfillmentCaseId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SPECIALTY_RX_FULFILLMENT_FAILED" },
      { status: 400 }
    );
  }
}
