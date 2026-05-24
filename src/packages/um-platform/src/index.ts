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
  getEvidence(caseId: string): ProviderDocumentationEvidence;
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
  if (serviceCode === "knee_mri") {
    return { ...kneeMriRequirements, requiredDocumentation: [...kneeMriRequirements.requiredDocumentation] };
  }

  return {
    ...fullBodyWellnessMriRequirements,
    requiredDocumentation: [...fullBodyWellnessMriRequirements.requiredDocumentation]
  };
}

export function createInMemoryUmPlatform(): UmPlatform {
  const records = new Map<string, PriorAuthRecord>();
  const events: PasSubmittedEvent[] = [];
  let nextCaseNumber = 20931;

  return {
    submitPriorAuth(input) {
      const coverage = getCoverageRequirements(input.serviceCode);

      if (input.serviceCode === "knee_mri" && !isCompleteDtr(input.dtr)) {
        throw new Error("DTR_DOCUMENTATION_INCOMPLETE");
      }

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
        dtr: input.dtr ?? null,
        pasSubmitted: true,
        submittedBeforeInitialDecision: true,
        paResult: coverage.coveredBenefit ? "submitted_pending" : "denied_not_covered",
        denialReason: coverage.reasonCode
      };

      records.set(caseId, record);
      events.push({ eventType: "PAS_SUBMITTED", caseId });

      return record;
    },
    listPriorAuths() {
      return [...records.values()];
    },
    listEvents() {
      return [...events];
    },
    getEvidence(caseId) {
      const record = records.get(caseId);

      if (!record) {
        throw new Error(`Prior auth case not found: ${caseId}`);
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

function isCompleteDtr(dtr: DtrAnswers | null | undefined): dtr is DtrAnswers {
  return (
    dtr?.symptomDurationConfirmed === true &&
    dtr.conservativeTherapyConfirmed === true &&
    dtr.examFindingsConfirmed === true &&
    dtr.clinicalNoteAttached === true
  );
}
