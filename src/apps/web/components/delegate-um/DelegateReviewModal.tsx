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

export function DelegateReviewModal({ onClose, onCompleted, requestApiBase, request }: DelegateReviewModalProps) {
  const [reviewStarted, setReviewStarted] = useState(request.state === "in_clinical_review");
  const [outcomeStatus, setOutcomeStatus] = useState<"approved" | "denied" | null>(request.outcomeStatus ?? null);
  const [clinicalDocumentationReviewed, setClinicalDocumentationReviewed] = useState(false);
  const [medicalNecessityCriteriaMet, setMedicalNecessityCriteriaMet] = useState(false);
  const [planPolicyRequirementsChecked, setPlanPolicyRequirementsChecked] = useState(false);
  const [decisionRationaleDocumented, setDecisionRationaleDocumented] = useState(false);
  const [approvalReasonCode, setApprovalReasonCode] = useState("POLICY_CRITERIA_MET");
  const [denialReasonCode, setDenialReasonCode] = useState("NOT_MEDICALLY_NECESSARY");
  const [submitting, setSubmitting] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checklistComplete =
    clinicalDocumentationReviewed &&
    medicalNecessityCriteriaMet &&
    planPolicyRequirementsChecked &&
    decisionRationaleDocumented;
  const canChooseOutcome = checklistComplete;
  const canSubmit = canChooseOutcome && outcomeStatus !== null && !submitting;
  const activeReasonOptions = outcomeStatus === "denied" ? denialReasonOptions : approvalReasonOptions;
  const activeReasonCode = outcomeStatus === "denied" ? denialReasonCode : approvalReasonCode;
  const activeReasonLabel = outcomeStatus === "denied" ? "Denial reason" : "Approval reason";
  const outcomeGuidanceId = "delegate-outcome-guidance";
  const assessment = buildAssessmentView(request);
  const currentState = reviewStarted ? "in_clinical_review" : request.state;

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

        {actionStatus ? <p className="action-status">{actionStatus}</p> : null}
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}

        {!reviewStarted ? (
          <LabsButton disabled={submitting} onClick={() => void startReview()}>
            {submitting ? "Starting..." : "Start review"}
          </LabsButton>
        ) : null}

        <div className="delegate-review-grid">
          <section className="delegate-review-section">
            <h3>Clinical checklist</h3>
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
          </section>

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
    </LabsModal>
  );
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
