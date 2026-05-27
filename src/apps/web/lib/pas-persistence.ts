import { buildBusinessEvaluationId, buildPaymentIntentId } from "@operon-labs/hedera-executor";
import {
  buildProviderDocumentationEvidence,
  type ProviderDocumentationEvidence,
  type PasFhirBundle,
  type PasSubmittedEvent,
  type UMPlatformEvent,
  type UMRequest
} from "@operon-labs/um-platform";
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
  getIncentiveRow(umRequestId: string, businessPolicyId?: string): Promise<PersistedIncentiveWorklistRow | null>;
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
const UM_REQUESTS_COLLECTION = "umRequests";
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

type StoredUmRequestDocument = UMRequest & {
  umRequest?: UMRequest;
  record?: UMRequest;
  storedAt?: string;
  updatedAt?: string;
};

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
    validatePasSubmission(request);

    const storedAt = new Date().toISOString();
    const events: UMPlatformEvent[] = [
      { eventType: "PAS_SUBMITTED", caseId: request.umRequest.id, umRequestId: request.umRequest.id },
      { eventType: "UM_REQUEST_CREATED", caseId: request.umRequest.id, umRequestId: request.umRequest.id }
    ];

    const firestore = await this.getFirestore();
    const claimRef = firestore.collection(PAS_CLAIMS_COLLECTION).doc(request.umRequest.id);
    const umRequestRef = firestore.collection(UM_REQUESTS_COLLECTION).doc(request.umRequest.id);
    const claimValue = request.fhirBundle;
    const umRequestValue = request.umRequest;
    const eventValues = events.map((event) => ({
      ...event,
      submittedAt: request.umRequest.submittedAt,
      storedAt
    }));

    if (firestore.batch) {
      let batch = firestore.batch().set(claimRef, claimValue).set(umRequestRef, umRequestValue);
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
      umRequestRef.set(umRequestValue),
      ...eventValues.map((eventValue) =>
        firestore
          .collection(AUDIT_EVENTS_COLLECTION)
          .doc(`${request.umRequest.id}-${eventValue.eventType}`)
          .set(eventValue)
      )
    ]);
  }

  async saveUmRequest(umRequest: UMRequest): Promise<void> {
    validateUmRequestIds(umRequest);

    const firestore = await this.getFirestore();
    const existing = await this.getUmRequest(umRequest.id);

    if (!existing) {
      throw new Error(`UM_REQUEST_NOT_FOUND:${umRequest.id}`);
    }

    await firestore.collection(UM_REQUESTS_COLLECTION).doc(umRequest.id).set(umRequest);
  }

  async listUmRequests(): Promise<UMRequest[]> {
    const firestore = await this.getFirestore();
    const nativeSnapshot = await firestore.collection(UM_REQUESTS_COLLECTION).get();
    return nativeSnapshot.docs
      .map((doc) => extractStoredNativeUmRequest(doc.data() as StoredUmRequestDocument, doc.id))
      .filter((umRequest): umRequest is UMRequest => Boolean(umRequest))
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
  }

  async getUmRequest(umRequestId: string): Promise<UMRequest | null> {
    return this.getStoredNativeUmRequestById(umRequestId);
  }

  async getEvidence(umRequestId: string): Promise<ProviderDocumentationEvidence | null> {
    const nativeUmRequest = await this.getUmRequest(umRequestId);
    if (nativeUmRequest) {
      return canonicalizeStoredEvidence(buildProviderDocumentationEvidence(nativeUmRequest), nativeUmRequest.id);
    }

    return null;
  }

  async listUmEvents(): Promise<UMPlatformEvent[]> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(AUDIT_EVENTS_COLLECTION).orderBy("submittedAt", "asc").get();
    return snapshot.docs
      .map((doc) => normalizeStoredUmEvent(doc.data() as UMPlatformEvent, doc.id))
      .filter((event): event is UMPlatformEvent => Boolean(event));
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

  private async getStoredNativeUmRequestById(umRequestId: string): Promise<UMRequest | null> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(UM_REQUESTS_COLLECTION).doc(umRequestId).get();

    if (snapshot.exists) {
      return extractStoredNativeUmRequest(snapshot.data() as StoredUmRequestDocument, umRequestId);
    }

    return null;
  }

  async saveIncentiveRow(row: PersistedIncentiveWorklistRow): Promise<void> {
    if (!row.umRequestId) {
      throw new Error("UM_REQUEST_ID_REQUIRED");
    }

    validateIncentiveRowIds(row);

    const firestore = await this.getFirestore();
    const documentId = buildIncentiveRowDocumentId(row);
    await firestore.collection(INCENTIVE_EVALUATIONS_COLLECTION).doc(documentId).set({
      ...row,
      id: documentId,
      storedAt: new Date().toISOString()
    });
  }

  async listIncentiveRows(): Promise<PersistedIncentiveWorklistRow[]> {
    const firestore = await this.getFirestore();
    const snapshot = await firestore.collection(INCENTIVE_EVALUATIONS_COLLECTION).orderBy("submittedAt", "desc").get();
    return snapshot.docs.map((doc) =>
      canonicalizeStoredIncentiveRow(doc.data() as PersistedIncentiveWorklistRow & { storedAt?: string }, doc.id)
    );
  }

  async getIncentiveRow(
    umRequestId: string,
    businessPolicyId?: string
  ): Promise<PersistedIncentiveWorklistRow | null> {
    const firestore = await this.getFirestore();
    if (businessPolicyId) {
      const documentId = buildBusinessEvaluationId({ umRequestId, businessPolicyId });
      const snapshot = await firestore.collection(INCENTIVE_EVALUATIONS_COLLECTION).doc(documentId).get();

      if (snapshot.exists) {
        return canonicalizeStoredIncentiveRow(
          snapshot.data() as PersistedIncentiveWorklistRow & { storedAt?: string },
          documentId
        );
      }

      return null;
    }

    const rows = await this.listIncentiveRows();
    return rows.find((row) => row.umRequestId === umRequestId) ?? null;
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
  const canonicalId = getStoredCanonicalPaId(event.umRequestId, event.caseId);

  return {
    eventType: "PAS_SUBMITTED",
    caseId: canonicalId,
    umRequestId: canonicalId
  };
}

function validatePasSubmission(request: StoredPasSubmission): void {
  const canonicalId = request.umRequest.id;
  const evidence = request.evidence as ProviderDocumentationEvidence & {
    umRequestId?: string;
    sourceCaseId?: string;
  };

  validateUmRequestIds(request.umRequest);
  assertMatchingCanonicalId(request.evidence.id, canonicalId, "evidence.id");
  assertMatchingCanonicalId(request.evidence.caseId, canonicalId, "evidence.caseId");
  if (evidence.umRequestId !== undefined) {
    assertMatchingCanonicalId(evidence.umRequestId, canonicalId, "evidence.umRequestId");
  }
  if (evidence.sourceCaseId !== undefined) {
    assertMatchingCanonicalId(evidence.sourceCaseId, canonicalId, "evidence.sourceCaseId");
  }
  assertMatchingCanonicalId(request.fhirBundle.id, canonicalId, "fhirBundle.id");
  assertMatchingCanonicalId(getFhirClaimId(request.fhirBundle), canonicalId, "fhirBundle.claim.id");
  validateFhirClaimIdentifiers(request.fhirBundle, canonicalId);
}

function validateUmRequestIds(umRequest: UMRequest): void {
  assertCanonicalPaId(umRequest.id, "umRequest.id");
  assertMatchingCanonicalId(umRequest.caseId, umRequest.id, "umRequest.caseId");
  assertMatchingCanonicalId(umRequest.sourceCaseId, umRequest.id, "umRequest.sourceCaseId");
  assertMatchingCanonicalId(umRequest.auditRefs?.pasClaimBundleId, umRequest.id, "umRequest.auditRefs.pasClaimBundleId");
  if (umRequest.auditRefs?.pasClaimResponseBundleId !== null) {
    assertMatchingCanonicalId(
      umRequest.auditRefs?.pasClaimResponseBundleId,
      umRequest.id,
      "umRequest.auditRefs.pasClaimResponseBundleId"
    );
  }
}

function validateIncentiveRowIds(row: PersistedIncentiveWorklistRow): void {
  const rowIds = row as PersistedIncentiveWorklistRow & { caseId?: string; id?: string };

  assertCanonicalPaId(row.umRequestId, "row.umRequestId");
  if (rowIds.caseId !== undefined) {
    assertMatchingCanonicalId(rowIds.caseId, row.umRequestId, "row.caseId");
  }

  const expectedBusinessEvaluationId = buildIncentiveRowDocumentId(row);
  if (rowIds.id !== undefined && rowIds.id !== expectedBusinessEvaluationId) {
    throw new Error("PAS_SUBMISSION_ID_MISMATCH:row.id");
  }

  if (row.paymentIntentId !== null && row.paymentIntentId !== undefined) {
    const expectedPaymentIntentId = buildPaymentIntentId({
      umRequestId: row.umRequestId,
      caseId: rowIds.caseId ?? row.umRequestId,
      incentiveEvaluationId: expectedBusinessEvaluationId,
      businessPolicyId: row.policyId,
      paymentPolicyId: row.planId
    });
    if (row.paymentIntentId !== expectedPaymentIntentId) {
      throw new Error("PAS_SUBMISSION_ID_MISMATCH:row.paymentIntentId");
    }
  }
}

function buildIncentiveRowDocumentId(row: PersistedIncentiveWorklistRow): string {
  return buildBusinessEvaluationId({
    umRequestId: row.umRequestId,
    businessPolicyId: row.policyId
  });
}

function assertCanonicalPaId(value: string, fieldName: string): void {
  if (!value.startsWith("PA-")) {
    throw new Error(`PAS_SUBMISSION_ID_NOT_CANONICAL:${fieldName}`);
  }
}

function assertMatchingCanonicalId(value: string | null | undefined, expected: string, fieldName: string): void {
  if (value !== expected) {
    throw new Error(`PAS_SUBMISSION_ID_MISMATCH:${fieldName}`);
  }
}

function getFhirClaimId(fhirBundle: PasFhirBundle): string | undefined {
  return fhirBundle.entry.find((entry) => entry.resource.resourceType === "Claim")?.resource.id;
}

function validateFhirClaimIdentifiers(fhirBundle: PasFhirBundle, canonicalId: string): void {
  const claim = fhirBundle.entry.find((entry) => entry.resource.resourceType === "Claim")?.resource;

  if (claim?.resourceType !== "Claim") {
    return;
  }

  const requiredSystems = new Set(["prior-auth-case-id", "um-request-id"]);
  claim.identifier.forEach((identifier, index) => {
    if (isCanonicalPaIdentifierSystem(identifier.system)) {
      assertMatchingCanonicalId(identifier.value, canonicalId, `fhirBundle.claim.identifier[${index}].value`);
      requiredSystems.delete(getCanonicalPaIdentifierSystemName(identifier.system));
    }
  });

  for (const systemName of requiredSystems) {
    throw new Error(`PAS_SUBMISSION_ID_MISSING:fhirBundle.claim.identifier.${systemName}`);
  }
}

function isCanonicalPaIdentifierSystem(system: string): boolean {
  return system.endsWith("/prior-auth-case-id") || system.endsWith("/um-request-id");
}

function getCanonicalPaIdentifierSystemName(system: string): "prior-auth-case-id" | "um-request-id" {
  return system.endsWith("/prior-auth-case-id") ? "prior-auth-case-id" : "um-request-id";
}

function extractStoredNativeUmRequest(
  data: StoredUmRequestDocument,
  fallbackCanonicalId: string | undefined
): UMRequest | null {
  const candidate = data.umRequest ?? data.record ?? data;

  return isStoredUmRequest(candidate) ? canonicalizeStoredUmRequest(candidate, fallbackCanonicalId) : null;
}

function isStoredUmRequest(candidate: unknown): candidate is UMRequest {
  return (
    Boolean(candidate) &&
    typeof candidate === "object" &&
    typeof (candidate as UMRequest).id === "string" &&
    typeof (candidate as UMRequest).submittedAt === "string" &&
    typeof (candidate as UMRequest).state === "string"
  );
}

function canonicalizeStoredUmRequest(umRequest: UMRequest, fallbackCanonicalId: string | undefined): UMRequest {
  const canonicalId = getStoredCanonicalPaId(fallbackCanonicalId, umRequest.id, umRequest.caseId);
  const auditRefs = umRequest.auditRefs ?? {
    pasClaimBundleId: canonicalId,
    pasClaimResponseBundleId: null
  };

  return {
    ...umRequest,
    id: canonicalId,
    caseId: canonicalId,
    sourceCaseId: canonicalId,
    auditRefs: {
      pasClaimBundleId: canonicalId,
      pasClaimResponseBundleId: auditRefs.pasClaimResponseBundleId ? canonicalId : null
    }
  };
}

function canonicalizeStoredEvidence(
  evidence: ProviderDocumentationEvidence,
  fallbackCanonicalId: string
): StoredProviderDocumentationEvidence {
  const storedEvidence = evidence as ProviderDocumentationEvidence & {
    id?: string;
    umRequestId?: string;
    sourceCaseId?: string;
    dtrCompleted?: boolean;
    paResult?: unknown;
    denialReason?: unknown;
  };
  const canonicalId = getStoredCanonicalPaId(
    fallbackCanonicalId,
    storedEvidence.umRequestId,
    storedEvidence.id,
    storedEvidence.caseId
  );
  const sanitizedEvidence = { ...evidence } as StoredProviderDocumentationEvidence & {
    paResult?: unknown;
    denialReason?: unknown;
  };

  delete sanitizedEvidence.paResult;
  delete sanitizedEvidence.denialReason;

  return {
    ...sanitizedEvidence,
    id: canonicalId,
    caseId: canonicalId,
    umRequestId: canonicalId,
    sourceCaseId: canonicalId,
    dtrCompleted: storedEvidence.dtrCompleted ?? Boolean(storedEvidence.dtrTemplateCompleted)
  };
}

function normalizeStoredUmEvent(event: UMPlatformEvent, fallbackCanonicalId?: string): UMPlatformEvent | null {
  if (event.eventType === "UM_REQUEST_CREATED") {
    return normalizeStoredUmRequestCreatedEvent(event, fallbackCanonicalId);
  }

  const canonicalId = getStoredCanonicalPaId(
    getAuditEventCanonicalIdFromDocumentId(fallbackCanonicalId),
    event.umRequestId,
    event.caseId
  );

  return {
    eventType: event.eventType,
    caseId: canonicalId,
    umRequestId: canonicalId
  };
}

function normalizeStoredUmRequestCreatedEvent(
  event: UMPlatformEvent,
  fallbackCanonicalId?: string
): UMPlatformEvent | null {
  const storedEvent = event as UMPlatformEvent & { caseId?: string; umRequestId?: string };
  const documentCanonicalId = getStrictPaIdOrNull(getAuditEventCanonicalIdFromDocumentId(fallbackCanonicalId));
  const embeddedUmRequestId = getStrictPaIdOrNull(storedEvent.umRequestId);
  const embeddedCaseId = getStrictPaIdOrNull(storedEvent.caseId);

  if (storedEvent.umRequestId !== undefined && !embeddedUmRequestId) {
    return null;
  }

  if (storedEvent.caseId !== undefined && !embeddedCaseId) {
    return null;
  }

  if (embeddedUmRequestId) {
    if (documentCanonicalId && documentCanonicalId !== embeddedUmRequestId) {
      return null;
    }

    if (embeddedCaseId && embeddedCaseId !== embeddedUmRequestId) {
      return null;
    }

    return {
      eventType: "UM_REQUEST_CREATED",
      caseId: embeddedUmRequestId,
      umRequestId: embeddedUmRequestId
    };
  }

  if (!documentCanonicalId) {
    return null;
  }

  if (embeddedCaseId && embeddedCaseId !== documentCanonicalId) {
    return null;
  }

  return {
    eventType: "UM_REQUEST_CREATED",
    caseId: documentCanonicalId,
    umRequestId: documentCanonicalId
  };
}

function getAuditEventCanonicalIdFromDocumentId(documentId: string | undefined): string | undefined {
  if (!documentId) {
    return undefined;
  }

  const eventSuffixes = [
    "-PAS_SUBMITTED",
    "-UM_REQUEST_CREATED",
    "-UM_REQUEST_REVIEW_STARTED",
    "-UM_REQUEST_DETERMINED"
  ];
  const eventSuffix = eventSuffixes.find((suffix) => documentId.endsWith(suffix));

  return eventSuffix ? documentId.slice(0, -eventSuffix.length) : documentId;
}

function getStoredCanonicalPaId(...ids: Array<string | null | undefined>): string {
  const canonicalizedIds = ids.filter((id): id is string => Boolean(id)).map(canonicalizeLegacyCanonicalId);
  const paId = canonicalizedIds.find((id) => id.startsWith("PA-"));

  return paId ?? canonicalizedIds[0] ?? "";
}

function getStrictPaIdOrNull(id: string | null | undefined): string | null {
  if (!id) {
    return null;
  }

  return id.startsWith("PA-") ? id : null;
}

function canonicalizeLegacyCanonicalId(id: string): string {
  if (id.startsWith("UMR-")) {
    return `PA-${id.slice("UMR-".length)}`;
  }

  if (id.startsWith("pas-UMR-")) {
    return `PA-${id.slice("pas-UMR-".length)}`;
  }

  if (id.startsWith("pas-PA-")) {
    return id.slice("pas-".length);
  }

  return id;
}

function canonicalizeStoredIncentiveRow(
  row: PersistedIncentiveWorklistRow & { storedAt?: string },
  fallbackCanonicalId: string | undefined
): PersistedIncentiveWorklistRow {
  const incentiveRow = { ...row } as PersistedIncentiveWorklistRow & {
    caseId?: string;
    id?: string;
    paResult?: unknown;
    denialReason?: unknown;
    storedAt?: string;
  };
  const canonicalId = getStoredCanonicalPaId(fallbackCanonicalId, incentiveRow.umRequestId, incentiveRow.caseId);
  const expectedEvaluationId =
    incentiveRow.policyId && canonicalId.startsWith("PA-")
      ? buildBusinessEvaluationId({
          umRequestId: canonicalId,
          businessPolicyId: incentiveRow.policyId
        })
      : fallbackCanonicalId ?? incentiveRow.id ?? canonicalId;

  delete (incentiveRow as PersistedIncentiveWorklistRow & { storedAt?: string }).storedAt;
  delete incentiveRow.paResult;
  delete incentiveRow.denialReason;
  return {
    ...incentiveRow,
    id: expectedEvaluationId,
    umRequestId: canonicalId,
    caseId: canonicalId,
    state: incentiveRow.state ?? "pend",
    outcomeStatus: incentiveRow.outcomeStatus ?? null,
    paymentIntentId: incentiveRow.paymentIntentId ?? null,
    settlementToken: incentiveRow.settlementToken ?? {
      symbol: incentiveRow.currency
    }
  };
}
