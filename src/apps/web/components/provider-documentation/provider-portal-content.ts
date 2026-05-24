import type { ServiceCode } from "@operon-labs/um-platform";

export type PortalStep = "setup" | "service" | "coverage" | "review";

export interface WizardStepContent {
  id: PortalStep;
  label: string;
}

export interface StepContextContent {
  title: string;
  body: string;
  bullets: string[];
}

export interface ServiceOptionContent {
  label: string;
  procedureCode: string;
  procedureSummary: string;
  description: string;
  details: string[];
}

export const wizardSteps: WizardStepContent[] = [
  { id: "setup", label: "Patient & Plan" },
  { id: "service", label: "Service" },
  { id: "coverage", label: "Coverage" },
  { id: "review", label: "Review" }
];

export const stepContextByStep: Record<PortalStep, StepContextContent> = {
  setup: {
    title: "Select patient and plan",
    body: "Please select a patient and the active health plan for the new prior authorization request.",
    bullets: ["The plan list is tied to the selected patient.", "The selected values become read-only in later steps."]
  },
  service: {
    title: "Search for the requested service",
    body: "Choose the imaging service or procedure code the provider is requesting.",
    bullets: ["Selecting a service reveals clinical and coding context.", "The next step checks coverage and request requirements."]
  },
  coverage: {
    title: "Check coverage and requirements",
    body: "Review the plan response. Covered services may require an assessment before submission.",
    bullets: ["Covered services may require a short medical-necessity assessment.", "Not-covered services require acknowledgement before review."]
  },
  review: {
    title: "Review and submit",
    body: "Confirm the completed request details before submitting the prior authorization.",
    bullets: ["Submission creates a PA ID.", "The plan-side incentive workflow evaluates the submitted request separately."]
  }
};

export const serviceOptions: Record<ServiceCode, ServiceOptionContent> = {
  knee_mri: {
    label: "Knee MRI after injury",
    procedureCode: "CPT 73721",
    procedureSummary: "MRI lower extremity joint without contrast",
    description:
      "Non-contrast MRI of the knee to evaluate suspected internal derangement, meniscal injury, ligament injury, occult fracture, or persistent focal pain after initial assessment.",
    details: ["Prior authorization required", "Coverage may be confirmed when medical-necessity evidence is present", "Assessment answers support documentation completeness"]
  },
  full_body_wellness_mri: {
    label: "Full-body wellness MRI screening",
    procedureCode: "CPT 76498",
    procedureSummary: "Unlisted magnetic resonance procedure",
    description:
      "Whole-body MRI screening requested without symptoms or a high-risk syndrome indication. This demo plan treats it as a non-covered wellness screening benefit.",
    details: ["Not covered as routine wellness screening", "Can still be submitted with a denial reason", "No clinical assessment is requested"]
  }
};

export const assessmentQuestions = [
  "Has a knee x-ray been completed or reviewed for this episode of care?",
  "Was there an acute twisting injury, direct trauma, or persistent focal knee pain?",
  "Are there objective exam findings such as effusion, instability, locking, or a positive meniscal test?",
  "Has conservative treatment been attempted, or are acute mechanical findings documented?"
];
