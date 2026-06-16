import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

describe("provider portal content", () => {
  it("uses a four-step portal flow with patient and plan collapsed into one step", () => {
    expect(wizardSteps.map((step) => step.label)).toEqual(["Patient & Plan", "Service", "Coverage", "Review"]);
    expect(stepContextByStep.setup.title).toBe("Select patient and plan");
  });

  it("uses provider-facing current step guidance for the prior authorization workflow", () => {
    expect(stepContextByStep.setup).toEqual({
      title: "Select patient and plan",
      body: "Select the patient and active health plan for this prior authorization request.",
      bullets: ["The plan list is tied to the selected patient.", "The selected values become read-only in later steps."]
    });
    expect(stepContextByStep.service).toEqual({
      title: "Select request type and item",
      body: "Choose whether this is an outpatient service or pharmacy benefit request, then select the requested service or medication.",
      bullets: ["Outpatient services use CPT-style procedure codes.", "Pharmacy benefit requests use NDC-coded medication options."]
    });
    expect(stepContextByStep.coverage).toEqual({
      title: "Check coverage and requirements",
      body: "Review the plan response and complete any required documentation assessment before moving to review.",
      bullets: ["Covered requests may require additional documentation before submission.", "Not-covered requests require acknowledgement before review."]
    });
    expect(stepContextByStep.review).toEqual({
      title: "Review and submit",
      body: "Confirm the request details before submitting the prior authorization to the health plan.",
      bullets: ["Submission creates a PA ID.", "The request will be pending health plan review after submission."]
    });
  });

  it("keeps the provider portal hero and submitted-state guidance focused on submitting a PA", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx");
    const normalizedSource = normalizeWhitespace(source);

    expect(source).toContain('title="New prior authorization"');
    expect(normalizedSource).toContain(
      "Submit a prior authorization request with the patient, plan, requested item, coverage response, and required documentation the health plan needs for review."
    );
    expect(source).toContain('"Use the Health Plan View to inspect the submitted request."');
    expect(source).not.toContain("Plan-side incentives are evaluated outside this provider flow.");
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

  it("defers the initial patient fetch so Strict Mode remount cleanup prevents duplicate requests", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx");

    expect(source).toContain("const patientLoadId = window.setTimeout");
    expect(source).toContain("window.clearTimeout(patientLoadId)");
    expect(source).toMatch(/const patientLoadId = window\.setTimeout\(\(\) => \{\n\s+void loadPatients\(\);/);
    expect(source).toContain('fetch("/api/um/patients")');
  });

  it("submits selected patient context and cancels stale coverage checks when the selected path changes", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx");

    expect(source).toContain("patientId,");
    expect(source).toContain("function cancelPendingRequests()");
    expect(source).toContain("coverageRequestRef.current += 1");
    expect(source).toContain("const requestPath = selectedPath");
    expect(source).toContain("selectedPathRef.current !== requestPath");
    expect(source).toContain("disabled={checkingRequirements || !option.enabled}");
    expect(source).toContain("disabled={checkingRequirements || !requestType || requestType === \"inpatient_admission\" || Boolean(crdLoadError)}");
    expect(source).toContain("LabsSelect");
    expect(source).toContain("patientOptions");
    expect(source).toContain("planOptions");
    expect(source).toContain("serviceOptions");
    expect(source).not.toContain("<select");
    expect(source).not.toContain("<option");
    expect(source).toContain("Close assessment");
    expect(source).toContain("onClose={() => setAssessmentModalOpen(false)}");
  });

  it("uses shared badges for coverage, assessment, and submission states", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx");

    expect(source).toContain("LabsBadge");
    expect(source).toContain("assessmentBadgeVariant(assessmentStatus)");
    expect(source).toContain('<LabsBadge variant="success">Coverage confirmed</LabsBadge>');
    expect(source).toContain('<LabsBadge variant="warning">Not covered benefit</LabsBadge>');
    expect(source).toContain('<LabsBadge variant="info">Pending review</LabsBadge>');
    expect(source).not.toContain('className="status');
    expect(source).not.toContain("assessment-pill");
  });

  it("uses UM request identity and status fields in the provider submission confirmation", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/ProviderDocumentationWizard.tsx");

    expect(source).toContain("UMRequest");
    expect(source).not.toContain("PriorAuthRecord");
    expect(source).not.toContain("submitted.caseId");
    expect(source).not.toContain("submitted.paResult");
    expect(source).not.toContain("submitted.denialReason");
    expect(source).toContain("<dt>UM request ID</dt>");
    expect(source).toContain("<dt>Canonical PA/UM request ID</dt>");
    expect(source).toContain("{submitted.id}");
    expect(source).toContain("formatSubmissionStatus(submitted)");
    expect(source).toContain("<UseCaseNavigation activeView=\"provider\" umRequestId={submitted?.id} />");
    expect(source).toContain("umRequestId=${encodeURIComponent(submitted.id)}");
  });
});
