import { NextResponse } from "next/server";
import { providerDocumentationWorkflow } from "../../../../../../lib/provider-documentation-workflow";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  if (request.headers.get("x-operon-plan-role") !== "contract-admin") {
    return NextResponse.json({ error: "PLAN_APPROVAL_REQUIRED" }, { status: 403 });
  }

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
