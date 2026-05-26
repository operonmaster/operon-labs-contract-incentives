import type { PriorAuthSubmissionInput } from "@operon-labs/um-platform";
import { NextResponse } from "next/server";
import { providerDocumentationWorkflow } from "../../../../lib/provider-documentation-workflow";
import { umReferenceDataStore } from "../../../../lib/um-reference-data";

export async function GET() {
  return NextResponse.json(await providerDocumentationWorkflow.listUmRequests());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isPriorAuthSubmissionInput(body)) {
    return NextResponse.json({ error: "INVALID_PRIOR_AUTH_SUBMISSION" }, { status: 400 });
  }

  try {
    const input = await enrichPriorAuthSubmission(body);
    if (!input) {
      return NextResponse.json({ error: "INVALID_PATIENT_PLAN_SELECTION" }, { status: 400 });
    }

    const submitted = await providerDocumentationWorkflow.submitPriorAuth(input);
    return NextResponse.json(submitted);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PRIOR_AUTH_SUBMISSION_FAILED" },
      { status: 400 }
    );
  }
}

function isPriorAuthSubmissionInput(value: unknown): value is PriorAuthSubmissionInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const validRequestType =
    candidate.requestType === "outpatient_service" || candidate.requestType === "pharmacy_benefit";
  const validPlanId =
    candidate.planId === "acme-health-ppo" || candidate.planId === "summit-health-hmo";
  const validPatientId = typeof candidate.patientId === "string" && candidate.patientId.length > 0;
  const validServiceCode =
    candidate.serviceCode === "knee_mri" ||
    candidate.serviceCode === "full_body_wellness_mri" ||
    candidate.serviceCode === "wegovy_semaglutide" ||
    candidate.serviceCode === "humira_adalimumab";

  const validDtrQuestionnaireResponse =
    candidate.dtrQuestionnaireResponse === undefined || isDtrQuestionnaireResponse(candidate.dtrQuestionnaireResponse);
  const validDtr = candidate.dtr === undefined || isDtrAnswers(candidate.dtr);

  return validPatientId && validPlanId && validRequestType && validServiceCode && validDtr && validDtrQuestionnaireResponse;
}

function isDtrAnswers(value: unknown): value is NonNullable<PriorAuthSubmissionInput["dtr"]> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.symptomDurationConfirmed === "boolean" &&
    typeof candidate.conservativeTherapyConfirmed === "boolean" &&
    typeof candidate.examFindingsConfirmed === "boolean" &&
    typeof candidate.clinicalNoteAttached === "boolean"
  );
}

async function enrichPriorAuthSubmission(input: PriorAuthSubmissionInput): Promise<PriorAuthSubmissionInput | null> {
  const patients = await umReferenceDataStore.listPatients();
  const patient = patients.find((candidate) => candidate.patientId === input.patientId);
  const plan = patient?.plans.find((candidate) => candidate.planId === input.planId);

  if (!patient || !plan) {
    return null;
  }

  return {
    ...input,
    patientId: patient.patientId,
    patientDisplay: patient.patientDisplay,
    planId: plan.planId as PriorAuthSubmissionInput["planId"],
    planDisplay: plan.planDisplay
  };
}

function isDtrQuestionnaireResponse(value: unknown): value is NonNullable<PriorAuthSubmissionInput["dtrQuestionnaireResponse"]> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.questionnaireId === "string" &&
    Array.isArray(candidate.answers) &&
    candidate.answers.every((answer) => {
      if (typeof answer !== "object" || answer === null) {
        return false;
      }

      const candidateAnswer = answer as Record<string, unknown>;
      return (
        typeof candidateAnswer.questionId === "string" &&
        (candidateAnswer.value === "yes" || candidateAnswer.value === "no")
      );
    })
  );
}
