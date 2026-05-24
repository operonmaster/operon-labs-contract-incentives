import { createAuditRecord } from "@operon-labs/audit-log";
import { evaluateDemoScenario } from "@operon-labs/incentive-agent";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const evaluationType = typeof body.evaluationType === "string" ? body.evaluationType : "delegate_um_sla_bonus";
  const evaluation = evaluateDemoScenario(evaluationType);
  const audit = createAuditRecord({
    request: evaluation.request,
    result: evaluation.result,
    transactionId: null
  });

  return NextResponse.json({
    ...evaluation,
    audit
  });
}
