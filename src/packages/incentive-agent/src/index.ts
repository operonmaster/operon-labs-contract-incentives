import {
  evaluatePolicy,
  type EvaluationRequest,
  type IncentivePolicy,
  type PolicyEvaluationResult
} from "@operon-labs/policy-engine";

export interface DemoEvaluation {
  request: EvaluationRequest;
  policy: IncentivePolicy;
  result: PolicyEvaluationResult;
  explanation: string;
}

export function evaluateDemoScenario(evaluationType: string): DemoEvaluation {
  const policy = demoPolicies[evaluationType];
  const request = demoRequests[evaluationType];

  if (!policy || !request) {
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
    return `Policy ${result.policyId} approved a ${result.amount} ${result.currency} payment proposal pending human approval.`;
  }

  return `Policy ${result.policyId} blocked payment because ${result.reasonCodes.join(", ")}.`;
}

const demoPolicies: Record<string, IncentivePolicy> = {
  delegate_um_sla_bonus: {
    id: "delegate-um-sla-bonus-v1",
    evaluationType: "delegate_um_sla_bonus",
    currency: "HBAR",
    submitterRules: {
      allowedSubmitterTypes: ["delegate_vendor"],
      allowedSubmitters: ["northstar-um"],
      walletMap: {
        "northstar-um": "0.0.12345"
      }
    },
    requiredEvidence: ["caseId", "completedWithinSla", "documentationComplete", "qualityAuditPassed", "denialOutcomeUsed", "containsPhi"],
    approvalRules: [
      { field: "completedWithinSla", operator: "equals", value: true, reasonCode: "SLA_NOT_MET" },
      { field: "documentationComplete", operator: "equals", value: true, reasonCode: "DOCUMENTATION_INCOMPLETE" },
      { field: "qualityAuditPassed", operator: "equals", value: true, reasonCode: "QUALITY_AUDIT_FAILED" },
      { field: "denialOutcomeUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_DENIAL_METRIC" },
      { field: "containsPhi", operator: "equals", value: false, reasonCode: "PHI_BLOCKED" }
    ],
    paymentFormula: { baseAmount: 5, maxPerRequest: 5, monthlyCap: 500 },
    requiresHumanApproval: true
  },
  provider_documentation_completeness: {
    id: "provider-documentation-completeness-v1",
    evaluationType: "provider_documentation_completeness",
    currency: "USDC",
    submitterRules: {
      allowedSubmitterTypes: ["provider_admin_team"],
      allowedSubmitters: ["lakeside-provider-admin"],
      walletMap: {
        "lakeside-provider-admin": "0.0.23456"
      }
    },
    requiredEvidence: ["caseId", "attachmentChecklistComplete", "submittedBeforeInitialDecision", "fhirFieldsPresent", "approvalOutcomeUsed", "referralVolumeMetricUsed", "containsPhi"],
    approvalRules: [
      { field: "attachmentChecklistComplete", operator: "equals", value: true, reasonCode: "ATTACHMENT_CHECKLIST_INCOMPLETE" },
      { field: "submittedBeforeInitialDecision", operator: "equals", value: true, reasonCode: "SUBMITTED_AFTER_INITIAL_DECISION" },
      { field: "fhirFieldsPresent", operator: "equals", value: true, reasonCode: "FHIR_FIELDS_MISSING" },
      { field: "approvalOutcomeUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_OUTCOME_METRIC" },
      { field: "referralVolumeMetricUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_REFERRAL_VOLUME_METRIC" },
      { field: "containsPhi", operator: "equals", value: false, reasonCode: "PHI_BLOCKED" }
    ],
    paymentFormula: { baseAmount: 3, maxPerRequest: 3, monthlyCap: 300 },
    requiresHumanApproval: true
  },
  appeals_packet_quality: {
    id: "appeals-packet-quality-v1",
    evaluationType: "appeals_packet_quality",
    currency: "USDC",
    submitterRules: {
      allowedSubmitterTypes: ["appeals_delegate"],
      allowedSubmitters: ["summit-appeals-ops"],
      walletMap: {
        "summit-appeals-ops": "0.0.54321"
      }
    },
    requiredEvidence: ["appealId", "packetSubmittedWithinSla", "requiredDocumentsPresent", "clinicalRationaleIncluded", "policyCitationIncluded", "evidenceIndexComplete", "qualityAuditPassed", "appealOutcomeUsed", "costSavingsMetricUsed", "containsPhi"],
    approvalRules: [
      { field: "packetSubmittedWithinSla", operator: "equals", value: true, reasonCode: "SLA_NOT_MET" },
      { field: "requiredDocumentsPresent", operator: "equals", value: true, reasonCode: "REQUIRED_DOCUMENTS_MISSING" },
      { field: "clinicalRationaleIncluded", operator: "equals", value: true, reasonCode: "CLINICAL_RATIONALE_MISSING" },
      { field: "policyCitationIncluded", operator: "equals", value: true, reasonCode: "POLICY_CITATION_MISSING" },
      { field: "evidenceIndexComplete", operator: "equals", value: true, reasonCode: "EVIDENCE_INDEX_INCOMPLETE" },
      { field: "qualityAuditPassed", operator: "equals", value: true, reasonCode: "QUALITY_AUDIT_FAILED" },
      { field: "appealOutcomeUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_APPEAL_OUTCOME_METRIC" },
      { field: "costSavingsMetricUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_COST_SAVINGS_METRIC" },
      { field: "containsPhi", operator: "equals", value: false, reasonCode: "PHI_BLOCKED" }
    ],
    paymentFormula: { baseAmount: 6, maxPerRequest: 6, monthlyCap: 600 },
    requiresHumanApproval: true
  },
  provider_directory_quality: {
    id: "provider-directory-quality-v1",
    evaluationType: "provider_directory_quality",
    currency: "HBAR",
    submitterRules: {
      allowedSubmitterTypes: ["roster_vendor"],
      allowedSubmitters: ["clearpath-rosters"],
      walletMap: {
        "clearpath-rosters": "0.0.34567"
      }
    },
    requiredEvidence: ["rosterBatchId", "submittedBeforeDeadline", "npiValidationPassed", "tinValidationPassed", "addressValidationPassed", "specialtyValidationPassed", "referralVolumeMetricUsed", "networkSteeringMetricUsed", "containsPhi"],
    approvalRules: [
      { field: "submittedBeforeDeadline", operator: "equals", value: true, reasonCode: "MONTHLY_DEADLINE_MISSED" },
      { field: "npiValidationPassed", operator: "equals", value: true, reasonCode: "NPI_VALIDATION_FAILED" },
      { field: "tinValidationPassed", operator: "equals", value: true, reasonCode: "TIN_VALIDATION_FAILED" },
      { field: "addressValidationPassed", operator: "equals", value: true, reasonCode: "ADDRESS_VALIDATION_FAILED" },
      { field: "specialtyValidationPassed", operator: "equals", value: true, reasonCode: "SPECIALTY_VALIDATION_FAILED" },
      { field: "referralVolumeMetricUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_REFERRAL_VOLUME_METRIC" },
      { field: "networkSteeringMetricUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_STEERING_METRIC" },
      { field: "containsPhi", operator: "equals", value: false, reasonCode: "PHI_BLOCKED" }
    ],
    paymentFormula: { baseAmount: 4, maxPerRequest: 4, monthlyCap: 400 },
    requiresHumanApproval: true
  }
};

const demoRequests: Record<string, EvaluationRequest> = {
  delegate_um_sla_bonus: {
    evaluationType: "delegate_um_sla_bonus",
    submitter: { type: "delegate_vendor", id: "northstar-um" },
    requestObject: {
      caseId: "synthetic-pa-10492",
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
      caseId: "synthetic-pa-20931",
      attachmentChecklistComplete: true,
      submittedBeforeInitialDecision: true,
      fhirFieldsPresent: true,
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
