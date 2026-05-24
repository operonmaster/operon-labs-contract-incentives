import { describe, expect, it } from "vitest";
import {
  canContinueFromSetup,
  canEditHealthPlan,
  summarizeAssessmentAnswers,
  assessmentQuestions,
  serviceOptions,
  stepContextByStep,
  type AssessmentAnswerMap,
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

  it("describes the service options with procedure codes and provider-facing detail", () => {
    expect(serviceOptions.knee_mri).toMatchObject({
      label: "Knee MRI after injury",
      procedureCode: "CPT 73721",
      procedureSummary: "MRI lower extremity joint without contrast"
    });
    expect(serviceOptions.full_body_wellness_mri).toMatchObject({
      label: "Full-body wellness MRI screening",
      procedureCode: "CPT 76498",
      procedureSummary: "Unlisted magnetic resonance procedure"
    });
  });

  it("uses medical-necessity-oriented assessment questions for knee MRI", () => {
    expect(assessmentQuestions).toHaveLength(6);
    expect(assessmentQuestions.map((question) => question.prompt)).toEqual([
      "Has a knee x-ray report been completed or reviewed for this episode of care?",
      "Is the requested MRI for acute traumatic knee pain or persistent focal knee pain after initial evaluation?",
      "Does the chart document mechanical symptoms such as locking, catching, instability, or inability to fully extend the knee?",
      "Does the exam document objective findings such as joint effusion, joint-line tenderness, positive McMurray/Apley, or ligament laxity testing?",
      "Has conservative treatment failed, or is the MRI needed for surgical planning after an acute injury?",
      "Is the clinical note or encounter documentation available to support these answers?"
    ]);
    expect(assessmentQuestions.every((question) => question.answerOptions.map((answer) => answer.value).join("/") === "yes/no")).toBe(true);
  });

  it("counts the assessment as complete when all questions are answered", () => {
    const allYes: AssessmentAnswerMap = Object.fromEntries(assessmentQuestions.map((question) => [question.id, "yes"]));
    const oneNo: AssessmentAnswerMap = { ...allYes, clinical_documentation: "no" };

    expect(summarizeAssessmentAnswers({})).toMatchObject({
      answeredCount: 0,
      totalCount: assessmentQuestions.length,
      isComplete: false
    });
    expect(summarizeAssessmentAnswers(allYes)).toMatchObject({
      answeredCount: assessmentQuestions.length,
      isComplete: true
    });
    expect(summarizeAssessmentAnswers(oneNo)).toMatchObject({
      answeredCount: assessmentQuestions.length,
      isComplete: true
    });
  });
});
