"use client";

import Link from "next/link";
import { useState } from "react";
import type { SpecialtyRxPlanAuditRow } from "../../lib/specialty-rx-workflow";
import { LabsBadge, LabsButton, LabsHero, LabsPageShell } from "../labs-ui";
import { SpecialtyRxUseCaseNavigation } from "./SpecialtyRxUseCaseNavigation";
import { SpecialtyRxPlanDetailsModal } from "./SpecialtyRxPlanDetailsModal";
import {
  businessPolicyStatusBadgeVariant,
  formatBusinessPolicyStatus,
  formatFulfillmentCaseState,
  formatPaymentPolicyStatus,
  formatSlaStatus,
  fulfillmentStateBadgeVariant,
  paymentPolicyStatusBadgeVariant,
  specialtySlaBadgeVariant
} from "./specialty-rx-formatters";
import { useIncentiveWorklist } from "../use-incentive-worklist";

export function formatBusinessPolicyTableStatus(status: SpecialtyRxPlanAuditRow["businessPolicyStatus"]): string | null {
  return status === null ? null : formatBusinessPolicyStatus(status);
}

export function formatPaymentPolicyTableStatus(status: SpecialtyRxPlanAuditRow["paymentPolicyStatus"]): string | null {
  return status === null ? null : formatPaymentPolicyStatus(status);
}

export function canViewSpecialtyRxPlanDetails({
  businessPolicyStatus,
  paymentPolicyStatus
}: Pick<SpecialtyRxPlanAuditRow, "businessPolicyStatus" | "paymentPolicyStatus">): boolean {
  return businessPolicyStatus !== null && paymentPolicyStatus !== null;
}

export function SpecialtyRxPlanConsole() {
  const [detailsFulfillmentCaseId, setDetailsFulfillmentCaseId] = useState<string | null>(null);
  const {
    rows,
    selectedId: selectedFulfillmentCaseId,
    setSelectedId: setSelectedFulfillmentCaseId,
    initialLoading,
    refreshing,
    error,
    refresh: refreshRows
  } = useIncentiveWorklist<SpecialtyRxPlanAuditRow>({
    endpoint: "/api/specialty-rx/plan",
    getRowId: (row) => row.fulfillmentCaseId,
    errorMessage: "Unable to load specialty fulfillment plan rows"
  });

  const detailsRow = rows.find((row) => row.fulfillmentCaseId === detailsFulfillmentCaseId) ?? null;

  return (
    <LabsPageShell className="workspace specialty-rx-console specialty-rx-plan-console">
      <div className="top-nav-row">
        <Link className="back" href="/">
          Back to demos
        </Link>
        <SpecialtyRxUseCaseNavigation activeView="plan" />
      </div>

      <LabsHero compact eyebrow="Health plan specialty fulfillment audit" title="Specialty fulfillment SLA events">
        <p>Track post-approval specialty fulfillment milestones, SLA outcomes, and policy-bound settlement results.</p>
      </LabsHero>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>Specialty fulfillment policy log</h2>
            <p>{rows.length === 1 ? "1 specialty fulfillment event loaded" : `${rows.length} specialty fulfillment events loaded`}</p>
          </div>
          <LabsButton variant="secondary" disabled={refreshing} onClick={() => void refreshRows("manual")}>
            {refreshing ? "Refreshing..." : "Refresh plan view"}
          </LabsButton>
        </div>

        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}

        <div className="table-wrap">
          <table className="worklist specialty-rx-plan-worklist">
            <thead>
              <tr>
                <th>Fulfillment case ID</th>
                <th>Pharmacy</th>
                <th>State</th>
                <th className="badge-cell">Fulfillment SLA</th>
                <th className="badge-cell">Business Policy</th>
                <th className="badge-cell">Payment Policy</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {initialLoading ? (
                <tr className="loading-row">
                  <td colSpan={7}>
                    <div className="loading-indicator" role="status" aria-live="polite">
                      <span className="loading-dot" aria-hidden="true" />
                      <span>Loading specialty fulfillment plan audit rows</span>
                    </div>
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr
                  key={row.fulfillmentCaseId}
                  className={row.fulfillmentCaseId === selectedFulfillmentCaseId ? "selected" : ""}
                >
                  <td className="mono-cell">{row.fulfillmentCaseId}</td>
                  <td>{row.pharmacyDisplay}</td>
                  <td className="badge-cell">
                    <LabsBadge variant={fulfillmentStateBadgeVariant(row.state)}>
                      {formatFulfillmentCaseState(row)}
                    </LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={specialtySlaBadgeVariant(row.fulfillmentSlaStatus)}>
                      {formatSlaStatus(row.fulfillmentSlaStatus)}
                    </LabsBadge>
                  </td>
                  <BusinessPolicyStatusCell status={row.businessPolicyStatus} />
                  <PaymentPolicyStatusCell status={row.paymentPolicyStatus} />
                  <td>
                    {canViewSpecialtyRxPlanDetails(row) ? (
                      <LabsButton
                        variant="row"
                        onClick={() => {
                          setSelectedFulfillmentCaseId(row.fulfillmentCaseId);
                          setDetailsFulfillmentCaseId(row.fulfillmentCaseId);
                        }}
                      >
                        View details
                      </LabsButton>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!initialLoading && rows.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={7}>
                    No specialty fulfillment events have been submitted to the plan audit log.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {detailsRow ? <SpecialtyRxPlanDetailsModal row={detailsRow} onClose={() => setDetailsFulfillmentCaseId(null)} /> : null}
    </LabsPageShell>
  );
}

function BusinessPolicyStatusCell({ status }: { status: SpecialtyRxPlanAuditRow["businessPolicyStatus"] }) {
  const label = formatBusinessPolicyTableStatus(status);

  return (
    <td className="badge-cell">
      {label ? <LabsBadge variant={businessPolicyStatusBadgeVariant(status)}>{label}</LabsBadge> : null}
    </td>
  );
}

function PaymentPolicyStatusCell({ status }: { status: SpecialtyRxPlanAuditRow["paymentPolicyStatus"] }) {
  const label = formatPaymentPolicyTableStatus(status);

  return (
    <td className="badge-cell">
      {label ? <LabsBadge variant={paymentPolicyStatusBadgeVariant(status)}>{label}</LabsBadge> : null}
    </td>
  );
}
