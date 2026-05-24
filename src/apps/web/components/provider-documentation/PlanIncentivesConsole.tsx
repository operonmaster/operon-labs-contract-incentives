"use client";

import type { IncentiveWorklistRow } from "../../lib/provider-documentation-workflow";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LabsHero, LabsPageShell } from "../labs-ui";
import { UseCaseNavigation } from "./UseCaseNavigation";

interface IncentiveRowsResponse {
  rows: IncentiveWorklistRow[];
}

type RefreshSource = "initial" | "manual" | "poll";

function formatCurrency(row: IncentiveWorklistRow) {
  return `${row.incentiveValue.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })} ${row.currency}`;
}

function formatStatus(status: IncentiveWorklistRow["incentiveStatus"]) {
  switch (status) {
    case "not_eligible":
      return "Blocked by policy";
    case "paid":
      return "Paid by policy";
    case "payment_failed":
      return "Payment failed";
  }
}

function formatPaResult(paResult: IncentiveWorklistRow["paResult"]) {
  return paResult === "denied_not_covered" ? "Denied - not covered" : "Submitted / pending";
}

function statusClass(status: IncentiveWorklistRow["incentiveStatus"]) {
  switch (status) {
    case "not_eligible":
      return "blocked";
    case "paid":
      return "approved";
    case "payment_failed":
      return "blocked";
  }
}

function formatPaymentStatus(row: IncentiveWorklistRow) {
  switch (row.paymentStatus) {
    case "auto_executed":
      return "Auto-settled";
    case "blocked_by_policy":
      return "No transaction";
    case "execution_failed":
      return "Execution failed";
  }
}

export function PlanIncentivesConsole({ initialCaseId = null }: { initialCaseId?: string | null }) {
  const requestedCaseId = initialCaseId;
  const [rows, setRows] = useState<IncentiveWorklistRow[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    const isPriorityRefresh = source === "manual";

    if (isPriorityRefresh) {
      priorityRefreshCountRef.current += 1;
    }

    if (source === "manual" && mountedRef.current) {
      setRefreshing(true);
    }

    if (source !== "poll" && mountedRef.current) {
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

      if (isPriorityRefresh) {
        priorityRefreshCountRef.current = Math.max(0, priorityRefreshCountRef.current - 1);
      }
    }
  }, [requestedCaseId]);

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
                <th>Policy outcome</th>
                <th>Value</th>
                <th>Payment</th>
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
                  <td>{formatPaymentStatus(row)}</td>
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
                  <td className="empty-state" colSpan={9}>
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
            <h2>PA preview and policy audit</h2>
            <p>{selectedRow ? selectedRow.caseId : "Select a PA row to inspect the event."}</p>
          </div>
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
                <dt>Service</dt>
                <dd>{selectedRow.serviceLabel}</dd>
              </div>
              <div>
                <dt>PA result</dt>
                <dd>{formatPaResult(selectedRow.paResult)}</dd>
              </div>
              <div>
                <dt>Policy ID</dt>
                <dd className="mono-cell">{selectedRow.policyId}</dd>
              </div>
              <div>
                <dt>Policy outcome</dt>
                <dd>{formatStatus(selectedRow.incentiveStatus)}</dd>
              </div>
              <div>
                <dt>Payment status</dt>
                <dd>{formatPaymentStatus(selectedRow)}</dd>
              </div>
              <div>
                <dt>Incentive value</dt>
                <dd>{formatCurrency(selectedRow)}</dd>
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
                <dt>Network</dt>
                <dd>Hedera testnet</dd>
              </div>
              <div>
                <dt>Transaction</dt>
                <dd className="mono-cell">{selectedRow.transactionId ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Policy guardrails</dt>
                <dd>{selectedRow.policyControls.join("; ")}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="empty-state">No policy event selected.</p>
        )}
      </section>
    </LabsPageShell>
  );
}
