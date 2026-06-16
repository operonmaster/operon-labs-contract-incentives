"use client";

import type { SpecialtyRxPlanAuditRow } from "../../lib/specialty-rx-workflow";
import { EvidenceRows, controlStatusBadgeVariant, formatTransaction } from "../incentive-audit-evidence";
import { LabsBadge, LabsButton, LabsModal } from "../labs-ui";
import {
  businessPolicyStatusBadgeVariant,
  formatBusinessPolicyStatus,
  formatCurrency,
  formatPaymentPolicyStatus,
  paymentPolicyStatusBadgeVariant
} from "./specialty-rx-formatters";

interface SpecialtyRxPlanDetailsModalProps {
  row: SpecialtyRxPlanAuditRow;
  onClose: () => void;
}

export function SpecialtyRxPlanDetailsModal({ row, onClose }: SpecialtyRxPlanDetailsModalProps) {
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
          <h2 id="specialty-rx-plan-audit-title">Policy Event Audit Details</h2>
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
              <dt>Plan</dt>
              <dd>{row.planId}</dd>
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
