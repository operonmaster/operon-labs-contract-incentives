import { describe, expect, it } from "vitest";
import {
  assessmentQuestions,
  serviceOptions,
  stepContextByStep,
  wizardSteps
} from "./provider-portal-content";

describe("provider portal content", () => {
  it("uses a four-step portal flow with patient and plan collapsed into one step", () => {
    expect(wizardSteps.map((step) => step.label)).toEqual(["Patient & Plan", "Service", "Coverage", "Review"]);
    expect(stepContextByStep.setup.title).toBe("Select patient and plan");
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
    expect(assessmentQuestions).toEqual([
      "Has a knee x-ray been completed or reviewed for this episode of care?",
      "Was there an acute twisting injury, direct trauma, or persistent focal knee pain?",
      "Are there objective exam findings such as effusion, instability, locking, or a positive meniscal test?",
      "Has conservative treatment been attempted, or are acute mechanical findings documented?"
    ]);
  });
});
