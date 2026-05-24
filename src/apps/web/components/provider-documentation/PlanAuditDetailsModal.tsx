"use client";

import type { IncentiveWorklistRow } from "../../lib/provider-documentation-workflow";

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
            <dt>PA result</dt>
            <dd>{formatPaResult(row.paResult)}</dd>
          </div>
          <div>
            <dt>Policy ID</dt>
            <dd className="mono-cell">{row.policyId}</dd>
          </div>
          <div>
            <dt>Policy outcome</dt>
            <dd>{formatStatus(row.incentiveStatus)}</dd>
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
            <dd className="mono-cell">{row.transactionId ?? "Not recorded"}</dd>
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
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {row.policyCriteria.map((criterion) => (
                  <tr key={criterion.id}>
                    <td>
                      <strong>{criterion.label}</strong>
                      <span>{criterion.reasonCode}</span>
                    </td>
                    <td>{criterion.expected}</td>
                    <td>{criterion.actual}</td>
                    <td>
                      <span className={`status ${criterion.passed ? "approved" : "blocked"}`}>
                        {criterion.passed ? "Passed" : "Failed"}
                      </span>
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
  })} ${row.currency}`;
}

export function formatStatus(status: IncentiveWorklistRow["incentiveStatus"]) {
  switch (status) {
    case "not_eligible":
      return "Blocked";
    case "paid":
      return "Paid";
    case "payment_failed":
      return "Paid";
  }
}

export function formatPaResult(paResult: IncentiveWorklistRow["paResult"]) {
  return paResult === "denied_not_covered" ? "Denied - not covered" : "Submitted / pending";
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

export function statusClass(status: IncentiveWorklistRow["incentiveStatus"]) {
  switch (status) {
    case "not_eligible":
      return "blocked";
    case "paid":
      return "approved";
    case "payment_failed":
      return "approved";
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
