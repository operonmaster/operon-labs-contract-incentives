"use client";

import { useEffect, useRef, useState } from "react";
import type { DelegateUmRow } from "../../lib/delegate-um-workflow";
import { LabsBadge, LabsSelect, type LabsSelectOption } from "../labs-ui";
import { formatRequestType, formatSlaStatus, formatUmState } from "./delegate-formatters";

interface DelegateReviewModalProps {
  requestApiBase: string;
  row: DelegateUmRow;
  onClose: () => void;
  // eslint-disable-next-line no-unused-vars -- Callback parameter name documents the completed delegate row.
  onCompleted: (row: DelegateUmRow) => void;
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

export function DelegateReviewModal({ onClose, onCompleted, requestApiBase, row }: DelegateReviewModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [reviewStarted, setReviewStarted] = useState(row.state === "in_clinical_review");
  const [outcomeStatus, setOutcomeStatus] = useState<"approved" | "denied" | null>(row.outcomeStatus ?? null);
  const [medicalNecessityReviewed, setMedicalNecessityReviewed] = useState(false);
  const [policyCriteriaChecked, setPolicyCriteriaChecked] = useState(false);
  const [rationaleCaptured, setRationaleCaptured] = useState(false);
  const [approvalReasonCode, setApprovalReasonCode] = useState("POLICY_CRITERIA_MET");
  const [denialReasonCode, setDenialReasonCode] = useState("NOT_MEDICALLY_NECESSARY");
  const [submitting, setSubmitting] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checklistComplete = medicalNecessityReviewed && policyCriteriaChecked && rationaleCaptured;
  const canChooseOutcome = checklistComplete;
  const canSubmit = canChooseOutcome && outcomeStatus !== null && !submitting;
  const activeReasonOptions = outcomeStatus === "denied" ? denialReasonOptions : approvalReasonOptions;
  const activeReasonCode = outcomeStatus === "denied" ? denialReasonCode : approvalReasonCode;
  const activeReasonLabel = outcomeStatus === "denied" ? "Denial reason" : "Approval reason";
  const outcomeGuidanceId = "delegate-outcome-guidance";

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function ensureReviewStarted(): Promise<boolean> {
    if (reviewStarted) {
      return true;
    }
    try {
      const response = await fetch(`${requestApiBase}${encodeURIComponent(row.umRequestId)}/start-review`, {
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

      const response = await fetch(`${requestApiBase}${encodeURIComponent(row.umRequestId)}/determination`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcomeStatus,
          medicalNecessityReviewed,
          policyCriteriaChecked,
          rationaleCaptured,
          approvalReasonCode: outcomeStatus === "approved" ? approvalReasonCode : null,
          denialReasonCode: outcomeStatus === "denied" ? denialReasonCode : null
        })
      });
      const payload = (await response.json()) as DelegateUmRow | { error?: string };

      if (!response.ok || !("umRequestId" in payload)) {
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
    <div className="modal-backdrop audit-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-modal="true"
        aria-labelledby="delegate-review-title"
        className="modal plan-audit-modal delegate-review-modal"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-toolbar">
          <div>
            <span className="eyebrow">Delegate review</span>
            <h2 id="delegate-review-title">Pharmacy prior authorization</h2>
            <p>{row.umRequestId}</p>
          </div>
          <button ref={closeButtonRef} className="row-action" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <dl className="detail-grid plan-audit-grid">
          <div>
            <dt>Requested item</dt>
            <dd>{row.serviceLabel}</dd>
          </div>
          <div>
            <dt>Request type</dt>
            <dd>{formatRequestType(row.requestType)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{formatUmState(reviewStarted ? "in_clinical_review" : row.state)}</dd>
          </div>
          <div>
            <dt>SLA</dt>
            <dd>
              <LabsBadge variant={row.slaStatus === "breached" ? "warning" : "info"}>{formatSlaStatus(row)}</LabsBadge>
            </dd>
          </div>
        </dl>

        {actionStatus ? <p className="action-status">{actionStatus}</p> : null}
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}

        {!reviewStarted ? (
          <button className="primary-button" disabled={submitting} type="button" onClick={() => void startReview()}>
            {submitting ? "Starting..." : "Start review"}
          </button>
        ) : null}

        <div className="delegate-review-grid">
          <section className="delegate-review-section">
            <h3>Clinical checklist</h3>
            <label className="checkbox-row">
              <input
                checked={medicalNecessityReviewed}
                type="checkbox"
                onChange={(event) => setMedicalNecessityReviewed(event.currentTarget.checked)}
              />
              Medical necessity reviewed
            </label>
            <label className="checkbox-row">
              <input
                checked={policyCriteriaChecked}
                type="checkbox"
                onChange={(event) => setPolicyCriteriaChecked(event.currentTarget.checked)}
              />
              Policy criteria checked
            </label>
            <label className="checkbox-row">
              <input
                checked={rationaleCaptured}
                type="checkbox"
                onChange={(event) => setRationaleCaptured(event.currentTarget.checked)}
              />
              Rationale captured
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
          <button className="primary-button" disabled={!canSubmit} type="button" onClick={() => void submitDetermination()}>
            {submitting ? "Submitting..." : "Submit determination"}
          </button>
        </div>
      </section>
    </div>
  );
}
