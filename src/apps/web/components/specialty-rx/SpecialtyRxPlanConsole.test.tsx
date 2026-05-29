import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SpecialtyRxPlanAuditRow } from "../../lib/specialty-rx-workflow";
import { SpecialtyRxPlanDetailsModal } from "./SpecialtyRxPlanDetailsModal";

describe("SpecialtyRxPlanConsole", () => {
  it("renders specialty fulfillment plan audit details with separated policy sections", () => {
    const markup = renderToStaticMarkup(
      createElement(SpecialtyRxPlanDetailsModal, {
        row: buildSpecialtyRxPlanAuditRow(),
        onClose: () => undefined
      })
    );

    expect(markup).toContain("RXF-260526-0900-DELEGATE");
    expect(markup).toContain("PA-260526-0900-DELEGATE");
    expect(markup).toContain("Clear To Fill");
    expect(markup).toContain("Business policy");
    expect(markup).toContain("Payment policy");
  });
});

function buildSpecialtyRxPlanAuditRow(): SpecialtyRxPlanAuditRow {
  return {
    evaluationType: "specialty_rx_fulfillment_sla",
    fulfillmentCase: {} as SpecialtyRxPlanAuditRow["fulfillmentCase"],
    fulfillmentCaseId: "RXF-260526-0900-DELEGATE",
    umRequestId: "PA-260526-0900-DELEGATE",
    id: "ie_specialty",
    planId: "acme-health-ppo",
    pharmacyId: "atlas-specialty-rx",
    pharmacyDisplay: "Atlas Specialty Rx",
    requestType: "pharmacy_benefit",
    serviceLabel: "Wegovy semaglutide",
    state: "fulfilled",
    clearToFillAt: "2026-06-18T16:00:00.000Z",
    shipmentScheduledAt: "2026-06-19T09:30:00.000Z",
    deliveryConfirmedAt: "2026-06-20T14:00:00.000Z",
    scheduleSlaStatus: "within_sla",
    deliverySlaStatus: "within_sla",
    businessPolicyStatus: "approved",
    paymentPolicyStatus: "paid",
    incentiveStatus: "paid",
    paymentStatus: "auto_executed",
    incentiveValue: 7,
    currency: "HBAR",
    settlementToken: { symbol: "HBAR" },
    reason: "Fulfillment completed within SLA",
    reasonCodes: [],
    policyId: "specialty-rx-fulfillment-sla-v1",
    policyControls: ["Contracted specialty pharmacy wallet"],
    policyCriteria: [],
    paymentPolicyId: "acme-health-ppo",
    paymentPolicyControls: [],
    audit: null,
    walletId: "0.0.9049549",
    paymentIntentId: "pi_specialty",
    transactionId: "0.0.123@1.2"
  };
}
