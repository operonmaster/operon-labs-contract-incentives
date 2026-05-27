import { createAuditRecord } from "@operon-labs/audit-log";
import { evaluateDemoScenario } from "@operon-labs/incentive-agent";
import { NextResponse } from "next/server";
import { findDemoPolicy } from "../../../lib/demo-policy";
import { policyStore } from "../../../lib/policy-store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const evaluationType = typeof body.evaluationType === "string" ? body.evaluationType : "delegate_um_sla_bonus";
  const policy = await findDemoPolicy(evaluationType, policyStore);
  if (!policy) {
    return NextResponse.json({ error: "POLICY_NOT_FOUND" }, { status: 404 });
  }

  const evaluation = evaluateDemoScenario(evaluationType, policy);
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
