import type { PaymentIntent, PaymentIntentStore } from "@operon-labs/hedera-executor";
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
const DEFAULT_GCP_PROJECT_ID = "operon-labs-nonprod";
const DEFAULT_FIRESTORE_DATABASE_ID = "(default)";
const PAYMENT_INTENTS_COLLECTION = "paymentIntents";

export function createPaymentIntentStoreFromEnv(env: PaymentIntentStoreEnv = process.env): PaymentIntentPersistenceStore | undefined {
  const backend = env.PAYMENT_INTENT_STORE_BACKEND?.trim().toLowerCase() || DEFAULT_PAYMENT_INTENT_STORE_BACKEND;

  if (backend === "memory") {
    return undefined;
  }

  if (backend !== "firestore") {
    throw new Error(`UNSUPPORTED_PAYMENT_INTENT_STORE_BACKEND:${backend}`);
  }

  return createFirestorePaymentIntentStore({
    projectId: env.GCP_PROJECT_ID?.trim() || env.GOOGLE_CLOUD_PROJECT?.trim() || DEFAULT_GCP_PROJECT_ID,
    databaseId: env.FIRESTORE_DATABASE_ID?.trim() || DEFAULT_FIRESTORE_DATABASE_ID
  });
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

    if (ref.create) {
      try {
        await ref.create(reserved);
      } catch {
        const duplicate = await ref.get();
        return {
          allowed: false,
          reasonCode: "DUPLICATE_PAYMENT_BLOCKED",
          intent: duplicate.data() as PaymentIntent
        };
      }
    } else {
      await ref.set(reserved);
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

  async markIntentFailed(intentId: string): Promise<void> {
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
