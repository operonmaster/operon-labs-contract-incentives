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
    expect(source).toContain("<th className=\"badge-cell\">Settlement</th>");
    expect(source).toContain("formatPaymentStatus(row.paymentStatus)");
  });

  it("renders appeals packet audit details with separated policy sections", () => {
    const markup = renderToStaticMarkup(
      createElement(AppealsPlanDetailsModal, { row: buildRow(), onClose: () => undefined })
    );

    expect(markup).toContain("Appeal Packet Audit Details");
    expect(markup).toContain("Appeal receipt starts packet-readiness SLA");
    expect(markup).toContain("Final appeal outcome excluded from incentive");
    expect(markup).toContain("Business Policy");
    expect(markup).toContain("Payment Policy");
  });

  it("renders execution failures as settlement failures separate from policy blocks", () => {
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
    expect(markup).toContain("Settlement status");
    expect(markup).toContain("Execution failed");
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
    policyCriteria: [],
    paymentPolicyId: "acme-health-ppo",
    paymentPolicyControls: [],
    audit: null,
    walletId: "0.0.9049549",
    paymentIntentId: "pi_appeals",
    transactionId: "0.0.123@1"
  };

  return { ...row, ...overrides };
}
