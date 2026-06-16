"use client";

import Link from "next/link";
import { useState } from "react";
import type { DelegatePlanAuditRow } from "../../lib/delegate-um-workflow";
import { LabsBadge, LabsButton, LabsHero, LabsPageShell } from "../labs-ui";
import { DelegatePlanAuditDetailsModal } from "./DelegatePlanAuditDetailsModal";
import { DelegateUseCaseNavigation } from "./DelegateUseCaseNavigation";
import {
  businessPolicyStatusBadgeVariant,
  formatDelegateVendorDisplay,
  formatBusinessPolicyStatus,
  formatOutcomeStatus,
  formatPaymentStatus,
  formatSlaStatus,
  outcomeStatusBadgeVariant,
  paymentStatusBadgeVariant
} from "./delegate-formatters";
import { useIncentiveWorklist } from "../use-incentive-worklist";

export function formatDelegateBusinessPolicyTableStatus(status: DelegatePlanAuditRow["businessPolicyStatus"]): string | null {
  return status === null ? null : formatBusinessPolicyStatus(status);
}

export function formatDelegatePaymentPolicyTableStatus(status: DelegatePlanAuditRow["paymentPolicyStatus"]): string | null {
  return status === null ? null : formatPaymentStatus(status);
}

export function canViewDelegatePlanDetails({
  businessPolicyStatus,
  paymentPolicyStatus
}: Pick<DelegatePlanAuditRow, "businessPolicyStatus" | "paymentPolicyStatus">): boolean {
  return businessPolicyStatus !== null && paymentPolicyStatus !== null;
}

export function DelegatePlanConsole() {
  const [detailsUmRequestId, setDetailsUmRequestId] = useState<string | null>(null);
  const {
    rows,
    selectedId: selectedUmRequestId,
    setSelectedId: setSelectedUmRequestId,
    initialLoading,
    refreshing,
    error,
    refresh: refreshRows
  } = useIncentiveWorklist<DelegatePlanAuditRow>({
    endpoint: "/api/delegate-um/plan",
    getRowId: (row) => row.umRequestId,
    errorMessage: "Unable to load delegate plan rows"
  });

  const detailsRow = rows.find((row) => row.umRequestId === detailsUmRequestId) ?? null;

  return (
    <LabsPageShell className="workspace delegate-console delegate-plan-console">
      <div className="top-nav-row">
        <Link className="back" href="/">
          Back to demos
        </Link>
        <DelegateUseCaseNavigation activeView="plan" />
      </div>

      <LabsHero compact eyebrow="Health plan delegate audit" title="Delegate UM determinations">
        <p>Track pharmacy benefit delegate reviews, SLA status, outcome status, and policy-bound settlement results.</p>
      </LabsHero>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>Delegate determination log</h2>
            <p>{rows.length === 1 ? "1 delegated request loaded" : `${rows.length} delegated requests loaded`}</p>
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
          <table className="worklist delegate-plan-worklist">
            <thead>
              <tr>
                <th>UM request ID</th>
                <th>Vendor</th>
                <th className="badge-cell">Outcome status</th>
                <th className="badge-cell">SLA</th>
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
                      <span>Loading delegate plan audit rows</span>
                    </div>
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.umRequestId} className={row.umRequestId === selectedUmRequestId ? "selected" : ""}>
                  <td className="mono-cell">{row.umRequestId}</td>
                  <td>{formatDelegateVendorDisplay(row.delegateVendorId)}</td>
                  <td className="badge-cell">
                    <LabsBadge variant={outcomeStatusBadgeVariant(row.outcomeStatus)}>
                      {formatOutcomeStatus(row.outcomeStatus)}
                    </LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={row.slaStatus === "breached" ? "warning" : "info"}>{formatSlaStatus(row)}</LabsBadge>
                  </td>
                  <BusinessPolicyStatusCell status={row.businessPolicyStatus} />
                  <PaymentPolicyStatusCell status={row.paymentPolicyStatus} />
                  <td>
                    {canViewDelegatePlanDetails(row) ? (
                      <LabsButton
                        variant="row"
                        onClick={() => {
                          setSelectedUmRequestId(row.umRequestId);
                          setDetailsUmRequestId(row.umRequestId);
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
                    No delegated pharmacy prior authorizations have been submitted to the plan audit log.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {detailsRow ? <DelegatePlanAuditDetailsModal row={detailsRow} onClose={() => setDetailsUmRequestId(null)} /> : null}
    </LabsPageShell>
  );
}

function BusinessPolicyStatusCell({ status }: { status: DelegatePlanAuditRow["businessPolicyStatus"] }) {
  const label = formatDelegateBusinessPolicyTableStatus(status);

  return (
    <td className="badge-cell">
      {label ? <LabsBadge variant={businessPolicyStatusBadgeVariant(status)}>{label}</LabsBadge> : null}
    </td>
  );
}

function PaymentPolicyStatusCell({ status }: { status: DelegatePlanAuditRow["paymentPolicyStatus"] }) {
  const label = formatDelegatePaymentPolicyTableStatus(status);

  return (
    <td className="badge-cell">
      {label ? <LabsBadge variant={paymentStatusBadgeVariant(status)}>{label}</LabsBadge> : null}
    </td>
  );
}
