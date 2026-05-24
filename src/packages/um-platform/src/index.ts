export type ServiceCode = "knee_mri" | "full_body_wellness_mri";
export type PaResult = "submitted_pending" | "denied_not_covered";
export type PasEventType = "PAS_SUBMITTED";

export interface CoverageRequirements {
  serviceCode: ServiceCode;
  serviceLabel: string;
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
  serviceCode: ServiceCode;
  dtr?: DtrAnswers;
  acknowledgedNotCovered?: boolean;
}

export interface PriorAuthRecord {
  caseId: string;
  patientId: "patient-maya-chen";
  patientDisplay: "Maya Chen";
  providerGroupId: "lakeside-provider-admin";
  providerGroupDisplay: "Lakeside Provider Admin";
  serviceCode: ServiceCode;
  serviceLabel: string;
  submittedAt: string;
  coverage: CoverageRequirements;
  dtr: DtrAnswers | null;
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
  submitter: {
    type: "provider_admin_team";
    id: "lakeside-provider-admin";
  };
  serviceCode: ServiceCode;
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

const kneeMriRequirements: CoverageRequirements = {
  serviceCode: "knee_mri",
  serviceLabel: "Knee MRI after injury",
  coveredBenefit: true,
  priorAuthRequired: true,
  documentationTemplateId: "knee-mri-pa-dtr-v1",
  requiredDocumentation: [
    "symptom duration",
    "conservative therapy",
    "physical exam findings",
    "clinical note attachment"
  ],
  reasonCode: null
};

const fullBodyWellnessMriRequirements: CoverageRequirements = {
  serviceCode: "full_body_wellness_mri",
  serviceLabel: "Full-body wellness MRI screening",
  coveredBenefit: false,
  priorAuthRequired: true,
  documentationTemplateId: null,
  requiredDocumentation: [],
  reasonCode: "BENEFIT_NOT_COVERED"
};

export function getCoverageRequirements(serviceCode: ServiceCode): CoverageRequirements {
  switch (serviceCode) {
    case "knee_mri":
      return copyCoverageRequirements(kneeMriRequirements);
    case "full_body_wellness_mri":
      return copyCoverageRequirements(fullBodyWellnessMriRequirements);
    default:
      return assertNever(serviceCode);
  }
}

export function createInMemoryUmPlatform(): UmPlatform {
  const records = new Map<string, PriorAuthRecord>();
  const events: PasSubmittedEvent[] = [];
  let nextCaseNumber = 20931;

  return {
    submitPriorAuth(input) {
      const coverage = getCoverageRequirements(input.serviceCode);

      if (input.serviceCode === "full_body_wellness_mri" && input.acknowledgedNotCovered !== true) {
        throw new Error("NOT_COVERED_ACKNOWLEDGEMENT_REQUIRED");
      }

      const caseId = `synthetic-pa-${nextCaseNumber}`;
      nextCaseNumber += 1;

      const record: PriorAuthRecord = {
        caseId,
        patientId: "patient-maya-chen",
        patientDisplay: "Maya Chen",
        providerGroupId: "lakeside-provider-admin",
        providerGroupDisplay: "Lakeside Provider Admin",
        serviceCode: input.serviceCode,
        serviceLabel: coverage.serviceLabel,
        submittedAt: new Date().toISOString(),
        coverage,
        dtr: copyDtrAnswers(input.dtr),
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

      const dtrTemplateCompleted = record.serviceCode === "knee_mri" ? isCompleteDtr(record.dtr) : false;

      return {
        caseId: record.caseId,
        submitter: {
          type: "provider_admin_team",
          id: "lakeside-provider-admin"
        },
        serviceCode: record.serviceCode,
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
  };
}

function copyPasSubmittedEvent(event: PasSubmittedEvent): PasSubmittedEvent {
  return { ...event };
}

function copyPriorAuthRecord(record: PriorAuthRecord): PriorAuthRecord {
  return {
    ...record,
    coverage: copyCoverageRequirements(record.coverage),
    dtr: copyDtrAnswers(record.dtr)
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

function assertNever(value: never): never {
  throw new Error(`Unhandled service code: ${value}`);
}
