import { NextResponse, type NextRequest } from "next/server";
import { specialtyRxWorkflow, type CompleteIntakeInput } from "../../../../../../lib/specialty-rx-workflow";

interface RouteContext {
  params: Promise<{ fulfillmentCaseId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { fulfillmentCaseId } = await context.params;
    const input = (await request.json()) as CompleteIntakeInput;
    return NextResponse.json(await specialtyRxWorkflow.completeIntake(fulfillmentCaseId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SPECIALTY_RX_INTAKE_FAILED" },
      { status: 400 }
    );
  }
}
