"use client";

import type { DelegatePlanAuditRow } from "../../lib/delegate-um-workflow";
import { LabsBadge } from "../labs-ui";
import {
  formatCurrency,
  formatOutcomeStatus,
  formatPaymentStatus,
  formatRequestType,
  formatSlaStatus,
  formatUmState,
  paymentStatusBadgeVariant
} from "./delegate-formatters";

interface DelegatePlanAuditDetailsModalProps {
  row: DelegatePlanAuditRow;
  onClose: () => void;
}

export function DelegatePlanAuditDetailsModal({ row, onClose }: DelegatePlanAuditDetailsModalProps) {
  return (
    <div className="modal-backdrop audit-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-modal="true"
        className="modal plan-audit-modal policy-details-modal delegate-policy-event-modal payment-policy-details-modal"
        role="dialog"
        aria-labelledby="delegate-plan-audit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-toolbar">
          <div>
            <span className="eyebrow">Policy event</span>
            <h2 id="delegate-plan-audit-title">Delegate UM SLA policy audit</h2>
            <p>{row.umRequestId}</p>
          </div>
          <button className="row-action" type="button" onClick={onClose}>
            Close details
          </button>
        </div>

        <dl className="detail-grid plan-audit-grid policy-event-summary-grid">
          <div>
            <dt>Final outcome</dt>
            <dd>{formatFinalOutcome(row)}</dd>
          </div>
          <div>
            <dt>UM request ID</dt>
            <dd className="mono-cell">{row.umRequestId}</dd>
          </div>
          <div>
            <dt>Health plan</dt>
            <dd>{row.planDisplay || row.planId}</dd>
          </div>
          <div>
            <dt>Delegate vendor</dt>
            <dd className="mono-cell">{row.delegateVendorId}</dd>
          </div>
          <div>
            <dt>Requested item</dt>
            <dd>{row.serviceLabel}</dd>
          </div>
          <div>
            <dt>Outcome status</dt>
            <dd>{formatOutcomeStatus(row.outcomeStatus)}</dd>
          </div>
          <div>
            <dt>SLA</dt>
            <dd>{formatSlaStatus(row)}</dd>
          </div>
          <div>
            <dt>Incentive value</dt>
            <dd>{formatCurrency(row)}</dd>
          </div>
        </dl>

        <div className="policy-modal-sections payment-policy-modal-sections">
          <section className="policy-modal-section" aria-labelledby="delegate-business-policy-title">
            <div className="policy-event-section-heading">
              <div>
                <span className="eyebrow">Business policy</span>
                <h3 id="delegate-business-policy-title">Delegate SLA bonus decision</h3>
              </div>
              <LabsBadge variant={businessPolicyBadgeVariant(row)}>{formatBusinessPolicyResult(row)}</LabsBadge>
            </div>

            <dl className="detail-grid policy-detail-grid">
              <div>
                <dt>Event</dt>
                <dd>{row.state === "determined" ? "UM_REQUEST_DETERMINED" : "Pending determination"}</dd>
              </div>
              <div>
                <dt>Evidence source</dt>
                <dd>UMRequest workflow object</dd>
              </div>
              <div>
                <dt>Business policy ID</dt>
                <dd className="mono-cell">{row.policyId ?? "Pending determination"}</dd>
              </div>
              <div>
                <dt>UM status</dt>
                <dd>{formatUmState(row.state)}</dd>
              </div>
              <div>
                <dt>Request type</dt>
                <dd>{formatRequestType(row.requestType)}</dd>
              </div>
              <div>
                <dt>Audit ID</dt>
                <dd className="mono-cell">{row.audit?.id ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Reason codes</dt>
                <dd>{row.reasonCodes.length > 0 ? row.reasonCodes.join(", ") : "None"}</dd>
              </div>
              <div>
                <dt>Policy guardrails</dt>
                <dd>{row.policyControls.length > 0 ? row.policyControls.join("; ") : "Pending determination"}</dd>
              </div>
            </dl>

            <details className="policy-criteria-toggle">
              <summary>Show business policy criteria</summary>
              {row.policyCriteria.length > 0 ? (
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
              ) : (
                <p className="empty-state">Submit a determination to run the delegate SLA policy criteria.</p>
              )}
            </details>
          </section>

          <section className="policy-modal-section" aria-labelledby="delegate-payment-policy-title">
            <div className="policy-event-section-heading">
              <div>
                <span className="eyebrow">Payment policy</span>
                <h3 id="delegate-payment-policy-title">Hedera settlement outcome</h3>
              </div>
              <LabsBadge variant={paymentPolicyBadgeVariant(row)}>{formatPaymentPolicyResult(row)}</LabsBadge>
            </div>

            <p className={`action-status ${row.paymentStatus === "execution_failed" ? "warning-copy" : ""}`}>
              {formatPaymentPolicyMessage(row)}
            </p>

            <dl className="detail-grid policy-detail-grid">
              <div>
                <dt>Payment status</dt>
                <dd>
                  <LabsBadge variant={paymentStatusBadgeVariant(row.paymentStatus)}>
                    {formatPaymentStatus(row.paymentStatus)}
                  </LabsBadge>
                </dd>
              </div>
              <div>
                <dt>Requested payment</dt>
                <dd>{formatCurrency(row)}</dd>
              </div>
              <div>
                <dt>Recipient wallet</dt>
                <dd className="mono-cell">{row.walletId ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Payment intent</dt>
                <dd className="mono-cell">{row.paymentIntentId ?? "Not recorded"}</dd>
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
                <dt>Settlement reason</dt>
                <dd>{row.reason}</dd>
              </div>
              <div>
                <dt>Runtime evidence</dt>
                <dd>{formatPaymentRuntimeEvidence(row)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </section>
    </div>
  );
}

export function formatFinalOutcome(row: DelegatePlanAuditRow) {
  if (row.incentiveStatus === "paid" && row.paymentStatus === "auto_executed") {
    return "Business policy passed, payment settled";
  }

  if (row.incentiveStatus === "payment_failed" || row.paymentStatus === "execution_failed") {
    return "Business policy passed, payment failed";
  }

  if (row.incentiveStatus === "not_eligible") {
    return "Business policy failed, payment not run";
  }

  return "Pending determination";
}

function formatBusinessPolicyResult(row: DelegatePlanAuditRow) {
  if (row.incentiveStatus === "paid" || row.incentiveStatus === "payment_failed") {
    return "Passed";
  }

  if (row.incentiveStatus === "not_eligible") {
    return "Failed";
  }

  return "Pending";
}

function businessPolicyBadgeVariant(row: DelegatePlanAuditRow): "success" | "warning" | "neutral" {
  if (row.incentiveStatus === "paid" || row.incentiveStatus === "payment_failed") {
    return "success";
  }

  if (row.incentiveStatus === "not_eligible") {
    return "warning";
  }

  return "neutral";
}

function formatPaymentPolicyResult(row: DelegatePlanAuditRow) {
  if (row.incentiveStatus === "not_eligible") {
    return "Not run";
  }

  if (row.paymentStatus === "auto_executed") {
    return "Paid";
  }

  if (row.paymentStatus === "execution_failed") {
    return "Failed";
  }

  if (row.paymentStatus === "blocked_by_policy") {
    return "Blocked";
  }

  return "Pending";
}

function paymentPolicyBadgeVariant(row: DelegatePlanAuditRow): "success" | "warning" | "neutral" {
  const result = formatPaymentPolicyResult(row);

  if (result === "Paid") {
    return "success";
  }

  if (result === "Blocked" || result === "Failed") {
    return "warning";
  }

  return "neutral";
}

function formatPaymentPolicyMessage(row: DelegatePlanAuditRow) {
  if (row.paymentStatus === "execution_failed") {
    return "Payment execution failed after the business policy approved the incentive.";
  }

  if (row.paymentStatus === "auto_executed") {
    return "Payment policy settled the approved incentive.";
  }

  if (row.paymentStatus === "blocked_by_policy") {
    return "Payment was not attempted because the business policy did not approve an incentive.";
  }

  return "Payment policy has not run yet.";
}

function formatPaymentRuntimeEvidence(row: DelegatePlanAuditRow) {
  if (row.paymentIntentId || row.transactionId) {
    return "Payment runtime recorded intent or transaction metadata.";
  }

  return "Payment policy runtime details were not captured for this event.";
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
