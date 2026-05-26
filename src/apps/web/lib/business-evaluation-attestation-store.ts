import type {
  BusinessEvaluationAttestation,
  BusinessEvaluationAttestationLookup,
  BusinessEvaluationAttestationStore
} from "@operon-labs/hedera-executor";
import type { Currency } from "@operon-labs/policy-engine";
import type { PolicyStore } from "./policy-store";

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
interface IncentiveEvaluationSource {
  getIncentiveRow(incentiveEvaluationId: string): Promise<RecordedIncentiveEvaluation | null>;
}
/* eslint-enable no-unused-vars */

interface RecordedIncentiveEvaluation {
  caseId: string;
  planId?: string;
  policyId: string;
  incentiveStatus: string;
  incentiveValue: number;
  currency: Currency;
  walletId: string | null;
  audit: {
    policyVersion: string;
  };
}

export function createBusinessEvaluationAttestationStore(
  source: IncentiveEvaluationSource | undefined,
  policyStore: PolicyStore
): BusinessEvaluationAttestationStore | undefined {
  if (!source) {
    return undefined;
  }

  return new ProviderDocumentationBusinessEvaluationAttestationStore(source, policyStore);
}

class ProviderDocumentationBusinessEvaluationAttestationStore implements BusinessEvaluationAttestationStore {
  private readonly source: IncentiveEvaluationSource;
  private readonly policyStore: PolicyStore;

  constructor(source: IncentiveEvaluationSource, policyStore: PolicyStore) {
    this.source = source;
    this.policyStore = policyStore;
  }

  async getAttestation(lookup: BusinessEvaluationAttestationLookup): Promise<BusinessEvaluationAttestation | null> {
    const row = await this.source.getIncentiveRow(lookup.incentiveEvaluationId);
    if (!row) {
      return null;
    }

    if (row.incentiveStatus !== "paid") {
      return null;
    }

    if (lookup.caseId && row.caseId !== lookup.caseId) {
      return null;
    }

    if (lookup.policyId && row.policyId !== lookup.policyId) {
      return null;
    }

    if (row.planId && row.planId !== lookup.planId) {
      return null;
    }

    const policy = await this.policyStore.getPolicyById(row.policyId);

    return {
      incentiveEvaluationId: lookup.incentiveEvaluationId,
      caseId: row.caseId,
      planId: lookup.planId,
      businessPolicyId: row.policyId,
      businessPolicyVersion: row.audit.policyVersion,
      businessPolicyStatus: policy?.status ?? "missing",
      amount: row.incentiveValue,
      currency: row.currency,
      walletId: row.walletId ?? ""
    };
  }
}
