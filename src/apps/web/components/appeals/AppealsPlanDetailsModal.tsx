"use client";

import type { AppealsPlanAuditRow } from "../../lib/appeals-workflow";
import { LabsBadge, LabsButton, LabsModal } from "../labs-ui";
import { EvidenceRows, controlStatusBadgeVariant, formatTransaction } from "../incentive-audit-evidence";
import {
  appealStateBadgeVariant,
  businessPolicyStatusBadgeVariant,
  formatAppealSource,
  formatAppealState,
  formatBusinessPolicyStatus,
  formatCurrency,
  formatNullableDateTime,
  formatPaymentPolicyStatus,
  formatPaymentStatus,
  formatRequestType,
  formatSlaStatus,
  formatYesNo,
  paymentPolicyStatusBadgeVariant,
  paymentStatusBadgeVariant,
  slaBadgeVariant
} from "./appeals-formatters";

interface AppealsPlanDetailsModalProps {
  row: AppealsPlanAuditRow;
  onClose: () => void;
}

export function AppealsPlanDetailsModal({ row, onClose }: AppealsPlanDetailsModalProps) {
  const appealCase = row.appealCase as Partial<AppealsPlanAuditRow["appealCase"]>;

  return (
    <LabsModal
      onClose={onClose}
      labelledBy="appeals-plan-audit-title"
      className="plan-audit-modal policy-details-modal payment-policy-details-modal appeals-policy-event-modal"
      backdropClassName="audit-modal-backdrop"
    >
      <div className="modal-toolbar">
        <div>
          <span className="eyebrow">Policy event</span>
          <h2 id="appeals-plan-audit-title">Appeal Packet Audit Details</h2>
          <dl className="policy-event-context-line">
            <div>
              <dt>Appeal ID</dt>
              <dd className="mono-cell">{row.appealId}</dd>
            </div>
            <div>
              <dt>Linked PA</dt>
              <dd className="mono-cell">{row.umRequestId}</dd>
            </div>
            <div>
              <dt>Submitter</dt>
              <dd>{row.submitterId}</dd>
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
          <dt>Settlement status</dt>
          <dd>
            <LabsBadge variant={paymentStatusBadgeVariant(row.paymentStatus)}>
              {formatPaymentStatus(row.paymentStatus)}
            </LabsBadge>
          </dd>
        </div>
        <div>
          <dt>Packet SLA</dt>
          <dd>
            <LabsBadge variant={slaBadgeVariant(row.packetReadinessSlaStatus)}>
              {formatSlaStatus(row.packetReadinessSlaStatus)}
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
        <section className="policy-modal-section" aria-labelledby="appeals-case-identity-title">
          <h3 id="appeals-case-identity-title">Case identity</h3>
          <dl className="policy-anchor-list">
            <div>
              <dt>Appeal ID</dt>
              <dd>{row.appealId}</dd>
            </div>
            <div>
              <dt>Plan</dt>
              <dd>{row.planId}</dd>
            </div>
            <div>
              <dt>Submitter</dt>
              <dd>{row.submitterId}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{formatAppealSource(appealCase.source)}</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>
                <LabsBadge variant={appealStateBadgeVariant(row.state)}>{formatAppealState(row.state)}</LabsBadge>
              </dd>
            </div>
          </dl>
        </section>

        <section className="policy-modal-section" aria-labelledby="appeals-linked-pa-title">
          <h3 id="appeals-linked-pa-title">Linked PA</h3>
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
            <div>
              <dt>Original outcome</dt>
              <dd>{appealCase.originalOutcomeStatus ?? "Denied"}</dd>
            </div>
            <div>
              <dt>Denial reason</dt>
              <dd>{appealCase.originalDenialReasonCode ?? "Not recorded"}</dd>
            </div>
          </dl>
        </section>

        <section className="policy-modal-section" aria-labelledby="appeals-sla-timestamps-title">
          <h3 id="appeals-sla-timestamps-title">SLA timestamps</h3>
          <dl className="policy-anchor-list">
            <div>
              <dt>Appeal received</dt>
              <dd>{formatNullableDateTime(row.appealReceivedAt)}</dd>
            </div>
            <div>
              <dt>Acknowledged</dt>
              <dd>{formatNullableDateTime(row.acknowledgedAt)}</dd>
            </div>
            <div>
              <dt>Packet ready</dt>
              <dd>{formatNullableDateTime(row.packetReadyAt)}</dd>
            </div>
            <div>
              <dt>Acknowledgement SLA</dt>
              <dd>
                <LabsBadge variant={slaBadgeVariant(row.acknowledgementSlaStatus)}>
                  {formatSlaStatus(row.acknowledgementSlaStatus)}
                </LabsBadge>
              </dd>
            </div>
            <div>
              <dt>Packet readiness SLA</dt>
              <dd>
                <LabsBadge variant={slaBadgeVariant(row.packetReadinessSlaStatus)}>
                  {formatSlaStatus(row.packetReadinessSlaStatus)}
                </LabsBadge>
              </dd>
            </div>
          </dl>
        </section>

        <section className="policy-modal-section" aria-labelledby="appeals-packet-checklist-title">
          <h3 id="appeals-packet-checklist-title">Packet checklist evidence</h3>
          <EvidenceRows emptyLabel="No appeal packet checklist evidence recorded" rows={buildChecklistEvidenceRows(row)} />
        </section>

        <section className="policy-modal-section" aria-labelledby="appeals-business-evidence-title">
          <h3 id="appeals-business-evidence-title">Packet evidence</h3>
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

        <section className="policy-modal-section" aria-labelledby="appeals-business-policy-title">
          <div className="policy-event-section-heading">
            <div>
              <span className="eyebrow">Business policy</span>
              <h3 id="appeals-business-policy-title">Business Policy</h3>
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

        <section className="policy-modal-section" aria-labelledby="appeals-payment-policy-title">
          <div className="policy-event-section-heading">
            <div>
              <span className="eyebrow">Payment policy</span>
              <h3 id="appeals-payment-policy-title">Payment Policy</h3>
            </div>
          </div>
          <dl className="policy-anchor-list">
            <div>
              <dt>Policy ID</dt>
              <dd>{row.paymentPolicyId ?? row.planId ?? "None"}</dd>
            </div>
            <div>
              <dt>Payment intent</dt>
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

function buildChecklistEvidenceRows(row: AppealsPlanAuditRow) {
  const appealCase = row.appealCase as Partial<AppealsPlanAuditRow["appealCase"]>;
  const intake = appealCase.intake;
  const originalDecision = appealCase.originalDecision;
  const missingInfo = appealCase.missingInfo;
  const packet = appealCase.packet;
  const routing = appealCase.routing;

  return [
    checklistRow("appealRequestPresent", "Appeal request present", intake?.appealRequestPresent),
    checklistRow("appellantAuthorized", "Appellant authorized", intake?.appellantAuthorized),
    checklistRow("planMemberMatched", "Plan member matched", intake?.planMemberMatched),
    checklistRow("requestedServiceMatched", "Requested service matched", intake?.requestedServiceMatched),
    checklistRow("denialReasonRetrieved", "Denial reason retrieved", originalDecision?.denialReasonRetrieved),
    checklistRow("priorDecisionSummaryIncluded", "Prior decision summary included", originalDecision?.priorDecisionSummaryIncluded),
    checklistRow("coveragePolicyLocated", "Coverage policy located", originalDecision?.coveragePolicyLocated),
    checklistRow("missingInfoResolved", "Missing info resolved", missingInfo?.missingInfoResolved),
    checklistRow("requiredDocumentsPresent", "Required documents present", packet?.requiredDocumentsPresent),
    checklistRow("clinicalRationaleIncluded", "Clinical rationale included", packet?.clinicalRationaleIncluded),
    checklistRow("policyCitationIncluded", "Policy citation included", packet?.policyCitationIncluded),
    checklistRow("evidenceIndexComplete", "Evidence index complete", packet?.evidenceIndexComplete),
    checklistRow("qualityAuditPassed", "Quality audit passed", packet?.qualityAuditPassed),
    checklistRow("noReworkRequired", "No rework required", packet?.noReworkRequired),
    checklistRow("packetReadyWithinSla", "Packet ready within SLA", row.packetReadinessSlaStatus === "within_sla"),
    checklistRow("reviewerQueueSelected", "Reviewer queue selected", routing?.reviewerQueueSelected),
    checklistRow("reviewerConflictCheckComplete", "Reviewer conflict check complete", routing?.reviewerConflictCheckComplete),
    checklistRow("finalDecisionOutsideIncentive", "Final appeal outcome excluded from incentive", routing?.finalDecisionOutsideIncentive)
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
