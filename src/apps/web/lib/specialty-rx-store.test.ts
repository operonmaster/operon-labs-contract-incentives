import { describe, expect, it } from "vitest";
import { createInMemorySpecialtyRxCaseStore, type SpecialtyFulfillmentCase } from "./specialty-rx-store";

const caseRecord: SpecialtyFulfillmentCase = {
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
  state: "intake_triage",
  paApprovalReceivedAt: "2026-06-18T10:00:00.000Z",
  intakeStartedAt: "2026-06-18T10:05:00.000Z",
  clearToFillAt: null,
  shipmentScheduledAt: null,
  deliveryConfirmedAt: null,
  exceptionRecordedAt: null,
  scheduleSlaHours: 24,
  deliverySlaHours: 72,
  intake: {
    approvedPaLinked: true,
    prescriptionPresent: true,
    assignedPharmacyConfirmed: true,
    therapyMetadataPresent: true,
    handoffDataComplete: true
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
  updatedAt: "2026-06-18T10:05:00.000Z"
};

describe("specialty rx case store", () => {
  it("saves, lists, and returns defensive copies", async () => {
    const store = createInMemorySpecialtyRxCaseStore();

    await store.saveCase(caseRecord);
    const listed = await store.listCases();

    expect(listed).toEqual([caseRecord]);
    listed[0]!.state = "fulfilled";
    listed[0]!.intake.prescriptionPresent = false;

    await expect(store.getCase(caseRecord.id)).resolves.toEqual(caseRecord);
  });
});
