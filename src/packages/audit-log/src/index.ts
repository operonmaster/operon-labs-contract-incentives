import { createHash } from "node:crypto";
import type { EvaluationRequest, PolicyEvaluationResult } from "@operon-labs/policy-engine";

export interface AuditRecordInput {
  request: EvaluationRequest;
  result: PolicyEvaluationResult;
  transactionId: string | null;
}

export interface AuditRecord {
  id: string;
  requestHash: string;
  policyId: string;
  policyVersion: string;
  decision: PolicyEvaluationResult["decision"];
  reasonCodes: string[];
  transactionId: string | null;
  createdAt: string;
}

export function createAuditRecord(input: AuditRecordInput): AuditRecord {
  const requestHash = hashRequest(input.request);
  return {
    id: `audit_${requestHash.slice(0, 12)}`,
    requestHash,
    policyId: input.result.policyId,
    policyVersion: input.result.policyVersion,
    decision: input.result.decision,
    reasonCodes: input.result.reasonCodes,
    transactionId: input.transactionId,
    createdAt: new Date().toISOString()
  };
}

export function hashRequest(request: EvaluationRequest): string {
  return createHash("sha256").update(JSON.stringify(request)).digest("hex");
}
