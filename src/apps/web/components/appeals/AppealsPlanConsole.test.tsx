import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AppealsPlanDetailsModal } from "./AppealsPlanDetailsModal";
import type { AppealsPlanAuditRow } from "../../lib/appeals-workflow";

describe("AppealsPlanConsole", () => {
  it("loads appeals plan rows through the shared incentive worklist hook", () => {
    const source = readFileSync(path.join(process.cwd(), "src/apps/web/components/appeals/AppealsPlanConsole.tsx"), "utf8");

    expect(source).toContain('endpoint: "/api/appeals/plan"');
    expect(source).toContain("getRowId: (row) => row.appealId");
    expect(source).toContain("<th>Appeal ID</th>");
    expect(source).toContain("<th>Submitter</th>");
    expect(source).toContain("<th className=\"badge-cell\">Payment Policy</th>");
    expect(source).toContain("colSpan={7}");
    expect(source).not.toContain("<th>Linked PA</th>");
    expect(source).not.toContain("<th className=\"badge-cell\">Settlement</th>");
    expect(source).not.toContain("<td className=\"mono-cell\">{row.umRequestId}</td>");
    expect(source).not.toContain("formatPaymentStatus(row.paymentStatus)");
  });

  it("renders appeals policy details with the shared two-policy audit modal treatment", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/apps/web/components/appeals/AppealsPlanDetailsModal.tsx"),
      "utf8"
    );
    const markup = renderToStaticMarkup(
      createElement(AppealsPlanDetailsModal, { row: buildRow(), onClose: () => undefined })
    );

    expect(markup).toContain("Policy Event Audit Details");
    expect(markup).not.toContain("Appeal Packet Audit Details");
    expect(markup).toContain("<dt>Business policy status</dt>");
    expect(markup).toContain("<dt>Payment policy status</dt>");
    expect(markup).toContain("<dt>Amount</dt>");
    expect(markup).toContain("<dt>Wallet</dt>");
    expect(markup).toContain("Business Policy");
    expect(markup).toContain("Payment Policy");
    expect(markup.match(/<dt>Policy ID<\/dt>/g)).toHaveLength(2);
    expect(markup.match(/<dt>Audit record<\/dt>/g)).toHaveLength(2);
    expect(markup).toContain("appeals-packet-quality-v1");
    expect(markup).toContain("audit_appeals");
    expect(markup).toContain("acme-health-ppo");
    expect(markup).toContain("pi_appeals");
    expect(markup).toContain("Criterion/Control");
    expect(markup).toContain("Actual");
    expect(markup).toContain("Linked PA denied");
    expect(markup).toContain("Packet evidence complete");
    expect(markup).toContain("Business evaluation attestation");
    expect(markup).toContain("Duplicate payment prevention");
    expect(source).toContain('className="policy-modal-sections payment-policy-modal-sections"');
    expect(source).not.toContain("appeals-case-identity-title");
    expect(source).not.toContain("appeals-linked-pa-title");
    expect(source).not.toContain("appeals-sla-timestamps-title");
    expect(source).not.toContain("appeals-packet-checklist-title");
    expect(source).not.toContain("appeals-business-evidence-title");
    expect(source).not.toContain("buildChecklistEvidenceRows");
    expect(markup).not.toContain("Case identity");
    expect(markup).not.toContain("SLA timestamps");
    expect(markup).not.toContain("Packet checklist evidence");
    expect(markup).not.toContain("Reason codes");
    expect(markup).not.toContain("Policy guardrails");
    expect(markup).not.toContain("Settlement status");
    expect(markup).not.toContain("Packet SLA");
  });

  it("keeps payment execution failures out of the two-policy event summary", () => {
    const markup = renderToStaticMarkup(
      createElement(AppealsPlanDetailsModal, {
        row: buildRow({
          businessPolicyStatus: "approved",
          paymentPolicyStatus: "blocked",
          incentiveStatus: "payment_failed",
          paymentStatus: "execution_failed",
          reason: "Policy approved, but Hedera transaction execution failed",
          transactionId: null
        }),
        onClose: () => undefined
      })
    );

    expect(markup).toContain("Payment policy status");
    expect(markup).toContain("Blocked");
    expect(markup).not.toContain("Settlement status");
    expect(markup).not.toContain("Execution failed");
  });
});

function buildRow(overrides: Partial<AppealsPlanAuditRow> = {}): AppealsPlanAuditRow {
  const row: AppealsPlanAuditRow = {
    evaluationType: "appeals_packet_quality",
    appealCase: {} as AppealsPlanAuditRow["appealCase"],
    appealId: "APL-260526-0900-DENIED01",
    umRequestId: "PA-260526-0900-DENIED01",
    id: "ie_appeals",
    planId: "acme-health-ppo",
    submitterId: "lakeside-provider-admin",
    requestType: "pharmacy_benefit",
    serviceLabel: "Humira (adalimumab)",
    state: "packet_ready",
    appealReceivedAt: "2026-06-18T16:00:00.000Z",
    acknowledgedAt: "2026-06-18T17:00:00.000Z",
    packetReadyAt: "2026-06-19T15:00:00.000Z",
    acknowledgementSlaStatus: "within_sla",
    packetReadinessSlaStatus: "within_sla",
    businessPolicyStatus: "approved",
    paymentPolicyStatus: "paid",
    incentiveStatus: "paid",
    paymentStatus: "auto_executed",
    incentiveValue: 6,
    currency: "HBAR",
    settlementToken: { symbol: "HBAR" },
    reason: "Appeal packet ready within SLA",
    reasonCodes: [],
    policyId: "appeals-packet-quality-v1",
    policyControls: ["Appeal receipt starts packet-readiness SLA", "Final appeal outcome excluded from incentive"],
    policyCriteria: [
      {
        id: "linkedDeniedPa",
        label: "Linked PA denied",
        expected: "Denied",
        actual: "Denied",
        passed: true,
        reasonCode: "LINKED_PA_NOT_DENIED"
      },
      {
        id: "packetEvidenceComplete",
        label: "Packet evidence complete",
        expected: "Yes",
        actual: "Yes",
        passed: true,
        reasonCode: "PACKET_EVIDENCE_INCOMPLETE"
      }
    ],
    paymentPolicyId: "acme-health-ppo",
    paymentPolicyControls: [
      {
        id: "businessEvaluationAttestation",
        label: "Business evaluation attestation",
        status: "passed",
        expected: "Verified",
        actual: "Verified"
      },
      {
        id: "duplicatePaymentPrevention",
        label: "Duplicate payment prevention",
        status: "passed",
        expected: "Verified",
        actual: "Verified"
      }
    ],
    audit: { id: "audit_appeals" } as AppealsPlanAuditRow["audit"],
    walletId: "0.0.9049549",
    paymentIntentId: "pi_appeals",
    transactionId: "0.0.123@1"
  };

  return { ...row, ...overrides };
}
