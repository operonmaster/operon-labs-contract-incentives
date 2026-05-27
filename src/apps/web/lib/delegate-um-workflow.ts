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

/* eslint-disable no-unused-vars -- TypeScript function signatures require parameter names. */
export interface DelegateUmWorkflow {
  listWorkqueue(): Promise<DelegateUmRow[]>;
  listPlanRows(): Promise<DelegateUmRow[]>;
  startReview: (umRequestId: string, reviewerId: string) => Promise<UMRequest>;
  completeDetermination: (umRequestId: string, input: CompleteClinicalReviewInput) => Promise<DelegateUmRow>;
}
/* eslint-enable no-unused-vars */

type PersistedDelegateUmRow = DelegateUmRow & {
  caseId: string;
};

export function createDelegateUmWorkflow(
  platform: UmPlatform = createInMemoryUmPlatform(),
  persistence: UmPasPersistenceStore | undefined = createPasPersistenceStoreFromEnv(),
  policyStore: PolicyStore = createPolicyStoreFromEnv(),
  paymentIntentStore: PaymentIntentStore | undefined = createPaymentIntentStoreFromEnv(),
  paymentPolicyStore: PaymentPolicyStore = createPaymentPolicyStoreFromEnv()
): DelegateUmWorkflow {
  const rows = new Map<string, DelegateUmRow>();
  const settlementsInFlight = new Map<string, Promise<DelegateUmRow>>();

  async function listRequests(): Promise<UMRequest[]> {
    return persistence ? persistence.listUmRequests() : platform.listUmRequests();
  }

  async function getRequest(umRequestId: string): Promise<UMRequest | null> {
    return (await persistence?.getUmRequest(umRequestId)) ?? platform.getUmRequest(umRequestId);
  }

  async function saveRequest(umRequest: UMRequest): Promise<void> {
    await persistence?.saveUmRequest(umRequest);
  }

  async function getStoredDelegateRow(umRequestId: string): Promise<DelegateUmRow | null> {
    return rows.get(umRequestId) ?? normalizePersistedDelegateRow(await persistence?.getIncentiveRow(umRequestId));
  }

  async function getImmutablePaidRow(umRequestId: string): Promise<DelegateUmRow | null> {
    const row = await getStoredDelegateRow(umRequestId);

    return row && isImmutablePaidDelegateRow(row) ? row : null;
  }

  return {
    async listWorkqueue() {
      return (await listRequests())
        .filter((request) => Boolean(request.delegateVendorId) && request.state !== "determined")
        .map((request) => buildPendingRow(request))
        .sort((left, right) => left.slaDeadlineAt.localeCompare(right.slaDeadlineAt));
    },
    async listPlanRows() {
      await loadPersistedDelegateRows(persistence, rows);

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
      const paidRow = await getImmutablePaidRow(umRequestId);
      if (paidRow) {
        rows.set(umRequestId, paidRow);
        return paidRow;
      }

      const existingSettlement = settlementsInFlight.get(umRequestId);
      if (existingSettlement) {
        return existingSettlement;
      }

      const settlement = completeAndSettleDetermination({
        umRequestId,
        input,
        getRequest,
        saveRequest,
        platform,
        persistence,
        rows,
        policyStore,
        paymentIntentStore,
        paymentPolicyStore
      });
      settlementsInFlight.set(umRequestId, settlement);

      try {
        return await settlement;
      } finally {
        settlementsInFlight.delete(umRequestId);
      }
    }
  };
}

export const delegateUmWorkflow = createDelegateUmWorkflow();

/* eslint-disable no-unused-vars -- TypeScript function signatures require parameter names. */
interface CompleteAndSettleDependencies {
  umRequestId: string;
  input: CompleteClinicalReviewInput;
  getRequest: (umRequestId: string) => Promise<UMRequest | null>;
  saveRequest: (umRequest: UMRequest) => Promise<void>;
  platform: UmPlatform;
  persistence: UmPasPersistenceStore | undefined;
  rows: Map<string, DelegateUmRow>;
  policyStore: PolicyStore;
  paymentIntentStore: PaymentIntentStore | undefined;
  paymentPolicyStore: PaymentPolicyStore;
}
/* eslint-enable no-unused-vars */

async function completeAndSettleDetermination({
  umRequestId,
  input,
  getRequest,
  saveRequest,
  platform,
  persistence,
  rows,
  policyStore,
  paymentIntentStore,
  paymentPolicyStore
}: CompleteAndSettleDependencies): Promise<DelegateUmRow> {
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
  await saveDelegateRow(persistence, row);
  return row;
}

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

  if (policies.length > 1) {
    const evaluation = evaluateDelegateUmSlaEvent(
      { eventType: "UM_REQUEST_DETERMINED", umRequestId: request.id, caseId: request.id },
      {
        getEvidenceByUmRequestId: () => evidence,
        policy: policies[0]!,
        monthToDateAmount: 0
      }
    );
    const result = {
      ...evaluation.result,
      decision: "blocked" as const,
      amount: 0,
      walletId: null,
      reasonCodes: ["MULTIPLE_POLICY_MATCHES"]
    };
    const audit = createAuditRecord({
      request: evaluation.request,
      result,
      transactionId: null
    });

    return {
      ...buildPendingRow(request),
      slaStatus: buildDeterminedSlaStatus(request),
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      currency: result.currency,
      settlementToken: result.settlementToken,
      reason: summarizeDelegateReason(result.reasonCodes),
      reasonCodes: result.reasonCodes,
      policyId: result.policyId,
      audit,
      walletId: null
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

async function loadPersistedDelegateRows(
  persistence: UmPasPersistenceStore | undefined,
  rows: Map<string, DelegateUmRow>
): Promise<void> {
  const persistedRows = (await persistence?.listIncentiveRows()) ?? [];

  for (const persistedRow of persistedRows) {
    const row = normalizePersistedDelegateRow(persistedRow);
    if (row) {
      rows.set(row.umRequestId, row);
    }
  }
}

async function saveDelegateRow(
  persistence: UmPasPersistenceStore | undefined,
  row: DelegateUmRow
): Promise<void> {
  await persistence?.saveIncentiveRow(toPersistedDelegateRow(row) as unknown as Parameters<UmPasPersistenceStore["saveIncentiveRow"]>[0]);
}

function toPersistedDelegateRow(row: DelegateUmRow): PersistedDelegateUmRow {
  return {
    ...row,
    caseId: row.umRequestId
  };
}

function normalizePersistedDelegateRow(value: unknown): DelegateUmRow | null {
  if (!isDelegateUmRowShape(value)) {
    return null;
  }

  return {
    ...value,
    audit: value.audit ? { ...value.audit } : null,
    reasonCodes: [...value.reasonCodes],
    settlementToken: { ...value.settlementToken }
  };
}

function isDelegateUmRowShape(value: unknown): value is DelegateUmRow {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<DelegateUmRow>;

  return (
    typeof candidate.umRequestId === "string" &&
    typeof candidate.id === "string" &&
    typeof candidate.delegateVendorId === "string" &&
    typeof candidate.planId === "string" &&
    typeof candidate.submittedAt === "string" &&
    typeof candidate.incentiveStatus === "string" &&
    typeof candidate.paymentStatus === "string" &&
    typeof candidate.incentiveValue === "number" &&
    Array.isArray(candidate.reasonCodes) &&
    typeof candidate.settlementToken === "object" &&
    candidate.settlementToken !== null
  );
}

function isImmutablePaidDelegateRow(row: DelegateUmRow): boolean {
  return row.incentiveStatus === "paid" && Boolean(row.transactionId || row.paymentIntentId);
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
