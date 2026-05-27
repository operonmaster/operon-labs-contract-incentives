"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DelegateUmRow } from "../../lib/delegate-um-workflow";
import { LabsBadge, LabsHero, LabsPageShell } from "../labs-ui";
import { DelegateReviewModal } from "./DelegateReviewModal";
import { DelegateUseCaseNavigation } from "./DelegateUseCaseNavigation";
import { formatOutcomeStatus, formatRequestType, formatSlaStatus, formatUmState } from "./delegate-formatters";

interface DelegateRowsResponse {
  rows: DelegateUmRow[];
}

type RefreshSource = "initial" | "manual";

const delegateRequestApiBase = "/api/delegate-um/requests/";

export function DelegateVendorConsole() {
  const [rows, setRows] = useState<DelegateUmRow[]>([]);
  const [selectedUmRequestId, setSelectedUmRequestId] = useState<string | null>(null);
  const [reviewUmRequestId, setReviewUmRequestId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const refreshSequenceRef = useRef(0);
  const lastReviewButtonRef = useRef<HTMLButtonElement | null>(null);

  const reviewRow = rows.find((row) => row.umRequestId === reviewUmRequestId) ?? null;

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
      const response = await fetch("/api/delegate-um/workqueue", {
        cache: "no-store"
      });
      const payload = (await response.json()) as DelegateRowsResponse | { error?: string };

      if (!mountedRef.current || requestId !== refreshSequenceRef.current) {
        return;
      }

      if (!response.ok || !("rows" in payload)) {
        setError("error" in payload && payload.error ? payload.error : "Unable to load delegate workqueue");
        return;
      }

      setRows(payload.rows);
      setSelectedUmRequestId((currentUmRequestId) => {
        if (currentUmRequestId && payload.rows.some((row) => row.umRequestId === currentUmRequestId)) {
          return currentUmRequestId;
        }

        return payload.rows[0]?.umRequestId ?? null;
      });
    } catch {
      if (mountedRef.current && requestId === refreshSequenceRef.current) {
        setError("Unable to load delegate workqueue");
      }
    } finally {
      if (mountedRef.current && source === "initial") {
        setInitialLoading(false);
      }

      if (mountedRef.current && source === "manual") {
        setRefreshing(false);
      }
    }
  }, []);

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

  function handleCompleted(row: DelegateUmRow) {
    setRows((currentRows) => currentRows.filter((candidate) => candidate.umRequestId !== row.umRequestId));
    setSelectedUmRequestId(row.umRequestId);
    setReviewUmRequestId(null);
  }

  function closeReviewModal() {
    setReviewUmRequestId(null);
    window.setTimeout(() => lastReviewButtonRef.current?.focus(), 0);
  }

  return (
    <LabsPageShell className="workspace delegate-console">
      <div className="top-nav-row">
        <Link className="back" href="/">
          Back to demos
        </Link>
        <DelegateUseCaseNavigation activeView="vendor" umRequestId={selectedUmRequestId} />
      </div>

      <LabsHero compact eyebrow="Delegated UM vendor" title="Pharmacy prior authorization workqueue">
        <p>Review delegated pharmacy benefit UM requests, complete clinical checklist evidence, and submit determinations for plan audit.</p>
      </LabsHero>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>Open delegated requests</h2>
            <p>{rows.length === 1 ? "1 pharmacy request loaded" : `${rows.length} pharmacy requests loaded`}</p>
          </div>
          <button
            className="primary-button secondary-button"
            disabled={refreshing}
            type="button"
            onClick={() => void refreshRows("manual")}
          >
            {refreshing ? "Refreshing..." : "Refresh workqueue"}
          </button>
        </div>

        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}

        <div className="table-wrap">
          <table className="worklist delegate-workqueue">
            <thead>
              <tr>
                <th>UM request ID</th>
                <th>Plan</th>
                <th>Request type</th>
                <th>Drug/service</th>
                <th>State</th>
                <th className="badge-cell">SLA</th>
                <th>Outcome status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {initialLoading ? (
                <tr className="loading-row">
                  <td colSpan={8}>
                    <div className="loading-indicator" role="status" aria-live="polite">
                      <span className="loading-dot" aria-hidden="true" />
                      <span>Loading delegated pharmacy requests</span>
                    </div>
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.umRequestId} className={row.umRequestId === selectedUmRequestId ? "selected" : ""}>
                  <td className="mono-cell">{row.umRequestId}</td>
                  <td>{row.planDisplay}</td>
                  <td>{formatRequestType(row.requestType)}</td>
                  <td>{row.serviceLabel}</td>
                  <td>{formatUmState(row.state)}</td>
                  <td className="badge-cell">
                    <LabsBadge variant={row.slaStatus === "breached" ? "warning" : "info"}>{formatSlaStatus(row)}</LabsBadge>
                  </td>
                  <td>{formatOutcomeStatus(row.outcomeStatus)}</td>
                  <td>
                    <button
                      className="row-action"
                      type="button"
                      onClick={(event) => {
                        setSelectedUmRequestId(row.umRequestId);
                        lastReviewButtonRef.current = event.currentTarget;
                        setReviewUmRequestId(row.umRequestId);
                      }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {!initialLoading && rows.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={8}>
                    No delegated pharmacy prior authorizations are waiting for vendor review.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {reviewRow ? (
        <DelegateReviewModal
          requestApiBase={delegateRequestApiBase}
          row={reviewRow}
          onClose={closeReviewModal}
          onCompleted={handleCompleted}
        />
      ) : null}
    </LabsPageShell>
  );
}
