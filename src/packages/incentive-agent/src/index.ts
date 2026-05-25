import {
  evaluatePolicy,
  type EvaluationRequest,
  type IncentivePolicy,
  type PolicyEvaluationResult
} from "@operon-labs/policy-engine";
import type { ProviderDocumentationEvidence, PasSubmittedEvent } from "@operon-labs/um-platform";

export interface DemoEvaluation {
  request: EvaluationRequest;
  policy: IncentivePolicy;
  result: PolicyEvaluationResult;
  explanation: string;
}

export interface ProviderDocumentationEvaluationDependencies {
  getEvidenceByCaseId: (caseId: string) => ProviderDocumentationEvidence | null;
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

  return `Policy ${result.policyId} blocked payment because ${result.reasonCodes.join(", ")}.`;
}

export function evaluateProviderDocumentationEvent(
  event: PasSubmittedEvent | { eventType: string; caseId: string },
  dependencies: ProviderDocumentationEvaluationDependencies
): DemoEvaluation {
  if (event.eventType !== "PAS_SUBMITTED") {
    throw new Error("UNSUPPORTED_PROVIDER_DOCUMENTATION_EVENT");
  }

  const evidence = dependencies.getEvidenceByCaseId(event.caseId);
  if (!evidence) {
    throw new Error(`PROVIDER_DOCUMENTATION_EVIDENCE_NOT_FOUND:${event.caseId}`);
  }

  const policy = dependencies.policy;
  const request: EvaluationRequest = {
    evaluationType: "provider_documentation_completeness",
    submitter: evidence.submitter,
    requestObject: {
      caseId: evidence.caseId,
      requestType: evidence.requestType,
      serviceCode: evidence.serviceCode,
      codingSystem: evidence.codingSystem,
      billingCode: evidence.billingCode,
      crdCoverageChecked: evidence.crdCoverageChecked,
      crdCoveredBenefit: evidence.crdCoveredBenefit,
      dtrTemplateCompleted: evidence.dtrTemplateCompleted,
      attachmentChecklistComplete: evidence.attachmentChecklistComplete,
      fhirFieldsPresent: evidence.fhirFieldsPresent,
      pasSubmitted: evidence.pasSubmitted,
      submittedBeforeInitialDecision: evidence.submittedBeforeInitialDecision,
      paResultUsedForPositivePayment: evidence.paResultUsedForPositivePayment,
      approvalOutcomeUsed: evidence.approvalOutcomeUsed,
      referralVolumeMetricUsed: evidence.referralVolumeMetricUsed,
      containsPhi: evidence.containsPhi
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

const demoRequests: Record<string, EvaluationRequest> = {
  delegate_um_sla_bonus: {
    evaluationType: "delegate_um_sla_bonus",
    submitter: { type: "delegate_vendor", id: "northstar-um" },
    requestObject: {
      caseId: "PA-260524-2102-DELEGATE",
      completedWithinSla: true,
      documentationComplete: true,
      qualityAuditPassed: true,
      denialOutcomeUsed: false,
      containsPhi: false
    }
  },
  provider_documentation_completeness: {
    evaluationType: "provider_documentation_completeness",
    submitter: { type: "provider_admin_team", id: "lakeside-provider-admin" },
    requestObject: {
      caseId: "PA-260524-2102-AAAA1111",
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      codingSystem: "CPT",
      billingCode: "73721",
      crdCoverageChecked: true,
      crdCoveredBenefit: true,
      dtrTemplateCompleted: true,
      attachmentChecklistComplete: true,
      fhirFieldsPresent: true,
      pasSubmitted: true,
      submittedBeforeInitialDecision: true,
      paResultUsedForPositivePayment: false,
      approvalOutcomeUsed: false,
      referralVolumeMetricUsed: false,
      containsPhi: false
    }
  },
  appeals_packet_quality: {
    evaluationType: "appeals_packet_quality",
    submitter: { type: "appeals_delegate", id: "summit-appeals-ops" },
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
    submitter: { type: "roster_vendor", id: "clearpath-rosters" },
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
