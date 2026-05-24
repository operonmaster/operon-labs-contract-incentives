"use client";

import type { DtrAnswers, PriorAuthRecord, RequestType, ServiceCode } from "@operon-labs/um-platform";
import Link from "next/link";
import { useRef, useState } from "react";
import { LabsHero, LabsPageShell } from "../labs-ui";
import { UseCaseNavigation } from "./UseCaseNavigation";
import {
  canContinueFromSetup,
  canEditHealthPlan,
  getAssessmentQuestionsForService,
  summarizeAssessmentAnswers,
  requestTypeOptions,
  serviceOptionsByRequestType,
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
type AssessmentStatus = "not_required" | "not_started" | "complete" | "skipped";

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
  const [requestType, setRequestType] = useState<RequestType | null>(null);
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

  const selectedPath = `${patientId ?? ""}:${planId ?? ""}:${requestType ?? ""}:${serviceCode ?? ""}`;
  const currentStepIndex = wizardSteps.findIndex((candidate) => candidate.id === step);
  const service = serviceCode ? serviceOptions[serviceCode] : null;
  const assessmentQuestionsForService = getAssessmentQuestionsForService(service);
  const assessmentSummary = summarizeAssessmentAnswers(assessmentAnswers, assessmentQuestionsForService);
  const requiresAssessment = Boolean(service && service.requestType !== "outpatient_service") || serviceCode === "knee_mri";
  const isFullBody = serviceCode === "full_body_wellness_mri";
  const context = submitted
    ? {
        title: "Submission received",
        body: "The prior authorization request has been submitted to the plan and is now pending review.",
        bullets: ["The provider portal workflow is complete.", "Plan-side incentives are evaluated outside this provider flow."]
      }
    : stepContextByStep[step];

  function resetAfterSetup() {
    setRequestType(null);
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

  function selectRequestType(nextRequestType: RequestType) {
    const option = requestTypeOptions.find((candidate) => candidate.id === nextRequestType);
    if (!option?.enabled) {
      return;
    }

    setRequestType(nextRequestType);
    setServiceCode(null);
    resetAfterService();
  }

  function selectService(nextServiceCode: string) {
    const availableServiceCodes = requestType && requestType !== "inpatient_admission" ? serviceOptionsByRequestType[requestType] : [];
    const normalizedServiceCode = availableServiceCodes.includes(nextServiceCode as ServiceCode) ? (nextServiceCode as ServiceCode) : null;
    setServiceCode(normalizedServiceCode);
    resetAfterService();
  }

  function continueToService() {
    if (patientId && planId) {
      setStep("service");
    }
  }

  function checkCoverageAndRequirements() {
    if (!requestType || !serviceCode) {
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
    if (!assessmentSummary.isComplete) {
      return;
    }

    setAssessmentStatus("complete");
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
    return requirementsChecked && ((requiresAssessment && assessmentStatus !== "not_started") || (isFullBody && acknowledgedNotCovered));
  }

  function submitAnotherRequest() {
    setStep("setup");
    setPatientId(null);
    setPlanId(null);
    setRequestType(null);
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
    if (!requestType || !serviceCode || !requirementsChecked) {
      return;
    }

    const requestId = submitRequestRef.current + 1;
    submitRequestRef.current = requestId;
    selectedPathRef.current = selectedPath;
    setSubmitting(true);
    setError(null);

    const body =
      requiresAssessment
        ? {
            requestType,
            serviceCode,
            dtr: assessmentStatus === "complete" ? completeDtr : undefined
          }
        : { requestType, serviceCode, acknowledgedNotCovered };

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
    <LabsPageShell className="workspace provider-portal">
      <div className="top-nav-row">
        <Link className="back" href="/">
          Back to demos
        </Link>
        <UseCaseNavigation activeView="provider" caseId={submitted?.caseId} />
      </div>

      <LabsHero className="provider-hero" compact eyebrow="Provider portal" title="New prior authorization">
        <p>Select patient coverage, search the requested service, check requirements, and submit the request.</p>
      </LabsHero>

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
                  <ServiceStep
                    requestType={requestType}
                    serviceCode={serviceCode}
                    service={service}
                    onRequestTypeChange={selectRequestType}
                    onServiceChange={selectService}
                    onCheck={checkCoverageAndRequirements}
                  />
                ) : null}

                {step === "coverage" ? (
                  <CoverageStep
                    acknowledgedNotCovered={acknowledgedNotCovered}
                    assessmentStatus={assessmentStatus}
                    requestType={requestType}
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
                    requestType={requestType}
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
          questions={assessmentQuestionsForService}
          service={service}
          summary={assessmentSummary}
          onAnswerChange={answerAssessmentQuestion}
          onSave={saveAssessment}
          onSkip={skipAssessment}
        />
      ) : null}
    </LabsPageShell>
  );
}

function AssessmentModal({
  answers,
  questions,
  service,
  summary,
  onAnswerChange,
  onSave,
  onSkip
}: {
  answers: AssessmentAnswerMap;
  questions: ReturnType<typeof getAssessmentQuestionsForService>;
  service: (typeof serviceOptions)[ServiceCode] | null;
  summary: ReturnType<typeof summarizeAssessmentAnswers>;
  onAnswerChange: (questionId: string, value: AssessmentAnswerValue) => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  const unansweredCount = summary.totalCount - summary.answeredCount;
  const progressClassName = summary.isComplete ? "complete" : "";
  const progressText = summary.isComplete
    ? "Assessment complete. All required questions have been answered."
    : `Answer ${unansweredCount} more ${unansweredCount === 1 ? "question" : "questions"} to save the assessment.`;

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="modal assessment-modal" role="dialog" aria-labelledby="assessment-title">
        <h2 id="assessment-title">{service?.assessmentTitle ?? "Documentation assessment"}</h2>
        <p>{service?.assessmentIntro ?? "Answer each payer-requested documentation question before submitting the prior authorization."}</p>
        <ol className="assessment-list">
          {questions.map((question, index) => (
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
          <button className="primary-button" disabled={!summary.isComplete} type="button" onClick={onSave}>
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
          <select
            className="select-control"
            disabled={!canEditHealthPlan({ patientId, submitting })}
            value={planId ?? ""}
            onChange={(event) => onPlanChange(event.target.value)}
          >
            <option value="">Select health plan</option>
            <option value="acme-health-ppo">Acme Health PPO</option>
          </select>
        </label>
      </div>
      <button className="primary-button" disabled={!canContinueFromSetup({ patientId, planId, submitting })} type="button" onClick={onContinue}>
        Next: service
      </button>
    </>
  );
}

function ServiceStep({
  requestType,
  serviceCode,
  service,
  onRequestTypeChange,
  onServiceChange,
  onCheck
}: {
  requestType: RequestType | null;
  serviceCode: ServiceCode | null;
  service: (typeof serviceOptions)[ServiceCode] | null;
  onRequestTypeChange: (value: RequestType) => void;
  onServiceChange: (value: string) => void;
  onCheck: () => void;
}) {
  const selectableServiceCodes = requestType && requestType !== "inpatient_admission" ? serviceOptionsByRequestType[requestType] : [];
  const servicePlaceholder = requestType === "pharmacy_benefit" ? "Search medication or NDC code" : "Search service or CPT code";

  return (
    <>
      <h2>Request type and service</h2>
      <ReadOnlyFields fields={[["Patient", "Maya Chen"], ["Health plan", "Acme Health PPO"]]} />
      <fieldset className="request-type-fieldset">
        <legend>Request type</legend>
        <div className="request-type-grid" role="radiogroup" aria-label="Request type">
          {requestTypeOptions.map((option) => (
            <button
              key={option.id}
              aria-checked={requestType === option.id}
              className={`request-type-card ${requestType === option.id ? "selected" : ""}`}
              disabled={!option.enabled}
              role="radio"
              type="button"
              onClick={() => onRequestTypeChange(option.id)}
            >
              <strong>{option.label}</strong>
              <span>{option.summary}</span>
              {!option.enabled ? <em>Dormant</em> : null}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="form-row">
        <span>{requestType === "pharmacy_benefit" ? "Search medication" : "Search service"}</span>
        <select
          className="select-control"
          disabled={!requestType || requestType === "inpatient_admission"}
          value={serviceCode ?? ""}
          onChange={(event) => onServiceChange(event.target.value)}
        >
          <option value="">{servicePlaceholder}</option>
          {selectableServiceCodes.map((code) => {
            const option = serviceOptions[code];
            return (
              <option key={code} value={code}>
                {option.procedureCode} - {option.label}
              </option>
            );
          })}
        </select>
      </label>
      {service ? <ServiceCard service={service} /> : null}
      <button className="primary-button" disabled={!requestType || !serviceCode} type="button" onClick={onCheck}>
        Check coverage and requirements
      </button>
    </>
  );
}

function CoverageStep({
  acknowledgedNotCovered,
  assessmentStatus,
  requestType,
  service,
  serviceCode,
  onAcknowledge,
  onOpenAssessment,
  onReview
}: {
  acknowledgedNotCovered: boolean;
  assessmentStatus: AssessmentStatus;
  requestType: RequestType | null;
  service: (typeof serviceOptions)[ServiceCode] | null;
  serviceCode: ServiceCode | null;
  onAcknowledge: (value: boolean) => void;
  onOpenAssessment: () => void;
  onReview: () => void;
}) {
  const requiresAssessment = Boolean(service && service.requestType !== "outpatient_service") || serviceCode === "knee_mri";
  const canReview = requiresAssessment ? assessmentStatus !== "not_started" : acknowledgedNotCovered;

  return (
    <>
      <h2>Coverage and requirements</h2>
      <ReadOnlyFields
        fields={[
          ["Patient", "Maya Chen"],
          ["Health plan", "Acme Health PPO"],
          ["Request type", formatRequestType(requestType)],
          ["Service", service?.label ?? "Not selected"]
        ]}
      />
      {requiresAssessment ? (
        <div className="coverage-card approved-result">
          <span className="status approved">Coverage confirmed</span>
          <h3>Prior authorization required</h3>
          <p>{requestType === "pharmacy_benefit" ? "Medication documentation is required before this request is submitted." : "Medical necessity documentation is required before this request is submitted."}</p>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={onOpenAssessment}>
              Open documentation assessment
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
  requestType,
  service,
  serviceCode,
  submitting,
  onSubmit
}: {
  acknowledgedNotCovered: boolean;
  assessmentStatus: AssessmentStatus;
  error: string | null;
  requestType: RequestType | null;
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
          <dt>Request type</dt>
          <dd>{formatRequestType(requestType)}</dd>
        </div>
        <div>
          <dt>Requested item</dt>
          <dd>{service?.label ?? "Not selected"}</dd>
        </div>
        <div>
          <dt>{service?.codingSystem === "NDC" ? "Medication code" : "Procedure"}</dt>
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
          <dt>Request type</dt>
          <dd>{formatRequestType(submitted.requestType)}</dd>
        </div>
        <div>
          <dt>Requested item</dt>
          <dd>{submitted.serviceLabel}</dd>
        </div>
      </dl>
      <div className="button-row">
        <Link className="primary-button" href={`/provider-documentation/incentives?caseId=${encodeURIComponent(submitted.caseId)}`}>
          View health plan audit
        </Link>
        <button className="primary-button secondary-button" type="button" onClick={onSubmitAnother}>
          Submit another request
        </button>
      </div>
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
    case "skipped":
      return "Skipped";
    case "not_required":
      return "Not required";
    case "not_started":
      return "Not started";
  }
}

function formatRequestType(requestType: RequestType | null) {
  switch (requestType) {
    case "outpatient_service":
      return "Outpatient Service";
    case "pharmacy_benefit":
      return "Pharmacy Benefit";
    case "inpatient_admission":
      return "Inpatient Admission";
    default:
      return "Not selected";
  }
}
