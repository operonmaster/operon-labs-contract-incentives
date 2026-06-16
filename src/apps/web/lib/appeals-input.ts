import type {
  AcknowledgeAppealInput,
  AssembleAppealPacketInput,
  IndexAppealEvidenceInput,
  ResolveMissingInfoInput,
  RetrieveOriginalDecisionInput,
  RouteAppealReviewerInput,
  StartAppealInput,
  ValidateAppealIntakeInput
} from "./appeals-workflow";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function allBooleans(candidate: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof candidate[key] === "boolean");
}

export function parseStartAppealInput(value: unknown): (StartAppealInput & { umRequestId: string }) | null {
  const candidate = asRecord(value);
  if (!candidate || typeof candidate.umRequestId !== "string" || !candidate.umRequestId.startsWith("PA-")) {
    return null;
  }
  if (candidate.expedited !== undefined && typeof candidate.expedited !== "boolean") {
    return null;
  }

  return {
    umRequestId: candidate.umRequestId,
    expedited: candidate.expedited === true
  };
}

export function parseAcknowledgeAppealInput(value: unknown): AcknowledgeAppealInput | null {
  const candidate = asRecord(value);
  if (!candidate || !allBooleans(candidate, ["appealRequestAcknowledged"])) {
    return null;
  }

  return {
    appealRequestAcknowledged: candidate.appealRequestAcknowledged as boolean
  };
}

export function parseValidateAppealIntakeInput(value: unknown): ValidateAppealIntakeInput | null {
  const candidate = asRecord(value);
  if (!candidate || !allBooleans(candidate, [
    "appealRequestPresent",
    "appellantAuthorized",
    "planMemberMatched",
    "requestedServiceMatched"
  ])) {
    return null;
  }

  return {
    appealRequestPresent: candidate.appealRequestPresent as boolean,
    appellantAuthorized: candidate.appellantAuthorized as boolean,
    planMemberMatched: candidate.planMemberMatched as boolean,
    requestedServiceMatched: candidate.requestedServiceMatched as boolean
  };
}

export function parseRetrieveOriginalDecisionInput(value: unknown): RetrieveOriginalDecisionInput | null {
  const candidate = asRecord(value);
  if (!candidate || !allBooleans(candidate, [
    "denialReasonRetrieved",
    "priorDecisionSummaryIncluded",
    "coveragePolicyLocated"
  ])) {
    return null;
  }

  return {
    denialReasonRetrieved: candidate.denialReasonRetrieved as boolean,
    priorDecisionSummaryIncluded: candidate.priorDecisionSummaryIncluded as boolean,
    coveragePolicyLocated: candidate.coveragePolicyLocated as boolean
  };
}

export function parseResolveMissingInfoInput(value: unknown): ResolveMissingInfoInput | null {
  const candidate = asRecord(value);
  if (!candidate || !allBooleans(candidate, [
    "missingInfoRequired",
    "missingInfoRequested",
    "missingInfoResolved"
  ])) {
    return null;
  }

  return {
    missingInfoRequired: candidate.missingInfoRequired as boolean,
    missingInfoRequested: candidate.missingInfoRequested as boolean,
    missingInfoResolved: candidate.missingInfoResolved as boolean
  };
}

export function parseAssembleAppealPacketInput(value: unknown): AssembleAppealPacketInput | null {
  const candidate = asRecord(value);
  if (!candidate || !allBooleans(candidate, [
    "requiredDocumentsPresent",
    "clinicalRationaleIncluded",
    "policyCitationIncluded",
    "evidenceIndexComplete",
    "qualityAuditPassed",
    "noReworkRequired"
  ])) {
    return null;
  }

  return {
    requiredDocumentsPresent: candidate.requiredDocumentsPresent as boolean,
    clinicalRationaleIncluded: candidate.clinicalRationaleIncluded as boolean,
    policyCitationIncluded: candidate.policyCitationIncluded as boolean,
    evidenceIndexComplete: candidate.evidenceIndexComplete as boolean,
    qualityAuditPassed: candidate.qualityAuditPassed as boolean,
    noReworkRequired: candidate.noReworkRequired as boolean
  };
}

export function parseIndexAppealEvidenceInput(value: unknown): IndexAppealEvidenceInput | null {
  const candidate = asRecord(value);
  if (!candidate || !allBooleans(candidate, [
    "evidenceIndexComplete",
    "phiSafeForPaymentMetadata"
  ])) {
    return null;
  }

  return {
    evidenceIndexComplete: candidate.evidenceIndexComplete as boolean,
    phiSafeForPaymentMetadata: candidate.phiSafeForPaymentMetadata as boolean
  };
}

export function parseRouteAppealReviewerInput(value: unknown): RouteAppealReviewerInput | null {
  const candidate = asRecord(value);
  if (!candidate || !allBooleans(candidate, [
    "reviewerQueueSelected",
    "reviewerConflictCheckComplete"
  ])) {
    return null;
  }

  return {
    reviewerQueueSelected: candidate.reviewerQueueSelected as boolean,
    reviewerConflictCheckComplete: candidate.reviewerConflictCheckComplete as boolean
  };
}
