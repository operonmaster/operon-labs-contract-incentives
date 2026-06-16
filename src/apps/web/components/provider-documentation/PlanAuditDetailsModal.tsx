"use client";

import type { IncentiveWorklistRow } from "../../lib/provider-documentation-workflow";
import { LabsBadge, LabsButton, LabsModal } from "../labs-ui";
import { EvidenceRows, controlStatusBadgeVariant, formatTransaction } from "../incentive-audit-evidence";

interface PlanAuditDetailsModalProps {
  row: IncentiveWorklistRow;
  onClose: () => void;
}

export function PlanAuditDetailsModal({ row, onClose }: PlanAuditDetailsModalProps) {
  return (
    <LabsModal
      onClose={onClose}
      labelledBy="plan-audit-title"
      className="plan-audit-modal policy-details-modal payment-policy-details-modal"
      backdropClassName="audit-modal-backdrop"
    >
      <div className="modal-toolbar">
          <div>
            <span className="eyebrow">Policy event</span>
            <h2 id="plan-audit-title">Policy Event Audit Details</h2>
            <dl className="policy-event-context-line">
              <div>
                <dt>UM request ID</dt>
                <dd className="mono-cell">{row.umRequestId}</dd>
              </div>
              <div>
                <dt>Plan</dt>
                <dd>{row.planDisplay || row.planId}</dd>
              </div>
              <div>
                <dt>Provider group</dt>
                <dd>{row.providerGroupDisplay}</dd>
              </div>
              <div>
                <dt>Requested item</dt>
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
              <LabsBadge variant={businessPolicyBadgeVariant(row)}>
                {formatStatus(row)}
              </LabsBadge>
            </dd>
          </div>
          <div>
            <dt>Payment policy status</dt>
            <dd>
              <LabsBadge variant={paymentPolicyBadgeVariant(row)}>
                {formatPaymentStatus(row)}
              </LabsBadge>
            </dd>
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
          <section className="policy-modal-section" aria-labelledby="provider-business-policy-title">
            <div className="policy-event-section-heading">
              <div>
                <span className="eyebrow">Business policy</span>
                <h3 id="provider-business-policy-title">Business Policy</h3>
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

          <section className="policy-modal-section" aria-labelledby="provider-payment-policy-title">
            <div className="policy-event-section-heading">
              <div>
                <span className="eyebrow">Payment policy</span>
                <h3 id="provider-payment-policy-title">Payment Policy</h3>
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

export function formatCurrency(row: IncentiveWorklistRow) {
  const amount = typeof row.incentiveValue === "number" ? row.incentiveValue : 0;
  return `${amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })} ${row.settlementToken?.symbol ?? row.currency}`;
}

export function formatStatus(row: IncentiveWorklistRow) {
  switch (row.businessPolicyStatus) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return "Pending";
  }
}
export function businessPolicyBadgeVariant(row: IncentiveWorklistRow): "success" | "warning" | "neutral" {
  switch (row.businessPolicyStatus) {
    case "approved":
      return "success";
    case "rejected":
      return "warning";
    default:
      return "neutral";
  }
}

export function formatPaymentStatus(row: IncentiveWorklistRow) {
  switch (row.paymentPolicyStatus) {
    case "paid":
      return "Paid";
    case "blocked":
      return "Blocked";
    default:
      return "Pending";
  }
}

export function formatRequestType(requestType: IncentiveWorklistRow["requestType"]) {
  switch (requestType) {
    case "outpatient_service":
      return "Outpatient Service";
    case "pharmacy_benefit":
      return "Pharmacy Benefit";
    case "inpatient_admission":
      return "Inpatient Admission";
    default:
      return "Unknown request type";
  }
}

export function paymentPolicyBadgeVariant(row: IncentiveWorklistRow): "success" | "warning" | "neutral" {
  switch (row.paymentPolicyStatus) {
    case "paid":
      return "success";
    case "blocked":
      return "warning";
    default:
      return "neutral";
  }
}
