import type { CoverageRequirements, RequestType, ServiceCode } from "./index";

export type DtrAnswerValue = "yes" | "no";

export interface CrdServiceOption extends CoverageRequirements {
  procedureCode: string;
  procedureSummary: string;
  description: string;
  details: string[];
  assessmentTitle: string;
  assessmentIntro: string;
}

export interface DtrAnswerOption {
  value: DtrAnswerValue;
  label: string;
}

export interface DtrQuestion {
  id: string;
  prompt: string;
  helper: string;
  answerOptions: DtrAnswerOption[];
}

export interface DtrQuestionnaire {
  id: string;
  requestType: RequestType;
  serviceCode: ServiceCode;
  title: string;
  intro: string;
  questions: DtrQuestion[];
}

export interface DtrQuestionnaireAnswer {
  questionId: string;
  value: DtrAnswerValue;
}

export interface DtrQuestionnaireResponse {
  questionnaireId: string;
  answers: DtrQuestionnaireAnswer[];
}

const yesNoAnswerOptions: DtrAnswerOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" }
];

const crdServiceOptions: Record<ServiceCode, CrdServiceOption> = {
  knee_mri: serviceOption({
    requestType: "outpatient_service",
    serviceCode: "knee_mri",
    serviceLabel: "Knee MRI after injury",
    codingSystem: "CPT",
    billingCode: "73721",
    coveredBenefit: true,
    priorAuthRequired: true,
    documentationTemplateId: "knee-mri-pa-dtr-v1",
    requiredDocumentation: [
      "symptom duration",
      "conservative therapy",
      "physical exam findings",
      "clinical note attachment"
    ],
    reasonCode: null,
    procedureSummary: "MRI lower extremity joint without contrast",
    description:
      "Non-contrast MRI of the knee to evaluate suspected internal derangement, meniscal injury, ligament injury, occult fracture, or persistent focal pain after initial assessment.",
    details: [
      "Prior authorization required",
      "Coverage may be confirmed when medical-necessity evidence is present",
      "Assessment answers support documentation completeness"
    ],
    assessmentTitle: "Knee MRI medical necessity assessment",
    assessmentIntro:
      "Answer each payer-requested documentation question. These answers determine whether the request has complete supporting documentation."
  }),
  full_body_wellness_mri: serviceOption({
    requestType: "outpatient_service",
    serviceCode: "full_body_wellness_mri",
    serviceLabel: "Full-body wellness MRI screening",
    codingSystem: "CPT",
    billingCode: "76498",
    coveredBenefit: false,
    priorAuthRequired: true,
    documentationTemplateId: null,
    requiredDocumentation: [],
    reasonCode: "BENEFIT_NOT_COVERED",
    procedureSummary: "Unlisted magnetic resonance procedure",
    description:
      "Whole-body MRI screening requested without symptoms or a high-risk syndrome indication. This demo plan treats it as a non-covered wellness screening benefit.",
    details: [
      "Not covered as routine wellness screening",
      "Can still be submitted with a denial reason",
      "No clinical assessment is requested"
    ],
    assessmentTitle: "Full-body MRI documentation assessment",
    assessmentIntro: "No extra documentation assessment is requested because the benefit is not covered in this demo."
  }),
  wegovy_semaglutide: serviceOption({
    requestType: "pharmacy_benefit",
    serviceCode: "wegovy_semaglutide",
    serviceLabel: "Wegovy (semaglutide) injection",
    codingSystem: "NDC",
    billingCode: "0169-4525-14",
    coveredBenefit: true,
    priorAuthRequired: true,
    documentationTemplateId: "pharmacy-weight-management-pa-v1",
    requiredDocumentation: [
      "diagnosis and indication",
      "BMI or comorbidity criteria",
      "prior therapy or lifestyle program documentation",
      "clinical note attachment"
    ],
    reasonCode: null,
    procedureSummary: "Glucagon-like peptide-1 receptor agonist",
    description:
      "Prescription weight-management therapy that commonly requires pharmacy-benefit prior authorization with diagnosis, BMI or comorbidity criteria, and prior lifestyle-program documentation.",
    details: [
      "Prior authorization required",
      "Pharmacy benefit request",
      "Medication is identified with an NDC rather than a CPT code"
    ],
    assessmentTitle: "Pharmacy benefit documentation assessment",
    assessmentIntro: "Answer each payer-requested pharmacy documentation question before submitting the medication prior authorization."
  }),
  humira_adalimumab: serviceOption({
    requestType: "pharmacy_benefit",
    serviceCode: "humira_adalimumab",
    serviceLabel: "Humira (adalimumab) Pen",
    codingSystem: "NDC",
    billingCode: "0074-0554-02",
    coveredBenefit: true,
    priorAuthRequired: true,
    documentationTemplateId: "specialty-biologic-pa-v1",
    requiredDocumentation: [
      "diagnosis and indication",
      "prior therapy history",
      "specialist note attachment",
      "safety screening attestation"
    ],
    reasonCode: null,
    procedureSummary: "TNF blocker specialty biologic",
    description:
      "Specialty biologic medication request that commonly requires diagnosis, prior therapy history, specialist documentation, and safety-screening support.",
    details: [
      "Prior authorization required",
      "Specialty pharmacy review",
      "Medication is identified with an NDC rather than a CPT code"
    ],
    assessmentTitle: "Specialty medication documentation assessment",
    assessmentIntro: "Answer each payer-requested pharmacy documentation question before submitting the medication prior authorization."
  })
};

const dtrQuestionnaires: Record<string, DtrQuestionnaire> = {
  "knee-mri-pa-dtr-v1": {
    id: "knee-mri-pa-dtr-v1",
    requestType: "outpatient_service",
    serviceCode: "knee_mri",
    title: "Knee MRI medical necessity assessment",
    intro: "Answer each payer-requested documentation question. These answers determine whether the request has complete supporting documentation.",
    questions: [
      question(
        "knee_xray",
        "Has a knee x-ray report been completed or reviewed for this episode of care?",
        "Most knee MRI policies expect initial radiographs or a documented reason they are not useful."
      ),
      question(
        "clinical_indication",
        "Is the requested MRI for acute traumatic knee pain or persistent focal knee pain after initial evaluation?",
        "This separates a diagnostic knee MRI from generalized or screening imaging."
      ),
      question(
        "mechanical_symptoms",
        "Does the chart document mechanical symptoms such as locking, catching, instability, or inability to fully extend the knee?",
        "Mechanical symptoms support suspected meniscal, ligament, or internal derangement pathology."
      ),
      question(
        "objective_exam",
        "Does the exam document objective findings such as joint effusion, joint-line tenderness, positive McMurray/Apley, or ligament laxity testing?",
        "Plans commonly look for physical exam findings rather than pain alone."
      ),
      question(
        "treatment_or_surgical_planning",
        "Has conservative treatment failed, or is the MRI needed for surgical planning after an acute injury?",
        "Conservative care or surgical planning is a common branch in knee MRI medical-necessity review."
      ),
      question(
        "clinical_documentation",
        "Is the clinical note or encounter documentation available to support these answers?",
        "The PA can be submitted without it, but the documentation-completeness incentive should not pass."
      )
    ]
  },
  "pharmacy-weight-management-pa-v1": pharmacyQuestionnaire(
    "pharmacy-weight-management-pa-v1",
    "wegovy_semaglutide",
    "Pharmacy benefit documentation assessment"
  ),
  "specialty-biologic-pa-v1": pharmacyQuestionnaire(
    "specialty-biologic-pa-v1",
    "humira_adalimumab",
    "Specialty medication documentation assessment"
  )
};

export function getCrdServiceOptions(): CrdServiceOption[] {
  return Object.values(crdServiceOptions).map(copyCrdServiceOption);
}

export function getCrdServiceOption(serviceCode: ServiceCode): CrdServiceOption {
  return copyCrdServiceOption(crdServiceOptions[serviceCode]);
}

export function getCrdCoverageRequirements(serviceCode: ServiceCode): CoverageRequirements {
  const option = crdServiceOptions[serviceCode];

  return {
    requestType: option.requestType,
    serviceCode: option.serviceCode,
    serviceLabel: option.serviceLabel,
    codingSystem: option.codingSystem,
    billingCode: option.billingCode,
    coveredBenefit: option.coveredBenefit,
    priorAuthRequired: option.priorAuthRequired,
    documentationTemplateId: option.documentationTemplateId,
    requiredDocumentation: [...option.requiredDocumentation],
    reasonCode: option.reasonCode
  };
}

export function getDtrQuestionnaire(questionnaireId: string): DtrQuestionnaire | null {
  const questionnaire = dtrQuestionnaires[questionnaireId];

  return questionnaire ? copyDtrQuestionnaire(questionnaire) : null;
}

export function copyDtrQuestionnaireResponse(
  response: DtrQuestionnaireResponse | null | undefined
): DtrQuestionnaireResponse | null {
  if (!response) {
    return null;
  }

  return {
    questionnaireId: response.questionnaireId,
    answers: response.answers.map((answer) => ({ ...answer }))
  };
}

export function isCompleteDtrQuestionnaireResponse(
  response: DtrQuestionnaireResponse | null | undefined,
  expectedQuestionnaireId: string | null
): boolean {
  if (!response || !expectedQuestionnaireId || response.questionnaireId !== expectedQuestionnaireId) {
    return false;
  }

  const questionnaire = dtrQuestionnaires[expectedQuestionnaireId];
  if (!questionnaire) {
    return false;
  }

  const answers = new Map(response.answers.map((answer) => [answer.questionId, answer.value]));

  return questionnaire.questions.every((questionnaireQuestion) => {
    const value = answers.get(questionnaireQuestion.id);
    return value === "yes" || value === "no";
  });
}

function serviceOption(
  option: CoverageRequirements & {
    procedureSummary: string;
    description: string;
    details: string[];
    assessmentTitle: string;
    assessmentIntro: string;
  }
): CrdServiceOption {
  return {
    ...option,
    procedureCode: `${option.codingSystem} ${option.billingCode}`
  };
}

function pharmacyQuestionnaire(id: string, serviceCode: ServiceCode, title: string): DtrQuestionnaire {
  return {
    id,
    requestType: "pharmacy_benefit",
    serviceCode,
    title,
    intro: "Answer each payer-requested pharmacy documentation question before submitting the medication prior authorization.",
    questions: [
      question(
        "drug_indication",
        "Is the diagnosis or covered indication documented for the requested medication?",
        "Pharmacy prior authorization commonly verifies that the drug is requested for a covered indication."
      ),
      question(
        "dose_quantity_duration",
        "Are the requested dose, quantity, days supply, and intended duration documented?",
        "Medication reviews need enough detail to validate the requested drug and benefit limits."
      ),
      question(
        "prior_therapy",
        "Is prior therapy, contraindication, or step-therapy history documented when required?",
        "Many pharmacy benefit policies require evidence of preferred-drug trials or a clinical reason to bypass them."
      ),
      question(
        "pharmacy_notes",
        "Are relevant chart notes, labs, or specialist documentation available to support the request?",
        "Supporting documentation makes the PA submission complete without sending policy evaluation PHI to the incentive agent."
      )
    ]
  };
}

function question(id: string, prompt: string, helper: string): DtrQuestion {
  return {
    id,
    prompt,
    helper,
    answerOptions: yesNoAnswerOptions.map((answerOption) => ({ ...answerOption }))
  };
}

function copyCrdServiceOption(option: CrdServiceOption): CrdServiceOption {
  return {
    ...option,
    requiredDocumentation: [...option.requiredDocumentation],
    details: [...option.details]
  };
}

function copyDtrQuestionnaire(questionnaire: DtrQuestionnaire): DtrQuestionnaire {
  return {
    ...questionnaire,
    questions: questionnaire.questions.map((questionnaireQuestion) => ({
      ...questionnaireQuestion,
      answerOptions: questionnaireQuestion.answerOptions.map((answerOption) => ({ ...answerOption }))
    }))
  };
}
