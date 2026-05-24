import { describe, expect, it } from "vitest";
import {
  canContinueFromSetup,
  canEditHealthPlan,
  summarizeAssessmentAnswers,
  requestTypeOptions,
  stepContextByStep,
  type AssessmentAnswerMap,
  type AssessmentQuestionContent,
  wizardSteps
} from "./provider-portal-content";

describe("provider portal content", () => {
  it("uses a four-step portal flow with patient and plan collapsed into one step", () => {
    expect(wizardSteps.map((step) => step.label)).toEqual(["Patient & Plan", "Service", "Coverage", "Review"]);
    expect(stepContextByStep.setup.title).toBe("Select patient and plan");
  });

  it("requires patient selection before health plan selection and setup progression", () => {
    expect(canEditHealthPlan({ patientId: null, submitting: false })).toBe(false);
    expect(canEditHealthPlan({ patientId: "patient-maya-chen", submitting: false })).toBe(true);
    expect(canEditHealthPlan({ patientId: "patient-maya-chen", submitting: true })).toBe(false);

    expect(canContinueFromSetup({ patientId: null, planId: "acme-health-ppo", submitting: false })).toBe(false);
    expect(canContinueFromSetup({ patientId: "patient-maya-chen", planId: null, submitting: false })).toBe(false);
    expect(canContinueFromSetup({ patientId: "patient-maya-chen", planId: "acme-health-ppo", submitting: false })).toBe(true);
    expect(canContinueFromSetup({ patientId: "patient-maya-chen", planId: "acme-health-ppo", submitting: true })).toBe(false);
  });

  it("describes the supported request types and keeps inpatient dormant", () => {
    expect(requestTypeOptions.map((option) => option.label)).toEqual([
      "Outpatient Service",
      "Pharmacy Benefit",
      "Inpatient Admission"
    ]);
    expect(requestTypeOptions.find((option) => option.id === "inpatient_admission")).toMatchObject({
      enabled: false
    });
  });

  it("counts the assessment as complete when all questions are answered", () => {
    const assessmentQuestions: AssessmentQuestionContent[] = [
      {
        id: "clinical_indication",
        prompt: "Is the requested item clinically indicated?",
        helper: "Used only for summary-state testing.",
        answerOptions: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" }
        ]
      },
      {
        id: "clinical_documentation",
        prompt: "Is supporting documentation available?",
        helper: "Used only for summary-state testing.",
        answerOptions: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" }
        ]
      }
    ];
    const allYes: AssessmentAnswerMap = Object.fromEntries(assessmentQuestions.map((question) => [question.id, "yes"]));
    const oneNo: AssessmentAnswerMap = { ...allYes, clinical_documentation: "no" };

    expect(summarizeAssessmentAnswers({}, assessmentQuestions)).toMatchObject({
      answeredCount: 0,
      totalCount: assessmentQuestions.length,
      isComplete: false
    });
    expect(summarizeAssessmentAnswers(allYes, assessmentQuestions)).toMatchObject({
      answeredCount: assessmentQuestions.length,
      isComplete: true
    });
    expect(summarizeAssessmentAnswers(oneNo, assessmentQuestions)).toMatchObject({
      answeredCount: assessmentQuestions.length,
      isComplete: true
    });
  });
});
