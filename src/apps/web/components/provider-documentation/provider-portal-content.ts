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

export type AssessmentAnswerValue = "yes" | "no";
export type AssessmentAnswerMap = Partial<Record<string, AssessmentAnswerValue>>;

export interface AssessmentAnswerOption {
  value: AssessmentAnswerValue;
  label: string;
}

export interface AssessmentQuestionContent {
  id: string;
  prompt: string;
  helper: string;
  answerOptions: AssessmentAnswerOption[];
}

export interface AssessmentAnswerSummary {
  answeredCount: number;
  totalCount: number;
  allAnswered: boolean;
  supportsMedicalNecessity: boolean;
}

const yesNoAnswerOptions: AssessmentAnswerOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" }
];

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

export const assessmentQuestions: AssessmentQuestionContent[] = [
  {
    id: "knee_xray",
    prompt: "Has a knee x-ray report been completed or reviewed for this episode of care?",
    helper: "Most knee MRI policies expect initial radiographs or a documented reason they are not useful.",
    answerOptions: yesNoAnswerOptions
  },
  {
    id: "clinical_indication",
    prompt: "Is the requested MRI for acute traumatic knee pain or persistent focal knee pain after initial evaluation?",
    helper: "This separates a diagnostic knee MRI from generalized or screening imaging.",
    answerOptions: yesNoAnswerOptions
  },
  {
    id: "mechanical_symptoms",
    prompt: "Does the chart document mechanical symptoms such as locking, catching, instability, or inability to fully extend the knee?",
    helper: "Mechanical symptoms support suspected meniscal, ligament, or internal derangement pathology.",
    answerOptions: yesNoAnswerOptions
  },
  {
    id: "objective_exam",
    prompt:
      "Does the exam document objective findings such as joint effusion, joint-line tenderness, positive McMurray/Apley, or ligament laxity testing?",
    helper: "Plans commonly look for physical exam findings rather than pain alone.",
    answerOptions: yesNoAnswerOptions
  },
  {
    id: "treatment_or_surgical_planning",
    prompt: "Has conservative treatment failed, or is the MRI needed for surgical planning after an acute injury?",
    helper: "Conservative care or surgical planning is a common branch in knee MRI medical-necessity review.",
    answerOptions: yesNoAnswerOptions
  },
  {
    id: "clinical_documentation",
    prompt: "Is the clinical note or encounter documentation available to support these answers?",
    helper: "The PA can be submitted without it, but the documentation-completeness incentive should not pass.",
    answerOptions: yesNoAnswerOptions
  }
];

export function summarizeAssessmentAnswers(answers: AssessmentAnswerMap): AssessmentAnswerSummary {
  const answeredCount = assessmentQuestions.filter((question) => answers[question.id] !== undefined).length;
  const allAnswered = answeredCount === assessmentQuestions.length;

  return {
    answeredCount,
    totalCount: assessmentQuestions.length,
    allAnswered,
    supportsMedicalNecessity: allAnswered && assessmentQuestions.every((question) => answers[question.id] === "yes")
  };
}
