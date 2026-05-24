import type { RequestType, ServiceCode } from "@operon-labs/um-platform";

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
  requestType: Exclude<RequestType, "inpatient_admission">;
  codingSystem: "CPT" | "NDC";
  procedureCode: string;
  procedureSummary: string;
  description: string;
  details: string[];
  assessmentTitle: string;
  assessmentIntro: string;
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

export const serviceOptionsByRequestType: Record<Exclude<RequestType, "inpatient_admission">, ServiceCode[]> = {
  outpatient_service: ["knee_mri", "full_body_wellness_mri"],
  pharmacy_benefit: ["wegovy_semaglutide", "humira_adalimumab"]
};

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

export const serviceOptions: Record<ServiceCode, ServiceOptionContent> = {
  knee_mri: {
    label: "Knee MRI after injury",
    requestType: "outpatient_service",
    codingSystem: "CPT",
    procedureCode: "CPT 73721",
    procedureSummary: "MRI lower extremity joint without contrast",
    description:
      "Non-contrast MRI of the knee to evaluate suspected internal derangement, meniscal injury, ligament injury, occult fracture, or persistent focal pain after initial assessment.",
    details: ["Prior authorization required", "Coverage may be confirmed when medical-necessity evidence is present", "Assessment answers support documentation completeness"],
    assessmentTitle: "Knee MRI medical necessity assessment",
    assessmentIntro: "Answer each payer-requested documentation question. These answers determine whether the request has complete supporting documentation."
  },
  full_body_wellness_mri: {
    label: "Full-body wellness MRI screening",
    requestType: "outpatient_service",
    codingSystem: "CPT",
    procedureCode: "CPT 76498",
    procedureSummary: "Unlisted magnetic resonance procedure",
    description:
      "Whole-body MRI screening requested without symptoms or a high-risk syndrome indication. This demo plan treats it as a non-covered wellness screening benefit.",
    details: ["Not covered as routine wellness screening", "Can still be submitted with a denial reason", "No clinical assessment is requested"],
    assessmentTitle: "Full-body MRI documentation assessment",
    assessmentIntro: "No extra documentation assessment is requested because the benefit is not covered in this demo."
  },
  wegovy_semaglutide: {
    label: "Wegovy (semaglutide) injection",
    requestType: "pharmacy_benefit",
    codingSystem: "NDC",
    procedureCode: "NDC 0169-4525-14",
    procedureSummary: "Glucagon-like peptide-1 receptor agonist",
    description:
      "Prescription weight-management therapy that commonly requires pharmacy-benefit prior authorization with diagnosis, BMI or comorbidity criteria, and prior lifestyle-program documentation.",
    details: ["Prior authorization required", "Pharmacy benefit request", "Medication is identified with an NDC rather than a CPT code"],
    assessmentTitle: "Pharmacy benefit documentation assessment",
    assessmentIntro: "Answer each payer-requested pharmacy documentation question before submitting the medication prior authorization."
  },
  humira_adalimumab: {
    label: "Humira (adalimumab) Pen",
    requestType: "pharmacy_benefit",
    codingSystem: "NDC",
    procedureCode: "NDC 0074-0554-02",
    procedureSummary: "TNF blocker specialty biologic",
    description:
      "Specialty biologic medication request that commonly requires diagnosis, prior therapy history, specialist documentation, and safety-screening support.",
    details: ["Prior authorization required", "Specialty pharmacy review", "Medication is identified with an NDC rather than a CPT code"],
    assessmentTitle: "Specialty medication documentation assessment",
    assessmentIntro: "Answer each payer-requested pharmacy documentation question before submitting the medication prior authorization."
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

export const pharmacyAssessmentQuestions: AssessmentQuestionContent[] = [
  {
    id: "drug_indication",
    prompt: "Is the diagnosis or covered indication documented for the requested medication?",
    helper: "Pharmacy prior authorization commonly verifies that the drug is requested for a covered indication.",
    answerOptions: yesNoAnswerOptions
  },
  {
    id: "dose_quantity_duration",
    prompt: "Are the requested dose, quantity, days supply, and intended duration documented?",
    helper: "Medication reviews need enough detail to validate the requested drug and benefit limits.",
    answerOptions: yesNoAnswerOptions
  },
  {
    id: "prior_therapy",
    prompt: "Is prior therapy, contraindication, or step-therapy history documented when required?",
    helper: "Many pharmacy benefit policies require evidence of preferred-drug trials or a clinical reason to bypass them.",
    answerOptions: yesNoAnswerOptions
  },
  {
    id: "pharmacy_notes",
    prompt: "Are relevant chart notes, labs, or specialist documentation available to support the request?",
    helper: "Supporting documentation makes the PA submission complete without sending policy evaluation PHI to the incentive agent.",
    answerOptions: yesNoAnswerOptions
  }
];

export function getAssessmentQuestionsForService(service: ServiceOptionContent | null): AssessmentQuestionContent[] {
  if (!service || service.requestType === "outpatient_service") {
    return assessmentQuestions;
  }

  return pharmacyAssessmentQuestions;
}

export function summarizeAssessmentAnswers(
  answers: AssessmentAnswerMap,
  questions: AssessmentQuestionContent[] = assessmentQuestions
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
