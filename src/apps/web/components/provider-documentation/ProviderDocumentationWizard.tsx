"use client";

import type { DtrAnswers, PriorAuthRecord, ServiceCode } from "@operon-labs/um-platform";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  summarizeAssessmentAnswers,
  assessmentQuestions,
  serviceOptions,
  stepContextByStep,
  type AssessmentAnswerMap,
  type AssessmentAnswerValue,
  type PortalStep,
  wizardSteps
} from "./provider-portal-content";

/* eslint-disable no-unused-vars -- Callback parameter names document select and checkbox values. */
type PatientId = "patient-maya-chen";
type PlanId = "acme-health-ppo";
type AssessmentStatus = "not_required" | "not_started" | "complete" | "incomplete" | "skipped";

const completeDtr: DtrAnswers = {
  symptomDurationConfirmed: true,
  conservativeTherapyConfirmed: true,
  examFindingsConfirmed: true,
  clinicalNoteAttached: true
};

export function ProviderDocumentationWizard() {
  const [step, setStep] = useState<PortalStep>("setup");
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
  const [assessmentAnswers, setAssessmentAnswers] = useState<AssessmentAnswerMap>({});
  const submitRequestRef = useRef(0);
  const selectedPathRef = useRef("");

  const selectedPath = `${patientId ?? ""}:${planId ?? ""}:${serviceCode ?? ""}`;
  const currentStepIndex = wizardSteps.findIndex((candidate) => candidate.id === step);
  const service = serviceCode ? serviceOptions[serviceCode] : null;
  const assessmentSummary = summarizeAssessmentAnswers(assessmentAnswers);
  const isKneeMri = serviceCode === "knee_mri";
  const isFullBody = serviceCode === "full_body_wellness_mri";
  const context = submitted
    ? {
        title: "Submission received",
        body: "The prior authorization request has been submitted to the plan and is now pending review.",
        bullets: ["The provider portal workflow is complete.", "Plan-side incentives are evaluated outside this provider flow."]
      }
    : stepContextByStep[step];

  function resetAfterSetup() {
    setServiceCode(null);
    resetAfterService();
  }

  function resetAfterService() {
    setRequirementsChecked(false);
    setAssessmentStatus("not_started");
    setAssessmentAnswers({});
    setAcknowledgedNotCovered(false);
    setSubmitted(null);
    setError(null);
    setAssessmentModalOpen(false);
  }

  function selectPatient(nextPatientId: string) {
    setPatientId(nextPatientId === "patient-maya-chen" ? nextPatientId : null);
    setPlanId(null);
    resetAfterSetup();
  }

  function selectPlan(nextPlanId: string) {
    setPlanId(nextPlanId === "acme-health-ppo" ? nextPlanId : null);
    resetAfterSetup();
  }

  function selectService(nextServiceCode: string) {
    const normalizedServiceCode =
      nextServiceCode === "knee_mri" || nextServiceCode === "full_body_wellness_mri" ? nextServiceCode : null;
    setServiceCode(normalizedServiceCode);
    resetAfterService();
  }

  function continueToService() {
    if (patientId && planId) {
      setStep("service");
    }
  }

  function checkCoverageAndRequirements() {
    if (!serviceCode) {
      return;
    }

    setRequirementsChecked(true);
    setAssessmentStatus(serviceCode === "full_body_wellness_mri" ? "not_required" : "not_started");
    setAcknowledgedNotCovered(false);
    setSubmitted(null);
    setError(null);
    setStep("coverage");
  }

  function saveAssessment() {
    if (!assessmentSummary.allAnswered) {
      return;
    }

    setAssessmentStatus(assessmentSummary.supportsMedicalNecessity ? "complete" : "incomplete");
    setAssessmentModalOpen(false);
    setSubmitted(null);
    setError(null);
  }

  function skipAssessment() {
    setAssessmentStatus("skipped");
    setAssessmentAnswers({});
    setAssessmentModalOpen(false);
    setSubmitted(null);
    setError(null);
  }

  function answerAssessmentQuestion(questionId: string, value: AssessmentAnswerValue) {
    setAssessmentAnswers((currentAnswers) => ({ ...currentAnswers, [questionId]: value }));
    setAssessmentStatus("not_started");
    setSubmitted(null);
    setError(null);
  }

  function continueToReview() {
    if (canContinueToReview()) {
      setStep("review");
    }
  }

  function canContinueToReview() {
    return requirementsChecked && ((isKneeMri && assessmentStatus !== "not_started") || (isFullBody && acknowledgedNotCovered));
  }

  function submitAnotherRequest() {
    setStep("setup");
    setPatientId(null);
    setPlanId(null);
    setServiceCode(null);
    setRequirementsChecked(false);
    setAssessmentStatus("not_started");
    setAssessmentAnswers({});
    setAcknowledgedNotCovered(false);
    setSubmitted(null);
    setSubmitting(false);
    setError(null);
    setAssessmentModalOpen(false);
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

  return (
    <main className="workspace provider-portal">
      <Link className="back" href="/">
        Back to demos
      </Link>

      <section className="hero compact provider-hero">
        <span className="eyebrow">Provider portal</span>
        <h1>New prior authorization</h1>
        <p>Select patient coverage, search the requested service, check requirements, and submit the request.</p>
      </section>

      <section className="wizard-shell provider-shell">
        <ol className="stepper compact-stepper" aria-label="Prior authorization steps">
          {wizardSteps.map((candidate, index) => (
            <li
              key={candidate.id}
              className={`${index < currentStepIndex || submitted ? "done" : ""} ${index === currentStepIndex && !submitted ? "active" : ""}`}
            >
              <strong>{index + 1}</strong>
              <span>{candidate.label}</span>
            </li>
          ))}
        </ol>

        <div className="wizard-grid provider-stage-grid">
          <section className="wizard-stage panel" aria-busy={submitting}>
            {submitted ? (
              <SubmissionConfirmation submitted={submitted} onSubmitAnother={submitAnotherRequest} />
            ) : (
              <>
                {step === "setup" ? (
                  <SetupStep
                    patientId={patientId}
                    planId={planId}
                    submitting={submitting}
                    onPatientChange={selectPatient}
                    onPlanChange={selectPlan}
                    onContinue={continueToService}
                  />
                ) : null}

                {step === "service" ? (
                  <ServiceStep serviceCode={serviceCode} service={service} onServiceChange={selectService} onCheck={checkCoverageAndRequirements} />
                ) : null}

                {step === "coverage" ? (
                  <CoverageStep
                    acknowledgedNotCovered={acknowledgedNotCovered}
                    assessmentStatus={assessmentStatus}
                    service={service}
                    serviceCode={serviceCode}
                    onAcknowledge={setAcknowledgedNotCovered}
                    onOpenAssessment={() => setAssessmentModalOpen(true)}
                    onReview={continueToReview}
                  />
                ) : null}

                {step === "review" ? (
                  <ReviewStep
                    acknowledgedNotCovered={acknowledgedNotCovered}
                    assessmentStatus={assessmentStatus}
                    error={error}
                    service={service}
                    serviceCode={serviceCode}
                    submitting={submitting}
                    onSubmit={submitPriorAuth}
                  />
                ) : null}
              </>
            )}
          </section>

          <aside className="panel step-context">
            <span className="eyebrow">Current step</span>
            <h2>{context.title}</h2>
            <p>{context.body}</p>
            <ul>
              {context.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {assessmentModalOpen ? (
        <AssessmentModal
          answers={assessmentAnswers}
          summary={assessmentSummary}
          onAnswerChange={answerAssessmentQuestion}
          onSave={saveAssessment}
          onSkip={skipAssessment}
        />
      ) : null}
    </main>
  );
}

function AssessmentModal({
  answers,
  summary,
  onAnswerChange,
  onSave,
  onSkip
}: {
  answers: AssessmentAnswerMap;
  summary: ReturnType<typeof summarizeAssessmentAnswers>;
  onAnswerChange: (questionId: string, value: AssessmentAnswerValue) => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  const unansweredCount = summary.totalCount - summary.answeredCount;
  const progressClassName = summary.allAnswered ? (summary.supportsMedicalNecessity ? "complete" : "warning") : "";
  const progressText = summary.allAnswered
    ? summary.supportsMedicalNecessity
      ? "All answers support medical necessity for this demo policy."
      : "One or more answers are No. The PA can still be submitted, but documentation is incomplete."
    : `Answer ${unansweredCount} more ${unansweredCount === 1 ? "question" : "questions"} to save the assessment.`;

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="modal assessment-modal" role="dialog" aria-labelledby="assessment-title">
        <h2 id="assessment-title">Knee MRI medical necessity assessment</h2>
        <p>Answer each payer-requested documentation question. These answers determine whether the request has complete supporting documentation.</p>
        <ol className="assessment-list">
          {assessmentQuestions.map((question, index) => (
            <li key={question.id} className="assessment-question">
              <fieldset>
                <legend>
                  <span className="question-number">{index + 1}</span>
                  <span>{question.prompt}</span>
                </legend>
                <p>{question.helper}</p>
                <div className="radio-group">
                  {question.answerOptions.map((answerOption) => (
                    <label
                      key={answerOption.value}
                      className={`radio-card ${answers[question.id] === answerOption.value ? "selected" : ""}`}
                    >
                      <input
                        checked={answers[question.id] === answerOption.value}
                        name={`assessment-${question.id}`}
                        type="radio"
                        value={answerOption.value}
                        onChange={() => onAnswerChange(question.id, answerOption.value)}
                      />
                      <span>{answerOption.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </li>
          ))}
        </ol>
        <p className={`assessment-progress ${progressClassName}`}>
          {summary.answeredCount} of {summary.totalCount} answered. {progressText}
        </p>
        <div className="button-row">
          <button className="primary-button" disabled={!summary.allAnswered} type="button" onClick={onSave}>
            Save assessment
          </button>
          <button className="primary-button secondary-button" type="button" onClick={onSkip}>
            Skip assessment
          </button>
        </div>
      </section>
    </div>
  );
}

function SetupStep({
  patientId,
  planId,
  submitting,
  onPatientChange,
  onPlanChange,
  onContinue
}: {
  patientId: PatientId | null;
  planId: PlanId | null;
  submitting: boolean;
  onPatientChange: (value: string) => void;
  onPlanChange: (value: string) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <h2>Patient and coverage</h2>
      <p className="stage-copy">Start by selecting the patient and the plan tied to this request.</p>
      <div className="stage-form two-field-grid">
        <label className="form-row">
          <span>Patient</span>
          <select className="select-control" disabled={submitting} value={patientId ?? ""} onChange={(event) => onPatientChange(event.target.value)}>
            <option value="">Select patient</option>
            <option value="patient-maya-chen">Maya Chen</option>
          </select>
        </label>

        <label className="form-row">
          <span>Health plan</span>
          <select className="select-control" disabled={!patientId || submitting} value={planId ?? ""} onChange={(event) => onPlanChange(event.target.value)}>
            <option value="">Select health plan</option>
            <option value="acme-health-ppo">Acme Health PPO</option>
          </select>
        </label>
      </div>
      <button className="primary-button" disabled={!patientId || !planId || submitting} type="button" onClick={onContinue}>
        Next: service
      </button>
    </>
  );
}

function ServiceStep({
  serviceCode,
  service,
  onServiceChange,
  onCheck
}: {
  serviceCode: ServiceCode | null;
  service: (typeof serviceOptions)[ServiceCode] | null;
  onServiceChange: (value: string) => void;
  onCheck: () => void;
}) {
  return (
    <>
      <h2>Service search</h2>
      <ReadOnlyFields fields={[["Patient", "Maya Chen"], ["Health plan", "Acme Health PPO"]]} />
      <label className="form-row">
        <span>Search service</span>
        <select className="select-control" value={serviceCode ?? ""} onChange={(event) => onServiceChange(event.target.value)}>
          <option value="">Search service or CPT code</option>
          <option value="knee_mri">CPT 73721 - Knee MRI after injury</option>
          <option value="full_body_wellness_mri">CPT 76498 - Full-body wellness MRI screening</option>
        </select>
      </label>
      {service ? <ServiceCard service={service} /> : null}
      <button className="primary-button" disabled={!serviceCode} type="button" onClick={onCheck}>
        Check coverage and requirements
      </button>
    </>
  );
}

function CoverageStep({
  acknowledgedNotCovered,
  assessmentStatus,
  service,
  serviceCode,
  onAcknowledge,
  onOpenAssessment,
  onReview
}: {
  acknowledgedNotCovered: boolean;
  assessmentStatus: AssessmentStatus;
  service: (typeof serviceOptions)[ServiceCode] | null;
  serviceCode: ServiceCode | null;
  onAcknowledge: (value: boolean) => void;
  onOpenAssessment: () => void;
  onReview: () => void;
}) {
  const canReview = serviceCode === "knee_mri" ? assessmentStatus !== "not_started" : acknowledgedNotCovered;

  return (
    <>
      <h2>Coverage and requirements</h2>
      <ReadOnlyFields fields={[["Patient", "Maya Chen"], ["Health plan", "Acme Health PPO"], ["Service", service?.label ?? "Not selected"]]} />
      {serviceCode === "knee_mri" ? (
        <div className="coverage-card approved-result">
          <span className="status approved">Coverage confirmed</span>
          <h3>Prior authorization required</h3>
          <p>Medical necessity documentation is required before this request is submitted.</p>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={onOpenAssessment}>
              Open assessment
            </button>
            <span className={`assessment-pill ${assessmentStatus}`}>Assessment: {formatAssessmentStatus(assessmentStatus)}</span>
          </div>
        </div>
      ) : (
        <div className="coverage-card warning-panel">
          <span className="status blocked">Not covered benefit</span>
          <h3>Routine full-body wellness screening is not covered</h3>
          <p>The request can still be submitted, but it will include the not-covered benefit reason.</p>
          <label className="checkbox-row warning-copy">
            <input checked={acknowledgedNotCovered} type="checkbox" onChange={(event) => onAcknowledge(event.target.checked)} />
            Acknowledge not-covered submission
          </label>
        </div>
      )}
      <button className="primary-button" disabled={!canReview} type="button" onClick={onReview}>
        Review
      </button>
    </>
  );
}

function ReviewStep({
  acknowledgedNotCovered,
  assessmentStatus,
  error,
  service,
  serviceCode,
  submitting,
  onSubmit
}: {
  acknowledgedNotCovered: boolean;
  assessmentStatus: AssessmentStatus;
  error: string | null;
  service: (typeof serviceOptions)[ServiceCode] | null;
  serviceCode: ServiceCode | null;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      <h2>Review prior authorization request</h2>
      <dl className="review-list review-main">
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
          <dd>{service?.label ?? "Not selected"}</dd>
        </div>
        <div>
          <dt>Procedure</dt>
          <dd>
            {service?.procedureCode} · {service?.procedureSummary}
          </dd>
        </div>
        <div>
          <dt>Coverage result</dt>
          <dd>{serviceCode === "full_body_wellness_mri" ? "Not covered benefit" : "Coverage confirmed; PA required"}</dd>
        </div>
        <div>
          <dt>Assessment</dt>
          <dd>{serviceCode === "full_body_wellness_mri" ? "Not required" : formatAssessmentStatus(assessmentStatus)}</dd>
        </div>
      </dl>
      {assessmentStatus === "skipped" ? (
        <p className="action-status warning-copy">Assessment was skipped. The request can still be submitted, but supporting documentation is incomplete.</p>
      ) : null}
      {assessmentStatus === "incomplete" ? (
        <p className="action-status warning-copy">Assessment includes at least one No answer. The request can still be submitted, but supporting documentation is incomplete.</p>
      ) : null}
      {serviceCode === "full_body_wellness_mri" && acknowledgedNotCovered ? (
        <p className="action-status warning-copy">The request will be submitted with a not-covered benefit reason.</p>
      ) : null}
      <button className="primary-button" disabled={submitting} type="button" onClick={onSubmit}>
        {submitting ? "Submitting..." : "Submit prior authorization"}
      </button>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function SubmissionConfirmation({ submitted, onSubmitAnother }: { submitted: PriorAuthRecord; onSubmitAnother: () => void }) {
  return (
    <div className="confirmation-panel" aria-live="polite" role="status">
      <span className="status pending">Pending review</span>
      <h2>Prior authorization submitted</h2>
      <p>The request was received by the plan and is pending review.</p>
      <dl className="review-list review-main">
        <div>
          <dt>PA ID</dt>
          <dd>{submitted.caseId}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{submitted.paResult === "denied_not_covered" ? "Denied - not covered benefit" : "Pending review"}</dd>
        </div>
        <div>
          <dt>Service</dt>
          <dd>{submitted.serviceLabel}</dd>
        </div>
      </dl>
      <button className="primary-button secondary-button" type="button" onClick={onSubmitAnother}>
        Submit another request
      </button>
    </div>
  );
}

function ServiceCard({ service }: { service: (typeof serviceOptions)[ServiceCode] }) {
  return (
    <article className="service-card">
      <div>
        <span className="label">{service.procedureCode}</span>
        <h3>{service.label}</h3>
        <p>{service.procedureSummary}</p>
      </div>
      <p>{service.description}</p>
      <ul>
        {service.details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    </article>
  );
}

function ReadOnlyFields({ fields }: { fields: Array<[string, string]> }) {
  return (
    <dl className="readonly-fields">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatAssessmentStatus(status: AssessmentStatus) {
  switch (status) {
    case "complete":
      return "Complete";
    case "incomplete":
      return "Incomplete";
    case "skipped":
      return "Skipped";
    case "not_required":
      return "Not required";
    case "not_started":
      return "Not started";
  }
}
