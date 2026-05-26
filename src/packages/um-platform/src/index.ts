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
export type PaResult = "submitted_pending" | "denied_not_covered";
export type PasEventType = "PAS_SUBMITTED";

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

export interface PriorAuthRecord {
  caseId: string;
  patientId: string;
  patientDisplay: string;
  planId: PlanId;
  planDisplay: string;
  providerGroupId: "lakeside-provider-admin";
  providerGroupDisplay: "Lakeside Provider Admin";
  requestType: RequestType;
  serviceCode: ServiceCode;
  serviceLabel: string;
  codingSystem: CodingSystem;
  billingCode: string;
  submittedAt: string;
  coverage: CoverageRequirements;
  dtr: DtrAnswers | null;
  dtrQuestionnaireResponse: DtrQuestionnaireResponse | null;
  pasSubmitted: true;
  submittedBeforeInitialDecision: boolean;
  paResult: PaResult;
  denialReason: "BENEFIT_NOT_COVERED" | null;
}

export interface PasSubmittedEvent {
  eventType: PasEventType;
  caseId: string;
}

export interface ProviderDocumentationEvidence {
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
  crdCoverageChecked: boolean;
  crdCoveredBenefit: boolean;
  dtrTemplateCompleted: boolean;
  attachmentChecklistComplete: boolean;
  fhirFieldsPresent: boolean;
  pasSubmitted: boolean;
  submittedBeforeInitialDecision: boolean;
  paResult: PaResult;
  denialReason: "BENEFIT_NOT_COVERED" | null;
  paResultUsedForPositivePayment: false;
  approvalOutcomeUsed: false;
  referralVolumeMetricUsed: false;
  containsPhi: false;
}

export interface UmPlatform {
  submitPriorAuth(input: PriorAuthSubmissionInput): PriorAuthRecord;
  listPriorAuths(): PriorAuthRecord[];
  listEvents(): PasSubmittedEvent[];
  getEvidence(caseId: string): ProviderDocumentationEvidence | null;
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

export function createInMemoryUmPlatform(options: UmPlatformOptions = {}): UmPlatform {
  const records = new Map<string, PriorAuthRecord>();
  const events: PasSubmittedEvent[] = [];
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

      const caseId = getUnusedCaseId(records, generateCaseId);
      const planId = input.planId ?? "acme-health-ppo";
      const defaultPatient = defaultPatientByPlanId[planId];

      const record: PriorAuthRecord = {
        caseId,
        patientId: input.patientId ?? defaultPatient.patientId,
        patientDisplay: input.patientDisplay ?? defaultPatient.patientDisplay,
        planId,
        planDisplay: input.planDisplay ?? defaultPlanDisplayById[planId],
        providerGroupId: "lakeside-provider-admin",
        providerGroupDisplay: "Lakeside Provider Admin",
        requestType: input.requestType,
        serviceCode: input.serviceCode,
        serviceLabel: coverage.serviceLabel,
        codingSystem: coverage.codingSystem,
        billingCode: coverage.billingCode,
        submittedAt: new Date().toISOString(),
        coverage,
        dtr: copyDtrAnswers(input.dtr),
        dtrQuestionnaireResponse: copyDtrQuestionnaireResponse(input.dtrQuestionnaireResponse),
        pasSubmitted: true,
        submittedBeforeInitialDecision: true,
        paResult: coverage.coveredBenefit ? "submitted_pending" : "denied_not_covered",
        denialReason: coverage.reasonCode
      };

      records.set(caseId, record);
      events.push({ eventType: "PAS_SUBMITTED", caseId });

      return copyPriorAuthRecord(record);
    },
    listPriorAuths() {
      return [...records.values()].map(copyPriorAuthRecord);
    },
    listEvents() {
      return events.map(copyPasSubmittedEvent);
    },
    getEvidence(caseId) {
      const record = records.get(caseId);

      if (!record) {
        return null;
      }

      return buildProviderDocumentationEvidence(record);
    }
  };
}

export function buildProviderDocumentationEvidence(record: PriorAuthRecord): ProviderDocumentationEvidence {
  const dtrTemplateCompleted = record.coverage.documentationTemplateId
    ? isCompleteDtr(record.dtr) ||
      isCompleteDtrQuestionnaireResponse(record.dtrQuestionnaireResponse, record.coverage.documentationTemplateId)
    : false;

  return {
    caseId: record.caseId,
    planId: record.planId,
    submitter: {
      id: "lakeside-provider-admin"
    },
    providerId: "lakeside-provider-admin",
    requestType: record.requestType,
    serviceCode: record.serviceCode,
    codingSystem: record.codingSystem,
    billingCode: record.billingCode,
    coverageStatusConfirmed: true,
    coveredBenefit: record.coverage.coveredBenefit,
    dtrRequested: Boolean(record.coverage.documentationTemplateId),
    crdCoverageChecked: true,
    crdCoveredBenefit: record.coverage.coveredBenefit,
    dtrTemplateCompleted,
    attachmentChecklistComplete: dtrTemplateCompleted,
    fhirFieldsPresent: dtrTemplateCompleted,
    pasSubmitted: record.pasSubmitted,
    submittedBeforeInitialDecision: record.submittedBeforeInitialDecision,
    paResult: record.paResult,
    denialReason: record.denialReason,
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

function copyPasSubmittedEvent(event: PasSubmittedEvent): PasSubmittedEvent {
  return { ...event };
}

function getUnusedCaseId(records: Map<string, PriorAuthRecord>, generateCaseId: () => string): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = generateCaseId();

    if (!records.has(candidate)) {
      return candidate;
    }
  }

  throw new Error("PAS_CASE_ID_GENERATION_LIMIT_EXCEEDED");
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

function copyPriorAuthRecord(record: PriorAuthRecord): PriorAuthRecord {
  return {
    ...record,
    coverage: copyCoverageRequirements(record.coverage),
    dtr: copyDtrAnswers(record.dtr),
    dtrQuestionnaireResponse: copyDtrQuestionnaireResponse(record.dtrQuestionnaireResponse)
  };
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
