"use client";

import type { IncentiveWorklistRow } from "../../lib/provider-documentation-workflow";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface IncentiveRowsResponse {
  rows: IncentiveWorklistRow[];
}

type RefreshSource = "initial" | "manual" | "poll" | "approval";

function formatCurrency(row: IncentiveWorklistRow) {
  return `${row.incentiveValue.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })} ${row.currency}`;
}

function formatStatus(status: IncentiveWorklistRow["incentiveStatus"]) {
  switch (status) {
    case "eligible_pending_approval":
      return "Eligible - pending approval";
    case "not_eligible":
      return "Not eligible";
    case "paid":
      return "Paid";
  }
}

function formatPaResult(paResult: IncentiveWorklistRow["paResult"]) {
  return paResult === "denied_not_covered" ? "Denied - not covered" : "Submitted / pending";
}

function statusClass(status: IncentiveWorklistRow["incentiveStatus"]) {
  switch (status) {
    case "eligible_pending_approval":
      return "pending";
    case "not_eligible":
      return "blocked";
    case "paid":
      return "approved";
  }
}

export function PlanIncentivesConsole() {
  const [rows, setRows] = useState<IncentiveWorklistRow[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [approvingCaseId, setApprovingCaseId] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const refreshSequenceRef = useRef(0);
  const priorityRefreshCountRef = useRef(0);

  const selectedRow = rows.find((row) => row.caseId === selectedCaseId) ?? null;

  const refreshRows = useCallback(async (source: RefreshSource = "manual") => {
    if (source === "poll" && priorityRefreshCountRef.current > 0) {
      return false;
    }

    const requestId = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = requestId;
    const isPriorityRefresh = source === "manual" || source === "approval";

    if (isPriorityRefresh) {
      priorityRefreshCountRef.current += 1;
    }

    if (source === "manual" && mountedRef.current) {
      setRefreshing(true);
    }

    if (source !== "poll" && mountedRef.current) {
      setError(null);
      setActionStatus(null);
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

      if (isPriorityRefresh) {
        priorityRefreshCountRef.current = Math.max(0, priorityRefreshCountRef.current - 1);
      }
    }
  }, []);

  async function approve(caseId: string) {
    setApprovingCaseId(caseId);
    setActionStatus(null);
    setError(null);

    try {
      const response = await fetch(`/api/provider-documentation/incentives/${caseId}/approve`, {
        method: "POST",
        headers: {
          "x-operon-plan-role": "contract-admin"
        }
      });
      const payload = (await response.json()) as IncentiveWorklistRow | { error?: string };

      if (!mountedRef.current) {
        return;
      }

      if (!response.ok) {
        setActionStatus("error" in payload && payload.error ? payload.error : "Payment approval failed");
        return;
      }

      const refreshed = await refreshRows("approval");
      if (refreshed && mountedRef.current) {
        setSelectedCaseId(caseId);
        setActionStatus("Payment approved and Hedera transaction recorded.");
      }
    } catch {
      if (mountedRef.current) {
        setActionStatus("Payment approval failed");
      }
    } finally {
      if (mountedRef.current) {
        setApprovingCaseId(null);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    const initialRefreshId = window.setTimeout(() => {
      void refreshRows("initial");
    }, 0);
    const intervalId = window.setInterval(() => {
      void refreshRows("poll");
    }, 4000);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialRefreshId);
      window.clearInterval(intervalId);
    };
  }, [refreshRows]);

  return (
    <main className="workspace">
      <Link className="back" href="/provider-documentation">
        Back to provider portal
      </Link>

      <section className="hero compact">
        <span className="eyebrow">Plan contract incentives console</span>
        <h1>Provider documentation incentives</h1>
        <p>
          Review submitted PA events, inspect policy-safe evidence, and approve eligible provider incentive payments on
          testnet.
        </p>
      </section>

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

        {initialLoading ? <p className="empty-state">Loading incentive events...</p> : null}

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
                <th>Provider group</th>
                <th>Service</th>
                <th>PA result</th>
                <th>Incentive status</th>
                <th>Value</th>
                <th>Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.caseId} className={row.caseId === selectedCaseId ? "selected" : ""}>
                  <td className="mono-cell">{row.caseId}</td>
                  <td>{row.providerGroupDisplay}</td>
                  <td>{row.serviceLabel}</td>
                  <td>{formatPaResult(row.paResult)}</td>
                  <td>
                    <span className={`status ${statusClass(row.incentiveStatus)}`}>
                      {formatStatus(row.incentiveStatus)}
                    </span>
                  </td>
                  <td>{formatCurrency(row)}</td>
                  <td>{row.reason}</td>
                  <td>
                    <button className="row-action" type="button" onClick={() => setSelectedCaseId(row.caseId)}>
                      View details
                    </button>
                  </td>
                </tr>
              ))}
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

      <section className="panel detail-panel">
        <div className="toolbar">
          <div>
            <h2>Policy details</h2>
            <p>{selectedRow ? selectedRow.caseId : "Select a PA row to inspect the event."}</p>
          </div>
          {selectedRow?.incentiveStatus === "eligible_pending_approval" ? (
            <button
              className="primary-button"
              disabled={approvingCaseId === selectedRow.caseId}
              type="button"
              onClick={() => void approve(selectedRow.caseId)}
            >
              {approvingCaseId === selectedRow.caseId ? "Approving..." : "Approve testnet payment"}
            </button>
          ) : null}
        </div>

        {selectedRow ? (
          <>
            <dl className="detail-grid">
              <div>
                <dt>Event</dt>
                <dd>PAS_SUBMITTED</dd>
              </div>
              <div>
                <dt>Evidence source</dt>
                <dd>UM Platform API</dd>
              </div>
              <div>
                <dt>Policy ID</dt>
                <dd className="mono-cell">{selectedRow.policyId}</dd>
              </div>
              <div>
                <dt>Audit ID</dt>
                <dd className="mono-cell">{selectedRow.audit.id}</dd>
              </div>
              <div>
                <dt>Reason codes</dt>
                <dd>{selectedRow.reasonCodes.length > 0 ? selectedRow.reasonCodes.join(", ") : "None"}</dd>
              </div>
              <div>
                <dt>Wallet</dt>
                <dd className="mono-cell">{selectedRow.walletId ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Transaction</dt>
                <dd className="mono-cell">{selectedRow.transactionId ?? "Not recorded"}</dd>
              </div>
            </dl>

            {actionStatus ? (
              <p className="action-status" role="status">
                {actionStatus}
              </p>
            ) : null}
          </>
        ) : (
          <p className="empty-state">No policy event selected.</p>
        )}
      </section>
    </main>
  );
}
