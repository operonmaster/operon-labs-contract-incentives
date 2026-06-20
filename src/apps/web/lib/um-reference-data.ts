import {
  getCrdServiceOptions,
  getDtrQuestionnaires,
  type CoverageRequirements,
  type CrdServiceOption,
  type DtrQuestionnaire,
  type RequestType,
  type ServiceCode
} from "@operon-labs/um-platform";
import { resolveFirestoreConfig } from "./firestore-config";
import type { FirestoreDatabase, FirestoreDocumentReference } from "./pas-persistence";

export type UmReferenceStoreBackend = "firestore" | "memory";

export interface PatientCoveragePlanReference {
  planId: string;
  planDisplay: string;
}

export interface PatientCoverageContext {
  patientId: string;
  patientDisplay: string;
  dateOfBirth: string;
  plans: PatientCoveragePlanReference[];
  displayOrder: number;
}

export interface CoverageRequirementsLookup {
  planId: string;
  requestType: Exclude<RequestType, "inpatient_admission">;
  serviceCode: ServiceCode;
}

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface UmReferenceDataStore {
  backend: UmReferenceStoreBackend;
  seedDefaults(): Promise<void>;
  listPatients(): Promise<PatientCoverageContext[]>;
  listCrdServiceOptions(planId: string): Promise<CrdServiceOption[]>;
  getCoverageRequirements(lookup: CoverageRequirementsLookup): Promise<CoverageRequirements | null>;
  getDtrQuestionnaire(questionnaireId: string): Promise<DtrQuestionnaire | null>;
}
/* eslint-enable no-unused-vars */

interface UmReferenceDataEnv {
  [key: string]: string | undefined;
  UM_REFERENCE_STORE_BACKEND?: string;
  GCP_PROJECT_ID?: string;
  GOOGLE_CLOUD_PROJECT?: string;
  FIRESTORE_DATABASE_ID?: string;
}

interface FirestoreConfig {
  projectId: string;
  databaseId: string;
}

interface StoredCoverageRequirementRule extends CrdServiceOption {
  ruleId: string;
  planId: string;
  displayOrder: number;
}

const DEFAULT_REFERENCE_STORE_BACKEND = "firestore";
const DEFAULT_PLAN_ID = "acme-health-ppo";
const SECONDARY_PLAN_ID = "summit-health-hmo";
const PATIENTS_COLLECTION = "patients";
const COVERAGE_REQUIREMENT_RULES_COLLECTION = "coverageRequirementRules";
const QUESTIONNAIRES_COLLECTION = "questionnaires";

const supportedPlans: PatientCoveragePlanReference[] = [
  { planId: DEFAULT_PLAN_ID, planDisplay: "Acme Health PPO" },
  { planId: SECONDARY_PLAN_ID, planDisplay: "Summit Health HMO" }
];

const defaultPatients: PatientCoverageContext[] = [
  {
    patientId: "patient-maya-chen",
    patientDisplay: "Maya Chen",
    dateOfBirth: "1987-04-12",
    plans: [supportedPlans[0]],
    displayOrder: 1
  },
  {
    patientId: "patient-andre-williams",
    patientDisplay: "Andre Williams",
    dateOfBirth: "1979-09-03",
    plans: [supportedPlans[1]],
    displayOrder: 2
  },
  {
    patientId: "patient-sofia-ramirez",
    patientDisplay: "Sofia Ramirez",
    dateOfBirth: "1992-02-18",
    plans: [supportedPlans[0]],
    displayOrder: 3
  },
  {
    patientId: "patient-noah-patel",
    patientDisplay: "Noah Patel",
    dateOfBirth: "1968-11-27",
    plans: [supportedPlans[1]],
    displayOrder: 4
  },
  {
    patientId: "patient-elena-petrova",
    patientDisplay: "Elena Petrova",
    dateOfBirth: "1984-06-22",
    plans: [supportedPlans[0]],
    displayOrder: 5
  },
  {
    patientId: "patient-grace-kim",
    patientDisplay: "Grace Kim",
    dateOfBirth: "1959-12-08",
    plans: [supportedPlans[1]],
    displayOrder: 6
  }
];

export function createUmReferenceDataStoreFromEnv(env: UmReferenceDataEnv = process.env): UmReferenceDataStore {
  const backend = env.UM_REFERENCE_STORE_BACKEND?.trim().toLowerCase() || DEFAULT_REFERENCE_STORE_BACKEND;

  if (backend === "memory") {
    return createInMemoryUmReferenceDataStore();
  }

  if (backend !== "firestore") {
    throw new Error(`UNSUPPORTED_UM_REFERENCE_STORE_BACKEND:${backend}`);
  }

  return createFirestoreUmReferenceDataStore(resolveFirestoreConfig(env));
}

export function createInMemoryUmReferenceDataStore(): UmReferenceDataStore {
  return new InMemoryUmReferenceDataStore();
}

export function createFirestoreUmReferenceDataStore(
  config: FirestoreConfig,
  firestore?: FirestoreDatabase
): UmReferenceDataStore {
  return new FirestoreUmReferenceDataStore(config, firestore);
}

class InMemoryUmReferenceDataStore implements UmReferenceDataStore {
  readonly backend = "memory" as const;
  private readonly patients = new Map(defaultPatients.map((patient) => [patient.patientId, copyPatientCoverageContext(patient)]));
  private readonly coverageRequirementRules = new Map(
    defaultCoverageRequirementRules().map((rule) => [rule.ruleId, copyCoverageRequirementRule(rule)])
  );
  private readonly questionnaires = new Map(
    getDtrQuestionnaires().map((questionnaire) => [questionnaire.id, copyDtrQuestionnaire(questionnaire)])
  );

  async seedDefaults(): Promise<void> {
    return undefined;
  }

  async listPatients(): Promise<PatientCoverageContext[]> {
    return [...this.patients.values()].sort(byDisplayOrder).map(copyPatientCoverageContext);
  }

  async listCrdServiceOptions(planId: string): Promise<CrdServiceOption[]> {
    return [...this.coverageRequirementRules.values()]
      .filter((rule) => rule.planId === planId)
      .sort(byDisplayOrder)
      .map(copyCrdServiceOption);
  }

  async getCoverageRequirements(lookup: CoverageRequirementsLookup): Promise<CoverageRequirements | null> {
    const rule = this.coverageRequirementRules.get(coverageRequirementRuleDocumentId(lookup));
    return rule ? copyCoverageRequirements(rule) : null;
  }

  async getDtrQuestionnaire(questionnaireId: string): Promise<DtrQuestionnaire | null> {
    const questionnaire = this.questionnaires.get(questionnaireId);
    return questionnaire ? copyDtrQuestionnaire(questionnaire) : null;
  }
}

class FirestoreUmReferenceDataStore implements UmReferenceDataStore {
  readonly backend = "firestore" as const;
  private firestore: FirestoreDatabase | null = null;
  private seeded = false;
  private readonly config: FirestoreConfig;

  constructor(
    config: FirestoreConfig,
    firestore?: FirestoreDatabase
  ) {
    this.config = config;
    this.firestore = firestore ?? null;
  }

  async seedDefaults(): Promise<void> {
    const firestore = await this.getFirestore();
    await Promise.all([
      ...defaultPatients.map((patient) =>
        setIfMissing(firestore.collection(PATIENTS_COLLECTION).doc(patient.patientId), copyPatientCoverageContext(patient))
      ),
      ...defaultCoverageRequirementRules().map((rule) =>
        setIfMissing(firestore.collection(COVERAGE_REQUIREMENT_RULES_COLLECTION).doc(rule.ruleId), copyCoverageRequirementRule(rule))
      ),
      ...getDtrQuestionnaires().map((questionnaire) =>
        setIfMissing(firestore.collection(QUESTIONNAIRES_COLLECTION).doc(questionnaire.id), copyDtrQuestionnaire(questionnaire))
      )
    ]);
    this.seeded = true;
  }

  async listPatients(): Promise<PatientCoverageContext[]> {
    await this.ensureSeeded();
    const snapshot = await (await this.getFirestore()).collection(PATIENTS_COLLECTION).orderBy("displayOrder", "asc").get();
    return snapshot.docs.map((doc) => copyPatientCoverageContext(doc.data() as PatientCoverageContext));
  }

  async listCrdServiceOptions(planId: string): Promise<CrdServiceOption[]> {
    await this.ensureSeeded();
    const snapshot = await (await this.getFirestore()).collection(COVERAGE_REQUIREMENT_RULES_COLLECTION).orderBy("displayOrder", "asc").get();
    return snapshot.docs
      .map((doc) => doc.data() as StoredCoverageRequirementRule)
      .filter((rule) => rule.planId === planId)
      .map(copyCrdServiceOption);
  }

  async getCoverageRequirements(lookup: CoverageRequirementsLookup): Promise<CoverageRequirements | null> {
    await this.ensureSeeded();
    const snapshot = await (await this.getFirestore())
      .collection(COVERAGE_REQUIREMENT_RULES_COLLECTION)
      .doc(coverageRequirementRuleDocumentId(lookup))
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return copyCoverageRequirements(snapshot.data() as StoredCoverageRequirementRule);
  }

  async getDtrQuestionnaire(questionnaireId: string): Promise<DtrQuestionnaire | null> {
    await this.ensureSeeded();
    const snapshot = await (await this.getFirestore()).collection(QUESTIONNAIRES_COLLECTION).doc(questionnaireId).get();

    if (!snapshot.exists) {
      return null;
    }

    return copyDtrQuestionnaire(snapshot.data() as DtrQuestionnaire);
  }

  private async ensureSeeded(): Promise<void> {
    if (this.seeded) {
      return;
    }

    const firestore = await this.getFirestore();
    const expectedPatientIds = defaultPatients.map((patient) => patient.patientId);
    const expectedCoverageRequirementRuleIds = defaultCoverageRequirementRules().map((rule) => rule.ruleId);
    const expectedQuestionnaireIds = getDtrQuestionnaires().map((questionnaire) => questionnaire.id);
    const expectedDocs = await Promise.all([
      ...expectedPatientIds.map((id) => firestore.collection(PATIENTS_COLLECTION).doc(id).get()),
      ...expectedCoverageRequirementRuleIds.map((id) =>
        firestore.collection(COVERAGE_REQUIREMENT_RULES_COLLECTION).doc(id).get()
      ),
      ...expectedQuestionnaireIds.map((id) => firestore.collection(QUESTIONNAIRES_COLLECTION).doc(id).get())
    ]);

    if (expectedDocs.some((doc) => !doc.exists)) {
      await this.seedDefaults();
      return;
    }

    this.seeded = true;
  }

  private async getFirestore(): Promise<FirestoreDatabase> {
    if (!this.firestore) {
      const { Firestore } = await import("@google-cloud/firestore");
      this.firestore = new Firestore({
        projectId: this.config.projectId,
        databaseId: this.config.databaseId
      }) as FirestoreDatabase;
    }

    return this.firestore;
  }
}

export const umReferenceDataStore = createUmReferenceDataStoreFromEnv();

async function setIfMissing(ref: FirestoreDocumentReference, value: unknown): Promise<void> {
  const existing = await ref.get();
  if (existing.exists) {
    return;
  }

  await ref.set(value);
}

function defaultCoverageRequirementRules(): StoredCoverageRequirementRule[] {
  return supportedPlans.flatMap((plan) =>
    getCrdServiceOptions().map((option, index) => ({
      ...option,
      ruleId: coverageRequirementRuleDocumentId({
        planId: plan.planId,
        requestType: option.requestType as Exclude<RequestType, "inpatient_admission">,
        serviceCode: option.serviceCode
      }),
      planId: plan.planId,
      displayOrder: index + 1
    }))
  );
}

function coverageRequirementRuleDocumentId({ planId, requestType, serviceCode }: CoverageRequirementsLookup): string {
  return `${planId}_${requestType}_${serviceCode}`;
}

function copyPatientCoverageContext(patient: PatientCoverageContext): PatientCoverageContext {
  return {
    ...patient,
    plans: patient.plans.map((plan) => ({ ...plan }))
  };
}

function copyCoverageRequirementRule(rule: StoredCoverageRequirementRule): StoredCoverageRequirementRule {
  return {
    ...rule,
    requiredDocumentation: [...rule.requiredDocumentation],
    details: [...rule.details]
  };
}

function copyCrdServiceOption(rule: CrdServiceOption): CrdServiceOption {
  return {
    ...rule,
    requiredDocumentation: [...rule.requiredDocumentation],
    details: [...rule.details]
  };
}

function copyCoverageRequirements(requirements: CoverageRequirements): CoverageRequirements {
  return {
    requestType: requirements.requestType,
    serviceCode: requirements.serviceCode,
    serviceLabel: requirements.serviceLabel,
    codingSystem: requirements.codingSystem,
    billingCode: requirements.billingCode,
    coveredBenefit: requirements.coveredBenefit,
    priorAuthRequired: requirements.priorAuthRequired,
    documentationTemplateId: requirements.documentationTemplateId,
    requiredDocumentation: [...requirements.requiredDocumentation],
    reasonCode: requirements.reasonCode
  };
}

function copyDtrQuestionnaire(questionnaire: DtrQuestionnaire): DtrQuestionnaire {
  return {
    ...questionnaire,
    questions: questionnaire.questions.map((question) => ({
      ...question,
      answerOptions: question.answerOptions.map((answerOption) => ({ ...answerOption }))
    }))
  };
}

function byDisplayOrder(left: { displayOrder: number }, right: { displayOrder: number }): number {
  return left.displayOrder - right.displayOrder;
}
