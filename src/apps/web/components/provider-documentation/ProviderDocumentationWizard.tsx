"use client";

import type { DtrAnswers, PriorAuthRecord, ServiceCode } from "@operon-labs/um-platform";
import Link from "next/link";
import { useMemo, useState } from "react";

const completeDtr: DtrAnswers = {
  symptomDurationConfirmed: true,
  conservativeTherapyConfirmed: true,
  examFindingsConfirmed: true,
  clinicalNoteAttached: true
};

export function ProviderDocumentationWizard() {
  const [serviceCode, setServiceCode] = useState<ServiceCode | null>(null);
  const [coverageChecked, setCoverageChecked] = useState(false);
  const [dtrComplete, setDtrComplete] = useState(false);
  const [acknowledgedNotCovered, setAcknowledgedNotCovered] = useState(false);
  const [submitted, setSubmitted] = useState<PriorAuthRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isKneeMri = serviceCode === "knee_mri";
  const isFullBody = serviceCode === "full_body_wellness_mri";

  const readiness = useMemo(
    () => [
      { label: "Coverage requirements checked", complete: coverageChecked },
      { label: "DTR documentation complete", complete: isKneeMri && dtrComplete },
      { label: "Attachments ready", complete: isKneeMri && dtrComplete },
      { label: "PAS submitted before cutoff", complete: submitted !== null }
    ],
    [coverageChecked, dtrComplete, isKneeMri, submitted]
  );

  function selectService(nextServiceCode: ServiceCode) {
    setServiceCode(nextServiceCode);
    setCoverageChecked(false);
    setDtrComplete(false);
    setAcknowledgedNotCovered(false);
    setSubmitted(null);
    setError(null);
  }

  async function submitPriorAuth() {
    if (!serviceCode) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const body =
      serviceCode === "knee_mri"
        ? { serviceCode, dtr: completeDtr }
        : { serviceCode, acknowledgedNotCovered };

    try {
      const response = await fetch("/api/um/prior-auths", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as PriorAuthRecord | { error?: string };

      if (!response.ok) {
        setError("error" in payload && payload.error ? payload.error : "Unable to submit prior authorization");
        return;
      }

      setSubmitted(payload as PriorAuthRecord);
    } catch {
      setError("Unable to submit prior authorization");
    } finally {
      setSubmitting(false);
    }
  }

  const submitDisabled =
    submitting ||
    submitted !== null ||
    !coverageChecked ||
    (isKneeMri && !dtrComplete) ||
    (isFullBody && !acknowledgedNotCovered);

  return (
    <main className="workspace">
      <Link className="back" href="/">
        Back to demos
      </Link>

      <section className="hero compact">
        <span className="eyebrow">Provider portal</span>
        <h1>New prior authorization</h1>
        <p>Check coverage requirements, complete documentation, and submit a synthetic prior authorization.</p>
      </section>

      <div className="two-column">
        <section className="panel">
          <h2>Case setup</h2>
          <div className="summary-grid">
            <div>
              <span className="label">Patient</span>
              <strong>Maya Chen</strong>
            </div>
            <div>
              <span className="label">Ordering provider</span>
              <strong>Dr. Elena Ruiz</strong>
            </div>
            <div>
              <span className="label">Facility</span>
              <strong>Lakeside Imaging Center</strong>
            </div>
            <div>
              <span className="label">Plan</span>
              <strong>Acme Health PPO</strong>
            </div>
          </div>

          <div className="choice-grid" aria-label="Service selection">
            <button
              className={`choice ${isKneeMri ? "selected" : ""}`}
              type="button"
              onClick={() => selectService("knee_mri")}
            >
              <strong>Knee MRI after injury</strong>
              <span>Covered service, PA required, DTR documentation available.</span>
            </button>
            <button
              className={`choice ${isFullBody ? "selected" : ""}`}
              type="button"
              onClick={() => selectService("full_body_wellness_mri")}
            >
              <strong>Full-body wellness MRI screening</strong>
              <span>Not covered benefit; provider may acknowledge and submit anyway.</span>
            </button>
          </div>

          <button
            className="primary-button"
            disabled={!serviceCode}
            type="button"
            onClick={() => {
              setCoverageChecked(true);
              setSubmitted(null);
              setError(null);
            }}
          >
            Check coverage requirements
          </button>
        </section>

        <aside className="panel">
          <h2>Documentation completeness</h2>
          <ol className="checklist">
            {readiness.map((item) => (
              <li key={item.label} className={item.complete ? "complete" : ""}>
                {item.label}
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {coverageChecked && isKneeMri ? (
        <section className="panel">
          <h2>CRD result</h2>
          <span className="status approved">Covered service - PA required</span>
          <p>
            Documentation required: symptom duration, conservative therapy, exam findings, and clinical note attachment.
          </p>
          <button className="primary-button" type="button" onClick={() => setDtrComplete(true)}>
            Complete DTR documentation
          </button>
        </section>
      ) : null}

      {coverageChecked && isFullBody ? (
        <section className="panel warning-panel">
          <h2>CRD result</h2>
          <span className="status blocked">Not covered benefit</span>
          <p>
            Full-body wellness MRI screening without symptoms is not covered by this plan. The PA can still be submitted
            with a not-covered denial reason.
          </p>
          <label className="checkbox-row">
            <input
              checked={acknowledgedNotCovered}
              type="checkbox"
              onChange={(event) => setAcknowledgedNotCovered(event.target.checked)}
            />
            Acknowledge and submit anyway
          </label>
        </section>
      ) : null}

      {coverageChecked ? (
        <section className="panel">
          <h2>PAS submission</h2>
          <p>
            {isKneeMri
              ? "Review the complete DTR packet and submit PAS."
              : "Submit the PA with the non-covered benefit reason."}
          </p>
          <button className="primary-button" disabled={submitDisabled} type="button" onClick={submitPriorAuth}>
            {submitting ? "Submitting..." : "Submit prior authorization"}
          </button>
          {error ? <p className="error-text">{error}</p> : null}
          {submitted ? (
            <div className="result-box">
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
    </main>
  );
}
