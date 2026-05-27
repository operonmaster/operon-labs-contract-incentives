import { createAuditRecord, type AuditRecord } from "@operon-labs/audit-log";
import { executePolicyBoundPayment, type PaymentIntentStore } from "@operon-labs/hedera-executor";
import { evaluateProviderDocumentationEvent } from "@operon-labs/incentive-agent";
import type { Currency, SettlementToken } from "@operon-labs/policy-engine";
import {
  buildProviderDocumentationEvidence,
  buildPasFhirBundle,
  createInMemoryUmPlatform,
  getCoverageRequirements,
  type PriorAuthRecord,
  type PriorAuthSubmissionInput,
  type ProviderDocumentationEvidence,
  type RequestType,
  type ServiceCode,
  type UMRequest,
  type UMPlatformEvent,
  type UmPlatform
} from "@operon-labs/um-platform";
import { createPasPersistenceStoreFromEnv, type UmPasPersistenceStore } from "./pas-persistence";
import { createPaymentIntentStoreFromEnv } from "./payment-intent-store";
import { createPolicyStoreFromEnv, type PolicyStore } from "./policy-store";
import { createBusinessEvaluationAttestationStore } from "./business-evaluation-attestation-store";
import { createPaymentPolicyStoreFromEnv, type PaymentPlanPolicy, type PaymentPolicyStore } from "./payment-policy-store";
import {
  createPaymentPolicyEvidenceStoreFromEnv,
  type PaymentPolicyControlEvidence,
  type PaymentPolicyEvidence,
  type PaymentPolicyEvidenceOutcome,
  type PaymentPolicyEvidenceStore
} from "./payment-policy-evidence-store";

export type IncentiveStatus = "not_eligible" | "paid" | "payment_failed";
export type PaymentStatus = "auto_executed" | "blocked_by_policy" | "execution_failed";

export interface PolicyCriterionMatch {
  id: string;
  label: string;
  expected: string;
  actual: string;
  passed: boolean;
  reasonCode: string;
}

export interface IncentiveWorklistRow {
  evaluationType?: "provider_documentation_completeness";
  id: string;
  umRequestId: string;
  caseId: string;
  planId?: string;
  planDisplay?: string;
  submittedAt: string;
  providerGroupDisplay: string;
  requestType: RequestType;
  serviceLabel: string;
  serviceCode: ServiceCode;
  state: UMRequest["state"];
  outcomeStatus: UMRequest["outcomeStatus"];
  incentiveStatus: IncentiveStatus;
  paymentStatus: PaymentStatus;
  incentiveValue: number;
  currency: Currency;
  settlementToken: SettlementToken;
  reason: string;
  reasonCodes: string[];
  policyId: string;
  policyControls: string[];
  policyCriteria: PolicyCriterionMatch[];
  umEvidenceSignature?: string;
  audit: AuditRecord;
  walletId: string | null;
  paymentIntentId: string | null;
  transactionId: string | null;
}

export type ProviderDocumentationUmRequest = Omit<UMRequest, "paResult" | "denialReason">;

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface ProviderDocumentationWorkflow {
  getCoverageRequirements: typeof getCoverageRequirements;
  submitPriorAuth(input: PriorAuthSubmissionInput): Promise<ProviderDocumentationUmRequest>;
  listUmRequests(): Promise<ProviderDocumentationUmRequest[]>;
  listPriorAuths(): Promise<ProviderDocumentationUmRequest[]>;
  getEvidence(umRequestId: string): Promise<ProviderDocumentationEvidence | null>;
  listIncentiveRows(): Promise<IncentiveWorklistRow[]>;
  getIncentiveRow(umRequestId: string): Promise<IncentiveWorklistRow | null>;
}
/* eslint-enable no-unused-vars */

export function createProviderDocumentationWorkflow(
  platform: UmPlatform = createInMemoryUmPlatform(),
  persistence: UmPasPersistenceStore | undefined = createPasPersistenceStoreFromEnv(),
  policyStore: PolicyStore = createPolicyStoreFromEnv(),
  paymentIntentStore: PaymentIntentStore | undefined = createPaymentIntentStoreFromEnv(),
  paymentPolicyStore: PaymentPolicyStore = createPaymentPolicyStoreFromEnv(),
  paymentPolicyEvidenceStore: PaymentPolicyEvidenceStore | undefined = createPaymentPolicyEvidenceStoreFromEnv()
): ProviderDocumentationWorkflow {
  const rows = new Map<string, IncentiveWorklistRow>();
  const settlementsInFlight = new Map<string, Promise<IncentiveWorklistRow | null>>();

  async function getUmRequest(umRequestId: string): Promise<UMRequest | null> {
    return (
      (await persistence?.getUmRequest(umRequestId)) ??
      platform.getUmRequest(umRequestId) ??
      null
    );
  }

  async function processEvent(event: UMPlatformEvent): Promise<IncentiveWorklistRow | null> {
    if (!isUmRequestCreatedEvent(event)) {
      return null;
    }

    const record = await getUmRequest(event.umRequestId);
    if (!record) {
      return null;
    }

    const existing = rows.get(event.umRequestId) ?? (await persistence?.getIncentiveRow(event.umRequestId)) ?? null;
    const providerExisting = existing && isProviderDocumentationIncentiveRow(existing) ? existing : null;
    if (providerExisting && isImmutablePaidIncentiveRow(providerExisting)) {
      rows.set(event.umRequestId, providerExisting);
      return providerExisting;
    }

    if (providerExisting && isCurrentIncentiveRow(providerExisting, record)) {
      const refreshed = refreshIncentiveRowDisplayFields(providerExisting, record);
      rows.set(event.umRequestId, refreshed);
      if (
        hasIncentiveRowDisplayFieldChanges(providerExisting, refreshed) &&
        !hasOnlyPaidLifecycleDisplayFieldChanges(providerExisting, refreshed)
      ) {
        await persistence?.saveIncentiveRow(refreshed);
      }
      return refreshed;
    }

    const existingSettlement = settlementsInFlight.get(event.umRequestId);
    if (existingSettlement) {
      return existingSettlement;
    }

    const settlement = settleEvent(event, record);
    settlementsInFlight.set(event.umRequestId, settlement);

    try {
      return await settlement;
    } finally {
      settlementsInFlight.delete(event.umRequestId);
    }
  }

  async function settleEvent(event: UMPlatformEvent, record: UMRequest): Promise<IncentiveWorklistRow | null> {
    const evidence = buildProviderDocumentationEvidence(record);

    const policies = await policyStore.findPolicies({
      evaluationType: "provider_documentation_completeness",
      planId: evidence.planId,
      providerId: evidence.providerId,
      requestType: evidence.requestType,
      submittedAt: record.submittedAt
    });
    if (policies.length === 0) {
      return null;
    }

    const evaluation = selectProviderDocumentationEvaluation(
      policies.map((policy) =>
        evaluateProviderDocumentationEvent(event, {
          getEvidenceByUmRequestId: () => evidence,
          policy,
          monthToDateAmount: 0
        })
      )
    );
    const policyControls = buildProviderDocumentationPolicyControls(evaluation);
    const audit = createAuditRecord({
      request: evaluation.request,
      result: evaluation.result,
      transactionId: null
    });
    const baseRow: IncentiveWorklistRow = {
      evaluationType: "provider_documentation_completeness",
      id: record.id,
      umRequestId: record.id,
      caseId: record.id,
      planId: record.planId,
      planDisplay: record.planDisplay,
      submittedAt: record.submittedAt,
      providerGroupDisplay: record.providerGroupDisplay,
      requestType: record.requestType,
      serviceLabel: record.serviceLabel,
      serviceCode: record.serviceCode,
      state: record.state,
      outcomeStatus: record.outcomeStatus,
      incentiveStatus: evaluation.result.decision === "approved" ? "paid" : "not_eligible",
      paymentStatus: evaluation.result.decision === "approved" ? "auto_executed" : "blocked_by_policy",
      incentiveValue: evaluation.result.amount,
      currency: evaluation.result.currency,
      settlementToken: evaluation.result.settlementToken,
      reason: summarizeReason(evidence, evaluation.result.reasonCodes),
      reasonCodes: evaluation.result.reasonCodes,
      policyId: evaluation.result.policyId,
      policyControls,
      policyCriteria: buildProviderDocumentationPolicyCriteria(evaluation),
      umEvidenceSignature: buildUmEvidenceSignature(record),
      audit,
      walletId: evaluation.result.walletId,
      paymentIntentId: null,
      transactionId: null
    };

    if (evaluation.result.decision !== "approved" || !evaluation.result.walletId) {
      rows.set(event.umRequestId, baseRow);
      await persistence?.saveIncentiveRow(baseRow);
      return baseRow;
    }

    let paymentPolicy: PaymentPlanPolicy | null = null;

    try {
      rows.set(event.umRequestId, baseRow);
      await persistence?.saveIncentiveRow(baseRow);
      paymentPolicy = await paymentPolicyStore.getPolicyForPlan(evidence.planId);
      if (!paymentPolicy) {
        throw new Error("HEDERA_PLAN_POLICY_NOT_FOUND");
      }

      const payment = await executePolicyBoundPayment({
        auditId: audit.id,
        incentiveEvaluationId: event.umRequestId,
        planId: evidence.planId,
        amount: evaluation.result.amount,
        currency: evaluation.result.currency,
        walletId: evaluation.result.walletId,
        policyId: evaluation.result.policyId,
        policyVersion: evaluation.result.policyVersion,
        caseId: event.umRequestId,
        triggerEvent: event.eventType,
        policyControls
      }, {
        paymentIntentStore,
        planPolicy: paymentPolicy,
        businessEvaluationStore: createBusinessEvaluationAttestationStore(
          persistence ?? {
            async getIncentiveRow(incentiveEvaluationId) {
              return (
                rows.get(incentiveEvaluationId) ??
                [...rows.values()].find((row) => row.umRequestId === incentiveEvaluationId) ??
                null
              );
            }
          },
          policyStore
        )
      });
      const paid: IncentiveWorklistRow = {
        ...baseRow,
        paymentIntentId: payment.paymentIntentId,
        transactionId: payment.transactionId,
        audit: {
          ...audit,
          transactionId: payment.transactionId
        }
      };

      rows.set(event.umRequestId, paid);
      await persistence?.saveIncentiveRow(paid);
      await paymentPolicyEvidenceStore?.saveEvidence(
        buildPaymentPolicyEvidence({
          row: paid,
          paymentPolicy,
          outcome: payment.status === "simulated" ? "simulated" : "paid",
          failureCode: null,
          paymentIntentId: payment.paymentIntentId ?? null,
          transactionId: payment.transactionId ?? null
        })
      );
      return paid;
    } catch (error) {
      const existing = rows.get(event.umRequestId) ?? (await persistence?.getIncentiveRow(event.umRequestId)) ?? null;
      if (
        existing &&
        isProviderDocumentationIncentiveRow(existing) &&
        isCurrentIncentiveRow(existing, record) &&
        existing.incentiveStatus === "paid" &&
        existing.transactionId
      ) {
        rows.set(event.umRequestId, existing);
        return existing;
      }

      const failed: IncentiveWorklistRow = {
        ...baseRow,
        incentiveStatus: "payment_failed",
        paymentStatus: "execution_failed",
        reason: "Policy approved, but Hedera transaction execution failed",
        transactionId: null
      };

      rows.set(event.umRequestId, failed);
      await persistence?.saveIncentiveRow(failed);
      if (paymentPolicy) {
        await paymentPolicyEvidenceStore?.saveEvidence(
          buildPaymentPolicyEvidence({
            row: failed,
            paymentPolicy,
            outcome: "blocked",
            failureCode: toPaymentPolicyFailureCode(error),
            paymentIntentId: null,
            transactionId: null
          })
        );
      }
      return failed;
    }
  }

  async function processPlatformEvents(umRequestId?: string): Promise<void> {
    const events = persistence
      ? await persistence.listUmEvents()
      : platform.listEvents();

    for (const event of events) {
      if (event.eventType === "UM_REQUEST_CREATED" && (!umRequestId || event.umRequestId === umRequestId)) {
        try {
          await processEvent(event);
        } catch {
          // Provider submission must not fail because the async incentive layer is unavailable.
        }
      }
    }
  }

  async function getIncentiveRow(umRequestId: string): Promise<IncentiveWorklistRow | null> {
    await processPlatformEvents(umRequestId);
    const row = rows.get(umRequestId) ?? (await persistence?.getIncentiveRow(umRequestId)) ?? null;
    return row && isProviderDocumentationIncentiveRow(row) ? row : null;
  }

  return {
    getCoverageRequirements,
    async submitPriorAuth(input) {
      let record = platform.submitPriorAuth(input);
      if (persistence) {
        let collisionCount = 0;
        while (await persistence.getUmRequest(record.id)) {
          collisionCount += 1;
          if (collisionCount > 100) {
            throw new Error("PAS_CASE_ID_COLLISION_LIMIT_EXCEEDED");
          }

          record = platform.submitPriorAuth(input);
        }

        const evidence = platform.getEvidence(record.id);
        if (!evidence) {
          throw new Error("PAS_EVIDENCE_NOT_AVAILABLE");
        }

        await persistence.savePasSubmission({
          umRequest: record,
          evidence,
          fhirBundle: buildPasFhirBundle(record, evidence)
        });
      }
      await processPlatformEvents(record.id);
      return stripLegacyPaOutcomeFields(record);
    },
    async listUmRequests() {
      const records = persistence ? await persistence.listUmRequests() : platform.listUmRequests();
      return records.map(stripLegacyPaOutcomeFields);
    },
    async listPriorAuths() {
      const records = persistence ? await persistence.listUmRequests() : platform.listUmRequests();
      return records.map(stripLegacyPaOutcomeFields);
    },
    async getEvidence(umRequestId) {
      const record = await getUmRequest(umRequestId);
      if (record) {
        return buildProviderDocumentationEvidence(record);
      }

      return (await persistence?.getEvidence(umRequestId)) ?? platform.getEvidence(umRequestId);
    },
    async listIncentiveRows() {
      await processPlatformEvents();
      const persistedRows = (await persistence?.listIncentiveRows()) ?? [];
      for (const row of persistedRows) {
        if (!isProviderDocumentationIncentiveRow(row)) {
          continue;
        }

        const processedRow = rows.get(row.umRequestId);
        if (processedRow && hasOnlyPaidLifecycleDisplayFieldChanges(row, processedRow)) {
          continue;
        }

        rows.set(row.umRequestId, row);
      }

      return Array.from(rows.values()).sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    },
    getIncentiveRow
  };
}

function isUmRequestCreatedEvent(event: UMPlatformEvent): event is UMPlatformEvent & { eventType: "UM_REQUEST_CREATED" } {
  return event.eventType === "UM_REQUEST_CREATED";
}

export const providerDocumentationWorkflow = createProviderDocumentationWorkflow();

function isProviderDocumentationIncentiveRow(row: IncentiveWorklistRow & { evaluationType?: string }): row is IncentiveWorklistRow {
  return row.evaluationType === undefined || row.evaluationType === "provider_documentation_completeness";
}

function isCurrentIncentiveRow(row: IncentiveWorklistRow, record: PriorAuthRecord): boolean {
  return (
    row.submittedAt === record.submittedAt &&
    row.id === record.id &&
    row.umRequestId === record.id &&
    row.caseId === record.id &&
    row.requestType === record.requestType &&
    row.serviceCode === record.serviceCode &&
    isCurrentUmEvidenceSignature(row, record)
  );
}

function isCurrentUmEvidenceSignature(row: IncentiveWorklistRow, record: UMRequest): boolean {
  return (
    row.umEvidenceSignature === buildUmEvidenceSignature(record) ||
    row.umEvidenceSignature === buildLegacyUmEvidenceSignature(record, row.state, row.outcomeStatus)
  );
}

function refreshIncentiveRowDisplayFields(row: IncentiveWorklistRow, record: UMRequest): IncentiveWorklistRow {
  return {
    ...row,
    id: record.id,
    umRequestId: record.id,
    caseId: record.id,
    planId: record.planId,
    planDisplay: record.planDisplay,
    submittedAt: record.submittedAt,
    providerGroupDisplay: record.providerGroupDisplay,
    requestType: record.requestType,
    serviceLabel: record.serviceLabel,
    serviceCode: record.serviceCode,
    state: record.state,
    outcomeStatus: record.outcomeStatus,
    umEvidenceSignature: buildUmEvidenceSignature(record)
  };
}

function isImmutablePaidIncentiveRow(row: IncentiveWorklistRow): boolean {
  return row.incentiveStatus === "paid" && Boolean(row.transactionId || row.paymentIntentId);
}

function hasIncentiveRowDisplayFieldChanges(left: IncentiveWorklistRow, right: IncentiveWorklistRow): boolean {
  return (
    left.id !== right.id ||
    left.umRequestId !== right.umRequestId ||
    left.caseId !== right.caseId ||
    left.planId !== right.planId ||
    left.planDisplay !== right.planDisplay ||
    left.submittedAt !== right.submittedAt ||
    left.providerGroupDisplay !== right.providerGroupDisplay ||
    left.requestType !== right.requestType ||
    left.serviceLabel !== right.serviceLabel ||
    left.serviceCode !== right.serviceCode ||
    left.state !== right.state ||
    left.outcomeStatus !== right.outcomeStatus ||
    left.umEvidenceSignature !== right.umEvidenceSignature
  );
}

function hasOnlyPaidLifecycleDisplayFieldChanges(left: IncentiveWorklistRow, right: IncentiveWorklistRow): boolean {
  return (
    left.incentiveStatus === "paid" &&
    Boolean(left.transactionId) &&
    left.id === right.id &&
    left.umRequestId === right.umRequestId &&
    left.caseId === right.caseId &&
    left.planId === right.planId &&
    left.planDisplay === right.planDisplay &&
    left.submittedAt === right.submittedAt &&
    left.providerGroupDisplay === right.providerGroupDisplay &&
    left.requestType === right.requestType &&
    left.serviceLabel === right.serviceLabel &&
    left.serviceCode === right.serviceCode &&
    (left.state !== right.state || left.outcomeStatus !== right.outcomeStatus || left.umEvidenceSignature !== right.umEvidenceSignature)
  );
}

function stripLegacyPaOutcomeFields(record: UMRequest): ProviderDocumentationUmRequest {
  const umRequest = { ...record } as ProviderDocumentationUmRequest & {
    paResult?: unknown;
    denialReason?: unknown;
  };

  delete umRequest.paResult;
  delete umRequest.denialReason;

  return umRequest;
}

function buildUmEvidenceSignature(record: UMRequest): string {
  const evidence = buildProviderDocumentationEvidence(record);

  return JSON.stringify({
    id: evidence.id,
    planId: evidence.planId,
    providerId: evidence.providerId,
    requestType: evidence.requestType,
    serviceCode: evidence.serviceCode,
    codingSystem: evidence.codingSystem,
    billingCode: evidence.billingCode,
    coveredBenefit: evidence.coveredBenefit,
    dtrRequested: evidence.dtrRequested,
    dtrCompleted: evidence.dtrCompleted
  });
}

function buildLegacyUmEvidenceSignature(
  record: UMRequest,
  state: UMRequest["state"],
  outcomeStatus: UMRequest["outcomeStatus"]
): string {
  const evidence = buildProviderDocumentationEvidence(record);

  return JSON.stringify({
    id: evidence.id,
    planId: evidence.planId,
    providerId: evidence.providerId,
    requestType: evidence.requestType,
    serviceCode: evidence.serviceCode,
    codingSystem: evidence.codingSystem,
    billingCode: evidence.billingCode,
    coveredBenefit: evidence.coveredBenefit,
    dtrRequested: evidence.dtrRequested,
    dtrCompleted: evidence.dtrCompleted,
    state,
    outcomeStatus
  });
}

function summarizeReason(evidence: ProviderDocumentationEvidence, reasonCodes: string[]): string {
  if (!evidence.coveredBenefit || reasonCodes.includes("BENEFIT_NOT_COVERED")) {
    return "Non-covered benefit";
  }

  if (reasonCodes.length === 0) {
    return "Completed requested DTR";
  }

  if (reasonCodes.includes("DTR_TEMPLATE_INCOMPLETE")) {
    return "Requested DTR incomplete";
  }

  if (reasonCodes.includes("DTR_NOT_REQUESTED")) {
    return "DTR not requested for this policy";
  }

  if (reasonCodes.includes("MANUAL_REVIEW_REQUIRED")) {
    return "Manual settlement review required";
  }

  if (reasonCodes.includes("MULTIPLE_POLICY_MATCHES")) {
    return "Multiple matching policies require configuration review";
  }

  return reasonCodes.join(", ");
}

function buildProviderDocumentationPolicyControls(evaluation: ReturnType<typeof evaluateProviderDocumentationEvent>): string[] {
  const payout = evaluation.policy.payout;
  const requestTypeScope = (evaluation.policy.incentiveScope.eligibleRequestTypes ?? evaluation.policy.incentiveScope.excludedRequestTypes ?? [])
    .map((requestType) => formatRequestType(requestType as RequestType))
    .join(" or ");
  const requestTypeControl = evaluation.policy.incentiveScope.eligibleRequestTypes?.length
    ? `Request type limited to ${requestTypeScope}`
    : `Request type excludes ${requestTypeScope}`;

  return [
    "Allowed submitter and recipient wallet",
    requestTypeControl,
    "Service code limited to policy scope",
    "DTR requested and completed",
    `${payout.amountPerEligibleRequest} ${payout.token} per eligible request`,
    `${payout.monthlyCap} ${payout.token} monthly cap`
  ];
}

function selectProviderDocumentationEvaluation(
  evaluations: Array<ReturnType<typeof evaluateProviderDocumentationEvent>>
): ReturnType<typeof evaluateProviderDocumentationEvent> {
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

function buildProviderDocumentationPolicyCriteria(
  evaluation: ReturnType<typeof evaluateProviderDocumentationEvent>
): PolicyCriterionMatch[] {
  const evidence = evaluation.request.requestObject;
  const reasonCodes = evaluation.result.reasonCodes;
  const expectedWalletId = evaluation.policy.settlement.recipientWalletId;
  const actualWalletId = evaluation.result.walletId ?? "Not assigned";
  const codingGroup = String(evidence.codingSystem).toUpperCase() === "NDC" ? "ndc" : "cpt";
  const scopedServiceCodes =
    evaluation.policy.incentiveScope.includedServiceCodes?.[codingGroup] ??
    evaluation.policy.incentiveScope.excludedServiceCodes?.[codingGroup] ??
    [];
  const expectedServiceCodes = scopedServiceCodes.join(", ");
  const eligibleRequestTypes = evaluation.policy.incentiveScope.eligibleRequestTypes ?? [];
  const excludedRequestTypes = evaluation.policy.incentiveScope.excludedRequestTypes ?? [];
  const usesEligibleRequestTypes = eligibleRequestTypes.length > 0;
  const usesIncludedServiceCodes = Boolean(evaluation.policy.incentiveScope.includedServiceCodes);
  const requestTypeInScope =
    usesEligibleRequestTypes
      ? eligibleRequestTypes.includes(String(evidence.requestType))
      : !excludedRequestTypes.includes(String(evidence.requestType));
  const serviceCodeInScope = usesIncludedServiceCodes
    ? scopedServiceCodes.includes(String(evidence.billingCode)) && !reasonCodes.includes("SERVICE_CODE_NOT_INCLUDED")
    : !scopedServiceCodes.includes(String(evidence.billingCode)) && !reasonCodes.includes("SERVICE_CODE_EXCLUDED");
  const requestTypeReasonCode = usesEligibleRequestTypes ? "REQUEST_TYPE_NOT_ELIGIBLE" : "REQUEST_TYPE_EXCLUDED";
  const serviceCodeReasonCode = usesIncludedServiceCodes ? "SERVICE_CODE_NOT_INCLUDED" : "SERVICE_CODE_EXCLUDED";

  return [
    criterion({
      id: "plan",
      label: "Plan is in the contract pair",
      expected: evaluation.policy.contractPair.planId,
      actual: formatPolicyValue(evidence.planId),
      reasonCode: "PLAN_NOT_IN_CONTRACT",
      passed: evidence.planId === evaluation.policy.contractPair.planId && !reasonCodes.includes("PLAN_NOT_IN_CONTRACT")
    }),
    criterion({
      id: "provider",
      label: "Provider is in the contract pair",
      expected: evaluation.policy.contractPair.providerId,
      actual: evaluation.request.submitter.id,
      reasonCode: "PROVIDER_NOT_IN_CONTRACT",
      passed:
        evaluation.request.submitter.id === evaluation.policy.contractPair.providerId &&
        !reasonCodes.includes("PROVIDER_NOT_IN_CONTRACT")
    }),
    criterion({
      id: "wallet",
      label: "Recipient wallet is approved",
      expected: expectedWalletId,
      actual: actualWalletId,
      reasonCode: "WALLET_NOT_APPROVED",
      passed: expectedWalletId === actualWalletId && !reasonCodes.includes("WALLET_NOT_APPROVED")
    }),
    criterion({
      id: "settlement_token",
      label: "Settlement token is policy-defined",
      expected: evaluation.policy.payout.token,
      actual: evaluation.result.currency,
      reasonCode: "SETTLEMENT_TOKEN_CONFIGURED",
      passed: evaluation.result.currency === evaluation.policy.payout.token
    }),
    criterion({
      id: "requestType",
      label: usesEligibleRequestTypes ? "Request type is eligible" : "Request type is not excluded",
      expected: (usesEligibleRequestTypes ? eligibleRequestTypes : excludedRequestTypes)
        .map((requestType) => formatRequestType(requestType as RequestType))
        .join(" or "),
      actual: formatRequestType(evidence.requestType as RequestType),
      reasonCode: requestTypeReasonCode,
      passed:
        requestTypeInScope &&
        !reasonCodes.includes(requestTypeReasonCode)
    }),
    criterion({
      id: "service_code",
      label: usesIncludedServiceCodes ? "Service code is included" : "Service code is not excluded",
      expected: expectedServiceCodes,
      actual: formatPolicyValue(evidence.billingCode),
      reasonCode: serviceCodeReasonCode,
      passed:
        serviceCodeInScope && !reasonCodes.includes(serviceCodeReasonCode)
    }),
    evidenceCriterion(evidence, "coveredBenefit", "Request is a covered benefit", true, "BENEFIT_NOT_COVERED", reasonCodes),
    evidenceCriterion(evidence, "dtrRequested", "DTR was requested", true, "DTR_NOT_REQUESTED", reasonCodes),
    evidenceCriterion(evidence, "dtrTemplateCompleted", "Requested DTR is complete", true, "DTR_TEMPLATE_INCOMPLETE", reasonCodes)
  ];
}

function buildPaymentPolicyEvidence({
  row,
  paymentPolicy,
  outcome,
  failureCode,
  paymentIntentId,
  transactionId
}: {
  row: IncentiveWorklistRow;
  paymentPolicy: PaymentPlanPolicy;
  outcome: PaymentPolicyEvidenceOutcome;
  failureCode: string | null;
  paymentIntentId: string | null;
  transactionId: string | null;
}): PaymentPolicyEvidence {
  const now = new Date().toISOString();
  const amount = row.incentiveValue;
  const token = row.currency;

  return {
    incentiveEvaluationId: row.umRequestId,
    caseId: row.caseId,
    planId: paymentPolicy.planId,
    paymentPolicyId: paymentPolicy.planId,
    businessPolicyId: row.policyId,
    runtime: "hedera-agent-kit-policy",
    outcome,
    failureCode,
    requestedPayment: {
      amount,
      token,
      recipientWalletId: row.walletId ?? "Not assigned"
    },
    controls: buildPaymentPolicyControlEvidence({
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

function buildPaymentPolicyControlEvidence({
  row,
  paymentPolicy,
  outcome,
  failureCode
}: {
  row: IncentiveWorklistRow;
  paymentPolicy: PaymentPlanPolicy;
  outcome: PaymentPolicyEvidenceOutcome;
  failureCode: string | null;
}): PaymentPolicyControlEvidence[] {
  const amount = row.incentiveValue;
  const token = row.currency;
  const success = outcome === "paid" || outcome === "simulated";

  return [
    {
      id: "businessEvaluationAttestation",
      label: "Business evaluation attestation",
      status: paymentPolicy.businessEvaluationAttestation
        ? controlStatus(failureCode, "BUSINESS_EVALUATION", success || failureCode !== null)
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
        ? isEnvelopeFailure(failureCode)
          ? "failed"
          : success
            ? "passed"
            : "not_run"
        : "not_run",
      failureCode: isEnvelopeFailure(failureCode) ? failureCode ?? undefined : undefined
    }
  ];
}

function controlStatus(
  failureCode: string | null,
  failurePrefix: string,
  evaluated: boolean
): PaymentPolicyControlEvidence["status"] {
  if (!evaluated) {
    return "not_run";
  }

  return failureCode?.startsWith(failurePrefix) ? "failed" : "passed";
}

function isEnvelopeFailure(failureCode: string | null): boolean {
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

function evidenceCriterion(
  evidence: Record<string, unknown>,
  field: string,
  label: string,
  expected: boolean,
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

function formatRequestType(requestType: RequestType): string {
  switch (requestType) {
    case "outpatient_service":
      return "Outpatient Service";
    case "pharmacy_benefit":
      return "Pharmacy Benefit";
    case "inpatient_admission":
      return "Inpatient Admission";
  }
}
