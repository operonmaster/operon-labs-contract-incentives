import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DelegatePlanAuditRow } from "../../lib/delegate-um-workflow";
import { DelegatePlanAuditDetailsModal } from "./DelegatePlanAuditDetailsModal";
import { DelegatePlanConsole } from "./DelegatePlanConsole";

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
    expect(source).toContain("formatBusinessPolicyStatus(row.incentiveStatus)");
    expect(source).toContain("businessPolicyStatusBadgeVariant(row.incentiveStatus)");
    expect(source).toContain("paymentStatusBadgeVariant(row.paymentStatus)");
    expect(source).not.toContain("<th>State</th>");
    expect(source).not.toContain("<td>{formatUmState(row.state)}</td>");
    expect(source).not.toContain('className="panel detail-panel"');
    expect(source).not.toContain("Selected request");
  });

  it("renders delegate policy details with the shared plan audit modal treatment", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/apps/web/components/delegate-um/DelegatePlanAuditDetailsModal.tsx"),
      "utf8"
    );

    expect(source).toContain('className="modal-backdrop audit-modal-backdrop"');
    expect(source).toContain("policy-details-modal");
    expect(source).toContain("delegate-policy-event-modal");
    expect(source).toContain('className="policy-modal-sections payment-policy-modal-sections"');
    expect(source).toContain('role="dialog"');
    expect(source).toContain("Delegate UM SLA policy audit");
    expect(source).toContain("UM_REQUEST_DETERMINED");
    expect(source).toContain("<dt>Delegate vendor</dt>");
    expect(source).toContain("<dt>Business policy ID</dt>");
    expect(source).toContain("<dt>Final outcome</dt>");
    expect(source).toContain("Payment policy");
    expect(source).toContain("formatTransaction(row.transactionId)");
    expect(source).toContain("Show business policy criteria");
    expect(source).toContain("Expected");
    expect(source).toContain("Evidence value");
    expect(source).toContain("row.policyControls.join");
    expect(source).toContain("row.policyCriteria.map");
  });

  it("renders the plan view shell with loading state and delegate navigation", () => {
    const markup = renderToStaticMarkup(createElement(DelegatePlanConsole, { initialUmRequestId: "PA-260526-0900-REVIEW1" }));

    expect(markup).toContain("Delegate determination log");
    expect(markup).toContain("Refresh plan view");
    expect(markup).toContain("Loading delegate plan audit rows");
    expect(markup).toContain("/delegate-um/policies");
    expect(markup).toContain("/delegate-um/plan?umRequestId=PA-260526-0900-REVIEW1");
  });

  it("separates business policy and payment policy outcomes in the policy event modal", () => {
    const markup = renderToStaticMarkup(
      createElement(DelegatePlanAuditDetailsModal, {
        row: buildDelegatePlanAuditRow({
          incentiveStatus: "payment_failed",
          paymentStatus: "execution_failed",
          reason: "Policy approved, but Hedera transaction execution failed"
        }),
        onClose: () => undefined
      })
    );

    expect(markup).toContain("Final outcome");
    expect(markup).toContain("Business policy passed, payment failed");
    expect(markup).toContain("Business policy");
    expect(markup).toContain("Payment policy");
    expect(markup).toContain("Show business policy criteria");
    expect(markup).not.toContain("Show policy criteria");
    expect(markup).toContain("Payment execution failed after the business policy approved the incentive.");
    expect(markup).toContain("Payment policy runtime details were not captured for this event.");
    expect(markup).toContain("Requested payment");
    expect(markup).toContain("5.00 HBAR");
    expect(markup).toContain("Execution failed");
    expect(markup).toContain("op-badge op-badge-warning");
    expect(markup).toContain("Recipient wallet");
    expect(markup).toContain("0.0.9049550");
  });
});

function buildDelegatePlanAuditRow(overrides: Partial<DelegatePlanAuditRow> = {}): DelegatePlanAuditRow {
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
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true,
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
    walletId: "0.0.9049550",
    paymentIntentId: null,
    transactionId: null,
    ...overrides
  };
}
