"use client";

import type {
  CoverageRequirements,
  CrdServiceOption,
  DtrQuestion,
  DtrQuestionnaire,
  DtrQuestionnaireResponse,
  PriorAuthRecord,
  RequestType,
  ServiceCode
} from "@operon-labs/um-platform";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PatientCoverageContext } from "../../lib/um-reference-data";
import { LabsBadge, LabsHero, LabsPageShell, LabsSelect } from "../labs-ui";
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

export function ProviderDocumentationWizard() {
  const [step, setStep] = useState<PortalStep>("setup");
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
  const [submitted, setSubmitted] = useState<PriorAuthRecord | null>(null);
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
        bullets: ["The provider portal workflow is complete.", "Plan-side incentives are evaluated outside this provider flow."]
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
      const payload = (await response.json()) as PriorAuthRecord | { error?: string };

      if (submitRequestRef.current !== requestId || selectedPathRef.current !== requestPath) {
        return;
      }

      if (!response.ok) {
        setError("error" in payload && payload.error ? payload.error : "Unable to submit prior authorization");
        return;
      }

      setSubmitted(payload as PriorAuthRecord);
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
          <section className="wizard-stage panel" aria-busy={submitting || checkingRequirements}>
            {submitted ? (
              <SubmissionConfirmation submitted={submitted} onSubmitAnother={submitAnotherRequest} />
            ) : (
              <>
                {step === "setup" ? (
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

                {step === "service" ? (
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

                {step === "coverage" ? (
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

                {step === "review" ? (
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
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-modal="true"
        className="modal assessment-modal"
        role="dialog"
        aria-labelledby="assessment-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-toolbar">
          <div>
            <h2 id="assessment-title">{service?.assessmentTitle ?? "Documentation assessment"}</h2>
            <p>{service?.assessmentIntro ?? "Answer each payer-requested documentation question before submitting the prior authorization."}</p>
          </div>
          <button className="row-action" type="button" onClick={onClose}>
            Close assessment
          </button>
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
          <LabsSelect disabled={submitting} options={patientOptions} placeholder="Select patient" value={patientId ?? ""} onChange={onPatientChange} />
        </div>

        <div className="form-row">
          <span>Health plan</span>
          <LabsSelect
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
      <button className="primary-button" disabled={!canContinueFromSetup({ patientId, planId, submitting })} type="button" onClick={onContinue}>
        Next: service
      </button>
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
      <button className="primary-button" disabled={!requestType || !serviceCode || checkingRequirements} type="button" onClick={onCheck}>
        {checkingRequirements ? "Checking..." : "Check coverage and requirements"}
      </button>
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
            <button className="primary-button" type="button" onClick={onOpenAssessment}>
              Open documentation assessment
            </button>
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
      <button className="primary-button" disabled={!canReview} type="button" onClick={onReview}>
        Review
      </button>
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
      <LabsBadge variant="info">Pending review</LabsBadge>
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
