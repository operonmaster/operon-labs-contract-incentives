"use client";

import type { IncentiveWorklistRow } from "../../lib/provider-documentation-workflow";
import Link from "next/link";
import { useState } from "react";
import { LabsBadge, LabsButton, LabsHero, LabsPageShell } from "../labs-ui";
import { formatCurrency, formatRequestType, PlanAuditDetailsModal } from "./PlanAuditDetailsModal";
import { UseCaseNavigation } from "./UseCaseNavigation";
import { useIncentiveWorklist } from "../use-incentive-worklist";

export function PlanIncentivesConsole({ initialUmRequestId = null }: { initialUmRequestId?: string | null }) {
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
  } = useIncentiveWorklist<IncentiveWorklistRow>({
    endpoint: "/api/provider-documentation/incentives",
    getRowId: (row) => row.umRequestId,
    errorMessage: "Unable to load incentive events",
    requestedId: requestedUmRequestId
  });

  const detailsRow = rows.find((row) => row.umRequestId === detailsUmRequestId) ?? null;

  return (
    <LabsPageShell className="workspace plan-console">
      <div className="top-nav-row">
        <Link className="back" href="/">
          Back to demos
        </Link>
        <UseCaseNavigation activeView="plan" umRequestId={selectedUmRequestId ?? requestedUmRequestId} />
      </div>

      <LabsHero compact eyebrow="Health plan audit console" title="Provider documentation incentives">
        <p>
          Review UM request creation events, inspect policy-safe evidence, and verify policy-bound Hedera testnet settlement.
        </p>
      </LabsHero>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>UM request worklist</h2>
            <p>{rows.length === 1 ? "1 event loaded" : `${rows.length} events loaded`}</p>
          </div>
          <LabsButton variant="secondary" disabled={refreshing} onClick={() => void refreshRows("manual")}>
            {refreshing ? "Refreshing..." : "Refresh events"}
          </LabsButton>
        </div>

        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}

        <div className="table-wrap">
          <table className="worklist">
            <thead>
              <tr>
                <th>UM request ID</th>
                <th>Health Plan</th>
                <th>Provider group</th>
                <th>Request type</th>
                <th className="badge-cell">Business Policy</th>
                <th className="badge-cell">Payment Policy</th>
                <th>Payment</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {initialLoading ? (
                <tr className="loading-row">
                  <td colSpan={8}>
                    <div className="loading-indicator" role="status" aria-live="polite">
                      <span className="loading-dot" aria-hidden="true" />
                      <span>Loading UM request creation events</span>
                    </div>
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => {
                const paymentPolicyOutcome = formatPaymentPolicyOutcome(row) || null;

                return (
                  <tr key={row.umRequestId} className={row.umRequestId === selectedUmRequestId ? "selected" : ""}>
                    <td className="mono-cell">{row.umRequestId}</td>
                    <td>{row.planDisplay ?? row.planId ?? "Unknown plan"}</td>
                    <td>{row.providerGroupDisplay}</td>
                    <td>{formatRequestType(row.requestType)}</td>
                    <td className="badge-cell">
                      <LabsBadge variant={businessPolicyBadgeVariant(row)}>
                        {formatBusinessPolicyOutcome(row)}
                      </LabsBadge>
                    </td>
                    <td className="badge-cell">
                      {paymentPolicyOutcome ? (
                        <LabsBadge variant={paymentPolicyBadgeVariant(row)}>{paymentPolicyOutcome}</LabsBadge>
                      ) : null}
                    </td>
                    <td>{formatPaymentAmount(row)}</td>
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
                );
              })}
              {!initialLoading && rows.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={8}>
                    No UM request creation incentive events yet. Submit a prior authorization from the provider portal.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {detailsRow ? <PlanAuditDetailsModal row={detailsRow} onClose={() => setDetailsUmRequestId(null)} /> : null}
    </LabsPageShell>
  );
}

export function formatBusinessPolicyOutcome(row: IncentiveWorklistRow) {
  switch (row.businessPolicyStatus) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return "Pending";
  }
}

export function formatPaymentPolicyOutcome(row: IncentiveWorklistRow) {
  switch (row.paymentPolicyStatus) {
    case "paid":
      return "Paid";
    case "blocked":
      return "Blocked";
    default:
      return "";
  }
}

export function formatPaymentAmount(row: IncentiveWorklistRow) {
  if (row.paymentPolicyStatus !== "paid" || !row.transactionId) {
    return "";
  }

  return formatCurrency(row);
}

function businessPolicyBadgeVariant(row: IncentiveWorklistRow): "success" | "warning" | "neutral" {
  switch (row.businessPolicyStatus) {
    case "approved":
      return "success";
    case "rejected":
      return "warning";
    default:
      return "neutral";
  }
}

function paymentPolicyBadgeVariant(row: IncentiveWorklistRow): "success" | "warning" | "neutral" {
  switch (row.paymentPolicyStatus) {
    case "paid":
      return "success";
    case "blocked":
      return "warning";
    default:
      return "neutral";
  }
}
