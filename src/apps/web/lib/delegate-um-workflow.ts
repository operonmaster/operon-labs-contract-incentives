import { createAuditRecord, type AuditRecord } from "@operon-labs/audit-log";
import {
  buildBusinessEvaluationId,
  executePolicyBoundPayment,
  type PaymentApprovalRequest,
  type PaymentIntentStore
} from "@operon-labs/hedera-executor";
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
import type { PolicyCriterionMatch } from "./provider-documentation-workflow";
import { umPlatform } from "./um-platform-singleton";

export type DelegateIncentiveStatus = "pending" | "not_eligible" | "paid" | "payment_failed";
export type DelegatePaymentStatus = "pending" | "auto_executed" | "blocked_by_policy" | "execution_failed";
export type DelegateSlaStatus = "pending" | "within_sla" | "breached";

export interface DelegatePlanAuditRow {
  evaluationType: "delegate_um_sla_bonus";
  umRequest: UMRequest;
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
  policyControls: string[];
  policyCriteria: PolicyCriterionMatch[];
  audit: AuditRecord | null;
  walletId: string | null;
  paymentIntentId: string | null;
  transactionId: string | null;
}

/* eslint-disable no-unused-vars -- TypeScript function signatures require parameter names. */
export interface DelegateUmWorkflow {
  listWorkqueue(): Promise<UMRequest[]>;
  listPlanRows(): Promise<DelegatePlanAuditRow[]>;
  startReview: (umRequestId: string, reviewerId: string) => Promise<UMRequest>;
  completeDetermination: (umRequestId: string, input: CompleteClinicalReviewInput) => Promise<UMRequest>;
}
/* eslint-enable no-unused-vars */

type PersistedDelegatePlanAuditRow = Omit<DelegatePlanAuditRow, "umRequest"> & {
  caseId: string;
  umRequest?: UMRequest;
};

export function createDelegateUmWorkflow(
  platform: UmPlatform = createInMemoryUmPlatform(),
  persistence: UmPasPersistenceStore | undefined = createPasPersistenceStoreFromEnv(),
  policyStore: PolicyStore = createPolicyStoreFromEnv(),
  paymentIntentStore: PaymentIntentStore | undefined = createPaymentIntentStoreFromEnv(),
  paymentPolicyStore: PaymentPolicyStore = createPaymentPolicyStoreFromEnv()
): DelegateUmWorkflow {
  const rows = new Map<string, DelegatePlanAuditRow>();
  const settlementsInFlight = new Map<string, Promise<DelegatePlanAuditRow>>();

  async function listRequests(): Promise<UMRequest[]> {
    return persistence ? persistence.listUmRequests() : platform.listUmRequests();
  }

  async function getRequest(umRequestId: string): Promise<UMRequest | null> {
    return (await persistence?.getUmRequest(umRequestId)) ?? platform.getUmRequest(umRequestId);
  }

  async function saveRequest(umRequest: UMRequest): Promise<void> {
    await persistence?.saveUmRequest(umRequest);
  }

  async function getStoredDelegateRow(
    umRequestId: string,
    request?: UMRequest | null
  ): Promise<DelegatePlanAuditRow | null> {
    return rows.get(umRequestId) ?? (await getPersistedDelegateRow(persistence, umRequestId, request ?? undefined));
  }

  return {
    async listWorkqueue() {
      return (await listRequests())
        .filter((request) => Boolean(request.delegateVendorId) && request.state !== "determined")
        .sort((left, right) => left.slaDeadlineAt.localeCompare(right.slaDeadlineAt));
    },
    async listPlanRows() {
      const requests = await listRequests();
      await loadPersistedDelegateRows(persistence, rows, requests);

      return requests
        .filter((request) => Boolean(request.delegateVendorId))
        .map((request) => {
          const row = rows.get(request.id);
          return row ? withUmRequest(row, request) : buildPendingRow(request);
        })
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
      const request = await getRequest(umRequestId);
      const existingRow = await getStoredDelegateRow(umRequestId, request);
      if (request && existingRow && isImmutablePaidDelegateRow(existingRow)) {
        rows.set(umRequestId, withUmRequest(existingRow, request));
        return request;
      }

      if (request?.state === "determined" && existingRow && isTerminalDelegateRow(existingRow)) {
        rows.set(umRequestId, withUmRequest(existingRow, request));
        return request;
      }

      const existingSettlement = settlementsInFlight.get(umRequestId);
      if (existingSettlement) {
        return (await existingSettlement).umRequest;
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
        return (await settlement).umRequest;
      } finally {
        settlementsInFlight.delete(umRequestId);
      }
    }
  };
}

export const delegateUmWorkflow = createDelegateUmWorkflow(umPlatform);

/* eslint-disable no-unused-vars -- TypeScript function signatures require parameter names. */
interface CompleteAndSettleDependencies {
  umRequestId: string;
  input: CompleteClinicalReviewInput;
  getRequest: (umRequestId: string) => Promise<UMRequest | null>;
  saveRequest: (umRequest: UMRequest) => Promise<void>;
  platform: UmPlatform;
  persistence: UmPasPersistenceStore | undefined;
  rows: Map<string, DelegatePlanAuditRow>;
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
}: CompleteAndSettleDependencies): Promise<DelegatePlanAuditRow> {
  const persisted = await getRequest(umRequestId);
  if (!persisted) {
    throw new Error(`UM_REQUEST_NOT_FOUND:${umRequestId}`);
  }

  if (!persisted.delegateVendorId) {
    throw new Error(`UM_REQUEST_NOT_DELEGATED:${umRequestId}`);
  }

  const request = persistence
    ? completeClinicalReviewForRequest(persisted, input)
    : platform.completeClinicalReview(umRequestId, input);
  await saveRequest(request);

  const row = await settleDetermination(request, {
    rows,
    persistence,
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
    delegateVendorId: requireDelegateVendorId(request),
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
    auditReady: Boolean(request.auditRefs.pasClaimBundleId)
  };
}

function buildPendingRow(request: UMRequest): DelegatePlanAuditRow {
  return {
    evaluationType: "delegate_um_sla_bonus",
    umRequest: request,
    umRequestId: request.id,
    id: request.id,
    planId: request.planId,
    planDisplay: request.planDisplay,
    delegateVendorId: requireDelegateVendorId(request),
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
    policyControls: [],
    policyCriteria: [],
    audit: null,
    walletId: null,
    paymentIntentId: null,
    transactionId: null
  };
}

function requireDelegateVendorId(request: UMRequest): string {
  if (!request.delegateVendorId) {
    throw new Error(`UM_REQUEST_NOT_DELEGATED:${request.id}`);
  }

  return request.delegateVendorId;
}

async function settleDetermination(
  request: UMRequest,
  dependencies: {
    rows: Map<string, DelegatePlanAuditRow>;
    persistence: UmPasPersistenceStore | undefined;
    policyStore: PolicyStore;
    paymentIntentStore: PaymentIntentStore | undefined;
    paymentPolicyStore: PaymentPolicyStore;
  }
): Promise<DelegatePlanAuditRow> {
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
    const blockedEvaluation = { ...evaluation, result };
    const audit = createAuditRecord({
      request: evaluation.request,
      result,
      transactionId: null
    });
    const businessEvaluationId = buildBusinessEvaluationId({
      umRequestId: request.id,
      businessPolicyId: result.policyId
    });

    return {
      ...buildPendingRow(request),
      id: businessEvaluationId,
      slaStatus: buildDeterminedSlaStatus(request),
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      currency: result.currency,
      settlementToken: result.settlementToken,
      reason: summarizeDelegateReason(result.reasonCodes),
      reasonCodes: result.reasonCodes,
      policyId: result.policyId,
      policyControls: buildDelegatePolicyControls(),
      policyCriteria: buildDelegatePolicyCriteria(blockedEvaluation),
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
  const businessPolicyId = evaluation.result.policyId;
  const businessEvaluationId = buildBusinessEvaluationId({
    umRequestId: request.id,
    businessPolicyId
  });
  const baseRow: DelegatePlanAuditRow = {
    ...buildPendingRow(request),
    id: businessEvaluationId,
    slaStatus: buildDeterminedSlaStatus(request),
    incentiveStatus: evaluation.result.decision === "approved" ? "paid" : "not_eligible",
    paymentStatus: evaluation.result.decision === "approved" ? "auto_executed" : "blocked_by_policy",
    incentiveValue: evaluation.result.amount,
    currency: evaluation.result.currency,
    settlementToken: evaluation.result.settlementToken,
    reason: summarizeDelegateReason(evaluation.result.reasonCodes),
    reasonCodes: evaluation.result.reasonCodes,
    policyId: businessPolicyId,
    policyControls: buildDelegatePolicyControls(),
    policyCriteria: buildDelegatePolicyCriteria(evaluation),
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

    const paymentRequest = {
      auditId: audit.id,
      umRequestId: request.id,
      caseId: request.id,
      incentiveEvaluationId: businessEvaluationId,
      planId: evidence.planId,
      paymentPolicyId: paymentPolicy.planId,
      amount: evaluation.result.amount,
      currency: evaluation.result.currency,
      walletId: evaluation.result.walletId,
      policyId: businessPolicyId,
      businessPolicyId,
      policyVersion: evaluation.result.policyVersion,
      triggerEvent: "UM_REQUEST_DETERMINED",
      policyControls: buildDelegatePolicyControls()
    } satisfies PaymentApprovalRequest;

    const payment = await executePolicyBoundPayment(
      paymentRequest,
      {
        paymentIntentStore: dependencies.paymentIntentStore,
        planPolicy: paymentPolicy,
        businessEvaluationStore: createBusinessEvaluationAttestationStore(
          {
            async getIncentiveRow(lookupUmRequestId, lookupBusinessPolicyId) {
              const row = dependencies.rows.get(lookupUmRequestId);

              if (!row || (lookupBusinessPolicyId && row.policyId !== lookupBusinessPolicyId)) {
                return null;
              }

              return {
                ...row,
                caseId: row.umRequestId,
                policyId: row.policyId ?? "",
                audit: row.audit ?? audit
              };
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
    const paidRow = await getPersistedDelegateRow(
      dependencies.persistence,
      request.id,
      request,
      businessPolicyId
    );
    if (paidRow && isImmutablePaidDelegateRow(paidRow)) {
      return paidRow;
    }

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
  rows: Map<string, DelegatePlanAuditRow>,
  requests: UMRequest[] = []
): Promise<void> {
  const persistedRows = (await persistence?.listIncentiveRows()) ?? [];
  const requestsById = new Map(requests.map((request) => [request.id, request]));

  for (const persistedRow of persistedRows) {
    const row = normalizePersistedDelegateRow(persistedRow, getPersistedDelegateRequest(requestsById, persistedRow));
    if (row) {
      rows.set(row.umRequestId, row);
    }
  }
}

async function getPersistedDelegateRow(
  persistence: UmPasPersistenceStore | undefined,
  umRequestId: string,
  request?: UMRequest,
  businessPolicyId?: string
): Promise<DelegatePlanAuditRow | null> {
  if (!persistence) {
    return null;
  }

  if (businessPolicyId) {
    return normalizePersistedDelegateRow(
      await persistence.getIncentiveRow(umRequestId, businessPolicyId),
      request
    );
  }

  const persistedRows = await persistence.listIncentiveRows();
  const persistedRow = persistedRows.find((row) => (
    row.umRequestId === umRequestId &&
    (row as { evaluationType?: string }).evaluationType === "delegate_um_sla_bonus"
  ));

  return normalizePersistedDelegateRow(persistedRow, request);
}

async function saveDelegateRow(
  persistence: UmPasPersistenceStore | undefined,
  row: DelegatePlanAuditRow
): Promise<void> {
  await persistence?.saveIncentiveRow(toPersistedDelegateRow(row) as unknown as Parameters<UmPasPersistenceStore["saveIncentiveRow"]>[0]);
}

function toPersistedDelegateRow(row: DelegatePlanAuditRow): PersistedDelegatePlanAuditRow {
  return {
    ...row,
    caseId: row.umRequestId
  };
}

function normalizePersistedDelegateRow(value: unknown, request?: UMRequest): DelegatePlanAuditRow | null {
  if (!isDelegatePlanAuditRowShape(value)) {
    return null;
  }

  const umRequest = isUmRequestShape(value.umRequest)
    ? structuredClone(value.umRequest)
    : request
      ? structuredClone(request)
      : null;

  if (!umRequest) {
    return null;
  }

  return {
    ...value,
    umRequest,
    audit: value.audit ? { ...value.audit } : null,
    reasonCodes: [...value.reasonCodes],
    policyControls: Array.isArray(value.policyControls) ? [...value.policyControls] : [],
    policyCriteria: Array.isArray(value.policyCriteria)
      ? value.policyCriteria.map((criterion) => ({ ...criterion }))
      : [],
    settlementToken: { ...value.settlementToken }
  };
}

function getPersistedDelegateRequest(
  requestsById: Map<string, UMRequest>,
  value: unknown
): UMRequest | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const umRequestId = (value as Partial<Pick<DelegatePlanAuditRow, "umRequestId">>).umRequestId;
  return typeof umRequestId === "string" ? requestsById.get(umRequestId) : undefined;
}

function isDelegatePlanAuditRowShape(value: unknown): value is PersistedDelegatePlanAuditRow {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<PersistedDelegatePlanAuditRow>;

  return (
    typeof candidate.umRequestId === "string" &&
    candidate.evaluationType === "delegate_um_sla_bonus" &&
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

function isUmRequestShape(value: unknown): value is UMRequest {
  return typeof value === "object" && value !== null && typeof (value as Partial<UMRequest>).id === "string";
}

function withUmRequest(row: DelegatePlanAuditRow, request: UMRequest): DelegatePlanAuditRow {
  return {
    ...row,
    umRequest: request,
    umRequestId: request.id,
    id: row.id,
    planId: request.planId,
    planDisplay: request.planDisplay,
    delegateVendorId: requireDelegateVendorId(request),
    requestType: request.requestType,
    serviceLabel: request.serviceLabel,
    submittedAt: request.submittedAt,
    pendStartedAt: request.pendStartedAt,
    slaDeadlineAt: request.slaDeadlineAt,
    determinedAt: request.determinedAt,
    timeRemainingMs: Math.max(0, new Date(request.slaDeadlineAt).getTime() - Date.now()),
    state: request.state,
    outcomeStatus: request.outcomeStatus,
    slaStatus: request.state === "determined" ? buildDeterminedSlaStatus(request) : row.slaStatus
  };
}

function isImmutablePaidDelegateRow(row: DelegatePlanAuditRow): boolean {
  return row.incentiveStatus === "paid" && Boolean(row.transactionId || row.paymentIntentId);
}

function isTerminalDelegateRow(row: DelegatePlanAuditRow): boolean {
  return row.incentiveStatus === "paid" || row.incentiveStatus === "not_eligible" || row.incentiveStatus === "payment_failed";
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

function buildDelegatePolicyCriteria(
  evaluation: ReturnType<typeof evaluateDelegateUmSlaEvent>
): PolicyCriterionMatch[] {
  const evidence = evaluation.request.requestObject;
  const reasonCodes = evaluation.result.reasonCodes;
  const eligibleRequestTypes = evaluation.policy.incentiveScope.eligibleRequestTypes ?? [];
  const excludedRequestTypes = evaluation.policy.incentiveScope.excludedRequestTypes ?? [];
  const usesEligibleRequestTypes = eligibleRequestTypes.length > 0;
  const requestTypeReasonCode = usesEligibleRequestTypes ? "REQUEST_TYPE_NOT_ELIGIBLE" : "REQUEST_TYPE_EXCLUDED";
  const requestType = formatPolicyValue(evidence.requestType);
  const requestTypeInScope = usesEligibleRequestTypes
    ? eligibleRequestTypes.includes(requestType)
    : !excludedRequestTypes.includes(requestType);
  const slaHours = typeof evidence.slaHours === "number" ? evidence.slaHours : Number(evidence.slaHours ?? 24);
  const slaLabel = Number.isFinite(slaHours) ? `${slaHours}h` : "configured";

  return [
    criterion({
      id: "plan",
      label: "Plan is in the delegate contract",
      expected: evaluation.policy.contractPair.planId,
      actual: formatPolicyValue(evidence.planId),
      reasonCode: "PLAN_NOT_IN_CONTRACT",
      passed: evidence.planId === evaluation.policy.contractPair.planId && !reasonCodes.includes("PLAN_NOT_IN_CONTRACT")
    }),
    criterion({
      id: "delegateVendor",
      label: "Delegate vendor is in the contract",
      expected: evaluation.policy.contractPair.providerId,
      actual: formatPolicyValue(evidence.delegateVendorId),
      reasonCode: "DELEGATE_VENDOR_NOT_IN_CONTRACT",
      passed:
        evidence.delegateVendorId === evaluation.policy.contractPair.providerId &&
        evaluation.request.submitter.id === evaluation.policy.contractPair.providerId &&
        !reasonCodes.includes("DELEGATE_VENDOR_NOT_IN_CONTRACT")
    }),
    criterion({
      id: "wallet",
      label: "Recipient wallet is approved",
      expected: evaluation.policy.settlement.recipientWalletId,
      actual: evaluation.result.walletId ?? "Not assigned",
      reasonCode: "WALLET_NOT_APPROVED",
      passed: evaluation.result.walletId === evaluation.policy.settlement.recipientWalletId
    }),
    criterion({
      id: "requestType",
      label: usesEligibleRequestTypes ? "Request type is eligible" : "Request type is not excluded",
      expected: (usesEligibleRequestTypes ? eligibleRequestTypes : excludedRequestTypes)
        .map((policyRequestType) => formatDelegateRequestType(policyRequestType))
        .join(" or "),
      actual: formatDelegateRequestType(requestType),
      reasonCode: requestTypeReasonCode,
      passed: requestTypeInScope && !reasonCodes.includes(requestTypeReasonCode)
    }),
    evidenceCriterion(
      evidence,
      "state",
      "UM request is determined",
      "determined",
      "UM_REQUEST_NOT_DETERMINED",
      reasonCodes
    ),
    evidenceCriterion(
      evidence,
      "outcomeStatusPresent",
      "Determination outcome is captured",
      true,
      "OUTCOME_STATUS_MISSING",
      reasonCodes
    ),
    criterion({
      id: "sla",
      label: "Determination completed within SLA",
      expected: `Within ${slaLabel} SLA`,
      actual: evidence.completedWithinSla === true ? `Within ${slaLabel} SLA` : `Exceeded ${slaLabel} SLA`,
      reasonCode: "SLA_EXCEEDED",
      passed: evidence.completedWithinSla === true && !reasonCodes.includes("SLA_EXCEEDED")
    }),
    evidenceCriterion(
      evidence,
      "clinicalReviewCompleted",
      "Clinical review checklist is complete",
      true,
      "CLINICAL_REVIEW_INCOMPLETE",
      reasonCodes
    ),
    evidenceCriterion(
      evidence,
      "auditReady",
      "PAS audit reference is available",
      true,
      "PAS_AUDIT_RECORD_MISSING",
      reasonCodes
    ),
    criterion({
      id: "outcomeNotPaymentMetric",
      label: "Outcome status is not used for payment",
      expected: "false",
      actual: formatPolicyValue(evidence.outcomeStatusUsedForPayment),
      reasonCode: "PROHIBITED_OUTCOME_METRIC",
      passed: evidence.outcomeStatusUsedForPayment === false && !reasonCodes.includes("PROHIBITED_OUTCOME_METRIC")
    })
  ];
}

function evidenceCriterion(
  evidence: Record<string, unknown>,
  field: string,
  label: string,
  expected: string | boolean,
  reasonCode: string,
  reasonCodes: string[]
): PolicyCriterionMatch {
  const actual = evidence[field];

  return criterion({
    id: field,
    label,
    expected: String(expected),
    actual: formatPolicyValue(actual),
    reasonCode,
    passed: actual === expected && !reasonCodes.includes(reasonCode)
  });
}

function criterion(input: PolicyCriterionMatch): PolicyCriterionMatch {
  return input;
}

function formatPolicyValue(value: unknown): string {
  if (value === undefined) {
    return "Missing";
  }

  if (value === null) {
    return "null";
  }

  return String(value);
}

function formatDelegateRequestType(requestType: string): string {
  switch (requestType) {
    case "outpatient_service":
      return "Outpatient Service";
    case "pharmacy_benefit":
      return "Pharmacy Benefit";
    case "inpatient_admission":
      return "Inpatient Admission";
    default:
      return requestType;
  }
}
