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

export type ProviderDocumentationRequestObject = Record<string, unknown> & {
  id: string;
  umRequestId: string;
  caseId: string;
  planId: string;
  providerId: string;
  requestType: string;
  serviceCode: string;
  codingSystem: string;
  billingCode: string;
  coveredBenefit: boolean;
  dtrRequested: boolean;
  dtrCompleted: boolean;
  dtrTemplateCompleted: boolean;
  containsPhi: false;
};

export interface DelegateUmSlaEvidence {
  umRequestId: string;
  id: string;
  planId: string;
  delegateVendorId: string;
  requestType: string;
  state: string;
  outcomeStatus: "approved" | "denied";
  outcomeStatusPresent: boolean;
  completedWithinSla: boolean;
  slaHours: 24;
  clinicalDocumentationReviewed: boolean;
  medicalNecessityCriteriaMet: boolean;
  planPolicyRequirementsChecked: boolean;
  decisionRationaleDocumented: boolean;
  auditReady: boolean;
}

export interface DelegateUmSlaEvaluationDependencies {
  getEvidenceByUmRequestId: (umRequestId: string) => DelegateUmSlaEvidence | null;
  policy: IncentivePolicy;
  monthToDateAmount?: number;
}

export type DelegateUmSlaRequestObject = Record<string, unknown> & {
  umRequestId: string;
  id: string;
  planId: string;
  delegateVendorId: string;
  requestType: string;
  state: string;
  outcomeStatus: "approved" | "denied";
  outcomeStatusPresent: boolean;
  completedWithinSla: boolean;
  slaHours: 24;
  clinicalDocumentationReviewed: boolean;
  medicalNecessityCriteriaMet: boolean;
  planPolicyRequirementsChecked: boolean;
  decisionRationaleDocumented: boolean;
  auditReady: boolean;
};

export interface SpecialtyRxFulfillmentEvidence {
  fulfillmentCaseId: string;
  umRequestId: string;
  planId: string;
  pharmacyId: string;
  requestType: string;
  paOutcomeStatus: "approved" | "denied";
  state: "intake_triage" | "clear_to_fill" | "shipment_scheduled" | "fulfilled" | "exception";
  fulfillmentSlaStartedAt: string | null;
  clearToFillAt: string | null;
  shipmentScheduledAt: string | null;
  deliveryConfirmedAt: string | null;
  scheduleSlaHours: 24;
  intakeComplete: boolean;
  clearToFillComplete: boolean;
  shipmentScheduledWithinSla: boolean;
  remsRequired: boolean;
  remsAuthorizationConfirmed: boolean;
  coldChainRequired: boolean;
  coldChainPackoutValidated: boolean;
  temperatureLogValid: boolean;
  avoidableFulfillmentException: boolean;
  externalBlockerDocumented: boolean;
  drugChoiceMetricUsed: boolean;
  fillVolumeMetricUsed: boolean;
  pharmacySteeringMetricUsed: boolean;
  patientAdherenceMetricUsed: boolean;
  containsPhi: boolean;
}

export interface SpecialtyRxFulfillmentEvaluationDependencies {
  getEvidenceByFulfillmentCaseId: (fulfillmentCaseId: string) => SpecialtyRxFulfillmentEvidence | null;
  policy: IncentivePolicy;
  monthToDateAmount?: number;
}

export type SpecialtyRxFulfillmentRequestObject = Record<string, unknown> & {
  fulfillmentCaseId: string;
  umRequestId: string;
  planId: string;
  pharmacyId: string;
  requestType: string;
  paOutcomeStatus: "approved" | "denied";
  state: "intake_triage" | "clear_to_fill" | "shipment_scheduled" | "fulfilled" | "exception";
  fulfillmentSlaStartedAt: string | null;
  clearToFillAt: string | null;
  shipmentScheduledAt: string | null;
  deliveryConfirmedAt: string | null;
  scheduleSlaHours: 24;
  intakeComplete: boolean;
  clearToFillComplete: boolean;
  shipmentScheduledWithinSla: boolean;
  remsRequired: boolean;
  remsAuthorizationConfirmed: boolean;
  coldChainRequired: boolean;
  coldChainPackoutValidated: boolean;
  temperatureLogValid: boolean;
  avoidableFulfillmentException: boolean;
  externalBlockerDocumented: boolean;
  drugChoiceMetricUsed: boolean;
  fillVolumeMetricUsed: boolean;
  pharmacySteeringMetricUsed: boolean;
  patientAdherenceMetricUsed: boolean;
  containsPhi: boolean;
};

export interface AppealsPacketEvidence {
  appealId: string;
  umRequestId: string;
  planId: string;
  submitterId: string;
  requestType: string;
  originalOutcomeStatus: "denied" | "approved";
  appealReceivedAt: string;
  acknowledgedAt: string | null;
  packetReadyAt: string | null;
  acknowledgedWithinSla: boolean;
  packetReadyWithinSla: boolean;
  requiredDocumentsPresent: boolean;
  clinicalRationaleIncluded: boolean;
  policyCitationIncluded: boolean;
  priorDecisionSummaryIncluded: boolean;
  evidenceIndexComplete: boolean;
  qualityAuditPassed: boolean;
  noReworkRequired: boolean;
  appealOutcomeUsed: boolean;
  costSavingsMetricUsed: boolean;
  denialReversalMetricUsed: boolean;
  containsPhi: boolean;
}

export interface AppealsPacketEvaluationDependencies {
  getEvidenceByAppealId: (appealId: string) => AppealsPacketEvidence | null;
  policy: IncentivePolicy;
  monthToDateAmount?: number;
}

export type AppealsPacketRequestObject = Record<string, unknown> & {
  appealId: string;
  umRequestId: string;
  planId: string;
  submitterId: string;
  requestType: string;
  originalOutcomeStatus: "denied" | "approved";
  appealReceivedAt: string;
  acknowledgedAt: string | null;
  packetReadyAt: string | null;
  acknowledgedWithinSla: boolean;
  packetReadyWithinSla: boolean;
  requiredDocumentsPresent: boolean;
  clinicalRationaleIncluded: boolean;
  policyCitationIncluded: boolean;
  priorDecisionSummaryIncluded: boolean;
  evidenceIndexComplete: boolean;
  qualityAuditPassed: boolean;
  noReworkRequired: boolean;
  appealOutcomeUsed: boolean;
  costSavingsMetricUsed: boolean;
  denialReversalMetricUsed: boolean;
  containsPhi: boolean;
};

export function evaluateDemoScenario(evaluationType: string, policy: IncentivePolicy): DemoEvaluation {
  const request = getDemoEvaluationRequest(evaluationType);

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

export function getDemoEvaluationRequest(evaluationType: string): EvaluationRequest {
  const request = demoRequests[evaluationType];

  if (!request) {
    throw new Error(`No demo scenario registered for ${evaluationType}`);
  }

  return structuredClone(request);
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

export function buildProviderDocumentationRequestObject(
  evidence: ProviderDocumentationEvidence
): ProviderDocumentationRequestObject {
  return {
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
    // Existing policies read dtrTemplateCompleted; map it from canonical completion evidence.
    dtrTemplateCompleted: evidence.dtrCompleted,
    containsPhi: false
  };
}

export function buildDelegateUmSlaRequestObject(evidence: DelegateUmSlaEvidence): DelegateUmSlaRequestObject {
  return {
    umRequestId: evidence.umRequestId,
    id: evidence.id,
    planId: evidence.planId,
    delegateVendorId: evidence.delegateVendorId,
    requestType: evidence.requestType,
    state: evidence.state,
    outcomeStatus: evidence.outcomeStatus,
    outcomeStatusPresent: evidence.outcomeStatusPresent,
    completedWithinSla: evidence.completedWithinSla,
    slaHours: evidence.slaHours,
    clinicalDocumentationReviewed: evidence.clinicalDocumentationReviewed,
    medicalNecessityCriteriaMet: evidence.medicalNecessityCriteriaMet,
    planPolicyRequirementsChecked: evidence.planPolicyRequirementsChecked,
    decisionRationaleDocumented: evidence.decisionRationaleDocumented,
    auditReady: evidence.auditReady
  };
}

export function buildSpecialtyRxFulfillmentRequestObject(
  evidence: SpecialtyRxFulfillmentEvidence
): SpecialtyRxFulfillmentRequestObject {
  return {
    fulfillmentCaseId: evidence.fulfillmentCaseId,
    umRequestId: evidence.umRequestId,
    planId: evidence.planId,
    pharmacyId: evidence.pharmacyId,
    requestType: evidence.requestType,
    paOutcomeStatus: evidence.paOutcomeStatus,
    state: evidence.state,
    fulfillmentSlaStartedAt: evidence.fulfillmentSlaStartedAt,
    clearToFillAt: evidence.clearToFillAt,
    shipmentScheduledAt: evidence.shipmentScheduledAt,
    deliveryConfirmedAt: evidence.deliveryConfirmedAt,
    scheduleSlaHours: evidence.scheduleSlaHours,
    intakeComplete: evidence.intakeComplete,
    clearToFillComplete: evidence.clearToFillComplete,
    shipmentScheduledWithinSla: evidence.shipmentScheduledWithinSla,
    remsRequired: evidence.remsRequired,
    remsAuthorizationConfirmed: evidence.remsAuthorizationConfirmed,
    coldChainRequired: evidence.coldChainRequired,
    coldChainPackoutValidated: evidence.coldChainPackoutValidated,
    temperatureLogValid: evidence.temperatureLogValid,
    avoidableFulfillmentException: evidence.avoidableFulfillmentException,
    externalBlockerDocumented: evidence.externalBlockerDocumented,
    drugChoiceMetricUsed: evidence.drugChoiceMetricUsed,
    fillVolumeMetricUsed: evidence.fillVolumeMetricUsed,
    pharmacySteeringMetricUsed: evidence.pharmacySteeringMetricUsed,
    patientAdherenceMetricUsed: evidence.patientAdherenceMetricUsed,
    containsPhi: evidence.containsPhi
  };
}

export function buildAppealsPacketRequestObject(evidence: AppealsPacketEvidence): AppealsPacketRequestObject {
  return {
    appealId: evidence.appealId,
    umRequestId: evidence.umRequestId,
    planId: evidence.planId,
    submitterId: evidence.submitterId,
    requestType: evidence.requestType,
    originalOutcomeStatus: evidence.originalOutcomeStatus,
    appealReceivedAt: evidence.appealReceivedAt,
    acknowledgedAt: evidence.acknowledgedAt,
    packetReadyAt: evidence.packetReadyAt,
    acknowledgedWithinSla: evidence.acknowledgedWithinSla,
    packetReadyWithinSla: evidence.packetReadyWithinSla,
    requiredDocumentsPresent: evidence.requiredDocumentsPresent,
    clinicalRationaleIncluded: evidence.clinicalRationaleIncluded,
    policyCitationIncluded: evidence.policyCitationIncluded,
    priorDecisionSummaryIncluded: evidence.priorDecisionSummaryIncluded,
    evidenceIndexComplete: evidence.evidenceIndexComplete,
    qualityAuditPassed: evidence.qualityAuditPassed,
    noReworkRequired: evidence.noReworkRequired,
    appealOutcomeUsed: evidence.appealOutcomeUsed,
    costSavingsMetricUsed: evidence.costSavingsMetricUsed,
    denialReversalMetricUsed: evidence.denialReversalMetricUsed,
    containsPhi: evidence.containsPhi
  };
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
    requestObject: buildProviderDocumentationRequestObject(evidence)
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
    requestObject: buildDelegateUmSlaRequestObject(evidence)
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

export function evaluateSpecialtyRxFulfillmentEvent(
  event: { eventType: string; fulfillmentCaseId: string; umRequestId: string },
  dependencies: SpecialtyRxFulfillmentEvaluationDependencies
): DemoEvaluation {
  if (event.eventType !== "SPECIALTY_FULFILLMENT_COMPLETED") {
    throw new Error("UNSUPPORTED_SPECIALTY_RX_EVENT");
  }
  assertSpecialtyRxEventIds(event);

  const evidence = dependencies.getEvidenceByFulfillmentCaseId(event.fulfillmentCaseId);
  if (!evidence) {
    throw new Error(`SPECIALTY_RX_EVIDENCE_NOT_FOUND:${event.fulfillmentCaseId}`);
  }
  assertSpecialtyRxEvidenceMatchesEvent(evidence, event);

  const request: EvaluationRequest = {
    evaluationType: "specialty_rx_fulfillment_sla",
    submitter: { id: evidence.pharmacyId },
    requestObject: buildSpecialtyRxFulfillmentRequestObject(evidence)
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

export function evaluateAppealsPacketEvent(
  event: { eventType: string; appealId: string; umRequestId: string },
  dependencies: AppealsPacketEvaluationDependencies
): DemoEvaluation {
  if (event.eventType !== "APPEAL_PACKET_READY") {
    throw new Error("UNSUPPORTED_APPEALS_EVENT");
  }
  assertAppealsPacketEventIds(event);

  const evidence = dependencies.getEvidenceByAppealId(event.appealId);
  if (!evidence) {
    throw new Error(`APPEALS_EVIDENCE_NOT_FOUND:${event.appealId}`);
  }
  assertAppealsPacketEvidenceMatchesEvent(evidence, event);

  const request: EvaluationRequest = {
    evaluationType: "appeals_packet_quality",
    submitter: { id: evidence.submitterId },
    requestObject: buildAppealsPacketRequestObject(evidence)
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

function assertSpecialtyRxEventIds(event: { fulfillmentCaseId: string; umRequestId: string }): void {
  if (!event.fulfillmentCaseId.startsWith("RXF-")) {
    throw new Error(`SPECIALTY_RX_EVENT_ID_NOT_CANONICAL:${event.fulfillmentCaseId}`);
  }
  if (!event.umRequestId.startsWith("PA-")) {
    throw new Error(`SPECIALTY_RX_UM_REQUEST_ID_NOT_CANONICAL:${event.umRequestId}`);
  }
}

function assertSpecialtyRxEvidenceMatchesEvent(
  evidence: SpecialtyRxFulfillmentEvidence,
  event: { fulfillmentCaseId: string; umRequestId: string }
): void {
  if (evidence.fulfillmentCaseId !== event.fulfillmentCaseId || evidence.umRequestId !== event.umRequestId) {
    throw new Error(`SPECIALTY_RX_EVIDENCE_ID_MISMATCH:${event.fulfillmentCaseId}`);
  }
}

function assertAppealsPacketEventIds(event: { appealId: string; umRequestId: string }): void {
  if (!/^APL-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(event.appealId)) {
    throw new Error(`APPEALS_EVENT_ID_NOT_CANONICAL:${event.appealId}`);
  }
  if (!/^PA-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(event.umRequestId)) {
    throw new Error(`APPEALS_UM_REQUEST_ID_NOT_CANONICAL:${event.umRequestId}`);
  }
}

function assertAppealsPacketEvidenceMatchesEvent(
  evidence: AppealsPacketEvidence,
  event: { appealId: string; umRequestId: string }
): void {
  if (evidence.appealId !== event.appealId || evidence.umRequestId !== event.umRequestId) {
    throw new Error(`APPEALS_EVIDENCE_ID_MISMATCH:${event.appealId}`);
  }
}

const demoDelegateUmSlaEvidence: DelegateUmSlaEvidence = {
  umRequestId: "PA-260526-0900-DELEGATE",
  id: "PA-260526-0900-DELEGATE",
  planId: "acme-health-ppo",
  delegateVendorId: "northstar-um",
  requestType: "pharmacy_benefit",
  state: "determined",
  outcomeStatus: "approved",
  outcomeStatusPresent: true,
  completedWithinSla: true,
  slaHours: 24,
  clinicalDocumentationReviewed: true,
  medicalNecessityCriteriaMet: true,
  planPolicyRequirementsChecked: true,
  decisionRationaleDocumented: true,
  auditReady: true
};

const demoProviderDocumentationEvidence: ProviderDocumentationEvidence = {
  id: "PA-260524-2102-AAAA1111",
  umRequestId: "PA-260524-2102-AAAA1111",
  caseId: "PA-260524-2102-AAAA1111",
  planId: "acme-health-ppo",
  submitter: { id: "lakeside-provider-admin" },
  providerId: "lakeside-provider-admin",
  requestType: "outpatient_service",
  serviceCode: "knee_mri",
  codingSystem: "CPT",
  billingCode: "73721",
  coverageStatusConfirmed: true,
  coveredBenefit: true,
  dtrRequested: true,
  dtrCompleted: true,
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
};

const demoAppealsPacketEvidence: AppealsPacketEvidence = {
  appealId: "APL-260526-0900-DENIED01",
  umRequestId: "PA-260526-0900-DENIED01",
  planId: "acme-health-ppo",
  submitterId: "lakeside-provider-admin",
  requestType: "pharmacy_benefit",
  originalOutcomeStatus: "denied",
  appealReceivedAt: "2026-06-18T16:00:00.000Z",
  acknowledgedAt: "2026-06-18T17:00:00.000Z",
  packetReadyAt: "2026-06-19T15:00:00.000Z",
  acknowledgedWithinSla: true,
  packetReadyWithinSla: true,
  requiredDocumentsPresent: true,
  clinicalRationaleIncluded: true,
  policyCitationIncluded: true,
  priorDecisionSummaryIncluded: true,
  evidenceIndexComplete: true,
  qualityAuditPassed: true,
  noReworkRequired: true,
  appealOutcomeUsed: false,
  costSavingsMetricUsed: false,
  denialReversalMetricUsed: false,
  containsPhi: false
};

const demoSpecialtyRxFulfillmentEvidence: SpecialtyRxFulfillmentEvidence = {
  fulfillmentCaseId: "RXF-260526-0900-DELEGATE",
  umRequestId: "PA-260526-0900-DELEGATE",
  planId: "acme-health-ppo",
  pharmacyId: "atlas-specialty-rx",
  requestType: "pharmacy_benefit",
  paOutcomeStatus: "approved",
  state: "fulfilled",
  fulfillmentSlaStartedAt: "2026-06-18T15:00:00.000Z",
  clearToFillAt: "2026-06-18T16:00:00.000Z",
  shipmentScheduledAt: "2026-06-19T09:30:00.000Z",
  deliveryConfirmedAt: "2026-06-20T14:00:00.000Z",
  scheduleSlaHours: 24,
  intakeComplete: true,
  clearToFillComplete: true,
  shipmentScheduledWithinSla: true,
  remsRequired: false,
  remsAuthorizationConfirmed: true,
  coldChainRequired: true,
  coldChainPackoutValidated: true,
  temperatureLogValid: true,
  avoidableFulfillmentException: false,
  externalBlockerDocumented: false,
  drugChoiceMetricUsed: false,
  fillVolumeMetricUsed: false,
  pharmacySteeringMetricUsed: false,
  patientAdherenceMetricUsed: false,
  containsPhi: false
};

const demoRequests: Record<string, EvaluationRequest> = {
  delegate_um_sla_bonus: {
    evaluationType: "delegate_um_sla_bonus",
    submitter: { id: demoDelegateUmSlaEvidence.delegateVendorId },
    requestObject: buildDelegateUmSlaRequestObject(demoDelegateUmSlaEvidence)
  },
  provider_documentation_completeness: {
    evaluationType: "provider_documentation_completeness",
    submitter: demoProviderDocumentationEvidence.submitter,
    requestObject: buildProviderDocumentationRequestObject(demoProviderDocumentationEvidence)
  },
  appeals_packet_quality: {
    evaluationType: "appeals_packet_quality",
    submitter: { id: demoAppealsPacketEvidence.submitterId },
    requestObject: buildAppealsPacketRequestObject(demoAppealsPacketEvidence)
  },
  specialty_rx_fulfillment_sla: {
    evaluationType: "specialty_rx_fulfillment_sla",
    submitter: { id: demoSpecialtyRxFulfillmentEvidence.pharmacyId },
    requestObject: buildSpecialtyRxFulfillmentRequestObject(demoSpecialtyRxFulfillmentEvidence)
  }
};
