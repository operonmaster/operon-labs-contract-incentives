import type {
  ClearToFillInput,
  CompleteIntakeInput,
  ConfirmFulfillmentInput,
  ScheduleShipmentInput
} from "./specialty-rx-workflow";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function allBooleans(candidate: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof candidate[key] === "boolean");
}

export function parseCompleteIntakeInput(value: unknown): CompleteIntakeInput | null {
  const candidate = asRecord(value);
  if (!candidate || !allBooleans(candidate, [
    "prescriptionPresent",
    "assignedPharmacyConfirmed",
    "therapyMetadataPresent",
    "handoffDataComplete"
  ])) {
    return null;
  }

  return {
    prescriptionPresent: candidate.prescriptionPresent as boolean,
    assignedPharmacyConfirmed: candidate.assignedPharmacyConfirmed as boolean,
    therapyMetadataPresent: candidate.therapyMetadataPresent as boolean,
    handoffDataComplete: candidate.handoffDataComplete as boolean
  };
}

export function parseClearToFillInput(value: unknown): ClearToFillInput | null {
  const candidate = asRecord(value);
  if (!candidate || !allBooleans(candidate, [
    "benefitsOrClaimCheckCompleted",
    "prescriptionValid",
    "prescriberClarificationRequired",
    "prescriberClarificationResolved",
    "remsRequired",
    "remsAuthorizationConfirmed",
    "inventoryAvailable",
    "copayOrPaymentReady"
  ])) {
    return null;
  }

  return {
    benefitsOrClaimCheckCompleted: candidate.benefitsOrClaimCheckCompleted as boolean,
    prescriptionValid: candidate.prescriptionValid as boolean,
    prescriberClarificationRequired: candidate.prescriberClarificationRequired as boolean,
    prescriberClarificationResolved: candidate.prescriberClarificationResolved as boolean,
    remsRequired: candidate.remsRequired as boolean,
    remsAuthorizationConfirmed: candidate.remsAuthorizationConfirmed as boolean,
    inventoryAvailable: candidate.inventoryAvailable as boolean,
    copayOrPaymentReady: candidate.copayOrPaymentReady as boolean
  };
}

export function parseScheduleShipmentInput(value: unknown): ScheduleShipmentInput | null {
  const candidate = asRecord(value);
  if (!candidate || !allBooleans(candidate, [
    "patientContactAttemptDocumented",
    "addressConfirmed",
    "deliveryWindowConfirmed",
    "coldChainPackoutValidated",
    "courierScheduled"
  ])) {
    return null;
  }

  return {
    patientContactAttemptDocumented: candidate.patientContactAttemptDocumented as boolean,
    addressConfirmed: candidate.addressConfirmed as boolean,
    deliveryWindowConfirmed: candidate.deliveryWindowConfirmed as boolean,
    coldChainPackoutValidated: candidate.coldChainPackoutValidated as boolean,
    courierScheduled: candidate.courierScheduled as boolean
  };
}

export function parseConfirmFulfillmentInput(value: unknown): ConfirmFulfillmentInput | null {
  const candidate = asRecord(value);
  if (!candidate || !allBooleans(candidate, [
    "shipped",
    "deliveryConfirmed",
    "deliveryAttemptDocumented",
    "temperatureLogValid",
    "avoidableFulfillmentException",
    "externalBlockerDocumented"
  ])) {
    return null;
  }

  const exceptionReasonCode = candidate.exceptionReasonCode;
  if (
    exceptionReasonCode !== undefined &&
    exceptionReasonCode !== null &&
    typeof exceptionReasonCode !== "string"
  ) {
    return null;
  }

  return {
    shipped: candidate.shipped as boolean,
    deliveryConfirmed: candidate.deliveryConfirmed as boolean,
    deliveryAttemptDocumented: candidate.deliveryAttemptDocumented as boolean,
    temperatureLogValid: candidate.temperatureLogValid as boolean,
    avoidableFulfillmentException: candidate.avoidableFulfillmentException as boolean,
    externalBlockerDocumented: candidate.externalBlockerDocumented as boolean,
    exceptionReasonCode: typeof exceptionReasonCode === "string" ? exceptionReasonCode : null
  };
}
