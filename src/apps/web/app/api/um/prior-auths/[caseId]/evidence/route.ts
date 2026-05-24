import { NextResponse } from "next/server";
import { providerDocumentationWorkflow } from "../../../../../../lib/provider-documentation-workflow";

export async function GET(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const evidence = providerDocumentationWorkflow.getEvidence(caseId);

  if (!evidence) {
    return NextResponse.json({ error: "EVIDENCE_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(evidence);
}
