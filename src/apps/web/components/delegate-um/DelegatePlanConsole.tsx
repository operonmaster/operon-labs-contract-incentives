"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DelegateUmRow } from "../../lib/delegate-um-workflow";
import { LabsBadge, LabsHero, LabsPageShell } from "../labs-ui";
import { DelegateUseCaseNavigation } from "./DelegateUseCaseNavigation";
import {
  formatCurrency,
  formatIncentiveStatus,
  formatOutcomeStatus,
  formatPaymentStatus,
  formatRequestType,
  formatSlaStatus,
  formatUmState,
  incentiveBadgeVariant
} from "./delegate-formatters";

interface DelegateRowsResponse {
  rows: DelegateUmRow[];
}

type RefreshSource = "initial" | "manual";

export function DelegatePlanConsole({ initialUmRequestId = null }: { initialUmRequestId?: string | null }) {
  const requestedUmRequestId = initialUmRequestId;
  const [rows, setRows] = useState<DelegateUmRow[]>([]);
  const [selectedUmRequestId, setSelectedUmRequestId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const refreshSequenceRef = useRef(0);

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
      const response = await fetch("/api/delegate-um/plan", {
        cache: "no-store"
      });
      const payload = (await response.json()) as DelegateRowsResponse | { error?: string };

      if (!mountedRef.current || requestId !== refreshSequenceRef.current) {
        return;
      }

      if (!response.ok || !("rows" in payload)) {
        setError("error" in payload && payload.error ? payload.error : "Unable to load delegate plan rows");
        return;
      }

      setRows(payload.rows);
      setSelectedUmRequestId((currentUmRequestId) => {
        if (requestedUmRequestId && payload.rows.some((row) => row.umRequestId === requestedUmRequestId)) {
          return requestedUmRequestId;
        }

        if (currentUmRequestId && payload.rows.some((row) => row.umRequestId === currentUmRequestId)) {
          return currentUmRequestId;
        }

        return payload.rows[0]?.umRequestId ?? null;
      });
    } catch {
      if (mountedRef.current && requestId === refreshSequenceRef.current) {
        setError("Unable to load delegate plan rows");
      }
    } finally {
      if (mountedRef.current && source === "initial") {
        setInitialLoading(false);
      }

      if (mountedRef.current && source === "manual") {
        setRefreshing(false);
      }
    }
  }, [requestedUmRequestId]);

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

  const selectedRow = rows.find((row) => row.umRequestId === selectedUmRequestId) ?? null;

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
          <button
            className="primary-button secondary-button"
            disabled={refreshing}
            type="button"
            onClick={() => void refreshRows("manual")}
          >
            {refreshing ? "Refreshing..." : "Refresh plan view"}
          </button>
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
                <th>State</th>
                <th>Outcome status</th>
                <th className="badge-cell">SLA</th>
                <th className="badge-cell">Policy</th>
                <th>Settlement</th>
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
                  <td>
                    <button
                      aria-pressed={row.umRequestId === selectedUmRequestId}
                      className="row-action mono-cell"
                      type="button"
                      onClick={() => setSelectedUmRequestId(row.umRequestId)}
                    >
                      {row.umRequestId}
                    </button>
                  </td>
                  <td>{row.delegateVendorId}</td>
                  <td>{formatRequestType(row.requestType)}</td>
                  <td>{formatUmState(row.state)}</td>
                  <td>{formatOutcomeStatus(row.outcomeStatus)}</td>
                  <td className="badge-cell">
                    <LabsBadge variant={row.slaStatus === "breached" ? "warning" : "info"}>{formatSlaStatus(row)}</LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={incentiveBadgeVariant(row.incentiveStatus)}>
                      {formatIncentiveStatus(row.incentiveStatus)}
                    </LabsBadge>
                  </td>
                  <td>{formatPaymentStatus(row.paymentStatus)}</td>
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

      {selectedRow ? (
        <section className="panel detail-panel">
          <div className="toolbar">
            <div>
              <h2>Selected request</h2>
              <p>{selectedRow.serviceLabel}</p>
            </div>
            <LabsBadge variant={incentiveBadgeVariant(selectedRow.incentiveStatus)}>
              {formatIncentiveStatus(selectedRow.incentiveStatus)}
            </LabsBadge>
          </div>
          <dl className="detail-grid plan-audit-grid">
            <div>
              <dt>Outcome status</dt>
              <dd>{formatOutcomeStatus(selectedRow.outcomeStatus)}</dd>
            </div>
            <div>
              <dt>SLA</dt>
              <dd>{formatSlaStatus(selectedRow)}</dd>
            </div>
            <div>
              <dt>Payment status</dt>
              <dd>{formatPaymentStatus(selectedRow.paymentStatus)}</dd>
            </div>
            <div>
              <dt>Incentive value</dt>
              <dd>{formatCurrency(selectedRow)}</dd>
            </div>
            <div>
              <dt>Policy ID</dt>
              <dd className="mono-cell">{selectedRow.policyId ?? "Pending determination"}</dd>
            </div>
            <div>
              <dt>Transaction</dt>
              <dd className="mono-cell">{selectedRow.transactionId ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd>{selectedRow.reason}</dd>
            </div>
            <div>
              <dt>Reason codes</dt>
              <dd>{selectedRow.reasonCodes.length > 0 ? selectedRow.reasonCodes.join(", ") : "None"}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </LabsPageShell>
  );
}
