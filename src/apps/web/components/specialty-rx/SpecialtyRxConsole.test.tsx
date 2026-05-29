// @vitest-environment happy-dom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SpecialtyFulfillmentCase } from "../../lib/specialty-rx-store";
import { SpecialtyRxWorkflowModal } from "./SpecialtyRxWorkflowModal";

describe("SpecialtyRxWorkflowModal", () => {
  it("renders the fulfillment workflow steps", () => {
    const markup = renderToStaticMarkup(
      createElement(SpecialtyRxWorkflowModal, {
        caseRecord: buildSpecialtyFulfillmentCase(),
        onClose: () => undefined,
        onUpdated: () => undefined
      })
    );

    expect(markup).toContain("Intake &amp; Triage");
    expect(markup).toContain("Clear To Fill");
    expect(markup).toContain("Schedule Shipment");
    expect(markup).toContain("Confirm Fulfillment");
  });
});

function buildSpecialtyFulfillmentCase(): SpecialtyFulfillmentCase {
  return {
    id: "RXF-260528-0900-SPECIAL1",
    umRequestId: "PA-260528-0900-SPECIAL1",
    source: "delegate_um_approved",
    planId: "acme-health",
    pharmacyId: "atlas-specialty-rx",
    pharmacyDisplay: "Atlas Specialty Rx",
    requestType: "pharmacy_benefit",
    serviceCode: "rx-dupixent",
    serviceLabel: "Dupixent 300 mg/2 mL pen",
    codingSystem: "NDC",
    billingCode: "00024-5915-02",
    state: "intake_triage",
    paApprovalReceivedAt: "2026-05-28T15:00:00.000Z",
    intakeStartedAt: "2026-05-28T15:05:00.000Z",
    clearToFillAt: null,
    shipmentScheduledAt: null,
    deliveryConfirmedAt: null,
    exceptionRecordedAt: null,
    scheduleSlaHours: 24,
    deliverySlaHours: 72,
    intake: {
      approvedPaLinked: true,
      prescriptionPresent: false,
      assignedPharmacyConfirmed: false,
      therapyMetadataPresent: false,
      handoffDataComplete: false
    },
    clearToFill: {
      benefitsOrClaimCheckCompleted: false,
      prescriptionValid: false,
      prescriberClarificationRequired: false,
      prescriberClarificationResolved: true,
      remsRequired: false,
      remsAuthorizationConfirmed: true,
      inventoryAvailable: false,
      copayOrPaymentReady: false
    },
    shipment: {
      patientContactAttemptDocumented: false,
      addressConfirmed: false,
      deliveryWindowConfirmed: false,
      coldChainRequired: true,
      coldChainPackoutValidated: false,
      courierScheduled: false
    },
    fulfillment: {
      shipped: false,
      deliveryConfirmed: false,
      deliveryAttemptDocumented: false,
      temperatureLogValid: false,
      avoidableFulfillmentException: false,
      externalBlockerDocumented: false,
      exceptionReasonCode: null
    },
    updatedAt: "2026-05-28T15:05:00.000Z"
  };
}
