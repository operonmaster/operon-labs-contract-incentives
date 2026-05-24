import { describe, expect, it, vi } from "vitest";
import { createInMemoryUmPlatform } from "@operon-labs/um-platform";
import type { ProviderDocumentationEvidence } from "@operon-labs/um-platform";
import { evaluateProviderDocumentationEvent } from "../src/index";

describe("evaluateProviderDocumentationEvent", () => {
  it("pulls evidence by caseId and approves complete knee MRI documentation", () => {
    const platform = createInMemoryUmPlatform();
    const priorAuth = platform.submitPriorAuth({
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const getEvidence = vi.fn(platform.getEvidence);

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "PAS_SUBMITTED", caseId: priorAuth.caseId },
      { getEvidenceByCaseId: getEvidence, monthToDateAmount: 0 }
    );

    expect(getEvidence).toHaveBeenCalledWith("synthetic-pa-20931");
    expect(evaluation.request.requestObject).toMatchObject({
      caseId: "synthetic-pa-20931",
      crdCoveredBenefit: true,
      dtrTemplateCompleted: true,
      pasSubmitted: true
    });
    expect(evaluation.result).toMatchObject({
      decision: "approved",
      amount: 3,
      currency: "USDC",
      walletId: "0.0.23456",
      reasonCodes: []
    });
  });

  it("blocks full-body wellness MRI with zero incentive", () => {
    const platform = createInMemoryUmPlatform();
    const priorAuth = platform.submitPriorAuth({
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "PAS_SUBMITTED", caseId: priorAuth.caseId },
      { getEvidenceByCaseId: platform.getEvidence, monthToDateAmount: 0 }
    );

    expect(evaluation.result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: expect.arrayContaining([
        "SERVICE_NOT_COVERED",
        "DTR_TEMPLATE_INCOMPLETE",
        "ATTACHMENT_CHECKLIST_INCOMPLETE",
        "FHIR_FIELDS_MISSING"
      ])
    });
  });

  it("rejects non-PAS events before evidence lookup", () => {
    const getEvidence = vi.fn();

    expect(() =>
      evaluateProviderDocumentationEvent(
        { eventType: "OTHER_EVENT", caseId: "synthetic-pa-99999" },
        { getEvidenceByCaseId: getEvidence, monthToDateAmount: 0 }
      )
    ).toThrow("UNSUPPORTED_PROVIDER_DOCUMENTATION_EVENT");
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("throws when PAS evidence is missing for the caseId", () => {
    const getEvidence = vi.fn(() => null);

    expect(() =>
      evaluateProviderDocumentationEvent(
        { eventType: "PAS_SUBMITTED", caseId: "synthetic-pa-40404" },
        { getEvidenceByCaseId: getEvidence, monthToDateAmount: 0 }
      )
    ).toThrow("PROVIDER_DOCUMENTATION_EVIDENCE_NOT_FOUND:synthetic-pa-40404");
    expect(getEvidence).toHaveBeenCalledWith("synthetic-pa-40404");
  });

  it("blocks payment when a prohibited approval outcome metric is present", () => {
    const evidence = {
      caseId: "synthetic-pa-20931",
      submitter: { type: "provider_admin_team", id: "lakeside-provider-admin" },
      serviceCode: "knee_mri",
      crdCoverageChecked: true,
      crdCoveredBenefit: true,
      dtrTemplateCompleted: true,
      attachmentChecklistComplete: true,
      fhirFieldsPresent: true,
      pasSubmitted: true,
      submittedBeforeInitialDecision: true,
      paResult: "submitted_pending",
      denialReason: null,
      paResultUsedForPositivePayment: false,
      approvalOutcomeUsed: true,
      referralVolumeMetricUsed: false,
      containsPhi: false
    } as unknown as ProviderDocumentationEvidence;

    const evaluation = evaluateProviderDocumentationEvent(
      { eventType: "PAS_SUBMITTED", caseId: evidence.caseId },
      { getEvidenceByCaseId: () => evidence, monthToDateAmount: 0 }
    );

    expect(evaluation.result).toMatchObject({
      decision: "blocked",
      amount: 0,
      walletId: null,
      reasonCodes: expect.arrayContaining(["PROHIBITED_OUTCOME_METRIC"])
    });
  });
});
