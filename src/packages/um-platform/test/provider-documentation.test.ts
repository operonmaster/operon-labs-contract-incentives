import { describe, expect, it } from "vitest";
import {
  createInMemoryUmPlatform,
  generatePriorAuthCaseId,
  getCrdServiceOptions,
  getCoverageRequirements,
  getDtrQuestionnaire,
  type PriorAuthSubmissionInput
} from "../src/index";

const PA_CASE_ID_PATTERN = /^PA-\d{6}-\d{4}-[A-Z0-9]{8}$/;

describe("provider documentation UM Platform", () => {
  it("generates PA IDs with YYMMDD-HHMM timestamp and an 8-character salt", () => {
    const caseId = generatePriorAuthCaseId(new Date(2026, 4, 24, 21, 2));

    expect(caseId).toMatch(/^PA-260524-2102-[A-Z0-9]{8}$/);
  });

  it("returns covered PA-required CRD requirements for knee MRI", () => {
    expect(getCoverageRequirements("knee_mri")).toMatchObject({
      serviceCode: "knee_mri",
      requestType: "outpatient_service",
      codingSystem: "CPT",
      billingCode: "73721",
      coveredBenefit: true,
      priorAuthRequired: true,
      documentationTemplateId: "knee-mri-pa-dtr-v1",
      reasonCode: null
    });
  });

  it("returns not-covered CRD requirements for full-body wellness MRI", () => {
    expect(getCoverageRequirements("full_body_wellness_mri")).toMatchObject({
      serviceCode: "full_body_wellness_mri",
      requestType: "outpatient_service",
      coveredBenefit: false,
      priorAuthRequired: true,
      documentationTemplateId: null,
      reasonCode: "BENEFIT_NOT_COVERED"
    });
  });

  it("returns NDC-coded pharmacy benefit requirements for medication prior authorization", () => {
    expect(getCoverageRequirements("wegovy_semaglutide")).toMatchObject({
      serviceCode: "wegovy_semaglutide",
      requestType: "pharmacy_benefit",
      serviceLabel: "Wegovy (semaglutide) injection",
      codingSystem: "NDC",
      billingCode: "0169-4525-14",
      coveredBenefit: true,
      priorAuthRequired: true,
      documentationTemplateId: "pharmacy-weight-management-pa-v1",
      reasonCode: null
    });
  });

  it("returns CRD service options with provider portal display details", () => {
    const options = getCrdServiceOptions();

    expect(options.map((option) => option.serviceCode)).toEqual([
      "knee_mri",
      "full_body_wellness_mri",
      "wegovy_semaglutide",
      "humira_adalimumab"
    ]);
    expect(options.find((option) => option.serviceCode === "knee_mri")).toMatchObject({
      serviceLabel: "Knee MRI after injury",
      procedureCode: "CPT 73721",
      procedureSummary: "MRI lower extremity joint without contrast",
      details: expect.arrayContaining(["Prior authorization required"])
    });
  });

  it("returns DTR questionnaires from the seeded assessment catalog without allowing mutation", () => {
    const questionnaire = getDtrQuestionnaire("knee-mri-pa-dtr-v1");

    expect(questionnaire).toMatchObject({
      id: "knee-mri-pa-dtr-v1",
      serviceCode: "knee_mri",
      title: "Knee MRI medical necessity assessment",
      questions: expect.arrayContaining([
        expect.objectContaining({
          id: "knee_xray",
          prompt: "Has a knee x-ray report been completed or reviewed for this episode of care?"
        })
      ])
    });
    expect(questionnaire!.questions).toHaveLength(6);

    questionnaire!.questions.length = 0;

    expect(getDtrQuestionnaire("knee-mri-pa-dtr-v1")!.questions).toHaveLength(6);
  });

  it("rejects request type and selected item mismatches", () => {
    const platform = createInMemoryUmPlatform();

    expect(() =>
      platform.submitPriorAuth({
        requestType: "pharmacy_benefit",
        serviceCode: "knee_mri"
      })
    ).toThrow("REQUEST_TYPE_SERVICE_MISMATCH");
  });

  it("requires acknowledgement before full-body wellness MRI submission", () => {
    const platform = createInMemoryUmPlatform();
    const input: PriorAuthSubmissionInput = {
      requestType: "outpatient_service",
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: false
    };

    expect(() => platform.submitPriorAuth(input)).toThrow("NOT_COVERED_ACKNOWLEDGEMENT_REQUIRED");
  });

  it("allows knee MRI submission when assessment is skipped and exposes incomplete evidence", () => {
    const platform = createInMemoryUmPlatform();

    const submitted = platform.submitPriorAuth({
      patientId: "patient-andre-williams",
      patientDisplay: "Andre Williams",
      planId: "summit-health-hmo",
      planDisplay: "Summit Health HMO",
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });

    expect(submitted).toMatchObject({
      patientId: "patient-andre-williams",
      patientDisplay: "Andre Williams",
      planId: "summit-health-hmo",
      planDisplay: "Summit Health HMO",
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      state: "pend",
      outcomeStatus: null,
      dtr: null
    });
    expect(submitted).not.toHaveProperty("paResult");
    expect(submitted).not.toHaveProperty("denialReason");
    expect(submitted.caseId).toMatch(PA_CASE_ID_PATTERN);
    expect(platform.getEvidence(submitted.id)).toMatchObject({
      id: submitted.id,
      umRequestId: submitted.id,
      caseId: submitted.id,
      serviceCode: "knee_mri",
      requestType: "outpatient_service",
      crdCoveredBenefit: true,
      dtrCompleted: false,
      dtrTemplateCompleted: false,
      attachmentChecklistComplete: false,
      fhirFieldsPresent: false,
      pasSubmitted: true
    });
    expect(platform.getEvidence(submitted.id)).not.toHaveProperty("paResult");
    expect(platform.getEvidence(submitted.id)).not.toHaveProperty("denialReason");
  });

  it("does not delegate PAS-created UM requests unless explicitly requested", () => {
    const caseIds = ["PA-260526-0900-DELEGATE1", "PA-260526-0900-DELEGATE2"];
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => caseIds.shift() ?? "PA-260526-0900-DELEGATE3"
    });

    const ordinary = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const delegated = platform.submitPriorAuth({
      delegateVendorId: "northstar-um",
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });

    expect(ordinary).toMatchObject({
      id: "PA-260526-0900-DELEGATE1",
      delegateVendorId: null
    });
    expect(delegated).toMatchObject({
      delegateVendorId: "northstar-um"
    });
  });

  it("stores incomplete knee MRI assessment as incomplete evidence instead of blocking submission", () => {
    const platform = createInMemoryUmPlatform();

    const submitted = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: false,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    expect(platform.getEvidence(submitted.id)).toMatchObject({
      dtrTemplateCompleted: false,
      attachmentChecklistComplete: false,
      fhirFieldsPresent: false
    });
  });

  it("submits knee MRI and exposes policy-safe evidence", () => {
    const platform = createInMemoryUmPlatform();

    const submitted = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    expect(submitted).toMatchObject({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      state: "pend",
      outcomeStatus: null
    });
    expect(submitted).not.toHaveProperty("paResult");
    expect(submitted).not.toHaveProperty("denialReason");
    expect(submitted.caseId).toMatch(PA_CASE_ID_PATTERN);
    expect(submitted.id).toBe(submitted.caseId);
    expect(submitted.sourceCaseId).toBe(submitted.id);
    expect(platform.listEvents()).toEqual([
      {
        eventType: "PAS_SUBMITTED",
        caseId: submitted.caseId,
        umRequestId: submitted.id
      },
      {
        eventType: "UM_REQUEST_CREATED",
        caseId: submitted.caseId,
        umRequestId: submitted.id
      }
    ]);
    expect(platform.getEvidence(submitted.id)).toMatchObject({
      id: submitted.id,
      umRequestId: submitted.id,
      caseId: submitted.id,
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      crdCoverageChecked: true,
      crdCoveredBenefit: true,
      dtrCompleted: true,
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

  it("stores DTR questionnaire responses and treats all answered questions as complete evidence", () => {
    const platform = createInMemoryUmPlatform();

    const submitted = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtrQuestionnaireResponse: {
        questionnaireId: "knee-mri-pa-dtr-v1",
        answers: [
          { questionId: "knee_xray", value: "yes" },
          { questionId: "clinical_indication", value: "yes" },
          { questionId: "mechanical_symptoms", value: "no" },
          { questionId: "objective_exam", value: "yes" },
          { questionId: "treatment_or_surgical_planning", value: "yes" },
          { questionId: "clinical_documentation", value: "no" }
        ]
      }
    });

    expect(platform.listPriorAuths()[0]).toMatchObject({
      dtrQuestionnaireResponse: {
        questionnaireId: "knee-mri-pa-dtr-v1",
        answers: expect.arrayContaining([
          { questionId: "mechanical_symptoms", value: "no" },
          { questionId: "clinical_documentation", value: "no" }
        ])
      }
    });
    expect(platform.getEvidence(submitted.id)).toMatchObject({
      dtrTemplateCompleted: true,
      attachmentChecklistComplete: true,
      fhirFieldsPresent: true
    });
  });

  it("submits pharmacy benefit requests and exposes request-type evidence", () => {
    const platform = createInMemoryUmPlatform();

    const submitted = platform.submitPriorAuth({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    expect(submitted).toMatchObject({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide",
      serviceLabel: "Wegovy (semaglutide) injection",
      state: "pend",
      outcomeStatus: null
    });
    expect(submitted).not.toHaveProperty("paResult");
    expect(submitted).not.toHaveProperty("denialReason");
    expect(submitted.caseId).toMatch(PA_CASE_ID_PATTERN);
    expect(platform.getEvidence(submitted.id)).toMatchObject({
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide",
      crdCoveredBenefit: true,
      dtrTemplateCompleted: true,
      attachmentChecklistComplete: true,
      fhirFieldsPresent: true,
      pasSubmitted: true
    });
  });

  it("does not let returned PAS events mutate stored events", () => {
    const platform = createInMemoryUmPlatform();
    const submitted = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    platform.listEvents()[0]!.caseId = "PA-260524-2102-MUTATED1";

    expect(platform.listEvents()).toEqual([
      {
        eventType: "PAS_SUBMITTED",
        caseId: submitted.caseId,
        umRequestId: submitted.id
      },
      {
        eventType: "UM_REQUEST_CREATED",
        caseId: submitted.caseId,
        umRequestId: submitted.id
      }
    ]);
  });

  it("submits full-body wellness MRI with denial reason and zero-eligible evidence", () => {
    const platform = createInMemoryUmPlatform();
    platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    const submitted = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });

    expect(submitted).toMatchObject({
      requestType: "outpatient_service",
      serviceCode: "full_body_wellness_mri",
      state: "pend",
      outcomeStatus: null
    });
    expect(submitted).not.toHaveProperty("paResult");
    expect(submitted).not.toHaveProperty("denialReason");
    expect(submitted.caseId).toMatch(PA_CASE_ID_PATTERN);
    expect(platform.getEvidence(submitted.id)).toMatchObject({
      serviceCode: "full_body_wellness_mri",
      requestType: "outpatient_service",
      crdCoveredBenefit: false,
      dtrTemplateCompleted: false,
      attachmentChecklistComplete: false,
      fhirFieldsPresent: false,
      pasSubmitted: true,
      paResultUsedForPositivePayment: false,
      approvalOutcomeUsed: false,
      referralVolumeMetricUsed: false,
      containsPhi: false
    });
    expect(platform.getEvidence(submitted.id)).not.toHaveProperty("paResult");
    expect(platform.getEvidence(submitted.id)).not.toHaveProperty("denialReason");
  });

  it("returns null for missing case evidence", () => {
    const platform = createInMemoryUmPlatform();

    expect(platform.getEvidence("PA-260524-2102-MISSING1")).toBeNull();
  });

  it("does not let returned prior auth records mutate stored evidence", () => {
    const platform = createInMemoryUmPlatform();
    const submitted = platform.submitPriorAuth({
      requestType: "outpatient_service",
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

    expect(platform.getEvidence(submitted.id)).toMatchObject({
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

  it("creates a UMRequest from an accepted PAS submission and emits intake events", () => {
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-AAAA1111"
    });

    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });

    expect(umRequest).toMatchObject({
      id: "PA-260526-0900-AAAA1111",
      source: "pas_fhir",
      sourceCaseId: "PA-260526-0900-AAAA1111",
      state: "pend",
      outcomeStatus: null,
      slaHours: 24,
      documentation: {
        coverageChecked: true,
        coveredBenefit: true,
        dtrRequested: true,
        dtrCompleted: true,
        attachmentChecklistComplete: true,
        fhirFieldsPresent: true
      },
      clinicalReview: {
        reviewerId: null,
        medicalNecessityReviewed: false,
        policyCriteriaChecked: false,
        rationaleCaptured: false,
        denialReasonCode: null
      },
      auditRefs: {
        pasClaimBundleId: "PA-260526-0900-AAAA1111",
        pasClaimResponseBundleId: null
      }
    });
    expect(new Date(umRequest.slaDeadlineAt).getTime() - new Date(umRequest.pendStartedAt).getTime()).toBe(
      24 * 60 * 60 * 1000
    );
    expect(platform.listEvents()).toEqual([
      {
        eventType: "PAS_SUBMITTED",
        caseId: "PA-260526-0900-AAAA1111",
        umRequestId: "PA-260526-0900-AAAA1111"
      },
      {
        eventType: "UM_REQUEST_CREATED",
        caseId: "PA-260526-0900-AAAA1111",
        umRequestId: "PA-260526-0900-AAAA1111"
      }
    ]);
  });

  it("supports delegate clinical review state transitions with approved and denied outcomes", () => {
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-BBBB2222"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });

    const started = platform.startClinicalReview(umRequest.id, "reviewer-ana");
    expect(started).toMatchObject({
      id: umRequest.id,
      state: "in_clinical_review",
      clinicalReview: {
        reviewerId: "reviewer-ana"
      }
    });

    const determined = platform.completeClinicalReview(umRequest.id, {
      outcomeStatus: "approved",
      medicalNecessityReviewed: true,
      policyCriteriaChecked: true,
      rationaleCaptured: true
    });

    expect(determined).toMatchObject({
      id: umRequest.id,
      state: "determined",
      outcomeStatus: "approved",
      clinicalReview: {
        medicalNecessityReviewed: true,
        policyCriteriaChecked: true,
        rationaleCaptured: true,
        denialReasonCode: null
      }
    });
  });

  it("requires a denial reason when a delegate review is denied", () => {
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-CCCC3333"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    platform.startClinicalReview(umRequest.id, "reviewer-ana");

    expect(() =>
      platform.completeClinicalReview(umRequest.id, {
        outcomeStatus: "denied",
        medicalNecessityReviewed: true,
        policyCriteriaChecked: true,
        rationaleCaptured: true
      })
    ).toThrow("DENIAL_REASON_REQUIRED");
  });

  it("requires clinical review to start before a delegate review is completed", () => {
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-DDDD4444"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });

    expect(() =>
      platform.completeClinicalReview(umRequest.id, {
        outcomeStatus: "approved",
        medicalNecessityReviewed: true,
        policyCriteriaChecked: true,
        rationaleCaptured: true
      })
    ).toThrow("UM_REQUEST_NOT_IN_CLINICAL_REVIEW");
  });

  it("requires a complete delegate review checklist before determination", () => {
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-EEEE5555"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    platform.startClinicalReview(umRequest.id, "reviewer-ana");

    expect(() =>
      platform.completeClinicalReview(umRequest.id, {
        outcomeStatus: "approved",
        medicalNecessityReviewed: true,
        policyCriteriaChecked: false,
        rationaleCaptured: true
      })
    ).toThrow("CLINICAL_REVIEW_INCOMPLETE");
  });
});
