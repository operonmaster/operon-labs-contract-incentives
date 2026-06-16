"use client";

import { useState } from "react";
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
  const terminal = caseRecord.state === "fulfilled" || caseRecord.state === "exception";

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

        {renderActiveSection(caseRecord, submitting, submitActiveStep)}
    </LabsModal>
  );
}

function renderActiveSection(
  caseRecord: SpecialtyFulfillmentCase,
  submitting: boolean,
  submitActiveStep: () => Promise<void>
) {
  if (caseRecord.state === "fulfilled" || caseRecord.state === "exception") {
    return (
      <section className="delegate-review-section">
        <h3>Fulfillment evidence</h3>
        <dl className="detail-grid delegate-service-grid">
          <div>
            <dt>Delivery confirmed</dt>
            <dd>{formatNullableDateTime(caseRecord.deliveryConfirmedAt)}</dd>
          </div>
          <div>
            <dt>Shipment scheduled</dt>
            <dd>{formatNullableDateTime(caseRecord.shipmentScheduledAt)}</dd>
          </div>
          <div>
            <dt>Exception</dt>
            <dd>{caseRecord.fulfillment.exceptionReasonCode ?? "None"}</dd>
          </div>
        </dl>
      </section>
    );
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
