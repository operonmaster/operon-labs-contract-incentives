import {
  buildBusinessEvaluationId,
  buildPaymentIntentId,
  type PaymentIntent,
  type PaymentIntentStore
} from "@operon-labs/hedera-executor";
import { resolveFirestoreConfig } from "./firestore-config";
import type { FirestoreDatabase } from "./pas-persistence";

export type PaymentIntentStoreBackend = "firestore" | "memory";

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface PaymentIntentPersistenceStore extends PaymentIntentStore {
  backend: PaymentIntentStoreBackend;
  getIntent(intentId: string): Promise<PaymentIntent | null>;
}
/* eslint-enable no-unused-vars */

interface PaymentIntentStoreEnv {
  [key: string]: string | undefined;
  PAYMENT_INTENT_STORE_BACKEND?: string;
  GCP_PROJECT_ID?: string;
  GOOGLE_CLOUD_PROJECT?: string;
  FIRESTORE_DATABASE_ID?: string;
}

interface FirestoreConfig {
  projectId: string;
  databaseId: string;
}

const DEFAULT_PAYMENT_INTENT_STORE_BACKEND = "firestore";
const PAYMENT_INTENTS_COLLECTION = "paymentIntents";

export function createPaymentIntentStoreFromEnv(env: PaymentIntentStoreEnv = process.env): PaymentIntentPersistenceStore | undefined {
  const backend = env.PAYMENT_INTENT_STORE_BACKEND?.trim().toLowerCase() || DEFAULT_PAYMENT_INTENT_STORE_BACKEND;

  if (backend === "memory") {
    return undefined;
  }

  if (backend !== "firestore") {
    throw new Error(`UNSUPPORTED_PAYMENT_INTENT_STORE_BACKEND:${backend}`);
  }

  return createFirestorePaymentIntentStore(resolveFirestoreConfig(env));
}

export function createFirestorePaymentIntentStore(
  config: FirestoreConfig,
  firestore?: FirestoreDatabase
): PaymentIntentPersistenceStore {
  return new FirestorePaymentIntentStore(config, firestore);
}

class FirestorePaymentIntentStore implements PaymentIntentPersistenceStore {
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

  async reserveIntent(intent: PaymentIntent) {
    validatePaymentIntentIds(intent);

    const firestore = await this.getFirestore();
    const ref = firestore.collection(PAYMENT_INTENTS_COLLECTION).doc(intent.id);
    const existing = await ref.get();

    if (existing.exists) {
      return {
        allowed: false,
        reasonCode: "DUPLICATE_PAYMENT_BLOCKED",
        intent: existing.data() as PaymentIntent
      };
    }

    const reserved: PaymentIntent = {
      ...intent,
      status: "reserved",
      updatedAt: new Date().toISOString()
    };

    // Duplicate prevention relies on an atomic create: a check-then-set fallback
    // would allow two concurrent requests to both reserve the same settlement tuple.
    if (!ref.create) {
      throw new Error("PAYMENT_INTENT_RESERVE_REQUIRES_ATOMIC_CREATE");
    }

    try {
      await ref.create(reserved);
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }

      const duplicate = await ref.get();
      if (!duplicate.exists) {
        throw error;
      }

      return {
        allowed: false,
        reasonCode: "DUPLICATE_PAYMENT_BLOCKED",
        intent: duplicate.data() as PaymentIntent
      };
    }

    return {
      allowed: true,
      intent: reserved
    };
  }

  async markIntentSubmitted(intentId: string, transactionId: string): Promise<void> {
    const existing = await this.getIntent(intentId);
    if (!existing) {
      return;
    }

    await (await this.getFirestore())
      .collection(PAYMENT_INTENTS_COLLECTION)
      .doc(intentId)
      .set({
        ...existing,
        status: "submitted",
        transactionId,
        updatedAt: new Date().toISOString()
      } satisfies PaymentIntent);
  }

  async markIntentFailed(intentId: string, reasonCode: string): Promise<void> {
    const existing = await this.getIntent(intentId);
    if (!existing || existing.status === "submitted") {
      return;
    }

    await (await this.getFirestore())
      .collection(PAYMENT_INTENTS_COLLECTION)
      .doc(intentId)
      .set({
        ...existing,
        status: "failed",
        transactionId: null,
        failureReasonCode: reasonCode,
        updatedAt: new Date().toISOString()
      } satisfies PaymentIntent);
  }

  async getIntent(intentId: string): Promise<PaymentIntent | null> {
    const snapshot = await (await this.getFirestore()).collection(PAYMENT_INTENTS_COLLECTION).doc(intentId).get();

    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() as PaymentIntent;
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

function validatePaymentIntentIds(intent: PaymentIntent): void {
  assertCanonicalPaId(intent.umRequestId, "umRequestId");
  assertMatchingCanonicalId(intent.caseId, intent.umRequestId, "caseId");

  const expectedEvaluationId = buildBusinessEvaluationId({
    umRequestId: intent.umRequestId,
    businessPolicyId: intent.businessPolicyId
  });
  if (intent.incentiveEvaluationId !== expectedEvaluationId) {
    throw new Error("PAYMENT_INTENT_ID_MISMATCH:incentiveEvaluationId");
  }

  const expectedIntentId = buildPaymentIntentId({
    umRequestId: intent.umRequestId,
    caseId: intent.caseId,
    incentiveEvaluationId: intent.incentiveEvaluationId,
    businessPolicyId: intent.businessPolicyId,
    paymentPolicyId: intent.paymentPolicyId
  });
  if (intent.id !== expectedIntentId) {
    throw new Error("PAYMENT_INTENT_ID_MISMATCH:id");
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorWithCode = error as Error & { code?: unknown };
  return (
    errorWithCode.code === 6 ||
    errorWithCode.code === "already-exists" ||
    errorWithCode.code === "ALREADY_EXISTS" ||
    error.message.includes("ALREADY_EXISTS")
  );
}

function assertCanonicalPaId(value: string, fieldName: string): void {
  if (!value.startsWith("PA-")) {
    throw new Error(`PAYMENT_INTENT_ID_NOT_CANONICAL:${fieldName}`);
  }
}

function assertMatchingCanonicalId(value: string, expected: string, fieldName: string): void {
  if (value !== expected) {
    throw new Error(`PAYMENT_INTENT_ID_MISMATCH:${fieldName}`);
  }
}
