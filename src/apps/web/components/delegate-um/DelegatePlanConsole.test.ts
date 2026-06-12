import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DelegatePlanAuditRow } from "../../lib/delegate-um-workflow";
import type { PaymentPolicyControlEvidence } from "../../lib/payment-policy-evidence-store";
import { DelegatePlanAuditDetailsModal } from "./DelegatePlanAuditDetailsModal";
import {
  canViewDelegatePlanDetails,
  DelegatePlanConsole,
  formatDelegateBusinessPolicyTableStatus,
  formatDelegatePaymentPolicyTableStatus
} from "./DelegatePlanConsole";
import { DelegateUseCaseNavigation } from "./DelegateUseCaseNavigation";
import { formatDelegateVendorDisplay, outcomeStatusBadgeVariant } from "./delegate-formatters";

describe("DelegatePlanConsole source", () => {
  it("shows plan SLA and outcome status fields from the delegate plan API", () => {
    const source = readFileSync(path.join(process.cwd(), "src/apps/web/components/delegate-um/DelegatePlanConsole.tsx"), "utf8");

    expect(source).toContain("/api/delegate-um/plan");
    expect(source).toContain("Outcome status");
    expect(source).toContain("SLA");
    expect(source).toContain("DelegatePlanAuditDetailsModal");
    expect(source).toContain("setDetailsUmRequestId(row.umRequestId)");
    expect(source).toContain("View details");
    expect(source).toContain("<th>Action</th>");
    expect(source).toContain('<th className="badge-cell">Business Policy</th>');
    expect(source).toContain('<th className="badge-cell">Payment Policy</th>');
    expect(source).toContain("formatDelegateVendorDisplay(row.delegateVendorId)");
    expect(source).toContain("outcomeStatusBadgeVariant(row.outcomeStatus)");
    expect(source).toContain("formatDelegateBusinessPolicyTableStatus");
    expect(source).toContain("businessPolicyStatusBadgeVariant(status)");
    expect(source).toContain("paymentStatusBadgeVariant(status)");
    expect(source).toContain("colSpan={7}");
    expect(source).not.toContain("colSpan={8}");
    expect(source).not.toContain("<th>Request type</th>");
    expect(source).not.toContain("formatRequestType(row.requestType)");
    expect(source).not.toContain("<th>State</th>");
    expect(source).not.toContain("<td>{formatUmState(row.state)}</td>");
    expect(source).not.toContain('className="panel detail-panel"');
    expect(source).not.toContain("Selected request");
  });

  it("loads delegate plan rows through the shared incentive worklist hook", () => {
    const source = readFileSync(path.join(process.cwd(), "src/apps/web/components/delegate-um/DelegatePlanConsole.tsx"), "utf8");

    expect(source).toContain("useIncentiveWorklist");
    expect(source).toContain('endpoint: "/api/delegate-um/plan"');
    expect(source).toContain("getRowId: (row) => row.umRequestId");
    expect(source).not.toContain("requestedId:");
  });

  it("keeps request ids out of Delegate UM plan navigation URLs", () => {
    const navSource = readFileSync(path.join(process.cwd(), "src/apps/web/components/delegate-um/DelegateUseCaseNavigation.tsx"), "utf8");
    const planPageSource = readFileSync(path.join(process.cwd(), "src/apps/web/app/delegate-um/plan/page.tsx"), "utf8");
    const markup = renderToStaticMarkup(createElement(DelegateUseCaseNavigation, { activeView: "vendor" }));

    expect(navSource).not.toContain('param: "umRequestId"');
    expect(navSource).not.toContain("contextId=");
    expect(planPageSource).not.toContain("searchParams");
    expect(planPageSource).not.toContain("initialUmRequestId");
    expect(markup).toContain('href="/delegate-um/plan"');
    expect(markup).not.toContain("umRequestId=");
  });

  it("leaves unevaluated business and payment policy cells empty in the plan table", () => {
    expect(formatDelegateBusinessPolicyTableStatus(null)).toBeNull();
    expect(formatDelegatePaymentPolicyTableStatus(null)).toBeNull();
    expect(formatDelegateBusinessPolicyTableStatus("approved")).toBe("Approved");
    expect(formatDelegateBusinessPolicyTableStatus("rejected")).toBe("Rejected");
    expect(formatDelegatePaymentPolicyTableStatus("paid")).toBe("Paid");
    expect(formatDelegatePaymentPolicyTableStatus("blocked")).toBe("Blocked");
  });

  it("formats delegate plan table vendor and outcome values for display", () => {
    expect(formatDelegateVendorDisplay("northstar-um")).toBe("Northstar UM");
    expect(formatDelegateVendorDisplay("other-delegate")).toBe("other-delegate");
    expect(outcomeStatusBadgeVariant("approved")).toBe("success");
    expect(outcomeStatusBadgeVariant("denied")).toBe("warning");
    expect(outcomeStatusBadgeVariant(null)).toBe("neutral");
  });

  it("shows delegate plan details only after both policies have executed", () => {
    expect(canViewDelegatePlanDetails({ businessPolicyStatus: null, paymentPolicyStatus: null })).toBe(false);
    expect(canViewDelegatePlanDetails({ businessPolicyStatus: "approved", paymentPolicyStatus: null })).toBe(false);
    expect(canViewDelegatePlanDetails({ businessPolicyStatus: "approved", paymentPolicyStatus: "paid" })).toBe(true);
    expect(canViewDelegatePlanDetails({ businessPolicyStatus: "rejected", paymentPolicyStatus: "blocked" })).toBe(true);
  });

  it("renders delegate policy details with the shared plan audit modal treatment", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/apps/web/components/delegate-um/DelegatePlanAuditDetailsModal.tsx"),
      "utf8"
    );

    expect(source).toContain("LabsModal");
    expect(source).toContain('backdropClassName="audit-modal-backdrop"');
    expect(source).toContain("policy-details-modal");
    expect(source).toContain("delegate-policy-event-modal");
    expect(source).toContain('className="policy-modal-sections payment-policy-modal-sections"');
    expect(source).toContain('labelledBy="delegate-plan-audit-title"');
    expect(source).toContain("Policy Event Audit Details");
    expect(source).toContain("<dt>Delegate vendor</dt>");
    expect(source).toContain("<dt>Business policy status</dt>");
    expect(source).toContain("<dt>Payment policy status</dt>");
    expect(source).toContain("<dt>Amount</dt>");
    expect(source.match(/<dt>Policy ID<\/dt>/g)).toHaveLength(2);
    expect(source.match(/<dt>Audit record<\/dt>/g)).toHaveLength(2);
    expect(source).toContain("row.paymentPolicyId ?? row.planId ?? \"None\"");
    expect(source).toContain("row.paymentIntentId ?? \"None\"");
    expect(source).not.toContain("<dt>Payment policy / plan</dt>");
    expect(source).toContain("Payment policy");
    expect(source).toContain("formatTransaction(row.transactionId)");
    expect(source).toContain("row.policyCriteria.map");
    expect(source).toContain("row.paymentPolicyControls.map");
    // The evidence table now comes from the shared incentive-audit module.
    expect(source).toContain("incentive-audit-evidence");
    expect(source).toContain("EvidenceRows");
    expect(source).not.toContain("<th>Expected</th>");
    expect(source).not.toContain('<th className="badge-cell">Result</th>');
    expect(source).not.toContain("Final outcome");
    expect(source).not.toContain("Delegate UM SLA bonus paid");
    expect(source).not.toContain("Delegate SLA bonus decision");
    expect(source).not.toContain("<dt>Reason</dt>");
    expect(source).not.toContain("Key business checks");
    expect(source).not.toContain("Key payment controls");
    expect(source).not.toContain("Paid the approved");
    expect(source).not.toContain("Business policy approved");
    expect(source).not.toContain("Recipient wallet assigned");
    expect(source).not.toContain("Transaction recorded");
    expect(source).not.toContain("Workflow object");
    expect(source).not.toContain("UMRequest workflow object");
    expect(source).not.toContain("Settlement network");
    expect(source).not.toContain("Hedera testnet");
    expect(source).not.toContain("Payment trace note");
    expect(source).not.toContain("Payment runtime recorded");
    expect(source).not.toContain("Show technical trace");
    expect(source).not.toContain("Show business policy criteria");
    expect(source).not.toContain("Evidence value");
    expect(source).not.toContain("policyControls.map");
    expect(source).not.toContain("<dt>Event</dt>");
    expect(source).not.toContain("<dt>Evidence source</dt>");
    expect(source).not.toContain("<dt>Business policy ID</dt>");
    expect(source).not.toContain("<dt>UM status</dt>");
    expect(source).not.toContain("<dt>Audit ID</dt>");
    expect(source).not.toContain("<dt>Policy guardrails</dt>");
    expect(source).not.toContain("<dt>Payment status</dt>");
    expect(source).not.toContain("<dt>Payment intent</dt>");
    expect(source).not.toContain("<dt>Network</dt>");
    expect(source).not.toContain("<dt>Settlement reason</dt>");
    expect(source).not.toContain("<dt>Runtime evidence</dt>");
    expect(source).not.toMatch(/<dl className="policy-anchor-list">[\s\S]*?<dd className="mono-cell">/);
  });

  it("keeps delegate audit evidence tables responsive inside policy subcards", () => {
    const styles = readFileSync(path.join(process.cwd(), "src/apps/web/app/styles.css"), "utf8");
    const evidenceTableBlock = styles.match(/\.policy-audit-evidence-table\s*\{[^}]+\}/)?.[0] ?? "";
    const actualColumnBlock = styles.match(/\.policy-audit-evidence-actual-column\s*\{[^}]+\}/)?.[0] ?? "";
    const evidenceBadgeCellBlock =
      styles.match(/\.policy-audit-evidence-table \.badge-cell\s*\{[^}]+\}/)?.[0] ?? "";
    const evidenceBadgeBlock =
      styles.match(/\.policy-audit-evidence-table \.badge-cell \.op-badge\s*\{[^}]+\}/)?.[0] ?? "";

    expect(evidenceTableBlock).toContain("min-width: 0");
    expect(evidenceTableBlock).toContain("table-layout: fixed");
    expect(evidenceTableBlock).not.toContain("min-width: 620px");
    expect(actualColumnBlock).toContain("clamp(");
    expect(actualColumnBlock).not.toContain("width: max-content");
    expect(evidenceBadgeCellBlock).toContain("clamp(");
    expect(evidenceBadgeCellBlock).not.toContain("width: 132px");
    expect(evidenceBadgeCellBlock).not.toContain("white-space: nowrap");
    expect(evidenceBadgeBlock).toContain("max-width: 100%");
    expect(evidenceBadgeBlock).toContain("overflow-wrap: anywhere");
  });

  it("renders policy anchor labels and values as inline rows with shared type", () => {
    const styles = readFileSync(path.join(process.cwd(), "src/apps/web/app/styles.css"), "utf8");
    const anchorRowBlock = styles.match(/\.policy-anchor-list div\s*\{[^}]+\}/)?.[0] ?? "";
    const anchorTermBlock = styles.match(/\.policy-anchor-list dt\s*\{[^}]+\}/)?.[0] ?? "";
    const anchorValueBlock = styles.match(/\.policy-anchor-list dd\s*\{[^}]+\}/)?.[0] ?? "";
    const anchorSeparatorBlock = styles.match(/\.policy-anchor-list dt::after\s*\{[^}]+\}/)?.[0] ?? "";

    expect(anchorRowBlock).not.toContain("display: grid");
    expect(anchorRowBlock).toMatch(/display:\s*(inline-flex|flex)/);
    expect(anchorTermBlock).not.toContain("text-transform: uppercase");
    expect(anchorTermBlock).not.toContain("Geist Mono");
    expect(anchorTermBlock).toContain('font-family: var(--op-font-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
    expect(anchorTermBlock).toContain("font-size: 13px");
    expect(anchorValueBlock).toContain('font-family: var(--op-font-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
    expect(anchorValueBlock).toContain("font-size: 13px");
    expect(anchorValueBlock).toContain("overflow-wrap: anywhere");
    expect(anchorSeparatorBlock).toContain('content: ":"');
  });

  it("uses the shared two-label policy status convention in delegate formatters", () => {
    const source = readFileSync(path.join(process.cwd(), "src/apps/web/components/delegate-um/delegate-formatters.ts"), "utf8");

    expect(source).toMatch(/case "approved":\n\s+return "Approved";/);
    expect(source).toMatch(/case "rejected":\n\s+return "Rejected";/);
    expect(source).toMatch(/case "paid":\n\s+return "Paid";/);
    expect(source).toMatch(/case "blocked":\n\s+return "Blocked";/);
    expect(source).not.toContain(["Not", " eligible"].join(""));
    expect(source).not.toContain(["Auto", "-settled"].join(""));
    expect(source).not.toContain(["Blocked", " by policy"].join(""));
  });

  it("renders the plan view shell with loading state and delegate navigation", () => {
    const markup = renderToStaticMarkup(createElement(DelegatePlanConsole));

    expect(markup).toContain("Delegate determination log");
    expect(markup).toContain("Refresh plan view");
    expect(markup).toContain("Loading delegate plan audit rows");
    expect(markup).toContain("/delegate-um/policies");
    expect(markup).toContain("/delegate-um/plan");
    expect(markup).not.toContain("umRequestId=");
  });

  it("separates business policy and payment policy outcomes in the policy event modal", () => {
    const markup = renderToStaticMarkup(
      createElement(DelegatePlanAuditDetailsModal, {
        row: buildDelegatePlanAuditRow({
          businessPolicyStatus: "approved",
          paymentPolicyStatus: "blocked",
          incentiveStatus: "payment_failed",
          paymentStatus: "execution_failed",
          reason: "Policy approved, but Hedera transaction execution failed"
        }),
        onClose: () => undefined
      })
    );

    expect(markup).toContain("Business policy status");
    expect(markup).toContain("Business policy");
    expect(markup).toContain("Payment policy");
    expect(markup).toContain("Policy Event Audit Details");
    expect(markup).not.toContain("Show policy criteria");
    expect(markup).not.toContain("Show business policy criteria");
    expect(markup).not.toContain("Show technical trace");
    expect(markup).toContain("Amount");
    expect(markup).toContain("5.00 HBAR");
    expect(markup).toContain("Blocked");
    expect(markup).not.toContain(["Business policy", " passed"].join(""));
    expect(markup).not.toContain(["Auto", "-settled"].join(""));
    expect(markup).not.toContain(["Blocked", " by policy"].join(""));
    expect(markup).toContain("op-badge op-badge-warning");
    expect(markup).toContain("Wallet");
    expect(markup).toContain("0.0.9049549");
  });

  it("renders delegate policy details using policy criteria and payment control evidence from the row", () => {
    const markup = renderToStaticMarkup(
      createElement(DelegatePlanAuditDetailsModal, {
        row: buildDelegatePlanAuditRow({
          paymentPolicyId: "delegate-um-summit-payment-policy-v1",
          paymentIntentId: "pi_delegate_um_52d91affd996",
          transactionId: "0.0.9049549-1700000000-000000001",
          policyCriteria: [
            {
              id: "clinicalDocumentationReviewed",
              label: "Clinical documentation reviewed",
              expected: "Yes",
              actual: "Yes",
              passed: true,
              reasonCode: "CLINICAL_DOCUMENTATION_NOT_REVIEWED"
            },
            {
              id: "medicalNecessityCriteriaMet",
              label: "Medical necessity criteria met",
              expected: "Yes",
              actual: "No",
              passed: false,
              reasonCode: "MEDICAL_NECESSITY_CRITERIA_NOT_MET"
            },
            {
              id: "planPolicyRequirementsChecked",
              label: "Plan policy requirements checked",
              expected: "Yes",
              actual: "",
              passed: true,
              reasonCode: "PLAN_POLICY_REQUIREMENTS_NOT_CHECKED"
            },
            {
              id: "decisionRationaleDocumented",
              label: "Decision rationale documented",
              expected: "Yes",
              actual: "",
              passed: false,
              reasonCode: "DECISION_RATIONALE_NOT_DOCUMENTED"
            }
          ],
          paymentPolicyControls: [
            ...buildPaymentPolicyControls(),
            {
              id: "paymentAmountLimitExceeded",
              label: "Payment amount limit",
              status: "failed",
              expected: "<= 7 HBAR",
              actual: "6 HBAR",
              failureCode: "PAYMENT_AMOUNT_LIMIT_EXCEEDED"
            },
            {
              id: "paymentSettlementTrace",
              label: "Payment settlement trace",
              status: "not_run",
              expected: "Recorded"
            }
          ]
        }),
        onClose: () => undefined
      })
    );

    expect(markup).toContain("Policy Event Audit Details");
    expect(markup).toContain("PA-260526-1927-CECVCB4C");
    expect(markup).toContain("Summit Health HMO");
    expect(markup).toContain("northstar-um");
    expect(markup).toContain("Wegovy (semaglutide) injection");
    expect(markup).toContain("Approved");
    expect(markup).toContain("delegate-um-summit-pharmacy-sla-bonus-v1");
    expect(markup).toContain("audit_52d91affd996");
    expect(markup).toContain("5.00 HBAR");
    expect(markup).toContain("<dt>Amount</dt>");
    expect(markup).toContain("<dt>Wallet</dt>");
    expect(markup).toContain("https://hashscan.io/testnet/transaction/0.0.9049549-1700000000-000000001");
    expect(markup).toContain("Business Policy");
    expect(markup).toContain("Payment Policy");
    expect(markup.match(/<dt>Policy ID<\/dt>/g)).toHaveLength(2);
    expect(markup.match(/<dt>Audit record<\/dt>/g)).toHaveLength(2);
    expect(markup).toContain("<dt>Policy ID</dt><dd>delegate-um-summit-pharmacy-sla-bonus-v1</dd>");
    expect(markup).toContain("<dt>Audit record</dt><dd>audit_52d91affd996</dd>");
    expect(markup).toContain("<dt>Policy ID</dt><dd>delegate-um-summit-payment-policy-v1</dd>");
    expect(markup).toContain("<dt>Audit record</dt><dd>pi_delegate_um_52d91affd996</dd>");
    expect(markup).not.toContain('<dd class="mono-cell">delegate-um-summit-pharmacy-sla-bonus-v1</dd>');
    expect(markup).not.toContain('<dd class="mono-cell">audit_52d91affd996</dd>');
    expect(markup).not.toContain('<dd class="mono-cell">delegate-um-summit-payment-policy-v1</dd>');
    expect(markup).not.toContain('<dd class="mono-cell">pi_delegate_um_52d91affd996</dd>');
    expect(markup).toContain("delegate-um-summit-payment-policy-v1");
    expect(markup).toContain("pi_delegate_um_52d91affd996");
    expect(markup).not.toContain("<dt>Payment policy / plan</dt>");
    expect(markup).toContain("Criterion/Control");
    expect(markup).toContain("Expected: Yes");
    expect(markup).toContain("Expected: &lt;= 7 HBAR");
    expect(markup).toContain("Expected: Recorded");
    expect(markup).not.toContain("Expected: Not recorded");
    expect(markup).toContain("Actual");
    expect(markup).not.toContain("<th>Expected</th>");
    expect(markup).not.toContain("<th>Result</th>");
    expect(markup).not.toContain('<th class="badge-cell">Result</th>');
    expect(markup).not.toContain("UM request is determined");
    expect(markup).not.toContain("Outcome status is present");
    expect(markup).not.toContain("Outcome value affects payment");
    expect(markup).not.toContain("outcomeNotPaymentMetric");
    expect(markup).not.toContain("PROHIBITED_OUTCOME_METRIC");
    expect(markup).toContain("Clinical documentation reviewed");
    expect(markup).toContain("Medical necessity criteria met");
    expect(markup).toContain('<span class="op-badge op-badge-success">Yes</span>');
    expect(markup).toContain('<span class="op-badge op-badge-warning">No</span>');
    expect(markup).toContain("Plan policy requirements checked");
    expect(markup).toContain("Decision rationale documented");
    expect(markup).toContain('<span class="op-badge op-badge-success">Verified</span>');
    expect(markup).toContain('<span class="op-badge op-badge-warning">Not verified</span>');
    expect(markup).not.toContain("CLINICAL_DOCUMENTATION_NOT_REVIEWED");
    expect(markup).not.toContain("MEDICAL_NECESSITY_CRITERIA_NOT_MET");
    expect(markup).not.toContain("Completed within SLA");
    expect(markup).toContain("Business evaluation attestation");
    expect(markup).toContain("Payment token");
    expect(markup).toContain("Max payment per request");
    expect(markup).toContain("Duplicate payment prevention");
    expect(markup).toContain("Payment envelope integrity");
    expect(markup).toContain("5 HBAR");
    expect(markup).toContain('<span class="op-badge op-badge-success">HBAR</span>');
    expect(markup).toContain('<span class="op-badge op-badge-success">5 HBAR</span>');
    expect(markup).toContain('<span class="op-badge op-badge-warning">6 HBAR</span>');
    expect(markup).toContain("Payment settlement trace");
    expect(markup).toContain('<span class="op-badge op-badge-warning">Not verified</span>');
    expect(markup).not.toContain('<span class="op-badge op-badge-warning">Not recorded</span>');
    expect(markup).not.toContain('<span class="op-badge op-badge-neutral">Not recorded</span>');
    expect(markup).not.toContain("PAYMENT_AMOUNT_LIMIT_EXCEEDED");
    expect(markup).not.toContain("Passed");

    expect(markup).not.toContain("Final outcome");
    expect(markup).not.toContain("Delegate UM SLA bonus paid");
    expect(markup).not.toContain("Delegate SLA bonus decision");
    expect(markup).not.toContain("<dt>Reason</dt>");
    expect(markup).not.toContain("Key business checks");
    expect(markup).not.toContain("Key payment controls");
    expect(markup).not.toContain("Paid the approved");
    expect(markup).not.toContain("Business policy approved");
    expect(markup).not.toContain("Recipient wallet assigned");
    expect(markup).not.toContain("Recipient wallet is approved");
    expect(markup).not.toContain("Request type is eligible");
    expect(markup).not.toContain("Plan is in the delegate contract");
    expect(markup).not.toContain("Delegate vendor is in the contract");
    expect(markup).not.toContain("PAS audit reference is available");
    expect(markup).not.toContain("Transaction recorded");
    expect(markup).not.toContain("Workflow object");
    expect(markup).not.toContain("UMRequest workflow object");
    expect(markup).not.toContain("Settlement network");
    expect(markup).not.toContain("Hedera testnet");
    expect(markup).not.toContain("Payment trace note");
    expect(markup).not.toContain("Payment runtime recorded");
    expect(markup).not.toContain("Show technical trace");
    expect(markup).not.toContain("Show business policy criteria");
    expect(markup).not.toContain("<dt>Event</dt>");
    expect(markup).not.toContain("<dt>Evidence source</dt>");
    expect(markup).not.toContain("<dt>Policy guardrails</dt>");
    expect(markup).not.toContain("<dt>Payment intent</dt>");
    expect(markup).not.toContain("<dt>Runtime evidence</dt>");

    expect(markup).toContain("<dt>Business policy status</dt>");
    expect(markup).toContain("<dt>Payment policy status</dt>");
    expect(policyEventSectionHeading(markup, "Business Policy")).not.toContain("Approved");
    expect(policyEventSectionHeading(markup, "Payment Policy")).not.toContain("Paid");
  });
});

function policyEventSectionHeading(markup: string, title: string) {
  const headingMatch = markup.match(
    new RegExp(`<div class="policy-event-section-heading">[\\s\\S]*?<h3[^>]*>${title}</h3>[\\s\\S]*?</div></div>`)
  );

  expect(headingMatch, `Expected ${title} policy-event-section-heading to render`).not.toBeNull();
  return headingMatch?.[0] ?? "";
}

function buildDelegatePlanAuditRow(
  overrides: Partial<DelegatePlanAuditRow> & {
    paymentPolicyControls?: PaymentPolicyControlEvidence[];
    paymentPolicyId?: string | null;
  } = {}
): DelegatePlanAuditRow {
  const umRequest = {
    id: "PA-260526-1927-CECVCB4C",
    source: "pas_fhir",
    sourceCaseId: "PA-260526-1927-CECVCB4C",
    caseId: "PA-260526-1927-CECVCB4C",
    patientId: "patient-andre-williams",
    patientDisplay: "Andre Williams",
    planId: "summit-health-hmo",
    planDisplay: "Summit Health HMO",
    providerId: "lakeside-provider-admin",
    providerDisplay: "Lakeside Provider Admin",
    providerGroupId: "lakeside-provider-admin",
    providerGroupDisplay: "Lakeside Provider Admin",
    delegateVendorId: "northstar-um",
    requestType: "pharmacy_benefit",
    serviceCode: "wegovy_semaglutide",
    serviceLabel: "Wegovy (semaglutide) injection",
    codingSystem: "NDC",
    billingCode: "0169-4525-14",
    submittedAt: "2026-05-27T02:27:36.330Z",
    pendStartedAt: "2026-05-27T02:27:36.330Z",
    reviewStartedAt: "2026-05-27T06:10:16.998Z",
    determinedAt: "2026-05-27T06:10:18.621Z",
    slaDeadlineAt: "2026-05-28T02:27:36.330Z",
    slaHours: 24,
    state: "determined",
    outcomeStatus: "approved",
    coverage: {
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide",
      serviceLabel: "Wegovy (semaglutide) injection",
      codingSystem: "NDC",
      billingCode: "0169-4525-14",
      coveredBenefit: true,
      priorAuthRequired: true,
      documentationTemplateId: "pharmacy-weight-management-pa-v1",
      requiredDocumentation: ["diagnosis and indication"],
      reasonCode: null
    },
    dtr: null,
    dtrQuestionnaireResponse: null,
    documentation: {
      coverageChecked: true,
      coveredBenefit: true,
      dtrRequested: true,
      dtrCompleted: false,
      attachmentChecklistComplete: false,
      fhirFieldsPresent: false
    },
    clinicalReview: {
      reviewerId: "delegate-reviewer",
      clinicalDocumentationReviewed: true,
      medicalNecessityCriteriaMet: true,
      planPolicyRequirementsChecked: true,
      decisionRationaleDocumented: true,
      approvalReasonCode: "POLICY_CRITERIA_MET",
      denialReasonCode: null
    },
    auditRefs: {
      pasClaimBundleId: "PA-260526-1927-CECVCB4C",
      pasClaimResponseBundleId: null
    },
    pasSubmitted: true,
    submittedBeforeInitialDecision: true
  } satisfies DelegatePlanAuditRow["umRequest"];

  return {
    evaluationType: "delegate_um_sla_bonus",
    umRequest,
    umRequestId: umRequest.id,
    id: umRequest.id,
    planId: umRequest.planId,
    planDisplay: umRequest.planDisplay,
    delegateVendorId: "northstar-um",
    requestType: "pharmacy_benefit",
    serviceLabel: umRequest.serviceLabel,
    submittedAt: umRequest.submittedAt,
    pendStartedAt: umRequest.pendStartedAt,
    slaDeadlineAt: umRequest.slaDeadlineAt,
    determinedAt: umRequest.determinedAt,
    timeRemainingMs: 0,
    state: "determined",
    outcomeStatus: "approved",
    slaStatus: "within_sla",
    businessPolicyStatus: "approved",
    paymentPolicyStatus: "paid",
    incentiveStatus: "paid",
    paymentStatus: "auto_executed",
    incentiveValue: 5,
    currency: "HBAR",
    settlementToken: { symbol: "HBAR" },
    reason: "Determination completed within SLA",
    reasonCodes: [],
    policyId: "delegate-um-summit-pharmacy-sla-bonus-v1",
    policyControls: ["Allowed delegate vendor wallet", "Determination completed within SLA"],
    policyCriteria: [
      {
        id: "plan",
        label: "Plan is in the delegate contract",
        expected: "summit-health-hmo",
        actual: "summit-health-hmo",
        passed: true,
        reasonCode: "PLAN_NOT_IN_CONTRACT"
      }
    ],
    paymentPolicyId: umRequest.planId,
    paymentPolicyControls: buildPaymentPolicyControls(),
    audit: {
      id: "audit_52d91affd996",
      requestHash: "52d91affd996",
      policyId: "delegate-um-summit-pharmacy-sla-bonus-v1",
      policyVersion: "v1",
      decision: "approved",
      reasonCodes: [],
      transactionId: null,
      createdAt: "2026-05-27T06:10:19.551Z"
    },
    walletId: "0.0.9049549",
    paymentIntentId: null,
    transactionId: null,
    ...overrides
  } as DelegatePlanAuditRow;
}

function buildPaymentPolicyControls(): PaymentPolicyControlEvidence[] {
  return [
    {
      id: "businessEvaluationAttestation",
      label: "Business evaluation attestation",
      status: "passed"
    },
    {
      id: "paymentToken",
      label: "Payment token",
      status: "passed",
      expected: "HBAR",
      actual: "HBAR"
    },
    {
      id: "maxPaymentPerRequest",
      label: "Max payment per request",
      status: "passed",
      expected: "<= 7 HBAR",
      actual: "5 HBAR"
    },
    {
      id: "duplicatePaymentPrevention",
      label: "Duplicate payment prevention",
      status: "passed"
    },
    {
      id: "paymentEnvelopeIntegrity",
      label: "Payment envelope integrity",
      status: "passed"
    }
  ];
}
