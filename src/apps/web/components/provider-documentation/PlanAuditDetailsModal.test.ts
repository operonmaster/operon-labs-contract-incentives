import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createProviderDocumentationWorkflow,
  type IncentiveWorklistRow
} from "../../lib/provider-documentation-workflow";
import {
  businessPolicyBadgeVariant,
  formatPaymentStatus,
  formatStatus,
  PlanAuditDetailsModal
} from "./PlanAuditDetailsModal";
import {
  formatBusinessPolicyOutcome,
  formatPaymentPolicyOutcome
} from "./PlanIncentivesConsole";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const IMPLEMENTATION_GUARDRAIL_CRITERIA = [
  "Plan is in the contract pair",
  "Provider is in the contract pair",
  "Recipient wallet is approved",
  "Settlement token is policy-defined"
] as const;

describe("plan audit details modal", () => {
  it("renders provider incentive details with the policy event audit modal format", () => {
    const markup = renderToStaticMarkup(
      createElement(PlanAuditDetailsModal, {
        row: buildIncentiveWorklistRow({
          businessPolicyStatus: "approved",
          paymentPolicyStatus: "paid",
          policyId: "provider-documentation-completeness-v1",
          paymentPolicyId: "acme-health-ppo",
          policyCriteria: [
            {
              id: "dtr_complete",
              label: "Requested DTR is complete",
              expected: "true",
              actual: "",
              passed: true,
              reasonCode: "DTR_TEMPLATE_INCOMPLETE"
            },
            {
              id: "covered_benefit",
              label: "Request is a covered benefit",
              expected: "true",
              actual: "",
              passed: false,
              reasonCode: "BENEFIT_NOT_COVERED"
            }
          ],
          paymentPolicyControls: [
            { id: "businessEvaluationAttestation", label: "Business evaluation attestation", status: "passed" },
            { id: "paymentToken", label: "Payment token", status: "passed", expected: "HBAR", actual: "HBAR" },
            { id: "maxPaymentPerRequest", label: "Max payment per request", status: "passed", expected: "<= 7 HBAR", actual: "5 HBAR" },
            { id: "duplicatePaymentPrevention", label: "Duplicate payment prevention", status: "passed" },
            { id: "paymentEnvelopeIntegrity", label: "Payment envelope integrity", status: "passed" }
          ]
        }),
        onClose: () => undefined
      })
    );

    expect(markup).toContain("Policy Event Audit Details");
    expect(markup).toContain("policy-event-context-line");
    expect(markup).toContain("policy-event-outcome-strip");
    expect(markup.match(/policy-anchor-list/g)).toHaveLength(2);
    expect(markup.match(/<dt>Policy ID<\/dt><dd>/g)).toHaveLength(2);
    expect(markup.match(/<dt>Audit record<\/dt><dd>/g)).toHaveLength(2);
    expect(markup).not.toContain("<dt>Policy ID</dt><dd class=\"mono-cell\"");
    expect(markup).not.toContain("<dt>Audit record</dt><dd class=\"mono-cell\"");

    [
      "Event",
      "Evidence source",
      "Business policy ID",
      "Audit ID",
      "Payment intent",
      "Reason codes",
      "Network",
      "Policy guardrails"
    ].forEach((label) => {
      expect(markup).not.toContain(`<dt>${label}</dt>`);
    });

    expect(markup).toContain("Criterion/Control");
    expect(markup).toContain("Expected: true");
    expect(markup).toContain("Actual");
    expect(markup).toContain(">Verified<");
    expect(markup).toContain(">Not verified<");
    expect(markup).toContain("Business evaluation attestation");
    expect(markup).toContain("Payment token");
    expect(markup).toContain("Max payment per request");
    expect(markup).toContain("Duplicate payment prevention");
    expect(markup).toContain("Payment envelope integrity");
    expect(markup).not.toContain("DTR_TEMPLATE_INCOMPLETE");
    expect(markup).not.toContain("BENEFIT_NOT_COVERED");
  });

  it("renders provider documentation policy criteria without implementation guardrails", async () => {
    const workflow = createProviderDocumentationWorkflow();

    await workflow.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });
    const [row] = await workflow.listIncentiveRows();
    const markup = renderToStaticMarkup(
      createElement(PlanAuditDetailsModal, {
        row: row!,
        onClose: () => undefined
      })
    );

    IMPLEMENTATION_GUARDRAIL_CRITERIA.forEach((label) => {
      expect(markup).not.toContain(label);
    });
    expect(markup).toContain("Request type is eligible");
    expect(markup).toContain("Service code is included");
    expect(markup).toContain("Request is a covered benefit");
    expect(markup).toContain("DTR was requested");
    expect(markup).toContain("Requested DTR is complete");
  });

  it("keeps provider audit evidence actual badges inside policy subcards", () => {
    const styles = readRepoFile("src/apps/web/app/styles.css");
    const actualColumnBlock = styles.match(/\.policy-audit-evidence-actual-column\s*\{[^}]+\}/)?.[0] ?? "";
    const evidenceBadgeCellBlock =
      styles.match(/\.policy-audit-evidence-table \.badge-cell\s*\{[^}]+\}/)?.[0] ?? "";
    const evidenceBadgeBlock =
      styles.match(/\.policy-audit-evidence-table \.badge-cell \.op-badge\s*\{[^}]+\}/)?.[0] ?? "";

    expect(actualColumnBlock).toContain("clamp(");
    expect(actualColumnBlock).not.toContain("width: max-content");
    expect(evidenceBadgeCellBlock).toContain("clamp(");
    expect(evidenceBadgeCellBlock).not.toContain("width: 132px");
    expect(evidenceBadgeCellBlock).not.toContain("white-space: nowrap");
    expect(evidenceBadgeBlock).toContain("max-width: 100%");
    expect(evidenceBadgeBlock).toContain("overflow-wrap: anywhere");
  });

  it("renders a concise empty state when provider payment controls are unavailable", () => {
    const markup = renderToStaticMarkup(
      createElement(PlanAuditDetailsModal, {
        row: buildIncentiveWorklistRow({
          paymentPolicyId: null,
          paymentPolicyControls: []
        }),
        onClose: () => undefined
      })
    );

    expect(markup).toContain("No payment controls recorded");
  });

  it("renders plan audit details with the shared modal treatment", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanAuditDetailsModal.tsx");

    expect(source).toContain("LabsBadge");
    expect(source).toContain('className="modal-backdrop audit-modal-backdrop"');
    expect(source).toContain("policy-details-modal");
    expect(source).toContain('role="dialog"');
    expect(source).toContain("Policy Event Audit Details");
    expect(source).toContain("{row.umRequestId}");
    expect(source).not.toContain("{row.caseId}");
    expect(source).toContain("<dt>UM request ID</dt>");
    expect(source).toContain("<dd className=\"mono-cell\">{row.umRequestId}</dd>");
    expect(source).toContain("Close details");
    expect(source).not.toContain("PAS_SUBMITTED");
    expect(source).toContain("policy-event-context-line");
    expect(source).toContain("policy-event-outcome-strip");
    expect(source).toContain("policy-anchor-list");
    expect(source).toContain("Criterion/Control");
    expect(source).toContain("row.policyCriteria.map");
    expect(source).toContain("row.paymentPolicyControls.map");
    expect(source).toContain("formatTransaction(row.transactionId)");
    expect(source).toContain("hashscan.io/testnet/transaction");
    expect(source).not.toContain("Show policy criteria");
    expect(source).not.toContain("row.policyControls.join");
  });

  it("uses approved and rejected terminology for business policy outcomes", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanAuditDetailsModal.tsx");

    expect(source).toContain('return "Rejected";');
    expect(source).toContain('return "Approved";');
    expect(source).toContain("<dt>Business policy status</dt>");
    expect(source).toContain("businessPolicyBadgeVariant(row)");
    expect(source).toMatch(/export function formatStatus[\s\S]*case "approved":\n\s+return "Approved";/);
    expect(source).toMatch(/export function formatStatus[\s\S]*case "rejected":\n\s+return "Rejected";/);
    expect(source).toMatch(/export function businessPolicyBadgeVariant[\s\S]*case "rejected":\n\s+return "warning";/);
    expect(source).not.toContain(["Blocked", " by policy"].join(""));
    expect(source).not.toContain("Paid by policy");
    expect(source).not.toContain("<dt>Policy outcome</dt>");
  });

  it("uses paid and blocked terminology for payment policy outcomes", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanAuditDetailsModal.tsx");

    expect(source).toMatch(/case "paid":\n\s+return "Paid";/);
    expect(source).toMatch(/case "blocked":\n\s+return "Blocked";/);
    expect(source).not.toContain(["Auto", "-settled"].join(""));
  });

  it("keeps canonical null policy outcomes pending instead of falling back to legacy lifecycle statuses", () => {
    const row = buildIncentiveWorklistRow({
      businessPolicyStatus: null,
      paymentPolicyStatus: null,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      paymentIntentId: "pi_paid_lifecycle_only",
      transactionId: "testnet-lifecycle-only"
    });

    expect(formatStatus(row)).toBe("Pending");
    expect(businessPolicyBadgeVariant(row)).toBe("neutral");
    expect(formatPaymentStatus(row)).toBe("Pending");
    expect(formatBusinessPolicyOutcome(row)).toBe("Pending");
    expect(formatPaymentPolicyOutcome(row)).toBe("");
  });

  it("does not render final policy labels when canonical policy outcomes are null", () => {
    const markup = renderToStaticMarkup(
      createElement(PlanAuditDetailsModal, {
        row: buildIncentiveWorklistRow({
          businessPolicyStatus: null,
          paymentPolicyStatus: null,
          incentiveStatus: "not_eligible",
          paymentStatus: "blocked_by_policy"
        }),
        onClose: () => undefined
      })
    );

    expect(markup).toContain("Pending");
    expect(markup).not.toContain(">Approved<");
    expect(markup).not.toContain(">Paid<");
    expect(markup).not.toContain(">Blocked<");
  });

  it("opens details from the worklist instead of rendering a detail panel below the table", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx");

    expect(source).toContain("PlanAuditDetailsModal");
    expect(source).toContain("formatRequestType(row.requestType)");
    expect(source).toContain("setDetailsUmRequestId(row.umRequestId)");
    expect(source).toContain("<UseCaseNavigation activeView=\"plan\" umRequestId={selectedUmRequestId ?? requestedUmRequestId} />");
    expect(source).not.toContain("setDetailsCaseId");
    expect(source).not.toContain("selectedCaseId");
    expect(source).not.toContain("detailsCaseId");
    expect(source).not.toContain("initialCaseId");
    expect(source).not.toContain("row.caseId");
    expect(source).not.toContain('className="panel detail-panel"');
  });

  it("keeps an existing selected UM request ahead of the initial provider deep link on refresh", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx");
    const currentSelectionCheck = source.indexOf(
      "currentUmRequestId && payload.rows.some((row) => row.umRequestId === currentUmRequestId)"
    );
    const requestedSelectionCheck = source.indexOf(
      "requestedUmRequestId && payload.rows.some((row) => row.umRequestId === requestedUmRequestId)"
    );

    expect(currentSelectionCheck).toBeGreaterThan(-1);
    expect(requestedSelectionCheck).toBeGreaterThan(-1);
    expect(currentSelectionCheck).toBeLessThan(requestedSelectionCheck);
  });

  it("keeps the incentives worklist concise without a reason column", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx");

    expect(source).toContain("<th>Health Plan</th>");
    expect(source).toContain("<th>UM request ID</th>");
    expect(source).toMatch(/<th>Health Plan<\/th>\s*<th>Provider group<\/th>/);
    expect(source).toContain('<th className="badge-cell">Business Policy</th>');
    expect(source).toContain('<th className="badge-cell">Payment Policy</th>');
    expect(source).toContain('<td className="badge-cell">');
    expect(source).toContain("<th>Payment</th>");
    expect(source).toContain("formatBusinessPolicyOutcome(row)");
    expect(source).toContain("formatPaymentPolicyOutcome(row)");
    expect(source).toContain("LabsBadge");
    expect(source).toContain('variant={businessPolicyBadgeVariant(row)}');
    expect(source).toContain('variant={paymentPolicyBadgeVariant(row)}');
    expect(source).toContain('formatPaymentPolicyOutcome(row) || null');
    expect(source).toContain('return "Approved";');
    expect(source).toContain('return "Rejected";');
    expect(source).toMatch(/function businessPolicyBadgeVariant[\s\S]*case "rejected":\n\s+return "warning";/);
    expect(source).toContain('return "";');
    expect(source).toContain("formatPaymentAmount(row)");
    expect(source).toContain("row.planDisplay ?? row.planId ??");
    expect(source).not.toContain("<th>Reason</th>");
    expect(source).not.toContain("<th>Service</th>");
    expect(source).not.toContain("<td>{row.serviceLabel}</td>");
    expect(source).not.toContain("<td>{row.reason}</td>");
    expect(source).not.toContain("<th>PA result</th>");
    expect(source).not.toContain("<th>Policy outcome</th>");
    expect(source).not.toContain("<th>Value</th>");
    expect(source).not.toContain("formatPaResult(row.paResult)");
    expect(source).not.toContain("formatPaymentStatus(row)");
    expect(source).not.toContain('return "Not run";');
    expect(source).toContain('colSpan={8}');
  });

  it("renders a visible loading state inside the incentives worklist", () => {
    const componentSource = readRepoFile("src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx");
    const styleSource = readRepoFile("src/apps/web/app/styles.css");

    expect(componentSource).toContain('className="loading-row"');
    expect(componentSource).toContain('role="status"');
    expect(componentSource).toContain("Loading UM request creation events");
    expect(componentSource).toContain("Review UM request creation events");
    expect(componentSource).toContain("UM request worklist");
    expect(componentSource).not.toContain("submitted PA events");
    expect(componentSource).not.toContain("Submitted PA worklist");
    expect(componentSource).not.toContain("Loading submitted PA events");
    expect(componentSource).toContain('className="loading-indicator"');
    expect(componentSource).toContain('className="loading-dot"');
    expect(styleSource).toContain(".loading-row");
    expect(styleSource).toContain(".loading-indicator");
    expect(styleSource).toContain("@keyframes loading-pulse");
  });

  it("does not auto-refresh the health plan incentives worklist", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx");

    expect(source).toContain('onClick={() => void refreshRows("manual")}');
    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("clearInterval");
    expect(source).not.toContain('"poll"');
  });

  it("uses UM request id query parameters for provider documentation audit navigation", () => {
    const navigationSource = readRepoFile("src/apps/web/components/provider-documentation/UseCaseNavigation.tsx");
    const incentivesPageSource = readRepoFile("src/apps/web/app/provider-documentation/incentives/page.tsx");

    expect(navigationSource).toContain("umRequestId?: string | null");
    expect(navigationSource).toContain("?umRequestId=");
    expect(navigationSource).not.toContain("?caseId=");
    expect(navigationSource).not.toContain("caseId?: string | null");
    expect(navigationSource).not.toContain("?? caseId");
    expect(incentivesPageSource).toContain("searchParams?: Promise<{ umRequestId?: string }>");
    expect(incentivesPageSource).toContain("initialUmRequestId={params?.umRequestId ?? null}");
    expect(incentivesPageSource).not.toContain("params?.caseId");
  });
});

function buildIncentiveWorklistRow(overrides: Partial<IncentiveWorklistRow> = {}): IncentiveWorklistRow {
  return {
    evaluationType: "provider_documentation_completeness",
    id: "ie_canonical_null_policy_status",
    umRequestId: "PA-260527-1200-NULLSTAT",
    caseId: "PA-260527-1200-NULLSTAT",
    planId: "acme-health-ppo",
    planDisplay: "Acme Health PPO",
    submittedAt: "2026-05-27T12:00:00.000Z",
    providerGroupDisplay: "Lakeside Provider Group",
    requestType: "outpatient_service",
    serviceLabel: "Knee MRI after injury",
    serviceCode: "knee_mri",
    state: "pend",
    outcomeStatus: null,
    businessPolicyStatus: null,
    paymentPolicyStatus: null,
    incentiveStatus: "paid",
    paymentStatus: "auto_executed",
    incentiveValue: 5,
    currency: "HBAR",
    settlementToken: { symbol: "HBAR" },
    reason: "Lifecycle fields are not canonical policy outcomes",
    reasonCodes: [],
    policyId: "plcy_test",
    policyControls: [],
    policyCriteria: [],
    audit: {
      id: "audit_null_policy_status",
      requestHash: "hash_null_policy_status",
      policyId: "plcy_test",
      policyVersion: "v1",
      decision: "approved",
      reasonCodes: [],
      transactionId: null,
      createdAt: "2026-05-27T12:00:01.000Z"
    },
    walletId: "0.0.9049549",
    paymentIntentId: null,
    transactionId: null,
    paymentPolicyId: null,
    paymentPolicyControls: [],
    ...overrides
  };
}
