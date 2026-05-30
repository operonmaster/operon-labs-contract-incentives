"use client";

import type { SpecialtyRxPlanAuditRow } from "../../lib/specialty-rx-workflow";
import { LabsBadge, LabsButton, LabsModal } from "../labs-ui";
import { EvidenceRows, controlStatusBadgeVariant, formatTransaction } from "../incentive-audit-evidence";
import {
  businessPolicyStatusBadgeVariant,
  formatBusinessPolicyStatus,
  formatCurrency,
  formatFulfillmentCaseState,
  formatNullableDateTime,
  formatPaymentPolicyStatus,
  formatRequestType,
  formatSlaStatus,
  fulfillmentStateBadgeVariant,
  paymentPolicyStatusBadgeVariant,
  specialtySlaBadgeVariant
} from "./specialty-rx-formatters";

interface SpecialtyRxPlanDetailsModalProps {
  row: SpecialtyRxPlanAuditRow;
  onClose: () => void;
}

export function SpecialtyRxPlanDetailsModal({ row, onClose }: SpecialtyRxPlanDetailsModalProps) {
  const fulfillmentCase = row.fulfillmentCase as Partial<SpecialtyRxPlanAuditRow["fulfillmentCase"]>;

  return (
    <LabsModal
      onClose={onClose}
      labelledBy="specialty-rx-plan-audit-title"
      className="plan-audit-modal policy-details-modal payment-policy-details-modal specialty-rx-policy-event-modal"
      backdropClassName="audit-modal-backdrop"
    >
      <div className="modal-toolbar">
          <div>
            <span className="eyebrow">Policy event</span>
            <h2 id="specialty-rx-plan-audit-title">Specialty Fulfillment Audit Details</h2>
            <dl className="policy-event-context-line">
              <div>
                <dt>Fulfillment case ID</dt>
                <dd className="mono-cell">{row.fulfillmentCaseId}</dd>
              </div>
              <div>
                <dt>Linked PA</dt>
                <dd className="mono-cell">{row.umRequestId}</dd>
              </div>
              <div>
                <dt>Pharmacy</dt>
                <dd>{row.pharmacyDisplay}</dd>
              </div>
              <div>
                <dt>Drug/service</dt>
                <dd>{row.serviceLabel}</dd>
              </div>
            </dl>
          </div>
          <LabsButton variant="row" onClick={onClose}>
            Close details
          </LabsButton>
        </div>

        <dl className="detail-grid policy-event-outcome-strip">
          <div>
            <dt>Business policy status</dt>
            <dd>
              <LabsBadge variant={businessPolicyStatusBadgeVariant(row.businessPolicyStatus)}>
                {formatBusinessPolicyStatus(row.businessPolicyStatus)}
              </LabsBadge>
            </dd>
          </div>
          <div>
            <dt>Payment policy status</dt>
            <dd>
              <LabsBadge variant={paymentPolicyStatusBadgeVariant(row.paymentPolicyStatus)}>
                {formatPaymentPolicyStatus(row.paymentPolicyStatus)}
              </LabsBadge>
            </dd>
          </div>
          <div>
            <dt>Fulfillment SLA</dt>
            <dd>
              <LabsBadge variant={specialtySlaBadgeVariant(row.fulfillmentSlaStatus)}>
                {formatSlaStatus(row.fulfillmentSlaStatus)}
              </LabsBadge>
            </dd>
          </div>
          <div>
            <dt>Closure evidence</dt>
            <dd>{formatNullableDateTime(row.deliveryConfirmedAt)}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>{formatCurrency(row)}</dd>
          </div>
          <div>
            <dt>Wallet</dt>
            <dd className="mono-cell">{row.walletId ?? "Not assigned"}</dd>
          </div>
          {row.transactionId ? (
            <div>
              <dt>Transaction</dt>
              <dd className="mono-cell">{formatTransaction(row.transactionId)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="policy-modal-sections payment-policy-modal-sections">
          <section className="policy-modal-section" aria-labelledby="specialty-case-identity-title">
            <h3 id="specialty-case-identity-title">Case identity</h3>
            <dl className="policy-anchor-list">
              <div>
                <dt>Fulfillment case ID</dt>
                <dd>{row.fulfillmentCaseId}</dd>
              </div>
              <div>
                <dt>Plan</dt>
                <dd>{row.planId}</dd>
              </div>
              <div>
                <dt>Pharmacy</dt>
                <dd>{row.pharmacyDisplay}</dd>
              </div>
              <div>
                <dt>State</dt>
                <dd>
                  <LabsBadge variant={fulfillmentStateBadgeVariant(row.state)}>
                    {formatFulfillmentCaseState(row)}
                  </LabsBadge>
                </dd>
              </div>
            </dl>
          </section>

          <section className="policy-modal-section" aria-labelledby="specialty-linked-um-title">
            <h3 id="specialty-linked-um-title">Linked UM request</h3>
            <dl className="policy-anchor-list">
              <div>
                <dt>UM request ID</dt>
                <dd>{row.umRequestId}</dd>
              </div>
              <div>
                <dt>Request type</dt>
                <dd>{formatRequestType(row.requestType)}</dd>
              </div>
              <div>
                <dt>Service</dt>
                <dd>{row.serviceLabel}</dd>
              </div>
            </dl>
          </section>

          <section className="policy-modal-section" aria-labelledby="specialty-delegate-context-title">
            <h3 id="specialty-delegate-context-title">Delegate determination</h3>
            <dl className="policy-anchor-list">
              <div>
                <dt>Source</dt>
                <dd>{formatFulfillmentSource(fulfillmentCase.source)}</dd>
              </div>
              <div>
                <dt>PA approved</dt>
                <dd>{formatNullableDateTime(fulfillmentCase.paApprovalReceivedAt ?? null)}</dd>
              </div>
              <div>
                <dt>Linked PA outcome</dt>
                <dd>Approved pharmacy prior authorization</dd>
              </div>
            </dl>
          </section>

          <section className="policy-modal-section" aria-labelledby="specialty-fulfillment-timestamps-title">
            <h3 id="specialty-fulfillment-timestamps-title">Fulfillment timestamps</h3>
            <dl className="policy-anchor-list">
              <div>
                <dt>PA approved</dt>
                <dd>{formatNullableDateTime(fulfillmentCase.paApprovalReceivedAt ?? null)}</dd>
              </div>
              <div>
                <dt>Fulfillment SLA started</dt>
                <dd>{formatNullableDateTime(row.fulfillmentSlaStartedAt)}</dd>
              </div>
              <div>
                <dt>Clear To Fill</dt>
                <dd>{formatNullableDateTime(row.clearToFillAt)}</dd>
              </div>
              <div>
                <dt>Shipment scheduled</dt>
                <dd>{formatNullableDateTime(row.shipmentScheduledAt)}</dd>
              </div>
              <div>
                <dt>Delivery confirmed</dt>
                <dd>{formatNullableDateTime(row.deliveryConfirmedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="policy-modal-section" aria-labelledby="specialty-checklist-evidence-title">
            <h3 id="specialty-checklist-evidence-title">Checklist evidence</h3>
            <EvidenceRows emptyLabel="No fulfillment checklist evidence recorded" rows={buildChecklistEvidenceRows(row)} />
          </section>

          <section className="policy-modal-section" aria-labelledby="specialty-exception-classification-title">
            <h3 id="specialty-exception-classification-title">Exception classification</h3>
            <dl className="policy-anchor-list">
              <div>
                <dt>External blocker</dt>
                <dd>{formatYesNo(fulfillmentCase.fulfillment?.externalBlockerDocumented)}</dd>
              </div>
              <div>
                <dt>Avoidable exception</dt>
                <dd>{formatYesNo(fulfillmentCase.fulfillment?.avoidableFulfillmentException)}</dd>
              </div>
              <div>
                <dt>Exception reason</dt>
                <dd>{fulfillmentCase.fulfillment?.exceptionReasonCode ?? "None"}</dd>
              </div>
            </dl>
          </section>

          <section className="policy-modal-section" aria-labelledby="specialty-fulfillment-evidence-title">
            <h3 id="specialty-fulfillment-evidence-title">Fulfillment evidence</h3>
            <dl className="policy-anchor-list">
              <div>
                <dt>Reason</dt>
                <dd>{row.reason}</dd>
              </div>
              <div>
                <dt>Reason codes</dt>
                <dd>{row.reasonCodes.length ? row.reasonCodes.join(", ") : "None"}</dd>
              </div>
              <div>
                <dt>Policy guardrails</dt>
                <dd>{row.policyControls.length ? row.policyControls.join(", ") : "None"}</dd>
              </div>
            </dl>
          </section>

          <section className="policy-modal-section" aria-labelledby="specialty-business-policy-title">
            <div className="policy-event-section-heading">
              <div>
                <span className="eyebrow">Business policy</span>
                <h3 id="specialty-business-policy-title">Business Policy</h3>
              </div>
            </div>
            <dl className="policy-anchor-list">
              <div>
                <dt>Policy ID</dt>
                <dd>{row.policyId ?? "None"}</dd>
              </div>
              <div>
                <dt>Audit record</dt>
                <dd>{row.audit?.id ?? "None"}</dd>
              </div>
            </dl>
            <EvidenceRows
              emptyLabel="No business criteria recorded"
              rows={row.policyCriteria.map((criterion) => ({
                id: criterion.id,
                label: criterion.label,
                expected: criterion.expected,
                actual: criterion.actual,
                actualVariant: criterion.passed ? "success" : "warning"
              }))}
            />
          </section>

          <section className="policy-modal-section" aria-labelledby="specialty-payment-policy-title">
            <div className="policy-event-section-heading">
              <div>
                <span className="eyebrow">Payment policy</span>
                <h3 id="specialty-payment-policy-title">Payment Policy</h3>
              </div>
            </div>
            <dl className="policy-anchor-list">
              <div>
                <dt>Policy ID</dt>
                <dd>{row.paymentPolicyId ?? row.planId ?? "None"}</dd>
              </div>
              <div>
                <dt>Audit record</dt>
                <dd>{row.paymentIntentId ?? "None"}</dd>
              </div>
            </dl>
            <EvidenceRows
              emptyLabel="No payment controls recorded"
              rows={row.paymentPolicyControls.map((control) => ({
                id: control.id,
                label: control.label,
                expected: control.expected,
                actual: control.actual,
                actualVariant: controlStatusBadgeVariant(control.status)
              }))}
            />
          </section>
        </div>
    </LabsModal>
  );
}

function buildChecklistEvidenceRows(row: SpecialtyRxPlanAuditRow) {
  const caseRecord = row.fulfillmentCase as Partial<SpecialtyRxPlanAuditRow["fulfillmentCase"]>;
  const intake = caseRecord.intake;
  const clearToFill = caseRecord.clearToFill;
  const shipment = caseRecord.shipment;
  const fulfillment = caseRecord.fulfillment;

  return [
    checklistRow("approvedPaLinked", "Approved PA linked", intake?.approvedPaLinked),
    checklistRow("prescriptionPresent", "Prescription present", intake?.prescriptionPresent),
    checklistRow("assignedPharmacyConfirmed", "Assigned pharmacy confirmed", intake?.assignedPharmacyConfirmed),
    checklistRow("therapyMetadataPresent", "Therapy metadata present", intake?.therapyMetadataPresent),
    checklistRow("handoffDataComplete", "Handoff data complete", intake?.handoffDataComplete),
    checklistRow(
      "benefitsOrClaimCheckCompleted",
      "Benefits or claim readiness checked",
      clearToFill?.benefitsOrClaimCheckCompleted
    ),
    checklistRow("prescriptionValid", "Prescription valid", clearToFill?.prescriptionValid),
    checklistRow("prescriberClarificationResolved", "Prescriber clarification resolved", clearToFill?.prescriberClarificationResolved),
    checklistRow("remsAuthorizationConfirmed", "REMS authorization confirmed", clearToFill?.remsAuthorizationConfirmed),
    checklistRow("inventoryAvailable", "Inventory available", clearToFill?.inventoryAvailable),
    checklistRow("copayOrPaymentReady", "Copay or payment ready", clearToFill?.copayOrPaymentReady),
    checklistRow("patientContactAttemptDocumented", "Patient contact attempt documented", shipment?.patientContactAttemptDocumented),
    checklistRow("addressConfirmed", "Address confirmed", shipment?.addressConfirmed),
    checklistRow("deliveryWindowConfirmed", "Delivery window confirmed", shipment?.deliveryWindowConfirmed),
    checklistRow("coldChainPackoutValidated", "Cold-chain packout validated", shipment?.coldChainPackoutValidated),
    checklistRow("courierScheduled", "Courier scheduled", shipment?.courierScheduled),
    checklistRow("shipmentScheduledWithinSla", "Shipment scheduled within SLA", row.fulfillmentSlaStatus === "within_sla"),
    checklistRow("shipped", "Shipment recorded", fulfillment?.shipped),
    checklistRow("deliveryConfirmed", "Delivery confirmed", fulfillment?.deliveryConfirmed),
    checklistRow("deliveryAttemptDocumented", "Delivery attempt documented", fulfillment?.deliveryAttemptDocumented),
    checklistRow("temperatureLogValid", "Temperature log valid", fulfillment?.temperatureLogValid)
  ];
}

function checklistRow(id: string, label: string, value: boolean | undefined) {
  const verified = value === true;
  return {
    id,
    label,
    expected: "Yes",
    actual: formatYesNo(value),
    actualVariant: verified ? "success" as const : "warning" as const
  };
}

function formatYesNo(value: boolean | undefined): string {
  if (value === undefined) {
    return "Not recorded";
  }

  return value ? "Yes" : "No";
}

function formatFulfillmentSource(value: unknown): string {
  return value === "delegate_um_approved" ? "Approved delegate UM request" : "Not recorded";
}
