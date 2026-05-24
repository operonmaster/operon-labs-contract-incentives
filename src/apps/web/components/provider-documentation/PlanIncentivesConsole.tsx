"use client";

import type { IncentiveWorklistRow } from "../../lib/provider-documentation-workflow";
import Link from "next/link";
import { useEffect, useState } from "react";

interface IncentiveRowsResponse {
  rows: IncentiveWorklistRow[];
}

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [approvingCaseId, setApprovingCaseId] = useState<string | null>(null);

  const selectedRow = rows.find((row) => row.caseId === selectedCaseId) ?? null;

  async function refreshRows() {
    setError(null);

    try {
      const response = await fetch("/api/provider-documentation/incentives", {
        cache: "no-store"
      });
      const payload = (await response.json()) as IncentiveRowsResponse | { error?: string };

      if (!response.ok || !("rows" in payload)) {
        setError("error" in payload && payload.error ? payload.error : "Unable to load incentive events");
        return;
      }

      setRows(payload.rows);
      setSelectedCaseId((currentCaseId) => {
        if (currentCaseId && payload.rows.some((row) => row.caseId === currentCaseId)) {
          return currentCaseId;
        }

        return payload.rows[0]?.caseId ?? null;
      });
    } catch {
      setError("Unable to load incentive events");
    } finally {
      setLoading(false);
    }
  }

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

      if (!response.ok) {
        setActionStatus("error" in payload && payload.error ? payload.error : "Payment approval failed");
        return;
      }

      setActionStatus("Payment approved and Hedera transaction recorded.");
      await refreshRows();
      setSelectedCaseId(caseId);
    } catch {
      setActionStatus("Payment approval failed");
    } finally {
      setApprovingCaseId(null);
    }
  }

  useEffect(() => {
    const initialRefreshId = window.setTimeout(() => {
      void refreshRows();
    }, 0);
    const intervalId = window.setInterval(() => {
      void refreshRows();
    }, 4000);

    return () => {
      window.clearTimeout(initialRefreshId);
      window.clearInterval(intervalId);
    };
  }, []);

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
          <button className="primary-button secondary-button" disabled={loading} type="button" onClick={refreshRows}>
            {loading ? "Refreshing..." : "Refresh events"}
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
                <th>Provider group</th>
                <th>Service</th>
                <th>PA result</th>
                <th>Incentive status</th>
                <th>Value</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.caseId}
                  aria-selected={row.caseId === selectedCaseId}
                  className={row.caseId === selectedCaseId ? "selected" : ""}
                  onClick={() => setSelectedCaseId(row.caseId)}
                >
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
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={7}>
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
