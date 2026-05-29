import { createAuditRecord, type AuditRecord } from "@operon-labs/audit-log";
import {
  buildBusinessEvaluationId,
  buildPaymentIntentId,
  executePolicyBoundPayment,
  type PaymentIntent,
  type PaymentApprovalRequest,
  type PaymentIntentStore
} from "@operon-labs/hedera-executor";
import {
  evaluateSpecialtyRxFulfillmentEvent,
  type SpecialtyRxFulfillmentEvidence
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
  createSpecialtyRxCaseStoreFromEnv,
  type SpecialtyFulfillmentCase,
  type SpecialtyRxCaseStore
} from "./specialty-rx-store";
import { umPlatform } from "./um-platform-singleton";

export type SpecialtyRxSlaStatus = "pending" | "within_sla" | "breached" | "not_applicable";
export type SpecialtyRxIncentiveStatus = "pending" | "not_eligible" | "paid" | "payment_failed";
export type SpecialtyRxPaymentStatus = "pending" | "auto_executed" | "blocked_by_policy" | "execution_failed";

export interface CompleteIntakeInput {
  prescriptionPresent: boolean;
  assignedPharmacyConfirmed: boolean;
  therapyMetadataPresent: boolean;
  handoffDataComplete: boolean;
}

export interface ClearToFillInput {
  benefitsOrClaimCheckCompleted: boolean;
  prescriptionValid: boolean;
  prescriberClarificationRequired: boolean;
  prescriberClarificationResolved: boolean;
  remsRequired: boolean;
  remsAuthorizationConfirmed: boolean;
  inventoryAvailable: boolean;
  copayOrPaymentReady: boolean;
}

export interface ScheduleShipmentInput {
  patientContactAttemptDocumented: boolean;
  addressConfirmed: boolean;
  deliveryWindowConfirmed: boolean;
  coldChainPackoutValidated: boolean;
  courierScheduled: boolean;
}

export interface ConfirmFulfillmentInput {
  shipped: boolean;
  deliveryConfirmed: boolean;
  deliveryAttemptDocumented: boolean;
  temperatureLogValid: boolean;
  avoidableFulfillmentException: boolean;
  externalBlockerDocumented: boolean;
  exceptionReasonCode: string | null;
}

export interface SpecialtyRxPlanAuditRow {
  evaluationType: "specialty_rx_fulfillment_sla";
  fulfillmentCase: SpecialtyFulfillmentCase;
  fulfillmentCaseId: string;
  umRequestId: string;
  id: string;
  planId: string;
  pharmacyId: string;
  pharmacyDisplay: string;
  requestType: "pharmacy_benefit";
  serviceLabel: string;
  state: SpecialtyFulfillmentCase["state"];
  clearToFillAt: string | null;
  shipmentScheduledAt: string | null;
  deliveryConfirmedAt: string | null;
  scheduleSlaStatus: SpecialtyRxSlaStatus;
  deliverySlaStatus: SpecialtyRxSlaStatus;
  businessPolicyStatus: BusinessPolicyStatus | null;
  paymentPolicyStatus: PaymentPolicyStatus | null;
  incentiveStatus: SpecialtyRxIncentiveStatus;
  paymentStatus: SpecialtyRxPaymentStatus;
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
export interface SpecialtyRxWorkflow {
  listWorkqueue(): Promise<SpecialtyFulfillmentCase[]>;
  listPlanRows(): Promise<SpecialtyRxPlanAuditRow[]>;
  completeIntake(fulfillmentCaseId: string, input: CompleteIntakeInput): Promise<SpecialtyFulfillmentCase>;
  clearToFill(
    fulfillmentCaseId: string,
    input: ClearToFillInput,
    now?: Date
  ): Promise<SpecialtyFulfillmentCase>;
  scheduleShipment(
    fulfillmentCaseId: string,
    input: ScheduleShipmentInput,
    now?: Date
  ): Promise<SpecialtyFulfillmentCase>;
  confirmFulfillment(
    fulfillmentCaseId: string,
    input: ConfirmFulfillmentInput,
    now?: Date
  ): Promise<SpecialtyFulfillmentCase>;
}
/* eslint-enable no-unused-vars */

export const SPECIALTY_PHARMACY_ID = "atlas-specialty-rx";
export const SPECIALTY_PHARMACY_DISPLAY = "Atlas Specialty Rx";
export const SCHEDULE_SLA_HOURS = 24 as const;
export const DELIVERY_SLA_HOURS = 72 as const;

const SPECIALTY_POLICY_CONTROLS = [
  "Approved pharmacy benefit PA linked",
  "Clear-to-fill timestamp starts SLA",
  "Shipment scheduled within SLA",
  "Delivery confirmed within SLA",
  "External blockers excluded from pharmacy reward"
];

export function createSpecialtyRxWorkflow(
  platform: UmPlatform = createInMemoryUmPlatform(),
  persistence: UmPasPersistenceStore | undefined = createPasPersistenceStoreFromEnv(),
  caseStore: SpecialtyRxCaseStore = createSpecialtyRxCaseStoreFromEnv(),
  policyStore: PolicyStore = createPolicyStoreFromEnv(),
  paymentIntentStore: PaymentIntentStore | undefined = createPaymentIntentStoreFromEnv(),
  paymentPolicyStore: PaymentPolicyStore = createPaymentPolicyStoreFromEnv(),
  paymentPolicyEvidenceStore: PaymentPolicyEvidenceStore | undefined = createPaymentPolicyEvidenceStoreFromEnv()
): SpecialtyRxWorkflow {
  const rows = new Map<string, SpecialtyRxPlanAuditRow>();
  const settlementsInFlight = new Map<string, Promise<SpecialtyFulfillmentCase>>();

  async function listRequests(): Promise<UMRequest[]> {
    return persistence ? persistence.listUmRequests() : platform.listUmRequests();
  }

  async function ensureApprovedCases(): Promise<SpecialtyFulfillmentCase[]> {
    const approvedRequests = (await listRequests()).filter(isApprovedPharmacyUmRequest);

    await Promise.all(
      approvedRequests.map(async (request) => {
        const id = buildFulfillmentCaseId(request.id);
        const existing = await caseStore.getCase(id);
        if (!existing) {
          await caseStore.saveCase(buildCaseFromApprovedRequest(request));
        }
      })
    );

    const approvedIds = new Set(approvedRequests.map((request) => buildFulfillmentCaseId(request.id)));
    return (await caseStore.listCases()).filter((caseRecord) => approvedIds.has(caseRecord.id));
  }

  async function getCase(fulfillmentCaseId: string): Promise<SpecialtyFulfillmentCase> {
    const caseRecord = await caseStore.getCase(fulfillmentCaseId);
    if (!caseRecord) {
      throw new Error(`SPECIALTY_FULFILLMENT_CASE_NOT_FOUND:${fulfillmentCaseId}`);
    }

    return caseRecord;
  }

  return {
    async listWorkqueue() {
      return (await ensureApprovedCases())
        .filter((caseRecord) => caseRecord.state !== "fulfilled" && caseRecord.state !== "exception")
        .sort((left, right) => right.intakeStartedAt.localeCompare(left.intakeStartedAt));
    },
    async listPlanRows() {
      const caseRecords = await ensureApprovedCases();
      await loadStoredSpecialtyRows(caseStore, rows);
      await recoverTerminalSpecialtyRows(caseRecords, {
        rows,
        caseStore,
        policyStore,
        paymentIntentStore,
        paymentPolicyStore,
        paymentPolicyEvidenceStore
      });

      return [...rows.values()].sort((left, right) =>
        (right.deliveryConfirmedAt ?? right.fulfillmentCase.updatedAt).localeCompare(
          left.deliveryConfirmedAt ?? left.fulfillmentCase.updatedAt
        )
      );
    },
    async completeIntake(fulfillmentCaseId, input) {
      const caseRecord = await getCase(fulfillmentCaseId);
      if (caseRecord.state !== "intake_triage") {
        throw new Error(`SPECIALTY_RX_INVALID_STATE:${caseRecord.state}`);
      }
      if (
        !input.prescriptionPresent ||
        !input.assignedPharmacyConfirmed ||
        !input.therapyMetadataPresent ||
        !input.handoffDataComplete
      ) {
        throw new Error("SPECIALTY_RX_INTAKE_INCOMPLETE");
      }

      const updated = {
        ...caseRecord,
        state: "clear_to_fill" as const,
        intake: {
          approvedPaLinked: true,
          prescriptionPresent: input.prescriptionPresent,
          assignedPharmacyConfirmed: input.assignedPharmacyConfirmed,
          therapyMetadataPresent: input.therapyMetadataPresent,
          handoffDataComplete: input.handoffDataComplete
        },
        updatedAt: new Date().toISOString()
      };
      await caseStore.saveCase(updated);
      return updated;
    },
    async clearToFill(fulfillmentCaseId, input, now = new Date()) {
      const caseRecord = await getCase(fulfillmentCaseId);
      if (caseRecord.state !== "clear_to_fill") {
        throw new Error(`SPECIALTY_RX_INVALID_STATE:${caseRecord.state}`);
      }
      if (!isClearToFillComplete(input)) {
        throw new Error("SPECIALTY_RX_CLEAR_TO_FILL_INCOMPLETE");
      }

      const timestamp = now.toISOString();
      const updated = {
        ...caseRecord,
        state: "shipment_scheduled" as const,
        clearToFillAt: timestamp,
        clearToFill: { ...input },
        updatedAt: timestamp
      };
      await caseStore.saveCase(updated);
      return updated;
    },
    async scheduleShipment(fulfillmentCaseId, input, now = new Date()) {
      const caseRecord = await getCase(fulfillmentCaseId);
      if (caseRecord.state !== "shipment_scheduled" || !caseRecord.clearToFillAt) {
        throw new Error(`SPECIALTY_RX_NOT_CLEAR_TO_FILL:${caseRecord.id}`);
      }

      const timestamp = now.toISOString();
      const updated = {
        ...caseRecord,
        shipmentScheduledAt: timestamp,
        shipment: {
          ...caseRecord.shipment,
          ...input
        },
        updatedAt: timestamp
      };
      await caseStore.saveCase(updated);
      return updated;
    },
    async confirmFulfillment(fulfillmentCaseId, input, now = new Date()) {
      const existingSettlement = settlementsInFlight.get(fulfillmentCaseId);
      if (existingSettlement) {
        await existingSettlement;
        return getCase(fulfillmentCaseId);
      }

      const settlement = (async () => {
        const caseRecord = await getCase(fulfillmentCaseId);
        if (isTerminalSpecialtyCase(caseRecord)) {
          const storedRow = rows.get(caseRecord.id) ?? (await caseStore.getPlanRow(caseRecord.id));
          if (storedRow && isTerminalSpecialtyRow(storedRow)) {
            rows.set(caseRecord.id, storedRow);
            return caseRecord;
          }

          const recoveredRow = await settleFulfillment(caseRecord, {
            rows,
            caseStore,
            policyStore,
            paymentIntentStore,
            paymentPolicyStore,
            paymentPolicyEvidenceStore
          });
          rows.set(caseRecord.id, recoveredRow);
          await caseStore.savePlanRow(recoveredRow);
          return caseRecord;
        }

        if (caseRecord.state !== "shipment_scheduled" || !caseRecord.clearToFillAt) {
          throw new Error(`SPECIALTY_RX_NOT_READY_FOR_FULFILLMENT:${caseRecord.id}`);
        }

        const timestamp = now.toISOString();
        const isException = input.avoidableFulfillmentException || input.externalBlockerDocumented;
        if (!input.deliveryConfirmed && !isException) {
          throw new Error("SPECIALTY_RX_DELIVERY_NOT_CONFIRMED");
        }

        const updated = {
          ...caseRecord,
          state: isException ? "exception" as const : "fulfilled" as const,
          deliveryConfirmedAt: input.deliveryConfirmed ? timestamp : null,
          exceptionRecordedAt: isException ? timestamp : null,
          fulfillment: { ...input },
          updatedAt: timestamp
        };
        const row = await settleFulfillment(updated, {
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
      settlementsInFlight.set(fulfillmentCaseId, settlement);

      try {
        return await settlement;
      } finally {
        settlementsInFlight.delete(fulfillmentCaseId);
      }
    }
  };
}

export const specialtyRxWorkflow = createSpecialtyRxWorkflow(umPlatform);

function isApprovedPharmacyUmRequest(request: UMRequest): boolean {
  return (
    request.requestType === "pharmacy_benefit" &&
    request.state === "determined" &&
    request.outcomeStatus === "approved"
  );
}

function buildFulfillmentCaseId(umRequestId: string): string {
  return umRequestId.replace(/^PA-/, "RXF-");
}

function buildCaseFromApprovedRequest(request: UMRequest): SpecialtyFulfillmentCase {
  const timestamp = request.determinedAt ?? new Date().toISOString();

  return {
    id: buildFulfillmentCaseId(request.id),
    umRequestId: request.id,
    source: "delegate_um_approved",
    planId: request.planId,
    pharmacyId: SPECIALTY_PHARMACY_ID,
    pharmacyDisplay: SPECIALTY_PHARMACY_DISPLAY,
    requestType: "pharmacy_benefit",
    serviceCode: request.serviceCode,
    serviceLabel: request.serviceLabel,
    codingSystem: "NDC",
    billingCode: request.billingCode,
    state: "intake_triage",
    paApprovalReceivedAt: timestamp,
    intakeStartedAt: timestamp,
    clearToFillAt: null,
    shipmentScheduledAt: null,
    deliveryConfirmedAt: null,
    exceptionRecordedAt: null,
    scheduleSlaHours: SCHEDULE_SLA_HOURS,
    deliverySlaHours: DELIVERY_SLA_HOURS,
    intake: {
      approvedPaLinked: true,
      prescriptionPresent: false,
      assignedPharmacyConfirmed: false,
      therapyMetadataPresent: false,
      handoffDataComplete: false
    },
    clearToFill: {
      benefitsOrClaimCheckCompleted: false,
      prescriptionValid: false,
      prescriberClarificationRequired: false,
      prescriberClarificationResolved: true,
      remsRequired: false,
      remsAuthorizationConfirmed: true,
      inventoryAvailable: false,
      copayOrPaymentReady: false
    },
    shipment: {
      patientContactAttemptDocumented: false,
      addressConfirmed: false,
      deliveryWindowConfirmed: false,
      coldChainRequired: true,
      coldChainPackoutValidated: false,
      courierScheduled: false
    },
    fulfillment: {
      shipped: false,
      deliveryConfirmed: false,
      deliveryAttemptDocumented: false,
      temperatureLogValid: false,
      avoidableFulfillmentException: false,
      externalBlockerDocumented: false,
      exceptionReasonCode: null
    },
    updatedAt: timestamp
  };
}

function isClearToFillComplete(input: ClearToFillInput): boolean {
  return (
    input.benefitsOrClaimCheckCompleted &&
    input.prescriptionValid &&
    (!input.prescriberClarificationRequired || input.prescriberClarificationResolved) &&
    (!input.remsRequired || input.remsAuthorizationConfirmed) &&
    input.inventoryAvailable &&
    input.copayOrPaymentReady
  );
}

function isTerminalSpecialtyCase(caseRecord: SpecialtyFulfillmentCase): boolean {
  return caseRecord.state === "fulfilled" || caseRecord.state === "exception";
}

async function settleFulfillment(
  caseRecord: SpecialtyFulfillmentCase,
  dependencies: {
    rows: Map<string, SpecialtyRxPlanAuditRow>;
    caseStore: SpecialtyRxCaseStore;
    policyStore: PolicyStore;
    paymentIntentStore: PaymentIntentStore | undefined;
    paymentPolicyStore: PaymentPolicyStore;
    paymentPolicyEvidenceStore: PaymentPolicyEvidenceStore | undefined;
  }
): Promise<SpecialtyRxPlanAuditRow> {
  const evidence = buildSpecialtyRxEvidence(caseRecord);
  const policies = await dependencies.policyStore.findPolicies({
    evaluationType: "specialty_rx_fulfillment_sla",
    planId: evidence.planId,
    providerId: evidence.pharmacyId,
    requestType: evidence.requestType,
    submittedAt: caseRecord.clearToFillAt ?? caseRecord.paApprovalReceivedAt
  });

  if (policies.length === 0) {
    return {
      ...buildBaseRow(caseRecord),
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      reason: "No matching Specialty Rx fulfillment SLA policy",
      reasonCodes: ["POLICY_NOT_FOUND"]
    };
  }

  if (policies.length > 1) {
    const evaluation = evaluateSpecialtyRxFulfillmentEvent(
      {
        eventType: "SPECIALTY_FULFILLMENT_COMPLETED",
        fulfillmentCaseId: caseRecord.id,
        umRequestId: caseRecord.umRequestId
      },
      {
        getEvidenceByFulfillmentCaseId: () => evidence,
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
    const businessEvaluationId = buildBusinessEvaluationId({
      umRequestId: caseRecord.umRequestId,
      businessPolicyId: result.policyId
    });

    return {
      ...buildBaseRow(caseRecord),
      id: businessEvaluationId,
      businessPolicyStatus: "rejected",
      paymentPolicyStatus: "blocked",
      incentiveStatus: "not_eligible",
      paymentStatus: "blocked_by_policy",
      incentiveValue: 0,
      currency: result.currency,
      settlementToken: result.settlementToken,
      reason: summarizeSpecialtyRxReason(result.reasonCodes),
      reasonCodes: result.reasonCodes,
      policyId: result.policyId,
      policyControls: [...SPECIALTY_POLICY_CONTROLS],
      policyCriteria: buildSpecialtyRxPolicyCriteria(evidence, result.reasonCodes),
      audit,
      walletId: null
    };
  }

  const evaluation = evaluateSpecialtyRxFulfillmentEvent(
    {
      eventType: "SPECIALTY_FULFILLMENT_COMPLETED",
      fulfillmentCaseId: caseRecord.id,
      umRequestId: caseRecord.umRequestId
    },
    {
      getEvidenceByFulfillmentCaseId: () => evidence,
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
  const baseRow: SpecialtyRxPlanAuditRow = {
    ...buildBaseRow(caseRecord),
    id: businessEvaluationId,
    businessPolicyStatus: approved ? "approved" : "rejected",
    paymentPolicyStatus: approved ? null : "blocked",
    incentiveStatus: approved ? "paid" : "not_eligible",
    paymentStatus: approved ? "auto_executed" : "blocked_by_policy",
    incentiveValue: evaluation.result.amount,
    currency: evaluation.result.currency,
    settlementToken: evaluation.result.settlementToken,
    reason: summarizeSpecialtyRxReason(evaluation.result.reasonCodes),
    reasonCodes: [...evaluation.result.reasonCodes],
    policyId: businessPolicyId,
    policyControls: [...SPECIALTY_POLICY_CONTROLS],
    policyCriteria: buildSpecialtyRxPolicyCriteria(evidence, evaluation.result.reasonCodes),
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
      triggerEvent: "SPECIALTY_FULFILLMENT_COMPLETED",
      policyControls: [...SPECIALTY_POLICY_CONTROLS]
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
      return buildPaidSpecialtyRowFromSubmittedIntent({
        baseRow,
        audit,
        paymentPolicy,
        paymentIntent: paidIntent
      });
    }

    const paidRow = await dependencies.caseStore.getPlanRow(caseRecord.id);
    if (paidRow && isImmutablePaidSpecialtyRow(paidRow)) {
      return paidRow;
    }

    const failedRow: SpecialtyRxPlanAuditRow = {
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
    const evidenceRecord = buildSpecialtyPaymentPolicyEvidence({
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
  const paidRow: SpecialtyRxPlanAuditRow = {
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
  const evidenceRecord = buildSpecialtyPaymentPolicyEvidence({
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

async function loadStoredSpecialtyRows(
  caseStore: SpecialtyRxCaseStore,
  rows: Map<string, SpecialtyRxPlanAuditRow>
): Promise<void> {
  for (const row of await caseStore.listPlanRows()) {
    rows.set(row.fulfillmentCaseId, row);
  }
}

async function recoverTerminalSpecialtyRows(
  caseRecords: SpecialtyFulfillmentCase[],
  dependencies: {
    rows: Map<string, SpecialtyRxPlanAuditRow>;
    caseStore: SpecialtyRxCaseStore;
    policyStore: PolicyStore;
    paymentIntentStore: PaymentIntentStore | undefined;
    paymentPolicyStore: PaymentPolicyStore;
    paymentPolicyEvidenceStore: PaymentPolicyEvidenceStore | undefined;
  }
): Promise<void> {
  for (const caseRecord of caseRecords) {
    if (!isTerminalSpecialtyCase(caseRecord) || dependencies.rows.has(caseRecord.id)) {
      continue;
    }

    const row = await settleFulfillment(caseRecord, dependencies);
    dependencies.rows.set(caseRecord.id, row);
    await dependencies.caseStore.savePlanRow(row);
  }
}

function isTerminalSpecialtyRow(row: SpecialtyRxPlanAuditRow): boolean {
  return row.businessPolicyStatus !== null && row.paymentPolicyStatus !== null;
}

function isImmutablePaidSpecialtyRow(row: SpecialtyRxPlanAuditRow): boolean {
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

function buildPaidSpecialtyRowFromSubmittedIntent({
  baseRow,
  audit,
  paymentPolicy,
  paymentIntent
}: {
  baseRow: SpecialtyRxPlanAuditRow;
  audit: AuditRecord;
  paymentPolicy: PaymentPlanPolicy;
  paymentIntent: PaymentIntent;
}): SpecialtyRxPlanAuditRow {
  const paidRow: SpecialtyRxPlanAuditRow = {
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
    paymentPolicyControls: buildSpecialtyPaymentPolicyControlEvidence({
      row: paidRow,
      paymentPolicy,
      outcome: "paid",
      failureCode: null
    })
  };
}

function buildBaseRow(caseRecord: SpecialtyFulfillmentCase): SpecialtyRxPlanAuditRow {
  return {
    evaluationType: "specialty_rx_fulfillment_sla",
    fulfillmentCase: structuredClone(caseRecord),
    fulfillmentCaseId: caseRecord.id,
    umRequestId: caseRecord.umRequestId,
    id: caseRecord.id,
    planId: caseRecord.planId,
    pharmacyId: caseRecord.pharmacyId,
    pharmacyDisplay: caseRecord.pharmacyDisplay,
    requestType: "pharmacy_benefit",
    serviceLabel: caseRecord.serviceLabel,
    state: caseRecord.state,
    clearToFillAt: caseRecord.clearToFillAt,
    shipmentScheduledAt: caseRecord.shipmentScheduledAt,
    deliveryConfirmedAt: caseRecord.deliveryConfirmedAt,
    scheduleSlaStatus: buildSlaStatus(caseRecord.clearToFillAt, caseRecord.shipmentScheduledAt, SCHEDULE_SLA_HOURS),
    deliverySlaStatus: buildSlaStatus(caseRecord.clearToFillAt, caseRecord.deliveryConfirmedAt, DELIVERY_SLA_HOURS),
    businessPolicyStatus: null,
    paymentPolicyStatus: null,
    incentiveStatus: "pending",
    paymentStatus: "pending",
    incentiveValue: 0,
    currency: "HBAR",
    settlementToken: { symbol: "HBAR" },
    reason: "Pending fulfillment",
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

function buildSpecialtyRxEvidence(caseRecord: SpecialtyFulfillmentCase): SpecialtyRxFulfillmentEvidence {
  return {
    fulfillmentCaseId: caseRecord.id,
    umRequestId: caseRecord.umRequestId,
    planId: caseRecord.planId,
    pharmacyId: caseRecord.pharmacyId,
    requestType: caseRecord.requestType,
    paOutcomeStatus: "approved",
    state: caseRecord.state,
    clearToFillAt: caseRecord.clearToFillAt,
    shipmentScheduledAt: caseRecord.shipmentScheduledAt,
    deliveryConfirmedAt: caseRecord.deliveryConfirmedAt,
    scheduleSlaHours: caseRecord.scheduleSlaHours,
    deliverySlaHours: caseRecord.deliverySlaHours,
    intakeComplete: Object.values(caseRecord.intake).every(Boolean),
    clearToFillComplete: isClearToFillEvidenceComplete(caseRecord),
    shipmentScheduledWithinSla: isWithinSla(caseRecord.clearToFillAt, caseRecord.shipmentScheduledAt, caseRecord.scheduleSlaHours),
    deliveryConfirmedWithinSla: isWithinSla(caseRecord.clearToFillAt, caseRecord.deliveryConfirmedAt, caseRecord.deliverySlaHours),
    remsRequired: caseRecord.clearToFill.remsRequired,
    remsAuthorizationConfirmed: caseRecord.clearToFill.remsAuthorizationConfirmed,
    coldChainRequired: caseRecord.fulfillment.externalBlockerDocumented ? false : caseRecord.shipment.coldChainRequired,
    coldChainPackoutValidated: caseRecord.shipment.coldChainPackoutValidated,
    temperatureLogValid: caseRecord.fulfillment.temperatureLogValid,
    avoidableFulfillmentException: caseRecord.fulfillment.avoidableFulfillmentException,
    externalBlockerDocumented: caseRecord.fulfillment.externalBlockerDocumented,
    drugChoiceMetricUsed: false,
    fillVolumeMetricUsed: false,
    pharmacySteeringMetricUsed: false,
    patientAdherenceMetricUsed: false,
    containsPhi: false
  };
}

function isClearToFillEvidenceComplete(caseRecord: SpecialtyFulfillmentCase): boolean {
  const clearToFill = caseRecord.clearToFill;
  return (
    clearToFill.benefitsOrClaimCheckCompleted &&
    clearToFill.prescriptionValid &&
    clearToFill.prescriberClarificationResolved &&
    clearToFill.remsAuthorizationConfirmed &&
    clearToFill.inventoryAvailable &&
    clearToFill.copayOrPaymentReady
  );
}

function isWithinSla(startAt: string | null, completedAt: string | null, hours: number): boolean {
  if (!startAt || !completedAt) {
    return false;
  }

  return new Date(completedAt).getTime() <= new Date(startAt).getTime() + hours * 60 * 60 * 1000;
}

function buildSlaStatus(startAt: string | null, completedAt: string | null, hours: number): SpecialtyRxSlaStatus {
  if (!startAt) {
    return "pending";
  }
  if (!completedAt) {
    return "not_applicable";
  }

  return isWithinSla(startAt, completedAt, hours) ? "within_sla" : "breached";
}

function summarizeSpecialtyRxReason(reasonCodes: string[]): string {
  if (reasonCodes.length === 0) {
    return "Fulfillment completed within SLA";
  }
  if (reasonCodes.includes("EXTERNAL_BLOCKER_DOCUMENTED")) {
    return "External blocker documented";
  }
  if (reasonCodes.includes("AVOIDABLE_FULFILLMENT_EXCEPTION")) {
    return "Avoidable pharmacy fulfillment exception";
  }
  if (reasonCodes.includes("SHIPMENT_SLA_EXCEEDED")) {
    return "Shipment scheduling missed the SLA";
  }
  if (reasonCodes.includes("DELIVERY_SLA_EXCEEDED")) {
    return "Delivery confirmation missed the SLA";
  }

  return reasonCodes.join(", ");
}

function buildSpecialtyRxPolicyCriteria(
  evidence: SpecialtyRxFulfillmentEvidence,
  reasonCodes: string[]
): PolicyCriterionMatch[] {
  return [
    criterion({
      id: "intakeComplete",
      label: "Intake and triage complete",
      expected: "Yes",
      actual: formatYesNo(evidence.intakeComplete),
      passed: evidence.intakeComplete && !reasonCodes.includes("INTAKE_INCOMPLETE"),
      reasonCode: "INTAKE_INCOMPLETE"
    }),
    criterion({
      id: "clearToFillComplete",
      label: "Clear to fill complete",
      expected: "Yes",
      actual: formatYesNo(evidence.clearToFillComplete),
      passed: evidence.clearToFillComplete && !reasonCodes.includes("CLEAR_TO_FILL_INCOMPLETE"),
      reasonCode: "CLEAR_TO_FILL_INCOMPLETE"
    }),
    criterion({
      id: "shipmentScheduledWithinSla",
      label: "Shipment scheduled within SLA",
      expected: "Yes",
      actual: formatYesNo(evidence.shipmentScheduledWithinSla),
      passed: evidence.shipmentScheduledWithinSla && !reasonCodes.includes("SHIPMENT_SLA_EXCEEDED"),
      reasonCode: "SHIPMENT_SLA_EXCEEDED"
    }),
    criterion({
      id: "deliveryConfirmedWithinSla",
      label: "Delivery confirmed within SLA",
      expected: "Yes",
      actual: formatYesNo(evidence.deliveryConfirmedWithinSla),
      passed:
        (evidence.deliveryConfirmedWithinSla || evidence.externalBlockerDocumented) &&
        !reasonCodes.includes("DELIVERY_SLA_EXCEEDED"),
      reasonCode: "DELIVERY_SLA_EXCEEDED"
    }),
    criterion({
      id: "externalBlocker",
      label: "External blocker is not rewarded",
      expected: "No",
      actual: formatYesNo(evidence.externalBlockerDocumented),
      passed: !evidence.externalBlockerDocumented,
      reasonCode: "EXTERNAL_BLOCKER_DOCUMENTED"
    })
  ];
}

function buildSpecialtyPaymentPolicyEvidence({
  row,
  paymentPolicy,
  outcome,
  failureCode,
  paymentIntentId,
  transactionId
}: {
  row: SpecialtyRxPlanAuditRow;
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
    controls: buildSpecialtyPaymentPolicyControlEvidence({
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

function buildSpecialtyPaymentPolicyControlEvidence({
  row,
  paymentPolicy,
  outcome,
  failureCode
}: {
  row: SpecialtyRxPlanAuditRow;
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

function criterion(input: PolicyCriterionMatch): PolicyCriterionMatch {
  return input;
}

function formatYesNo(value: boolean): string {
  return value ? "Yes" : "No";
}
