import { createAuditRecord, type AuditRecord } from "@operon-labs/audit-log";
import { executePolicyBoundPayment } from "@operon-labs/hedera-executor";
import { evaluateProviderDocumentationEvent } from "@operon-labs/incentive-agent";
import type { Currency, SettlementToken } from "@operon-labs/policy-engine";
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
import { createPolicyStoreFromEnv, type PolicyStore } from "./policy-store";

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
  currency: Currency;
  settlementToken: SettlementToken;
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
  persistence: PasPersistenceStore | undefined = createPasPersistenceStoreFromEnv(),
  policyStore: PolicyStore = createPolicyStoreFromEnv()
): ProviderDocumentationWorkflow {
  const rows = new Map<string, IncentiveWorklistRow>();
  const settlementsInFlight = new Map<string, Promise<IncentiveWorklistRow | null>>();

  async function getPriorAuthRecord(caseId: string): Promise<PriorAuthRecord | null> {
    return (
      (await persistence?.getPriorAuthRecord(caseId)) ??
      platform.listPriorAuths().find((candidate) => candidate.caseId === caseId) ??
      null
    );
  }

  async function processEvent(event: PasSubmittedEvent): Promise<IncentiveWorklistRow | null> {
    const record = await getPriorAuthRecord(event.caseId);
    if (!record) {
      return null;
    }

    const existing = rows.get(event.caseId) ?? (await persistence?.getIncentiveRow(event.caseId)) ?? null;
    if (existing && isCurrentIncentiveRow(existing, record)) {
      rows.set(event.caseId, existing);
      return existing;
    }

    const existingSettlement = settlementsInFlight.get(event.caseId);
    if (existingSettlement) {
      return existingSettlement;
    }

    const settlement = settleEvent(event, record);
    settlementsInFlight.set(event.caseId, settlement);

    try {
      return await settlement;
    } finally {
      settlementsInFlight.delete(event.caseId);
    }
  }

  async function settleEvent(event: PasSubmittedEvent, record: PriorAuthRecord): Promise<IncentiveWorklistRow | null> {
    const evidence = (await persistence?.getEvidence(event.caseId)) ?? platform.getEvidence(event.caseId);
    if (!evidence) {
      return null;
    }

    const policy = await policyStore.getPolicy("provider_documentation_completeness");
    if (!policy) {
      return null;
    }

    const evaluation = evaluateProviderDocumentationEvent(event, {
      getEvidenceByCaseId: () => evidence,
      policy,
      monthToDateAmount: 0
    });
    const policyControls = buildProviderDocumentationPolicyControls(evaluation);
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
      currency: evaluation.result.currency,
      settlementToken: evaluation.result.settlementToken,
      reason: summarizeReason(record, evaluation.result.reasonCodes),
      reasonCodes: evaluation.result.reasonCodes,
      policyId: evaluation.result.policyId,
      policyControls,
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
        caseId: event.caseId,
        triggerEvent: event.eventType,
        policyControls
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
      let record = platform.submitPriorAuth(input);
      if (persistence) {
        let collisionCount = 0;
        while (await persistence.getPriorAuthRecord(record.caseId)) {
          collisionCount += 1;
          if (collisionCount > 100) {
            throw new Error("PAS_CASE_ID_COLLISION_LIMIT_EXCEEDED");
          }

          record = platform.submitPriorAuth(input);
        }

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

function isCurrentIncentiveRow(row: IncentiveWorklistRow, record: PriorAuthRecord): boolean {
  return row.submittedAt === record.submittedAt;
}

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

function buildProviderDocumentationPolicyControls(evaluation: ReturnType<typeof evaluateProviderDocumentationEvent>): string[] {
  const formula = evaluation.policy.paymentFormula;
  const token = formula.token.symbol;

  return [
    "Allowed submitter and recipient wallet",
    "Request type limited to outpatient service or pharmacy benefit",
    `${formula.maxPerRequest} ${token} max per PA request`,
    `${formula.monthlyCap} ${token} monthly cap`,
    "No PHI or prohibited outcome metrics"
  ];
}

function buildProviderDocumentationPolicyCriteria(
  evaluation: ReturnType<typeof evaluateProviderDocumentationEvent>
): PolicyCriterionMatch[] {
  const evidence = evaluation.request.requestObject;
  const reasonCodes = evaluation.result.reasonCodes;
  const expectedWalletId = evaluation.policy.submitterRules.walletMap[evaluation.request.submitter.id] ?? "Not assigned";
  const actualWalletId = evaluation.result.walletId ?? "Not assigned";

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
      expected: expectedWalletId,
      actual: actualWalletId,
      reasonCode: "WALLET_NOT_APPROVED",
      passed: expectedWalletId === actualWalletId && !reasonCodes.includes("WALLET_NOT_APPROVED")
    }),
    criterion({
      id: "settlement_token",
      label: "Settlement token is policy-defined",
      expected: evaluation.policy.paymentFormula.token.symbol,
      actual: evaluation.result.currency,
      reasonCode: "SETTLEMENT_TOKEN_CONFIGURED",
      passed: evaluation.result.currency === evaluation.policy.paymentFormula.token.symbol
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
