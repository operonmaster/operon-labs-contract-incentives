import type {
  PasFhirBundle,
  PasSubmittedEvent,
  PriorAuthRecord,
  ProviderDocumentationEvidence
} from "@operon-labs/um-platform";
import type { IncentiveWorklistRow } from "./provider-documentation-workflow";

export type PasStoreBackend = "firestore";

export interface StoredPasRequest {
  record: PriorAuthRecord;
  evidence: ProviderDocumentationEvidence;
  fhirBundle: PasFhirBundle;
}

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface PasPersistenceStore {
  backend: PasStoreBackend;
  savePriorAuth(request: StoredPasRequest): Promise<void>;
  listPriorAuthRecords(): Promise<PriorAuthRecord[]>;
  getPriorAuthRecord(caseId: string): Promise<PriorAuthRecord | null>;
  getEvidence(caseId: string): Promise<ProviderDocumentationEvidence | null>;
  listPasEvents(): Promise<PasSubmittedEvent[]>;
  saveIncentiveRow(row: IncentiveWorklistRow): Promise<void>;
  listIncentiveRows(): Promise<IncentiveWorklistRow[]>;
  getIncentiveRow(caseId: string): Promise<IncentiveWorklistRow | null>;
}

interface PasPersistenceEnv {
  [key: string]: string | undefined;
  PAS_STORE_BACKEND?: string;
  GCP_PROJECT_ID?: string;
  GOOGLE_CLOUD_PROJECT?: string;
  FIRESTORE_DATABASE_ID?: string;
}

export interface FirestoreConfig {
  projectId: string;
  databaseId: string;
}

const DEFAULT_PAS_STORE_BACKEND = "firestore";
const DEFAULT_GCP_PROJECT_ID = "operon-labs-nonprod";
const DEFAULT_FIRESTORE_DATABASE_ID = "(default)";
const PAS_CLAIMS_COLLECTION = "pasClaims";
const AUDIT_EVENTS_COLLECTION = "auditEvents";
const INCENTIVE_EVALUATIONS_COLLECTION = "incentiveEvaluations";

export interface FirestoreDocumentSnapshot {
  exists: boolean;
  data(): unknown;
}

export interface FirestoreDocumentReference {
  create?(value: unknown): Promise<unknown>;
  set(value: unknown): Promise<unknown>;
  get(): Promise<FirestoreDocumentSnapshot>;
}

export interface FirestoreQuerySnapshot {
  docs: Array<{
    data(): unknown;
  }>;
}

export interface FirestoreCollectionReference {
  doc(id: string): FirestoreDocumentReference;
  get(): Promise<FirestoreQuerySnapshot>;
  orderBy(field: string, direction: "asc" | "desc"): {
    get(): Promise<FirestoreQuerySnapshot>;
  };
}

export interface FirestoreDatabase {
  collection(name: string): FirestoreCollectionReference;
}
/* eslint-enable no-unused-vars */

export function createPasPersistenceStoreFromEnv(env: PasPersistenceEnv = process.env): PasPersistenceStore | undefined {
  const backend = env.PAS_STORE_BACKEND?.trim().toLowerCase() || DEFAULT_PAS_STORE_BACKEND;

  if (backend === "memory") {
    return undefined;
  }

  if (backend !== "firestore") {
    throw new Error(`UNSUPPORTED_PAS_STORE_BACKEND:${backend}`);
  }

  const projectId = env.GCP_PROJECT_ID?.trim() || env.GOOGLE_CLOUD_PROJECT?.trim() || DEFAULT_GCP_PROJECT_ID;
  if (!projectId) {
    throw new Error("GCP_PROJECT_ID_REQUIRED");
  }

  return createFirestorePasPersistenceStore({
    projectId,
    databaseId: env.FIRESTORE_DATABASE_ID?.trim() || DEFAULT_FIRESTORE_DATABASE_ID
  });
}

export function createFirestorePasPersistenceStore(config: FirestoreConfig, firestore?: FirestoreDatabase): PasPersistenceStore {
  return new FirestorePasPersistenceStore(config, firestore);
}

class FirestorePasPersistenceStore implements PasPersistenceStore {
  readonly backend = "firestore" as const;
  private firestore: FirestoreDatabase | null = null;
  private readonly config: FirestoreConfig;

  constructor(
    config: FirestoreConfig,
    firestore?: FirestoreDatabase
  ) {
    this.config = config;
    this.firestore = firestore ?? null;
  }

  async savePriorAuth(request: StoredPasRequest): Promise<void> {
    const storedAt = new Date().toISOString();
    const event: PasSubmittedEvent = {
      eventType: "PAS_SUBMITTED",
      caseId: request.record.caseId
    };

    const firestore = await this.getFirestore();
    await Promise.all([
      firestore.collection(PAS_CLAIMS_COLLECTION).doc(request.record.caseId).set({
        ...request,
        storedAt
      }),
      firestore.collection(AUDIT_EVENTS_COLLECTION).doc(`${request.record.caseId}-${event.eventType}`).set({
        ...event,
        submittedAt: request.record.submittedAt,
        storedAt
      })
    ]);
  }

  async listPriorAuthRecords(): Promise<PriorAuthRecord[]> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(PAS_CLAIMS_COLLECTION).orderBy("record.submittedAt", "desc").get();
    return snapshot.docs.map((doc) => (doc.data() as { record: PriorAuthRecord }).record);
  }

  async getPriorAuthRecord(caseId: string): Promise<PriorAuthRecord | null> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(PAS_CLAIMS_COLLECTION).doc(caseId).get();

    if (!snapshot.exists) {
      return null;
    }

    return (snapshot.data() as { record: PriorAuthRecord }).record;
  }

  async getEvidence(caseId: string): Promise<ProviderDocumentationEvidence | null> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(PAS_CLAIMS_COLLECTION).doc(caseId).get();

    if (!snapshot.exists) {
      return null;
    }

    return (snapshot.data() as { evidence: ProviderDocumentationEvidence }).evidence;
  }

  async listPasEvents(): Promise<PasSubmittedEvent[]> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(AUDIT_EVENTS_COLLECTION).orderBy("submittedAt", "asc").get();
    return snapshot.docs.map((doc) => {
      const data = doc.data() as PasSubmittedEvent;
      return {
        eventType: data.eventType,
        caseId: data.caseId
      };
    });
  }

  async saveIncentiveRow(row: IncentiveWorklistRow): Promise<void> {
    const firestore = await this.getFirestore();
    await firestore.collection(INCENTIVE_EVALUATIONS_COLLECTION).doc(row.caseId).set({
      ...row,
      storedAt: new Date().toISOString()
    });
  }

  async listIncentiveRows(): Promise<IncentiveWorklistRow[]> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(INCENTIVE_EVALUATIONS_COLLECTION).orderBy("submittedAt", "desc").get();
    return snapshot.docs.map((doc) => stripStoredAt(doc.data() as IncentiveWorklistRow & { storedAt?: string }));
  }

  async getIncentiveRow(caseId: string): Promise<IncentiveWorklistRow | null> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(INCENTIVE_EVALUATIONS_COLLECTION).doc(caseId).get();

    if (!snapshot.exists) {
      return null;
    }

    return stripStoredAt(snapshot.data() as IncentiveWorklistRow & { storedAt?: string });
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

function stripStoredAt(row: IncentiveWorklistRow & { storedAt?: string }): IncentiveWorklistRow {
  const incentiveRow = { ...row };
  delete (incentiveRow as IncentiveWorklistRow & { storedAt?: string }).storedAt;
  return {
    ...incentiveRow,
    paymentIntentId: incentiveRow.paymentIntentId ?? null,
    settlementToken: incentiveRow.settlementToken ?? {
      symbol: incentiveRow.currency
    }
  };
}
