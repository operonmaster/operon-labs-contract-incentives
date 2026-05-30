import { describe, expect, it } from "vitest";
import {
  parseClearToFillInput,
  parseCompleteIntakeInput,
  parseConfirmFulfillmentInput,
  parseScheduleShipmentInput
} from "./specialty-rx-input";

const validIntake = {
  prescriptionPresent: true,
  assignedPharmacyConfirmed: true,
  therapyMetadataPresent: true,
  handoffDataComplete: true
};

const validClearToFill = {
  benefitsOrClaimCheckCompleted: true,
  prescriptionValid: true,
  prescriberClarificationRequired: false,
  prescriberClarificationResolved: true,
  remsRequired: false,
  remsAuthorizationConfirmed: true,
  inventoryAvailable: true,
  copayOrPaymentReady: true
};

const validShipment = {
  patientContactAttemptDocumented: true,
  addressConfirmed: true,
  deliveryWindowConfirmed: true,
  coldChainPackoutValidated: true,
  courierScheduled: true
};

const validFulfillment = {
  shipped: true,
  deliveryConfirmed: true,
  deliveryAttemptDocumented: true,
  temperatureLogValid: true,
  avoidableFulfillmentException: false,
  externalBlockerDocumented: false,
  exceptionReasonCode: null
};

describe("specialty rx input parsers", () => {
  it("returns null for non-object bodies", () => {
    for (const value of [null, undefined, "x", 5, [], true]) {
      expect(parseCompleteIntakeInput(value)).toBeNull();
      expect(parseClearToFillInput(value)).toBeNull();
      expect(parseScheduleShipmentInput(value)).toBeNull();
      expect(parseConfirmFulfillmentInput(value)).toBeNull();
    }
  });

  it("rejects non-boolean required fields", () => {
    expect(parseCompleteIntakeInput({ ...validIntake, prescriptionPresent: "yes" })).toBeNull();
    expect(parseClearToFillInput({ ...validClearToFill, inventoryAvailable: 1 })).toBeNull();
    expect(parseScheduleShipmentInput({ ...validShipment, courierScheduled: null })).toBeNull();
    expect(parseConfirmFulfillmentInput({ ...validFulfillment, shipped: "true" })).toBeNull();
  });

  it("accepts valid intake input and keeps only known fields", () => {
    const parsed = parseCompleteIntakeInput({ ...validIntake, hacker: "x" });
    expect(parsed).toEqual(validIntake);
    expect(parsed).not.toHaveProperty("hacker");
  });

  it("drops shipment fields outside the input contract (e.g. coldChainRequired)", () => {
    const parsed = parseScheduleShipmentInput({ ...validShipment, coldChainRequired: false, hacker: "x" });
    expect(parsed).toEqual(validShipment);
    expect(parsed).not.toHaveProperty("coldChainRequired");
    expect(parsed).not.toHaveProperty("hacker");
  });

  it("accepts a string or null exceptionReasonCode and rejects other types", () => {
    expect(parseConfirmFulfillmentInput({ ...validFulfillment, exceptionReasonCode: "AVOIDABLE" })).toEqual({
      ...validFulfillment,
      exceptionReasonCode: "AVOIDABLE"
    });
    expect(parseConfirmFulfillmentInput({ ...validFulfillment, exceptionReasonCode: null })).toEqual(validFulfillment);
    // missing exceptionReasonCode defaults to null
    const { exceptionReasonCode, ...withoutReason } = validFulfillment;
    void exceptionReasonCode;
    expect(parseConfirmFulfillmentInput(withoutReason)).toEqual(validFulfillment);
    expect(parseConfirmFulfillmentInput({ ...validFulfillment, exceptionReasonCode: 42 })).toBeNull();
  });
});
