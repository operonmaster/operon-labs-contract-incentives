import { NextResponse } from "next/server";
import { delegateUmWorkflow } from "../../../../lib/delegate-um-workflow";

export async function GET() {
  return NextResponse.json({
    rows: await delegateUmWorkflow.listPlanRows()
  });
}
