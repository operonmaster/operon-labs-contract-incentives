"use client";

import type {
  CoverageRequirements,
  CrdServiceOption,
  DtrQuestion,
  DtrQuestionnaire,
  DtrQuestionnaireResponse,
  RequestType,
  ServiceCode,
  UMRequest
} from "@operon-labs/um-platform";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PatientCoverageContext } from "../../lib/um-reference-data";
import { LabsBadge, LabsButton, LabsHero, LabsModal, LabsPageShell, LabsSelect } from "../labs-ui";
import { UseCaseNavigation } from "./UseCaseNavigation";
import {
  canContinueFromSetup,
  canEditHealthPlan,
  summarizeAssessmentAnswers,
  requestTypeOptions,
  stepContextByStep,
  type AssessmentAnswerMap,
  type AssessmentAnswerValue,
  type PortalStep,
  wizardSteps
} from "./provider-portal-content";

/* eslint-disable no-unused-vars -- Callback parameter names document select and checkbox values. */
type PatientId = string;
type PlanId = string;
type AssessmentStatus = "not_required" | "not_started" | "complete" | "skipped";
type ViewedStep = PortalStep | "submission";

export function ProviderDocumentationWizard() {
  const [step, setStep] = useState<PortalStep>("setup");
  const [viewStepOverride, setViewStepOverride] = useState<PortalStep | null>(null);
  const [patientCoverageContexts, setPatientCoverageContexts] = useState<PatientCoverageContext[]>([]);
  const [patientId, setPatientId] = useState<PatientId | null>(null);
  const [planId, setPlanId] = useState<PlanId | null>(null);
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [serviceCode, setServiceCode] = useState<ServiceCode | null>(null);
  const [requirementsChecked, setRequirementsChecked] = useState(false);
  const [coverageRequirements, setCoverageRequirements] = useState<CoverageRequirements | null>(null);
  const [crdServices, setCrdServices] = useState<CrdServiceOption[]>([]);
  const [dtrQuestionnaire, setDtrQuestionnaire] = useState<DtrQuestionnaire | null>(null);
  const [assessmentStatus, setAssessmentStatus] = useState<AssessmentStatus>("not_started");
  const [acknowledgedNotCovered, setAcknowledgedNotCovered] = useState(false);
  const [submitted, setSubmitted] = useState<UMRequest | null>(null);
  const [checkingRequirements, setCheckingRequirements] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientLoadError, setPatientLoadError] = useState<string | null>(null);
  const [crdLoadError, setCrdLoadError] = useState<string | null>(null);
  const [assessmentModalOpen, setAssessmentModalOpen] = useState(false);
  const [assessmentAnswers, setAssessmentAnswers] = useState<AssessmentAnswerMap>({});
  const coverageRequestRef = useRef(0);
  const submitRequestRef = useRef(0);
  const selectedPathRef = useRef("");

  const selectedPath = `${patientId ?? ""}:${planId ?? ""}:${requestType ?? ""}:${serviceCode ?? ""}`;
  const currentStepIndex = wizardSteps.findIndex((candidate) => candidate.id === step);
  const viewableStepIndex = submitted ? wizardSteps.length - 1 : currentStepIndex;
  const viewStep = viewStepOverride ?? (submitted ? "submission" : step);
  const selectedPatientCoverage = patientId
    ? patientCoverageContexts.find((patient) => patient.patientId === patientId) ?? null
    : null;
  const selectedPlan = planId ? selectedPatientCoverage?.plans.find((plan) => plan.planId === planId) ?? null : null;
  const patientDisplay = selectedPatientCoverage?.patientDisplay ?? "Not selected";
  const planDisplay = selectedPlan?.planDisplay ?? "Not selected";
  const servicesByCode = useMemo(
    () => new Map<ServiceCode, CrdServiceOption>(crdServices.map((candidate) => [candidate.serviceCode, candidate])),
    [crdServices]
  );
  const service = serviceCode ? servicesByCode.get(serviceCode) ?? null : null;
  const assessmentQuestionsForService = dtrQuestionnaire?.questions ?? [];
  const assessmentSummary = summarizeAssessmentAnswers(assessmentAnswers, assessmentQuestionsForService);
  const requiresAssessment = Boolean(coverageRequirements?.documentationTemplateId);
  const isNotCovered = coverageRequirements?.coveredBenefit === false;
  const context = submitted
    ? {
        title: "Submission received",
        body: "The prior authorization request has been submitted to the plan and is now pending review.",
        bullets: ["The provider portal workflow is complete.", "Use the Health Plan View to inspect the submitted request."]
      }
    : stepContextByStep[step];

  useEffect(() => {
    selectedPathRef.current = selectedPath;
  }, [selectedPath]);

  useEffect(() => {
    let cancelled = false;

    async function loadPatients() {
      try {
        const response = await fetch("/api/um/patients");
        const payload = (await response.json()) as { patients?: PatientCoverageContext[]; error?: string };

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.patients) {
          setPatientLoadError(payload.error ?? "Unable to load patient coverage");
          return;
        }

        setPatientCoverageContexts(payload.patients);
        setPatientLoadError(null);
      } catch {
        if (!cancelled) {
          setPatientLoadError("Unable to load patient coverage");
        }
      }
    }

    const patientLoadId = window.setTimeout(() => {
      void loadPatients();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(patientLoadId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCrdServices() {
      if (!planId) {
        setCrdServices([]);
        setCrdLoadError(null);
        return;
      }

      try {
        const response = await fetch(`/api/um/crd/service-options?planId=${encodeURIComponent(planId)}`);
        const payload = (await response.json()) as { services?: CrdServiceOption[]; error?: string };

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.services) {
          setCrdLoadError(payload.error ?? "Unable to load plan service options");
          return;
        }

        setCrdServices(payload.services);
        setCrdLoadError(null);
      } catch {
        if (!cancelled) {
          setCrdLoadError("Unable to load plan service options");
        }
      }
    }

    void loadCrdServices();

    return () => {
      cancelled = true;
    };
  }, [planId]);

  function resetAfterSetup() {
    setRequestType(null);
    setServiceCode(null);
    resetAfterService();
  }

  function resetAfterService() {
    cancelPendingRequests();
    setRequirementsChecked(false);
    setCoverageRequirements(null);
    setDtrQuestionnaire(null);
    setAssessmentStatus("not_started");
    setAssessmentAnswers({});
    setAcknowledgedNotCovered(false);
    setSubmitted(null);
    setCheckingRequirements(false);
    setError(null);
    setAssessmentModalOpen(false);
  }

  function cancelPendingRequests() {
    coverageRequestRef.current += 1;
    submitRequestRef.current += 1;
  }

  function viewWizardStep(nextStep: PortalStep) {
    setViewStepOverride(!submitted && nextStep === step ? null : nextStep);
  }

  function returnToWorkflowView() {
    setViewStepOverride(null);
  }

  function selectPatient(nextPatientId: string) {
    const nextPatientCoverage = patientCoverageContexts.find((patient) => patient.patientId === nextPatientId) ?? null;
    setPatientId(nextPatientCoverage?.patientId ?? null);
    setPlanId(null);
    resetAfterSetup();
  }

  function selectPlan(nextPlanId: string) {
    const nextPlan = selectedPatientCoverage?.plans.find((plan) => plan.planId === nextPlanId) ?? null;
    setPlanId(nextPlan?.planId ?? null);
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
    const selectedService = crdServices.find(
      (candidate) => candidate.serviceCode === nextServiceCode && candidate.requestType === requestType
    );
    const normalizedServiceCode = selectedService ? selectedService.serviceCode : null;
    setServiceCode(normalizedServiceCode);
    resetAfterService();
  }

  function continueToService() {
    if (patientId && planId) {
      returnToWorkflowView();
      setStep("service");
    }
  }

  async function checkCoverageAndRequirements() {
    if (!planId || !requestType || !serviceCode) {
      return;
    }

    const requestId = coverageRequestRef.current + 1;
    coverageRequestRef.current = requestId;
    const requestPath = selectedPath;
    setCheckingRequirements(true);
    setRequirementsChecked(false);
    setCoverageRequirements(null);
    setDtrQuestionnaire(null);
    setAssessmentStatus("not_started");
    setAssessmentAnswers({});
    setAcknowledgedNotCovered(false);
    setSubmitted(null);
    setError(null);

    try {
      const coverageResponse = await fetch(
        `/api/um/crd/coverage-requirements?planId=${encodeURIComponent(planId)}&requestType=${encodeURIComponent(requestType)}&serviceCode=${encodeURIComponent(serviceCode)}`
      );
      const coveragePayload = (await coverageResponse.json()) as { requirements?: CoverageRequirements; error?: string };

      if (coverageRequestRef.current !== requestId || selectedPathRef.current !== requestPath) {
        return;
      }

      if (!coverageResponse.ok || !coveragePayload.requirements) {
        setError(coveragePayload.error ?? "Unable to check coverage requirements");
        return;
      }

      const requirements = coveragePayload.requirements;
      let nextQuestionnaire: DtrQuestionnaire | null = null;

      if (requirements.documentationTemplateId) {
        const questionnaireResponse = await fetch(
          `/api/um/dtr/questionnaires/${encodeURIComponent(requirements.documentationTemplateId)}`
        );
        const questionnairePayload = (await questionnaireResponse.json()) as { questionnaire?: DtrQuestionnaire; error?: string };

        if (coverageRequestRef.current !== requestId || selectedPathRef.current !== requestPath) {
          return;
        }

        if (!questionnaireResponse.ok || !questionnairePayload.questionnaire) {
          setError(questionnairePayload.error ?? "Unable to load documentation assessment");
          return;
        }

        nextQuestionnaire = questionnairePayload.questionnaire;
      }

      setCoverageRequirements(requirements);
      setDtrQuestionnaire(nextQuestionnaire);
      setAssessmentStatus(requirements.documentationTemplateId ? "not_started" : "not_required");
      setRequirementsChecked(true);
      returnToWorkflowView();
      setStep("coverage");
    } catch {
      if (coverageRequestRef.current === requestId && selectedPathRef.current === requestPath) {
        setError("Unable to check coverage requirements");
      }
    } finally {
      if (coverageRequestRef.current === requestId) {
        setCheckingRequirements(false);
      }
    }
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
      returnToWorkflowView();
      setStep("review");
    }
  }

  function canContinueToReview() {
    if (!requirementsChecked || !coverageRequirements) {
      return false;
    }

    if (requiresAssessment) {
      return assessmentStatus !== "not_started";
    }

    if (isNotCovered) {
      return acknowledgedNotCovered;
    }

    return true;
  }

  function submitAnotherRequest() {
    cancelPendingRequests();
    returnToWorkflowView();
    setStep("setup");
    setPatientId(null);
    setPlanId(null);
    setRequestType(null);
    setServiceCode(null);
    setRequirementsChecked(false);
    setCoverageRequirements(null);
    setDtrQuestionnaire(null);
    setAssessmentStatus("not_started");
    setAssessmentAnswers({});
    setAcknowledgedNotCovered(false);
    setSubmitted(null);
    setSubmitting(false);
    setError(null);
    setAssessmentModalOpen(false);
  }

  async function submitPriorAuth() {
    if (!patientId || !planId || !requestType || !serviceCode || !requirementsChecked) {
      return;
    }

    const requestId = submitRequestRef.current + 1;
    submitRequestRef.current = requestId;
    const requestPath = selectedPath;
    setSubmitting(true);
    setError(null);

    const dtrQuestionnaireResponse =
      assessmentStatus === "complete" && dtrQuestionnaire
        ? ({
            questionnaireId: dtrQuestionnaire.id,
            answers: dtrQuestionnaire.questions.map((question) => ({
              questionId: question.id,
              value: assessmentAnswers[question.id] ?? "no"
            }))
          } satisfies DtrQuestionnaireResponse)
        : undefined;

    const body =
      requiresAssessment
        ? {
            planId,
            patientId,
            requestType,
            serviceCode,
            dtrQuestionnaireResponse
          }
        : { patientId, planId, requestType, serviceCode, acknowledgedNotCovered };

    try {
      const response = await fetch("/api/um/prior-auths", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as UMRequest | { error?: string };

      if (submitRequestRef.current !== requestId || selectedPathRef.current !== requestPath) {
        return;
      }

      if (!response.ok) {
        setError("error" in payload && payload.error ? payload.error : "Unable to submit prior authorization");
        return;
      }

      returnToWorkflowView();
      setSubmitted(payload as UMRequest);
    } catch {
      if (submitRequestRef.current !== requestId || selectedPathRef.current !== requestPath) {
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
        <UseCaseNavigation activeView="provider" umRequestId={submitted?.id} />
      </div>

      <LabsHero className="provider-hero" compact eyebrow="Provider portal" title="New prior authorization">
        <p>
          Submit a prior authorization request with the patient, plan, requested item, coverage response, and required
          documentation the health plan needs for review.
        </p>
      </LabsHero>

      <section className="wizard-shell provider-shell">
        <ol className="stepper compact-stepper" aria-label="Prior authorization steps">
          {wizardSteps.map((candidate, index) => {
            const canViewStep = index <= viewableStepIndex;
            const classes = [
              index < currentStepIndex || submitted ? "done" : "",
              index === currentStepIndex && !submitted ? "active" : "",
              viewStep === candidate.id ? "viewing" : "",
              canViewStep ? "stepper-clickable" : "stepper-disabled"
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li
                key={candidate.id}
                aria-current={index === currentStepIndex && !submitted ? "step" : undefined}
                className={classes}
              >
                <button
                  aria-label={candidate.label}
                  aria-pressed={viewStep === candidate.id}
                  className="stepper-step-button"
                  disabled={!canViewStep}
                  type="button"
                  onClick={() => viewWizardStep(candidate.id)}
                >
                  <strong aria-hidden="true">{index + 1}</strong>
                  <span>{candidate.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="wizard-grid provider-stage-grid">
          <section className="wizard-stage panel" aria-busy={submitting || checkingRequirements}>
            {submitted && viewStep === "submission" ? (
              <SubmissionConfirmation submitted={submitted} onSubmitAnother={submitAnotherRequest} />
            ) : viewStep !== "submission" && (submitted || viewStep !== step) ? (
              <CompletedStepSummary
                acknowledgedNotCovered={acknowledgedNotCovered}
                assessmentStatus={assessmentStatus}
                coverageRequirements={coverageRequirements}
                patientDisplay={patientDisplay}
                planDisplay={planDisplay}
                requestType={requestType}
                service={service}
                stepId={viewStep}
                submitted={submitted}
                onReturnToSubmission={submitted ? returnToWorkflowView : undefined}
              />
            ) : (
              <>
                {viewStep === "setup" ? (
                  <SetupStep
                    patientLoadError={patientLoadError}
                    patientCoverageContexts={patientCoverageContexts}
                    patientId={patientId}
                    planId={planId}
                    selectedPatientCoverage={selectedPatientCoverage}
                    submitting={submitting}
                    onPatientChange={selectPatient}
                    onPlanChange={selectPlan}
                    onContinue={continueToService}
                  />
                ) : null}

                {viewStep === "service" ? (
                  <ServiceStep
                    checkingRequirements={checkingRequirements}
                    crdLoadError={crdLoadError}
                    error={error}
                    patientDisplay={patientDisplay}
                    planDisplay={planDisplay}
                    requestType={requestType}
                    services={crdServices}
                    serviceCode={serviceCode}
                    service={service}
                    onRequestTypeChange={selectRequestType}
                    onServiceChange={selectService}
                    onCheck={checkCoverageAndRequirements}
                  />
                ) : null}

                {viewStep === "coverage" ? (
                  <CoverageStep
                    acknowledgedNotCovered={acknowledgedNotCovered}
                    assessmentStatus={assessmentStatus}
                    coverageRequirements={coverageRequirements}
                    patientDisplay={patientDisplay}
                    planDisplay={planDisplay}
                    requestType={requestType}
                    service={service}
                    onAcknowledge={setAcknowledgedNotCovered}
                    onOpenAssessment={() => setAssessmentModalOpen(true)}
                    onReview={continueToReview}
                  />
                ) : null}

                {viewStep === "review" ? (
                  <ReviewStep
                    acknowledgedNotCovered={acknowledgedNotCovered}
                    assessmentStatus={assessmentStatus}
                    coverageRequirements={coverageRequirements}
                    error={error}
                    patientDisplay={patientDisplay}
                    planDisplay={planDisplay}
                    requestType={requestType}
                    service={service}
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
          onClose={() => setAssessmentModalOpen(false)}
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
  onClose,
  onSave,
  onSkip
}: {
  answers: AssessmentAnswerMap;
  questions: DtrQuestion[];
  service: CrdServiceOption | null;
  summary: ReturnType<typeof summarizeAssessmentAnswers>;
  onAnswerChange: (questionId: string, value: AssessmentAnswerValue) => void;
  onClose: () => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  const unansweredCount = summary.totalCount - summary.answeredCount;
  const progressClassName = summary.isComplete ? "complete" : "";
  const progressText = summary.isComplete
    ? "Assessment complete. All required questions have been answered."
    : `Answer ${unansweredCount} more ${unansweredCount === 1 ? "question" : "questions"} to save the assessment.`;

  return (
    <LabsModal onClose={onClose} labelledBy="assessment-title" className="assessment-modal">
      <div className="modal-toolbar">
          <div>
            <h2 id="assessment-title">{service?.assessmentTitle ?? "Documentation assessment"}</h2>
            <p>{service?.assessmentIntro ?? "Answer each payer-requested documentation question before submitting the prior authorization."}</p>
          </div>
          <LabsButton variant="row" onClick={onClose}>
            Close assessment
          </LabsButton>
        </div>
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
          <LabsButton disabled={!summary.isComplete} onClick={onSave}>
            Save assessment
          </LabsButton>
          <LabsButton variant="secondary" onClick={onSkip}>
            Skip assessment
          </LabsButton>
        </div>
    </LabsModal>
  );
}

function SetupStep({
  patientLoadError,
  patientCoverageContexts,
  patientId,
  planId,
  selectedPatientCoverage,
  submitting,
  onPatientChange,
  onPlanChange,
  onContinue
}: {
  patientLoadError: string | null;
  patientCoverageContexts: PatientCoverageContext[];
  patientId: PatientId | null;
  planId: PlanId | null;
  selectedPatientCoverage: PatientCoverageContext | null;
  submitting: boolean;
  onPatientChange: (value: string) => void;
  onPlanChange: (value: string) => void;
  onContinue: () => void;
}) {
  const patientOptions = patientCoverageContexts.map((patientCoverage) => ({
    value: patientCoverage.patientId,
    label: patientCoverage.patientDisplay
  }));
  const planOptions =
    selectedPatientCoverage?.plans.map((plan) => ({
      value: plan.planId,
      label: plan.planDisplay
    })) ?? [];

  return (
    <>
      <h2>Patient and coverage</h2>
      <p className="stage-copy">Start by selecting the patient and the plan tied to this request.</p>
      <div className="stage-form two-field-grid">
        <div className="form-row">
          <span>Patient</span>
          <LabsSelect ariaLabel="Patient" disabled={submitting} options={patientOptions} placeholder="Select patient" value={patientId ?? ""} onChange={onPatientChange} />
        </div>

        <div className="form-row">
          <span>Health plan</span>
          <LabsSelect
            ariaLabel="Health plan"
            disabled={!canEditHealthPlan({ patientId, submitting })}
            options={planOptions}
            placeholder="Select health plan"
            value={planId ?? ""}
            onChange={onPlanChange}
          />
        </div>
      </div>
      {patientLoadError ? (
        <p className="error-text" role="alert">
          {patientLoadError}
        </p>
      ) : null}
      <LabsButton disabled={!canContinueFromSetup({ patientId, planId, submitting })} onClick={onContinue}>
        Next: service
      </LabsButton>
    </>
  );
}

function ServiceStep({
  checkingRequirements,
  crdLoadError,
  error,
  patientDisplay,
  planDisplay,
  requestType,
  services,
  serviceCode,
  service,
  onRequestTypeChange,
  onServiceChange,
  onCheck
}: {
  checkingRequirements: boolean;
  crdLoadError: string | null;
  error: string | null;
  patientDisplay: string;
  planDisplay: string;
  requestType: RequestType | null;
  services: CrdServiceOption[];
  serviceCode: ServiceCode | null;
  service: CrdServiceOption | null;
  onRequestTypeChange: (value: RequestType) => void;
  onServiceChange: (value: string) => void;
  onCheck: () => void;
}) {
  const selectableServices =
    requestType && requestType !== "inpatient_admission"
      ? services.filter((candidate) => candidate.requestType === requestType)
      : [];
  const servicePlaceholder = requestType === "pharmacy_benefit" ? "Search medication or NDC code" : "Search service or CPT code";
  const serviceOptions = selectableServices.map((option) => ({
    value: option.serviceCode,
    label: `${option.procedureCode} - ${option.serviceLabel}`,
    description: option.procedureSummary,
    eyebrow: option.procedureCode
  }));

  return (
    <>
      <h2>Request type and service</h2>
      <ReadOnlyFields fields={[["Patient", patientDisplay], ["Health plan", planDisplay]]} />
      <fieldset className="request-type-fieldset">
        <legend>Request type</legend>
        <div className="request-type-grid" role="radiogroup" aria-label="Request type">
          {requestTypeOptions.map((option) => (
            <button
              key={option.id}
              aria-checked={requestType === option.id}
              className={`request-type-card ${requestType === option.id ? "selected" : ""}`}
              disabled={checkingRequirements || !option.enabled}
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
      <div className="form-row">
        <span>{requestType === "pharmacy_benefit" ? "Search medication" : "Search service"}</span>
        <LabsSelect
          ariaLabel={requestType === "pharmacy_benefit" ? "Search medication" : "Search service"}
          disabled={checkingRequirements || !requestType || requestType === "inpatient_admission" || Boolean(crdLoadError)}
          options={serviceOptions}
          placeholder={servicePlaceholder}
          value={serviceCode ?? ""}
          onChange={onServiceChange}
        />
      </div>
      {service ? <ServiceCard service={service} /> : null}
      {crdLoadError ? (
        <p className="error-text" role="alert">
          {crdLoadError}
        </p>
      ) : null}
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <LabsButton disabled={!requestType || !serviceCode || checkingRequirements} onClick={onCheck}>
        {checkingRequirements ? "Checking..." : "Check coverage and requirements"}
      </LabsButton>
    </>
  );
}

function CoverageStep({
  acknowledgedNotCovered,
  assessmentStatus,
  coverageRequirements,
  patientDisplay,
  planDisplay,
  requestType,
  service,
  onAcknowledge,
  onOpenAssessment,
  onReview
}: {
  acknowledgedNotCovered: boolean;
  assessmentStatus: AssessmentStatus;
  coverageRequirements: CoverageRequirements | null;
  patientDisplay: string;
  planDisplay: string;
  requestType: RequestType | null;
  service: CrdServiceOption | null;
  onAcknowledge: (value: boolean) => void;
  onOpenAssessment: () => void;
  onReview: () => void;
}) {
  const requiresAssessment = Boolean(coverageRequirements?.documentationTemplateId);
  const isNotCovered = coverageRequirements?.coveredBenefit === false;
  const canReview = requiresAssessment ? assessmentStatus !== "not_started" : !isNotCovered || acknowledgedNotCovered;

  return (
    <>
      <h2>Coverage and requirements</h2>
      <ReadOnlyFields
        fields={[
          ["Patient", patientDisplay],
          ["Health plan", planDisplay],
          ["Request type", formatRequestType(requestType)],
          ["Service", service?.serviceLabel ?? "Not selected"]
        ]}
      />
      {requiresAssessment ? (
        <div className="coverage-card approved-result">
          <LabsBadge variant="success">Coverage confirmed</LabsBadge>
          <h3>Prior authorization required</h3>
          <p>{requestType === "pharmacy_benefit" ? "Medication documentation is required before this request is submitted." : "Medical necessity documentation is required before this request is submitted."}</p>
          <div className="button-row">
            <LabsButton onClick={onOpenAssessment}>
              Open documentation assessment
            </LabsButton>
            <LabsBadge variant={assessmentBadgeVariant(assessmentStatus)}>Assessment: {formatAssessmentStatus(assessmentStatus)}</LabsBadge>
          </div>
        </div>
      ) : isNotCovered ? (
        <div className="coverage-card warning-panel">
          <LabsBadge variant="warning">Not covered benefit</LabsBadge>
          <h3>{service?.serviceLabel ?? "Requested item"} is not covered</h3>
          <p>The request can still be submitted, but it will include the not-covered benefit reason.</p>
          <label className="checkbox-row warning-copy">
            <input checked={acknowledgedNotCovered} type="checkbox" onChange={(event) => onAcknowledge(event.target.checked)} />
            Acknowledge not-covered submission
          </label>
        </div>
      ) : (
        <div className="coverage-card approved-result">
          <LabsBadge variant="success">Coverage confirmed</LabsBadge>
          <h3>No additional assessment required</h3>
          <p>The request can move to review with the coverage response returned by the plan.</p>
        </div>
      )}
      <LabsButton disabled={!canReview} onClick={onReview}>
        Review
      </LabsButton>
    </>
  );
}

function ReviewStep({
  acknowledgedNotCovered,
  assessmentStatus,
  coverageRequirements,
  error,
  patientDisplay,
  planDisplay,
  requestType,
  service,
  submitting,
  onSubmit
}: {
  acknowledgedNotCovered: boolean;
  assessmentStatus: AssessmentStatus;
  coverageRequirements: CoverageRequirements | null;
  error: string | null;
  patientDisplay: string;
  planDisplay: string;
  requestType: RequestType | null;
  service: CrdServiceOption | null;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const isNotCovered = coverageRequirements?.coveredBenefit === false;

  return (
    <>
      <h2>Review prior authorization request</h2>
      <dl className="review-list review-main">
        <div>
          <dt>Patient</dt>
          <dd>{patientDisplay}</dd>
        </div>
        <div>
          <dt>Health plan</dt>
          <dd>{planDisplay}</dd>
        </div>
        <div>
          <dt>Request type</dt>
          <dd>{formatRequestType(requestType)}</dd>
        </div>
        <div>
          <dt>Requested item</dt>
          <dd>{service?.serviceLabel ?? "Not selected"}</dd>
        </div>
        <div>
          <dt>{service?.codingSystem === "NDC" ? "Medication code" : "Procedure"}</dt>
          <dd>
            {service?.procedureCode} · {service?.procedureSummary}
          </dd>
        </div>
        <div>
          <dt>Coverage result</dt>
          <dd>{isNotCovered ? "Not covered benefit" : "Coverage confirmed; PA required"}</dd>
        </div>
        <div>
          <dt>Assessment</dt>
          <dd>{isNotCovered ? "Not required" : formatAssessmentStatus(assessmentStatus)}</dd>
        </div>
      </dl>
      {assessmentStatus === "skipped" ? (
        <p className="action-status warning-copy">Assessment was skipped. The request can still be submitted, but supporting documentation is incomplete.</p>
      ) : null}
      {isNotCovered && acknowledgedNotCovered ? (
        <p className="action-status warning-copy">The request will be submitted with a not-covered benefit reason.</p>
      ) : null}
      <LabsButton disabled={submitting} onClick={onSubmit}>
        {submitting ? "Submitting..." : "Submit prior authorization"}
      </LabsButton>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function CompletedStepSummary({
  acknowledgedNotCovered,
  assessmentStatus,
  coverageRequirements,
  patientDisplay,
  planDisplay,
  requestType,
  service,
  stepId,
  submitted,
  onReturnToSubmission
}: {
  acknowledgedNotCovered: boolean;
  assessmentStatus: AssessmentStatus;
  coverageRequirements: CoverageRequirements | null;
  patientDisplay: string;
  planDisplay: string;
  requestType: RequestType | null;
  service: CrdServiceOption | null;
  stepId: PortalStep;
  submitted: UMRequest | null;
  onReturnToSubmission?: () => void;
}) {
  const summary = getCompletedStepSummary({
    acknowledgedNotCovered,
    assessmentStatus,
    coverageRequirements,
    patientDisplay,
    planDisplay,
    requestType,
    service,
    stepId,
    submitted
  });

  return (
    <section className="provider-completed-step-review">
      <div>
        <h2>{summary.title}</h2>
        <p className="stage-copy">{summary.body}</p>
      </div>
      <ReadOnlyFields fields={summary.fields} />
      <p className="action-status">Completed step</p>
      {onReturnToSubmission ? (
        <div className="button-row">
          <LabsButton variant="secondary" onClick={onReturnToSubmission}>
            Submission confirmation
          </LabsButton>
        </div>
      ) : null}
    </section>
  );
}

function SubmissionConfirmation({ submitted, onSubmitAnother }: { submitted: UMRequest; onSubmitAnother: () => void }) {
  return (
    <div className="confirmation-panel" aria-live="polite" role="status">
      <LabsBadge variant="info">Pending review</LabsBadge>
      <h2>Prior authorization submitted</h2>
      <p>The request was received by the plan and is pending review.</p>
      <dl className="review-list review-main">
        <div>
          <dt>UM request ID</dt>
          <dd>{submitted.id}</dd>
        </div>
        <div>
          <dt>Canonical PA/UM request ID</dt>
          <dd>{submitted.id}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{formatSubmissionStatus(submitted)}</dd>
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
        <Link className="primary-button" href={`/provider-documentation/incentives?umRequestId=${encodeURIComponent(submitted.id)}`}>
          View health plan audit
        </Link>
        <LabsButton variant="secondary" onClick={onSubmitAnother}>
          Submit another request
        </LabsButton>
      </div>
    </div>
  );
}

function getCompletedStepSummary({
  acknowledgedNotCovered,
  assessmentStatus,
  coverageRequirements,
  patientDisplay,
  planDisplay,
  requestType,
  service,
  stepId,
  submitted
}: {
  acknowledgedNotCovered: boolean;
  assessmentStatus: AssessmentStatus;
  coverageRequirements: CoverageRequirements | null;
  patientDisplay: string;
  planDisplay: string;
  requestType: RequestType | null;
  service: CrdServiceOption | null;
  stepId: PortalStep;
  submitted: UMRequest | null;
}): { title: string; body: string; fields: Array<[string, string]> } {
  const requestTypeLabel = formatRequestType(requestType);
  const serviceLabel = service?.serviceLabel ?? "Not selected";
  const codeLabel = service ? `${service.procedureCode} · ${service.procedureSummary}` : "Not selected";
  const coverageResult = formatCoverageResult(coverageRequirements);
  const assessmentResult =
    coverageRequirements?.coveredBenefit === false ? "Not required" : formatAssessmentStatus(assessmentStatus);

  switch (stepId) {
    case "setup":
      return {
        title: "Patient & Plan",
        body: "Selected patient and health plan for this prior authorization request.",
        fields: [
          ["Patient", patientDisplay],
          ["Health plan", planDisplay]
        ]
      };
    case "service":
      return {
        title: "Service",
        body: "Selected request type and requested item.",
        fields: [
          ["Patient", patientDisplay],
          ["Health plan", planDisplay],
          ["Request type", requestTypeLabel],
          ["Service", serviceLabel],
          [service?.codingSystem === "NDC" ? "Medication code" : "Procedure", codeLabel]
        ]
      };
    case "coverage":
      return {
        title: "Coverage",
        body: "Coverage and documentation requirements returned by the health plan.",
        fields: [
          ["Patient", patientDisplay],
          ["Health plan", planDisplay],
          ["Request type", requestTypeLabel],
          ["Service", serviceLabel],
          ["Coverage result", coverageResult],
          ["Assessment", assessmentResult],
          ["Not-covered acknowledgement", coverageRequirements?.coveredBenefit === false ? formatBoolean(acknowledgedNotCovered) : "Not required"]
        ]
      };
    case "review":
      return {
        title: "Review",
        body: "Final request details reviewed before prior authorization submission.",
        fields: [
          ["Patient", patientDisplay],
          ["Health plan", planDisplay],
          ["Request type", requestTypeLabel],
          ["Requested item", serviceLabel],
          [service?.codingSystem === "NDC" ? "Medication code" : "Procedure", codeLabel],
          ["Coverage result", coverageResult],
          ["Assessment", assessmentResult],
          ["Submission status", submitted ? formatSubmissionStatus(submitted) : "Not submitted"]
        ]
      };
  }
}

function ServiceCard({ service }: { service: CrdServiceOption }) {
  return (
    <article className="service-card">
      <div>
        <span className="label">{service.procedureCode}</span>
        <h3>{service.serviceLabel}</h3>
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

function formatSubmissionStatus(submitted: UMRequest) {
  if (submitted.outcomeStatus) {
    return submitted.outcomeStatus === "approved" ? "Determined - approved" : "Determined - denied";
  }

  switch (submitted.state) {
    case "pend":
      return "Pending review";
    case "in_clinical_review":
      return "In clinical review";
    case "determined":
      return "Determined";
  }
}

function formatCoverageResult(coverageRequirements: CoverageRequirements | null) {
  if (!coverageRequirements) {
    return "Not checked";
  }

  if (coverageRequirements.coveredBenefit === false) {
    return "Not covered benefit";
  }

  return coverageRequirements.priorAuthRequired ? "Coverage confirmed; PA required" : "Coverage confirmed";
}

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

function assessmentBadgeVariant(status: AssessmentStatus): "success" | "warning" | "info" | "neutral" {
  switch (status) {
    case "complete":
      return "success";
    case "skipped":
      return "warning";
    case "not_started":
      return "info";
    case "not_required":
      return "neutral";
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
