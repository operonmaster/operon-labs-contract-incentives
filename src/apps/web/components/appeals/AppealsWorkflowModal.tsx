"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LabsBadge, LabsButton, LabsModal } from "../labs-ui";
import type { AppealCase } from "../../lib/appeals-store";
import type { AppealsPriorAuthRow } from "../../lib/appeals-workflow";
import {
  appealStateBadgeVariant,
  formatAppealState,
  formatNullableDateTime,
  formatRequestType
} from "./appeals-formatters";

interface AppealsWorkflowModalProps {
  appealCase: AppealCase;
  priorAuthRow?: AppealsPriorAuthRow;
  onClose: () => void;
  // eslint-disable-next-line no-unused-vars -- Callback parameter name documents the updated appeal case.
  onUpdated: (appealCase: AppealCase) => void;
}

type WorkflowStepId =
  | "acknowledge"
  | "intake"
  | "missingInfo"
  | "packet"
  | "evidenceIndex"
  | "packageSubmit";

type StepFormValues = Record<string, boolean>;

const workflowSteps: Array<{ id: WorkflowStepId; label: string }> = [
  { id: "acknowledge", label: "Acknowledge Receipt" },
  { id: "intake", label: "Validate Intake" },
  { id: "missingInfo", label: "Resolve Missing Info" },
  { id: "packet", label: "Assemble Packet" },
  { id: "evidenceIndex", label: "Index Evidence" },
  { id: "packageSubmit", label: "Submit Appeal Package" }
];

export function AppealsWorkflowModal({ appealCase, priorAuthRow, onClose, onUpdated }: AppealsWorkflowModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeStepId = getActiveStepId(appealCase);
  const activeStepIndex = workflowSteps.findIndex((step) => step.id === activeStepId);
  const [viewStepId, setViewStepId] = useState<WorkflowStepId>(activeStepId);
  const [formValues, setFormValues] = useState<StepFormValues>(() => getInitialFormValues(appealCase));
  const terminal = appealCase.state === "packet_ready";
  const linkedRequest = priorAuthRow?.umRequest;

  useEffect(() => {
    setViewStepId(activeStepId);
  }, [activeStepId, appealCase.id]);

  useEffect(() => {
    setFormValues(getInitialFormValues(appealCase));
    setError(null);
  }, [appealCase.id, appealCase.state]);

  function updateFormValue(name: string, value: boolean) {
    setFormValues((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function submitActiveStep() {
    if (terminal || !canSubmitActiveStep(appealCase, formValues)) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(buildActionUrl(appealCase), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildActionPayload(appealCase, formValues))
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
        {workflowSteps.map((step, index) => {
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
                onClick={() => setViewStepId(step.id)}
              >
                <strong aria-hidden="true">{index + 1}</strong>
                <span>{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <section className="appeals-context-panel" aria-label="Linked prior authorization context">
        <div className="appeals-context-heading">
          <h3>Linked PA context</h3>
          <p>Original denied request details used to validate and assemble the appeal packet.</p>
        </div>
        <dl className="detail-grid delegate-review-meta-grid appeals-context-grid">
          <div>
            <dt>Member</dt>
            <dd>{linkedRequest?.patientDisplay ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{linkedRequest?.providerDisplay ?? appealCase.providerId}</dd>
          </div>
          <div>
            <dt>Linked PA</dt>
            <dd>{appealCase.umRequestId}</dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>{linkedRequest?.planDisplay ?? appealCase.planId}</dd>
          </div>
          <div>
            <dt>Request type</dt>
            <dd>{formatRequestType(appealCase.requestType)}</dd>
          </div>
          <div>
            <dt>Requested service</dt>
            <dd>{linkedRequest?.serviceLabel ?? appealCase.serviceLabel}</dd>
          </div>
          <div>
            <dt>Denial reason</dt>
            <dd>
              <LabsBadge className="appeals-denial-reason-badge" variant="warning">
                {formatReasonCode(linkedRequest?.clinicalReview?.denialReasonCode ?? appealCase.originalDenialReasonCode)}
              </LabsBadge>
            </dd>
          </div>
        </dl>
      </section>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      {renderViewedSection(
        appealCase,
        viewStepId,
        activeStepId,
        submitting,
        formValues,
        updateFormValue,
        submitActiveStep
      )}
    </LabsModal>
  );
}

function formatReasonCode(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function renderViewedSection(
  appealCase: AppealCase,
  viewStepId: WorkflowStepId,
  activeStepId: WorkflowStepId,
  submitting: boolean,
  formValues: StepFormValues,
  onFormValueChange: (name: string, value: boolean) => void,
  submitActiveStep: () => Promise<void>
) {
  if (viewStepId !== activeStepId) {
    return renderCompletedStepSection(appealCase, viewStepId);
  }

  return renderActiveSection(appealCase, submitting, formValues, onFormValueChange, submitActiveStep);
}

function renderActiveSection(
  appealCase: AppealCase,
  submitting: boolean,
  formValues: StepFormValues,
  onFormValueChange: (name: string, value: boolean) => void,
  submitActiveStep: () => Promise<void>
) {
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

  const section = getActiveStepView(appealCase);
  const canSubmit = canSubmitActiveStep(appealCase, formValues);

  return (
    <section className="delegate-review-section">
      <h3>{section.title}</h3>
      <p>{section.body}</p>
      <div className="appeals-step-checklist" aria-label={`${section.title} assertions`}>
        {section.controls.map((control) => (
          <label className="appeals-step-checkbox" key={control.name}>
            <input
              checked={isChecked(formValues, control.name)}
              name={control.name}
              type="checkbox"
              onChange={(event) => onFormValueChange(control.name, event.currentTarget.checked)}
            />
            <span>{control.label}</span>
          </label>
        ))}
      </div>
      <LabsButton disabled={submitting || !canSubmit} onClick={() => void submitActiveStep()}>
        {submitting ? section.pendingLabel : section.actionLabel}
      </LabsButton>
    </section>
  );
}

function renderCompletedStepSection(appealCase: AppealCase, viewStepId: WorkflowStepId) {
  const section = getCompletedStepView(appealCase, viewStepId);

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

function getActiveStepView(appealCase: AppealCase) {
  switch (appealCase.state) {
    case "created":
      return {
        title: "Acknowledge Receipt",
        body: "Appeal request receipt is acknowledged before downstream intake validation.",
        actionLabel: "Acknowledge receipt",
        pendingLabel: "Acknowledging...",
        controls: [{ name: "appealRequestAcknowledged", label: "Appeal request acknowledged" }]
      };
    case "acknowledged":
      return {
        title: "Validate Intake",
        body: "Appeal request, authorization, member match, and requested service match are confirmed.",
        actionLabel: "Validate intake",
        pendingLabel: "Validating...",
        controls: [
          { name: "appealRequestPresent", label: "Appeal request present" },
          { name: "appellantAuthorized", label: "Appellant authorized" },
          { name: "planMemberMatched", label: "Member match confirmed" },
          { name: "requestedServiceMatched", label: "Requested service match confirmed" }
        ]
      };
    case "intake_validated":
    case "decision_retrieved":
      return {
        title: "Resolve Missing Info",
        body: "Any missing information is requested, resolved, or marked as not required before packet assembly.",
        actionLabel: "Resolve missing info",
        pendingLabel: "Resolving...",
        controls: [
          { name: "missingInfoRequired", label: "Missing information required" },
          { name: "missingInfoRequested", label: "Missing information requested" },
          { name: "missingInfoResolved", label: "Missing information resolved or not required" }
        ]
      };
    case "missing_info_resolved":
      return {
        title: "Assemble Packet",
        body: "Required documents, clinical rationale, policy citations, quality audit, and no-rework checks are complete.",
        actionLabel: "Assemble packet",
        pendingLabel: "Assembling...",
        controls: [
          { name: "requiredDocumentsPresent", label: "Required documents present" },
          { name: "clinicalRationaleIncluded", label: "Clinical rationale included" },
          { name: "policyCitationIncluded", label: "Policy citation included" },
          { name: "qualityAuditPassed", label: "Quality audit passed" },
          { name: "noReworkRequired", label: "No rework required" }
        ]
      };
    case "packet_assembled":
      return {
        title: "Index Evidence",
        body: "Evidence index is completed before reviewer routing.",
        actionLabel: "Index evidence",
        pendingLabel: "Indexing...",
        controls: [{ name: "evidenceIndexComplete", label: "Evidence index complete" }]
      };
    case "evidence_indexed":
      return {
        title: "Submit Appeal Package",
        body: "The appeal packet is complete and the package submission is confirmed before incentive evaluation.",
        actionLabel: "Submit package",
        pendingLabel: "Submitting...",
        controls: [
          { name: "appealPacketComplete", label: "Appeal packet complete" },
          { name: "submissionConfirmationCaptured", label: "Submission confirmation captured" }
        ]
      };
    case "packet_ready":
      return {
        title: "Appeal packet ready",
        body: "Appeal packet is ready.",
        actionLabel: "Close",
        pendingLabel: "Closing...",
        controls: []
      };
  }
}

function getCompletedStepView(appealCase: AppealCase, viewStepId: WorkflowStepId) {
  switch (viewStepId) {
    case "acknowledge":
      return {
        title: "Acknowledge Receipt",
        body: "Appeal receipt acknowledgement captured before intake validation.",
        fields: [
          {
            label: "Acknowledged",
            value: appealCase.acknowledgedAt ? formatNullableDateTime(appealCase.acknowledgedAt) : "Not recorded"
          }
        ]
      };
    case "intake":
      return {
        title: "Validate Intake",
        body: "Appeal request, authorization, member match, and requested service match were checked.",
        fields: [
          { label: "Appeal request present", value: formatBoolean(appealCase.intake.appealRequestPresent) },
          { label: "Appellant authorized", value: formatBoolean(appealCase.intake.appellantAuthorized) },
          { label: "Member match confirmed", value: formatBoolean(appealCase.intake.planMemberMatched) },
          { label: "Requested service match confirmed", value: formatBoolean(appealCase.intake.requestedServiceMatched) }
        ]
      };
    case "missingInfo":
      return {
        title: "Resolve Missing Info",
        body: "Missing information was resolved or marked as not required before packet assembly.",
        fields: [
          { label: "Missing info required", value: formatBoolean(appealCase.missingInfo.missingInfoRequired) },
          { label: "Missing info requested", value: formatBoolean(appealCase.missingInfo.missingInfoRequested) },
          { label: "Missing info resolved", value: formatBoolean(appealCase.missingInfo.missingInfoResolved) }
        ]
      };
    case "packet":
      return {
        title: "Assemble Packet",
        body: "Packet documents, rationale, citations, and quality checks were assembled.",
        fields: [
          { label: "Required documents", value: formatBoolean(appealCase.packet.requiredDocumentsPresent) },
          { label: "Clinical rationale", value: formatBoolean(appealCase.packet.clinicalRationaleIncluded) },
          { label: "Policy citation", value: formatBoolean(appealCase.packet.policyCitationIncluded) },
          { label: "Quality audit", value: formatBoolean(appealCase.packet.qualityAuditPassed) },
          { label: "No rework required", value: formatBoolean(appealCase.packet.noReworkRequired) }
        ]
      };
    case "evidenceIndex":
      return {
        title: "Index Evidence",
        body: "Evidence indexing was completed before reviewer routing.",
        fields: [{ label: "Evidence index complete", value: formatBoolean(appealCase.packet.evidenceIndexComplete) }]
      };
    case "packageSubmit":
      return {
        title: "Submit Appeal Package",
        body: "Appeal packet submission is separated from the final appeal decision outcome.",
        fields: [
          { label: "Appeal packet complete", value: formatBoolean(appealCase.routing.reviewerQueueSelected) },
          { label: "Submission confirmation captured", value: formatBoolean(appealCase.routing.reviewerConflictCheckComplete) },
          { label: "Final decision excluded", value: formatBoolean(appealCase.routing.finalDecisionOutsideIncentive) }
        ]
      };
  }
}

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

function getActiveStepId(appealCase: AppealCase): WorkflowStepId {
  switch (appealCase.state) {
    case "created":
      return "acknowledge";
    case "acknowledged":
      return "intake";
    case "intake_validated":
    case "decision_retrieved":
      return "missingInfo";
    case "missing_info_resolved":
      return "packet";
    case "packet_assembled":
      return "evidenceIndex";
    case "evidence_indexed":
    case "packet_ready":
      return "packageSubmit";
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

function buildActionPayload(appealCase: AppealCase, formValues: StepFormValues) {
  switch (appealCase.state) {
    case "created":
      return { appealRequestAcknowledged: isChecked(formValues, "appealRequestAcknowledged") };
    case "acknowledged":
      return {
        appealRequestPresent: isChecked(formValues, "appealRequestPresent"),
        appellantAuthorized: isChecked(formValues, "appellantAuthorized"),
        planMemberMatched: isChecked(formValues, "planMemberMatched"),
        requestedServiceMatched: isChecked(formValues, "requestedServiceMatched")
      };
    case "intake_validated":
    case "decision_retrieved":
      return {
        missingInfoRequired: isChecked(formValues, "missingInfoRequired"),
        missingInfoRequested: isChecked(formValues, "missingInfoRequested"),
        missingInfoResolved: isChecked(formValues, "missingInfoResolved")
      };
    case "missing_info_resolved":
      return {
        requiredDocumentsPresent: isChecked(formValues, "requiredDocumentsPresent"),
        clinicalRationaleIncluded: isChecked(formValues, "clinicalRationaleIncluded"),
        policyCitationIncluded: isChecked(formValues, "policyCitationIncluded"),
        evidenceIndexComplete: false,
        qualityAuditPassed: isChecked(formValues, "qualityAuditPassed"),
        noReworkRequired: isChecked(formValues, "noReworkRequired")
      };
    case "packet_assembled":
      return {
        evidenceIndexComplete: isChecked(formValues, "evidenceIndexComplete"),
        phiSafeForPaymentMetadata: true
      };
    case "evidence_indexed":
    case "packet_ready":
      return {
        reviewerQueueSelected: isChecked(formValues, "appealPacketComplete"),
        reviewerConflictCheckComplete: isChecked(formValues, "submissionConfirmationCaptured")
      };
  }
}

function getInitialFormValues(appealCase: AppealCase): StepFormValues {
  switch (appealCase.state) {
    case "created":
      return { appealRequestAcknowledged: Boolean(appealCase.acknowledgedAt) };
    case "acknowledged":
      return {
        appealRequestPresent: appealCase.intake.appealRequestPresent,
        appellantAuthorized: appealCase.intake.appellantAuthorized,
        planMemberMatched: appealCase.intake.planMemberMatched,
        requestedServiceMatched: appealCase.intake.requestedServiceMatched
      };
    case "intake_validated":
    case "decision_retrieved":
      return {
        missingInfoRequired: appealCase.missingInfo.missingInfoRequired,
        missingInfoRequested: appealCase.missingInfo.missingInfoRequested,
        missingInfoResolved: appealCase.missingInfo.missingInfoResolved
      };
    case "missing_info_resolved":
      return {
        requiredDocumentsPresent: appealCase.packet.requiredDocumentsPresent,
        clinicalRationaleIncluded: appealCase.packet.clinicalRationaleIncluded,
        policyCitationIncluded: appealCase.packet.policyCitationIncluded,
        qualityAuditPassed: appealCase.packet.qualityAuditPassed,
        noReworkRequired: appealCase.packet.noReworkRequired
      };
    case "packet_assembled":
      return { evidenceIndexComplete: appealCase.packet.evidenceIndexComplete };
    case "evidence_indexed":
    case "packet_ready":
      return {
        appealPacketComplete: appealCase.routing.reviewerQueueSelected,
        submissionConfirmationCaptured: appealCase.routing.reviewerConflictCheckComplete
      };
  }
}

function canSubmitActiveStep(appealCase: AppealCase, formValues: StepFormValues): boolean {
  switch (appealCase.state) {
    case "created":
      return isChecked(formValues, "appealRequestAcknowledged");
    case "acknowledged":
      return [
        "appealRequestPresent",
        "appellantAuthorized",
        "planMemberMatched",
        "requestedServiceMatched"
      ].every((name) => isChecked(formValues, name));
    case "intake_validated":
    case "decision_retrieved":
      return isChecked(formValues, "missingInfoResolved") && (
        !isChecked(formValues, "missingInfoRequired") || isChecked(formValues, "missingInfoRequested")
      );
    case "missing_info_resolved":
      return [
        "requiredDocumentsPresent",
        "clinicalRationaleIncluded",
        "policyCitationIncluded",
        "qualityAuditPassed",
        "noReworkRequired"
      ].every((name) => isChecked(formValues, name));
    case "packet_assembled":
      return isChecked(formValues, "evidenceIndexComplete");
    case "evidence_indexed":
      return isChecked(formValues, "appealPacketComplete") && isChecked(formValues, "submissionConfirmationCaptured");
    case "packet_ready":
      return false;
  }
}

function isChecked(formValues: StepFormValues, name: string): boolean {
  return formValues[name] === true;
}
