"use client";

import type { PaymentPolicyControlEvidence } from "../../lib/payment-policy-evidence-store";
import type { SpecialtyRxPlanAuditRow } from "../../lib/specialty-rx-workflow";
import { LabsBadge } from "../labs-ui";
import {
  businessPolicyStatusBadgeVariant,
  formatBusinessPolicyStatus,
  formatCurrency,
  formatFulfillmentState,
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
    <div className="modal-backdrop audit-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-modal="true"
        aria-labelledby="specialty-rx-plan-audit-title"
        className="modal plan-audit-modal policy-details-modal payment-policy-details-modal specialty-rx-policy-event-modal"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
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
          <button className="row-action" type="button" onClick={onClose}>
            Close details
          </button>
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
                    {formatFulfillmentState(row.state)}
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

          <section className="policy-modal-section" aria-labelledby="specialty-fulfillment-timestamps-title">
            <h3 id="specialty-fulfillment-timestamps-title">Fulfillment timestamps</h3>
            <dl className="policy-anchor-list">
              <div>
                <dt>PA approved</dt>
                <dd>{formatNullableDateTime(fulfillmentCase.paApprovalReceivedAt ?? null)}</dd>
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
      </section>
    </div>
  );
}

interface EvidenceDisplayRow {
  id: string;
  label: string;
  expected?: string;
  actual?: string;
  actualVariant: "success" | "warning";
}

function EvidenceRows({
  rows,
  emptyLabel
}: {
  rows: EvidenceDisplayRow[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <div className="policy-criteria-table-wrap">
      <table className="policy-criteria-table policy-audit-evidence-table">
        <colgroup>
          <col />
          <col className="policy-audit-evidence-actual-column" />
        </colgroup>
        <thead>
          <tr>
            <th>Criterion/Control</th>
            <th className="badge-cell">Actual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.label}</strong>
                {hasEvidenceValue(row.expected) ? (
                  <span className="criterion-reason-code">Expected: {row.expected?.trim()}</span>
                ) : null}
              </td>
              <td className="badge-cell">
                <LabsBadge variant={row.actualVariant}>{formatActualValue(row)}</LabsBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function hasEvidenceValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function formatActualValue(row: EvidenceDisplayRow) {
  if (row.actual?.trim()) {
    return row.actual;
  }

  return row.actualVariant === "success" ? "Verified" : "Not verified";
}

function controlStatusBadgeVariant(status: PaymentPolicyControlEvidence["status"]): "success" | "warning" {
  switch (status) {
    case "passed":
      return "success";
    case "failed":
    case "not_run":
      return "warning";
  }
}

export function formatTransaction(transactionId: string | null) {
  if (!transactionId) {
    return "Not recorded";
  }

  if (transactionId.startsWith("testnet-")) {
    return transactionId;
  }

  return (
    <a
      className="transaction-link"
      href={`https://hashscan.io/testnet/transaction/${encodeURIComponent(transactionId)}`}
      target="_blank"
      rel="noreferrer"
    >
      {transactionId}
    </a>
  );
}
