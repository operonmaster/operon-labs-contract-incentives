import { createAuditRecord, type AuditRecord } from "@operon-labs/audit-log";
import { executeApprovedPayment } from "@operon-labs/hedera-executor";
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

export type IncentiveStatus = "eligible_pending_approval" | "not_eligible" | "paid";

export interface IncentiveWorklistRow {
  caseId: string;
  submittedAt: string;
  providerGroupDisplay: string;
  serviceLabel: string;
  serviceCode: ServiceCode;
  paResult: PriorAuthRecord["paResult"];
  denialReason: PriorAuthRecord["denialReason"];
  incentiveStatus: IncentiveStatus;
  incentiveValue: number;
  currency: "USDC";
  reason: string;
  reasonCodes: string[];
  policyId: string;
  audit: AuditRecord;
  walletId: string | null;
  transactionId: string | null;
}

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface ProviderDocumentationWorkflow {
  getCoverageRequirements: typeof getCoverageRequirements;
  submitPriorAuth(input: PriorAuthSubmissionInput): PriorAuthRecord;
  listPriorAuths(): PriorAuthRecord[];
  getEvidence(caseId: string): ProviderDocumentationEvidence | null;
  listIncentiveRows(): IncentiveWorklistRow[];
  getIncentiveRow(caseId: string): IncentiveWorklistRow | null;
  approvePayment(caseId: string): Promise<IncentiveWorklistRow>;
}
/* eslint-enable no-unused-vars */

export function createProviderDocumentationWorkflow(platform: UmPlatform = createInMemoryUmPlatform()): ProviderDocumentationWorkflow {
  const rows = new Map<string, IncentiveWorklistRow>();
  const approvalsInFlight = new Map<string, Promise<IncentiveWorklistRow>>();

  function processEvent(event: PasSubmittedEvent): IncentiveWorklistRow | null {
    const existing = rows.get(event.caseId);
    if (existing) {
      return existing;
    }

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
    const row: IncentiveWorklistRow = {
      caseId: record.caseId,
      submittedAt: record.submittedAt,
      providerGroupDisplay: record.providerGroupDisplay,
      serviceLabel: record.serviceLabel,
      serviceCode: record.serviceCode,
      paResult: record.paResult,
      denialReason: record.denialReason,
      incentiveStatus: evaluation.result.decision === "approved" ? "eligible_pending_approval" : "not_eligible",
      incentiveValue: evaluation.result.amount,
      currency: "USDC",
      reason: summarizeReason(record, evaluation.result.reasonCodes),
      reasonCodes: evaluation.result.reasonCodes,
      policyId: evaluation.result.policyId,
      audit,
      walletId: evaluation.result.walletId,
      transactionId: null
    };

    rows.set(event.caseId, row);
    return row;
  }

  function processPlatformEvents(caseId?: string): void {
    for (const event of platform.listEvents()) {
      if (!caseId || event.caseId === caseId) {
        processEvent(event);
      }
    }
  }

  function getIncentiveRow(caseId: string): IncentiveWorklistRow | null {
    processPlatformEvents(caseId);
    return rows.get(caseId) ?? null;
  }

  return {
    getCoverageRequirements,
    submitPriorAuth(input) {
      return platform.submitPriorAuth(input);
    },
    listPriorAuths() {
      return platform.listPriorAuths();
    },
    getEvidence(caseId) {
      return platform.getEvidence(caseId);
    },
    listIncentiveRows() {
      processPlatformEvents();
      return Array.from(rows.values()).sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    },
    getIncentiveRow,
    async approvePayment(caseId) {
      const existingApproval = approvalsInFlight.get(caseId);
      if (existingApproval) {
        return existingApproval;
      }

      const row = getIncentiveRow(caseId);
      if (row?.incentiveStatus === "paid") {
        return row;
      }

      if (!row || row.incentiveStatus !== "eligible_pending_approval" || !row.walletId) {
        throw new Error("PAYMENT_NOT_ELIGIBLE");
      }

      const walletId = row.walletId;
      const approval = (async () => {
        const payment = await executeApprovedPayment({
          auditId: row.audit.id,
          amount: row.incentiveValue,
          currency: row.currency,
          walletId
        });
        const paid: IncentiveWorklistRow = {
          ...row,
          incentiveStatus: "paid",
          reason: "Hedera transaction recorded",
          transactionId: payment.transactionId,
          audit: {
            ...row.audit,
            transactionId: payment.transactionId
          }
        };

        rows.set(caseId, paid);
        return paid;
      })();

      approvalsInFlight.set(caseId, approval);

      try {
        return await approval;
      } finally {
        approvalsInFlight.delete(caseId);
      }
    }
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
