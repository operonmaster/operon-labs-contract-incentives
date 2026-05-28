"use client";

import type { IncentiveWorklistRow } from "../../lib/provider-documentation-workflow";
import { LabsBadge } from "../labs-ui";

interface PlanAuditDetailsModalProps {
  row: IncentiveWorklistRow;
  onClose: () => void;
}

export function PlanAuditDetailsModal({ row, onClose }: PlanAuditDetailsModalProps) {
  return (
    <div className="modal-backdrop audit-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-modal="true"
        className="modal plan-audit-modal policy-details-modal payment-policy-details-modal"
        role="dialog"
        aria-labelledby="plan-audit-title"
        onClick={(event) => event.stopPropagation()}
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
          <button className="row-action" type="button" onClick={onClose}>
            Close details
          </button>
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
      </section>
    </div>
  );
}

export function formatCurrency(row: IncentiveWorklistRow) {
  return `${row.incentiveValue.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })} ${row.settlementToken?.symbol ?? row.currency}`;
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

function controlStatusBadgeVariant(
  status: IncentiveWorklistRow["paymentPolicyControls"][number]["status"]
): "success" | "warning" {
  switch (status) {
    case "passed":
      return "success";
    case "failed":
    case "not_run":
      return "warning";
  }
}
