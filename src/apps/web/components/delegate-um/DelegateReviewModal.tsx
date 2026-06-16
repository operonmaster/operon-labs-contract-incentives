"use client";

import { useState } from "react";
import { getDtrQuestionnaire, type DtrAnswerValue, type UMRequest } from "@operon-labs/um-platform";
import { LabsBadge, LabsButton, LabsModal, LabsSelect, type LabsSelectOption } from "../labs-ui";
import { formatRequestType, formatUmRequestSlaStatus, formatUmState } from "./delegate-formatters";

interface DelegateReviewModalProps {
  requestApiBase: string;
  request: UMRequest;
  onClose: () => void;
  // eslint-disable-next-line no-unused-vars -- Callback parameter name documents the completed delegate row.
  onCompleted: (request: UMRequest) => void;
}

const approvalReasonOptions: LabsSelectOption[] = [
  {
    value: "POLICY_CRITERIA_MET",
    label: "Policy criteria met",
    description: "Plan pharmacy prior authorization criteria were satisfied."
  },
  {
    value: "MEDICAL_NECESSITY_SUPPORTED",
    label: "Medical necessity supported",
    description: "Submitted clinical evidence supports the requested pharmacy benefit."
  },
  {
    value: "PRIOR_THERAPY_CONFIRMED",
    label: "Prior therapy confirmed",
    description: "Required step therapy or prior treatment history was documented."
  }
];

const denialReasonOptions: LabsSelectOption[] = [
  {
    value: "NOT_MEDICALLY_NECESSARY",
    label: "Not medically necessary",
    description: "Clinical evidence does not support the requested pharmacy benefit."
  },
  {
    value: "POLICY_CRITERIA_NOT_MET",
    label: "Policy criteria not met",
    description: "Plan criteria were reviewed and not satisfied."
  },
  {
    value: "MISSING_CLINICAL_INFORMATION",
    label: "Missing clinical information",
    description: "Required review evidence is not available for the determination."
  }
];

type DelegateReviewStepId = "startReview" | "clinicalChecklist" | "submitDetermination";

interface ChecklistValues {
  clinicalDocumentationReviewed: boolean;
  medicalNecessityCriteriaMet: boolean;
  planPolicyRequirementsChecked: boolean;
  decisionRationaleDocumented: boolean;
}

interface ViewStepSelection {
  progressKey: string;
  stepId: DelegateReviewStepId;
}

const reviewSteps: Array<{ id: DelegateReviewStepId; label: string }> = [
  { id: "startReview", label: "Start Review" },
  { id: "clinicalChecklist", label: "Clinical Checklist" },
  { id: "submitDetermination", label: "Submit Determination" }
];

export function DelegateReviewModal({ onClose, onCompleted, requestApiBase, request }: DelegateReviewModalProps) {
  const [reviewStarted, setReviewStarted] = useState(
    request.state === "in_clinical_review" || request.state === "determined" || Boolean(request.reviewStartedAt)
  );
  const [outcomeStatus, setOutcomeStatus] = useState<"approved" | "denied" | null>(request.outcomeStatus ?? null);
  const [clinicalDocumentationReviewed, setClinicalDocumentationReviewed] = useState(
    request.clinicalReview.clinicalDocumentationReviewed
  );
  const [medicalNecessityCriteriaMet, setMedicalNecessityCriteriaMet] = useState(request.clinicalReview.medicalNecessityCriteriaMet);
  const [planPolicyRequirementsChecked, setPlanPolicyRequirementsChecked] = useState(
    request.clinicalReview.planPolicyRequirementsChecked
  );
  const [decisionRationaleDocumented, setDecisionRationaleDocumented] = useState(
    request.clinicalReview.decisionRationaleDocumented
  );
  const [approvalReasonCode, setApprovalReasonCode] = useState(request.clinicalReview.approvalReasonCode ?? "POLICY_CRITERIA_MET");
  const [denialReasonCode, setDenialReasonCode] = useState(request.clinicalReview.denialReasonCode ?? "NOT_MEDICALLY_NECESSARY");
  const [submitting, setSubmitting] = useState(false);
  const [clinicalChecklistSubmitted, setClinicalChecklistSubmitted] = useState(
    request.state === "determined" || request.outcomeStatus !== null
  );
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checklistValues: ChecklistValues = {
    clinicalDocumentationReviewed,
    medicalNecessityCriteriaMet,
    planPolicyRequirementsChecked,
    decisionRationaleDocumented
  };
  const checklistComplete =
    clinicalDocumentationReviewed &&
    medicalNecessityCriteriaMet &&
    planPolicyRequirementsChecked &&
    decisionRationaleDocumented;
  const canChooseOutcome = clinicalChecklistSubmitted;
  const canSubmit = canChooseOutcome && outcomeStatus !== null && !submitting;
  const activeReasonOptions = outcomeStatus === "denied" ? denialReasonOptions : approvalReasonOptions;
  const activeReasonCode = outcomeStatus === "denied" ? denialReasonCode : approvalReasonCode;
  const activeReasonLabel = outcomeStatus === "denied" ? "Denial reason" : "Approval reason";
  const outcomeGuidanceId = "delegate-outcome-guidance";
  const assessment = buildAssessmentView(request);
  const currentState = request.state === "determined" ? request.state : reviewStarted ? "in_clinical_review" : request.state;
  const activeStepId = getActiveReviewStepId(request, reviewStarted, clinicalChecklistSubmitted);
  const activeStepIndex = reviewSteps.findIndex((step) => step.id === activeStepId);
  const progressKey = getReviewProgressKey(request, activeStepId, reviewStarted, clinicalChecklistSubmitted);
  const [viewStepSelection, setViewStepSelection] = useState<ViewStepSelection | null>(null);
  const selectedViewStepId = viewStepSelection?.progressKey === progressKey ? viewStepSelection.stepId : activeStepId;
  const selectedViewStepIndex = reviewSteps.findIndex((step) => step.id === selectedViewStepId);
  const viewStepId =
    selectedViewStepIndex >= 0 && selectedViewStepIndex <= activeStepIndex ? selectedViewStepId : activeStepId;

  async function ensureReviewStarted(): Promise<boolean> {
    if (reviewStarted) {
      return true;
    }
    try {
      const response = await fetch(`${requestApiBase}${encodeURIComponent(request.id)}/start-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerId: "delegate-reviewer" })
      });
      const payload = (await response.json()) as { error?: string; state?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to start review");
        return false;
      }

      setReviewStarted(true);
      setActionStatus("Clinical review started");
      return true;
    } catch {
      setError("Unable to start review");
      return false;
    }
  }

  async function startReview() {
    setSubmitting(true);
    setError(null);

    try {
      await ensureReviewStarted();
    } finally {
      setSubmitting(false);
    }
  }

  function completeClinicalChecklist() {
    if (!checklistComplete) {
      return;
    }

    setClinicalChecklistSubmitted(true);
    setActionStatus("Clinical checklist complete");
    setError(null);
  }

  async function submitDetermination() {
    if (!outcomeStatus) {
      setError("Choose an outcome before submitting determination");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const started = await ensureReviewStarted();
      if (!started) {
        return;
      }

      const response = await fetch(`${requestApiBase}${encodeURIComponent(request.id)}/determination`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcomeStatus,
          clinicalDocumentationReviewed,
          medicalNecessityCriteriaMet,
          planPolicyRequirementsChecked,
          decisionRationaleDocumented,
          approvalReasonCode: outcomeStatus === "approved" ? approvalReasonCode : null,
          denialReasonCode: outcomeStatus === "denied" ? denialReasonCode : null
        })
      });
      const payload = (await response.json()) as UMRequest | { error?: string };

      if (!response.ok || !("id" in payload)) {
        setError("error" in payload && payload.error ? payload.error : "Unable to submit determination");
        return;
      }

      onCompleted(payload);
    } catch {
      setError("Unable to submit determination");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LabsModal
      onClose={onClose}
      labelledBy="delegate-review-title"
      className="plan-audit-modal delegate-review-modal"
      backdropClassName="audit-modal-backdrop"
    >
      <div className="modal-toolbar">
          <div>
            <span className="eyebrow">Delegate review</span>
            <h2 id="delegate-review-title">Pharmacy prior authorization</h2>
            <p className="delegate-review-id-line">
              <span>{request.id}</span>
              <LabsBadge variant={isSlaBreached(request) ? "warning" : "info"}>{formatUmState(currentState)}</LabsBadge>
            </p>
          </div>
          <LabsButton variant="row" onClick={onClose}>
            Close
          </LabsButton>
        </div>

        <dl className="detail-grid delegate-review-meta-grid">
          <div>
            <dt>Patient</dt>
            <dd>{request.patientDisplay}</dd>
          </div>
          <div>
            <dt>Health plan</dt>
            <dd>{request.planDisplay}</dd>
          </div>
          <div>
            <dt>SLA</dt>
            <dd>
              <LabsBadge variant={isSlaBreached(request) ? "warning" : "info"}>{formatUmRequestSlaStatus(request)}</LabsBadge>
            </dd>
          </div>
        </dl>

        <section className="delegate-service-panel">
          <h3>Service details</h3>
          <p className="delegate-service-title">{request.serviceLabel}</p>
          <dl className="detail-grid delegate-service-grid">
            <div>
              <dt>Request type</dt>
              <dd>{formatRequestType(request.requestType)}</dd>
            </div>
            <div>
              <dt>{request.codingSystem === "NDC" ? "Medication code" : "Procedure"}</dt>
              <dd>
                {request.codingSystem} {request.billingCode}
              </dd>
            </div>
            <div>
              <dt>Coverage result</dt>
              <dd>{formatCoverageResult(request)}</dd>
            </div>
          </dl>
          {assessment.answers.length > 0 ? (
            <details className="policy-criteria-toggle delegate-assessment-toggle">
              <summary>View assessment</summary>
              <div className="policy-criteria-table-wrap">
                <table className="policy-criteria-table">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Answer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.answers.map((answer) => (
                      <tr key={answer.questionId}>
                        <td>{answer.prompt}</td>
                        <td>{formatAssessmentAnswer(answer.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : (
            <p className={`action-status ${assessment.status === "not_required" ? "" : "warning-copy"}`}>{assessment.label}</p>
          )}
        </section>

        <ol className="stepper compact-stepper" aria-label="Delegate UM review steps">
          {reviewSteps.map((step, index) => {
            const canViewStep = index <= activeStepIndex;
            const classes = [
              index < activeStepIndex ? "done" : "",
              index === activeStepIndex ? "active" : "",
              step.id === viewStepId ? "viewing" : "",
              canViewStep ? "stepper-clickable" : "stepper-disabled"
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li
                className={classes}
                aria-current={index === activeStepIndex ? "step" : undefined}
                key={step.id}
              >
                <button
                  aria-label={step.label}
                  aria-pressed={step.id === viewStepId}
                  className="stepper-step-button"
                  disabled={!canViewStep}
                  type="button"
                  onClick={() => setViewStepSelection({ progressKey, stepId: step.id })}
                >
                  <strong aria-hidden="true">{index + 1}</strong>
                  <span>{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {actionStatus ? <p className="action-status">{actionStatus}</p> : null}
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}

        {viewStepId !== activeStepId || (request.state === "determined" && viewStepId === "submitDetermination") ? (
          renderCompletedReviewStep(request, viewStepId, checklistValues, reviewStarted, currentState)
        ) : viewStepId === "startReview" ? (
          <section className="delegate-review-section">
            <h3>Start Review</h3>
            <p>Start the delegated clinical review before completing checklist and determination steps.</p>
            <LabsButton disabled={submitting} onClick={() => void startReview()}>
              {submitting ? "Starting..." : "Start review"}
            </LabsButton>
          </section>
        ) : viewStepId === "clinicalChecklist" ? (
          <section className="delegate-review-section">
            <h3>Clinical checklist</h3>
            <div className="workflow-checklist" aria-label="Clinical checklist assertions">
              <label className="checkbox-row">
                <input
                  checked={clinicalDocumentationReviewed}
                  type="checkbox"
                  onChange={(event) => setClinicalDocumentationReviewed(event.currentTarget.checked)}
                />
                Clinical documentation reviewed
              </label>
              <label className="checkbox-row">
                <input
                  checked={medicalNecessityCriteriaMet}
                  type="checkbox"
                  onChange={(event) => setMedicalNecessityCriteriaMet(event.currentTarget.checked)}
                />
                Medical necessity criteria met
              </label>
              <label className="checkbox-row">
                <input
                  checked={planPolicyRequirementsChecked}
                  type="checkbox"
                  onChange={(event) => setPlanPolicyRequirementsChecked(event.currentTarget.checked)}
                />
                Plan policy requirements checked
              </label>
              <label className="checkbox-row">
                <input
                  checked={decisionRationaleDocumented}
                  type="checkbox"
                  onChange={(event) => setDecisionRationaleDocumented(event.currentTarget.checked)}
                />
                Decision rationale documented
              </label>
            </div>
            <LabsButton disabled={submitting || !checklistComplete} onClick={completeClinicalChecklist}>
              Complete checklist
            </LabsButton>
          </section>
        ) : (
          <>
            <div className="delegate-review-grid">
              <section className="delegate-review-section">
                <h3>Outcome</h3>
                <div
                  aria-describedby={!canChooseOutcome ? outcomeGuidanceId : undefined}
                  className="radio-group"
                  role="radiogroup"
                  aria-label="Outcome status"
                >
                  {(["approved", "denied"] as const).map((outcome) => (
                    <label
                      className={`radio-card ${outcomeStatus === outcome ? "selected" : ""} ${canChooseOutcome ? "" : "disabled"}`}
                      key={outcome}
                    >
                      <input
                        checked={outcomeStatus === outcome}
                        disabled={!canChooseOutcome}
                        name="delegate-outcome"
                        type="radio"
                        value={outcome}
                        onChange={() => setOutcomeStatus(outcome)}
                      />
                      {outcome === "approved" ? "Approve" : "Deny"}
                    </label>
                  ))}
                </div>
                {!canChooseOutcome ? (
                  <LabsBadge className="delegate-guidance" id={outcomeGuidanceId} variant="warning">
                    Complete the clinical checklist before choosing an outcome
                  </LabsBadge>
                ) : null}
                {outcomeStatus ? (
                  <div className="form-row delegate-field">
                    <span>{activeReasonLabel}</span>
                    <LabsSelect
                      id={`delegate-${outcomeStatus}-reason`}
                      ariaLabel={activeReasonLabel}
                      disabled={!canChooseOutcome}
                      options={activeReasonOptions}
                      placeholder={`Select ${outcomeStatus} reason`}
                      value={activeReasonCode}
                      onChange={outcomeStatus === "approved" ? setApprovalReasonCode : setDenialReasonCode}
                    />
                  </div>
                ) : null}
              </section>
            </div>

            <div className="delegate-modal-actions">
              <LabsButton disabled={!canSubmit} onClick={() => void submitDetermination()}>
                {submitting ? "Submitting..." : "Submit determination"}
              </LabsButton>
            </div>
          </>
        )}
    </LabsModal>
  );
}

function getActiveReviewStepId(
  request: UMRequest,
  reviewStarted: boolean,
  clinicalChecklistSubmitted: boolean
): DelegateReviewStepId {
  if (!reviewStarted) {
    return "startReview";
  }

  if (!clinicalChecklistSubmitted && request.state !== "determined") {
    return "clinicalChecklist";
  }

  return "submitDetermination";
}

function getReviewProgressKey(
  request: UMRequest,
  activeStepId: DelegateReviewStepId,
  reviewStarted: boolean,
  clinicalChecklistSubmitted: boolean
): string {
  return [
    request.id,
    request.state,
    request.reviewStartedAt ?? "no-review-start",
    request.outcomeStatus ?? "no-outcome",
    request.determinedAt ?? "no-determination",
    activeStepId,
    reviewStarted ? "review-started" : "review-not-started",
    clinicalChecklistSubmitted ? "checklist-submitted" : "checklist-open"
  ].join(":");
}

function renderCompletedReviewStep(
  request: UMRequest,
  viewStepId: DelegateReviewStepId,
  checklistValues: ChecklistValues,
  reviewStarted: boolean,
  currentState: UMRequest["state"]
) {
  const section = getCompletedReviewStepView(request, viewStepId, checklistValues, reviewStarted, currentState);

  return (
    <section className="delegate-review-section appeals-step-review-section">
      <div>
        <h3>{section.title}</h3>
        <p>{section.body}</p>
      </div>
      <dl className="detail-grid delegate-service-grid">
        {section.fields.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      <p className="action-status">Completed step</p>
    </section>
  );
}

function getCompletedReviewStepView(
  request: UMRequest,
  viewStepId: DelegateReviewStepId,
  checklistValues: ChecklistValues,
  reviewStarted: boolean,
  currentState: UMRequest["state"]
) {
  switch (viewStepId) {
    case "startReview":
      return {
        title: "Start Review",
        body: "Delegate clinical review has been started for this request.",
        fields: [
          { label: "Review status", value: reviewStarted ? "Started" : "Not started" },
          { label: "Current state", value: formatUmState(currentState) }
        ]
      };
    case "clinicalChecklist":
      return {
        title: "Clinical Checklist",
        body: "Clinical checklist values captured before determination.",
        fields: [
          { label: "Clinical documentation reviewed", value: formatBoolean(checklistValues.clinicalDocumentationReviewed) },
          { label: "Medical necessity criteria met", value: formatBoolean(checklistValues.medicalNecessityCriteriaMet) },
          { label: "Plan policy requirements checked", value: formatBoolean(checklistValues.planPolicyRequirementsChecked) },
          { label: "Decision rationale documented", value: formatBoolean(checklistValues.decisionRationaleDocumented) }
        ]
      };
    case "submitDetermination": {
      const reasonCode =
        request.outcomeStatus === "denied" ? request.clinicalReview.denialReasonCode : request.clinicalReview.approvalReasonCode;

      return {
        title: "Submit Determination",
        body: "Final delegate determination captured for this request.",
        fields: [
          { label: "Outcome", value: formatOutcomeStatus(request.outcomeStatus) },
          { label: "Reason", value: formatReasonLabel(request.outcomeStatus, reasonCode) }
        ]
      };
    }
  }
}

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

function formatOutcomeStatus(value: UMRequest["outcomeStatus"]): string {
  switch (value) {
    case "approved":
      return "Approved";
    case "denied":
      return "Denied";
    case null:
      return "Not recorded";
  }
}

function formatReasonLabel(outcomeStatus: UMRequest["outcomeStatus"], reasonCode: string | null): string {
  if (!outcomeStatus || !reasonCode) {
    return "Not recorded";
  }

  const options = outcomeStatus === "denied" ? denialReasonOptions : approvalReasonOptions;
  return options.find((option) => option.value === reasonCode)?.label ?? reasonCode;
}

interface AssessmentAnswerView {
  questionId: string;
  prompt: string;
  value: DtrAnswerValue | "not_answered";
}

interface AssessmentView {
  status: "complete" | "incomplete" | "not_provided" | "not_required";
  label: string;
  answers: AssessmentAnswerView[];
}

function buildAssessmentView(request: UMRequest): AssessmentView {
  const questionnaireId = request.coverage.documentationTemplateId;

  if (!questionnaireId) {
    return {
      status: "not_required",
      label: "Assessment not required",
      answers: []
    };
  }

  if (!request.dtrQuestionnaireResponse) {
    return {
      status: "not_provided",
      label: "Assessment not provided",
      answers: []
    };
  }

  const questionnaire = getDtrQuestionnaire(questionnaireId);
  const responseAnswers = new Map<string, DtrAnswerValue>(
    request.dtrQuestionnaireResponse.answers.map((answer) => [answer.questionId, answer.value])
  );
  const answers: AssessmentAnswerView[] =
    questionnaire?.questions.map((question) => ({
      questionId: question.id,
      prompt: question.prompt,
      value: responseAnswers.get(question.id) ?? "not_answered"
    })) ??
    request.dtrQuestionnaireResponse.answers.map((answer) => ({
      questionId: answer.questionId,
      prompt: answer.questionId,
      value: answer.value
    }));
  const complete = answers.length > 0 && answers.every((answer) => answer.value === "yes" || answer.value === "no");

  return {
    status: complete ? "complete" : "incomplete",
    label: complete ? "Assessment complete" : "Assessment incomplete",
    answers
  };
}

function formatAssessmentAnswer(value: AssessmentAnswerView["value"]) {
  switch (value) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
    case "not_answered":
      return "Not answered";
  }
}

function formatCoverageResult(request: UMRequest) {
  if (!request.coverage.coveredBenefit) {
    return "Not covered benefit";
  }

  return request.coverage.priorAuthRequired ? "Coverage confirmed; PA required" : "Coverage confirmed; PA not required";
}

function isSlaBreached(request: UMRequest) {
  return Boolean(
    request.state === "determined" &&
      request.determinedAt &&
      new Date(request.determinedAt).getTime() > new Date(request.slaDeadlineAt).getTime()
  );
}
