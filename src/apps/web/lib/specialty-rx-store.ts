import type { FirestoreDatabase } from "./pas-persistence";
import type { SpecialtyRxPlanAuditRow, SpecialtyRxSlaStatus } from "./specialty-rx-workflow";

export type SpecialtyRxStoreBackend = "firestore" | "memory";
export type SpecialtyFulfillmentState =
  | "intake_triage"
  | "clear_to_fill"
  | "shipment_scheduled"
  | "fulfilled"
  | "exception";

export interface SpecialtyFulfillmentCase {
  id: string;
  umRequestId: string;
  source: "delegate_um_approved";
  planId: string;
  pharmacyId: string;
  pharmacyDisplay: string;
  requestType: "pharmacy_benefit";
  serviceCode: string;
  serviceLabel: string;
  codingSystem: "NDC";
  billingCode: string;
  state: SpecialtyFulfillmentState;
  paApprovalReceivedAt: string;
  intakeStartedAt: string;
  clearToFillAt: string | null;
  shipmentScheduledAt: string | null;
  deliveryConfirmedAt: string | null;
  exceptionRecordedAt: string | null;
  scheduleSlaHours: 24;
  intake: {
    approvedPaLinked: boolean;
    prescriptionPresent: boolean;
    assignedPharmacyConfirmed: boolean;
    therapyMetadataPresent: boolean;
    handoffDataComplete: boolean;
  };
  clearToFill: {
    benefitsOrClaimCheckCompleted: boolean;
    prescriptionValid: boolean;
    prescriberClarificationRequired: boolean;
    prescriberClarificationResolved: boolean;
    remsRequired: boolean;
    remsAuthorizationConfirmed: boolean;
    inventoryAvailable: boolean;
    copayOrPaymentReady: boolean;
  };
  shipment: {
    patientContactAttemptDocumented: boolean;
    addressConfirmed: boolean;
    deliveryWindowConfirmed: boolean;
    coldChainRequired: boolean;
    coldChainPackoutValidated: boolean;
    courierScheduled: boolean;
  };
  fulfillment: {
    shipped: boolean;
    deliveryConfirmed: boolean;
    deliveryAttemptDocumented: boolean;
    temperatureLogValid: boolean;
    avoidableFulfillmentException: boolean;
    externalBlockerDocumented: boolean;
    exceptionReasonCode: string | null;
  };
  updatedAt: string;
}

/* eslint-disable no-unused-vars -- Interface method signatures require parameter names. */
export interface SpecialtyRxCaseStore {
  backend: SpecialtyRxStoreBackend;
  saveCase(caseRecord: SpecialtyFulfillmentCase): Promise<void>;
  getCase(fulfillmentCaseId: string): Promise<SpecialtyFulfillmentCase | null>;
  listCases(): Promise<SpecialtyFulfillmentCase[]>;
  savePlanRow(row: SpecialtyRxPlanAuditRow): Promise<void>;
  getPlanRow(fulfillmentCaseId: string): Promise<SpecialtyRxPlanAuditRow | null>;
  listPlanRows(): Promise<SpecialtyRxPlanAuditRow[]>;
}
/* eslint-enable no-unused-vars */

interface SpecialtyRxStoreEnv {
  [key: string]: string | undefined;
  SPECIALTY_RX_STORE_BACKEND?: string;
  PAS_STORE_BACKEND?: string;
  GCP_PROJECT_ID?: string;
  GOOGLE_CLOUD_PROJECT?: string;
  FIRESTORE_DATABASE_ID?: string;
}

interface FirestoreConfig {
  projectId: string;
  databaseId: string;
}

const DEFAULT_SPECIALTY_RX_STORE_BACKEND = "firestore";
const DEFAULT_GCP_PROJECT_ID = "operon-labs-nonprod";
const DEFAULT_FIRESTORE_DATABASE_ID = "(default)";
const SPECIALTY_FULFILLMENT_CASES_COLLECTION = "specialtyFulfillmentCases";
const SPECIALTY_PLAN_AUDIT_ROWS_COLLECTION = "specialtyRxPlanAuditRows";

export function createInMemorySpecialtyRxCaseStore(
  cases: SpecialtyFulfillmentCase[] = []
): SpecialtyRxCaseStore {
  return new InMemorySpecialtyRxCaseStore(cases);
}

export function createSpecialtyRxCaseStoreFromEnv(
  env: SpecialtyRxStoreEnv = process.env
): SpecialtyRxCaseStore {
  const backend =
    env.SPECIALTY_RX_STORE_BACKEND?.trim().toLowerCase() ||
    env.PAS_STORE_BACKEND?.trim().toLowerCase() ||
    DEFAULT_SPECIALTY_RX_STORE_BACKEND;

  if (backend === "memory") {
    return createInMemorySpecialtyRxCaseStore();
  }

  if (backend !== "firestore") {
    throw new Error(`UNSUPPORTED_SPECIALTY_RX_STORE_BACKEND:${backend}`);
  }

  return createFirestoreSpecialtyRxCaseStore({
    projectId: env.GCP_PROJECT_ID?.trim() || env.GOOGLE_CLOUD_PROJECT?.trim() || DEFAULT_GCP_PROJECT_ID,
    databaseId: env.FIRESTORE_DATABASE_ID?.trim() || DEFAULT_FIRESTORE_DATABASE_ID
  });
}

export function createFirestoreSpecialtyRxCaseStore(
  config: FirestoreConfig,
  firestore?: FirestoreDatabase
): SpecialtyRxCaseStore {
  return new FirestoreSpecialtyRxCaseStore(config, firestore);
}

class InMemorySpecialtyRxCaseStore implements SpecialtyRxCaseStore {
  readonly backend = "memory" as const;
  private readonly cases = new Map<string, SpecialtyFulfillmentCase>();
  private readonly planRows = new Map<string, SpecialtyRxPlanAuditRow>();

  constructor(cases: SpecialtyFulfillmentCase[]) {
    for (const caseRecord of cases) {
      validateSpecialtyFulfillmentCase(caseRecord);
      this.cases.set(caseRecord.id, copyCase(caseRecord));
    }
  }

  async saveCase(caseRecord: SpecialtyFulfillmentCase): Promise<void> {
    validateSpecialtyFulfillmentCase(caseRecord);
    this.cases.set(caseRecord.id, copyCase(caseRecord));
  }

  async getCase(fulfillmentCaseId: string): Promise<SpecialtyFulfillmentCase | null> {
    const caseRecord = this.cases.get(fulfillmentCaseId);
    return caseRecord ? copyCase(caseRecord) : null;
  }

  async listCases(): Promise<SpecialtyFulfillmentCase[]> {
    return [...this.cases.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(copyCase);
  }

  async savePlanRow(row: SpecialtyRxPlanAuditRow): Promise<void> {
    validateSpecialtyRxPlanAuditRow(row);
    this.planRows.set(row.fulfillmentCaseId, copyPlanRow(row));
  }

  async getPlanRow(fulfillmentCaseId: string): Promise<SpecialtyRxPlanAuditRow | null> {
    const row = this.planRows.get(fulfillmentCaseId);
    return row ? copyPlanRow(row) : null;
  }

  async listPlanRows(): Promise<SpecialtyRxPlanAuditRow[]> {
    return [...this.planRows.values()]
      .sort(comparePlanRows)
      .map(copyPlanRow);
  }
}

class FirestoreSpecialtyRxCaseStore implements SpecialtyRxCaseStore {
  readonly backend = "firestore" as const;
  private firestore: FirestoreDatabase | null = null;
  private readonly config: FirestoreConfig;

  constructor(config: FirestoreConfig, firestore?: FirestoreDatabase) {
    this.config = config;
    this.firestore = firestore ?? null;
  }

  async saveCase(caseRecord: SpecialtyFulfillmentCase): Promise<void> {
    validateSpecialtyFulfillmentCase(caseRecord);
    await (await this.getFirestore())
      .collection(SPECIALTY_FULFILLMENT_CASES_COLLECTION)
      .doc(caseRecord.id)
      .set(copyCase(caseRecord));
  }

  async getCase(fulfillmentCaseId: string): Promise<SpecialtyFulfillmentCase | null> {
    const snapshot = await (await this.getFirestore())
      .collection(SPECIALTY_FULFILLMENT_CASES_COLLECTION)
      .doc(fulfillmentCaseId)
      .get();

    return snapshot.exists ? normalizeSpecialtyFulfillmentCase(snapshot.data()) : null;
  }

  async listCases(): Promise<SpecialtyFulfillmentCase[]> {
    const snapshot = await (await this.getFirestore())
      .collection(SPECIALTY_FULFILLMENT_CASES_COLLECTION)
      .get();

    return snapshot.docs
      .map((doc) => normalizeSpecialtyFulfillmentCase(doc.data()))
      .filter((caseRecord): caseRecord is SpecialtyFulfillmentCase => Boolean(caseRecord))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(copyCase);
  }

  async savePlanRow(row: SpecialtyRxPlanAuditRow): Promise<void> {
    validateSpecialtyRxPlanAuditRow(row);
    await (await this.getFirestore())
      .collection(SPECIALTY_PLAN_AUDIT_ROWS_COLLECTION)
      .doc(row.fulfillmentCaseId)
      .set(removeUndefinedFields(copyPlanRow(row)));
  }

  async getPlanRow(fulfillmentCaseId: string): Promise<SpecialtyRxPlanAuditRow | null> {
    const snapshot = await (await this.getFirestore())
      .collection(SPECIALTY_PLAN_AUDIT_ROWS_COLLECTION)
      .doc(fulfillmentCaseId)
      .get();

    return snapshot.exists ? normalizeSpecialtyRxPlanAuditRow(snapshot.data()) : null;
  }

  async listPlanRows(): Promise<SpecialtyRxPlanAuditRow[]> {
    const snapshot = await (await this.getFirestore())
      .collection(SPECIALTY_PLAN_AUDIT_ROWS_COLLECTION)
      .get();

    return snapshot.docs
      .map((doc) => normalizeSpecialtyRxPlanAuditRow(doc.data()))
      .filter((row): row is SpecialtyRxPlanAuditRow => Boolean(row))
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

function normalizeSpecialtyFulfillmentCase(value: unknown): SpecialtyFulfillmentCase | null {
  if (!isSpecialtyFulfillmentCaseShape(value)) {
    return null;
  }

  return copyCase(value);
}

function normalizeSpecialtyRxPlanAuditRow(value: unknown): SpecialtyRxPlanAuditRow | null {
  if (!isSpecialtyRxPlanAuditRowShape(value)) {
    return null;
  }

  return copyPlanRow(value);
}

function validateSpecialtyFulfillmentCase(value: SpecialtyFulfillmentCase): void {
  if (!isSpecialtyFulfillmentCaseShape(value)) {
    throw new Error("INVALID_SPECIALTY_FULFILLMENT_CASE");
  }
}

function validateSpecialtyRxPlanAuditRow(value: SpecialtyRxPlanAuditRow): void {
  if (!isSpecialtyRxPlanAuditRowShape(value)) {
    throw new Error("INVALID_SPECIALTY_RX_PLAN_AUDIT_ROW");
  }
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

function isSpecialtyFulfillmentCaseShape(value: unknown): value is SpecialtyFulfillmentCase {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SpecialtyFulfillmentCase>;

  return (
    typeof candidate.id === "string" &&
    candidate.id.startsWith("RXF-") &&
    typeof candidate.umRequestId === "string" &&
    candidate.umRequestId.startsWith("PA-") &&
    candidate.source === "delegate_um_approved" &&
    candidate.requestType === "pharmacy_benefit" &&
    candidate.codingSystem === "NDC" &&
    typeof candidate.updatedAt === "string"
  );
}

function isSpecialtyRxPlanAuditRowShape(value: unknown): value is SpecialtyRxPlanAuditRow {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SpecialtyRxPlanAuditRow>;

  return (
    candidate.evaluationType === "specialty_rx_fulfillment_sla" &&
    typeof candidate.fulfillmentCaseId === "string" &&
    candidate.fulfillmentCaseId.startsWith("RXF-") &&
    typeof candidate.umRequestId === "string" &&
    candidate.umRequestId.startsWith("PA-") &&
    typeof candidate.id === "string" &&
    typeof candidate.planId === "string" &&
    typeof candidate.pharmacyId === "string" &&
    candidate.requestType === "pharmacy_benefit" &&
    typeof candidate.state === "string" &&
    typeof candidate.incentiveStatus === "string" &&
    typeof candidate.paymentStatus === "string" &&
    typeof candidate.incentiveValue === "number" &&
    Array.isArray(candidate.reasonCodes) &&
    typeof candidate.settlementToken === "object" &&
    candidate.settlementToken !== null &&
    isSpecialtyFulfillmentCaseShape(candidate.fulfillmentCase)
  );
}

type SpecialtyFulfillmentCaseWithLegacyDeliverySla = SpecialtyFulfillmentCase & {
  deliverySlaHours?: number;
};

function copyCase(caseRecord: SpecialtyFulfillmentCase): SpecialtyFulfillmentCase {
  const clone = structuredClone(caseRecord) as SpecialtyFulfillmentCaseWithLegacyDeliverySla;
  delete clone.deliverySlaHours;

  return clone;
}

type SpecialtyRxPlanAuditRowWithLegacySlaFields = SpecialtyRxPlanAuditRow & {
  scheduleSlaStatus?: SpecialtyRxSlaStatus;
  deliverySlaStatus?: SpecialtyRxSlaStatus;
};

function copyPlanRow(row: SpecialtyRxPlanAuditRow): SpecialtyRxPlanAuditRow {
  const clone = structuredClone(row) as SpecialtyRxPlanAuditRowWithLegacySlaFields;
  const { scheduleSlaStatus, deliverySlaStatus, ...rowWithoutLegacySlaFields } = clone;

  return {
    ...rowWithoutLegacySlaFields,
    fulfillmentSlaStatus:
      normalizeSlaStatus(clone.fulfillmentSlaStatus) ??
      normalizeSlaStatus(scheduleSlaStatus) ??
      inferFulfillmentSlaStatus(clone) ??
      normalizeSlaStatus(deliverySlaStatus) ??
      "pending"
  };
}

function comparePlanRows(left: SpecialtyRxPlanAuditRow, right: SpecialtyRxPlanAuditRow): number {
  return (right.deliveryConfirmedAt ?? right.fulfillmentCase.updatedAt).localeCompare(
    left.deliveryConfirmedAt ?? left.fulfillmentCase.updatedAt
  );
}

function normalizeSlaStatus(value: unknown): SpecialtyRxSlaStatus | null {
  return value === "pending" || value === "within_sla" || value === "breached" || value === "not_applicable"
    ? value
    : null;
}

function inferFulfillmentSlaStatus(row: SpecialtyRxPlanAuditRow): SpecialtyRxSlaStatus | null {
  if (!row.clearToFillAt) {
    return "pending";
  }

  if (!row.shipmentScheduledAt) {
    return "not_applicable";
  }

  const slaHours = row.fulfillmentCase.scheduleSlaHours;
  const dueAt = new Date(row.clearToFillAt).getTime() + slaHours * 60 * 60 * 1000;
  const shipmentScheduledAt = new Date(row.shipmentScheduledAt).getTime();

  if (Number.isNaN(dueAt) || Number.isNaN(shipmentScheduledAt)) {
    return null;
  }

  return shipmentScheduledAt <= dueAt ? "within_sla" : "breached";
}
