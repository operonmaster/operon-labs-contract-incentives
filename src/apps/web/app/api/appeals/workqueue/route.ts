import { NextResponse } from "next/server";
import { appealsWorkflow } from "../../../../lib/appeals-workflow";

export async function GET() {
  return NextResponse.json({
    rows: await appealsWorkflow.listWorkqueue()
  });
}
