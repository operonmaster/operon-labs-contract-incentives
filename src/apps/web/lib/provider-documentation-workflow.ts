import { createAuditRecord, type AuditRecord } from "@operon-labs/audit-log";
import { executePolicyBoundPayment } from "@operon-labs/hedera-executor";
import { evaluateProviderDocumentationEvent } from "@operon-labs/incentive-agent";
import {
  createInMemoryUmPlatform,
  getCoverageRequirements,
  type PasSubmittedEvent,
  type PriorAuthRecord,
  type PriorAuthSubmissionInput,
  type ProviderDocumentationEvidence,
  type ServiceCode,
  type UmPlatform
} from "@operon-labs/um-platform";

export type IncentiveStatus = "not_eligible" | "paid" | "payment_failed";
export type PaymentStatus = "auto_executed" | "blocked_by_policy" | "execution_failed";

export interface IncentiveWorklistRow {
  caseId: string;
  submittedAt: string;
  providerGroupDisplay: string;
  serviceLabel: string;
  serviceCode: ServiceCode;
  paResult: PriorAuthRecord["paResult"];
  denialReason: PriorAuthRecord["denialReason"];
  incentiveStatus: IncentiveStatus;
  paymentStatus: PaymentStatus;
  incentiveValue: number;
  currency: "USDC";
  reason: string;
  reasonCodes: string[];
  policyId: string;
  policyControls: string[];
  audit: AuditRecord;
  walletId: string | null;
  transactionId: string | null;
}

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface ProviderDocumentationWorkflow {
  getCoverageRequirements: typeof getCoverageRequirements;
  submitPriorAuth(input: PriorAuthSubmissionInput): Promise<PriorAuthRecord>;
  listPriorAuths(): PriorAuthRecord[];
  getEvidence(caseId: string): ProviderDocumentationEvidence | null;
  listIncentiveRows(): Promise<IncentiveWorklistRow[]>;
  getIncentiveRow(caseId: string): Promise<IncentiveWorklistRow | null>;
}
/* eslint-enable no-unused-vars */

export function createProviderDocumentationWorkflow(platform: UmPlatform = createInMemoryUmPlatform()): ProviderDocumentationWorkflow {
  const rows = new Map<string, IncentiveWorklistRow>();
  const settlementsInFlight = new Map<string, Promise<IncentiveWorklistRow | null>>();

  async function processEvent(event: PasSubmittedEvent): Promise<IncentiveWorklistRow | null> {
    const existing = rows.get(event.caseId);
    if (existing) {
      return existing;
    }

    const existingSettlement = settlementsInFlight.get(event.caseId);
    if (existingSettlement) {
      return existingSettlement;
    }

    const settlement = settleEvent(event);
    settlementsInFlight.set(event.caseId, settlement);

    try {
      return await settlement;
    } finally {
      settlementsInFlight.delete(event.caseId);
    }
  }

  async function settleEvent(event: PasSubmittedEvent): Promise<IncentiveWorklistRow | null> {
    const record = platform.listPriorAuths().find((candidate) => candidate.caseId === event.caseId);
    if (!record) {
      return null;
    }

    const evaluation = evaluateProviderDocumentationEvent(
      event,
      { getEvidenceByCaseId: platform.getEvidence, monthToDateAmount: 0 }
    );
    const audit = createAuditRecord({
      request: evaluation.request,
      result: evaluation.result,
      transactionId: null
    });
    const baseRow: IncentiveWorklistRow = {
      caseId: record.caseId,
      submittedAt: record.submittedAt,
      providerGroupDisplay: record.providerGroupDisplay,
      serviceLabel: record.serviceLabel,
      serviceCode: record.serviceCode,
      paResult: record.paResult,
      denialReason: record.denialReason,
      incentiveStatus: evaluation.result.decision === "approved" ? "paid" : "not_eligible",
      paymentStatus: evaluation.result.decision === "approved" ? "auto_executed" : "blocked_by_policy",
      incentiveValue: evaluation.result.amount,
      currency: "USDC",
      reason: summarizeReason(record, evaluation.result.reasonCodes),
      reasonCodes: evaluation.result.reasonCodes,
      policyId: evaluation.result.policyId,
      policyControls: providerDocumentationPolicyControls,
      audit,
      walletId: evaluation.result.walletId,
      transactionId: null
    };

    if (evaluation.result.decision !== "approved" || !evaluation.result.walletId) {
      rows.set(event.caseId, baseRow);
      return baseRow;
    }

    try {
      const payment = await executePolicyBoundPayment({
        auditId: audit.id,
        amount: evaluation.result.amount,
        currency: evaluation.result.currency,
        walletId: evaluation.result.walletId,
        policyId: evaluation.result.policyId,
        policyVersion: evaluation.result.policyVersion,
        triggerEvent: event.eventType,
        policyControls: providerDocumentationPolicyControls
      });
      const paid: IncentiveWorklistRow = {
        ...baseRow,
        transactionId: payment.transactionId,
        audit: {
          ...audit,
          transactionId: payment.transactionId
        }
      };

      rows.set(event.caseId, paid);
      return paid;
    } catch {
      const failed: IncentiveWorklistRow = {
        ...baseRow,
        incentiveStatus: "payment_failed",
        paymentStatus: "execution_failed",
        reason: "Policy approved, but Hedera transaction execution failed",
        transactionId: null
      };

      rows.set(event.caseId, failed);
      return failed;
    }
  }

  async function processPlatformEvents(caseId?: string): Promise<void> {
    for (const event of platform.listEvents()) {
      if (!caseId || event.caseId === caseId) {
        try {
          await processEvent(event);
        } catch {
          // Provider submission must not fail because the async incentive layer is unavailable.
        }
      }
    }
  }

  async function getIncentiveRow(caseId: string): Promise<IncentiveWorklistRow | null> {
    await processPlatformEvents(caseId);
    return rows.get(caseId) ?? null;
  }

  return {
    getCoverageRequirements,
    async submitPriorAuth(input) {
      const record = platform.submitPriorAuth(input);
      await processPlatformEvents(record.caseId);
      return record;
    },
    listPriorAuths() {
      return platform.listPriorAuths();
    },
    getEvidence(caseId) {
      return platform.getEvidence(caseId);
    },
    async listIncentiveRows() {
      await processPlatformEvents();
      return Array.from(rows.values()).sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    },
    getIncentiveRow
  };
}

export const providerDocumentationWorkflow = createProviderDocumentationWorkflow();

function summarizeReason(record: PriorAuthRecord, reasonCodes: string[]): string {
  if (record.denialReason === "BENEFIT_NOT_COVERED") {
    return "Non-covered benefit";
  }

  if (reasonCodes.length === 0) {
    return "Complete DTR + PAS before cutoff";
  }

  if (reasonCodes.includes("DTR_TEMPLATE_INCOMPLETE") || reasonCodes.includes("ATTACHMENT_CHECKLIST_INCOMPLETE")) {
    return "Missing required documentation";
  }

  return reasonCodes.join(", ");
}

const providerDocumentationPolicyControls = [
  "Allowed submitter and recipient wallet",
  "3 USDC max per PA request",
  "300 USDC monthly cap",
  "No PHI or prohibited outcome metrics"
];
