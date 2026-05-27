import { createAuditRecord, type AuditRecord } from "@operon-labs/audit-log";
import { executePolicyBoundPayment, type PaymentIntentStore } from "@operon-labs/hedera-executor";
import { evaluateDelegateUmSlaEvent, type DelegateUmSlaEvidence } from "@operon-labs/incentive-agent";
import type { Currency, SettlementToken } from "@operon-labs/policy-engine";
import {
  completeClinicalReviewForRequest,
  createInMemoryUmPlatform,
  startClinicalReviewForRequest,
  type CompleteClinicalReviewInput,
  type UMRequest,
  type UmPlatform
} from "@operon-labs/um-platform";
import { createBusinessEvaluationAttestationStore } from "./business-evaluation-attestation-store";
import { createPasPersistenceStoreFromEnv, type UmPasPersistenceStore } from "./pas-persistence";
import { createPaymentIntentStoreFromEnv } from "./payment-intent-store";
import { createPaymentPolicyStoreFromEnv, type PaymentPolicyStore } from "./payment-policy-store";
import { createPolicyStoreFromEnv, type PolicyStore } from "./policy-store";

export type DelegateIncentiveStatus = "pending" | "not_eligible" | "paid" | "payment_failed";
export type DelegatePaymentStatus = "pending" | "auto_executed" | "blocked_by_policy" | "execution_failed";
export type DelegateSlaStatus = "pending" | "within_sla" | "breached";

export interface DelegateUmRow {
  umRequestId: string;
  id: string;
  planId: string;
  planDisplay: string;
  delegateVendorId: string;
  requestType: UMRequest["requestType"];
  serviceLabel: string;
  submittedAt: string;
  pendStartedAt: string;
  slaDeadlineAt: string;
  determinedAt: string | null;
  timeRemainingMs: number;
  state: UMRequest["state"];
  outcomeStatus: UMRequest["outcomeStatus"];
  slaStatus: DelegateSlaStatus;
  incentiveStatus: DelegateIncentiveStatus;
  paymentStatus: DelegatePaymentStatus;
  incentiveValue: number;
  currency: Currency;
  settlementToken: SettlementToken;
  reason: string;
  reasonCodes: string[];
  policyId: string | null;
  audit: AuditRecord | null;
  walletId: string | null;
  paymentIntentId: string | null;
  transactionId: string | null;
}

export interface DelegateUmWorkflow {
  listWorkqueue(): Promise<DelegateUmRow[]>;
  listPlanRows(): Promise<DelegateUmRow[]>;
  startReview(umRequestId: string, reviewerId: string): Promise<UMRequest>;
  completeDetermination(umRequestId: string, input: CompleteClinicalReviewInput): Promise<DelegateUmRow>;
}

export function createDelegateUmWorkflow(
  platform: UmPlatform = createInMemoryUmPlatform(),
  persistence: UmPasPersistenceStore | undefined = createPasPersistenceStoreFromEnv(),
  policyStore: PolicyStore = createPolicyStoreFromEnv(),
  paymentIntentStore: PaymentIntentStore | undefined = createPaymentIntentStoreFromEnv(),
  paymentPolicyStore: PaymentPolicyStore = createPaymentPolicyStoreFromEnv()
): DelegateUmWorkflow {
  const rows = new Map<string, DelegateUmRow>();

  async function listRequests(): Promise<UMRequest[]> {
    return persistence ? persistence.listUmRequests() : platform.listUmRequests();
  }

  async function getRequest(umRequestId: string): Promise<UMRequest | null> {
    return (await persistence?.getUmRequest(umRequestId)) ?? platform.getUmRequest(umRequestId);
  }

  async function saveRequest(umRequest: UMRequest): Promise<void> {
    await persistence?.saveUmRequest(umRequest);
  }

  return {
    async listWorkqueue() {
      return (await listRequests())
        .filter((request) => Boolean(request.delegateVendorId) && request.state !== "determined")
        .map((request) => buildPendingRow(request))
        .sort((left, right) => left.slaDeadlineAt.localeCompare(right.slaDeadlineAt));
    },
    async listPlanRows() {
      return (await listRequests())
        .map((request) => rows.get(request.id) ?? buildPendingRow(request))
        .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    },
    async startReview(umRequestId, reviewerId) {
      const persisted = await getRequest(umRequestId);
      if (!persisted) {
        throw new Error(`UM_REQUEST_NOT_FOUND:${umRequestId}`);
      }

      const started = persistence
        ? startClinicalReviewForRequest(persisted, reviewerId)
        : platform.startClinicalReview(umRequestId, reviewerId);
      await saveRequest(started);
      return started;
    },
    async completeDetermination(umRequestId, input) {
      const persisted = await getRequest(umRequestId);
      if (!persisted) {
        throw new Error(`UM_REQUEST_NOT_FOUND:${umRequestId}`);
      }

      const request = persistence
        ? completeClinicalReviewForRequest(persisted, input)
        : platform.completeClinicalReview(umRequestId, input);
      await saveRequest(request);

      const row = await settleDetermination(request, {
        rows,
        policyStore,
        paymentIntentStore,
        paymentPolicyStore
      });
      rows.set(request.id, row);
      return row;
    }
  };
}

export const delegateUmWorkflow = createDelegateUmWorkflow();

function buildDelegateEvidence(request: UMRequest): DelegateUmSlaEvidence {
  const clinicalReviewCompleted =
    request.clinicalReview.medicalNecessityReviewed &&
    request.clinicalReview.policyCriteriaChecked &&
    request.clinicalReview.rationaleCaptured;

  return {
    umRequestId: request.id,
    id: request.id,
    planId: request.planId,
    delegateVendorId: request.delegateVendorId ?? "northstar-um",
    requestType: request.requestType,
    state: request.state,
    outcomeStatus: request.outcomeStatus ?? "approved",
    outcomeStatusPresent: request.outcomeStatus !== null,
    outcomeStatusUsedForPayment: false,
    completedWithinSla:
      request.determinedAt !== null &&
      new Date(request.determinedAt).getTime() <= new Date(request.slaDeadlineAt).getTime(),
    slaHours: request.slaHours,
    clinicalReviewCompleted,
    medicalNecessityReviewed: request.clinicalReview.medicalNecessityReviewed,
    policyCriteriaChecked: request.clinicalReview.policyCriteriaChecked,
    rationaleCaptured: request.clinicalReview.rationaleCaptured,
    auditReady: Boolean(request.auditRefs.pasClaimBundleId),
    containsPhi: false
  };
}

function buildPendingRow(request: UMRequest): DelegateUmRow {
  return {
    umRequestId: request.id,
    id: request.id,
    planId: request.planId,
    planDisplay: request.planDisplay,
    delegateVendorId: request.delegateVendorId ?? "northstar-um",
    requestType: request.requestType,
    serviceLabel: request.serviceLabel,
    submittedAt: request.submittedAt,
    pendStartedAt: request.pendStartedAt,
    slaDeadlineAt: request.slaDeadlineAt,
    determinedAt: request.determinedAt,
    timeRemainingMs: Math.max(0, new Date(request.slaDeadlineAt).getTime() - Date.now()),
    state: request.state,
    outcomeStatus: request.outcomeStatus,
    slaStatus: request.state === "determined" ? buildDeterminedSlaStatus(request) : "pending",
    incentiveStatus: "pending",
    paymentStatus: "pending",
    incentiveValue: 0,
    currency: "HBAR",
    settlementToken: { symbol: "HBAR" },
    reason: "Pending determination",
    reasonCodes: [],
    policyId: null,
    audit: null,
    walletId: null,
    paymentIntentId: null,
    transactionId: null
  };
}

async function settleDetermination(
  request: UMRequest,
  dependencies: {
    rows: Map<string, DelegateUmRow>;
    policyStore: PolicyStore;
    paymentIntentStore: PaymentIntentStore | undefined;
    paymentPolicyStore: PaymentPolicyStore;
  }
): Promise<DelegateUmRow> {
  const evidence = buildDelegateEvidence(request);
  const policies = await dependencies.policyStore.findPolicies({
    evaluationType: "delegate_um_sla_bonus",
    planId: evidence.planId,
    providerId: evidence.delegateVendorId,
    requestType: evidence.requestType,
    submittedAt: request.submittedAt
  });

  if (policies.length === 0) {
    return {
      ...buildPendingRow(request),
      slaStatus: buildDeterminedSlaStatus(request),
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      reason: "No matching Delegate UM SLA bonus policy",
      reasonCodes: ["POLICY_NOT_FOUND"]
    };
  }

  const evaluation = selectDelegateUmSlaEvaluation(
    policies.map((policy) =>
      evaluateDelegateUmSlaEvent(
        { eventType: "UM_REQUEST_DETERMINED", umRequestId: request.id, caseId: request.id },
        {
          getEvidenceByUmRequestId: () => evidence,
          policy,
          monthToDateAmount: 0
        }
      )
    )
  );
  const audit = createAuditRecord({
    request: evaluation.request,
    result: evaluation.result,
    transactionId: null
  });
  const baseRow: DelegateUmRow = {
    ...buildPendingRow(request),
    slaStatus: buildDeterminedSlaStatus(request),
    incentiveStatus: evaluation.result.decision === "approved" ? "paid" : "not_eligible",
    paymentStatus: evaluation.result.decision === "approved" ? "auto_executed" : "blocked_by_policy",
    incentiveValue: evaluation.result.amount,
    currency: evaluation.result.currency,
    settlementToken: evaluation.result.settlementToken,
    reason: summarizeDelegateReason(evaluation.result.reasonCodes),
    reasonCodes: evaluation.result.reasonCodes,
    policyId: evaluation.result.policyId,
    audit,
    walletId: evaluation.result.walletId
  };

  if (evaluation.result.decision !== "approved" || !evaluation.result.walletId) {
    return baseRow;
  }

  dependencies.rows.set(request.id, baseRow);

  try {
    const paymentPolicy = await dependencies.paymentPolicyStore.getPolicyForPlan(evidence.planId);
    if (!paymentPolicy) {
      throw new Error("HEDERA_PLAN_POLICY_NOT_FOUND");
    }

    const payment = await executePolicyBoundPayment(
      {
        auditId: audit.id,
        incentiveEvaluationId: request.id,
        planId: evidence.planId,
        amount: evaluation.result.amount,
        currency: evaluation.result.currency,
        walletId: evaluation.result.walletId,
        policyId: evaluation.result.policyId,
        policyVersion: evaluation.result.policyVersion,
        caseId: request.id,
        triggerEvent: "UM_REQUEST_DETERMINED",
        policyControls: buildDelegatePolicyControls()
      },
      {
        paymentIntentStore: dependencies.paymentIntentStore,
        planPolicy: paymentPolicy,
        businessEvaluationStore: createBusinessEvaluationAttestationStore(
          {
            async getIncentiveRow(incentiveEvaluationId) {
              const row = dependencies.rows.get(incentiveEvaluationId);

              return row
                ? {
                    ...row,
                    caseId: row.umRequestId,
                    policyId: row.policyId ?? "",
                    audit: row.audit ?? audit
                  }
                : null;
            }
          },
          dependencies.policyStore
        )
      }
    );

    return {
      ...baseRow,
      paymentIntentId: payment.paymentIntentId ?? null,
      transactionId: payment.transactionId,
      audit: {
        ...audit,
        transactionId: payment.transactionId
      }
    };
  } catch {
    return {
      ...baseRow,
      incentiveStatus: "payment_failed",
      paymentStatus: "execution_failed",
      reason: "Policy approved, but Hedera transaction execution failed",
      paymentIntentId: null,
      transactionId: null
    };
  }
}

function selectDelegateUmSlaEvaluation(
  evaluations: Array<ReturnType<typeof evaluateDelegateUmSlaEvent>>
): ReturnType<typeof evaluateDelegateUmSlaEvent> {
  const approved = evaluations.filter((evaluation) => evaluation.result.decision === "approved");
  if (approved.length === 1) {
    return approved[0]!;
  }

  if (approved.length > 1) {
    const [first] = approved;
    return {
      ...first!,
      result: {
        ...first!.result,
        decision: "blocked",
        amount: 0,
        walletId: null,
        reasonCodes: ["MULTIPLE_POLICY_MATCHES"]
      }
    };
  }

  const blocked = evaluations.find((evaluation) => evaluation.result.decision === "blocked");
  if (blocked) {
    return blocked;
  }

  return evaluations[0]!;
}

function buildDeterminedSlaStatus(request: UMRequest): DelegateSlaStatus {
  if (!request.determinedAt) {
    return "pending";
  }

  return new Date(request.determinedAt).getTime() <= new Date(request.slaDeadlineAt).getTime()
    ? "within_sla"
    : "breached";
}

function summarizeDelegateReason(reasonCodes: string[]): string {
  if (reasonCodes.length === 0) {
    return "Determination completed within SLA";
  }

  if (reasonCodes.includes("SLA_EXCEEDED")) {
    return "Determination missed the SLA";
  }

  if (reasonCodes.includes("CLINICAL_REVIEW_INCOMPLETE")) {
    return "Clinical review incomplete";
  }

  if (reasonCodes.includes("PAS_AUDIT_RECORD_MISSING")) {
    return "PAS audit record missing";
  }

  if (reasonCodes.includes("OUTCOME_STATUS_MISSING")) {
    return "Determination outcome missing";
  }

  if (reasonCodes.includes("MANUAL_REVIEW_REQUIRED")) {
    return "Manual settlement review required";
  }

  return reasonCodes.join(", ");
}

function buildDelegatePolicyControls(): string[] {
  return [
    "Allowed delegate vendor wallet",
    "Request type limited to policy scope",
    "Determination completed within SLA",
    "Clinical review completion required",
    "Outcome status not used for payment",
    "PAS audit reference required"
  ];
}
