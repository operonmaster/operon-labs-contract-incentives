"use client";

import type { DelegatePlanAuditRow } from "../../lib/delegate-um-workflow";
import { LabsBadge, LabsButton, LabsModal } from "../labs-ui";
import { EvidenceRows, controlStatusBadgeVariant, formatTransaction } from "../incentive-audit-evidence";
import {
  businessPolicyStatusBadgeVariant,
  formatCurrency,
  formatBusinessPolicyStatus,
  formatPaymentStatus,
  paymentStatusBadgeVariant,
} from "./delegate-formatters";

interface DelegatePlanAuditDetailsModalProps {
  row: DelegatePlanAuditRow;
  onClose: () => void;
}

export function DelegatePlanAuditDetailsModal({ row, onClose }: DelegatePlanAuditDetailsModalProps) {
  return (
    <LabsModal
      onClose={onClose}
      labelledBy="delegate-plan-audit-title"
      className="plan-audit-modal policy-details-modal delegate-policy-event-modal payment-policy-details-modal"
      backdropClassName="audit-modal-backdrop"
    >
      <div className="modal-toolbar">
          <div>
            <span className="eyebrow">Policy event</span>
            <h2 id="delegate-plan-audit-title">Policy Event Audit Details</h2>
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
                <dt>Delegate vendor</dt>
                <dd className="mono-cell">{row.delegateVendorId}</dd>
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
              <LabsBadge variant={businessPolicyStatusBadgeVariant(row.businessPolicyStatus)}>
                {formatBusinessPolicyStatus(row.businessPolicyStatus)}
              </LabsBadge>
            </dd>
          </div>
          <div>
            <dt>Payment policy status</dt>
            <dd>
              <LabsBadge variant={paymentStatusBadgeVariant(row.paymentPolicyStatus)}>
                {formatPaymentStatus(row.paymentPolicyStatus)}
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
          <section className="policy-modal-section" aria-labelledby="delegate-business-policy-title">
            <div className="policy-event-section-heading">
              <div>
                <span className="eyebrow">Business policy</span>
                <h3 id="delegate-business-policy-title">Business Policy</h3>
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

          <section className="policy-modal-section" aria-labelledby="delegate-payment-policy-title">
            <div className="policy-event-section-heading">
              <div>
                <span className="eyebrow">Payment policy</span>
                <h3 id="delegate-payment-policy-title">Payment Policy</h3>
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
