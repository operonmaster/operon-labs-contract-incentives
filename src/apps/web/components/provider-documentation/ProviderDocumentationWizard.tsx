"use client";

import type { DtrAnswers, PriorAuthRecord, ServiceCode } from "@operon-labs/um-platform";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

type PatientId = "patient-maya-chen";
type PlanId = "acme-health-ppo";
type WizardStep = "patient" | "plan" | "service" | "requirements" | "assessment" | "review";
type AssessmentStatus = "not_required" | "not_started" | "complete" | "skipped";

interface StepDefinition {
  id: WizardStep;
  label: string;
}

const steps: StepDefinition[] = [
  { id: "patient", label: "Patient" },
  { id: "plan", label: "Plan" },
  { id: "service", label: "Service" },
  { id: "requirements", label: "Requirements" },
  { id: "assessment", label: "Assessment" },
  { id: "review", label: "Review" }
];

const completeDtr: DtrAnswers = {
  symptomDurationConfirmed: true,
  conservativeTherapyConfirmed: true,
  examFindingsConfirmed: true,
  clinicalNoteAttached: true
};

const assessmentItems = [
  "Symptoms began after injury or persistent knee pain is documented",
  "Conservative therapy was attempted",
  "Exam findings support the imaging request",
  "Clinical note is attached or available in the chart"
];

export function ProviderDocumentationWizard() {
  const [step, setStep] = useState<WizardStep>("patient");
  const [patientId, setPatientId] = useState<PatientId | null>(null);
  const [planId, setPlanId] = useState<PlanId | null>(null);
  const [serviceCode, setServiceCode] = useState<ServiceCode | null>(null);
  const [requirementsChecked, setRequirementsChecked] = useState(false);
  const [assessmentStatus, setAssessmentStatus] = useState<AssessmentStatus>("not_started");
  const [acknowledgedNotCovered, setAcknowledgedNotCovered] = useState(false);
  const [submitted, setSubmitted] = useState<PriorAuthRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessmentModalOpen, setAssessmentModalOpen] = useState(false);
  const submitRequestRef = useRef(0);
  const selectedPathRef = useRef("");

  const isKneeMri = serviceCode === "knee_mri";
  const isFullBody = serviceCode === "full_body_wellness_mri";
  const selectedPath = `${patientId ?? ""}:${planId ?? ""}:${serviceCode ?? ""}`;

  const currentStepIndex = steps.findIndex((candidate) => candidate.id === step);
  const serviceLabel = serviceCode === "knee_mri" ? "Knee MRI after injury" : serviceCode === "full_body_wellness_mri" ? "Full-body wellness MRI screening" : "Not selected";
  const assessmentLabel = useMemo(() => {
    switch (assessmentStatus) {
      case "complete":
        return "Complete";
      case "skipped":
        return "Skipped";
      case "not_required":
        return "Not required";
      case "not_started":
        return "Not started";
    }
  }, [assessmentStatus]);

  function resetDownstream(nextStep: WizardStep) {
    setStep(nextStep);
    setRequirementsChecked(false);
    setAssessmentStatus("not_started");
    setAcknowledgedNotCovered(false);
    setSubmitted(null);
    setError(null);
    setAssessmentModalOpen(false);
  }

  function selectPatient(nextPatientId: string) {
    const normalizedPatientId = nextPatientId === "patient-maya-chen" ? nextPatientId : null;
    setPatientId(normalizedPatientId);
    setPlanId(null);
    setServiceCode(null);
    resetDownstream(normalizedPatientId ? "plan" : "patient");
  }

  function selectPlan(nextPlanId: string) {
    const normalizedPlanId = nextPlanId === "acme-health-ppo" ? nextPlanId : null;
    setPlanId(normalizedPlanId);
    setServiceCode(null);
    resetDownstream(normalizedPlanId ? "service" : "plan");
  }

  function selectService(nextServiceCode: string) {
    const normalizedServiceCode =
      nextServiceCode === "knee_mri" || nextServiceCode === "full_body_wellness_mri" ? nextServiceCode : null;
    setServiceCode(normalizedServiceCode);
    resetDownstream(normalizedServiceCode ? "service" : "service");
  }

  function checkRequirements() {
    if (!patientId || !planId || !serviceCode) {
      return;
    }

    setRequirementsChecked(true);
    setAssessmentStatus(serviceCode === "full_body_wellness_mri" ? "not_required" : "not_started");
    setAcknowledgedNotCovered(false);
    setSubmitted(null);
    setError(null);
    setStep("requirements");
  }

  function openAssessment() {
    setStep("assessment");
    setAssessmentModalOpen(true);
  }

  function saveAssessment() {
    setAssessmentStatus("complete");
    setAssessmentModalOpen(false);
    setSubmitted(null);
    setError(null);
    setStep("review");
  }

  function skipAssessment() {
    setAssessmentStatus("skipped");
    setAssessmentModalOpen(false);
    setSubmitted(null);
    setError(null);
    setStep("review");
  }

  async function submitPriorAuth() {
    if (!serviceCode || !requirementsChecked) {
      return;
    }

    const requestId = submitRequestRef.current + 1;
    submitRequestRef.current = requestId;
    selectedPathRef.current = selectedPath;
    setSubmitting(true);
    setError(null);

    const body =
      serviceCode === "knee_mri"
        ? {
            serviceCode,
            dtr: assessmentStatus === "complete" ? completeDtr : undefined
          }
        : { serviceCode, acknowledgedNotCovered };

    try {
      const response = await fetch("/api/um/prior-auths", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as PriorAuthRecord | { error?: string };

      if (submitRequestRef.current !== requestId || selectedPathRef.current !== selectedPath) {
        return;
      }

      if (!response.ok) {
        setError("error" in payload && payload.error ? payload.error : "Unable to submit prior authorization");
        return;
      }

      setSubmitted(payload as PriorAuthRecord);
    } catch {
      if (submitRequestRef.current !== requestId || selectedPathRef.current !== selectedPath) {
        return;
      }

      setError("Unable to submit prior authorization");
    } finally {
      if (submitRequestRef.current === requestId) {
        setSubmitting(false);
      }
    }
  }

  const canCheckRequirements = patientId !== null && planId !== null && serviceCode !== null;
  const canContinueToReview =
    requirementsChecked && ((isKneeMri && assessmentStatus !== "not_started") || (isFullBody && acknowledgedNotCovered));
  const submitDisabled = submitting || submitted !== null || !canContinueToReview;

  return (
    <main className="workspace">
      <Link className="back" href="/">
        Back to demos
      </Link>

      <section className="hero compact">
        <span className="eyebrow">Provider portal</span>
        <h1>New prior authorization</h1>
        <p>Select the patient, confirm coverage, answer any requested assessment, and submit the request.</p>
      </section>

      <section className="wizard-shell">
        <ol className="stepper" aria-label="Prior authorization steps">
          {steps.map((candidate, index) => (
            <li
              key={candidate.id}
              className={`${index < currentStepIndex ? "done" : ""} ${index === currentStepIndex ? "active" : ""}`}
            >
              <strong>{index + 1}</strong>
              <span>{candidate.label}</span>
            </li>
          ))}
        </ol>

        <div className="wizard-grid">
          <section className="wizard-form panel">
            <h2>Request setup</h2>

            <label className="form-row">
              <span>Patient</span>
              <select
                className="select-control"
                disabled={submitting}
                value={patientId ?? ""}
                onChange={(event) => selectPatient(event.target.value)}
              >
                <option value="">Select patient</option>
                <option value="patient-maya-chen">Maya Chen</option>
              </select>
            </label>

            <label className="form-row">
              <span>Health plan</span>
              <select
                className="select-control"
                disabled={!patientId || submitting}
                value={planId ?? ""}
                onChange={(event) => selectPlan(event.target.value)}
              >
                <option value="">Select health plan</option>
                <option value="acme-health-ppo">Acme Health PPO</option>
              </select>
            </label>

            <label className="form-row">
              <span>Requested service</span>
              <select
                className="select-control"
                disabled={!planId || submitting}
                value={serviceCode ?? ""}
                onChange={(event) => selectService(event.target.value)}
              >
                <option value="">Select service</option>
                <option value="knee_mri">Knee MRI after injury</option>
                <option value="full_body_wellness_mri">Full-body wellness MRI screening</option>
              </select>
            </label>

            <button className="primary-button" disabled={!canCheckRequirements || submitting} type="button" onClick={checkRequirements}>
              Next: check requirements
            </button>
          </section>

          <aside className="panel request-summary">
            <h2>Request summary</h2>
            <dl className="review-list compact-list">
              <div>
                <dt>Patient</dt>
                <dd>{patientId ? "Maya Chen" : "Not selected"}</dd>
              </div>
              <div>
                <dt>Health plan</dt>
                <dd>{planId ? "Acme Health PPO" : "Not selected"}</dd>
              </div>
              <div>
                <dt>Service</dt>
                <dd>{serviceLabel}</dd>
              </div>
              <div>
                <dt>Assessment</dt>
                <dd>{requirementsChecked ? assessmentLabel : "Pending requirements check"}</dd>
              </div>
            </dl>
          </aside>
        </div>

        {requirementsChecked && isKneeMri ? (
          <section className="panel requirement-result approved-result">
            <div>
              <span className="status approved">Coverage confirmed</span>
              <h2>Prior authorization required</h2>
              <p>Additional assessment is needed before submission. You can complete it now or submit with missing documentation.</p>
            </div>
            <div className="button-row">
              <button className="primary-button" disabled={submitting} type="button" onClick={openAssessment}>
                Open assessment
              </button>
              <button
                className="primary-button secondary-button"
                disabled={assessmentStatus === "not_started"}
                type="button"
                onClick={() => setStep("review")}
              >
                Continue to review
              </button>
            </div>
          </section>
        ) : null}

        {requirementsChecked && isFullBody ? (
          <section className="panel requirement-result warning-panel">
            <div>
              <span className="status blocked">Not covered benefit</span>
              <h2>Full-body wellness MRI is not covered</h2>
              <p>
                This plan does not cover full-body wellness MRI screening without symptoms. The request can still be
                submitted with a not-covered reason.
              </p>
            </div>
            <label className="checkbox-row warning-copy">
              <input
                checked={acknowledgedNotCovered}
                type="checkbox"
                onChange={(event) => {
                  setAcknowledgedNotCovered(event.target.checked);
                  setSubmitted(null);
                  setError(null);
                }}
              />
              Acknowledge not-covered submission
            </label>
            <button
              className="primary-button secondary-button"
              disabled={!acknowledgedNotCovered}
              type="button"
              onClick={() => setStep("review")}
            >
              Continue to review
            </button>
          </section>
        ) : null}

        {step === "review" && requirementsChecked ? (
          <section className="panel review-panel" aria-busy={submitting}>
            <h2>Review and submit</h2>
            <dl className="review-list">
              <div>
                <dt>Patient</dt>
                <dd>Maya Chen</dd>
              </div>
              <div>
                <dt>Health plan</dt>
                <dd>Acme Health PPO</dd>
              </div>
              <div>
                <dt>Requested service</dt>
                <dd>{serviceLabel}</dd>
              </div>
              <div>
                <dt>Requirements result</dt>
                <dd>{isFullBody ? "Not covered benefit" : "Coverage confirmed, prior authorization required"}</dd>
              </div>
              <div>
                <dt>Assessment</dt>
                <dd>{assessmentLabel}</dd>
              </div>
            </dl>

            {assessmentStatus === "skipped" ? (
              <p className="action-status warning-copy">
                Assessment was skipped. The request can still be submitted, but supporting documentation is incomplete.
              </p>
            ) : null}

            {isFullBody ? (
              <p className="action-status warning-copy">
                This service is not covered by the selected plan. The request will be submitted with a not-covered reason.
              </p>
            ) : null}

            <button className="primary-button" disabled={submitDisabled} type="button" onClick={submitPriorAuth}>
              {submitting ? "Submitting..." : "Submit prior authorization"}
            </button>

            {error ? (
              <p className="error-text" role="alert">
                {error}
              </p>
            ) : null}

            {submitted ? (
              <div aria-live="polite" className="result-box" role="status">
                <strong>Prior authorization submitted</strong>
                <p>PA ID: {submitted.caseId}</p>
                <p>
                  Status:{" "}
                  {submitted.paResult === "denied_not_covered" ? "Denied - not covered benefit" : "Submitted / pending"}
                </p>
              </div>
            ) : null}
          </section>
        ) : null}
      </section>

      {assessmentModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal" role="dialog" aria-labelledby="assessment-title">
            <h2 id="assessment-title">Knee MRI clinical assessment</h2>
            <p>Answer the payer-requested assessment items or skip them and submit with incomplete documentation.</p>
            <div className="assessment-list">
              {assessmentItems.map((item) => (
                <label key={item} className="checkbox-row">
                  <input checked readOnly type="checkbox" />
                  {item}
                </label>
              ))}
            </div>
            <div className="button-row">
              <button className="primary-button" type="button" onClick={saveAssessment}>
                Save assessment
              </button>
              <button className="primary-button secondary-button" type="button" onClick={skipAssessment}>
                Skip assessment
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
