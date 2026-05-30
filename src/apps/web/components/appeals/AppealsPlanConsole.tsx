"use client";

import Link from "next/link";
import { useState } from "react";
import type { AppealsPlanAuditRow } from "../../lib/appeals-workflow";
import { LabsBadge, LabsButton, LabsHero, LabsPageShell } from "../labs-ui";
import { useIncentiveWorklist } from "../use-incentive-worklist";
import { AppealsPlanDetailsModal } from "./AppealsPlanDetailsModal";
import { AppealsUseCaseNavigation } from "./AppealsUseCaseNavigation";
import {
  appealStateBadgeVariant,
  businessPolicyStatusBadgeVariant,
  formatAppealState,
  formatBusinessPolicyStatus,
  formatPaymentPolicyStatus,
  formatPaymentStatus,
  formatSlaStatus,
  paymentPolicyStatusBadgeVariant,
  paymentStatusBadgeVariant,
  slaBadgeVariant
} from "./appeals-formatters";

export function AppealsPlanConsole({ initialAppealId = null }: { initialAppealId?: string | null }) {
  const requestedAppealId = initialAppealId;
  const [detailsAppealId, setDetailsAppealId] = useState<string | null>(null);
  const {
    rows,
    selectedId: selectedAppealId,
    setSelectedId: setSelectedAppealId,
    initialLoading,
    refreshing,
    error,
    refresh: refreshRows
  } = useIncentiveWorklist<AppealsPlanAuditRow>({
    endpoint: "/api/appeals/plan",
    getRowId: (row) => row.appealId,
    errorMessage: "Unable to load appeals plan rows",
    requestedId: requestedAppealId
  });

  const detailsRow = rows.find((row) => row.appealId === detailsAppealId) ?? null;

  return (
    <LabsPageShell className="workspace appeals-console appeals-plan-console">
      <div className="top-nav-row">
        <Link className="back" href="/">
          Back to demos
        </Link>
        <AppealsUseCaseNavigation activeView="plan" appealId={selectedAppealId ?? requestedAppealId} />
      </div>

      <LabsHero compact eyebrow="Health plan appeals audit" title="Appeals packet SLA events">
        <p>Track appeal packet readiness, SLA outcomes, business policy approval, and settlement results.</p>
      </LabsHero>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>Appeals packet policy log</h2>
            <p>{rows.length === 1 ? "1 appeal packet event loaded" : `${rows.length} appeal packet events loaded`}</p>
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
          <table className="worklist appeals-plan-worklist">
            <thead>
              <tr>
                <th>Appeal ID</th>
                <th>Linked PA</th>
                <th>Submitter</th>
                <th>State</th>
                <th className="badge-cell">Packet SLA</th>
                <th className="badge-cell">Business Policy</th>
                <th className="badge-cell">Payment Policy</th>
                <th className="badge-cell">Settlement</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {initialLoading ? (
                <tr className="loading-row">
                  <td colSpan={9}>
                    <div className="loading-indicator" role="status" aria-live="polite">
                      <span className="loading-dot" aria-hidden="true" />
                      <span>Loading appeals plan audit rows</span>
                    </div>
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.appealId} className={row.appealId === selectedAppealId ? "selected" : ""}>
                  <td className="mono-cell">{row.appealId}</td>
                  <td className="mono-cell">{row.umRequestId}</td>
                  <td>{row.submitterId}</td>
                  <td className="badge-cell">
                    <LabsBadge variant={appealStateBadgeVariant(row.state)}>{formatAppealState(row.state)}</LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={slaBadgeVariant(row.packetReadinessSlaStatus)}>
                      {formatSlaStatus(row.packetReadinessSlaStatus)}
                    </LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={businessPolicyStatusBadgeVariant(row.businessPolicyStatus)}>
                      {formatBusinessPolicyStatus(row.businessPolicyStatus)}
                    </LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={paymentPolicyStatusBadgeVariant(row.paymentPolicyStatus)}>
                      {formatPaymentPolicyStatus(row.paymentPolicyStatus)}
                    </LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={paymentStatusBadgeVariant(row.paymentStatus)}>
                      {formatPaymentStatus(row.paymentStatus)}
                    </LabsBadge>
                  </td>
                  <td>
                    <LabsButton
                      variant="row"
                      onClick={() => {
                        setSelectedAppealId(row.appealId);
                        setDetailsAppealId(row.appealId);
                      }}
                    >
                      View details
                    </LabsButton>
                  </td>
                </tr>
              ))}
              {!initialLoading && rows.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={9}>
                    No appeal packet events have been submitted to the plan audit log.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {detailsRow ? <AppealsPlanDetailsModal row={detailsRow} onClose={() => setDetailsAppealId(null)} /> : null}
    </LabsPageShell>
  );
}
