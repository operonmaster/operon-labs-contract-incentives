import { NextResponse } from "next/server";
import { specialtyRxWorkflow } from "../../../../lib/specialty-rx-workflow";

export async function GET() {
  return NextResponse.json({
    rows: await specialtyRxWorkflow.listWorkqueue()
  });
}
