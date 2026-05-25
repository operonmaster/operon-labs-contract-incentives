import type { IncentivePolicy } from "@operon-labs/policy-engine";
import type { FirestoreDatabase } from "./pas-persistence";

export type PolicyStoreBackend = "firestore" | "memory";
export type PolicyStatus = "active" | "inactive";

export interface StoredIncentivePolicy {
  evaluationType: string;
  policyId: string;
  status: PolicyStatus;
  policy: IncentivePolicy;
  updatedAt: string;
  updatedBy: string;
}

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface PolicyStore {
  backend: PolicyStoreBackend;
  seedDefaults(): Promise<void>;
  getPolicy(evaluationType: string): Promise<IncentivePolicy | null>;
  savePolicy(policy: IncentivePolicy, metadata?: Partial<Omit<StoredIncentivePolicy, "policy">>): Promise<void>;
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

const DEFAULT_POLICY_STORE_BACKEND = "firestore";
const DEFAULT_GCP_PROJECT_ID = "operon-labs-nonprod";
const DEFAULT_FIRESTORE_DATABASE_ID = "(default)";
const INCENTIVE_POLICIES_COLLECTION = "incentivePolicies";
const POLICY_SEED_ACTOR = "operon-labs-contract-incentives";

export const defaultIncentivePolicies: Record<string, IncentivePolicy> = {
  delegate_um_sla_bonus: {
    id: "delegate-um-sla-bonus-v1",
    evaluationType: "delegate_um_sla_bonus",
    submitterRules: {
      allowedSubmitterTypes: ["delegate_vendor"],
      allowedSubmitters: ["northstar-um"],
      walletMap: {
        "northstar-um": "0.0.12345"
      }
    },
    requiredEvidence: ["caseId", "completedWithinSla", "documentationComplete", "qualityAuditPassed", "denialOutcomeUsed", "containsPhi"],
    approvalRules: [
      { field: "completedWithinSla", operator: "equals", value: true, reasonCode: "SLA_NOT_MET" },
      { field: "documentationComplete", operator: "equals", value: true, reasonCode: "DOCUMENTATION_INCOMPLETE" },
      { field: "qualityAuditPassed", operator: "equals", value: true, reasonCode: "QUALITY_AUDIT_FAILED" },
      { field: "denialOutcomeUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_DENIAL_METRIC" },
      { field: "containsPhi", operator: "equals", value: false, reasonCode: "PHI_BLOCKED" }
    ],
    paymentFormula: { baseAmount: 5, maxPerRequest: 5, monthlyCap: 500, token: { symbol: "HBAR" } },
    requiresHumanApproval: false
  },
  provider_documentation_completeness: {
    id: "provider-documentation-completeness-v1",
    evaluationType: "provider_documentation_completeness",
    submitterRules: {
      allowedSubmitterTypes: ["provider_admin_team"],
      allowedSubmitters: ["lakeside-provider-admin"],
      walletMap: {
        "lakeside-provider-admin": "0.0.9049549"
      }
    },
    requiredEvidence: [
      "caseId",
      "requestType",
      "crdCoverageChecked",
      "crdCoveredBenefit",
      "dtrTemplateCompleted",
      "attachmentChecklistComplete",
      "fhirFieldsPresent",
      "pasSubmitted",
      "submittedBeforeInitialDecision",
      "paResultUsedForPositivePayment",
      "approvalOutcomeUsed",
      "referralVolumeMetricUsed",
      "containsPhi"
    ],
    approvalRules: [
      {
        field: "requestType",
        operator: "in",
        value: ["outpatient_service", "pharmacy_benefit"],
        reasonCode: "REQUEST_TYPE_NOT_ELIGIBLE"
      },
      { field: "crdCoverageChecked", operator: "equals", value: true, reasonCode: "CRD_COVERAGE_NOT_CHECKED" },
      { field: "crdCoveredBenefit", operator: "equals", value: true, reasonCode: "SERVICE_NOT_COVERED" },
      { field: "dtrTemplateCompleted", operator: "equals", value: true, reasonCode: "DTR_TEMPLATE_INCOMPLETE" },
      { field: "attachmentChecklistComplete", operator: "equals", value: true, reasonCode: "ATTACHMENT_CHECKLIST_INCOMPLETE" },
      { field: "fhirFieldsPresent", operator: "equals", value: true, reasonCode: "FHIR_FIELDS_MISSING" },
      { field: "pasSubmitted", operator: "equals", value: true, reasonCode: "PAS_NOT_SUBMITTED" },
      { field: "submittedBeforeInitialDecision", operator: "equals", value: true, reasonCode: "SUBMITTED_AFTER_INITIAL_DECISION" },
      { field: "paResultUsedForPositivePayment", operator: "equals", value: false, reasonCode: "PROHIBITED_PA_RESULT_METRIC" },
      { field: "approvalOutcomeUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_OUTCOME_METRIC" },
      { field: "referralVolumeMetricUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_REFERRAL_VOLUME_METRIC" },
      { field: "containsPhi", operator: "equals", value: false, reasonCode: "PHI_BLOCKED" }
    ],
    paymentFormula: { baseAmount: 5, maxPerRequest: 5, monthlyCap: 500, token: { symbol: "HBAR" } },
    requiresHumanApproval: false
  },
  appeals_packet_quality: {
    id: "appeals-packet-quality-v1",
    evaluationType: "appeals_packet_quality",
    submitterRules: {
      allowedSubmitterTypes: ["appeals_delegate"],
      allowedSubmitters: ["summit-appeals-ops"],
      walletMap: {
        "summit-appeals-ops": "0.0.54321"
      }
    },
    requiredEvidence: [
      "appealId",
      "packetSubmittedWithinSla",
      "requiredDocumentsPresent",
      "clinicalRationaleIncluded",
      "policyCitationIncluded",
      "evidenceIndexComplete",
      "qualityAuditPassed",
      "appealOutcomeUsed",
      "costSavingsMetricUsed",
      "containsPhi"
    ],
    approvalRules: [
      { field: "packetSubmittedWithinSla", operator: "equals", value: true, reasonCode: "SLA_NOT_MET" },
      { field: "requiredDocumentsPresent", operator: "equals", value: true, reasonCode: "REQUIRED_DOCUMENTS_MISSING" },
      { field: "clinicalRationaleIncluded", operator: "equals", value: true, reasonCode: "CLINICAL_RATIONALE_MISSING" },
      { field: "policyCitationIncluded", operator: "equals", value: true, reasonCode: "POLICY_CITATION_MISSING" },
      { field: "evidenceIndexComplete", operator: "equals", value: true, reasonCode: "EVIDENCE_INDEX_INCOMPLETE" },
      { field: "qualityAuditPassed", operator: "equals", value: true, reasonCode: "QUALITY_AUDIT_FAILED" },
      { field: "appealOutcomeUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_APPEAL_OUTCOME_METRIC" },
      { field: "costSavingsMetricUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_COST_SAVINGS_METRIC" },
      { field: "containsPhi", operator: "equals", value: false, reasonCode: "PHI_BLOCKED" }
    ],
    paymentFormula: { baseAmount: 5, maxPerRequest: 5, monthlyCap: 500, token: { symbol: "HBAR" } },
    requiresHumanApproval: true
  },
  provider_directory_quality: {
    id: "provider-directory-quality-v1",
    evaluationType: "provider_directory_quality",
    submitterRules: {
      allowedSubmitterTypes: ["roster_vendor"],
      allowedSubmitters: ["clearpath-rosters"],
      walletMap: {
        "clearpath-rosters": "0.0.34567"
      }
    },
    requiredEvidence: [
      "rosterBatchId",
      "submittedBeforeDeadline",
      "npiValidationPassed",
      "tinValidationPassed",
      "addressValidationPassed",
      "specialtyValidationPassed",
      "referralVolumeMetricUsed",
      "networkSteeringMetricUsed",
      "containsPhi"
    ],
    approvalRules: [
      { field: "submittedBeforeDeadline", operator: "equals", value: true, reasonCode: "MONTHLY_DEADLINE_MISSED" },
      { field: "npiValidationPassed", operator: "equals", value: true, reasonCode: "NPI_VALIDATION_FAILED" },
      { field: "tinValidationPassed", operator: "equals", value: true, reasonCode: "TIN_VALIDATION_FAILED" },
      { field: "addressValidationPassed", operator: "equals", value: true, reasonCode: "ADDRESS_VALIDATION_FAILED" },
      { field: "specialtyValidationPassed", operator: "equals", value: true, reasonCode: "SPECIALTY_VALIDATION_FAILED" },
      { field: "referralVolumeMetricUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_REFERRAL_VOLUME_METRIC" },
      { field: "networkSteeringMetricUsed", operator: "equals", value: false, reasonCode: "PROHIBITED_STEERING_METRIC" },
      { field: "containsPhi", operator: "equals", value: false, reasonCode: "PHI_BLOCKED" }
    ],
    paymentFormula: { baseAmount: 5, maxPerRequest: 5, monthlyCap: 500, token: { symbol: "HBAR" } },
    requiresHumanApproval: true
  }
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
      this.policies.set(policy.evaluationType, copyPolicy(policy));
    }
  }

  async seedDefaults(): Promise<void> {
    for (const policy of Object.values(defaultIncentivePolicies)) {
      if (!this.policies.has(policy.evaluationType)) {
        this.policies.set(policy.evaluationType, copyPolicy(policy));
      }
    }
  }

  async getPolicy(evaluationType: string): Promise<IncentivePolicy | null> {
    const policy = this.policies.get(evaluationType);
    return policy ? copyPolicy(policy) : null;
  }

  async savePolicy(policy: IncentivePolicy): Promise<void> {
    this.policies.set(policy.evaluationType, copyPolicy(policy));
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
      Object.values(defaultIncentivePolicies).map((policy) =>
        firestore.collection(INCENTIVE_POLICIES_COLLECTION).doc(policy.evaluationType).set({
          evaluationType: policy.evaluationType,
          policyId: policy.id,
          status: "active",
          policy: copyPolicy(policy),
          updatedAt,
          updatedBy: POLICY_SEED_ACTOR
        } satisfies StoredIncentivePolicy)
      )
    );
    this.seeded = true;
  }

  async getPolicy(evaluationType: string): Promise<IncentivePolicy | null> {
    await this.ensureSeeded();
    const snapshot = await (await this.getFirestore()).collection(INCENTIVE_POLICIES_COLLECTION).doc(evaluationType).get();

    if (!snapshot.exists) {
      return null;
    }

    const stored = snapshot.data() as StoredIncentivePolicy;
    if (stored.status !== "active" || !stored.policy) {
      return null;
    }

    return copyPolicy(stored.policy);
  }

  async savePolicy(policy: IncentivePolicy, metadata: Partial<Omit<StoredIncentivePolicy, "policy">> = {}): Promise<void> {
    const stored: StoredIncentivePolicy = {
      evaluationType: policy.evaluationType,
      policyId: policy.id,
      status: metadata.status ?? "active",
      policy: copyPolicy(policy),
      updatedAt: metadata.updatedAt ?? new Date().toISOString(),
      updatedBy: metadata.updatedBy ?? POLICY_SEED_ACTOR
    };
    await (await this.getFirestore()).collection(INCENTIVE_POLICIES_COLLECTION).doc(policy.evaluationType).set(stored);
    this.seeded = true;
  }

  private async ensureSeeded(): Promise<void> {
    if (this.seeded) {
      return;
    }

    const firestore = await this.getFirestore();
    const expectedPolicyIds = Object.keys(defaultIncentivePolicies);
    const expectedDocs = await Promise.all(
      expectedPolicyIds.map((id) => firestore.collection(INCENTIVE_POLICIES_COLLECTION).doc(id).get())
    );

    if (expectedDocs.some((doc) => !doc.exists)) {
      await this.seedMissingDefaults();
      return;
    }

    this.seeded = true;
  }

  private async seedMissingDefaults(): Promise<void> {
    const firestore = await this.getFirestore();
    const updatedAt = new Date().toISOString();
    await Promise.all(
      Object.values(defaultIncentivePolicies).map(async (policy) => {
        const ref = firestore.collection(INCENTIVE_POLICIES_COLLECTION).doc(policy.evaluationType);
        const snapshot = await ref.get();
        if (snapshot.exists) {
          return;
        }

        await ref.set({
          evaluationType: policy.evaluationType,
          policyId: policy.id,
          status: "active",
          policy: copyPolicy(policy),
          updatedAt,
          updatedBy: POLICY_SEED_ACTOR
        } satisfies StoredIncentivePolicy);
      })
    );
    this.seeded = true;
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

function copyPolicy(policy: IncentivePolicy): IncentivePolicy {
  return structuredClone(policy);
}
