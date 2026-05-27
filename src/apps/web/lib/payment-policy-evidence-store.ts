import { buildBusinessEvaluationId, buildPaymentIntentId } from "@operon-labs/hedera-executor";
import type { Currency } from "@operon-labs/policy-engine";
import type { FirestoreDatabase } from "./pas-persistence";

export type PaymentPolicyEvidenceStoreBackend = "firestore" | "memory";
export type PaymentPolicyRuntime = "hedera-agent-kit-policy";
export type PaymentPolicyEvidenceOutcome = "paid" | "blocked" | "simulated";
export type PaymentPolicyControlStatus = "passed" | "failed" | "not_run";

export interface PaymentPolicyControlEvidence {
  id: string;
  label: string;
  status: PaymentPolicyControlStatus;
  expected?: string;
  actual?: string;
  failureCode?: string;
}

export interface PaymentPolicyEvidence {
  incentiveEvaluationId: string;
  umRequestId: string;
  caseId: string;
  planId: string;
  paymentPolicyId: string;
  businessPolicyId: string;
  runtime: PaymentPolicyRuntime;
  outcome: PaymentPolicyEvidenceOutcome;
  failureCode: string | null;
  requestedPayment: {
    amount: number;
    token: Currency;
    recipientWalletId: string;
  };
  controls: PaymentPolicyControlEvidence[];
  paymentIntentId: string;
  transactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface PaymentPolicyEvidenceStore {
  backend: PaymentPolicyEvidenceStoreBackend;
  saveEvidence(evidence: PaymentPolicyEvidence): Promise<void>;
  getEvidence(paymentIntentId: string): Promise<PaymentPolicyEvidence | null>;
}
/* eslint-enable no-unused-vars */

interface PaymentPolicyEvidenceStoreEnv {
  [key: string]: string | undefined;
  PAYMENT_POLICY_EVIDENCE_STORE_BACKEND?: string;
  GCP_PROJECT_ID?: string;
  GOOGLE_CLOUD_PROJECT?: string;
  FIRESTORE_DATABASE_ID?: string;
}

interface FirestoreConfig {
  projectId: string;
  databaseId: string;
}

const DEFAULT_PAYMENT_POLICY_EVIDENCE_STORE_BACKEND = "firestore";
const DEFAULT_GCP_PROJECT_ID = "operon-labs-nonprod";
const DEFAULT_FIRESTORE_DATABASE_ID = "(default)";
const PAYMENT_POLICY_EVIDENCES_COLLECTION = "paymentPolicyEvidences";

export function createPaymentPolicyEvidenceStoreFromEnv(
  env: PaymentPolicyEvidenceStoreEnv = process.env
): PaymentPolicyEvidenceStore | undefined {
  const backend =
    env.PAYMENT_POLICY_EVIDENCE_STORE_BACKEND?.trim().toLowerCase() ||
    DEFAULT_PAYMENT_POLICY_EVIDENCE_STORE_BACKEND;

  if (backend === "memory") {
    return undefined;
  }

  if (backend !== "firestore") {
    throw new Error(`UNSUPPORTED_PAYMENT_POLICY_EVIDENCE_STORE_BACKEND:${backend}`);
  }

  return createFirestorePaymentPolicyEvidenceStore({
    projectId: env.GCP_PROJECT_ID?.trim() || env.GOOGLE_CLOUD_PROJECT?.trim() || DEFAULT_GCP_PROJECT_ID,
    databaseId: env.FIRESTORE_DATABASE_ID?.trim() || DEFAULT_FIRESTORE_DATABASE_ID
  });
}

export function createFirestorePaymentPolicyEvidenceStore(
  config: FirestoreConfig,
  firestore?: FirestoreDatabase
): PaymentPolicyEvidenceStore {
  return new FirestorePaymentPolicyEvidenceStore(config, firestore);
}

class FirestorePaymentPolicyEvidenceStore implements PaymentPolicyEvidenceStore {
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

  async saveEvidence(evidence: PaymentPolicyEvidence): Promise<void> {
    validatePaymentPolicyEvidenceIds(evidence);

    await (await this.getFirestore())
      .collection(PAYMENT_POLICY_EVIDENCES_COLLECTION)
      .doc(evidence.paymentIntentId)
      .set(toFirestoreEvidence(evidence));
  }

  async getEvidence(paymentIntentId: string): Promise<PaymentPolicyEvidence | null> {
    const snapshot = await (await this.getFirestore())
      .collection(PAYMENT_POLICY_EVIDENCES_COLLECTION)
      .doc(paymentIntentId)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return copyEvidence(snapshot.data() as PaymentPolicyEvidence);
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

function copyEvidence(evidence: PaymentPolicyEvidence): PaymentPolicyEvidence {
  return structuredClone(evidence);
}

function toFirestoreEvidence(evidence: PaymentPolicyEvidence): PaymentPolicyEvidence {
  return removeUndefinedFields(copyEvidence(evidence)) as PaymentPolicyEvidence;
}

function validatePaymentPolicyEvidenceIds(evidence: PaymentPolicyEvidence): void {
  assertCanonicalPaId(evidence.umRequestId, "evidence.umRequestId");
  assertMatchingCanonicalId(evidence.caseId, evidence.umRequestId, "evidence.caseId");

  const expectedEvaluationId = buildBusinessEvaluationId({
    umRequestId: evidence.umRequestId,
    businessPolicyId: evidence.businessPolicyId
  });
  if (evidence.incentiveEvaluationId !== expectedEvaluationId) {
    throw new Error("PAYMENT_POLICY_EVIDENCE_ID_MISMATCH:evidence.incentiveEvaluationId");
  }

  if (!evidence.paymentIntentId) {
    throw new Error("PAYMENT_POLICY_EVIDENCE_ID_REQUIRED:evidence.paymentIntentId");
  }

  const expectedPaymentIntentId = buildPaymentIntentId({
    umRequestId: evidence.umRequestId,
    caseId: evidence.caseId,
    incentiveEvaluationId: evidence.incentiveEvaluationId,
    businessPolicyId: evidence.businessPolicyId,
    paymentPolicyId: evidence.paymentPolicyId
  });
  if (evidence.paymentIntentId !== expectedPaymentIntentId) {
    throw new Error("PAYMENT_POLICY_EVIDENCE_ID_MISMATCH:evidence.paymentIntentId");
  }
}

function assertCanonicalPaId(value: string, fieldName: string): void {
  if (!value.startsWith("PA-")) {
    throw new Error(`PAYMENT_POLICY_EVIDENCE_ID_NOT_CANONICAL:${fieldName}`);
  }
}

function assertMatchingCanonicalId(value: string, expected: string, fieldName: string): void {
  if (value !== expected) {
    throw new Error(`PAYMENT_POLICY_EVIDENCE_ID_MISMATCH:${fieldName}`);
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
