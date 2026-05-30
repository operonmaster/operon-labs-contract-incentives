import type { FirestoreDatabase } from "./pas-persistence";
import type { AppealsPlanAuditRow } from "./appeals-workflow";

export type AppealsStoreBackend = "firestore" | "memory";
export type AppealCaseState =
  | "created"
  | "acknowledged"
  | "intake_validated"
  | "decision_retrieved"
  | "missing_info_resolved"
  | "packet_assembled"
  | "evidence_indexed"
  | "packet_ready";
export type AppealsSlaStatus = "pending" | "within_sla" | "breached" | "not_applicable";
export type AppealsIncentiveStatus = "pending" | "not_eligible" | "paid" | "payment_failed";
export type AppealsPaymentStatus = "pending" | "auto_executed" | "blocked_by_policy" | "execution_failed";

export interface AppealCase {
  id: string;
  umRequestId: string;
  source: "provider_started_from_denied_pa";
  planId: string;
  providerId: string;
  submitterId: "lakeside-provider-admin";
  requestType: "outpatient_service" | "pharmacy_benefit" | "inpatient_admission";
  serviceCode: string;
  serviceLabel: string;
  originalOutcomeStatus: "denied";
  originalDenialReasonCode: string | null;
  state: AppealCaseState;
  appealReceivedAt: string;
  acknowledgedAt: string | null;
  packetReadyAt: string | null;
  packetReadinessSlaHours: 24 | 4;
  acknowledgementSlaBusinessHours: 2;
  expedited: boolean;
  intake: {
    appealRequestPresent: boolean;
    appellantAuthorized: boolean;
    planMemberMatched: boolean;
    requestedServiceMatched: boolean;
  };
  originalDecision: {
    denialReasonRetrieved: boolean;
    priorDecisionSummaryIncluded: boolean;
    coveragePolicyLocated: boolean;
  };
  missingInfo: {
    missingInfoRequired: boolean;
    missingInfoRequested: boolean;
    missingInfoResolved: boolean;
  };
  packet: {
    requiredDocumentsPresent: boolean;
    clinicalRationaleIncluded: boolean;
    policyCitationIncluded: boolean;
    evidenceIndexComplete: boolean;
    qualityAuditPassed: boolean;
    noReworkRequired: boolean;
  };
  routing: {
    reviewerQueueSelected: boolean;
    reviewerConflictCheckComplete: boolean;
    finalDecisionOutsideIncentive: true;
  };
  updatedAt: string;
}

/* eslint-disable no-unused-vars -- Interface method signatures require parameter names. */
export interface AppealsCaseStore {
  backend: AppealsStoreBackend;
  saveCase(caseRecord: AppealCase): Promise<void>;
  createCaseIfAbsent(caseRecord: AppealCase): Promise<AppealCase>;
  getCase(appealId: string): Promise<AppealCase | null>;
  listCases(): Promise<AppealCase[]>;
  savePlanRow(row: AppealsPlanAuditRow): Promise<void>;
  getPlanRow(appealId: string): Promise<AppealsPlanAuditRow | null>;
  listPlanRows(): Promise<AppealsPlanAuditRow[]>;
}
/* eslint-enable no-unused-vars */

interface AppealsStoreEnv {
  [key: string]: string | undefined;
  APPEALS_STORE_BACKEND?: string;
  PAS_STORE_BACKEND?: string;
  GCP_PROJECT_ID?: string;
  GOOGLE_CLOUD_PROJECT?: string;
  FIRESTORE_DATABASE_ID?: string;
}

interface FirestoreConfig {
  projectId: string;
  databaseId: string;
}

const DEFAULT_APPEALS_STORE_BACKEND = "firestore";
const DEFAULT_GCP_PROJECT_ID = "operon-labs-nonprod";
const DEFAULT_FIRESTORE_DATABASE_ID = "(default)";
const APPEAL_CASES_COLLECTION = "appealCases";
const APPEALS_PLAN_AUDIT_ROWS_COLLECTION = "appealsPlanAuditRows";

export function createInMemoryAppealsCaseStore(cases: AppealCase[] = []): AppealsCaseStore {
  return new InMemoryAppealsCaseStore(cases);
}

export function createAppealsCaseStoreFromEnv(env: AppealsStoreEnv = process.env): AppealsCaseStore {
  const backend =
    env.APPEALS_STORE_BACKEND?.trim().toLowerCase() ||
    env.PAS_STORE_BACKEND?.trim().toLowerCase() ||
    DEFAULT_APPEALS_STORE_BACKEND;

  if (backend === "memory") {
    return createInMemoryAppealsCaseStore();
  }

  if (backend !== "firestore") {
    throw new Error(`UNSUPPORTED_APPEALS_STORE_BACKEND:${backend}`);
  }

  return createFirestoreAppealsCaseStore({
    projectId: env.GCP_PROJECT_ID?.trim() || env.GOOGLE_CLOUD_PROJECT?.trim() || DEFAULT_GCP_PROJECT_ID,
    databaseId: env.FIRESTORE_DATABASE_ID?.trim() || DEFAULT_FIRESTORE_DATABASE_ID
  });
}

export function createFirestoreAppealsCaseStore(
  config: FirestoreConfig,
  firestore?: FirestoreDatabase
): AppealsCaseStore {
  return new FirestoreAppealsCaseStore(config, firestore);
}

class InMemoryAppealsCaseStore implements AppealsCaseStore {
  readonly backend = "memory" as const;
  private readonly cases = new Map<string, AppealCase>();
  private readonly planRows = new Map<string, AppealsPlanAuditRow>();

  constructor(cases: AppealCase[]) {
    for (const caseRecord of cases) {
      validateAppealCase(caseRecord);
      this.cases.set(caseRecord.id, copyCase(caseRecord));
    }
  }

  async saveCase(caseRecord: AppealCase): Promise<void> {
    validateAppealCase(caseRecord);
    this.cases.set(caseRecord.id, copyCase(caseRecord));
  }

  async createCaseIfAbsent(caseRecord: AppealCase): Promise<AppealCase> {
    validateAppealCase(caseRecord);
    const existing = this.cases.get(caseRecord.id);
    if (existing) {
      return copyCase(existing);
    }

    const created = copyCase(caseRecord);
    this.cases.set(caseRecord.id, created);
    return copyCase(created);
  }

  async getCase(appealId: string): Promise<AppealCase | null> {
    const caseRecord = this.cases.get(appealId);
    return caseRecord ? copyCase(caseRecord) : null;
  }

  async listCases(): Promise<AppealCase[]> {
    return [...this.cases.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(copyCase);
  }

  async savePlanRow(row: AppealsPlanAuditRow): Promise<void> {
    validateAppealsPlanAuditRow(row);
    this.planRows.set(row.appealId, copyPlanRow(row));
  }

  async getPlanRow(appealId: string): Promise<AppealsPlanAuditRow | null> {
    const row = this.planRows.get(appealId);
    return row ? copyPlanRow(row) : null;
  }

  async listPlanRows(): Promise<AppealsPlanAuditRow[]> {
    return [...this.planRows.values()]
      .sort(comparePlanRows)
      .map(copyPlanRow);
  }
}

class FirestoreAppealsCaseStore implements AppealsCaseStore {
  readonly backend = "firestore" as const;
  private firestore: FirestoreDatabase | null = null;
  private readonly config: FirestoreConfig;

  constructor(config: FirestoreConfig, firestore?: FirestoreDatabase) {
    this.config = config;
    this.firestore = firestore ?? null;
  }

  async saveCase(caseRecord: AppealCase): Promise<void> {
    validateAppealCase(caseRecord);
    await (await this.getFirestore())
      .collection(APPEAL_CASES_COLLECTION)
      .doc(caseRecord.id)
      .set(copyCase(caseRecord));
  }

  async createCaseIfAbsent(caseRecord: AppealCase): Promise<AppealCase> {
    validateAppealCase(caseRecord);
    const ref = (await this.getFirestore()).collection(APPEAL_CASES_COLLECTION).doc(caseRecord.id);
    const created = copyCase(caseRecord);

    if (!ref.create) {
      const existing = await this.getCase(caseRecord.id);
      if (existing) {
        return existing;
      }

      await ref.set(created);
      return copyCase(created);
    }

    try {
      await ref.create(created);
      return copyCase(created);
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }

      const existing = await this.getCase(caseRecord.id);
      if (!existing) {
        throw error;
      }

      return existing;
    }
  }

  async getCase(appealId: string): Promise<AppealCase | null> {
    const snapshot = await (await this.getFirestore()).collection(APPEAL_CASES_COLLECTION).doc(appealId).get();
    return snapshot.exists ? normalizeAppealCase(snapshot.data()) : null;
  }

  async listCases(): Promise<AppealCase[]> {
    const snapshot = await (await this.getFirestore()).collection(APPEAL_CASES_COLLECTION).get();
    return snapshot.docs
      .map((doc) => normalizeAppealCase(doc.data()))
      .filter((caseRecord): caseRecord is AppealCase => Boolean(caseRecord))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(copyCase);
  }

  async savePlanRow(row: AppealsPlanAuditRow): Promise<void> {
    validateAppealsPlanAuditRow(row);
    await (await this.getFirestore())
      .collection(APPEALS_PLAN_AUDIT_ROWS_COLLECTION)
      .doc(row.appealId)
      .set(removeUndefinedFields(copyPlanRow(row)));
  }

  async getPlanRow(appealId: string): Promise<AppealsPlanAuditRow | null> {
    const snapshot = await (await this.getFirestore())
      .collection(APPEALS_PLAN_AUDIT_ROWS_COLLECTION)
      .doc(appealId)
      .get();

    return snapshot.exists ? normalizeAppealsPlanAuditRow(snapshot.data()) : null;
  }

  async listPlanRows(): Promise<AppealsPlanAuditRow[]> {
    const snapshot = await (await this.getFirestore()).collection(APPEALS_PLAN_AUDIT_ROWS_COLLECTION).get();
    return snapshot.docs
      .map((doc) => normalizeAppealsPlanAuditRow(doc.data()))
      .filter((row): row is AppealsPlanAuditRow => Boolean(row))
      .sort(comparePlanRows)
      .map(copyPlanRow);
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

function normalizeAppealCase(value: unknown): AppealCase | null {
  return isAppealCaseShape(value) ? copyCase(value) : null;
}

function normalizeAppealsPlanAuditRow(value: unknown): AppealsPlanAuditRow | null {
  return isAppealsPlanAuditRowShape(value) ? copyPlanRow(value) : null;
}

function validateAppealCase(value: AppealCase): void {
  if (!isAppealCaseShape(value)) {
    throw new Error("INVALID_APPEAL_CASE");
  }
}

function validateAppealsPlanAuditRow(value: AppealsPlanAuditRow): void {
  if (!isAppealsPlanAuditRowShape(value)) {
    throw new Error("INVALID_APPEALS_PLAN_AUDIT_ROW");
  }
}

function isAppealCaseShape(value: unknown): value is AppealCase {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AppealCase>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.startsWith("APL-") &&
    typeof candidate.umRequestId === "string" &&
    candidate.umRequestId.startsWith("PA-") &&
    candidate.source === "provider_started_from_denied_pa" &&
    candidate.originalOutcomeStatus === "denied" &&
    typeof candidate.state === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function isAppealsPlanAuditRowShape(value: unknown): value is AppealsPlanAuditRow {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AppealsPlanAuditRow>;
  return (
    candidate.evaluationType === "appeals_packet_quality" &&
    typeof candidate.appealId === "string" &&
    candidate.appealId.startsWith("APL-") &&
    typeof candidate.umRequestId === "string" &&
    candidate.umRequestId.startsWith("PA-") &&
    typeof candidate.id === "string" &&
    typeof candidate.planId === "string" &&
    typeof candidate.submitterId === "string" &&
    typeof candidate.state === "string" &&
    typeof candidate.incentiveStatus === "string" &&
    typeof candidate.paymentStatus === "string" &&
    typeof candidate.incentiveValue === "number" &&
    Array.isArray(candidate.reasonCodes) &&
    typeof candidate.settlementToken === "object" &&
    candidate.settlementToken !== null &&
    isAppealCaseShape(candidate.appealCase)
  );
}

function copyCase(caseRecord: AppealCase): AppealCase {
  return structuredClone(caseRecord);
}

function copyPlanRow(row: AppealsPlanAuditRow): AppealsPlanAuditRow {
  return structuredClone(row);
}

function comparePlanRows(left: AppealsPlanAuditRow, right: AppealsPlanAuditRow): number {
  return (right.packetReadyAt ?? right.appealCase.updatedAt).localeCompare(
    left.packetReadyAt ?? left.appealCase.updatedAt
  );
}

function removeUndefinedFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedFields);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) {
      cleaned[key] = removeUndefinedFields(child);
    }
  }

  return cleaned;
}

function isAlreadyExistsError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown; details?: unknown };
  return (
    candidate.code === 6 ||
    candidate.code === "already-exists" ||
    candidate.code === "ALREADY_EXISTS" ||
    (typeof candidate.message === "string" && /already exists|ALREADY_EXISTS/i.test(candidate.message)) ||
    (typeof candidate.details === "string" && /already exists|ALREADY_EXISTS/i.test(candidate.details))
  );
}
