import { describe, expect, it } from "vitest";
import {
  createInMemoryUmPlatform,
  getCoverageRequirements,
  type PriorAuthSubmissionInput
} from "../src/index";

describe("provider documentation UM Platform", () => {
  it("returns covered PA-required CRD requirements for knee MRI", () => {
    expect(getCoverageRequirements("knee_mri")).toMatchObject({
      serviceCode: "knee_mri",
      coveredBenefit: true,
      priorAuthRequired: true,
      documentationTemplateId: "knee-mri-pa-dtr-v1",
      reasonCode: null
    });
  });

  it("returns not-covered CRD requirements for full-body wellness MRI", () => {
    expect(getCoverageRequirements("full_body_wellness_mri")).toMatchObject({
      serviceCode: "full_body_wellness_mri",
      coveredBenefit: false,
      priorAuthRequired: true,
      documentationTemplateId: null,
      reasonCode: "BENEFIT_NOT_COVERED"
    });
  });

  it("requires acknowledgement before full-body wellness MRI submission", () => {
    const platform = createInMemoryUmPlatform();
    const input: PriorAuthSubmissionInput = {
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: false
    };

    expect(() => platform.submitPriorAuth(input)).toThrow("NOT_COVERED_ACKNOWLEDGEMENT_REQUIRED");
  });

  it("requires complete DTR documentation for knee MRI submission", () => {
    const platform = createInMemoryUmPlatform();

    expect(() =>
      platform.submitPriorAuth({
        serviceCode: "knee_mri",
        dtr: {
          symptomDurationConfirmed: true,
          conservativeTherapyConfirmed: false,
          examFindingsConfirmed: true,
          clinicalNoteAttached: true
        }
      })
    ).toThrow("DTR_DOCUMENTATION_INCOMPLETE");
  });

  it("submits knee MRI and exposes policy-safe evidence", () => {
    const platform = createInMemoryUmPlatform();

    const submitted = platform.submitPriorAuth({
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    expect(submitted).toMatchObject({
      caseId: "synthetic-pa-20931",
      serviceCode: "knee_mri",
      paResult: "submitted_pending"
    });
    expect(platform.listEvents()).toEqual([
      {
        eventType: "PAS_SUBMITTED",
        caseId: "synthetic-pa-20931"
      }
    ]);
    expect(platform.getEvidence("synthetic-pa-20931")).toMatchObject({
      caseId: "synthetic-pa-20931",
      serviceCode: "knee_mri",
      crdCoverageChecked: true,
      crdCoveredBenefit: true,
      dtrTemplateCompleted: true,
      attachmentChecklistComplete: true,
      fhirFieldsPresent: true,
      pasSubmitted: true,
      submittedBeforeInitialDecision: true,
      approvalOutcomeUsed: false,
      referralVolumeMetricUsed: false,
      containsPhi: false
    });
  });

  it("submits full-body wellness MRI with denial reason and zero-eligible evidence", () => {
    const platform = createInMemoryUmPlatform();
    platform.submitPriorAuth({
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    const submitted = platform.submitPriorAuth({
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });

    expect(submitted).toMatchObject({
      caseId: "synthetic-pa-20932",
      serviceCode: "full_body_wellness_mri",
      paResult: "denied_not_covered",
      denialReason: "BENEFIT_NOT_COVERED"
    });
    expect(platform.getEvidence("synthetic-pa-20932")).toMatchObject({
      serviceCode: "full_body_wellness_mri",
      crdCoveredBenefit: false,
      dtrTemplateCompleted: false,
      attachmentChecklistComplete: false,
      fhirFieldsPresent: false,
      pasSubmitted: true,
      denialReason: "BENEFIT_NOT_COVERED",
      paResultUsedForPositivePayment: false,
      approvalOutcomeUsed: false,
      referralVolumeMetricUsed: false,
      containsPhi: false
    });
  });

  it("does not let returned prior auth records mutate stored evidence", () => {
    const platform = createInMemoryUmPlatform();
    const submitted = platform.submitPriorAuth({
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    submitted.coverage.coveredBenefit = false;
    submitted.coverage.requiredDocumentation.length = 0;
    submitted.dtr!.clinicalNoteAttached = false;
    platform.listPriorAuths()[0]!.dtr!.examFindingsConfirmed = false;

    expect(platform.getEvidence("synthetic-pa-20931")).toMatchObject({
      crdCoveredBenefit: true,
      dtrTemplateCompleted: true,
      attachmentChecklistComplete: true,
      fhirFieldsPresent: true
    });
    expect(platform.listPriorAuths()[0]).toMatchObject({
      coverage: {
        coveredBenefit: true,
        requiredDocumentation: [
          "symptom duration",
          "conservative therapy",
          "physical exam findings",
          "clinical note attachment"
        ]
      },
      dtr: {
        clinicalNoteAttached: true,
        examFindingsConfirmed: true
      }
    });
  });
});
