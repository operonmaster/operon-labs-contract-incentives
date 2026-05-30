import type { IncentivePolicy } from "@operon-labs/policy-engine";
import type { FirestoreDatabase } from "./pas-persistence";

export type PolicyStoreBackend = "firestore" | "memory";

export interface StoredIncentivePolicy extends IncentivePolicy {
  updatedAt?: string;
  updatedBy?: string;
}

export interface PolicyLookup {
  evaluationType: string;
  planId: string;
  providerId: string;
  requestType?: string;
  submittedAt?: string;
}

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface PolicyStore {
  backend: PolicyStoreBackend;
  seedDefaults(): Promise<void>;
  getPolicy(evaluationType: string): Promise<IncentivePolicy | null>;
  getPolicyById(policyId: string): Promise<IncentivePolicy | null>;
  findPolicy(lookup: PolicyLookup): Promise<IncentivePolicy | null>;
  findPolicies(lookup: PolicyLookup): Promise<IncentivePolicy[]>;
  listPolicies(evaluationType?: string): Promise<IncentivePolicy[]>;
  savePolicy(policy: IncentivePolicy, metadata?: Partial<Pick<StoredIncentivePolicy, "updatedAt" | "updatedBy">>): Promise<void>;
}
/* eslint-enable no-unused-vars */

interface PolicyStoreEnv {
  [key: string]: string | undefined;
  POLICY_STORE_BACKEND?: string;
  GCP_PROJECT_ID?: string;
  GOOGLE_CLOUD_PROJECT?: string;
  FIRESTORE_DATABASE_ID?: string;
}

interface FirestoreConfig {
  projectId: string;
  databaseId: string;
}

interface LoadedFirestoreDocument {
  id: string;
  value: unknown;
}

type LegacyWrappedPolicy = {
  evaluationType?: string;
  policyId?: string;
  status?: string;
  policy?: {
    evaluationType?: string;
    paymentFormula?: {
      baseAmount?: number;
      monthlyCap?: number;
      token?: {
        symbol?: string;
      };
    };
    submitterRules?: {
      walletMap?: Record<string, string>;
    };
    requiresHumanApproval?: boolean;
  };
};

const DEFAULT_POLICY_STORE_BACKEND = "firestore";
const DEFAULT_GCP_PROJECT_ID = "operon-labs-nonprod";
const DEFAULT_FIRESTORE_DATABASE_ID = "(default)";
const INCENTIVE_POLICIES_COLLECTION = "incentivePolicies";
const POLICY_SEED_ACTOR = "operon-labs-contract-incentives";
const PROVIDER_ID = "lakeside-provider-admin";
const PROVIDER_WALLET_ID = "0.0.9049549";
const APPEALS_SUBMITTER_ID = "lakeside-provider-admin";
const APPEALS_SUBMITTER_WALLET_ID = "0.0.9049549";
const DELEGATE_VENDOR_ID = "northstar-um";
const DELEGATE_VENDOR_WALLET_ID = "0.0.9049549";
const SPECIALTY_PHARMACY_ID = "atlas-specialty-rx";
const SPECIALTY_PHARMACY_WALLET_ID = "0.0.9049549";

export const defaultIncentivePolicies: Record<string, IncentivePolicy> = {
  provider_documentation_acme_outpatient: providerDocumentationPolicy({
    policyId: "plcy_8K2M4Q6R9T1V3X5Z7B0C",
    planId: "acme-health-ppo",
    planDisplay: "Acme Health PPO",
    requestType: "outpatient_service",
    includedServiceCodes: {
      cpt: ["73721"],
      ndc: []
    }
  }),
  provider_documentation_acme_pharmacy: providerDocumentationPolicy({
    policyId: "plcy_2N7P5R8T0V4X6Z1B3D9F",
    planId: "acme-health-ppo",
    planDisplay: "Acme Health PPO",
    requestType: "pharmacy_benefit",
    includedServiceCodes: {
      cpt: [],
      ndc: ["0169-4525-14", "0074-0554-02"]
    }
  }),
  provider_documentation_summit_outpatient: providerDocumentationPolicy({
    policyId: "plcy_9Q3S6V1X8Z2B5D7F0H4K",
    planId: "summit-health-hmo",
    planDisplay: "Summit Health HMO",
    requestType: "outpatient_service",
    includedServiceCodes: {
      cpt: ["73721"],
      ndc: []
    },
    amountPerEligibleRequest: 20
  }),
  provider_documentation_summit_pharmacy: providerDocumentationPolicy({
    policyId: "plcy_5R1T8W3Y6B0D9F2H4K7M",
    planId: "summit-health-hmo",
    planDisplay: "Summit Health HMO",
    requestType: "pharmacy_benefit",
    includedServiceCodes: {
      cpt: [],
      ndc: ["0169-4525-14", "0074-0554-02"]
    }
  }),
  delegate_um_acme_sla_bonus: delegateUmSlaBonusPolicy({
    policyId: "delegate-um-sla-bonus-v1",
    planId: "acme-health-ppo",
    requestType: "pharmacy_benefit"
  }),
  delegate_um_acme_outpatient_sla_bonus: delegateUmSlaBonusPolicy({
    policyId: "delegate-um-acme-outpatient-sla-bonus-v1",
    planId: "acme-health-ppo",
    requestType: "outpatient_service"
  }),
  delegate_um_summit_pharmacy_sla_bonus: delegateUmSlaBonusPolicy({
    policyId: "delegate-um-summit-pharmacy-sla-bonus-v1",
    planId: "summit-health-hmo",
    requestType: "pharmacy_benefit"
  }),
  delegate_um_summit_outpatient_sla_bonus: delegateUmSlaBonusPolicy({
    policyId: "delegate-um-summit-outpatient-sla-bonus-v1",
    planId: "summit-health-hmo",
    requestType: "outpatient_service"
  }),
  specialty_rx_acme_fulfillment_sla: specialtyRxFulfillmentSlaPolicy({
    policyId: "specialty-rx-fulfillment-sla-v1",
    planId: "acme-health-ppo"
  }),
  appeals_acme_packet_quality: appealsPacketQualityPolicy({
    policyId: "appeals-packet-quality-v1",
    planId: "acme-health-ppo"
  })
};

export function createPolicyStoreFromEnv(env: PolicyStoreEnv = process.env): PolicyStore {
  const backend = env.POLICY_STORE_BACKEND?.trim().toLowerCase() || DEFAULT_POLICY_STORE_BACKEND;

  if (backend === "memory") {
    return createInMemoryPolicyStore(defaultIncentivePolicies);
  }

  if (backend !== "firestore") {
    throw new Error(`UNSUPPORTED_POLICY_STORE_BACKEND:${backend}`);
  }

  return createFirestorePolicyStore({
    projectId: env.GCP_PROJECT_ID?.trim() || env.GOOGLE_CLOUD_PROJECT?.trim() || DEFAULT_GCP_PROJECT_ID,
    databaseId: env.FIRESTORE_DATABASE_ID?.trim() || DEFAULT_FIRESTORE_DATABASE_ID
  });
}

export function createInMemoryPolicyStore(policies: Record<string, IncentivePolicy>): PolicyStore {
  return new InMemoryPolicyStore(policies);
}

export function createFirestorePolicyStore(config: FirestoreConfig, firestore?: FirestoreDatabase): PolicyStore {
  return new FirestorePolicyStore(config, firestore);
}

class InMemoryPolicyStore implements PolicyStore {
  readonly backend = "memory" as const;
  private readonly policies = new Map<string, IncentivePolicy>();

  constructor(policies: Record<string, IncentivePolicy>) {
    for (const policy of Object.values(policies)) {
      this.policies.set(policy.policyId, copyPolicy(policy));
    }
  }

  async seedDefaults(): Promise<void> {
    for (const policy of Object.values(defaultIncentivePolicies)) {
      if (!this.policies.has(policy.policyId)) {
        this.policies.set(policy.policyId, copyPolicy(policy));
      }
    }
  }

  async getPolicy(evaluationType: string): Promise<IncentivePolicy | null> {
    return (await this.listPolicies(evaluationType))[0] ?? null;
  }

  async getPolicyById(policyId: string): Promise<IncentivePolicy | null> {
    await this.seedDefaults();
    const policy = this.policies.get(policyId);
    return policy ? copyPolicy(policy) : null;
  }

  async findPolicy(lookup: PolicyLookup): Promise<IncentivePolicy | null> {
    return (await this.findPolicies(lookup))[0] ?? null;
  }

  async findPolicies(lookup: PolicyLookup): Promise<IncentivePolicy[]> {
    const policies = await this.listPolicies(lookup.evaluationType);
    return policies.filter((policy) => matchesLookup(policy, lookup)).sort(comparePolicies).map(copyPolicy);
  }

  async listPolicies(evaluationType?: string): Promise<IncentivePolicy[]> {
    await this.seedDefaults();
    return [...this.policies.values()]
      .filter((policy) => policy.status === "active")
      .filter((policy) => !evaluationType || policy.evaluationType === evaluationType)
      .sort(comparePolicies)
      .map(copyPolicy);
  }

  async savePolicy(policy: IncentivePolicy): Promise<void> {
    this.policies.set(policy.policyId, copyPolicy(policy));
  }
}

class FirestorePolicyStore implements PolicyStore {
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
      Object.values(defaultIncentivePolicies).map(async (policy) => {
        const ref = firestore.collection(INCENTIVE_POLICIES_COLLECTION).doc(policy.policyId);
        const existing = await ref.get();
        if (existing.exists) {
          return;
        }

        await ref.set({
          ...copyPolicy(policy),
          updatedAt,
          updatedBy: POLICY_SEED_ACTOR
        } satisfies StoredIncentivePolicy);
      })
    );
    this.seeded = true;
  }

  async getPolicy(evaluationType: string): Promise<IncentivePolicy | null> {
    return (await this.listPolicies(evaluationType))[0] ?? null;
  }

  async getPolicyById(policyId: string): Promise<IncentivePolicy | null> {
    await this.ensureSeeded();
    const snapshot = await (await this.getFirestore()).collection(INCENTIVE_POLICIES_COLLECTION).doc(policyId).get();
    if (!snapshot.exists) {
      return null;
    }

    const normalized = normalizeStoredPolicy(snapshot.data());
    if (!normalized.policy) {
      return null;
    }

    if (normalized.rewrite) {
      await this.savePolicy(normalized.policy, {
        updatedBy: `${POLICY_SEED_ACTOR}-migration`
      });
    }

    return copyPolicy(normalized.policy);
  }

  async findPolicy(lookup: PolicyLookup): Promise<IncentivePolicy | null> {
    return (await this.findPolicies(lookup))[0] ?? null;
  }

  async findPolicies(lookup: PolicyLookup): Promise<IncentivePolicy[]> {
    const policies = await this.listPolicies(lookup.evaluationType);
    return policies.filter((policy) => matchesLookup(policy, lookup)).sort(comparePolicies).map(copyPolicy);
  }

  async listPolicies(evaluationType?: string): Promise<IncentivePolicy[]> {
    await this.ensureSeeded();
    const docs = await this.loadDocuments();
    const policies = await this.normalizeDocuments(docs);

    return policies
      .filter((policy) => policy.status === "active")
      .filter((policy) => !evaluationType || policy.evaluationType === evaluationType)
      .sort(comparePolicies)
      .map(copyPolicy);
  }

  async savePolicy(policy: IncentivePolicy, metadata: Partial<Pick<StoredIncentivePolicy, "updatedAt" | "updatedBy">> = {}): Promise<void> {
    const stored: StoredIncentivePolicy = {
      ...copyPolicy(policy),
      updatedAt: metadata.updatedAt ?? new Date().toISOString(),
      updatedBy: metadata.updatedBy ?? POLICY_SEED_ACTOR
    };
    await (await this.getFirestore()).collection(INCENTIVE_POLICIES_COLLECTION).doc(policy.policyId).set(stored);
    this.seeded = true;
  }

  private async ensureSeeded(): Promise<void> {
    if (this.seeded) {
      return;
    }

    const docs = await this.loadDocuments();
    const policies = await this.normalizeDocuments(docs);
    const storedPolicyIds = new Set(policies.map((policy) => policy.policyId));
    const missingDefaults = Object.values(defaultIncentivePolicies).filter((policy) => !storedPolicyIds.has(policy.policyId));

    for (const policy of missingDefaults) {
      await this.savePolicy(policy);
    }

    this.seeded = true;
  }

  private async normalizeDocuments(docs: LoadedFirestoreDocument[]): Promise<IncentivePolicy[]> {
    const policies: IncentivePolicy[] = [];

    for (const doc of docs) {
      const normalized = normalizeStoredPolicy(doc.value);
      if (!normalized.policy) {
        await this.deletePolicyDocument(doc.id);
        continue;
      }

      policies.push(normalized.policy);
      if (normalized.rewrite || doc.id !== normalized.policy.policyId) {
        await this.savePolicy(normalized.policy, {
          updatedBy: `${POLICY_SEED_ACTOR}-migration`
        });
        if (doc.id !== normalized.policy.policyId) {
          await this.deletePolicyDocument(doc.id);
        }
      }
    }

    return policies;
  }

  private async loadDocuments(): Promise<LoadedFirestoreDocument[]> {
    const snapshot = await (await this.getFirestore()).collection(INCENTIVE_POLICIES_COLLECTION).get();
    return snapshot.docs.map((doc) => ({
      id: doc.id ?? "",
      value: doc.data()
    }));
  }

  private async deletePolicyDocument(id: string): Promise<void> {
    if (!id) {
      return;
    }

    const ref = (await this.getFirestore()).collection(INCENTIVE_POLICIES_COLLECTION).doc(id);
    await ref.delete?.();
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

export const policyStore = createPolicyStoreFromEnv();

function normalizeStoredPolicy(value: unknown): { policy: IncentivePolicy | null; rewrite: boolean } {
  if (isDeprecatedCombinedProviderDocumentationPolicy(value)) {
    return { policy: null, rewrite: true };
  }

  const rootPolicy = normalizeRootIncentivePolicy(value);
  if (rootPolicy) {
    return rootPolicy;
  }

  const legacy = value as LegacyWrappedPolicy;
  if (legacy?.policy?.evaluationType === "provider_documentation_completeness") {
    const policy = {
      ...copyPolicy(defaultIncentivePolicies.provider_documentation_acme_outpatient),
      payout: {
        token: legacy.policy.paymentFormula?.token?.symbol ?? "HBAR",
        amountPerEligibleRequest:
          legacy.policy.paymentFormula?.baseAmount ??
          defaultIncentivePolicies.provider_documentation_acme_outpatient.payout.amountPerEligibleRequest,
        monthlyCap:
          legacy.policy.paymentFormula?.monthlyCap ??
          defaultIncentivePolicies.provider_documentation_acme_outpatient.payout.monthlyCap
      },
      settlement: {
        ...defaultIncentivePolicies.provider_documentation_acme_outpatient.settlement,
        recipientWalletId:
          legacy.policy.submitterRules?.walletMap?.[PROVIDER_ID] ??
          defaultIncentivePolicies.provider_documentation_acme_outpatient.settlement.recipientWalletId,
        requiresHumanApproval:
          legacy.policy.requiresHumanApproval ??
          defaultIncentivePolicies.provider_documentation_acme_outpatient.settlement.requiresHumanApproval
      }
    };

    return { policy, rewrite: true };
  }

  return { policy: null, rewrite: true };
}

function normalizeRootIncentivePolicy(value: unknown): { policy: IncentivePolicy; rewrite: boolean } | null {
  if (!isIncentivePolicyShape(value)) {
    return null;
  }

  const candidate = copyPolicy(value);
  return {
    policy: normalizePolicyScope(candidate),
    rewrite: needsPolicyRewrite(candidate)
  };
}

function normalizePolicyScope(policy: IncentivePolicy): IncentivePolicy {
  return {
    ...policy,
    contractPair: {
      ...policy.contractPair,
      planName: policy.contractPair.planName ?? planNameForId(policy.contractPair.planId),
      providerName: policy.contractPair.providerName ?? providerNameForId(policy.contractPair.providerId)
    },
    incentiveScope: {
      ...requestTypeScope(policy),
      ...serviceCodeScope(policy.incentiveScope)
    }
  };
}

function needsPolicyRewrite(policy: IncentivePolicy): boolean {
  const normalized = normalizePolicyScope(policy);
  return JSON.stringify(policy) !== JSON.stringify(normalized);
}

function isIncentivePolicyShape(value: unknown): value is IncentivePolicy {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<IncentivePolicy>;
  return (
    typeof candidate.policyId === "string" &&
    typeof candidate.version === "string" &&
    (candidate.status === "active" || candidate.status === "inactive") &&
    typeof candidate.evaluationType === "string" &&
    typeof candidate.contractPair?.planId === "string" &&
    typeof candidate.contractPair.providerId === "string" &&
    typeof candidate.payout?.amountPerEligibleRequest === "number" &&
    typeof candidate.payout.monthlyCap === "number" &&
    typeof candidate.payout.token === "string" &&
    typeof candidate.settlement?.recipientWalletId === "string"
  );
}

function isDeprecatedCombinedProviderDocumentationPolicy(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<IncentivePolicy>;
  const eligibleRequestTypes = candidate.incentiveScope?.eligibleRequestTypes ?? [];

  return (
    candidate.policyId === "plcy_7M4K9Q2X8N1R5T6W3B0C" &&
    candidate.evaluationType === "provider_documentation_completeness" &&
    candidate.contractPair?.planId === "acme-health-ppo" &&
    candidate.contractPair.providerId === PROVIDER_ID &&
    eligibleRequestTypes.includes("outpatient_service") &&
    eligibleRequestTypes.includes("pharmacy_benefit")
  );
}

function matchesLookup(policy: IncentivePolicy, lookup: PolicyLookup): boolean {
  return (
    policy.evaluationType === lookup.evaluationType &&
    policy.contractPair.planId === lookup.planId &&
    policy.contractPair.providerId === lookup.providerId &&
    matchesRequestType(policy, lookup.requestType) &&
    isPolicyEffective(policy, lookup.submittedAt)
  );
}

function matchesRequestType(policy: IncentivePolicy, requestType: string | undefined): boolean {
  if (!requestType) {
    return true;
  }

  const excludedRequestTypes = policy.incentiveScope.excludedRequestTypes ?? [];
  const eligibleRequestTypes = policy.incentiveScope.eligibleRequestTypes ?? [];

  return !excludedRequestTypes.includes(requestType) && (eligibleRequestTypes.length === 0 || eligibleRequestTypes.includes(requestType));
}

function isPolicyEffective(policy: IncentivePolicy, submittedAt?: string): boolean {
  if (!submittedAt) {
    return true;
  }

  const submitted = new Date(submittedAt).getTime();
  const starts = new Date(policy.effectivePeriod.startsOn).getTime();
  const ends = policy.effectivePeriod.endsOn ? new Date(policy.effectivePeriod.endsOn).getTime() : Number.POSITIVE_INFINITY;

  return submitted >= starts && submitted <= ends;
}

function copyPolicy(policy: IncentivePolicy): IncentivePolicy {
  const copy = structuredClone(policy) as IncentivePolicy & { displayName?: string };
  delete copy.displayName;
  return copy;
}

function comparePolicies(left: IncentivePolicy, right: IncentivePolicy): number {
  return (
    left.contractPair.planId.localeCompare(right.contractPair.planId) ||
    left.contractPair.providerId.localeCompare(right.contractPair.providerId) ||
    (left.incentiveScope.eligibleRequestTypes ?? []).join(",").localeCompare((right.incentiveScope.eligibleRequestTypes ?? []).join(",")) ||
    left.policyId.localeCompare(right.policyId)
  );
}

function providerDocumentationPolicy({
  includedServiceCodes,
  amountPerEligibleRequest = 5,
  planDisplay,
  planId,
  policyId,
  requestType
}: {
  policyId: string;
  planId: string;
  planDisplay: string;
  requestType: "outpatient_service" | "pharmacy_benefit";
  includedServiceCodes: IncentivePolicy["incentiveScope"]["includedServiceCodes"];
  amountPerEligibleRequest?: number;
}): IncentivePolicy {
  return {
    policyId,
    version: "v1",
    status: "active",
    evaluationType: "provider_documentation_completeness",
    contractPair: {
      planId,
      planName: planDisplay,
      providerId: PROVIDER_ID,
      providerName: providerNameForId(PROVIDER_ID)
    },
    effectivePeriod: {
      startsOn: "2026-05-01",
      endsOn: null
    },
    incentiveScope: {
      eligibleRequestTypes: [requestType],
      includedServiceCodes
    },
    eligibilityCriteria: {
      appliesOnlyToCoveredBenefits: true,
      requiresDtrCompletionWhenRequested: true
    },
    payout: {
      token: "HBAR",
      amountPerEligibleRequest,
      monthlyCap: 500
    },
    settlement: {
      mode: "auto",
      recipientWalletId: PROVIDER_WALLET_ID,
      requiresHumanApproval: false
    }
  };
}

function delegateUmSlaBonusPolicy({
  amountPerEligibleRequest = 5,
  planId,
  policyId,
  requestType
}: {
  policyId: string;
  planId: string;
  requestType: "outpatient_service" | "pharmacy_benefit";
  amountPerEligibleRequest?: number;
}): IncentivePolicy {
  return {
    policyId,
    version: "v1",
    status: "active",
    evaluationType: "delegate_um_sla_bonus",
    contractPair: {
      planId,
      planName: planNameForId(planId),
      providerId: DELEGATE_VENDOR_ID,
      providerName: providerNameForId(DELEGATE_VENDOR_ID)
    },
    effectivePeriod: {
      startsOn: "2026-05-01",
      endsOn: null
    },
    incentiveScope: {
      eligibleRequestTypes: [requestType]
    },
    eligibilityCriteria: {
      appliesOnlyToCoveredBenefits: false,
      requiresDtrCompletionWhenRequested: false,
      requiresDeterminationWithinSla: true,
      requiresClinicalReviewCompletion: true
    },
    payout: {
      token: "HBAR",
      amountPerEligibleRequest,
      monthlyCap: 500
    },
    settlement: {
      mode: "auto",
      recipientWalletId: DELEGATE_VENDOR_WALLET_ID,
      requiresHumanApproval: false
    }
  };
}

function specialtyRxFulfillmentSlaPolicy({
  planId,
  policyId
}: {
  policyId: string;
  planId: string;
}): IncentivePolicy {
  return {
    policyId,
    version: "v1",
    status: "active",
    evaluationType: "specialty_rx_fulfillment_sla",
    contractPair: {
      planId,
      planName: planNameForId(planId),
      providerId: SPECIALTY_PHARMACY_ID,
      providerName: providerNameForId(SPECIALTY_PHARMACY_ID)
    },
    effectivePeriod: {
      startsOn: "2026-05-01",
      endsOn: null
    },
    incentiveScope: {
      eligibleRequestTypes: ["pharmacy_benefit"]
    },
    eligibilityCriteria: {
      appliesOnlyToCoveredBenefits: false,
      requiresDtrCompletionWhenRequested: false,
      requiresShipmentScheduledWithinSla: true,
      requiresDeliveryClosureEvidence: true,
      requiresColdChainEvidenceWhenRequired: true,
      requiresRemsAuthorizationWhenRequired: true,
      prohibitsAvoidableFulfillmentException: true
    },
    payout: {
      token: "HBAR",
      amountPerEligibleRequest: 5,
      monthlyCap: 700,
      coldChainHandlingAddOn: {
        amount: 2,
        maxPerRequest: 7
      }
    },
    settlement: {
      mode: "auto",
      recipientWalletId: SPECIALTY_PHARMACY_WALLET_ID,
      requiresHumanApproval: false
    }
  };
}

function appealsPacketQualityPolicy({ policyId, planId }: { policyId: string; planId: string }): IncentivePolicy {
  return {
    policyId,
    version: "v1",
    status: "active",
    evaluationType: "appeals_packet_quality",
    contractPair: {
      planId,
      planName: planNameForId(planId),
      providerId: APPEALS_SUBMITTER_ID,
      providerName: providerNameForId(APPEALS_SUBMITTER_ID)
    },
    effectivePeriod: { startsOn: "2026-05-01", endsOn: null },
    incentiveScope: { eligibleRequestTypes: ["pharmacy_benefit", "outpatient_service"] },
    eligibilityCriteria: {
      appliesOnlyToCoveredBenefits: false,
      requiresDtrCompletionWhenRequested: false,
      requiresAppealPacketReadyWithinSla: true,
      requiresAppealAcknowledgementWithinSla: true,
      requiresAppealPacketQualityAudit: true,
      prohibitsAppealOutcomeIncentive: true
    },
    payout: { token: "HBAR", amountPerEligibleRequest: 6, monthlyCap: 700 },
    settlement: { mode: "auto", recipientWalletId: APPEALS_SUBMITTER_WALLET_ID, requiresHumanApproval: false }
  };
}

function requestTypeScope(policy: IncentivePolicy): IncentivePolicy["incentiveScope"] {
  const scope = policy.incentiveScope;

  if (policy.evaluationType === "delegate_um_sla_bonus") {
    const eligibleDelegateRequestTypes = (scope.eligibleRequestTypes ?? []).filter(isDelegateUmRequestType);
    const excludedDelegateRequestTypes = (scope.excludedRequestTypes ?? []).filter(isDelegateUmRequestType);

    return {
      eligibleRequestTypes: eligibleDelegateRequestTypes.length ? eligibleDelegateRequestTypes : ["pharmacy_benefit"],
      ...(excludedDelegateRequestTypes.length ? { excludedRequestTypes: excludedDelegateRequestTypes } : {})
    };
  }

  const eligibleRequestTypes = scope.eligibleRequestTypes?.length ? { eligibleRequestTypes: [...scope.eligibleRequestTypes] } : {};
  const excludedRequestTypes = scope.excludedRequestTypes?.length ? { excludedRequestTypes: [...scope.excludedRequestTypes] } : {};

  if (scope.eligibleRequestTypes?.length) {
    return eligibleRequestTypes;
  }

  if (scope.excludedRequestTypes?.length) {
    return excludedRequestTypes;
  }

  return {};
}

function isDelegateUmRequestType(requestType: string): boolean {
  return requestType === "outpatient_service" || requestType === "pharmacy_benefit";
}

function serviceCodeScope(scope: IncentivePolicy["incentiveScope"]): IncentivePolicy["incentiveScope"] {
  if (hasConfiguredServiceCodes(scope.includedServiceCodes)) {
    return {
      includedServiceCodes: copyServiceCodeSet(scope.includedServiceCodes)
    };
  }

  if (hasConfiguredServiceCodes(scope.excludedServiceCodes)) {
    return {
      excludedServiceCodes: copyServiceCodeSet(scope.excludedServiceCodes)
    };
  }

  return {};
}

function hasConfiguredServiceCodes(
  value: IncentivePolicy["incentiveScope"]["includedServiceCodes"] | undefined
): value is NonNullable<IncentivePolicy["incentiveScope"]["includedServiceCodes"]> {
  return Boolean(value?.cpt.length || value?.ndc.length);
}

function copyServiceCodeSet(value: NonNullable<IncentivePolicy["incentiveScope"]["includedServiceCodes"]>) {
  return {
    cpt: [...value.cpt],
    ndc: [...value.ndc]
  };
}

function planNameForId(planId: string): string {
  switch (planId) {
    case "acme-health-ppo":
      return "Acme Health PPO";
    case "summit-health-hmo":
      return "Summit Health HMO";
    default:
      return planId;
  }
}

function providerNameForId(providerId: string): string {
  switch (providerId) {
    case PROVIDER_ID:
      return "Lakeside Provider Admin";
    case DELEGATE_VENDOR_ID:
      return "Northstar UM";
    case SPECIALTY_PHARMACY_ID:
      return "Atlas Specialty Rx";
    default:
      return providerId;
  }
}
