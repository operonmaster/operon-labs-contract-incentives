import { createAuditRecord, type AuditRecord } from "@operon-labs/audit-log";
import {
  buildBusinessEvaluationId,
  buildPaymentIntentId,
  executePolicyBoundPayment,
  type PaymentApprovalRequest,
  type PaymentIntent,
  type PaymentIntentStore
} from "@operon-labs/hedera-executor";
import {
  evaluateAppealsPacketEvent,
  type AppealsPacketEvidence
} from "@operon-labs/incentive-agent";
import type { Currency, SettlementToken } from "@operon-labs/policy-engine";
import {
  createInMemoryUmPlatform,
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
  type BusinessPolicyStatus,
  type PaymentPolicyStatus,
  type PolicyCriterionMatch
} from "./provider-documentation-workflow";
import {
  createAppealsCaseStoreFromEnv,
  type AppealCase,
  type AppealsCaseStore,
  type AppealsIncentiveStatus,
  type AppealsPaymentStatus,
  type AppealsSlaStatus
} from "./appeals-store";
import { umPlatform } from "./um-platform-singleton";

export type AppealEligibilityStatus = "awaiting_determination" | "not_appeal_eligible" | "startable" | "open";

export interface AppealsPriorAuthRow {
  umRequest: UMRequest;
  umRequestId: string;
  planDisplay: string;
  requestType: UMRequest["requestType"];
  serviceLabel: string;
  state: UMRequest["state"];
  outcomeStatus: UMRequest["outcomeStatus"];
  eligibilityStatus: AppealEligibilityStatus;
  canStartAppeal: boolean;
  appealCase: AppealCase | null;
}

export interface StartAppealInput {
  expedited?: boolean;
}

export interface AcknowledgeAppealInput { appealRequestAcknowledged: boolean; }
export interface ValidateAppealIntakeInput { appealRequestPresent: boolean; appellantAuthorized: boolean; planMemberMatched: boolean; requestedServiceMatched: boolean; }
export interface RetrieveOriginalDecisionInput { denialReasonRetrieved: boolean; priorDecisionSummaryIncluded: boolean; coveragePolicyLocated: boolean; }
export interface ResolveMissingInfoInput { missingInfoRequired: boolean; missingInfoRequested: boolean; missingInfoResolved: boolean; }
export interface AssembleAppealPacketInput { requiredDocumentsPresent: boolean; clinicalRationaleIncluded: boolean; policyCitationIncluded: boolean; evidenceIndexComplete: boolean; qualityAuditPassed: boolean; noReworkRequired: boolean; }
export interface IndexAppealEvidenceInput { evidenceIndexComplete: boolean; phiSafeForPaymentMetadata: boolean; }
export interface RouteAppealReviewerInput { reviewerQueueSelected: boolean; reviewerConflictCheckComplete: boolean; }

export interface AppealsPlanAuditRow {
  evaluationType: "appeals_packet_quality";
  appealCase: AppealCase;
  appealId: string;
  umRequestId: string;
  id: string;
  planId: string;
  submitterId: string;
  requestType: UMRequest["requestType"];
  serviceLabel: string;
  state: AppealCase["state"];
  appealReceivedAt: string;
  acknowledgedAt: string | null;
  packetReadyAt: string | null;
  acknowledgementSlaStatus: AppealsSlaStatus;
  packetReadinessSlaStatus: AppealsSlaStatus;
  businessPolicyStatus: BusinessPolicyStatus | null;
  paymentPolicyStatus: PaymentPolicyStatus | null;
  incentiveStatus: AppealsIncentiveStatus;
  paymentStatus: AppealsPaymentStatus;
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

/* eslint-disable no-unused-vars -- Interface method signatures require parameter names. */
export interface AppealsWorkflow {
  listPriorAuthRows(): Promise<AppealsPriorAuthRow[]>;
  listWorkqueue(): Promise<AppealCase[]>;
  listPlanRows(): Promise<AppealsPlanAuditRow[]>;
  startAppeal(umRequestId: string, input: StartAppealInput, now?: Date): Promise<AppealCase>;
  acknowledgeAppeal(appealId: string, input: AcknowledgeAppealInput, now?: Date): Promise<AppealCase>;
  validateIntake(appealId: string, input: ValidateAppealIntakeInput, now?: Date): Promise<AppealCase>;
  retrieveOriginalDecision(appealId: string, input: RetrieveOriginalDecisionInput, now?: Date): Promise<AppealCase>;
  resolveMissingInfo(appealId: string, input: ResolveMissingInfoInput, now?: Date): Promise<AppealCase>;
  assemblePacket(appealId: string, input: AssembleAppealPacketInput, now?: Date): Promise<AppealCase>;
  indexEvidence(appealId: string, input: IndexAppealEvidenceInput, now?: Date): Promise<AppealCase>;
  routeReviewer(appealId: string, input: RouteAppealReviewerInput, now?: Date): Promise<AppealCase>;
}
/* eslint-enable no-unused-vars */

const APPEALS_POLICY_CONTROLS = [
  "Denied PA linked before appeal packet incentive",
  "Appeal receipt starts packet-readiness SLA",
  "Acknowledgement is a sub-SLA milestone",
  "Packet readiness evidence complete",
  "Final appeal outcome excluded from incentive"
];

export function createAppealsWorkflow(
  platform: UmPlatform = createInMemoryUmPlatform(),
  persistence: UmPasPersistenceStore | undefined = createPasPersistenceStoreFromEnv(),
  caseStore: AppealsCaseStore = createAppealsCaseStoreFromEnv(),
  policyStore: PolicyStore = createPolicyStoreFromEnv(),
  paymentIntentStore: PaymentIntentStore | undefined = createPaymentIntentStoreFromEnv(),
  paymentPolicyStore: PaymentPolicyStore = createPaymentPolicyStoreFromEnv(),
  paymentPolicyEvidenceStore: PaymentPolicyEvidenceStore | undefined = createPaymentPolicyEvidenceStoreFromEnv()
): AppealsWorkflow {
  const rows = new Map<string, AppealsPlanAuditRow>();
  const settlementsInFlight = new Map<string, Promise<AppealCase>>();

  async function listRequests(): Promise<UMRequest[]> {
    return persistence ? persistence.listUmRequests() : platform.listUmRequests();
  }

  async function getRequest(umRequestId: string): Promise<UMRequest | null> {
    return (await persistence?.getUmRequest(umRequestId)) ?? platform.getUmRequest(umRequestId);
  }

  async function getCase(appealId: string): Promise<AppealCase> {
    const caseRecord = await caseStore.getCase(appealId);
    if (!caseRecord) {
      throw new Error(`APPEAL_CASE_NOT_FOUND:${appealId}`);
    }

    return caseRecord;
  }

  return {
    async listPriorAuthRows() {
      const [requests, appealCases] = await Promise.all([listRequests(), caseStore.listCases()]);
      const appealByUmRequestId = new Map(appealCases.map((appealCase) => [appealCase.umRequestId, appealCase]));

      return requests
        .map((request) => buildPriorAuthRow(request, appealByUmRequestId.get(request.id) ?? null))
        .sort((left, right) => right.umRequest.submittedAt.localeCompare(left.umRequest.submittedAt));
    },
    async listWorkqueue() {
      return (await caseStore.listCases())
        .filter((caseRecord) => caseRecord.state !== "packet_ready")
        .sort((left, right) => right.appealReceivedAt.localeCompare(left.appealReceivedAt));
    },
    async listPlanRows() {
      const caseRecords = await caseStore.listCases();
      await loadStoredAppealsRows(caseStore, rows);
      await recoverTerminalAppealsRows(caseRecords, {
        rows,
        caseStore,
        policyStore,
        paymentIntentStore,
        paymentPolicyStore,
        paymentPolicyEvidenceStore
      });

      return caseRecords.map((caseRecord) => rows.get(caseRecord.id) ?? buildBaseRow(caseRecord)).sort((left, right) =>
        (right.packetReadyAt ?? right.appealCase.updatedAt).localeCompare(left.packetReadyAt ?? left.appealCase.updatedAt)
      );
    },
    async startAppeal(umRequestId, input, now = new Date()) {
      const appealId = buildAppealId(umRequestId);
      const existing = await caseStore.getCase(appealId);
      if (existing) {
        return existing;
      }

      const request = await getRequest(umRequestId);
      if (!request) {
        throw new Error(`UM_REQUEST_NOT_FOUND:${umRequestId}`);
      }
      if (request.state !== "determined") {
        throw new Error(`PA_NOT_DETERMINED:${umRequestId}`);
      }
      if (request.outcomeStatus !== "denied") {
        throw new Error(`PA_NOT_APPEAL_ELIGIBLE:${umRequestId}`);
      }

      const created = buildCaseFromDeniedRequest(request, Boolean(input.expedited), now);
      await caseStore.saveCase(created);
      return created;
    },
    async acknowledgeAppeal(appealId, input, now = new Date()) {
      const caseRecord = await getCase(appealId);
      assertAppealState(caseRecord, "created");
      if (!input.appealRequestAcknowledged) {
        throw new Error("APPEAL_ACKNOWLEDGEMENT_INCOMPLETE");
      }

      return saveUpdatedCase(caseStore, {
        ...caseRecord,
        state: "acknowledged",
        acknowledgedAt: now.toISOString(),
        updatedAt: now.toISOString()
      });
    },
    async validateIntake(appealId, input, now = new Date()) {
      const caseRecord = await getCase(appealId);
      assertAppealState(caseRecord, "acknowledged");
      if (!input.appealRequestPresent || !input.appellantAuthorized || !input.planMemberMatched || !input.requestedServiceMatched) {
        throw new Error("APPEAL_INTAKE_INCOMPLETE");
      }

      return saveUpdatedCase(caseStore, {
        ...caseRecord,
        state: "intake_validated",
        intake: {
          appealRequestPresent: input.appealRequestPresent,
          appellantAuthorized: input.appellantAuthorized,
          planMemberMatched: input.planMemberMatched,
          requestedServiceMatched: input.requestedServiceMatched
        },
        updatedAt: now.toISOString()
      });
    },
    async retrieveOriginalDecision(appealId, input, now = new Date()) {
      const caseRecord = await getCase(appealId);
      assertAppealState(caseRecord, "intake_validated");
      if (!input.denialReasonRetrieved || !input.priorDecisionSummaryIncluded || !input.coveragePolicyLocated) {
        throw new Error("APPEAL_ORIGINAL_DECISION_INCOMPLETE");
      }

      return saveUpdatedCase(caseStore, {
        ...caseRecord,
        state: "decision_retrieved",
        originalDecision: {
          denialReasonRetrieved: input.denialReasonRetrieved,
          priorDecisionSummaryIncluded: input.priorDecisionSummaryIncluded,
          coveragePolicyLocated: input.coveragePolicyLocated
        },
        updatedAt: now.toISOString()
      });
    },
    async resolveMissingInfo(appealId, input, now = new Date()) {
      const caseRecord = await getCase(appealId);
      assertAppealState(caseRecord, "decision_retrieved");
      if (!input.missingInfoResolved || (input.missingInfoRequired && !input.missingInfoRequested)) {
        throw new Error("APPEAL_MISSING_INFO_UNRESOLVED");
      }

      return saveUpdatedCase(caseStore, {
        ...caseRecord,
        state: "missing_info_resolved",
        missingInfo: {
          missingInfoRequired: input.missingInfoRequired,
          missingInfoRequested: input.missingInfoRequested,
          missingInfoResolved: input.missingInfoResolved
        },
        updatedAt: now.toISOString()
      });
    },
    async assemblePacket(appealId, input, now = new Date()) {
      const caseRecord = await getCase(appealId);
      assertAppealState(caseRecord, "missing_info_resolved");
      if (
        !input.requiredDocumentsPresent ||
        !input.clinicalRationaleIncluded ||
        !input.policyCitationIncluded ||
        !input.qualityAuditPassed ||
        !input.noReworkRequired
      ) {
        throw new Error("APPEAL_PACKET_INCOMPLETE");
      }

      return saveUpdatedCase(caseStore, {
        ...caseRecord,
        state: "packet_assembled",
        packet: {
          requiredDocumentsPresent: input.requiredDocumentsPresent,
          clinicalRationaleIncluded: input.clinicalRationaleIncluded,
          policyCitationIncluded: input.policyCitationIncluded,
          evidenceIndexComplete: input.evidenceIndexComplete,
          qualityAuditPassed: input.qualityAuditPassed,
          noReworkRequired: input.noReworkRequired
        },
        updatedAt: now.toISOString()
      });
    },
    async indexEvidence(appealId, input, now = new Date()) {
      const caseRecord = await getCase(appealId);
      assertAppealState(caseRecord, "packet_assembled");
      if (!input.evidenceIndexComplete || !input.phiSafeForPaymentMetadata) {
        throw new Error("APPEAL_EVIDENCE_INDEX_INCOMPLETE");
      }

      return saveUpdatedCase(caseStore, {
        ...caseRecord,
        state: "evidence_indexed",
        packet: {
          ...caseRecord.packet,
          evidenceIndexComplete: input.evidenceIndexComplete
        },
        updatedAt: now.toISOString()
      });
    },
    async routeReviewer(appealId, input, now = new Date()) {
      const existingSettlement = settlementsInFlight.get(appealId);
      if (existingSettlement) {
        return existingSettlement;
      }

      const settlement = (async () => {
        const caseRecord = await getCase(appealId);
        if (isTerminalAppealCase(caseRecord)) {
          const storedRow = rows.get(caseRecord.id) ?? (await caseStore.getPlanRow(caseRecord.id));
          if (storedRow && isTerminalAppealsRow(storedRow)) {
            rows.set(caseRecord.id, storedRow);
            return caseRecord;
          }
        }

        assertAppealState(caseRecord, "evidence_indexed");
        if (!input.reviewerQueueSelected || !input.reviewerConflictCheckComplete) {
          throw new Error("APPEAL_REVIEWER_ROUTING_INCOMPLETE");
        }

        const timestamp = now.toISOString();
        const updated = {
          ...caseRecord,
          state: "packet_ready" as const,
          packetReadyAt: timestamp,
          routing: {
            reviewerQueueSelected: input.reviewerQueueSelected,
            reviewerConflictCheckComplete: input.reviewerConflictCheckComplete,
            finalDecisionOutsideIncentive: true as const
          },
          updatedAt: timestamp
        };
        const row = await settleAppealPacket(updated, {
          rows,
          caseStore,
          policyStore,
          paymentIntentStore,
          paymentPolicyStore,
          paymentPolicyEvidenceStore
        });
        rows.set(updated.id, row);
        await caseStore.savePlanRow(row);
        await caseStore.saveCase(updated);
        return updated;
      })();
      settlementsInFlight.set(appealId, settlement);

      try {
        return await settlement;
      } finally {
        settlementsInFlight.delete(appealId);
      }
    }
  };
}

export const appealsWorkflow = createAppealsWorkflow(umPlatform);

function buildPriorAuthRow(request: UMRequest, appealCase: AppealCase | null): AppealsPriorAuthRow {
  const eligibilityStatus = buildEligibilityStatus(request, appealCase);
  return {
    umRequest: request,
    umRequestId: request.id,
    planDisplay: request.planDisplay,
    requestType: request.requestType,
    serviceLabel: request.serviceLabel,
    state: request.state,
    outcomeStatus: request.outcomeStatus,
    eligibilityStatus,
    canStartAppeal: eligibilityStatus === "startable",
    appealCase
  };
}

function buildEligibilityStatus(request: UMRequest, appealCase: AppealCase | null): AppealEligibilityStatus {
  if (appealCase) {
    return "open";
  }
  if (request.state !== "determined") {
    return "awaiting_determination";
  }

  return request.outcomeStatus === "denied" ? "startable" : "not_appeal_eligible";
}

function buildAppealId(umRequestId: string): string {
  return umRequestId.replace(/^PA-/, "APL-");
}

function buildCaseFromDeniedRequest(request: UMRequest, expedited: boolean, now: Date): AppealCase {
  const timestamp = now.toISOString();
  return {
    id: buildAppealId(request.id),
    umRequestId: request.id,
    source: "provider_started_from_denied_pa",
    planId: request.planId,
    providerId: request.providerId,
    submitterId: "lakeside-provider-admin",
    requestType: request.requestType,
    serviceCode: request.serviceCode,
    serviceLabel: request.serviceLabel,
    originalOutcomeStatus: "denied",
    originalDenialReasonCode: request.clinicalReview.denialReasonCode,
    state: "created",
    appealReceivedAt: timestamp,
    acknowledgedAt: null,
    packetReadyAt: null,
    packetReadinessSlaHours: expedited ? 4 : 24,
    acknowledgementSlaBusinessHours: 2,
    expedited,
    intake: {
      appealRequestPresent: false,
      appellantAuthorized: false,
      planMemberMatched: false,
      requestedServiceMatched: false
    },
    originalDecision: {
      denialReasonRetrieved: false,
      priorDecisionSummaryIncluded: false,
      coveragePolicyLocated: false
    },
    missingInfo: {
      missingInfoRequired: false,
      missingInfoRequested: false,
      missingInfoResolved: false
    },
    packet: {
      requiredDocumentsPresent: false,
      clinicalRationaleIncluded: false,
      policyCitationIncluded: false,
      evidenceIndexComplete: false,
      qualityAuditPassed: false,
      noReworkRequired: false
    },
    routing: {
      reviewerQueueSelected: false,
      reviewerConflictCheckComplete: false,
      finalDecisionOutsideIncentive: true
    },
    updatedAt: timestamp
  };
}

function buildBaseRow(caseRecord: AppealCase): AppealsPlanAuditRow {
  return {
    evaluationType: "appeals_packet_quality",
    appealCase: structuredClone(caseRecord),
    appealId: caseRecord.id,
    umRequestId: caseRecord.umRequestId,
    id: caseRecord.id,
    planId: caseRecord.planId,
    submitterId: caseRecord.submitterId,
    requestType: caseRecord.requestType,
    serviceLabel: caseRecord.serviceLabel,
    state: caseRecord.state,
    appealReceivedAt: caseRecord.appealReceivedAt,
    acknowledgedAt: caseRecord.acknowledgedAt,
    packetReadyAt: caseRecord.packetReadyAt,
    acknowledgementSlaStatus: buildSlaStatus(caseRecord.appealReceivedAt, caseRecord.acknowledgedAt, caseRecord.acknowledgementSlaBusinessHours),
    packetReadinessSlaStatus: buildSlaStatus(caseRecord.appealReceivedAt, caseRecord.packetReadyAt, caseRecord.packetReadinessSlaHours),
    businessPolicyStatus: null,
    paymentPolicyStatus: null,
    incentiveStatus: "pending",
    paymentStatus: "pending",
    incentiveValue: 0,
    currency: "HBAR",
    settlementToken: { symbol: "HBAR" },
    reason: "Pending appeal packet readiness",
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

async function saveUpdatedCase(caseStore: AppealsCaseStore, caseRecord: AppealCase): Promise<AppealCase> {
  await caseStore.saveCase(caseRecord);
  return caseRecord;
}

function assertAppealState(caseRecord: AppealCase, expected: AppealCase["state"]): void {
  if (caseRecord.state !== expected) {
    throw new Error(`APPEAL_INVALID_STATE:${caseRecord.state}`);
  }
}

function isTerminalAppealCase(caseRecord: AppealCase): boolean {
  return caseRecord.state === "packet_ready";
}

async function settleAppealPacket(
  caseRecord: AppealCase,
  dependencies: {
    rows: Map<string, AppealsPlanAuditRow>;
    caseStore: AppealsCaseStore;
    policyStore: PolicyStore;
    paymentIntentStore: PaymentIntentStore | undefined;
    paymentPolicyStore: PaymentPolicyStore;
    paymentPolicyEvidenceStore: PaymentPolicyEvidenceStore | undefined;
  }
): Promise<AppealsPlanAuditRow> {
  const evidence = buildAppealsPacketEvidence(caseRecord);
  const policies = await dependencies.policyStore.findPolicies({
    evaluationType: "appeals_packet_quality",
    planId: evidence.planId,
    providerId: evidence.submitterId,
    requestType: evidence.requestType,
    submittedAt: caseRecord.appealReceivedAt
  });

  if (policies.length === 0) {
    return {
      ...buildBaseRow(caseRecord),
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      reason: "No matching Appeals packet quality policy",
      reasonCodes: ["POLICY_NOT_FOUND"]
    };
  }

  if (policies.length > 1) {
    return {
      ...buildBaseRow(caseRecord),
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      reason: "Multiple Appeals packet quality policies matched",
      reasonCodes: ["MULTIPLE_POLICY_MATCHES"]
    };
  }

  const evaluation = evaluateAppealsPacketEvent(
    {
      eventType: "APPEAL_PACKET_READY",
      appealId: caseRecord.id,
      umRequestId: caseRecord.umRequestId
    },
    {
      getEvidenceByAppealId: () => evidence,
      policy: policies[0]!,
      monthToDateAmount: 0
    }
  );
  const audit = createAuditRecord({
    request: evaluation.request,
    result: evaluation.result,
    transactionId: null
  });
  const businessPolicyId = evaluation.result.policyId;
  const businessEvaluationId = buildBusinessEvaluationId({
    umRequestId: caseRecord.umRequestId,
    businessPolicyId
  });
  const approved = evaluation.result.decision === "approved";
  const baseRow: AppealsPlanAuditRow = {
    ...buildBaseRow(caseRecord),
    id: businessEvaluationId,
    businessPolicyStatus: approved ? "approved" : "rejected",
    paymentPolicyStatus: approved ? null : "blocked",
    incentiveStatus: approved ? "paid" : "not_eligible",
    paymentStatus: approved ? "auto_executed" : "blocked_by_policy",
    incentiveValue: evaluation.result.amount,
    currency: evaluation.result.currency,
    settlementToken: evaluation.result.settlementToken,
    reason: summarizeAppealsReason(evaluation.result.reasonCodes),
    reasonCodes: [...evaluation.result.reasonCodes],
    policyId: businessPolicyId,
    policyControls: [...APPEALS_POLICY_CONTROLS],
    policyCriteria: buildAppealsPolicyCriteria(evidence, evaluation.result.reasonCodes),
    audit,
    walletId: evaluation.result.walletId
  };

  if (!approved || !evaluation.result.walletId) {
    return baseRow;
  }

  dependencies.rows.set(caseRecord.id, baseRow);

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
      umRequestId: caseRecord.umRequestId,
      caseId: caseRecord.umRequestId,
      incentiveEvaluationId: businessEvaluationId,
      planId: evidence.planId,
      paymentPolicyId: paymentPolicy.planId,
      amount: evaluation.result.amount,
      currency: evaluation.result.currency,
      walletId: evaluation.result.walletId,
      policyId: businessPolicyId,
      businessPolicyId,
      policyVersion: evaluation.result.policyVersion,
      triggerEvent: "APPEAL_PACKET_READY",
      policyControls: [...APPEALS_POLICY_CONTROLS]
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
              const row = dependencies.rows.get(caseRecord.id);
              if (
                lookupUmRequestId !== caseRecord.umRequestId ||
                !row ||
                (lookupBusinessPolicyId && row.policyId !== lookupBusinessPolicyId)
              ) {
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
    const paidIntent = requestedPaymentIntentId
      ? await getSubmittedPaymentIntent(dependencies.paymentIntentStore, requestedPaymentIntentId)
      : null;
    if (paidIntent && paymentPolicy) {
      return buildPaidAppealsRowFromSubmittedIntent({
        baseRow,
        audit,
        paymentPolicy,
        paymentIntent: paidIntent
      });
    }

    const paidRow = await dependencies.caseStore.getPlanRow(caseRecord.id);
    if (paidRow && isImmutablePaidAppealsRow(paidRow)) {
      return paidRow;
    }

    const failedRow: AppealsPlanAuditRow = {
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
    const evidenceRecord = buildAppealsPaymentPolicyEvidence({
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
  const paidRow: AppealsPlanAuditRow = {
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
  const evidenceRecord = buildAppealsPaymentPolicyEvidence({
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

async function loadStoredAppealsRows(
  caseStore: AppealsCaseStore,
  rows: Map<string, AppealsPlanAuditRow>
): Promise<void> {
  for (const row of await caseStore.listPlanRows()) {
    rows.set(row.appealId, row);
  }
}

async function recoverTerminalAppealsRows(
  caseRecords: AppealCase[],
  dependencies: {
    rows: Map<string, AppealsPlanAuditRow>;
    caseStore: AppealsCaseStore;
    policyStore: PolicyStore;
    paymentIntentStore: PaymentIntentStore | undefined;
    paymentPolicyStore: PaymentPolicyStore;
    paymentPolicyEvidenceStore: PaymentPolicyEvidenceStore | undefined;
  }
): Promise<void> {
  for (const caseRecord of caseRecords) {
    if (!isTerminalAppealCase(caseRecord) || dependencies.rows.has(caseRecord.id)) {
      continue;
    }

    const row = await settleAppealPacket(caseRecord, dependencies);
    dependencies.rows.set(caseRecord.id, row);
    await dependencies.caseStore.savePlanRow(row);
  }
}

function isTerminalAppealsRow(row: AppealsPlanAuditRow): boolean {
  return row.businessPolicyStatus !== null && row.paymentPolicyStatus !== null;
}

function isImmutablePaidAppealsRow(row: AppealsPlanAuditRow): boolean {
  return (row.paymentPolicyStatus === "paid" || row.incentiveStatus === "paid") && Boolean(row.transactionId || row.paymentIntentId);
}

/* eslint-disable no-unused-vars -- Interface method signatures require parameter names. */
interface PaymentIntentLookupStore extends PaymentIntentStore {
  getIntent(paymentIntentId: string): Promise<PaymentIntent | null>;
}
/* eslint-enable no-unused-vars */

function hasPaymentIntentLookupStore(store: PaymentIntentStore | undefined): store is PaymentIntentLookupStore {
  return Boolean(store && "getIntent" in store && typeof (store as PaymentIntentLookupStore).getIntent === "function");
}

async function getSubmittedPaymentIntent(
  store: PaymentIntentStore | undefined,
  paymentIntentId: string
): Promise<PaymentIntent | null> {
  if (!hasPaymentIntentLookupStore(store)) {
    return null;
  }

  const intent = await store.getIntent(paymentIntentId);
  return intent?.status === "submitted" && intent.transactionId ? intent : null;
}

function buildPaidAppealsRowFromSubmittedIntent({
  baseRow,
  audit,
  paymentPolicy,
  paymentIntent
}: {
  baseRow: AppealsPlanAuditRow;
  audit: AuditRecord;
  paymentPolicy: PaymentPlanPolicy;
  paymentIntent: PaymentIntent;
}): AppealsPlanAuditRow {
  const paidRow: AppealsPlanAuditRow = {
    ...baseRow,
    paymentPolicyStatus: "paid",
    paymentPolicyId: paymentPolicy.planId,
    paymentIntentId: paymentIntent.id,
    transactionId: paymentIntent.transactionId,
    audit: {
      ...audit,
      transactionId: paymentIntent.transactionId
    }
  };

  return {
    ...paidRow,
    paymentPolicyControls: buildAppealsPaymentPolicyControlEvidence({
      row: paidRow,
      paymentPolicy,
      outcome: "paid",
      failureCode: null
    })
  };
}

function buildAppealsPacketEvidence(caseRecord: AppealCase): AppealsPacketEvidence {
  return {
    appealId: caseRecord.id,
    umRequestId: caseRecord.umRequestId,
    planId: caseRecord.planId,
    submitterId: caseRecord.submitterId,
    requestType: caseRecord.requestType,
    originalOutcomeStatus: caseRecord.originalOutcomeStatus,
    appealReceivedAt: caseRecord.appealReceivedAt,
    acknowledgedAt: caseRecord.acknowledgedAt,
    packetReadyAt: caseRecord.packetReadyAt,
    acknowledgedWithinSla: isWithinSla(caseRecord.appealReceivedAt, caseRecord.acknowledgedAt, caseRecord.acknowledgementSlaBusinessHours),
    packetReadyWithinSla: isWithinSla(caseRecord.appealReceivedAt, caseRecord.packetReadyAt, caseRecord.packetReadinessSlaHours),
    requiredDocumentsPresent: caseRecord.packet.requiredDocumentsPresent,
    clinicalRationaleIncluded: caseRecord.packet.clinicalRationaleIncluded,
    policyCitationIncluded: caseRecord.packet.policyCitationIncluded,
    priorDecisionSummaryIncluded: caseRecord.originalDecision.priorDecisionSummaryIncluded,
    evidenceIndexComplete: caseRecord.packet.evidenceIndexComplete,
    qualityAuditPassed: caseRecord.packet.qualityAuditPassed,
    noReworkRequired: caseRecord.packet.noReworkRequired,
    appealOutcomeUsed: false,
    costSavingsMetricUsed: false,
    denialReversalMetricUsed: false,
    containsPhi: false
  };
}

function summarizeAppealsReason(reasonCodes: string[]): string {
  if (reasonCodes.length === 0) {
    return "Appeal packet ready within SLA";
  }
  if (reasonCodes.includes("ACKNOWLEDGEMENT_SLA_EXCEEDED")) {
    return "Appeal acknowledgement SLA exceeded";
  }
  if (reasonCodes.includes("PACKET_READINESS_SLA_EXCEEDED")) {
    return "Appeal packet readiness SLA exceeded";
  }

  return reasonCodes.join(", ");
}

function buildAppealsPolicyCriteria(
  evidence: AppealsPacketEvidence,
  reasonCodes: string[]
): PolicyCriterionMatch[] {
  return [
    criterion({
      id: "linkedDeniedPa",
      label: "Linked PA denied",
      expected: "Denied",
      actual: evidence.originalOutcomeStatus,
      passed: evidence.originalOutcomeStatus === "denied" && !reasonCodes.includes("LINKED_PA_NOT_DENIED"),
      reasonCode: "LINKED_PA_NOT_DENIED"
    }),
    criterion({
      id: "appealAcknowledgedWithinSla",
      label: "Acknowledgement SLA met",
      expected: "Yes",
      actual: formatYesNo(evidence.acknowledgedWithinSla),
      passed: evidence.acknowledgedWithinSla && !reasonCodes.includes("ACKNOWLEDGEMENT_SLA_EXCEEDED"),
      reasonCode: "ACKNOWLEDGEMENT_SLA_EXCEEDED"
    }),
    criterion({
      id: "appealPacketReadyWithinSla",
      label: "Packet readiness SLA met",
      expected: "Yes",
      actual: formatYesNo(evidence.packetReadyWithinSla),
      passed: evidence.packetReadyWithinSla && !reasonCodes.includes("PACKET_READINESS_SLA_EXCEEDED"),
      reasonCode: "PACKET_READINESS_SLA_EXCEEDED"
    }),
    criterion({
      id: "packetEvidenceComplete",
      label: "Packet evidence complete",
      expected: "Yes",
      actual: formatYesNo(
        evidence.requiredDocumentsPresent &&
        evidence.clinicalRationaleIncluded &&
        evidence.policyCitationIncluded &&
        evidence.priorDecisionSummaryIncluded &&
        evidence.evidenceIndexComplete
      ),
      passed:
        evidence.requiredDocumentsPresent &&
        evidence.clinicalRationaleIncluded &&
        evidence.policyCitationIncluded &&
        evidence.priorDecisionSummaryIncluded &&
        evidence.evidenceIndexComplete,
      reasonCode: "EVIDENCE_INDEX_INCOMPLETE"
    }),
    criterion({
      id: "qualityAuditPassed",
      label: "Quality audit passed",
      expected: "Yes",
      actual: formatYesNo(evidence.qualityAuditPassed),
      passed: evidence.qualityAuditPassed && !reasonCodes.includes("QUALITY_AUDIT_FAILED"),
      reasonCode: "QUALITY_AUDIT_FAILED"
    }),
    criterion({
      id: "outcomeExcluded",
      label: "Final appeal outcome excluded",
      expected: "Yes",
      actual: formatYesNo(!evidence.appealOutcomeUsed && !evidence.costSavingsMetricUsed && !evidence.denialReversalMetricUsed),
      passed:
        !evidence.appealOutcomeUsed &&
        !evidence.costSavingsMetricUsed &&
        !evidence.denialReversalMetricUsed &&
        !reasonCodes.some((reasonCode) => reasonCode.startsWith("PROHIBITED_")),
      reasonCode: "PROHIBITED_APPEAL_OUTCOME_METRIC"
    })
  ];
}

function buildAppealsPaymentPolicyEvidence({
  row,
  paymentPolicy,
  outcome,
  failureCode,
  paymentIntentId,
  transactionId
}: {
  row: AppealsPlanAuditRow;
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
    controls: buildAppealsPaymentPolicyControlEvidence({
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

function buildAppealsPaymentPolicyControlEvidence({
  row,
  paymentPolicy,
  outcome,
  failureCode
}: {
  row: AppealsPlanAuditRow;
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

function buildSlaStatus(startAt: string | null, completedAt: string | null, hours: number): AppealsSlaStatus {
  if (!startAt) {
    return "pending";
  }
  if (!completedAt) {
    return "not_applicable";
  }

  return new Date(completedAt).getTime() <= new Date(startAt).getTime() + hours * 60 * 60 * 1000
    ? "within_sla"
    : "breached";
}

function isWithinSla(startAt: string | null, completedAt: string | null, hours: number): boolean {
  if (!startAt || !completedAt) {
    return false;
  }

  return new Date(completedAt).getTime() <= new Date(startAt).getTime() + hours * 60 * 60 * 1000;
}

function criterion(input: PolicyCriterionMatch): PolicyCriterionMatch {
  return input;
}

function formatYesNo(value: boolean): string {
  return value ? "Yes" : "No";
}
