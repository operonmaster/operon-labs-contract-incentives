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

type ChecklistField =
  | "prescriptionPresent"
  | "assignedPharmacyConfirmed"
  | "therapyMetadataPresent"
  | "handoffDataComplete"
  | "benefitsOrClaimCheckCompleted"
  | "prescriptionValid"
  | "inventoryAvailable"
  | "copayOrPaymentReady"
  | "patientContactAttemptDocumented"
  | "addressConfirmed"
  | "deliveryWindowConfirmed"
  | "coldChainPackoutValidated"
  | "courierScheduled"
  | "shipped"
  | "deliveryConfirmed"
  | "deliveryAttemptDocumented"
  | "temperatureLogValid";

type ChecklistState = Record<ChecklistField, boolean>;
// eslint-disable-next-line no-unused-vars -- Tuple parameters document the checklist field update callback contract.
type ChecklistFieldSetter = (...args: [ChecklistField, boolean]) => void;

interface ChecklistItem {
  field: ChecklistField;
  label: string;
}

const intakeChecklistItems: ChecklistItem[] = [
  { field: "prescriptionPresent", label: "Prescription present" },
  { field: "assignedPharmacyConfirmed", label: "Assigned pharmacy confirmed" },
  { field: "therapyMetadataPresent", label: "Therapy metadata present" },
  { field: "handoffDataComplete", label: "Handoff packet/data complete" }
];

const clearToFillChecklistItems: ChecklistItem[] = [
  { field: "benefitsOrClaimCheckCompleted", label: "Benefits/claim check completed" },
  { field: "prescriptionValid", label: "Prescription valid" },
  { field: "inventoryAvailable", label: "Inventory available" },
  { field: "copayOrPaymentReady", label: "Copay/payment ready" }
];

const shipmentChecklistItems: ChecklistItem[] = [
  { field: "patientContactAttemptDocumented", label: "Patient contact attempt documented" },
  { field: "addressConfirmed", label: "Address confirmed" },
  { field: "deliveryWindowConfirmed", label: "Delivery window confirmed" },
  { field: "coldChainPackoutValidated", label: "Cold-chain packout validated" },
  { field: "courierScheduled", label: "Courier scheduled" }
];

const fulfillmentChecklistItems: ChecklistItem[] = [
  { field: "shipped", label: "Shipped" },
  { field: "deliveryConfirmed", label: "Delivery confirmed" },
  { field: "deliveryAttemptDocumented", label: "Delivery attempt documented" },
  { field: "temperatureLogValid", label: "Temperature log valid" }
];

export function SpecialtyRxWorkflowModal({ caseRecord, onClose, onUpdated }: SpecialtyRxWorkflowModalProps) {
  const activeStepId = getActiveStepId(caseRecord);

  return (
    <SpecialtyRxWorkflowModalContent
      activeStepId={activeStepId}
      caseRecord={caseRecord}
      key={`${caseRecord.id}:${activeStepId}`}
      onClose={onClose}
      onUpdated={onUpdated}
    />
  );
}

function SpecialtyRxWorkflowModalContent({
  activeStepId,
  caseRecord,
  onClose,
  onUpdated
}: SpecialtyRxWorkflowModalProps & { activeStepId: WorkflowStepId }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeStepIndex = workflowSteps.findIndex((step) => step.id === activeStepId);
  const [viewStepId, setViewStepId] = useState<WorkflowStepId>(activeStepId);
  const [checklist, setChecklist] = useState<ChecklistState>(() => buildChecklistState(caseRecord));
  const terminal = caseRecord.state === "fulfilled" || caseRecord.state === "exception";

  function setChecklistField(field: ChecklistField, checked: boolean) {
    setChecklist((current) => ({
      ...current,
      [field]: checked
    }));
  }

  async function submitActiveStep() {
    if (terminal || !isActiveChecklistComplete(caseRecord, checklist)) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(buildActionUrl(caseRecord), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildActionPayload(caseRecord, checklist))
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

      {renderViewedSection(caseRecord, viewStepId, activeStepId, checklist, setChecklistField, submitting, submitActiveStep)}
    </LabsModal>
  );
}

function renderViewedSection(
  caseRecord: SpecialtyFulfillmentCase,
  viewStepId: WorkflowStepId,
  activeStepId: WorkflowStepId,
  checklist: ChecklistState,
  setChecklistField: ChecklistFieldSetter,
  submitting: boolean,
  submitActiveStep: () => Promise<void>
) {
  if (viewStepId !== activeStepId) {
    return renderCompletedStepSection(caseRecord, viewStepId);
  }

  return renderActiveSection(caseRecord, checklist, setChecklistField, submitting, submitActiveStep);
}

function renderActiveSection(
  caseRecord: SpecialtyFulfillmentCase,
  checklist: ChecklistState,
  setChecklistField: ChecklistFieldSetter,
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
        {renderChecklist(intakeChecklistItems, checklist, setChecklistField)}
        <LabsButton disabled={submitting || !isChecklistComplete(intakeChecklistItems, checklist)} onClick={() => void submitActiveStep()}>
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
        {renderChecklist(clearToFillChecklistItems, checklist, setChecklistField)}
        <LabsButton disabled={submitting || !isChecklistComplete(clearToFillChecklistItems, checklist)} onClick={() => void submitActiveStep()}>
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
        {renderChecklist(shipmentChecklistItems, checklist, setChecklistField)}
        <LabsButton disabled={submitting || !isChecklistComplete(shipmentChecklistItems, checklist)} onClick={() => void submitActiveStep()}>
          {submitting ? "Scheduling..." : "Schedule shipment"}
        </LabsButton>
      </section>
    );
  }

  return (
    <section className="delegate-review-section">
      <h3>Confirm Fulfillment</h3>
      <p>Shipment, delivery confirmation, delivery attempt record, and temperature log are complete without avoidable exception.</p>
      {renderChecklist(fulfillmentChecklistItems, checklist, setChecklistField)}
      <LabsButton disabled={submitting || !isChecklistComplete(fulfillmentChecklistItems, checklist)} onClick={() => void submitActiveStep()}>
        {submitting ? "Confirming..." : "Confirm fulfillment"}
      </LabsButton>
    </section>
  );
}

function renderChecklist(
  items: ChecklistItem[],
  checklist: ChecklistState,
  setChecklistField: ChecklistFieldSetter
) {
  return (
    <div className="workflow-checklist" aria-label="Operator checklist">
      {items.map((item) => (
        <label className="checkbox-row" key={item.field}>
          <input
            checked={checklist[item.field]}
            type="checkbox"
            onChange={(event) => setChecklistField(item.field, event.currentTarget.checked)}
          />
          {item.label}
        </label>
      ))}
    </div>
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

function buildChecklistState(caseRecord: SpecialtyFulfillmentCase): ChecklistState {
  return {
    prescriptionPresent: caseRecord.intake.prescriptionPresent,
    assignedPharmacyConfirmed: caseRecord.intake.assignedPharmacyConfirmed,
    therapyMetadataPresent: caseRecord.intake.therapyMetadataPresent,
    handoffDataComplete: caseRecord.intake.handoffDataComplete,
    benefitsOrClaimCheckCompleted: caseRecord.clearToFill.benefitsOrClaimCheckCompleted,
    prescriptionValid: caseRecord.clearToFill.prescriptionValid,
    inventoryAvailable: caseRecord.clearToFill.inventoryAvailable,
    copayOrPaymentReady: caseRecord.clearToFill.copayOrPaymentReady,
    patientContactAttemptDocumented: caseRecord.shipment.patientContactAttemptDocumented,
    addressConfirmed: caseRecord.shipment.addressConfirmed,
    deliveryWindowConfirmed: caseRecord.shipment.deliveryWindowConfirmed,
    coldChainPackoutValidated: caseRecord.shipment.coldChainPackoutValidated,
    courierScheduled: caseRecord.shipment.courierScheduled,
    shipped: caseRecord.fulfillment.shipped,
    deliveryConfirmed: caseRecord.fulfillment.deliveryConfirmed,
    deliveryAttemptDocumented: caseRecord.fulfillment.deliveryAttemptDocumented,
    temperatureLogValid: caseRecord.fulfillment.temperatureLogValid
  };
}

function isActiveChecklistComplete(caseRecord: SpecialtyFulfillmentCase, checklist: ChecklistState): boolean {
  if (caseRecord.state === "intake_triage") {
    return isChecklistComplete(intakeChecklistItems, checklist);
  }

  if (caseRecord.state === "clear_to_fill") {
    return isChecklistComplete(clearToFillChecklistItems, checklist);
  }

  if (caseRecord.state === "shipment_scheduled" && !caseRecord.shipmentScheduledAt) {
    return isChecklistComplete(shipmentChecklistItems, checklist);
  }

  return isChecklistComplete(fulfillmentChecklistItems, checklist);
}

function isChecklistComplete(items: ChecklistItem[], checklist: ChecklistState): boolean {
  return items.every((item) => checklist[item.field]);
}

function buildActionPayload(caseRecord: SpecialtyFulfillmentCase, checklist: ChecklistState) {
  if (caseRecord.state === "intake_triage") {
    return {
      prescriptionPresent: checklist.prescriptionPresent,
      assignedPharmacyConfirmed: checklist.assignedPharmacyConfirmed,
      therapyMetadataPresent: checklist.therapyMetadataPresent,
      handoffDataComplete: checklist.handoffDataComplete
    };
  }

  if (caseRecord.state === "clear_to_fill") {
    return {
      benefitsOrClaimCheckCompleted: checklist.benefitsOrClaimCheckCompleted,
      prescriptionValid: checklist.prescriptionValid,
      prescriberClarificationRequired: false,
      prescriberClarificationResolved: true,
      remsRequired: false,
      remsAuthorizationConfirmed: true,
      inventoryAvailable: checklist.inventoryAvailable,
      copayOrPaymentReady: checklist.copayOrPaymentReady
    };
  }

  if (caseRecord.state === "shipment_scheduled" && !caseRecord.shipmentScheduledAt) {
    return {
      patientContactAttemptDocumented: checklist.patientContactAttemptDocumented,
      addressConfirmed: checklist.addressConfirmed,
      deliveryWindowConfirmed: checklist.deliveryWindowConfirmed,
      coldChainPackoutValidated: checklist.coldChainPackoutValidated,
      courierScheduled: checklist.courierScheduled
    };
  }

  return {
    shipped: checklist.shipped,
    deliveryConfirmed: checklist.deliveryConfirmed,
    deliveryAttemptDocumented: checklist.deliveryAttemptDocumented,
    temperatureLogValid: checklist.temperatureLogValid,
    avoidableFulfillmentException: false,
    externalBlockerDocumented: false,
    exceptionReasonCode: null
  };
}
