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
        className="modal plan-audit-modal"
        role="dialog"
        aria-labelledby="plan-audit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-toolbar">
          <div>
            <span className="eyebrow">Policy event</span>
            <h2 id="plan-audit-title">PA preview and policy audit</h2>
            <p>{row.caseId}</p>
          </div>
          <button className="row-action" type="button" onClick={onClose}>
            Close details
          </button>
        </div>

        <dl className="detail-grid plan-audit-grid">
          <div>
            <dt>Event</dt>
            <dd>PAS_SUBMITTED</dd>
          </div>
          <div>
            <dt>Evidence source</dt>
            <dd>UM Platform API</dd>
          </div>
          <div>
            <dt>Request type</dt>
            <dd>{formatRequestType(row.requestType)}</dd>
          </div>
          <div>
            <dt>Requested item</dt>
            <dd>{row.serviceLabel}</dd>
          </div>
          <div>
            <dt>UM status</dt>
            <dd>{formatUmStatus(row)}</dd>
          </div>
          <div>
            <dt>Business policy ID</dt>
            <dd className="mono-cell">{row.policyId}</dd>
          </div>
          <div>
            <dt>Business policy</dt>
            <dd>
              <LabsBadge variant={businessPolicyBadgeVariant(row.incentiveStatus)}>
                {formatStatus(row.incentiveStatus)}
              </LabsBadge>
            </dd>
          </div>
          <div>
            <dt>Payment status</dt>
            <dd>{formatPaymentStatus(row)}</dd>
          </div>
          <div>
            <dt>Incentive value</dt>
            <dd>{formatCurrency(row)}</dd>
          </div>
          <div>
            <dt>Audit ID</dt>
            <dd className="mono-cell">{row.audit.id}</dd>
          </div>
          <div>
            <dt>Payment intent</dt>
            <dd className="mono-cell">{row.paymentIntentId ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Reason codes</dt>
            <dd>{row.reasonCodes.length > 0 ? row.reasonCodes.join(", ") : "None"}</dd>
          </div>
          <div>
            <dt>Wallet</dt>
            <dd className="mono-cell">{row.walletId ?? "Not assigned"}</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>Hedera testnet</dd>
          </div>
          <div>
            <dt>Transaction</dt>
            <dd className="mono-cell">{formatTransaction(row.transactionId)}</dd>
          </div>
          <div>
            <dt>Policy guardrails</dt>
            <dd>{row.policyControls.join("; ")}</dd>
          </div>
        </dl>

        <details className="policy-criteria-toggle">
          <summary>Show policy criteria</summary>
          <div className="policy-criteria-table-wrap">
            <table className="policy-criteria-table">
              <thead>
                <tr>
                  <th>Criterion</th>
                  <th>Expected</th>
                  <th>Evidence value</th>
                  <th className="badge-cell">Result</th>
                </tr>
              </thead>
              <tbody>
                {row.policyCriteria.map((criterion) => (
                  <tr key={criterion.id}>
                    <td>
                      <strong>{criterion.label}</strong>
                      <span className="criterion-reason-code">{criterion.reasonCode}</span>
                    </td>
                    <td>{criterion.expected}</td>
                    <td>{criterion.actual}</td>
                    <td className="badge-cell">
                      <LabsBadge variant={criterion.passed ? "success" : "warning"}>
                        {criterion.passed ? "Passed" : "Failed"}
                      </LabsBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
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

export function formatStatus(status: IncentiveWorklistRow["incentiveStatus"]) {
  switch (status) {
    case "not_eligible":
      return "Rejected";
    case "paid":
      return "Approved";
    case "payment_failed":
      return "Rejected";
  }
}

export function formatUmStatus(row: IncentiveWorklistRow) {
  if (row.outcomeStatus) {
    return `Determined - ${row.outcomeStatus === "approved" ? "Approved" : "Denied"}`;
  }

  switch (row.state) {
    case "pend":
      return "Pended";
    case "in_clinical_review":
      return "In clinical review";
    case "determined":
      return "Determined";
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

export function businessPolicyBadgeVariant(status: IncentiveWorklistRow["incentiveStatus"]): "success" | "warning" {
  switch (status) {
    case "not_eligible":
      return "warning";
    case "paid":
      return "success";
    case "payment_failed":
      return "warning";
  }
}

export function formatPaymentStatus(row: IncentiveWorklistRow) {
  switch (row.paymentStatus) {
    case "auto_executed":
      return "Auto-settled";
    case "blocked_by_policy":
      return "No transaction";
    case "execution_failed":
      return "Execution failed";
  }
}
