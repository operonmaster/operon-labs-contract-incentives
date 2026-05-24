import type { RequestType } from "@operon-labs/um-platform";

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

export interface RequestTypeOptionContent {
  id: RequestType;
  label: string;
  summary: string;
  enabled: boolean;
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
  isComplete: boolean;
}

export interface HealthPlanEditState {
  patientId: string | null;
  submitting: boolean;
}

export interface SetupContinueState extends HealthPlanEditState {
  planId: string | null;
}

export const wizardSteps: WizardStepContent[] = [
  { id: "setup", label: "Patient & Plan" },
  { id: "service", label: "Service" },
  { id: "coverage", label: "Coverage" },
  { id: "review", label: "Review" }
];

export const requestTypeOptions: RequestTypeOptionContent[] = [
  {
    id: "outpatient_service",
    label: "Outpatient Service",
    summary: "Medical services reviewed under the medical benefit, usually coded with CPT or HCPCS.",
    enabled: true
  },
  {
    id: "pharmacy_benefit",
    label: "Pharmacy Benefit",
    summary: "Prescription drug requests reviewed under the pharmacy benefit, usually identified by NDC.",
    enabled: true
  },
  {
    id: "inpatient_admission",
    label: "Inpatient Admission",
    summary: "Hospital admission workflow reserved for a later demo phase.",
    enabled: false
  }
];

export const stepContextByStep: Record<PortalStep, StepContextContent> = {
  setup: {
    title: "Select patient and plan",
    body: "Please select a patient and the active health plan for the new prior authorization request.",
    bullets: ["The plan list is tied to the selected patient.", "The selected values become read-only in later steps."]
  },
  service: {
    title: "Select request type and item",
    body: "Choose whether this is an outpatient service or pharmacy benefit request, then select the requested service or medication.",
    bullets: ["Outpatient services use CPT-style procedure codes.", "Pharmacy benefit requests use NDC-coded medication options."]
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

export function summarizeAssessmentAnswers(
  answers: AssessmentAnswerMap,
  questions: AssessmentQuestionContent[] = []
): AssessmentAnswerSummary {
  const answeredCount = questions.filter((question) => answers[question.id] !== undefined).length;

  return {
    answeredCount,
    totalCount: questions.length,
    isComplete: answeredCount === questions.length
  };
}

export function canEditHealthPlan({ patientId, submitting }: HealthPlanEditState) {
  return Boolean(patientId) && !submitting;
}

export function canContinueFromSetup({ patientId, planId, submitting }: SetupContinueState) {
  return Boolean(patientId && planId) && !submitting;
}
