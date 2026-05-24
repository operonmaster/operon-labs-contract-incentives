import { NextResponse } from "next/server";
import { providerDocumentationWorkflow } from "../../../../../../lib/provider-documentation-workflow";

export async function POST(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;

  try {
    const row = await providerDocumentationWorkflow.approvePayment(caseId);
    return NextResponse.json(row);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PAYMENT_APPROVAL_FAILED" },
      { status: 400 }
    );
  }
}
