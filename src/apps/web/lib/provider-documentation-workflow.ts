import { createAuditRecord, type AuditRecord } from "@operon-labs/audit-log";
import { executePolicyBoundPayment } from "@operon-labs/hedera-executor";
import { evaluateProviderDocumentationEvent } from "@operon-labs/incentive-agent";
import {
  buildPasFhirBundle,
  createInMemoryUmPlatform,
  getCoverageRequirements,
  type PasSubmittedEvent,
  type PriorAuthRecord,
  type PriorAuthSubmissionInput,
  type ProviderDocumentationEvidence,
  type RequestType,
  type ServiceCode,
  type UmPlatform
} from "@operon-labs/um-platform";
import { createPasPersistenceStoreFromEnv, type PasPersistenceStore } from "./pas-persistence";

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
  caseId: string;
  submittedAt: string;
  providerGroupDisplay: string;
  requestType: RequestType;
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
  policyCriteria: PolicyCriterionMatch[];
  audit: AuditRecord;
  walletId: string | null;
  transactionId: string | null;
}

/* eslint-disable no-unused-vars -- TypeScript interface method signatures require parameter names. */
export interface ProviderDocumentationWorkflow {
  getCoverageRequirements: typeof getCoverageRequirements;
  submitPriorAuth(input: PriorAuthSubmissionInput): Promise<PriorAuthRecord>;
  listPriorAuths(): Promise<PriorAuthRecord[]>;
  getEvidence(caseId: string): Promise<ProviderDocumentationEvidence | null>;
  listIncentiveRows(): Promise<IncentiveWorklistRow[]>;
  getIncentiveRow(caseId: string): Promise<IncentiveWorklistRow | null>;
}
/* eslint-enable no-unused-vars */

export function createProviderDocumentationWorkflow(
  platform: UmPlatform = createInMemoryUmPlatform(),
  persistence: PasPersistenceStore | undefined = createPasPersistenceStoreFromEnv()
): ProviderDocumentationWorkflow {
  const rows = new Map<string, IncentiveWorklistRow>();
  const settlementsInFlight = new Map<string, Promise<IncentiveWorklistRow | null>>();

  async function processEvent(event: PasSubmittedEvent): Promise<IncentiveWorklistRow | null> {
    const existing = rows.get(event.caseId) ?? (await persistence?.getIncentiveRow(event.caseId)) ?? null;
    if (existing) {
      rows.set(event.caseId, existing);
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
    const record =
      (await persistence?.getPriorAuthRecord(event.caseId)) ??
      platform.listPriorAuths().find((candidate) => candidate.caseId === event.caseId) ??
      null;
    if (!record) {
      return null;
    }
    const evidence = (await persistence?.getEvidence(event.caseId)) ?? platform.getEvidence(event.caseId);
    if (!evidence) {
      return null;
    }

    const evaluation = evaluateProviderDocumentationEvent(
      event,
      { getEvidenceByCaseId: () => evidence, monthToDateAmount: 0 }
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
      requestType: record.requestType,
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
      policyCriteria: buildProviderDocumentationPolicyCriteria(evaluation),
      audit,
      walletId: evaluation.result.walletId,
      transactionId: null
    };

    if (evaluation.result.decision !== "approved" || !evaluation.result.walletId) {
      rows.set(event.caseId, baseRow);
      await persistence?.saveIncentiveRow(baseRow);
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
      await persistence?.saveIncentiveRow(paid);
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
      await persistence?.saveIncentiveRow(failed);
      return failed;
    }
  }

  async function processPlatformEvents(caseId?: string): Promise<void> {
    const events = persistence ? await persistence.listPasEvents() : platform.listEvents();

    for (const event of events) {
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
      if (persistence) {
        const evidence = platform.getEvidence(record.caseId);
        if (!evidence) {
          throw new Error("PAS_EVIDENCE_NOT_AVAILABLE");
        }

        await persistence?.savePriorAuth({
          record,
          evidence,
          fhirBundle: buildPasFhirBundle(record, evidence)
        });
      }
      await processPlatformEvents(record.caseId);
      return record;
    },
    async listPriorAuths() {
      return persistence ? persistence.listPriorAuthRecords() : platform.listPriorAuths();
    },
    async getEvidence(caseId) {
      return (await persistence?.getEvidence(caseId)) ?? platform.getEvidence(caseId);
    },
    async listIncentiveRows() {
      await processPlatformEvents();
      const persistedRows = (await persistence?.listIncentiveRows()) ?? [];
      for (const row of persistedRows) {
        rows.set(row.caseId, row);
      }

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
  "Request type limited to outpatient service or pharmacy benefit",
  "3 USDC max per PA request",
  "300 USDC monthly cap",
  "No PHI or prohibited outcome metrics"
];

function buildProviderDocumentationPolicyCriteria(
  evaluation: ReturnType<typeof evaluateProviderDocumentationEvent>
): PolicyCriterionMatch[] {
  const evidence = evaluation.request.requestObject;
  const reasonCodes = evaluation.result.reasonCodes;

  return [
    criterion({
      id: "submitter_type",
      label: "Submitter type is allowed",
      expected: "provider_admin_team",
      actual: evaluation.request.submitter.type,
      reasonCode: "SUBMITTER_TYPE_NOT_ALLOWED",
      passed: evaluation.request.submitter.type === "provider_admin_team" && !reasonCodes.includes("SUBMITTER_TYPE_NOT_ALLOWED")
    }),
    criterion({
      id: "submitter_id",
      label: "Submitter ID is allowed",
      expected: "lakeside-provider-admin",
      actual: evaluation.request.submitter.id,
      reasonCode: "SUBMITTER_NOT_ALLOWED",
      passed: evaluation.request.submitter.id === "lakeside-provider-admin" && !reasonCodes.includes("SUBMITTER_NOT_ALLOWED")
    }),
    criterion({
      id: "wallet",
      label: "Recipient wallet is approved",
      expected: "0.0.23456",
      actual: reasonCodes.includes("WALLET_NOT_APPROVED") ? "Not assigned" : "0.0.23456",
      reasonCode: "WALLET_NOT_APPROVED",
      passed: !reasonCodes.includes("WALLET_NOT_APPROVED")
    }),
    criterion({
      id: "requestType",
      label: "Request type is eligible",
      expected: "Outpatient Service or Pharmacy Benefit",
      actual: formatRequestType(evidence.requestType as RequestType),
      reasonCode: "REQUEST_TYPE_NOT_ELIGIBLE",
      passed:
        (evidence.requestType === "outpatient_service" || evidence.requestType === "pharmacy_benefit") &&
        !reasonCodes.includes("REQUEST_TYPE_NOT_ELIGIBLE")
    }),
    evidenceCriterion(evidence, "crdCoverageChecked", "Coverage check completed", true, "CRD_COVERAGE_NOT_CHECKED", reasonCodes),
    evidenceCriterion(evidence, "crdCoveredBenefit", "Service is covered benefit", true, "SERVICE_NOT_COVERED", reasonCodes),
    evidenceCriterion(evidence, "dtrTemplateCompleted", "DTR assessment completed", true, "DTR_TEMPLATE_INCOMPLETE", reasonCodes),
    evidenceCriterion(evidence, "attachmentChecklistComplete", "Attachment checklist complete", true, "ATTACHMENT_CHECKLIST_INCOMPLETE", reasonCodes),
    evidenceCriterion(evidence, "fhirFieldsPresent", "Required FHIR fields present", true, "FHIR_FIELDS_MISSING", reasonCodes),
    evidenceCriterion(evidence, "pasSubmitted", "PAS submitted", true, "PAS_NOT_SUBMITTED", reasonCodes),
    evidenceCriterion(
      evidence,
      "submittedBeforeInitialDecision",
      "Submitted before initial decision",
      true,
      "SUBMITTED_AFTER_INITIAL_DECISION",
      reasonCodes
    ),
    evidenceCriterion(
      evidence,
      "paResultUsedForPositivePayment",
      "PA result not used for positive payment",
      false,
      "PROHIBITED_PA_RESULT_METRIC",
      reasonCodes
    ),
    evidenceCriterion(evidence, "approvalOutcomeUsed", "Approval outcome not used", false, "PROHIBITED_OUTCOME_METRIC", reasonCodes),
    evidenceCriterion(
      evidence,
      "referralVolumeMetricUsed",
      "Referral volume metric not used",
      false,
      "PROHIBITED_REFERRAL_VOLUME_METRIC",
      reasonCodes
    ),
    evidenceCriterion(evidence, "containsPhi", "No PHI in policy payload", false, "PHI_BLOCKED", reasonCodes)
  ];
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
