import type {
  PasFhirBundle,
  PasSubmittedEvent,
  UMPlatformEvent,
  UMRequest,
  ProviderDocumentationEvidence
} from "@operon-labs/um-platform";
import { generateUmRequestId } from "@operon-labs/um-platform";
import type { IncentiveWorklistRow } from "./provider-documentation-workflow";

export type PasStoreBackend = "firestore";
export type StoredPasSubmittedEvent = Omit<PasSubmittedEvent, "umRequestId"> & {
  umRequestId?: string;
};

export type StoredProviderDocumentationEvidence = ProviderDocumentationEvidence & {
  umRequestId: string;
  sourceCaseId: string;
};

export interface StoredPasSubmission {
  umRequest: UMRequest;
  evidence: ProviderDocumentationEvidence;
  fhirBundle: PasFhirBundle;
}

export interface StoredPasRequest {
  record: UMRequest;
  evidence: ProviderDocumentationEvidence;
  fhirBundle: PasFhirBundle;
}

export interface PersistedIncentiveWorklistRow extends IncentiveWorklistRow {
  umRequestId: string;
}

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface PasPersistenceStore {
  backend: PasStoreBackend;
  savePriorAuth(request: StoredPasRequest): Promise<void>;
  listPriorAuthRecords(): Promise<UMRequest[]>;
  getPriorAuthRecord(caseId: string): Promise<UMRequest | null>;
  getEvidence(umRequestId: string): Promise<ProviderDocumentationEvidence | null>;
  listPasEvents(): Promise<StoredPasSubmittedEvent[]>;
  saveIncentiveRow(row: PersistedIncentiveWorklistRow): Promise<void>;
  listIncentiveRows(): Promise<PersistedIncentiveWorklistRow[]>;
  getIncentiveRow(umRequestId: string): Promise<PersistedIncentiveWorklistRow | null>;
}

export interface UmPasPersistenceStore extends PasPersistenceStore {
  savePasSubmission(request: StoredPasSubmission): Promise<void>;
  saveUmRequest(umRequest: UMRequest): Promise<void>;
  listUmRequests(): Promise<UMRequest[]>;
  getUmRequest(umRequestId: string): Promise<UMRequest | null>;
  listUmEvents(): Promise<UMPlatformEvent[]>;
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
  delete?(): Promise<unknown>;
  get(): Promise<FirestoreDocumentSnapshot>;
}

export interface FirestoreQuerySnapshot {
  docs: Array<{
    id?: string;
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

export interface FirestoreWriteBatch {
  set(ref: FirestoreDocumentReference, value: unknown): FirestoreWriteBatch;
  commit(): Promise<unknown>;
}

export interface FirestoreDatabase {
  collection(name: string): FirestoreCollectionReference;
  batch?(): FirestoreWriteBatch;
}
/* eslint-enable no-unused-vars */

interface StoredPasClaimDocument {
  umRequest?: UMRequest;
  record?: UMRequest;
  evidence: ProviderDocumentationEvidence;
  fhirBundle: PasFhirBundle;
  storedAt?: string;
}

export function createPasPersistenceStoreFromEnv(env: PasPersistenceEnv = process.env): UmPasPersistenceStore | undefined {
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

export function createFirestorePasPersistenceStore(
  config: FirestoreConfig,
  firestore?: FirestoreDatabase
): UmPasPersistenceStore {
  return new FirestorePasPersistenceStore(config, firestore);
}

class FirestorePasPersistenceStore implements UmPasPersistenceStore {
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

  async savePasSubmission(request: StoredPasSubmission): Promise<void> {
    const storedAt = new Date().toISOString();
    const events: UMPlatformEvent[] = [
      { eventType: "PAS_SUBMITTED", caseId: request.umRequest.id, umRequestId: request.umRequest.id },
      { eventType: "UM_REQUEST_CREATED", caseId: request.umRequest.id, umRequestId: request.umRequest.id }
    ];

    const firestore = await this.getFirestore();
    const claimRef = firestore.collection(PAS_CLAIMS_COLLECTION).doc(request.umRequest.id);
    const claimValue = {
      umRequest: request.umRequest,
      evidence: buildStoredEvidence(request.evidence, request.umRequest),
      fhirBundle: request.fhirBundle,
      storedAt
    };
    const eventValues = events.map((event) => ({
      ...event,
      submittedAt: request.umRequest.submittedAt,
      storedAt
    }));

    if (firestore.batch) {
      let batch = firestore.batch().set(claimRef, claimValue);
      for (const eventValue of eventValues) {
        const eventRef = firestore.collection(AUDIT_EVENTS_COLLECTION).doc(
          `${request.umRequest.id}-${eventValue.eventType}`
        );
        batch = batch.set(eventRef, eventValue);
      }

      await batch.commit();
      return;
    }

    await Promise.all([
      claimRef.set(claimValue),
      ...eventValues.map((eventValue) =>
        firestore
          .collection(AUDIT_EVENTS_COLLECTION)
          .doc(`${request.umRequest.id}-${eventValue.eventType}`)
          .set(eventValue)
      )
    ]);
  }

  async saveUmRequest(umRequest: UMRequest): Promise<void> {
    const firestore = await this.getFirestore();
    const ref = firestore.collection(PAS_CLAIMS_COLLECTION).doc(umRequest.id);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      throw new Error(`UM_REQUEST_NOT_FOUND:${umRequest.id}`);
    }

    await ref.set({
      ...(snapshot.data() as Record<string, unknown>),
      umRequest,
      storedAt: new Date().toISOString()
    });
  }

  async listUmRequests(): Promise<UMRequest[]> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(PAS_CLAIMS_COLLECTION).orderBy("umRequest.submittedAt", "desc").get();
    return snapshot.docs
      .map((doc) => extractStoredUmRequest(doc.data() as StoredPasClaimDocument))
      .filter((umRequest): umRequest is UMRequest => Boolean(umRequest));
  }

  async getUmRequest(umRequestId: string): Promise<UMRequest | null> {
    const data = await this.getStoredPasSubmissionDataByUmRequestId(umRequestId);

    return data ? extractStoredUmRequest(data) : null;
  }

  async getEvidence(umRequestId: string): Promise<ProviderDocumentationEvidence | null> {
    const data = await this.getStoredPasSubmissionDataByUmRequestId(umRequestId);

    if (!data) {
      return null;
    }

    return data.evidence;
  }

  async listUmEvents(): Promise<UMPlatformEvent[]> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(AUDIT_EVENTS_COLLECTION).orderBy("submittedAt", "asc").get();
    return snapshot.docs.map((doc) => normalizeStoredUmEvent(doc.data() as UMPlatformEvent));
  }

  async savePriorAuth(request: StoredPasRequest): Promise<void> {
    await this.savePasSubmission({
      umRequest: request.record,
      evidence: request.evidence,
      fhirBundle: request.fhirBundle
    });
  }

  async listPriorAuthRecords(): Promise<UMRequest[]> {
    return this.listUmRequests();
  }

  async getPriorAuthRecord(caseId: string): Promise<UMRequest | null> {
    return this.getUmRequest(caseId);
  }

  async listPasEvents(): Promise<StoredPasSubmittedEvent[]> {
    return (await this.listUmEvents())
      .filter((event): event is PasSubmittedEvent => event.eventType === "PAS_SUBMITTED")
      .map(toPasSubmittedEvent);
  }

  private async getStoredPasSubmissionDataByUmRequestId(umRequestId: string): Promise<StoredPasClaimDocument | null> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(PAS_CLAIMS_COLLECTION).doc(umRequestId).get();

    if (snapshot.exists) {
      return snapshot.data() as StoredPasClaimDocument;
    }

    return null;
  }

  async saveIncentiveRow(row: PersistedIncentiveWorklistRow): Promise<void> {
    if (!row.umRequestId) {
      throw new Error("UM_REQUEST_ID_REQUIRED");
    }

    const firestore = await this.getFirestore();
    await firestore.collection(INCENTIVE_EVALUATIONS_COLLECTION).doc(row.umRequestId).set({
      ...row,
      storedAt: new Date().toISOString()
    });
  }

  async listIncentiveRows(): Promise<PersistedIncentiveWorklistRow[]> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(INCENTIVE_EVALUATIONS_COLLECTION).orderBy("submittedAt", "desc").get();
    return snapshot.docs.map((doc) => stripStoredAt(doc.data() as PersistedIncentiveWorklistRow & { storedAt?: string }));
  }

  async getIncentiveRow(umRequestId: string): Promise<PersistedIncentiveWorklistRow | null> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(INCENTIVE_EVALUATIONS_COLLECTION).doc(umRequestId).get();

    if (snapshot.exists) {
      return stripStoredAt(snapshot.data() as PersistedIncentiveWorklistRow & { storedAt?: string });
    }

    return null;
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

export function toPasSubmittedEvent(event: StoredPasSubmittedEvent): PasSubmittedEvent {
  return {
    eventType: "PAS_SUBMITTED",
    caseId: event.caseId,
    umRequestId: event.umRequestId ?? generateUmRequestId(event.caseId)
  };
}

function buildStoredEvidence(
  evidence: ProviderDocumentationEvidence,
  umRequest: UMRequest
): StoredProviderDocumentationEvidence {
  return {
    ...evidence,
    umRequestId: umRequest.id,
    sourceCaseId: umRequest.id
  };
}

function extractStoredUmRequest(data: StoredPasClaimDocument): UMRequest | null {
  return data.umRequest ?? data.record ?? null;
}

function normalizeStoredUmEvent(event: UMPlatformEvent): UMPlatformEvent {
  return {
    eventType: event.eventType,
    caseId: event.caseId,
    umRequestId: event.umRequestId ?? generateUmRequestId(event.caseId)
  };
}

function stripStoredAt(
  row: PersistedIncentiveWorklistRow & { storedAt?: string }
): PersistedIncentiveWorklistRow {
  const incentiveRow = { ...row };
  delete (incentiveRow as PersistedIncentiveWorklistRow & { storedAt?: string }).storedAt;
  return {
    ...incentiveRow,
    paymentIntentId: incentiveRow.paymentIntentId ?? null,
    settlementToken: incentiveRow.settlementToken ?? {
      symbol: incentiveRow.currency
    }
  };
}
