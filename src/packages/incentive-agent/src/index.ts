import {
  evaluatePolicy,
  type EvaluationRequest,
  type IncentivePolicy,
  type PolicyEvaluationResult
} from "@operon-labs/policy-engine";
import type { ProviderDocumentationEvidence } from "@operon-labs/um-platform";

export interface DemoEvaluation {
  request: EvaluationRequest;
  policy: IncentivePolicy;
  result: PolicyEvaluationResult;
  explanation: string;
}

export interface ProviderDocumentationEvaluationDependencies {
  getEvidenceByUmRequestId: (umRequestId: string) => ProviderDocumentationEvidence | null;
  policy: IncentivePolicy;
  monthToDateAmount?: number;
}

export interface DelegateUmSlaEvidence {
  umRequestId: string;
  id: string;
  planId: string;
  delegateVendorId: string;
  requestType: string;
  state: string;
  outcomeStatus: "approved" | "denied";
  outcomeStatusPresent: boolean;
  outcomeStatusUsedForPayment: false;
  completedWithinSla: boolean;
  slaHours: 24;
  clinicalReviewCompleted: boolean;
  medicalNecessityReviewed: boolean;
  policyCriteriaChecked: boolean;
  rationaleCaptured: boolean;
  auditReady: boolean;
  containsPhi: false;
}

export interface DelegateUmSlaEvaluationDependencies {
  getEvidenceByUmRequestId: (umRequestId: string) => DelegateUmSlaEvidence | null;
  policy: IncentivePolicy;
  monthToDateAmount?: number;
}

export function evaluateDemoScenario(evaluationType: string, policy: IncentivePolicy): DemoEvaluation {
  const request = demoRequests[evaluationType];

  if (!request) {
    throw new Error(`No demo scenario registered for ${evaluationType}`);
  }

  const result = evaluatePolicy({
    policy,
    request,
    monthToDateAmount: 0
  });

  return {
    request,
    policy,
    result,
    explanation: explainDecision(result)
  };
}

export function explainDecision(result: PolicyEvaluationResult): string {
  if (result.decision === "approved") {
    return result.requiresHumanApproval
      ? `Policy ${result.policyId} approved a ${result.amount} ${result.currency} payment proposal pending human approval.`
      : `Policy ${result.policyId} approved a ${result.amount} ${result.currency} policy-bound payment for automatic settlement.`;
  }
  if (result.decision === "not_applicable") {
    return `Policy ${result.policyId} did not apply because ${result.reasonCodes.join(", ")}.`;
  }

  return `Policy ${result.policyId} blocked payment because ${result.reasonCodes.join(", ")}.`;
}

export function evaluateProviderDocumentationEvent(
  event: { eventType: string; umRequestId: string; caseId?: string },
  dependencies: ProviderDocumentationEvaluationDependencies
): DemoEvaluation {
  if (event.eventType !== "UM_REQUEST_CREATED") {
    throw new Error("UNSUPPORTED_PROVIDER_DOCUMENTATION_EVENT");
  }
  assertProviderDocumentationEventIdsMatch(event);
  assertProviderDocumentationCanonicalPaId(event.umRequestId);

  const evidence = dependencies.getEvidenceByUmRequestId(event.umRequestId);
  if (!evidence) {
    throw new Error(`PROVIDER_DOCUMENTATION_EVIDENCE_NOT_FOUND:${event.umRequestId}`);
  }
  assertProviderDocumentationEvidenceMatchesEvent(evidence, event.umRequestId);

  const policy = dependencies.policy;
  const request: EvaluationRequest = {
    evaluationType: "provider_documentation_completeness",
    submitter: evidence.submitter,
    requestObject: {
      id: evidence.id,
      umRequestId: evidence.umRequestId,
      caseId: evidence.caseId,
      planId: evidence.planId,
      providerId: evidence.providerId,
      requestType: evidence.requestType,
      serviceCode: evidence.serviceCode,
      codingSystem: evidence.codingSystem,
      billingCode: evidence.billingCode,
      coveredBenefit: evidence.coveredBenefit,
      dtrRequested: evidence.dtrRequested,
      dtrCompleted: evidence.dtrCompleted,
      dtrTemplateCompleted: evidence.dtrCompleted,
      outcomeStatusUsedForPayment: false,
      containsPhi: false
    }
  };

  const result = evaluatePolicy({
    policy,
    request,
    monthToDateAmount: dependencies.monthToDateAmount ?? 0
  });

  return {
    request,
    policy,
    result,
    explanation: explainDecision(result)
  };
}

export function evaluateDelegateUmSlaEvent(
  event: { eventType: string; umRequestId: string; caseId?: string },
  dependencies: DelegateUmSlaEvaluationDependencies
): DemoEvaluation {
  if (event.eventType !== "UM_REQUEST_DETERMINED") {
    throw new Error("UNSUPPORTED_DELEGATE_UM_EVENT");
  }
  assertDelegateUmEventIdsMatch(event);
  assertDelegateUmCanonicalPaId(event.umRequestId);

  const evidence = dependencies.getEvidenceByUmRequestId(event.umRequestId);
  if (!evidence) {
    throw new Error(`DELEGATE_UM_EVIDENCE_NOT_FOUND:${event.umRequestId}`);
  }
  assertDelegateUmEvidenceMatchesEvent(evidence, event.umRequestId);

  const request: EvaluationRequest = {
    evaluationType: "delegate_um_sla_bonus",
    submitter: { id: evidence.delegateVendorId },
    requestObject: {
      umRequestId: evidence.umRequestId,
      id: evidence.id,
      planId: evidence.planId,
      delegateVendorId: evidence.delegateVendorId,
      requestType: evidence.requestType,
      state: evidence.state,
      outcomeStatus: evidence.outcomeStatus,
      outcomeStatusPresent: evidence.outcomeStatusPresent,
      outcomeStatusUsedForPayment: evidence.outcomeStatusUsedForPayment,
      completedWithinSla: evidence.completedWithinSla,
      slaHours: evidence.slaHours,
      clinicalReviewCompleted: evidence.clinicalReviewCompleted,
      medicalNecessityReviewed: evidence.medicalNecessityReviewed,
      policyCriteriaChecked: evidence.policyCriteriaChecked,
      rationaleCaptured: evidence.rationaleCaptured,
      auditReady: evidence.auditReady,
      containsPhi: evidence.containsPhi
    }
  };

  const result = evaluatePolicy({
    policy: dependencies.policy,
    request,
    monthToDateAmount: dependencies.monthToDateAmount ?? 0
  });

  return {
    request,
    policy: dependencies.policy,
    result,
    explanation: explainDecision(result)
  };
}

function assertProviderDocumentationEventIdsMatch(event: { umRequestId: string; caseId?: string }): void {
  if (event.caseId !== undefined && event.caseId !== event.umRequestId) {
    throw new Error(`PROVIDER_DOCUMENTATION_EVENT_ID_MISMATCH:${event.umRequestId}`);
  }
}

function assertProviderDocumentationCanonicalPaId(umRequestId: string): void {
  if (!umRequestId.startsWith("PA-")) {
    throw new Error(`PROVIDER_DOCUMENTATION_EVENT_ID_NOT_CANONICAL:${umRequestId}`);
  }
}

function assertProviderDocumentationEvidenceMatchesEvent(
  evidence: ProviderDocumentationEvidence,
  umRequestId: string
): void {
  if (evidence.id !== umRequestId || evidence.umRequestId !== umRequestId || evidence.caseId !== umRequestId) {
    throw new Error(`PROVIDER_DOCUMENTATION_EVIDENCE_ID_MISMATCH:${umRequestId}`);
  }
}

function assertDelegateUmEventIdsMatch(event: { umRequestId: string; caseId?: string }): void {
  if (event.caseId !== undefined && event.caseId !== event.umRequestId) {
    throw new Error(`DELEGATE_UM_EVENT_ID_MISMATCH:${event.umRequestId}`);
  }
}

function assertDelegateUmCanonicalPaId(umRequestId: string): void {
  if (!umRequestId.startsWith("PA-")) {
    throw new Error(`DELEGATE_UM_EVENT_ID_NOT_CANONICAL:${umRequestId}`);
  }
}

function assertDelegateUmEvidenceMatchesEvent(evidence: DelegateUmSlaEvidence, umRequestId: string): void {
  if (evidence.id !== umRequestId || evidence.umRequestId !== umRequestId) {
    throw new Error(`DELEGATE_UM_EVIDENCE_ID_MISMATCH:${umRequestId}`);
  }
}

const demoRequests: Record<string, EvaluationRequest> = {
  delegate_um_sla_bonus: {
    evaluationType: "delegate_um_sla_bonus",
    submitter: { id: "northstar-um" },
    requestObject: {
      umRequestId: "PA-260526-0900-DELEGATE",
      planId: "acme-health-ppo",
      delegateVendorId: "northstar-um",
      requestType: "pharmacy_benefit",
      state: "determined",
      outcomeStatusPresent: true,
      outcomeStatus: "approved",
      outcomeStatusUsedForPayment: false,
      completedWithinSla: true,
      slaHours: 24,
      clinicalReviewCompleted: true,
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true,
      auditReady: true,
      containsPhi: false
    }
  },
  provider_documentation_completeness: {
    evaluationType: "provider_documentation_completeness",
    submitter: { id: "lakeside-provider-admin" },
    requestObject: {
      caseId: "PA-260524-2102-AAAA1111",
      planId: "acme-health-ppo",
      providerId: "lakeside-provider-admin",
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      codingSystem: "CPT",
      billingCode: "73721",
      coveredBenefit: true,
      dtrRequested: true,
      dtrTemplateCompleted: true
    }
  },
  appeals_packet_quality: {
    evaluationType: "appeals_packet_quality",
    submitter: { id: "summit-appeals-ops" },
    requestObject: {
      appealId: "synthetic-appeal-8831",
      packetSubmittedWithinSla: true,
      requiredDocumentsPresent: true,
      clinicalRationaleIncluded: true,
      policyCitationIncluded: true,
      evidenceIndexComplete: true,
      qualityAuditPassed: true,
      appealOutcomeUsed: false,
      costSavingsMetricUsed: false,
      containsPhi: false
    }
  },
  provider_directory_quality: {
    evaluationType: "provider_directory_quality",
    submitter: { id: "clearpath-rosters" },
    requestObject: {
      rosterBatchId: "synthetic-roster-2026-06",
      submittedBeforeDeadline: true,
      npiValidationPassed: true,
      tinValidationPassed: true,
      addressValidationPassed: true,
      specialtyValidationPassed: true,
      referralVolumeMetricUsed: false,
      networkSteeringMetricUsed: false,
      containsPhi: false
    }
  }
};
