// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
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
import { ProviderDocumentationWizard } from "./ProviderDocumentationWizard";

let root: Root | null = null;

afterEach(async () => {
  vi.unstubAllGlobals();
  if (root) {
    await act(async () => {
      root?.unmount();
    });
    root = null;
  }
  document.body.innerHTML = "";
});

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

  it("lets providers inspect completed wizard steps without changing the current actionable step", async () => {
    stubProviderDocumentationFetch();
    const container = await renderProviderDocumentationWizard();

    await waitForText(container, "Patient and coverage");
    await selectLabsOption(document.body, "Patient", "Maya Chen");
    await selectLabsOption(document.body, "Health plan", "Acme Health PPO");

    await act(async () => {
      findButton(document.body, "Next: service").click();
    });

    await waitForText(container, "Request type and service");
    await act(async () => {
      findButtonContaining(document.body, "Outpatient Service").click();
    });
    await selectLabsOption(document.body, "Search service", "CPT 73721 - Knee MRI after injury");

    await act(async () => {
      findButton(document.body, "Check coverage and requirements").click();
    });

    await waitForText(container, "Coverage and requirements");
    expect(findButtonByLabel(document.body, "Review").disabled).toBe(true);

    await act(async () => {
      findButtonByLabel(document.body, "Service").click();
    });

    const reviewedStepText = document.querySelector(".wizard-stage")?.textContent ?? "";
    const currentStepContextText = document.querySelector(".step-context")?.textContent ?? "";

    expect(reviewedStepText).toContain("Service");
    expect(reviewedStepText).toContain("Request type");
    expect(reviewedStepText).toContain("Outpatient Service");
    expect(reviewedStepText).toContain("Knee MRI after injury");
    expect(reviewedStepText).toContain("Completed step");
    expect(Array.from(document.querySelectorAll("button")).some((button) => button.textContent === "Check coverage and requirements")).toBe(
      false
    );
    expect(currentStepContextText).toContain("Current step");
    expect(currentStepContextText).toContain("Check coverage and requirements");
    expect(currentStepContextText).toContain("Review the plan response and complete any required documentation assessment before moving to review.");

    await act(async () => {
      findButtonByLabel(document.body, "Coverage").click();
    });

    const activeStepText = document.querySelector(".wizard-stage")?.textContent ?? "";
    expect(activeStepText).toContain("No additional assessment required");
    expect(activeStepText).not.toContain("Completed step");
    expect(findButton(document.body, "Review").disabled).toBe(false);

    await act(async () => {
      findButton(document.body, "Review").click();
    });

    await waitForText(container, "Review prior authorization request");
    await act(async () => {
      findButton(document.body, "Submit prior authorization").click();
    });

    await waitForText(container, "Prior authorization submitted");
    await act(async () => {
      findButtonByLabel(document.body, "Review").click();
    });

    const submittedReviewText = document.querySelector(".wizard-stage")?.textContent ?? "";
    expect(submittedReviewText).toContain("Review");
    expect(submittedReviewText).toContain("Submission status");
    expect(submittedReviewText).toContain("Pending review");
    expect(submittedReviewText).toContain("Completed step");

    await act(async () => {
      findButton(document.body, "Submission confirmation").click();
    });

    expect(document.querySelector(".wizard-stage")?.textContent).toContain("Prior authorization submitted");
  });
});

async function renderProviderDocumentationWizard(): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(createElement(ProviderDocumentationWizard));
  });

  return container;
}

function stubProviderDocumentationFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    const target = String(url);

    if (target === "/api/um/patients") {
      return new Response(
        JSON.stringify({
          patients: [
            {
              patientId: "patient-maya-chen",
              patientDisplay: "Maya Chen",
              dateOfBirth: "1987-04-12",
              displayOrder: 1,
              plans: [{ planId: "acme-health-ppo", planDisplay: "Acme Health PPO" }]
            }
          ]
        }),
        { status: 200 }
      );
    }

    if (target === "/api/um/crd/service-options?planId=acme-health-ppo") {
      return new Response(
        JSON.stringify({
          services: [
            {
              requestType: "outpatient_service",
              serviceCode: "knee_mri",
              serviceLabel: "Knee MRI after injury",
              codingSystem: "CPT",
              billingCode: "73721",
              procedureCode: "CPT 73721",
              procedureSummary: "MRI lower extremity joint without contrast",
              description: "Non-contrast MRI of the knee to evaluate suspected internal derangement.",
              details: ["Prior authorization required", "Coverage may be confirmed when medical-necessity evidence is present"],
              coveredBenefit: true,
              priorAuthRequired: true,
              documentationTemplateId: null,
              requiredDocumentation: [],
              reasonCode: null,
              assessmentTitle: "Knee MRI medical necessity assessment",
              assessmentIntro: "Answer each payer-requested documentation question."
            }
          ]
        }),
        { status: 200 }
      );
    }

    if (
      target ===
      "/api/um/crd/coverage-requirements?planId=acme-health-ppo&requestType=outpatient_service&serviceCode=knee_mri"
    ) {
      return new Response(
        JSON.stringify({
          requirements: {
            requestType: "outpatient_service",
            serviceCode: "knee_mri",
            serviceLabel: "Knee MRI after injury",
            codingSystem: "CPT",
            billingCode: "73721",
            coveredBenefit: true,
            priorAuthRequired: true,
            documentationTemplateId: null,
            requiredDocumentation: [],
            reasonCode: null
          }
        }),
        { status: 200 }
      );
    }

    if (target === "/api/um/prior-auths" && init?.method === "POST") {
      return new Response(
        JSON.stringify({
          id: "PA-260615-1200-KNEE-MRI",
          requestType: "outpatient_service",
          serviceLabel: "Knee MRI after injury",
          state: "pend",
          outcomeStatus: null
        }),
        { status: 200 }
      );
    }

    return new Response(JSON.stringify({ error: `unexpected ${target}` }), { status: 404 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function selectLabsOption(container: HTMLElement, label: string, optionText: string): Promise<void> {
  await act(async () => {
    findButtonByLabel(container, label).click();
  });

  await waitForText(container, optionText);
  await act(async () => {
    findButtonContaining(container, optionText).click();
  });
}

async function waitForText(container: HTMLElement, text: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (container.textContent?.includes(text)) {
      return;
    }

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
  }

  throw new Error(`Text not found: ${text}`);
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent === text
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
}

function findButtonByLabel(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.getAttribute("aria-label") === label
  );

  if (!button) {
    throw new Error(`Button not found by label: ${label}`);
  }

  return button;
}

function findButtonContaining(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) =>
    candidate.textContent?.includes(text)
  );

  if (!button) {
    throw new Error(`Button containing text not found: ${text}`);
  }

  return button;
}
