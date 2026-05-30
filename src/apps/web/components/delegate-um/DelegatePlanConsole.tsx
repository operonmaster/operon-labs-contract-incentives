"use client";

import Link from "next/link";
import { useState } from "react";
import type { DelegatePlanAuditRow } from "../../lib/delegate-um-workflow";
import { LabsBadge, LabsButton, LabsHero, LabsPageShell } from "../labs-ui";
import { DelegatePlanAuditDetailsModal } from "./DelegatePlanAuditDetailsModal";
import { DelegateUseCaseNavigation } from "./DelegateUseCaseNavigation";
import {
  businessPolicyStatusBadgeVariant,
  formatBusinessPolicyStatus,
  formatOutcomeStatus,
  formatPaymentStatus,
  formatRequestType,
  formatSlaStatus,
  paymentStatusBadgeVariant
} from "./delegate-formatters";
import { useIncentiveWorklist } from "../use-incentive-worklist";

export function DelegatePlanConsole({ initialUmRequestId = null }: { initialUmRequestId?: string | null }) {
  const requestedUmRequestId = initialUmRequestId;
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
    errorMessage: "Unable to load delegate plan rows",
    requestedId: requestedUmRequestId
  });

  const detailsRow = rows.find((row) => row.umRequestId === detailsUmRequestId) ?? null;

  return (
    <LabsPageShell className="workspace delegate-console delegate-plan-console">
      <div className="top-nav-row">
        <Link className="back" href="/">
          Back to demos
        </Link>
        <DelegateUseCaseNavigation activeView="plan" umRequestId={selectedUmRequestId ?? requestedUmRequestId} />
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
                <th>Request type</th>
                <th>Outcome status</th>
                <th className="badge-cell">SLA</th>
                <th className="badge-cell">Business Policy</th>
                <th className="badge-cell">Payment Policy</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {initialLoading ? (
                <tr className="loading-row">
                  <td colSpan={8}>
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
                  <td>{row.delegateVendorId}</td>
                  <td>{formatRequestType(row.requestType)}</td>
                  <td>{formatOutcomeStatus(row.outcomeStatus)}</td>
                  <td className="badge-cell">
                    <LabsBadge variant={row.slaStatus === "breached" ? "warning" : "info"}>{formatSlaStatus(row)}</LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={businessPolicyStatusBadgeVariant(row.businessPolicyStatus)}>
                      {formatBusinessPolicyStatus(row.businessPolicyStatus)}
                    </LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={paymentStatusBadgeVariant(row.paymentPolicyStatus)}>
                      {formatPaymentStatus(row.paymentPolicyStatus)}
                    </LabsBadge>
                  </td>
                  <td>
                    <LabsButton
                      variant="row"
                      onClick={() => {
                        setSelectedUmRequestId(row.umRequestId);
                        setDetailsUmRequestId(row.umRequestId);
                      }}
                    >
                      View details
                    </LabsButton>
                  </td>
                </tr>
              ))}
              {!initialLoading && rows.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={8}>
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
