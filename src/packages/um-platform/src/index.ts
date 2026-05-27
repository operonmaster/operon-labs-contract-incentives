import {
  copyDtrQuestionnaireResponse,
  getCrdCoverageRequirements,
  isCompleteDtrQuestionnaireResponse,
  type DtrQuestionnaireResponse
} from "./crd-dtr";

export type RequestType = "outpatient_service" | "pharmacy_benefit" | "inpatient_admission";
export type ServiceCode = "knee_mri" | "full_body_wellness_mri" | "wegovy_semaglutide" | "humira_adalimumab";
export type CodingSystem = "CPT" | "NDC";
export type PlanId = "acme-health-ppo" | "summit-health-hmo";
export type UMRequestState = "pend" | "in_clinical_review" | "determined";
export type UMOutcomeStatus = "approved" | "denied";
export type PasEventType = "PAS_SUBMITTED";
export type UMRequestEventType = "UM_REQUEST_CREATED" | "UM_REQUEST_REVIEW_STARTED" | "UM_REQUEST_DETERMINED";

export interface CoverageRequirements {
  requestType: RequestType;
  serviceCode: ServiceCode;
  serviceLabel: string;
  codingSystem: CodingSystem;
  billingCode: string;
  coveredBenefit: boolean;
  priorAuthRequired: boolean;
  documentationTemplateId: string | null;
  requiredDocumentation: string[];
  reasonCode: "BENEFIT_NOT_COVERED" | null;
}

export interface DtrAnswers {
  symptomDurationConfirmed: boolean;
  conservativeTherapyConfirmed: boolean;
  examFindingsConfirmed: boolean;
  clinicalNoteAttached: boolean;
}

export interface PriorAuthSubmissionInput {
  patientId?: string;
  patientDisplay?: string;
  planId?: PlanId;
  planDisplay?: string;
  requestType: RequestType;
  serviceCode: ServiceCode;
  dtr?: DtrAnswers;
  dtrQuestionnaireResponse?: DtrQuestionnaireResponse;
  acknowledgedNotCovered?: boolean;
}

export interface PriorAuthCompatibilityFields {
  caseId: string;
  providerGroupId: "lakeside-provider-admin";
  providerGroupDisplay: "Lakeside Provider Admin";
  pasSubmitted: true;
  submittedBeforeInitialDecision: boolean;
}

export interface UMRequest extends PriorAuthCompatibilityFields {
  id: string;
  source: "pas_fhir";
  sourceCaseId: string;
  patientId: string;
  patientDisplay: string;
  planId: PlanId;
  planDisplay: string;
  providerId: "lakeside-provider-admin";
  providerDisplay: "Lakeside Provider Admin";
  delegateVendorId: "northstar-um" | null;
  requestType: RequestType;
  serviceCode: ServiceCode;
  serviceLabel: string;
  codingSystem: CodingSystem;
  billingCode: string;
  state: UMRequestState;
  outcomeStatus: UMOutcomeStatus | null;
  submittedAt: string;
  pendStartedAt: string;
  reviewStartedAt: string | null;
  determinedAt: string | null;
  slaDeadlineAt: string;
  slaHours: 24;
  coverage: CoverageRequirements;
  dtr: DtrAnswers | null;
  dtrQuestionnaireResponse: DtrQuestionnaireResponse | null;
  documentation: {
    coverageChecked: boolean;
    coveredBenefit: boolean;
    dtrRequested: boolean;
    dtrCompleted: boolean;
    attachmentChecklistComplete: boolean;
    fhirFieldsPresent: boolean;
  };
  clinicalReview: {
    reviewerId: string | null;
    medicalNecessityReviewed: boolean;
    policyCriteriaChecked: boolean;
    rationaleCaptured: boolean;
    approvalReasonCode: string | null;
    denialReasonCode: string | null;
  };
  auditRefs: {
    pasClaimBundleId: string;
    pasClaimResponseBundleId: string | null;
  };
}

export interface PasSubmittedEvent {
  eventType: PasEventType;
  caseId: string;
  umRequestId: string;
}

export interface UMRequestLifecycleEvent {
  eventType: UMRequestEventType;
  caseId: string;
  umRequestId: string;
}

export type UMPlatformEvent = PasSubmittedEvent | UMRequestLifecycleEvent;

export interface CompleteClinicalReviewInput {
  outcomeStatus: UMOutcomeStatus;
  medicalNecessityReviewed: boolean;
  policyCriteriaChecked: boolean;
  rationaleCaptured: boolean;
  approvalReasonCode?: string | null;
  denialReasonCode?: string | null;
}

export type PriorAuthRecord = UMRequest;

export interface ProviderDocumentationEvidence {
  id: string;
  umRequestId: string;
  caseId: string;
  planId: PlanId;
  submitter: {
    id: "lakeside-provider-admin";
  };
  providerId: "lakeside-provider-admin";
  requestType: RequestType;
  serviceCode: ServiceCode;
  codingSystem: CodingSystem;
  billingCode: string;
  coverageStatusConfirmed: boolean;
  coveredBenefit: boolean;
  dtrRequested: boolean;
  dtrCompleted: boolean;
  crdCoverageChecked: boolean;
  crdCoveredBenefit: boolean;
  dtrTemplateCompleted: boolean;
  attachmentChecklistComplete: boolean;
  fhirFieldsPresent: boolean;
  pasSubmitted: boolean;
  submittedBeforeInitialDecision: boolean;
  paResultUsedForPositivePayment: false;
  approvalOutcomeUsed: false;
  referralVolumeMetricUsed: false;
  containsPhi: false;
}

export interface UmPlatform {
  submitPriorAuth(input: PriorAuthSubmissionInput): UMRequest;
  listUmRequests(): UMRequest[];
  getUmRequest(umRequestId: string): UMRequest | null;
  listEvents(): UMPlatformEvent[];
  getEvidence(umRequestId: string): ProviderDocumentationEvidence | null;
  startClinicalReview(umRequestId: string, reviewerId: string): UMRequest;
  completeClinicalReview(umRequestId: string, input: CompleteClinicalReviewInput): UMRequest;
  listPriorAuths(): PriorAuthRecord[];
}

export interface UmPlatformOptions {
  generateCaseId?: () => string;
}

const defaultPlanDisplayById: Record<PlanId, string> = {
  "acme-health-ppo": "Acme Health PPO",
  "summit-health-hmo": "Summit Health HMO"
};

const defaultPatientByPlanId: Record<PlanId, { patientId: string; patientDisplay: string }> = {
  "acme-health-ppo": {
    patientId: "patient-maya-chen",
    patientDisplay: "Maya Chen"
  },
  "summit-health-hmo": {
    patientId: "patient-andre-williams",
    patientDisplay: "Andre Williams"
  }
};

const DEFAULT_DELEGATE_VENDOR_ID = "northstar-um" as const;
const DEFAULT_SLA_HOURS = 24 as const;

export function getCoverageRequirements(serviceCode: ServiceCode): CoverageRequirements {
  return getCrdCoverageRequirements(serviceCode);
}

export function generatePriorAuthCaseId(date: Date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  const month = formatDatePart(date.getMonth() + 1);
  const day = formatDatePart(date.getDate());
  const hour = formatDatePart(date.getHours());
  const minute = formatDatePart(date.getMinutes());

  return `PA-${yy}${month}${day}-${hour}${minute}-${generateCaseIdSalt()}`;
}

export function generateUmRequestId(id: string): string {
  return id;
}

function addHours(isoTimestamp: string, hours: number): string {
  return new Date(new Date(isoTimestamp).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function buildDocumentation(record: {
  coverage: CoverageRequirements;
  dtr: DtrAnswers | null;
  dtrQuestionnaireResponse: DtrQuestionnaireResponse | null;
}) {
  const dtrCompleted = record.coverage.documentationTemplateId
    ? isCompleteDtr(record.dtr) ||
      isCompleteDtrQuestionnaireResponse(record.dtrQuestionnaireResponse, record.coverage.documentationTemplateId)
    : false;

  return {
    coverageChecked: true,
    coveredBenefit: record.coverage.coveredBenefit,
    dtrRequested: Boolean(record.coverage.documentationTemplateId),
    dtrCompleted,
    attachmentChecklistComplete: dtrCompleted,
    fhirFieldsPresent: dtrCompleted
  };
}

export function startClinicalReviewForRequest(request: UMRequest, reviewerId: string, now: Date = new Date()): UMRequest {
  if (request.state !== "pend" && request.state !== "in_clinical_review") {
    throw new Error("UM_REQUEST_NOT_REVIEWABLE");
  }

  return copyUmRequest({
    ...request,
    state: "in_clinical_review",
    reviewStartedAt: request.reviewStartedAt ?? now.toISOString(),
    clinicalReview: {
      ...request.clinicalReview,
      reviewerId
    }
  });
}

export function completeClinicalReviewForRequest(
  request: UMRequest,
  input: CompleteClinicalReviewInput,
  now: Date = new Date()
): UMRequest {
  if (request.state !== "in_clinical_review") {
    throw new Error("UM_REQUEST_NOT_IN_CLINICAL_REVIEW");
  }

  if (!input.medicalNecessityReviewed || !input.policyCriteriaChecked || !input.rationaleCaptured) {
    throw new Error("CLINICAL_REVIEW_INCOMPLETE");
  }

  if (input.outcomeStatus === "denied" && !input.denialReasonCode) {
    throw new Error("DENIAL_REASON_REQUIRED");
  }

  return copyUmRequest({
    ...request,
    state: "determined",
    outcomeStatus: input.outcomeStatus,
    determinedAt: now.toISOString(),
    clinicalReview: {
      ...request.clinicalReview,
      medicalNecessityReviewed: input.medicalNecessityReviewed,
      policyCriteriaChecked: input.policyCriteriaChecked,
      rationaleCaptured: input.rationaleCaptured,
      approvalReasonCode: input.outcomeStatus === "approved" ? input.approvalReasonCode ?? null : null,
      denialReasonCode: input.outcomeStatus === "denied" ? input.denialReasonCode ?? null : null
    }
  });
}

export function createInMemoryUmPlatform(options: UmPlatformOptions = {}): UmPlatform {
  const requests = new Map<string, PriorAuthRecord>();
  const events: UMPlatformEvent[] = [];
  const generateCaseId = options.generateCaseId ?? generatePriorAuthCaseId;

  return {
    submitPriorAuth(input) {
      const coverage = getCoverageRequirements(input.serviceCode);

      if (input.requestType === "inpatient_admission") {
        throw new Error("INPATIENT_ADMISSION_DORMANT");
      }

      if (input.requestType !== coverage.requestType) {
        throw new Error("REQUEST_TYPE_SERVICE_MISMATCH");
      }

      if (input.serviceCode === "full_body_wellness_mri" && input.acknowledgedNotCovered !== true) {
        throw new Error("NOT_COVERED_ACKNOWLEDGEMENT_REQUIRED");
      }

      const caseId = getUnusedCaseId(requests, generateCaseId);
      const umRequestId = generateUmRequestId(caseId);
      const planId = input.planId ?? "acme-health-ppo";
      const defaultPatient = defaultPatientByPlanId[planId];
      const submittedAt = new Date().toISOString();
      const dtr = copyDtrAnswers(input.dtr);
      const dtrQuestionnaireResponse = copyDtrQuestionnaireResponse(input.dtrQuestionnaireResponse);
      const documentation = buildDocumentation({
        coverage,
        dtr,
        dtrQuestionnaireResponse
      });

      const request: PriorAuthRecord = {
        id: umRequestId,
        source: "pas_fhir",
        sourceCaseId: caseId,
        caseId,
        patientId: input.patientId ?? defaultPatient.patientId,
        patientDisplay: input.patientDisplay ?? defaultPatient.patientDisplay,
        planId,
        planDisplay: input.planDisplay ?? defaultPlanDisplayById[planId],
        providerId: "lakeside-provider-admin",
        providerDisplay: "Lakeside Provider Admin",
        providerGroupId: "lakeside-provider-admin",
        providerGroupDisplay: "Lakeside Provider Admin",
        delegateVendorId: resolveDelegateVendorId(input.requestType),
        requestType: input.requestType,
        serviceCode: input.serviceCode,
        serviceLabel: coverage.serviceLabel,
        codingSystem: coverage.codingSystem,
        billingCode: coverage.billingCode,
        state: "pend",
        outcomeStatus: null,
        submittedAt,
        pendStartedAt: submittedAt,
        reviewStartedAt: null,
        determinedAt: null,
        slaDeadlineAt: addHours(submittedAt, DEFAULT_SLA_HOURS),
        slaHours: DEFAULT_SLA_HOURS,
        coverage,
        dtr,
        dtrQuestionnaireResponse,
        documentation,
        clinicalReview: {
          reviewerId: null,
          medicalNecessityReviewed: false,
          policyCriteriaChecked: false,
          rationaleCaptured: false,
          approvalReasonCode: null,
          denialReasonCode: null
        },
        auditRefs: {
          pasClaimBundleId: caseId,
          pasClaimResponseBundleId: null
        },
        pasSubmitted: true,
        submittedBeforeInitialDecision: true
      };

      requests.set(umRequestId, request);
      events.push({ eventType: "PAS_SUBMITTED", caseId, umRequestId });
      events.push({ eventType: "UM_REQUEST_CREATED", caseId, umRequestId });

      return copyUmRequest(request);
    },
    listUmRequests() {
      return [...requests.values()].map(copyUmRequest);
    },
    getUmRequest(umRequestId) {
      const request = requests.get(umRequestId);

      return request ? copyUmRequest(request) : null;
    },
    listPriorAuths() {
      return [...requests.values()].map(copyPriorAuthRecord);
    },
    listEvents() {
      return events.map(copyUmPlatformEvent);
    },
    getEvidence(umRequestId) {
      const request = requests.get(umRequestId);

      if (!request) {
        return null;
      }

      return buildProviderDocumentationEvidence(request);
    },
    startClinicalReview(umRequestId, reviewerId) {
      const request = requests.get(umRequestId);

      if (!request) {
        throw new Error("UM_REQUEST_NOT_FOUND");
      }

      const updated = startClinicalReviewForRequest(request, reviewerId) as PriorAuthRecord;
      requests.set(updated.id, updated);
      events.push({
        eventType: "UM_REQUEST_REVIEW_STARTED",
        caseId: updated.id,
        umRequestId: updated.id
      });

      return copyUmRequest(updated);
    },
    completeClinicalReview(umRequestId, input) {
      const request = requests.get(umRequestId);

      if (!request) {
        throw new Error("UM_REQUEST_NOT_FOUND");
      }

      const updated = completeClinicalReviewForRequest(request, input) as PriorAuthRecord;
      requests.set(updated.id, updated);
      events.push({
        eventType: "UM_REQUEST_DETERMINED",
        caseId: updated.id,
        umRequestId: updated.id
      });

      return copyUmRequest(updated);
    }
  };
}

export function buildProviderDocumentationEvidence(record: UMRequest): ProviderDocumentationEvidence {
  const documentation = buildDocumentation(record);

  return {
    id: record.id,
    umRequestId: record.id,
    caseId: record.id,
    planId: record.planId,
    submitter: {
      id: "lakeside-provider-admin"
    },
    providerId: "lakeside-provider-admin",
    requestType: record.requestType,
    serviceCode: record.serviceCode,
    codingSystem: record.codingSystem,
    billingCode: record.billingCode,
    coverageStatusConfirmed: documentation.coverageChecked,
    coveredBenefit: record.coverage.coveredBenefit,
    dtrRequested: documentation.dtrRequested,
    dtrCompleted: documentation.dtrCompleted,
    crdCoverageChecked: documentation.coverageChecked,
    crdCoveredBenefit: record.coverage.coveredBenefit,
    dtrTemplateCompleted: documentation.dtrCompleted,
    attachmentChecklistComplete: documentation.attachmentChecklistComplete,
    fhirFieldsPresent: documentation.fhirFieldsPresent,
    pasSubmitted: true,
    submittedBeforeInitialDecision: true,
    paResultUsedForPositivePayment: false,
    approvalOutcomeUsed: false,
    referralVolumeMetricUsed: false,
    containsPhi: false
  };
}

export { buildPasFhirBundle, type PasFhirBundle } from "./pas-fhir";
export {
  getCrdServiceOption,
  getCrdServiceOptions,
  getDtrQuestionnaire,
  getDtrQuestionnaires,
  type CrdServiceOption,
  type DtrAnswerOption,
  type DtrAnswerValue,
  type DtrQuestion,
  type DtrQuestionnaire,
  type DtrQuestionnaireAnswer,
  type DtrQuestionnaireResponse
} from "./crd-dtr";

function copyUmPlatformEvent(event: UMPlatformEvent): UMPlatformEvent {
  return { ...event };
}

function getUnusedCaseId(requests: Map<string, UMRequest>, generateCaseId: () => string): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = generateCaseId();

    if (!requests.has(candidate)) {
      return candidate;
    }
  }

  throw new Error("PAS_CASE_ID_GENERATION_LIMIT_EXCEEDED");
}

function resolveDelegateVendorId(requestType: RequestType): UMRequest["delegateVendorId"] {
  return requestType === "pharmacy_benefit" ? DEFAULT_DELEGATE_VENDOR_ID : null;
}

function formatDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}

function generateCaseIdSalt(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const cryptoSource = globalThis.crypto;

  if (cryptoSource?.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoSource.getRandomValues(bytes);

    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  }

  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function copyUmRequest(request: UMRequest): UMRequest {
  return {
    ...request,
    coverage: copyCoverageRequirements(request.coverage),
    dtr: copyDtrAnswers(request.dtr),
    dtrQuestionnaireResponse: copyDtrQuestionnaireResponse(request.dtrQuestionnaireResponse),
    documentation: { ...request.documentation },
    clinicalReview: { ...request.clinicalReview },
    auditRefs: { ...request.auditRefs }
  };
}

function copyPriorAuthRecord(record: PriorAuthRecord): PriorAuthRecord {
  return copyUmRequest(record) as PriorAuthRecord;
}

function copyCoverageRequirements(requirements: CoverageRequirements): CoverageRequirements {
  return {
    ...requirements,
    requiredDocumentation: [...requirements.requiredDocumentation]
  };
}

function copyDtrAnswers(dtr: DtrAnswers | null | undefined): DtrAnswers | null {
  if (!dtr) {
    return null;
  }

  return { ...dtr };
}

function isCompleteDtr(dtr: DtrAnswers | null | undefined): dtr is DtrAnswers {
  return (
    dtr?.symptomDurationConfirmed === true &&
    dtr.conservativeTherapyConfirmed === true &&
    dtr.examFindingsConfirmed === true &&
    dtr.clinicalNoteAttached === true
  );
}
