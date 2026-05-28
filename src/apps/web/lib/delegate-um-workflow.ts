import { createAuditRecord, type AuditRecord } from "@operon-labs/audit-log";
import {
  buildBusinessEvaluationId,
  buildPaymentIntentId,
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
import {
  createPaymentPolicyStoreFromEnv,
  type PaymentPlanPolicy,
  type PaymentPolicyStore
} from "./payment-policy-store";
import {
  createPaymentPolicyEvidenceStoreFromEnv,
  type PaymentPolicyControlEvidence,
  type PaymentPolicyEvidence,
  type PaymentPolicyEvidenceOutcome,
  type PaymentPolicyEvidenceStore
} from "./payment-policy-evidence-store";
import { createPolicyStoreFromEnv, type PolicyStore } from "./policy-store";
import {
  businessPolicyStatusFromIncentiveStatus,
  paymentPolicyStatusFromPaymentStatus,
  type BusinessPolicyStatus,
  type PaymentPolicyStatus,
  type PolicyCriterionMatch
} from "./provider-documentation-workflow";
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
  businessPolicyStatus: BusinessPolicyStatus | null;
  paymentPolicyStatus: PaymentPolicyStatus | null;
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
  paymentPolicyId: string | null;
  paymentPolicyControls: PaymentPolicyControlEvidence[];
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

interface CanonicalDelegatePolicyCriteriaEvidence {
  state?: unknown;
  outcomeStatusPresent?: unknown;
  clinicalDocumentationReviewed?: unknown;
  medicalNecessityCriteriaMet?: unknown;
  planPolicyRequirementsChecked?: unknown;
  decisionRationaleDocumented?: unknown;
  completedWithinSla?: unknown;
  slaHours?: unknown;
}

export function createDelegateUmWorkflow(
  platform: UmPlatform = createInMemoryUmPlatform(),
  persistence: UmPasPersistenceStore | undefined = createPasPersistenceStoreFromEnv(),
  policyStore: PolicyStore = createPolicyStoreFromEnv(),
  paymentIntentStore: PaymentIntentStore | undefined = createPaymentIntentStoreFromEnv(),
  paymentPolicyStore: PaymentPolicyStore = createPaymentPolicyStoreFromEnv(),
  paymentPolicyEvidenceStore: PaymentPolicyEvidenceStore | undefined = createPaymentPolicyEvidenceStoreFromEnv()
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
      await loadPersistedDelegateRows(persistence, rows, requests, paymentPolicyStore);

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
        paymentPolicyStore,
        paymentPolicyEvidenceStore
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
  paymentPolicyEvidenceStore: PaymentPolicyEvidenceStore | undefined;
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
  paymentPolicyStore,
  paymentPolicyEvidenceStore
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
    paymentPolicyStore,
    paymentPolicyEvidenceStore
  });
  rows.set(request.id, row);
  await saveDelegateRow(persistence, row);
  return row;
}

function buildDelegateEvidence(request: UMRequest): DelegateUmSlaEvidence {
  const clinicalReview = resolveClinicalReviewBooleans(request.clinicalReview);

  return {
    umRequestId: request.id,
    id: request.id,
    planId: request.planId,
    delegateVendorId: requireDelegateVendorId(request),
    requestType: request.requestType,
    state: request.state,
    outcomeStatus: request.outcomeStatus ?? "approved",
    outcomeStatusPresent: request.outcomeStatus !== null,
    completedWithinSla:
      request.determinedAt !== null &&
      new Date(request.determinedAt).getTime() <= new Date(request.slaDeadlineAt).getTime(),
    slaHours: request.slaHours,
    clinicalDocumentationReviewed: clinicalReview.clinicalDocumentationReviewed,
    medicalNecessityCriteriaMet: clinicalReview.medicalNecessityCriteriaMet,
    planPolicyRequirementsChecked: clinicalReview.planPolicyRequirementsChecked,
    decisionRationaleDocumented: clinicalReview.decisionRationaleDocumented,
    auditReady: Boolean(request.auditRefs.pasClaimBundleId)
  };
}

type LegacyClinicalReview = UMRequest["clinicalReview"] & {
  medicalNecessityReviewed?: unknown;
  policyCriteriaChecked?: unknown;
  rationaleCaptured?: unknown;
};

function resolveClinicalReviewBooleans(review: LegacyClinicalReview) {
  const legacyChecklistComplete =
    review.medicalNecessityReviewed === true &&
    review.policyCriteriaChecked === true &&
    review.rationaleCaptured === true;

  return {
    clinicalDocumentationReviewed:
      typeof review.clinicalDocumentationReviewed === "boolean"
        ? review.clinicalDocumentationReviewed
        : legacyChecklistComplete,
    medicalNecessityCriteriaMet:
      typeof review.medicalNecessityCriteriaMet === "boolean"
        ? review.medicalNecessityCriteriaMet
        : review.medicalNecessityReviewed === true,
    planPolicyRequirementsChecked:
      typeof review.planPolicyRequirementsChecked === "boolean"
        ? review.planPolicyRequirementsChecked
        : review.policyCriteriaChecked === true,
    decisionRationaleDocumented:
      typeof review.decisionRationaleDocumented === "boolean"
        ? review.decisionRationaleDocumented
        : review.rationaleCaptured === true
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
    businessPolicyStatus: null,
    paymentPolicyStatus: null,
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
    paymentPolicyId: null,
    paymentPolicyControls: [],
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
    paymentPolicyEvidenceStore: PaymentPolicyEvidenceStore | undefined;
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
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
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
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
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
      paymentPolicyId: null,
      paymentPolicyControls: [],
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
    businessPolicyStatus: evaluation.result.decision === "approved" ? "approved" : "rejected",
    paymentPolicyStatus: evaluation.result.decision === "approved" ? null : "blocked",
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
    paymentPolicyId: null,
    paymentPolicyControls: [],
    audit,
    walletId: evaluation.result.walletId
  };

  if (evaluation.result.decision !== "approved" || !evaluation.result.walletId) {
    return baseRow;
  }

  dependencies.rows.set(request.id, baseRow);

  let paymentPolicy: PaymentPlanPolicy | null = null;
  let requestedPaymentIntentId: string | null = null;
  let payment: Awaited<ReturnType<typeof executePolicyBoundPayment>>;

  try {
    paymentPolicy = await dependencies.paymentPolicyStore.getPolicyForPlan(evidence.planId);
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
    requestedPaymentIntentId = buildPaymentIntentId(paymentRequest);

    payment = await executePolicyBoundPayment(
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
  } catch (error) {
    const paidRow = await getPersistedDelegateRow(
      dependencies.persistence,
      request.id,
      request,
      businessPolicyId
    );
    if (paidRow && isImmutablePaidDelegateRow(paidRow)) {
      return paidRow;
    }

    const failedRow: DelegatePlanAuditRow = {
      ...baseRow,
      businessPolicyStatus: "approved",
      paymentPolicyStatus: "blocked",
      paymentPolicyId: paymentPolicy?.planId ?? null,
      incentiveStatus: "payment_failed",
      paymentStatus: "execution_failed",
      reason: "Policy approved, but Hedera transaction execution failed",
      paymentIntentId: null,
      transactionId: null
    };

    if (!paymentPolicy) {
      return failedRow;
    }

    const failedPaymentIntentId =
      requestedPaymentIntentId ??
      buildPaymentIntentId({
        umRequestId: failedRow.umRequestId,
        caseId: failedRow.umRequestId,
        incentiveEvaluationId: failedRow.id,
        businessPolicyId,
        paymentPolicyId: paymentPolicy.planId
      });
    const evidenceRecord = buildDelegatePaymentPolicyEvidence({
      row: failedRow,
      paymentPolicy,
      outcome: "blocked",
      failureCode: toPaymentPolicyFailureCode(error),
      paymentIntentId: failedPaymentIntentId,
      transactionId: null
    });
    await saveOptionalPaymentPolicyEvidence(dependencies.paymentPolicyEvidenceStore, evidenceRecord);

    return {
      ...failedRow,
      paymentPolicyControls: evidenceRecord.controls
    };
  }

  const paymentIntentId = payment.paymentIntentId ?? requestedPaymentIntentId;
  const paidRow: DelegatePlanAuditRow = {
    ...baseRow,
    paymentPolicyStatus: "paid",
    paymentPolicyId: paymentPolicy.planId,
    paymentIntentId,
    transactionId: payment.transactionId,
    audit: {
      ...audit,
      transactionId: payment.transactionId
    }
  };
  const evidenceRecord = buildDelegatePaymentPolicyEvidence({
    row: paidRow,
    paymentPolicy,
    outcome: "paid",
    failureCode: null,
    paymentIntentId,
    transactionId: payment.transactionId ?? null
  });
  await saveOptionalPaymentPolicyEvidence(dependencies.paymentPolicyEvidenceStore, evidenceRecord);

  return {
    ...paidRow,
    paymentPolicyControls: evidenceRecord.controls
  };
}

async function loadPersistedDelegateRows(
  persistence: UmPasPersistenceStore | undefined,
  rows: Map<string, DelegatePlanAuditRow>,
  requests: UMRequest[] = [],
  paymentPolicyStore?: PaymentPolicyStore
): Promise<void> {
  const persistedRows = (await persistence?.listIncentiveRows()) ?? [];
  const requestsById = new Map(requests.map((request) => [request.id, request]));

  for (const persistedRow of persistedRows) {
    const row = await withDerivedLegacyPaymentControls(
      normalizePersistedDelegateRow(persistedRow, getPersistedDelegateRequest(requestsById, persistedRow)),
      paymentPolicyStore
    );
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

  const legacyPolicyCriteria = Array.isArray(value.policyCriteria)
    ? value.policyCriteria.map((criterion) => ({ ...criterion }))
    : [];

  return {
    ...value,
    umRequest,
    businessPolicyStatus: value.businessPolicyStatus ?? businessPolicyStatusFromIncentiveStatus(value.incentiveStatus),
    paymentPolicyStatus: value.paymentPolicyStatus ?? paymentPolicyStatusFromPaymentStatus(value),
    audit: value.audit ? { ...value.audit } : null,
    reasonCodes: [...value.reasonCodes],
    policyControls: Array.isArray(value.policyControls) ? [...value.policyControls] : [],
    policyCriteria: buildCanonicalDelegatePolicyCriteria(
      mergeDelegateEvidenceFromLegacyCriteria(buildDelegateEvidence(umRequest), legacyPolicyCriteria),
      [...value.reasonCodes]
    ),
    paymentPolicyId: typeof value.paymentPolicyId === "string" ? value.paymentPolicyId : null,
    paymentPolicyControls: Array.isArray(value.paymentPolicyControls)
      ? value.paymentPolicyControls.map((control) => ({ ...control }))
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

async function withDerivedLegacyPaymentControls(
  row: DelegatePlanAuditRow | null,
  paymentPolicyStore?: PaymentPolicyStore
): Promise<DelegatePlanAuditRow | null> {
  if (!row || row.paymentPolicyControls.length > 0 || !paymentPolicyStore || !needsDerivedPaymentControls(row)) {
    return row;
  }

  const paymentPolicy = await paymentPolicyStore.getPolicyForPlan(row.paymentPolicyId ?? row.planId);
  if (!paymentPolicy) {
    return row;
  }

  return {
    ...row,
    paymentPolicyId: row.paymentPolicyId ?? paymentPolicy.planId,
    paymentPolicyControls: buildDelegatePaymentPolicyControlEvidence({
      row,
      paymentPolicy,
      outcome: row.paymentPolicyStatus === "paid" || row.paymentStatus === "auto_executed" ? "paid" : "blocked",
      failureCode: row.paymentStatus === "execution_failed" ? "PAYMENT_POLICY_EXECUTION_FAILED" : null
    })
  };
}

function needsDerivedPaymentControls(row: DelegatePlanAuditRow): boolean {
  return (
    row.paymentPolicyStatus === "paid" ||
    row.paymentPolicyStatus === "blocked" ||
    row.paymentStatus === "auto_executed" ||
    row.paymentStatus === "blocked_by_policy" ||
    row.paymentStatus === "execution_failed"
  );
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
  return (row.paymentPolicyStatus === "paid" || row.incentiveStatus === "paid") && Boolean(row.transactionId || row.paymentIntentId);
}

function isTerminalDelegateRow(row: DelegatePlanAuditRow): boolean {
  return row.businessPolicyStatus !== null && row.paymentPolicyStatus !== null;
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
    "PAS audit reference required"
  ];
}

function buildDelegatePaymentPolicyEvidence({
  row,
  paymentPolicy,
  outcome,
  failureCode,
  paymentIntentId,
  transactionId
}: {
  row: DelegatePlanAuditRow;
  paymentPolicy: PaymentPlanPolicy;
  outcome: PaymentPolicyEvidenceOutcome;
  failureCode: string | null;
  paymentIntentId: string;
  transactionId: string | null;
}): PaymentPolicyEvidence {
  const now = new Date().toISOString();

  return {
    incentiveEvaluationId: row.id,
    umRequestId: row.umRequestId,
    caseId: row.umRequestId,
    planId: paymentPolicy.planId,
    paymentPolicyId: paymentPolicy.planId,
    businessPolicyId: row.policyId ?? "",
    runtime: "hedera-agent-kit-policy",
    outcome,
    failureCode,
    requestedPayment: {
      amount: row.incentiveValue,
      token: row.currency,
      recipientWalletId: row.walletId ?? "Not assigned"
    },
    controls: buildDelegatePaymentPolicyControlEvidence({
      row,
      paymentPolicy,
      outcome,
      failureCode
    }),
    paymentIntentId,
    transactionId,
    createdAt: now,
    updatedAt: now
  };
}

function buildDelegatePaymentPolicyControlEvidence({
  row,
  paymentPolicy,
  outcome,
  failureCode
}: {
  row: DelegatePlanAuditRow;
  paymentPolicy: PaymentPlanPolicy;
  outcome: PaymentPolicyEvidenceOutcome;
  failureCode: string | null;
}): PaymentPolicyControlEvidence[] {
  const amount = row.incentiveValue;
  const token = row.currency;
  const success = outcome === "paid";

  return [
    {
      id: "businessEvaluationAttestation",
      label: "Business evaluation attestation",
      status: paymentPolicy.businessEvaluationAttestation
        ? paymentControlStatus(failureCode, "BUSINESS_EVALUATION", success || failureCode !== null)
        : "not_run"
    },
    {
      id: "paymentToken",
      label: "Payment token",
      status: paymentPolicy.paymentToken === token && failureCode !== "HEDERA_PAYMENT_TOKEN_NOT_ALLOWED" ? "passed" : "failed",
      expected: paymentPolicy.paymentToken,
      actual: token,
      failureCode: failureCode === "HEDERA_PAYMENT_TOKEN_NOT_ALLOWED" ? failureCode : undefined
    },
    {
      id: "maxPaymentPerRequest",
      label: "Max payment per request",
      status: paymentPolicy.maxPaymentPerRequest
        ? amount > paymentPolicy.maxPaymentAmount || failureCode === "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX"
          ? "failed"
          : "passed"
        : "not_run",
      expected: `<= ${paymentPolicy.maxPaymentAmount} ${paymentPolicy.paymentToken}`,
      actual: `${amount} ${token}`,
      failureCode: failureCode === "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX" ? failureCode : undefined
    },
    {
      id: "duplicatePaymentPrevention",
      label: "Duplicate payment prevention",
      status: paymentPolicy.duplicatePaymentPrevention
        ? failureCode === "DUPLICATE_PAYMENT_BLOCKED"
          ? "failed"
          : success
            ? "passed"
            : "not_run"
        : "not_run",
      failureCode: failureCode === "DUPLICATE_PAYMENT_BLOCKED" ? failureCode : undefined
    },
    {
      id: "paymentEnvelopeIntegrity",
      label: "Payment envelope integrity",
      status: paymentPolicy.paymentEnvelopeIntegrity
        ? isPaymentEnvelopeFailure(failureCode)
          ? "failed"
          : success
            ? "passed"
            : "not_run"
        : "not_run",
      failureCode: isPaymentEnvelopeFailure(failureCode) ? failureCode ?? undefined : undefined
    }
  ];
}

function paymentControlStatus(
  failureCode: string | null,
  failurePrefix: string,
  evaluated: boolean
): PaymentPolicyControlEvidence["status"] {
  if (!evaluated) {
    return "not_run";
  }

  return failureCode?.startsWith(failurePrefix) ? "failed" : "passed";
}

function isPaymentEnvelopeFailure(failureCode: string | null): boolean {
  return Boolean(
    failureCode &&
      [
        "HEDERA_POLICY_SOURCE_ACCOUNT_MISMATCH",
        "HEDERA_POLICY_RECIPIENT_MISMATCH",
        "HEDERA_POLICY_AMOUNT_MISMATCH",
        "HEDERA_POLICY_MEMO_MISMATCH",
        "BUSINESS_EVALUATION_WALLET_MISMATCH",
        "BUSINESS_EVALUATION_AMOUNT_MISMATCH"
      ].includes(failureCode)
  );
}

function toPaymentPolicyFailureCode(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "PAYMENT_POLICY_EXECUTION_FAILED";
}

async function saveOptionalPaymentPolicyEvidence(
  paymentPolicyEvidenceStore: PaymentPolicyEvidenceStore | undefined,
  evidence: PaymentPolicyEvidence
): Promise<void> {
  await paymentPolicyEvidenceStore?.saveEvidence(evidence).catch(() => undefined);
}

function buildDelegatePolicyCriteria(
  evaluation: ReturnType<typeof evaluateDelegateUmSlaEvent>
): PolicyCriterionMatch[] {
  return buildCanonicalDelegatePolicyCriteria(evaluation.request.requestObject, evaluation.result.reasonCodes);
}

function buildCanonicalDelegatePolicyCriteria(
  evidence: CanonicalDelegatePolicyCriteriaEvidence,
  reasonCodes: string[]
): PolicyCriterionMatch[] {
  return [
    criterion({
      id: "clinicalDocumentationReviewed",
      label: "Clinical documentation reviewed",
      expected: "Yes",
      actual: formatYesNo(evidence.clinicalDocumentationReviewed === true),
      reasonCode: "CLINICAL_DOCUMENTATION_NOT_REVIEWED",
      passed:
        evidence.clinicalDocumentationReviewed === true &&
        !reasonCodes.includes("CLINICAL_DOCUMENTATION_NOT_REVIEWED")
    }),
    criterion({
      id: "medicalNecessityCriteriaMet",
      label: "Medical necessity criteria met",
      expected: "Yes",
      actual: formatYesNo(evidence.medicalNecessityCriteriaMet === true),
      reasonCode: "MEDICAL_NECESSITY_CRITERIA_NOT_MET",
      passed:
        evidence.medicalNecessityCriteriaMet === true &&
        !reasonCodes.includes("MEDICAL_NECESSITY_CRITERIA_NOT_MET")
    }),
    criterion({
      id: "planPolicyRequirementsChecked",
      label: "Plan policy requirements checked",
      expected: "Yes",
      actual: formatYesNo(evidence.planPolicyRequirementsChecked === true),
      reasonCode: "PLAN_POLICY_REQUIREMENTS_NOT_CHECKED",
      passed:
        evidence.planPolicyRequirementsChecked === true &&
        !reasonCodes.includes("PLAN_POLICY_REQUIREMENTS_NOT_CHECKED")
    }),
    criterion({
      id: "decisionRationaleDocumented",
      label: "Decision rationale documented",
      expected: "Yes",
      actual: formatYesNo(evidence.decisionRationaleDocumented === true),
      reasonCode: "DECISION_RATIONALE_NOT_DOCUMENTED",
      passed:
        evidence.decisionRationaleDocumented === true &&
        !reasonCodes.includes("DECISION_RATIONALE_NOT_DOCUMENTED")
    })
  ];
}

function mergeDelegateEvidenceFromLegacyCriteria(
  evidence: DelegateUmSlaEvidence,
  policyCriteria: PolicyCriterionMatch[]
): DelegateUmSlaEvidence {
  if (policyCriteria.length === 0) {
    return evidence;
  }

  return {
    ...evidence,
    state: legacyCriterionPassed(policyCriteria, "state") ? "determined" : evidence.state,
    outcomeStatusPresent:
      legacyCriterionPassed(policyCriteria, "outcomeStatusPresent") || evidence.outcomeStatusPresent,
    completedWithinSla:
      legacyCriterionPassed(policyCriteria, "sla") || evidence.completedWithinSla,
    clinicalDocumentationReviewed:
      legacyCriterionPassed(policyCriteria, "clinicalReviewCompleted") || evidence.clinicalDocumentationReviewed,
    medicalNecessityCriteriaMet:
      legacyCriterionPassed(policyCriteria, "clinicalReviewCompleted") || evidence.medicalNecessityCriteriaMet,
    planPolicyRequirementsChecked:
      legacyCriterionPassed(policyCriteria, "clinicalReviewCompleted") || evidence.planPolicyRequirementsChecked,
    decisionRationaleDocumented:
      legacyCriterionPassed(policyCriteria, "clinicalReviewCompleted") || evidence.decisionRationaleDocumented
  };
}

function legacyCriterionPassed(policyCriteria: PolicyCriterionMatch[], id: string): boolean {
  return policyCriteria.some((criterion) => criterion.id === id && criterion.passed);
}

function criterion(input: PolicyCriterionMatch): PolicyCriterionMatch {
  return input;
}

function formatYesNo(value: boolean): string {
  return value ? "Yes" : "No";
}
