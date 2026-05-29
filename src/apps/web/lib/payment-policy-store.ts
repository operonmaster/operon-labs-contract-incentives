import type { HederaAgentPlanPolicy } from "@operon-labs/hedera-executor";
import type { FirestoreDatabase } from "./pas-persistence";

export type PaymentPolicyStoreBackend = "firestore" | "memory";
export type PaymentPlanPolicy = HederaAgentPlanPolicy;

export interface StoredPaymentPlanPolicy extends PaymentPlanPolicy {
  updatedAt?: string;
  updatedBy?: string;
}

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface PaymentPolicyStore {
  backend: PaymentPolicyStoreBackend;
  seedDefaults(): Promise<void>;
  getPolicyForPlan(planId: string): Promise<PaymentPlanPolicy | null>;
  listPolicies(): Promise<PaymentPlanPolicy[]>;
  savePolicy(policy: PaymentPlanPolicy): Promise<void>;
}
/* eslint-enable no-unused-vars */

interface PaymentPolicyStoreEnv {
  [key: string]: string | undefined;
  PAYMENT_POLICY_STORE_BACKEND?: string;
  HEDERA_POLICY_STORE_BACKEND?: string;
  GCP_PROJECT_ID?: string;
  GOOGLE_CLOUD_PROJECT?: string;
  FIRESTORE_DATABASE_ID?: string;
}

interface FirestoreConfig {
  projectId: string;
  databaseId: string;
}

const DEFAULT_PAYMENT_POLICY_STORE_BACKEND = "firestore";
const DEFAULT_GCP_PROJECT_ID = "operon-labs-nonprod";
const DEFAULT_FIRESTORE_DATABASE_ID = "(default)";
const PAYMENT_POLICIES_COLLECTION = "paymentPolicies";
const POLICY_SEED_ACTOR = "operon-labs-contract-incentives";

export const defaultPaymentPlanPolicies: Record<string, PaymentPlanPolicy> = {
  "acme-health-ppo": planPolicy({
    planId: "acme-health-ppo",
    planName: "Acme Health PPO"
  }),
  "summit-health-hmo": planPolicy({
    planId: "summit-health-hmo",
    planName: "Summit Health HMO"
  })
};

export function createPaymentPolicyStoreFromEnv(
  env: PaymentPolicyStoreEnv = process.env
): PaymentPolicyStore {
  const backend =
    env.PAYMENT_POLICY_STORE_BACKEND?.trim().toLowerCase() ||
    env.HEDERA_POLICY_STORE_BACKEND?.trim().toLowerCase() ||
    DEFAULT_PAYMENT_POLICY_STORE_BACKEND;

  if (backend === "memory") {
    return createInMemoryPaymentPolicyStore(defaultPaymentPlanPolicies);
  }

  if (backend !== "firestore") {
    throw new Error(`UNSUPPORTED_PAYMENT_POLICY_STORE_BACKEND:${backend}`);
  }

  return createFirestorePaymentPolicyStore({
    projectId: env.GCP_PROJECT_ID?.trim() || env.GOOGLE_CLOUD_PROJECT?.trim() || DEFAULT_GCP_PROJECT_ID,
    databaseId: env.FIRESTORE_DATABASE_ID?.trim() || DEFAULT_FIRESTORE_DATABASE_ID
  });
}

export function createInMemoryPaymentPolicyStore(
  policies: Record<string, PaymentPlanPolicy>
): PaymentPolicyStore {
  return new InMemoryPaymentPolicyStore(policies);
}

export function createFirestorePaymentPolicyStore(
  config: FirestoreConfig,
  firestore?: FirestoreDatabase
): PaymentPolicyStore {
  return new FirestorePaymentPolicyStore(config, firestore);
}

class InMemoryPaymentPolicyStore implements PaymentPolicyStore {
  readonly backend = "memory" as const;
  private readonly policies = new Map<string, PaymentPlanPolicy>();

  constructor(policies: Record<string, PaymentPlanPolicy>) {
    for (const policy of Object.values(policies)) {
      this.policies.set(policy.planId, copyPolicy(policy));
    }
  }

  async seedDefaults(): Promise<void> {
    for (const policy of Object.values(defaultPaymentPlanPolicies)) {
      if (!this.policies.has(policy.planId)) {
        this.policies.set(policy.planId, copyPolicy(policy));
      }
    }
  }

  async getPolicyForPlan(planId: string): Promise<PaymentPlanPolicy | null> {
    await this.seedDefaults();
    const policy = this.policies.get(planId);
    return policy ? copyPolicy(policy) : null;
  }

  async listPolicies(): Promise<PaymentPlanPolicy[]> {
    await this.seedDefaults();
    return [...this.policies.values()].sort(comparePolicies).map(copyPolicy);
  }

  async savePolicy(policy: PaymentPlanPolicy): Promise<void> {
    this.policies.set(policy.planId, copyPolicy(policy));
  }
}

class FirestorePaymentPolicyStore implements PaymentPolicyStore {
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
    const updatedAt = new Date().toISOString();

    await Promise.all(
      Object.values(defaultPaymentPlanPolicies).map(async (policy) => {
        const ref = firestore.collection(PAYMENT_POLICIES_COLLECTION).doc(policy.planId);
        const existing = await ref.get();
        if (existing.exists) {
          const existingPolicy = existing.data();
          if (isSeedOwnedOldDefaultPaymentPolicy(existingPolicy, policy)) {
            await ref.set({
              ...copyPolicy(policy),
              updatedAt,
              updatedBy: POLICY_SEED_ACTOR
            } satisfies StoredPaymentPlanPolicy);
          }
          return;
        }

        await ref.set({
          ...copyPolicy(policy),
          updatedAt,
          updatedBy: POLICY_SEED_ACTOR
        } satisfies StoredPaymentPlanPolicy);
      })
    );

    this.seeded = true;
  }

  async getPolicyForPlan(planId: string): Promise<PaymentPlanPolicy | null> {
    await this.ensureSeeded();
    const snapshot = await (await this.getFirestore()).collection(PAYMENT_POLICIES_COLLECTION).doc(planId).get();
    if (!snapshot.exists) {
      return null;
    }

    return normalizeStoredPolicy(snapshot.data());
  }

  async listPolicies(): Promise<PaymentPlanPolicy[]> {
    await this.ensureSeeded();
    const snapshot = await (await this.getFirestore()).collection(PAYMENT_POLICIES_COLLECTION).get();
    return snapshot.docs
      .map((doc) => normalizeStoredPolicy(doc.data()))
      .filter((policy): policy is PaymentPlanPolicy => Boolean(policy))
      .sort(comparePolicies)
      .map(copyPolicy);
  }

  async savePolicy(policy: PaymentPlanPolicy): Promise<void> {
    await (await this.getFirestore()).collection(PAYMENT_POLICIES_COLLECTION).doc(policy.planId).set({
      ...copyPolicy(policy),
      updatedAt: new Date().toISOString(),
      updatedBy: POLICY_SEED_ACTOR
    } satisfies StoredPaymentPlanPolicy);
    this.seeded = true;
  }

  private async ensureSeeded(): Promise<void> {
    if (this.seeded) {
      return;
    }

    await this.seedDefaults();
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

export const paymentPolicyStore = createPaymentPolicyStoreFromEnv();

function planPolicy({ planId, planName }: { planId: string; planName: string }): PaymentPlanPolicy {
  return {
    planId,
    planName,
    status: "active",
    version: "v1",
    businessEvaluationAttestation: true,
    duplicatePaymentPrevention: true,
    maxPaymentPerRequest: true,
    paymentToken: "HBAR",
    maxPaymentAmount: 7,
    paymentEnvelopeIntegrity: true
  };
}

function normalizeStoredPolicy(value: unknown): PaymentPlanPolicy | null {
  if (!isPaymentPlanPolicyShape(value)) {
    return null;
  }

  return copyPolicy(value);
}

function isPaymentPlanPolicyShape(value: unknown): value is PaymentPlanPolicy {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<PaymentPlanPolicy>;
  return (
    typeof candidate.planId === "string" &&
    typeof candidate.planName === "string" &&
    (candidate.status === "active" || candidate.status === "inactive") &&
    typeof candidate.version === "string" &&
    typeof candidate.businessEvaluationAttestation === "boolean" &&
    typeof candidate.duplicatePaymentPrevention === "boolean" &&
    typeof candidate.maxPaymentPerRequest === "boolean" &&
    typeof candidate.paymentToken === "string" &&
    typeof candidate.maxPaymentAmount === "number" &&
    typeof candidate.paymentEnvelopeIntegrity === "boolean"
  );
}

function comparePolicies(left: PaymentPlanPolicy, right: PaymentPlanPolicy): number {
  return left.planName.localeCompare(right.planName) || left.planId.localeCompare(right.planId);
}

function copyPolicy(policy: PaymentPlanPolicy): PaymentPlanPolicy {
  const copy = structuredClone(policy) as PaymentPlanPolicy & { updatedAt?: string; updatedBy?: string };
  delete copy.updatedAt;
  delete copy.updatedBy;
  return {
    planId: copy.planId,
    planName: copy.planName,
    status: copy.status,
    version: copy.version,
    businessEvaluationAttestation: copy.businessEvaluationAttestation,
    duplicatePaymentPrevention: copy.duplicatePaymentPrevention,
    maxPaymentPerRequest: copy.maxPaymentPerRequest,
    paymentToken: copy.paymentToken,
    maxPaymentAmount: copy.maxPaymentAmount,
    paymentEnvelopeIntegrity: copy.paymentEnvelopeIntegrity
  };
}

function isSeedOwnedOldDefaultPaymentPolicy(value: unknown, currentDefault: PaymentPlanPolicy): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<StoredPaymentPlanPolicy>;
  if (
    currentDefault.maxPaymentAmount !== 7 ||
    candidate.maxPaymentAmount !== 5 ||
    candidate.paymentToken !== "HBAR" ||
    candidate.maxPaymentPerRequest !== true
  ) {
    return false;
  }

  return candidate.updatedBy === POLICY_SEED_ACTOR || matchesHistoricalGeneratedDefault(candidate, currentDefault);
}

function matchesHistoricalGeneratedDefault(
  candidate: Partial<StoredPaymentPlanPolicy>,
  currentDefault: PaymentPlanPolicy
): boolean {
  return (
    candidate.updatedBy === undefined &&
    candidate.planId === currentDefault.planId &&
    candidate.planName === currentDefault.planName &&
    candidate.status === currentDefault.status &&
    candidate.version === currentDefault.version &&
    candidate.businessEvaluationAttestation === currentDefault.businessEvaluationAttestation &&
    candidate.duplicatePaymentPrevention === currentDefault.duplicatePaymentPrevention &&
    candidate.paymentToken === currentDefault.paymentToken &&
    candidate.maxPaymentPerRequest === currentDefault.maxPaymentPerRequest &&
    candidate.paymentEnvelopeIntegrity === currentDefault.paymentEnvelopeIntegrity
  );
}

export type HederaAgentPolicyStoreBackend = PaymentPolicyStoreBackend;
export type StoredHederaAgentPlanPolicy = StoredPaymentPlanPolicy;
export type HederaAgentPolicyStore = PaymentPolicyStore;
export const defaultHederaAgentPlanPolicies = defaultPaymentPlanPolicies;
export const createHederaAgentPolicyStoreFromEnv = createPaymentPolicyStoreFromEnv;
export const createInMemoryHederaAgentPolicyStore = createInMemoryPaymentPolicyStore;
export const createFirestoreHederaAgentPolicyStore = createFirestorePaymentPolicyStore;
export const hederaAgentPolicyStore = paymentPolicyStore;
