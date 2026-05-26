"use client";

import type { IncentiveWorklistRow } from "../../lib/provider-documentation-workflow";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LabsBadge, LabsHero, LabsPageShell } from "../labs-ui";
import { formatCurrency, formatRequestType, PlanAuditDetailsModal } from "./PlanAuditDetailsModal";
import { UseCaseNavigation } from "./UseCaseNavigation";

interface IncentiveRowsResponse {
  rows: IncentiveWorklistRow[];
}

type RefreshSource = "initial" | "manual";

export function PlanIncentivesConsole({ initialCaseId = null }: { initialCaseId?: string | null }) {
  const requestedCaseId = initialCaseId;
  const [rows, setRows] = useState<IncentiveWorklistRow[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detailsCaseId, setDetailsCaseId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const refreshSequenceRef = useRef(0);

  const detailsRow = rows.find((row) => row.caseId === detailsCaseId) ?? null;

  const refreshRows = useCallback(async (source: RefreshSource = "manual") => {
    const requestId = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = requestId;

    if (source === "manual" && mountedRef.current) {
      setRefreshing(true);
    }

    if (mountedRef.current) {
      setError(null);
    }

    try {
      const response = await fetch("/api/provider-documentation/incentives", {
        cache: "no-store"
      });
      const payload = (await response.json()) as IncentiveRowsResponse | { error?: string };

      if (!mountedRef.current || requestId !== refreshSequenceRef.current) {
        return false;
      }

      if (!response.ok || !("rows" in payload)) {
        setError("error" in payload && payload.error ? payload.error : "Unable to load incentive events");
        return false;
      }

      setRows(payload.rows);
      setSelectedCaseId((currentCaseId) => {
        if (requestedCaseId && payload.rows.some((row) => row.caseId === requestedCaseId)) {
          return requestedCaseId;
        }

        if (currentCaseId && payload.rows.some((row) => row.caseId === currentCaseId)) {
          return currentCaseId;
        }

        return payload.rows[0]?.caseId ?? null;
      });
      return true;
    } catch {
      if (!mountedRef.current || requestId !== refreshSequenceRef.current) {
        return false;
      }

      setError("Unable to load incentive events");
      return false;
    } finally {
      if (mountedRef.current && source === "initial") {
        setInitialLoading(false);
      }

      if (mountedRef.current && source === "manual") {
        setRefreshing(false);
      }
    }
  }, [requestedCaseId]);

  useEffect(() => {
    mountedRef.current = true;
    const initialRefreshId = window.setTimeout(() => {
      void refreshRows("initial");
    }, 0);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialRefreshId);
    };
  }, [refreshRows]);

  return (
    <LabsPageShell className="workspace plan-console">
      <div className="top-nav-row">
        <Link className="back" href="/">
          Back to demos
        </Link>
        <UseCaseNavigation activeView="plan" caseId={selectedCaseId ?? requestedCaseId} />
      </div>

      <LabsHero compact eyebrow="Health plan audit console" title="Provider documentation incentives">
        <p>
          Review submitted PA events, inspect policy-safe evidence, and verify policy-bound Hedera testnet settlement.
        </p>
      </LabsHero>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>Submitted PA worklist</h2>
            <p>{rows.length === 1 ? "1 event loaded" : `${rows.length} events loaded`}</p>
          </div>
          <button
            className="primary-button secondary-button"
            disabled={refreshing}
            type="button"
            onClick={() => void refreshRows("manual")}
          >
            {refreshing ? "Refreshing..." : "Refresh events"}
          </button>
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
                <th>PA ID</th>
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
                      <span>Loading submitted PA events</span>
                    </div>
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => {
                const paymentPolicyOutcome = formatPaymentPolicyOutcome(row) || null;

                return (
                  <tr key={row.caseId} className={row.caseId === selectedCaseId ? "selected" : ""}>
                    <td className="mono-cell">{row.caseId}</td>
                    <td>{row.planDisplay ?? row.planId ?? "Unknown plan"}</td>
                    <td>{row.providerGroupDisplay}</td>
                    <td>{formatRequestType(row.requestType)}</td>
                    <td className="badge-cell">
                      <LabsBadge variant={businessPolicyBadgeVariant(row.incentiveStatus)}>
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
                      <button
                        className="row-action"
                        type="button"
                        onClick={() => {
                          setSelectedCaseId(row.caseId);
                          setDetailsCaseId(row.caseId);
                        }}
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!initialLoading && rows.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={8}>
                    No submitted PA incentive events yet. Submit a prior authorization from the provider portal.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {detailsRow ? <PlanAuditDetailsModal row={detailsRow} onClose={() => setDetailsCaseId(null)} /> : null}
    </LabsPageShell>
  );
}

export function formatBusinessPolicyOutcome(row: IncentiveWorklistRow) {
  switch (row.incentiveStatus) {
    case "not_eligible":
      return "Rejected";
    case "paid":
      return "Approved";
    case "payment_failed":
      return "Rejected";
  }
}

export function formatPaymentPolicyOutcome(row: IncentiveWorklistRow) {
  if (row.incentiveStatus === "not_eligible") {
    return "";
  }

  if (row.paymentStatus === "auto_executed" && row.transactionId) {
    return "Paid";
  }

  return "Blocked";
}

export function formatPaymentAmount(row: IncentiveWorklistRow) {
  if (row.paymentStatus !== "auto_executed" || !row.transactionId) {
    return "";
  }

  return formatCurrency(row);
}

function businessPolicyBadgeVariant(status: IncentiveWorklistRow["incentiveStatus"]): "success" | "warning" {
  switch (status) {
    case "not_eligible":
      return "warning";
    case "paid":
      return "success";
    case "payment_failed":
      return "warning";
  }
}

function paymentPolicyBadgeVariant(row: IncentiveWorklistRow): "success" | "warning" | "neutral" {
  const outcome = formatPaymentPolicyOutcome(row);

  if (outcome === "Paid") {
    return "success";
  }

  if (outcome === "Blocked") {
    return "warning";
  }

  return "neutral";
}
