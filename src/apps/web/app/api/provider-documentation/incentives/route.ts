import { NextResponse } from "next/server";
import { providerDocumentationWorkflow } from "../../../../lib/provider-documentation-workflow";

export async function GET() {
  return NextResponse.json({
    rows: await providerDocumentationWorkflow.listIncentiveRows()
  });
}
