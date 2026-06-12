import { createElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SpecialtyRxPlanAuditRow } from "../../lib/specialty-rx-workflow";
import {
  canViewSpecialtyRxPlanDetails,
  formatBusinessPolicyTableStatus,
  formatPaymentPolicyTableStatus
} from "./SpecialtyRxPlanConsole";
import { SpecialtyRxPlanDetailsModal } from "./SpecialtyRxPlanDetailsModal";
import { SpecialtyRxUseCaseNavigation } from "./SpecialtyRxUseCaseNavigation";

describe("SpecialtyRxPlanConsole", () => {
  it("loads specialty fulfillment plan rows through the shared incentive worklist hook", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/apps/web/components/specialty-rx/SpecialtyRxPlanConsole.tsx"),
      "utf8"
    );

    expect(source).toContain("useIncentiveWorklist");
    expect(source).toContain('endpoint: "/api/specialty-rx/plan"');
    expect(source).toContain("getRowId: (row) => row.fulfillmentCaseId");
  });

  it("keeps fulfillment case ids out of Specialty Rx top navigation URLs", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/apps/web/components/specialty-rx/SpecialtyRxUseCaseNavigation.tsx"),
      "utf8"
    );
    const markup = renderToStaticMarkup(
      createElement(SpecialtyRxUseCaseNavigation, {
        activeView: "pharmacy"
      })
    );

    expect(source).not.toContain('param: "fulfillmentCaseId"');
    expect(source).not.toContain("contextId");
    expect(markup).toContain('href="/specialty-rx/plan"');
    expect(markup).not.toContain("fulfillmentCaseId=");
  });

  it("keeps the health plan table compact by omitting the linked PA column", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/apps/web/components/specialty-rx/SpecialtyRxPlanConsole.tsx"),
      "utf8"
    );

    expect(source).not.toContain("<th>Linked PA</th>");
    expect(source).not.toContain('<td className="mono-cell">{row.umRequestId}</td>');
    expect(source).toContain("colSpan={7}");
    expect(source).not.toContain("colSpan={8}");
  });

  it("leaves unevaluated business and payment policy cells empty in the health plan table", () => {
    expect(formatBusinessPolicyTableStatus(null)).toBeNull();
    expect(formatPaymentPolicyTableStatus(null)).toBeNull();
    expect(formatBusinessPolicyTableStatus("approved")).toBe("Approved");
    expect(formatBusinessPolicyTableStatus("rejected")).toBe("Rejected");
    expect(formatPaymentPolicyTableStatus("paid")).toBe("Paid");
    expect(formatPaymentPolicyTableStatus("blocked")).toBe("Blocked");
  });

  it("shows plan details only after both policies have executed", () => {
    expect(canViewSpecialtyRxPlanDetails({ businessPolicyStatus: null, paymentPolicyStatus: null })).toBe(false);
    expect(canViewSpecialtyRxPlanDetails({ businessPolicyStatus: "approved", paymentPolicyStatus: null })).toBe(false);
    expect(canViewSpecialtyRxPlanDetails({ businessPolicyStatus: "approved", paymentPolicyStatus: "paid" })).toBe(true);
    expect(canViewSpecialtyRxPlanDetails({ businessPolicyStatus: "rejected", paymentPolicyStatus: "blocked" })).toBe(true);
  });

  it("renders specialty fulfillment plan audit details as a normalized policy event", () => {
    const markup = renderToStaticMarkup(
      createElement(SpecialtyRxPlanDetailsModal, {
        row: buildSpecialtyRxPlanAuditRow({
          policyCriteria: [
            {
              id: "shipmentScheduledWithinSla",
              label: "Fulfillment SLA met",
              expected: "Yes",
              actual: "Yes",
              passed: true,
              reasonCode: "SHIPMENT_SLA_EXCEEDED"
            }
          ],
          paymentPolicyControls: [
            {
              id: "business-attestation",
              label: "Business evaluation attestation",
              expected: "Approved business evaluation",
              actual: "Verified",
              status: "passed"
            }
          ]
        }),
        onClose: () => undefined
      })
    );

    expect(markup).toContain("RXF-260526-0900-DELEGATE");
    expect(markup).toContain("PA-260526-0900-DELEGATE");
    expect(markup).toContain("Policy Event Audit Details");
    expect(markup).toContain("Business policy status");
    expect(markup).toContain("Payment policy status");
    expect(markup).toContain("Amount");
    expect(markup).toContain("Wallet");
    expect(markup).toContain("Transaction");
    expect(markup).toContain("Business policy");
    expect(markup).toContain("Payment policy");
    expect(markup).toContain("Fulfillment SLA met");
    expect(markup).toContain("Business evaluation attestation");
    expect(markup).not.toContain("Specialty Fulfillment Audit Details");
    expect(markup).not.toContain("Case identity");
    expect(markup).not.toContain("Linked UM request");
    expect(markup).not.toContain("Delegate determination");
    expect(markup).not.toContain("Fulfillment timestamps");
    expect(markup).not.toContain("Checklist evidence");
    expect(markup).not.toContain("Exception classification");
    expect(markup).not.toContain("Fulfillment evidence");
    expect(markup).not.toContain("Closure evidence");
    expect(markup).not.toContain("Schedule SLA");
    expect(markup).not.toContain("Delivery SLA");
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

function buildSpecialtyRxPlanAuditRow(overrides: Partial<SpecialtyRxPlanAuditRow> = {}): SpecialtyRxPlanAuditRow {
  const row: SpecialtyRxPlanAuditRow = {
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
    incentiveValue: 5,
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

  return {
    ...row,
    ...overrides
  };
}
