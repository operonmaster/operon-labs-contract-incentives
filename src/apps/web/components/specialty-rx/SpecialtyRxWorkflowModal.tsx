"use client";

import { useEffect, useState } from "react";
import { LabsBadge, LabsButton, LabsModal } from "../labs-ui";
import type { SpecialtyFulfillmentCase } from "../../lib/specialty-rx-store";
import {
  formatFulfillmentCaseState,
  formatFulfillmentSlaClock,
  formatNullableDateTime,
  fulfillmentSlaBadgeVariant,
  fulfillmentStateBadgeVariant
} from "./specialty-rx-formatters";

interface SpecialtyRxWorkflowModalProps {
  caseRecord: SpecialtyFulfillmentCase;
  onClose: () => void;
  // eslint-disable-next-line no-unused-vars -- Callback parameter name documents the updated fulfillment case.
  onUpdated: (caseRecord: SpecialtyFulfillmentCase) => void;
}

type WorkflowStepId = "intake" | "clearToFill" | "shipment" | "fulfillment";

const workflowSteps: Array<{ id: WorkflowStepId; label: string }> = [
  { id: "intake", label: "Intake & Triage" },
  { id: "clearToFill", label: "Clear To Fill" },
  { id: "shipment", label: "Schedule Shipment" },
  { id: "fulfillment", label: "Confirm Fulfillment" }
];

export function SpecialtyRxWorkflowModal({ caseRecord, onClose, onUpdated }: SpecialtyRxWorkflowModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeStepId = getActiveStepId(caseRecord);
  const activeStepIndex = workflowSteps.findIndex((step) => step.id === activeStepId);
  const [viewStepId, setViewStepId] = useState<WorkflowStepId>(activeStepId);
  const terminal = caseRecord.state === "fulfilled" || caseRecord.state === "exception";

  useEffect(() => {
    setViewStepId(activeStepId);
  }, [activeStepId, caseRecord.id]);

  async function submitActiveStep() {
    if (terminal) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(buildActionUrl(caseRecord), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildActionPayload(caseRecord))
      });
      const payload = (await response.json()) as SpecialtyFulfillmentCase | { error?: string };

      if (!response.ok || !("id" in payload)) {
        setError("error" in payload && payload.error ? payload.error : "Unable to update specialty fulfillment case");
        return;
      }

      onUpdated(payload);
    } catch {
      setError("Unable to update specialty fulfillment case");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LabsModal
      onClose={onClose}
      labelledBy="specialty-rx-workflow-title"
      className="plan-audit-modal specialty-rx-modal"
      backdropClassName="audit-modal-backdrop"
    >
      <div className="modal-toolbar">
        <div>
          <span className="eyebrow">Specialty fulfillment</span>
          <h2 id="specialty-rx-workflow-title">{caseRecord.serviceLabel}</h2>
          <p className="delegate-review-id-line">
            <span>{caseRecord.id}</span>
            <LabsBadge variant={fulfillmentStateBadgeVariant(caseRecord.state)}>
              {formatFulfillmentCaseState(caseRecord)}
            </LabsBadge>
          </p>
        </div>
        <LabsButton variant="row" onClick={onClose}>
          Close
        </LabsButton>
      </div>

      <ol className="stepper compact-stepper specialty-rx-stepper" aria-label="Specialty fulfillment workflow steps">
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

      <dl className="detail-grid delegate-review-meta-grid">
        <div>
          <dt>Linked PA</dt>
          <dd>{caseRecord.umRequestId}</dd>
        </div>
        <div>
          <dt>Pharmacy</dt>
          <dd>{caseRecord.pharmacyDisplay}</dd>
        </div>
        <div>
          <dt>Code</dt>
          <dd>
            {caseRecord.codingSystem} {caseRecord.billingCode}
          </dd>
        </div>
        <div>
          <dt>Fulfillment SLA</dt>
          <dd>
            <LabsBadge variant={fulfillmentSlaBadgeVariant(caseRecord)}>{formatFulfillmentSlaClock(caseRecord)}</LabsBadge>
          </dd>
        </div>
      </dl>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      {renderViewedSection(caseRecord, viewStepId, activeStepId, submitting, submitActiveStep)}
    </LabsModal>
  );
}

function renderViewedSection(
  caseRecord: SpecialtyFulfillmentCase,
  viewStepId: WorkflowStepId,
  activeStepId: WorkflowStepId,
  submitting: boolean,
  submitActiveStep: () => Promise<void>
) {
  if (viewStepId !== activeStepId) {
    return renderCompletedStepSection(caseRecord, viewStepId);
  }

  return renderActiveSection(caseRecord, submitting, submitActiveStep);
}

function renderActiveSection(
  caseRecord: SpecialtyFulfillmentCase,
  submitting: boolean,
  submitActiveStep: () => Promise<void>
) {
  if (caseRecord.state === "fulfilled" || caseRecord.state === "exception") {
    return renderCompletedStepSection(caseRecord, "fulfillment");
  }

  if (caseRecord.state === "intake_triage") {
    return (
      <section className="delegate-review-section">
        <h3>Intake & Triage</h3>
        <p>Approved PA, prescription, assigned pharmacy, therapy metadata, and handoff packet are ready for fulfillment.</p>
        <LabsButton disabled={submitting} onClick={() => void submitActiveStep()}>
          {submitting ? "Completing..." : "Complete intake"}
        </LabsButton>
      </section>
    );
  }

  if (caseRecord.state === "clear_to_fill") {
    return (
      <section className="delegate-review-section">
        <h3>Clear To Fill</h3>
        <p>Benefits check, valid prescription, REMS disposition, inventory, and copay readiness are confirmed.</p>
        <LabsButton disabled={submitting} onClick={() => void submitActiveStep()}>
          {submitting ? "Clearing..." : "Mark clear to fill"}
        </LabsButton>
      </section>
    );
  }

  if (!caseRecord.shipmentScheduledAt) {
    return (
      <section className="delegate-review-section">
        <h3>Schedule Shipment</h3>
        <p>Patient contact, delivery address, delivery window, cold-chain packout, and courier scheduling are documented.</p>
        <LabsButton disabled={submitting} onClick={() => void submitActiveStep()}>
          {submitting ? "Scheduling..." : "Schedule shipment"}
        </LabsButton>
      </section>
    );
  }

  return (
    <section className="delegate-review-section">
      <h3>Confirm Fulfillment</h3>
      <p>Shipment, delivery confirmation, delivery attempt record, and temperature log are complete without avoidable exception.</p>
      <LabsButton disabled={submitting} onClick={() => void submitActiveStep()}>
        {submitting ? "Confirming..." : "Confirm fulfillment"}
      </LabsButton>
    </section>
  );
}

function renderCompletedStepSection(caseRecord: SpecialtyFulfillmentCase, viewStepId: WorkflowStepId) {
  const section = getCompletedStepView(caseRecord, viewStepId);

  return (
    <section className="delegate-review-section">
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

function getCompletedStepView(caseRecord: SpecialtyFulfillmentCase, viewStepId: WorkflowStepId) {
  switch (viewStepId) {
    case "intake":
      return {
        title: "Intake & Triage",
        body: "Approved PA, prescription, pharmacy assignment, therapy metadata, and handoff data were checked.",
        fields: [
          { label: "PA approval received", value: formatNullableDateTime(caseRecord.paApprovalReceivedAt) },
          { label: "Intake started", value: formatNullableDateTime(caseRecord.intakeStartedAt) },
          { label: "Approved PA linked", value: formatBoolean(caseRecord.intake.approvedPaLinked) },
          { label: "Prescription present", value: formatBoolean(caseRecord.intake.prescriptionPresent) },
          { label: "Assigned pharmacy confirmed", value: formatBoolean(caseRecord.intake.assignedPharmacyConfirmed) },
          { label: "Therapy metadata present", value: formatBoolean(caseRecord.intake.therapyMetadataPresent) },
          { label: "Handoff data complete", value: formatBoolean(caseRecord.intake.handoffDataComplete) }
        ]
      };
    case "clearToFill":
      return {
        title: "Clear To Fill",
        body: "Benefits, prescription, REMS, inventory, and payment readiness were confirmed before scheduling.",
        fields: [
          { label: "Clear to fill", value: formatNullableDateTime(caseRecord.clearToFillAt) },
          { label: "Benefits check", value: formatBoolean(caseRecord.clearToFill.benefitsOrClaimCheckCompleted) },
          { label: "Prescription valid", value: formatBoolean(caseRecord.clearToFill.prescriptionValid) },
          {
            label: "Prescriber clarification required",
            value: formatBoolean(caseRecord.clearToFill.prescriberClarificationRequired)
          },
          {
            label: "Prescriber clarification resolved",
            value: formatBoolean(caseRecord.clearToFill.prescriberClarificationResolved)
          },
          { label: "REMS required", value: formatBoolean(caseRecord.clearToFill.remsRequired) },
          {
            label: "REMS authorization confirmed",
            value: formatBoolean(caseRecord.clearToFill.remsAuthorizationConfirmed)
          },
          { label: "Inventory available", value: formatBoolean(caseRecord.clearToFill.inventoryAvailable) },
          { label: "Copay or payment ready", value: formatBoolean(caseRecord.clearToFill.copayOrPaymentReady) }
        ]
      };
    case "shipment":
      return {
        title: "Schedule Shipment",
        body: "Patient contact, address, delivery window, cold-chain packout, and courier scheduling were documented.",
        fields: [
          { label: "Shipment scheduled", value: formatNullableDateTime(caseRecord.shipmentScheduledAt) },
          {
            label: "Patient contact documented",
            value: formatBoolean(caseRecord.shipment.patientContactAttemptDocumented)
          },
          { label: "Address confirmed", value: formatBoolean(caseRecord.shipment.addressConfirmed) },
          { label: "Delivery window confirmed", value: formatBoolean(caseRecord.shipment.deliveryWindowConfirmed) },
          { label: "Cold chain required", value: formatBoolean(caseRecord.shipment.coldChainRequired) },
          {
            label: "Cold-chain packout validated",
            value: formatBoolean(caseRecord.shipment.coldChainPackoutValidated)
          },
          { label: "Courier scheduled", value: formatBoolean(caseRecord.shipment.courierScheduled) }
        ]
      };
    case "fulfillment":
      return {
        title: "Confirm Fulfillment",
        body: "Shipment, delivery evidence, temperature log, and exception disposition were completed.",
        fields: [
          { label: "Delivery confirmed", value: formatNullableDateTime(caseRecord.deliveryConfirmedAt) },
          { label: "Shipped", value: formatBoolean(caseRecord.fulfillment.shipped) },
          { label: "Delivery confirmed evidence", value: formatBoolean(caseRecord.fulfillment.deliveryConfirmed) },
          {
            label: "Delivery attempt documented",
            value: formatBoolean(caseRecord.fulfillment.deliveryAttemptDocumented)
          },
          { label: "Temperature log valid", value: formatBoolean(caseRecord.fulfillment.temperatureLogValid) },
          {
            label: "Avoidable exception",
            value: formatBoolean(caseRecord.fulfillment.avoidableFulfillmentException)
          },
          {
            label: "External blocker documented",
            value: formatBoolean(caseRecord.fulfillment.externalBlockerDocumented)
          },
          { label: "Exception", value: caseRecord.fulfillment.exceptionReasonCode ?? "None" }
        ]
      };
  }
}

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

function getActiveStepId(caseRecord: SpecialtyFulfillmentCase): WorkflowStepId {
  if (caseRecord.state === "intake_triage") {
    return "intake";
  }

  if (caseRecord.state === "clear_to_fill") {
    return "clearToFill";
  }

  if (caseRecord.state === "shipment_scheduled" && !caseRecord.shipmentScheduledAt) {
    return "shipment";
  }

  return "fulfillment";
}

function buildActionUrl(caseRecord: SpecialtyFulfillmentCase): string {
  const encodedId = encodeURIComponent(caseRecord.id);

  if (caseRecord.state === "intake_triage") {
    return `/api/specialty-rx/cases/${encodedId}/intake`;
  }

  if (caseRecord.state === "clear_to_fill") {
    return `/api/specialty-rx/cases/${encodedId}/clear-to-fill`;
  }

  if (caseRecord.state === "shipment_scheduled" && !caseRecord.shipmentScheduledAt) {
    return `/api/specialty-rx/cases/${encodedId}/shipment`;
  }

  return `/api/specialty-rx/cases/${encodedId}/fulfillment`;
}

function buildActionPayload(caseRecord: SpecialtyFulfillmentCase) {
  if (caseRecord.state === "intake_triage") {
    return {
      prescriptionPresent: true,
      assignedPharmacyConfirmed: true,
      therapyMetadataPresent: true,
      handoffDataComplete: true
    };
  }

  if (caseRecord.state === "clear_to_fill") {
    return {
      benefitsOrClaimCheckCompleted: true,
      prescriptionValid: true,
      prescriberClarificationRequired: false,
      prescriberClarificationResolved: true,
      remsRequired: false,
      remsAuthorizationConfirmed: true,
      inventoryAvailable: true,
      copayOrPaymentReady: true
    };
  }

  if (caseRecord.state === "shipment_scheduled" && !caseRecord.shipmentScheduledAt) {
    return {
      patientContactAttemptDocumented: true,
      addressConfirmed: true,
      deliveryWindowConfirmed: true,
      coldChainPackoutValidated: true,
      courierScheduled: true
    };
  }

  return {
    shipped: true,
    deliveryConfirmed: true,
    deliveryAttemptDocumented: true,
    temperatureLogValid: true,
    avoidableFulfillmentException: false,
    externalBlockerDocumented: false,
    exceptionReasonCode: null
  };
}
