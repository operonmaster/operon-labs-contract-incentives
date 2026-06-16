// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { UMRequest } from "@operon-labs/um-platform";
import { DelegateReviewModal } from "./DelegateReviewModal";

describe("DelegateVendorConsole source", () => {
  it("uses delegate UM APIs instead of payment APIs", () => {
    const source = readFileSync(path.join(process.cwd(), "src/apps/web/components/delegate-um/DelegateVendorConsole.tsx"), "utf8");
    const modalSource = readFileSync(path.join(process.cwd(), "src/apps/web/components/delegate-um/DelegateReviewModal.tsx"), "utf8");

    expect(source).toContain("/api/delegate-um/workqueue");
    expect(source).toContain("/api/delegate-um/requests/");
    expect(source).not.toContain("/api/payments");
    expect(source).toContain("lastReviewButtonRef");
    expect(source).toContain("event.currentTarget");
    expect(source).toContain("window.setTimeout(() => lastReviewButtonRef.current?.focus(), 0)");
    // Focus management and Escape-to-close now come from the shared LabsModal shell.
    expect(modalSource).toContain("LabsModal");
    expect(modalSource).toContain("useState(false)");
    expect(modalSource).toContain("request.outcomeStatus ?? null");
    expect(modalSource).toContain("const canChooseOutcome = checklistComplete");
    expect(modalSource).toContain("const canSubmit = canChooseOutcome && outcomeStatus !== null && !submitting");
    expect(modalSource).toContain("disabled={!canChooseOutcome}");
    expect(modalSource).toContain("const started = await ensureReviewStarted()");
    expect(modalSource).toContain("disabled={!canSubmit}");
    expect(modalSource).toContain("LabsSelect");
    expect(modalSource).toContain("approvalReasonOptions");
    expect(modalSource).toContain("Policy criteria met");
    expect(modalSource).toContain("Medical necessity supported");
    expect(modalSource).toContain("Prior therapy confirmed");
    expect(modalSource).toContain("approvalReasonCode: outcomeStatus === \"approved\" ? approvalReasonCode : null");
    expect(modalSource).toContain('<LabsBadge className="delegate-guidance" id={outcomeGuidanceId} variant="warning">');
    expect(modalSource).not.toContain("<select");

    const stylesSource = readFileSync(path.join(process.cwd(), "src/apps/web/app/styles.css"), "utf8");
    expect(stylesSource).toContain(".delegate-field > span");
    expect(stylesSource).not.toContain(".delegate-field span");
    expect(stylesSource).toMatch(/\.delegate-review-modal\s*\{[^}]*overflow:\s*visible;/s);
    expect(stylesSource).toMatch(/\.delegate-guidance\s*\{[^}]*font-size:\s*14px;/s);
  });

  it("renders review modal with shared stepper, radio, and dropdown primitives", () => {
    const markup = renderToStaticMarkup(
      createElement(DelegateReviewModal, {
        requestApiBase: "/api/delegate-um/requests/",
        request: buildDelegateRequest("in_clinical_review", "approved"),
        onClose: () => undefined,
        onCompleted: () => undefined
      })
    );

    expect(markup).toContain("Start Review");
    expect(markup).toContain("Clinical Checklist");
    expect(markup).toContain("Submit Determination");
    expect(markup).toContain("Outcome status");
    expect(markup).toContain("labs-select");
    expect(markup).toContain("Approval reason");
    expect(markup).toContain("Policy criteria met");
    expect(markup).not.toContain("Denial reason");
    expect(markup).not.toContain("Not medically necessary");
    expect(markup).toContain("Submit determination");
    // Rendered through the shared LabsButton primitive (attribute order is incidental).
    expect(markup).toMatch(/<button[^>]*class="primary-button"[^>]*>Submit determination<\/button>/);
    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>Submit determination<\/button>/);
    expect(markup).not.toContain("<select");
  });

  it("renders service details and the submitted assessment in the review modal", () => {
    const markup = renderToStaticMarkup(
      createElement(DelegateReviewModal, {
        requestApiBase: "/api/delegate-um/requests/",
        request: buildDelegateRequest("in_clinical_review", null, "complete"),
        onClose: () => undefined,
        onCompleted: () => undefined
      })
    );

    expect(markup).toContain("Service details");
    expect(markup).toContain("Patient");
    expect(markup).toContain("Maya Chen");
    expect(markup).toContain("Health plan");
    expect(markup).toContain("Acme Health PPO");
    expect(markup).toContain("SLA");
    expect(markup).toMatch(/PA-260526-0900-REVIEW1[\s\S]*op-badge[\s\S]*In clinical review/);
    expect(markup).not.toContain("Requested item");
    expect(markup).not.toContain("<dt>Status</dt>");
    expect(markup).toContain("Request type");
    expect(markup).toContain("Medication code");
    expect(markup).toContain("NDC 0169-4525-14");
    expect(markup).toContain("Coverage confirmed; PA required");
    expect(markup).not.toContain("Required documentation");
    expect(markup).not.toContain("diagnosis and indication");
    expect(markup).not.toContain("<dt>Assessment</dt>");
    expect(markup).toContain("View assessment");
    expect(markup).toContain("Is prior therapy, contraindication, or step-therapy history documented when required?");
    expect(markup).toContain("Yes");
    expect(markup).toContain("No");
  });

  it("states explicitly when assessment data was not provided", () => {
    const markup = renderToStaticMarkup(
      createElement(DelegateReviewModal, {
        requestApiBase: "/api/delegate-um/requests/",
        request: buildDelegateRequest("in_clinical_review", null, "not_provided"),
        onClose: () => undefined,
        onCompleted: () => undefined
      })
    );

    expect(markup).toContain("Assessment not provided");
    expect(markup).not.toContain("View assessment");
  });

  it("keeps submit determination disabled until clinical checklist is complete", () => {
    const markup = renderToStaticMarkup(
      createElement(DelegateReviewModal, {
        requestApiBase: "/api/delegate-um/requests/",
        request: buildDelegateRequest("in_clinical_review"),
        onClose: () => undefined,
        onCompleted: () => undefined
      })
    );

    expect(markup).toContain("Clinical checklist");
    expect(markup).toContain('aria-label="Submit Determination"');
    expect(markup).toMatch(/<button[^>]*aria-label="Submit Determination"[^>]*disabled=""/);
    expect(markup).toContain("Clinical documentation reviewed");
    expect(markup).not.toContain("Outcome status");
    expect(markup).not.toContain("Complete the clinical checklist before choosing an outcome");
    expect(markup).not.toContain("Approval reason");
    expect(markup).not.toContain("Denial reason");
  });

  it("unlocks outcome selection after all checklist items are checked", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    let root: Root | null = createRoot(container);

    try {
      await act(async () => {
        root?.render(
          createElement(DelegateReviewModal, {
            requestApiBase: "/api/delegate-um/requests/",
            request: buildDelegateRequest("in_clinical_review"),
            onClose: () => undefined,
            onCompleted: () => undefined
          })
        );
      });

      const checklistInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));

      expect(checklistInputs).toHaveLength(4);
      expect(container.querySelectorAll<HTMLInputElement>('input[name="delegate-outcome"]')).toHaveLength(0);
      expect(container.textContent).not.toContain("Complete the clinical checklist before choosing an outcome");

      for (const input of checklistInputs) {
        await act(async () => {
          input.click();
        });
      }

      const outcomeInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[name="delegate-outcome"]'));

      expect(container.textContent).toContain("Outcome");
      expect(outcomeInputs).toHaveLength(2);
      expect(outcomeInputs.every((input) => input.disabled)).toBe(false);

      await act(async () => {
        outcomeInputs[0]?.click();
      });

      expect(container.textContent).toContain("Approval reason");
      expect(container.textContent).toContain("Policy criteria met");
    } finally {
      await act(async () => {
        root?.unmount();
      });
      root = null;
      container.remove();
    }
  });

  it("unlocks outcome selection from a pended row after all checklist items are checked", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ state: "in_clinical_review" }), { status: 200 }));
    let root: Root | null = createRoot(container);

    vi.stubGlobal("fetch", fetchMock);
    try {
      await act(async () => {
        root?.render(
          createElement(DelegateReviewModal, {
            requestApiBase: "/api/delegate-um/requests/",
            request: buildDelegateRequest("pend"),
            onClose: () => undefined,
            onCompleted: () => undefined
          })
        );
      });

      expect(container.textContent).toContain("Start Review");
      expect(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).toHaveLength(0);
      expect(container.querySelectorAll<HTMLInputElement>('input[name="delegate-outcome"]')).toHaveLength(0);

      await act(async () => {
        Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
          .find((button) => button.textContent === "Start review")
          ?.click();
      });

      const checklistInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
      expect(checklistInputs).toHaveLength(4);
      for (const input of checklistInputs) {
        await act(async () => {
          input.click();
        });
      }

      const outcomeInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[name="delegate-outcome"]'));
      expect(outcomeInputs).toHaveLength(2);
      expect(outcomeInputs.every((input) => input.disabled)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
      await act(async () => {
        root?.unmount();
      });
      root = null;
      container.remove();
    }
  });

  it("lets operators review completed delegate steps without editing them", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ state: "in_clinical_review" }), { status: 200 }));
    let root: Root | null = createRoot(container);

    const stepButton = (label: string) =>
      Array.from(container.querySelectorAll<HTMLButtonElement>(".stepper-step-button")).find(
        (button) => button.getAttribute("aria-label") === label
      );

    vi.stubGlobal("fetch", fetchMock);
    try {
      await act(async () => {
        root?.render(
          createElement(DelegateReviewModal, {
            requestApiBase: "/api/delegate-um/requests/",
            request: buildDelegateRequest("pend"),
            onClose: () => undefined,
            onCompleted: () => undefined
          })
        );
      });

      expect(stepButton("Start Review")).toBeDefined();
      expect(stepButton("Clinical Checklist")?.disabled).toBe(true);
      expect(stepButton("Submit Determination")?.disabled).toBe(true);

      await act(async () => {
        Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
          .find((button) => button.textContent === "Start review")
          ?.click();
      });

      expect(fetchMock).toHaveBeenCalledWith("/api/delegate-um/requests/PA-260526-0900-REVIEW1/start-review", expect.any(Object));
      expect(stepButton("Start Review")?.disabled).toBe(false);
      expect(stepButton("Clinical Checklist")?.disabled).toBe(false);
      expect(stepButton("Submit Determination")?.disabled).toBe(true);

      await act(async () => {
        stepButton("Start Review")?.click();
      });

      expect(container.textContent).toContain("Completed step");
      expect(container.textContent).toContain("Review status");
      expect(container.textContent).toContain("In clinical review");
      expect(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).toHaveLength(0);

      await act(async () => {
        stepButton("Clinical Checklist")?.click();
      });

      expect(container.textContent).toContain("Clinical checklist");
      expect(container.textContent).not.toContain("Completed step");
      expect(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).toHaveLength(4);

      for (const input of Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))) {
        await act(async () => {
          input.click();
        });
      }

      expect(stepButton("Submit Determination")?.disabled).toBe(false);

      await act(async () => {
        stepButton("Clinical Checklist")?.click();
      });

      expect(container.textContent).toContain("Completed step");
      expect(container.textContent).toContain("Clinical documentation reviewed");
      expect(container.textContent).toContain("Medical necessity criteria met");
      expect(container.textContent).toContain("Plan policy requirements checked");
      expect(container.textContent).toContain("Decision rationale documented");
      expect(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).toHaveLength(0);

      await act(async () => {
        stepButton("Submit Determination")?.click();
      });

      expect(container.textContent).not.toContain("Completed step");
      expect(container.querySelectorAll<HTMLInputElement>('input[name="delegate-outcome"]')).toHaveLength(2);
    } finally {
      vi.unstubAllGlobals();
      await act(async () => {
        root?.unmount();
      });
      root = null;
      container.remove();
    }
  });

  it("starts review before submitting a pended row determination", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const onCompleted = vi.fn();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);

      if (target.includes("/start-review")) {
        return new Response(JSON.stringify({ state: "in_clinical_review" }), { status: 200 });
      }

      if (target.includes("/determination")) {
        return new Response(JSON.stringify(buildDelegateRequest("determined", "approved")), { status: 200 });
      }

      return new Response(JSON.stringify({ error: "unexpected" }), { status: 404 });
    });
    let root: Root | null = createRoot(container);

    vi.stubGlobal("fetch", fetchMock);
    try {
      await act(async () => {
        root?.render(
          createElement(DelegateReviewModal, {
            requestApiBase: "/api/delegate-um/requests/",
            request: buildDelegateRequest("pend"),
            onClose: () => undefined,
            onCompleted
          })
        );
      });

      await act(async () => {
        Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
          .find((button) => button.textContent === "Start review")
          ?.click();
      });

      for (const input of Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))) {
        await act(async () => {
          input.click();
        });
      }

      await act(async () => {
        container.querySelector<HTMLInputElement>('input[value="approved"]')?.click();
      });
      await act(async () => {
        Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
          .find((button) => button.textContent === "Submit determination")
          ?.click();
      });

      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
        "/api/delegate-um/requests/PA-260526-0900-REVIEW1/start-review",
        "/api/delegate-um/requests/PA-260526-0900-REVIEW1/determination"
      ]);
      expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({ state: "determined", outcomeStatus: "approved" }));
    } finally {
      vi.unstubAllGlobals();
      await act(async () => {
        root?.unmount();
      });
      root = null;
      container.remove();
    }
  });

  it("renders denial reasons when the denial outcome is selected", () => {
    const markup = renderToStaticMarkup(
      createElement(DelegateReviewModal, {
        requestApiBase: "/api/delegate-um/requests/",
        request: buildDelegateRequest("in_clinical_review", "denied"),
        onClose: () => undefined,
        onCompleted: () => undefined
      })
    );

    expect(markup).toContain("Denial reason");
    expect(markup).toContain("Not medically necessary");
    expect(markup).not.toContain("Approval reason");
    expect(markup).toContain("Submit determination");
    expect(markup).not.toContain("<select");
  });

  it("renders determined requests as a completed submit determination summary", () => {
    const markup = renderToStaticMarkup(
      createElement(DelegateReviewModal, {
        requestApiBase: "/api/delegate-um/requests/",
        request: buildDelegateRequest("determined", "approved"),
        onClose: () => undefined,
        onCompleted: () => undefined
      })
    );

    expect(markup).toContain("Submit Determination");
    expect(markup).toContain("Completed step");
    expect(markup).toContain("<dt>Outcome</dt><dd>Approved</dd>");
    expect(markup).toContain("<dt>Reason</dt><dd>Policy criteria met</dd>");
    expect(markup).not.toContain("Submit determination");
    expect(markup).not.toContain('input name="delegate-outcome"');
  });
});

function buildDelegateRequest(
  state: UMRequest["state"] = "pend",
  outcomeStatus: UMRequest["outcomeStatus"] = null,
  assessmentStatus: "complete" | "not_provided" = "not_provided"
): UMRequest {
  const assessmentProvided = assessmentStatus === "complete";
  const clinicalReviewComplete = outcomeStatus !== null || state === "determined";

  return {
    id: "PA-260526-0900-REVIEW1",
    source: "pas_fhir",
    sourceCaseId: "PA-260526-0900-REVIEW1",
    caseId: "PA-260526-0900-REVIEW1",
    patientId: "patient-maya-chen",
    patientDisplay: "Maya Chen",
    planId: "acme-health-ppo",
    planDisplay: "Acme Health PPO",
    providerId: "lakeside-provider-admin",
    providerDisplay: "Lakeside Provider Admin",
    providerGroupId: "lakeside-provider-admin",
    providerGroupDisplay: "Lakeside Provider Admin",
    delegateVendorId: "northstar-um",
    requestType: "pharmacy_benefit",
    serviceCode: "wegovy_semaglutide",
    serviceLabel: "Wegovy (semaglutide) injection",
    codingSystem: "NDC",
    billingCode: "0169-4525-14",
    submittedAt: "2026-05-26T09:00:00.000Z",
    pendStartedAt: "2026-05-26T09:00:00.000Z",
    reviewStartedAt: state === "pend" ? null : "2026-05-26T09:05:00.000Z",
    slaDeadlineAt: "2026-05-27T09:00:00.000Z",
    determinedAt: state === "determined" ? "2026-05-26T10:00:00.000Z" : null,
    slaHours: 24,
    state,
    outcomeStatus,
    coverage: {
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
      reasonCode: null
    },
    dtr: null,
    dtrQuestionnaireResponse: assessmentProvided
      ? {
          questionnaireId: "pharmacy-weight-management-pa-v1",
          answers: [
            { questionId: "drug_indication", value: "yes" },
            { questionId: "dose_quantity_duration", value: "yes" },
            { questionId: "prior_therapy", value: "no" },
            { questionId: "pharmacy_notes", value: "yes" }
          ]
        }
      : null,
    documentation: {
      coverageChecked: true,
      coveredBenefit: true,
      dtrRequested: true,
      dtrCompleted: assessmentProvided,
      attachmentChecklistComplete: assessmentProvided,
      fhirFieldsPresent: assessmentProvided
    },
    clinicalReview: {
      reviewerId: state === "pend" ? null : "delegate-reviewer",
      clinicalDocumentationReviewed: clinicalReviewComplete,
      medicalNecessityCriteriaMet: clinicalReviewComplete,
      planPolicyRequirementsChecked: clinicalReviewComplete,
      decisionRationaleDocumented: clinicalReviewComplete,
      approvalReasonCode: outcomeStatus === "approved" ? "POLICY_CRITERIA_MET" : null,
      denialReasonCode: outcomeStatus === "denied" ? "NOT_MEDICALLY_NECESSARY" : null
    },
    auditRefs: {
      pasClaimBundleId: "PA-260526-0900-REVIEW1",
      pasClaimResponseBundleId: null
    },
    pasSubmitted: true,
    submittedBeforeInitialDecision: true
  };
}
