import { createElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SpecialtyRxPlanAuditRow } from "../../lib/specialty-rx-workflow";
import { SpecialtyRxPlanDetailsModal } from "./SpecialtyRxPlanDetailsModal";

describe("SpecialtyRxPlanConsole", () => {
  it("loads specialty fulfillment plan rows through the shared incentive worklist hook", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/apps/web/components/specialty-rx/SpecialtyRxPlanConsole.tsx"),
      "utf8"
    );

    expect(source).toContain("useIncentiveWorklist");
    expect(source).toContain('endpoint: "/api/specialty-rx/plan"');
    expect(source).toContain("getRowId: (row) => row.fulfillmentCaseId");
    expect(source).toContain("requestedId: requestedFulfillmentCaseId");
  });

  it("renders specialty fulfillment plan audit details with separated policy sections", () => {
    const markup = renderToStaticMarkup(
      createElement(SpecialtyRxPlanDetailsModal, {
        row: buildSpecialtyRxPlanAuditRow(),
        onClose: () => undefined
      })
    );

    expect(markup).toContain("RXF-260526-0900-DELEGATE");
    expect(markup).toContain("PA-260526-0900-DELEGATE");
    expect(markup).toContain("Fulfillment SLA");
    expect(markup).toContain("Fulfillment SLA started");
    expect(markup).not.toContain("Schedule SLA");
    expect(markup).not.toContain("Delivery SLA");
    expect(markup).toContain("Clear To Fill");
    expect(markup).toContain("Delegate determination");
    expect(markup).toContain("Checklist evidence");
    expect(markup).toContain("Prescription present");
    expect(markup).toContain("Shipment scheduled within SLA");
    expect(markup).toContain("Exception classification");
    expect(markup).toContain("External blocker");
    expect(markup).toContain("Avoidable exception");
    expect(markup).toContain("Business policy");
    expect(markup).toContain("Payment policy");
  });

  it("uses Fulfillment SLA language instead of schedule or delivery SLA columns", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/apps/web/components/specialty-rx/SpecialtyRxPlanConsole.tsx"),
      "utf8"
    );

    expect(source).toContain("Fulfillment SLA");
    expect(source).not.toContain("Schedule SLA");
    expect(source).not.toContain("Delivery SLA");
  });
});

function buildSpecialtyRxPlanAuditRow(): SpecialtyRxPlanAuditRow {
  return {
    evaluationType: "specialty_rx_fulfillment_sla",
    fulfillmentCase: {
      id: "RXF-260526-0900-DELEGATE",
      umRequestId: "PA-260526-0900-DELEGATE",
      source: "delegate_um_approved",
      planId: "acme-health-ppo",
      pharmacyId: "atlas-specialty-rx",
      pharmacyDisplay: "Atlas Specialty Rx",
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide",
      serviceLabel: "Wegovy semaglutide",
      codingSystem: "NDC",
      billingCode: "0169-4525-14",
      state: "fulfilled",
      paApprovalReceivedAt: "2026-06-18T14:00:00.000Z",
      intakeStartedAt: "2026-06-18T14:00:00.000Z",
      fulfillmentSlaStartedAt: "2026-06-18T16:00:00.000Z",
      clearToFillAt: "2026-06-18T16:00:00.000Z",
      shipmentScheduledAt: "2026-06-19T09:30:00.000Z",
      deliveryConfirmedAt: "2026-06-20T14:00:00.000Z",
      exceptionRecordedAt: null,
      scheduleSlaHours: 24,
      intake: {
        approvedPaLinked: true,
        prescriptionPresent: true,
        assignedPharmacyConfirmed: true,
        therapyMetadataPresent: true,
        handoffDataComplete: true
      },
      clearToFill: {
        benefitsOrClaimCheckCompleted: true,
        prescriptionValid: true,
        prescriberClarificationRequired: false,
        prescriberClarificationResolved: true,
        remsRequired: false,
        remsAuthorizationConfirmed: true,
        inventoryAvailable: true,
        copayOrPaymentReady: true
      },
      shipment: {
        patientContactAttemptDocumented: true,
        addressConfirmed: true,
        deliveryWindowConfirmed: true,
        coldChainRequired: true,
        coldChainPackoutValidated: true,
        courierScheduled: true
      },
      fulfillment: {
        shipped: true,
        deliveryConfirmed: true,
        deliveryAttemptDocumented: true,
        temperatureLogValid: true,
        avoidableFulfillmentException: false,
        externalBlockerDocumented: false,
        exceptionReasonCode: null
      },
      updatedAt: "2026-06-20T14:00:00.000Z"
    },
    fulfillmentCaseId: "RXF-260526-0900-DELEGATE",
    umRequestId: "PA-260526-0900-DELEGATE",
    id: "ie_specialty",
    planId: "acme-health-ppo",
    pharmacyId: "atlas-specialty-rx",
    pharmacyDisplay: "Atlas Specialty Rx",
    requestType: "pharmacy_benefit",
    serviceLabel: "Wegovy semaglutide",
    state: "fulfilled",
    fulfillmentSlaStartedAt: "2026-06-18T16:00:00.000Z",
    clearToFillAt: "2026-06-18T16:00:00.000Z",
    shipmentScheduledAt: "2026-06-19T09:30:00.000Z",
    deliveryConfirmedAt: "2026-06-20T14:00:00.000Z",
    fulfillmentSlaStatus: "within_sla",
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
