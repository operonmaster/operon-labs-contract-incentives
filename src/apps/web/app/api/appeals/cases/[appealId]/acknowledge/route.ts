import { NextResponse, type NextRequest } from "next/server";
import { parseAcknowledgeAppealInput } from "../../../../../../lib/appeals-input";
import { appealsWorkflow } from "../../../../../../lib/appeals-workflow";

interface RouteContext {
  params: Promise<{ appealId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const input = parseAcknowledgeAppealInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "INVALID_APPEAL_ACKNOWLEDGEMENT" }, { status: 400 });
  }

  try {
    const { appealId } = await context.params;
    return NextResponse.json(await appealsWorkflow.acknowledgeAppeal(appealId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "APPEAL_ACKNOWLEDGEMENT_FAILED" },
      { status: 400 }
    );
  }
}
