"use client";

import Link from "next/link";
import { useState } from "react";
import { LabsBadge, LabsButton, LabsModal } from "../labs-ui";
import type { AppealCase } from "../../lib/appeals-store";
import {
  appealStateBadgeVariant,
  formatAppealState,
  formatNullableDateTime,
  formatRequestType
} from "./appeals-formatters";

interface AppealsWorkflowModalProps {
  appealCase: AppealCase;
  onClose: () => void;
  // eslint-disable-next-line no-unused-vars -- Callback parameter name documents the updated appeal case.
  onUpdated: (appealCase: AppealCase) => void;
}

type WorkflowStepId =
  | "acknowledge"
  | "intake"
  | "originalDecision"
  | "missingInfo"
  | "packet"
  | "evidenceIndex"
  | "reviewer";

const workflowSteps: Array<{ id: WorkflowStepId; label: string }> = [
  { id: "acknowledge", label: "Acknowledge Receipt" },
  { id: "intake", label: "Validate Intake" },
  { id: "originalDecision", label: "Retrieve Original PA Decision" },
  { id: "missingInfo", label: "Resolve Missing Info" },
  { id: "packet", label: "Assemble Packet" },
  { id: "evidenceIndex", label: "Index Evidence" },
  { id: "reviewer", label: "Route Reviewer" }
];

export function AppealsWorkflowModal({ appealCase, onClose, onUpdated }: AppealsWorkflowModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeStepId = getActiveStepId(appealCase);
  const activeStepIndex = workflowSteps.findIndex((step) => step.id === activeStepId);
  const terminal = appealCase.state === "packet_ready";

  async function submitActiveStep() {
    if (terminal) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(buildActionUrl(appealCase), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildActionPayload(appealCase))
      });
      const payload = (await response.json()) as AppealCase | { error?: string };

      if (!response.ok || !("id" in payload)) {
        setError("error" in payload && payload.error ? payload.error : "Unable to update appeal case");
        return;
      }

      onUpdated(payload);
    } catch {
      setError("Unable to update appeal case");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LabsModal
      onClose={onClose}
      labelledBy="appeals-workflow-title"
      className="plan-audit-modal appeals-modal"
      backdropClassName="audit-modal-backdrop"
    >
      <div className="modal-toolbar">
        <div>
          <span className="eyebrow">Provider appeal</span>
          <h2 id="appeals-workflow-title">{appealCase.serviceLabel}</h2>
          <p className="delegate-review-id-line">
            <span>{appealCase.id}</span>
            <LabsBadge variant={appealStateBadgeVariant(appealCase.state)}>
              {formatAppealState(appealCase.state)}
            </LabsBadge>
          </p>
        </div>
        <LabsButton variant="row" onClick={onClose}>
          Close
        </LabsButton>
      </div>

      <ol className="stepper compact-stepper appeals-stepper" aria-label="Provider appeal workflow steps">
        {workflowSteps.map((step, index) => (
          <li
            className={index < activeStepIndex ? "done" : index === activeStepIndex ? "active" : ""}
            aria-current={index === activeStepIndex ? "step" : undefined}
            key={step.id}
          >
            <strong>{index + 1}</strong>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>

      <dl className="detail-grid delegate-review-meta-grid">
        <div>
          <dt>Linked PA</dt>
          <dd>{appealCase.umRequestId}</dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>{appealCase.planId}</dd>
        </div>
        <div>
          <dt>Request type</dt>
          <dd>{formatRequestType(appealCase.requestType)}</dd>
        </div>
        <div>
          <dt>Received</dt>
          <dd>{formatNullableDateTime(appealCase.appealReceivedAt)}</dd>
        </div>
      </dl>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      {renderActiveSection(appealCase, submitting, submitActiveStep)}
    </LabsModal>
  );
}

function renderActiveSection(appealCase: AppealCase, submitting: boolean, submitActiveStep: () => Promise<void>) {
  if (appealCase.state === "packet_ready") {
    return (
      <section className="delegate-review-section">
        <h3>Appeal packet ready</h3>
        <dl className="detail-grid delegate-service-grid">
          <div>
            <dt>Packet ready</dt>
            <dd>{formatNullableDateTime(appealCase.packetReadyAt)}</dd>
          </div>
          <div>
            <dt>Final outcome</dt>
            <dd>Excluded from incentive</dd>
          </div>
        </dl>
        <div className="delegate-modal-actions">
          <Link className="primary-button secondary-button" href={`/appeals/plan?appealId=${encodeURIComponent(appealCase.id)}`}>
            Health Plan View
          </Link>
        </div>
      </section>
    );
  }

  const section = getSectionCopy(appealCase);

  return (
    <section className="delegate-review-section">
      <h3>{section.title}</h3>
      <p>{section.body}</p>
      <LabsButton disabled={submitting} onClick={() => void submitActiveStep()}>
        {submitting ? section.pendingLabel : section.actionLabel}
      </LabsButton>
    </section>
  );
}

function getSectionCopy(appealCase: AppealCase) {
  switch (appealCase.state) {
    case "created":
      return {
        title: "Acknowledge Receipt",
        body: "Appeal request receipt is acknowledged before downstream intake validation.",
        actionLabel: "Acknowledge receipt",
        pendingLabel: "Acknowledging..."
      };
    case "acknowledged":
      return {
        title: "Validate Intake",
        body: "Appeal request, authorization, member match, and requested service match are confirmed.",
        actionLabel: "Validate intake",
        pendingLabel: "Validating..."
      };
    case "intake_validated":
      return {
        title: "Retrieve Original PA Decision",
        body: "Denial reason, prior decision summary, and coverage policy context are attached to the appeal packet.",
        actionLabel: "Retrieve decision",
        pendingLabel: "Retrieving..."
      };
    case "decision_retrieved":
      return {
        title: "Resolve Missing Info",
        body: "Any missing information is requested, resolved, or marked as not required before packet assembly.",
        actionLabel: "Resolve missing info",
        pendingLabel: "Resolving..."
      };
    case "missing_info_resolved":
      return {
        title: "Assemble Packet",
        body: "Required documents, clinical rationale, policy citations, evidence index, quality audit, and no-rework checks are complete.",
        actionLabel: "Assemble packet",
        pendingLabel: "Assembling..."
      };
    case "packet_assembled":
      return {
        title: "Index Evidence",
        body: "Evidence index is completed while payment metadata stays free of PHI.",
        actionLabel: "Index evidence",
        pendingLabel: "Indexing..."
      };
    case "evidence_indexed":
      return {
        title: "Route Reviewer",
        body: "Reviewer queue and conflict check are completed without tying incentive payment to the final appeal outcome.",
        actionLabel: "Route reviewer",
        pendingLabel: "Routing..."
      };
    case "packet_ready":
      return {
        title: "Appeal packet ready",
        body: "Appeal packet is ready.",
        actionLabel: "Close",
        pendingLabel: "Closing..."
      };
  }
}

function getActiveStepId(appealCase: AppealCase): WorkflowStepId {
  switch (appealCase.state) {
    case "created":
      return "acknowledge";
    case "acknowledged":
      return "intake";
    case "intake_validated":
      return "originalDecision";
    case "decision_retrieved":
      return "missingInfo";
    case "missing_info_resolved":
      return "packet";
    case "packet_assembled":
      return "evidenceIndex";
    case "evidence_indexed":
    case "packet_ready":
      return "reviewer";
  }
}

function buildActionUrl(appealCase: AppealCase): string {
  const encodedId = encodeURIComponent(appealCase.id);

  switch (appealCase.state) {
    case "created":
      return `/api/appeals/cases/${encodedId}/acknowledge`;
    case "acknowledged":
      return `/api/appeals/cases/${encodedId}/intake`;
    case "intake_validated":
      return `/api/appeals/cases/${encodedId}/original-decision`;
    case "decision_retrieved":
      return `/api/appeals/cases/${encodedId}/missing-info`;
    case "missing_info_resolved":
      return `/api/appeals/cases/${encodedId}/packet`;
    case "packet_assembled":
      return `/api/appeals/cases/${encodedId}/evidence-index`;
    case "evidence_indexed":
    case "packet_ready":
      return `/api/appeals/cases/${encodedId}/route-reviewer`;
  }
}

function buildActionPayload(appealCase: AppealCase) {
  switch (appealCase.state) {
    case "created":
      return { appealRequestAcknowledged: true };
    case "acknowledged":
      return {
        appealRequestPresent: true,
        appellantAuthorized: true,
        planMemberMatched: true,
        requestedServiceMatched: true
      };
    case "intake_validated":
      return {
        denialReasonRetrieved: true,
        priorDecisionSummaryIncluded: true,
        coveragePolicyLocated: true
      };
    case "decision_retrieved":
      return {
        missingInfoRequired: false,
        missingInfoRequested: false,
        missingInfoResolved: true
      };
    case "missing_info_resolved":
      return {
        requiredDocumentsPresent: true,
        clinicalRationaleIncluded: true,
        policyCitationIncluded: true,
        evidenceIndexComplete: true,
        qualityAuditPassed: true,
        noReworkRequired: true
      };
    case "packet_assembled":
      return {
        evidenceIndexComplete: true,
        phiSafeForPaymentMetadata: true
      };
    case "evidence_indexed":
    case "packet_ready":
      return {
        reviewerQueueSelected: true,
        reviewerConflictCheckComplete: true
      };
  }
}
