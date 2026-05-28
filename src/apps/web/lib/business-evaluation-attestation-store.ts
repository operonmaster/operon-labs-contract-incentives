import {
  buildBusinessEvaluationId,
  type BusinessEvaluationAttestation,
  type BusinessEvaluationAttestationLookup,
  type BusinessEvaluationAttestationStore
} from "@operon-labs/hedera-executor";
import type { Currency } from "@operon-labs/policy-engine";
import type { PolicyStore } from "./policy-store";

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
interface IncentiveEvaluationSource {
  getIncentiveRow(umRequestId: string, businessPolicyId?: string): Promise<RecordedIncentiveEvaluation | null>;
}
/* eslint-enable no-unused-vars */

interface RecordedIncentiveEvaluation {
  id: string;
  umRequestId: string;
  caseId: string;
  planId?: string;
  policyId: string;
  businessPolicyStatus?: "approved" | "rejected" | null;
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
    const businessPolicyId = lookup.businessPolicyId ?? lookup.policyId;
    if (!businessPolicyId) {
      return null;
    }

    const expectedEvaluationId = buildBusinessEvaluationId({
      umRequestId: lookup.umRequestId,
      businessPolicyId
    });
    if (lookup.incentiveEvaluationId !== expectedEvaluationId) {
      return null;
    }

    const row = await this.source.getIncentiveRow(lookup.umRequestId, businessPolicyId);
    if (!row) {
      return null;
    }

    if ((row.businessPolicyStatus ?? legacyBusinessPolicyStatus(row.incentiveStatus)) !== "approved") {
      return null;
    }

    if (lookup.caseId && row.caseId !== lookup.caseId) {
      return null;
    }

    if (row.id !== expectedEvaluationId) {
      return null;
    }

    if (row.umRequestId !== lookup.umRequestId) {
      return null;
    }

    if (row.policyId !== businessPolicyId) {
      return null;
    }

    if (row.planId && row.planId !== lookup.planId) {
      return null;
    }

    const policy = await this.policyStore.getPolicyById(row.policyId);

    return {
      incentiveEvaluationId: expectedEvaluationId,
      umRequestId: row.umRequestId,
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

function legacyBusinessPolicyStatus(status: string): "approved" | "rejected" | null {
  switch (status) {
    case "paid":
    case "payment_failed":
      return "approved";
    case "not_eligible":
      return "rejected";
    default:
      return null;
  }
}
