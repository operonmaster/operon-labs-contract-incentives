import { NextResponse, type NextRequest } from "next/server";
import { parseStartAppealInput } from "../../../../lib/appeals-input";
import { appealsWorkflow } from "../../../../lib/appeals-workflow";

export async function POST(request: NextRequest) {
  const input = parseStartAppealInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "INVALID_APPEAL_START" }, { status: 400 });
  }

  try {
    return NextResponse.json(await appealsWorkflow.startAppeal(input.umRequestId, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "APPEAL_START_FAILED" },
      { status: 400 }
    );
  }
}
