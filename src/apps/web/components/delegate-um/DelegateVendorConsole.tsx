"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UMRequest } from "@operon-labs/um-platform";
import { LabsBadge, LabsHero, LabsPageShell } from "../labs-ui";
import { DelegateReviewModal } from "./DelegateReviewModal";
import { DelegateUseCaseNavigation } from "./DelegateUseCaseNavigation";
import { formatOutcomeStatus, formatRequestType, formatUmRequestSlaStatus, formatUmState } from "./delegate-formatters";

interface DelegateWorkqueueResponse {
  rows: UMRequest[];
}

type RefreshSource = "initial" | "manual";

const delegateRequestApiBase = "/api/delegate-um/requests/";

export function DelegateVendorConsole() {
  const [requests, setRequests] = useState<UMRequest[]>([]);
  const [selectedUmRequestId, setSelectedUmRequestId] = useState<string | null>(null);
  const [reviewUmRequestId, setReviewUmRequestId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const refreshSequenceRef = useRef(0);
  const lastReviewButtonRef = useRef<HTMLButtonElement | null>(null);

  const reviewRequest = requests.find((request) => request.id === reviewUmRequestId) ?? null;

  const refreshWorkqueue = useCallback(async (source: RefreshSource = "manual") => {
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
      const payload = (await response.json()) as DelegateWorkqueueResponse | { error?: string };

      if (!mountedRef.current || requestId !== refreshSequenceRef.current) {
        return;
      }

      if (!response.ok || !("rows" in payload)) {
        setError("error" in payload && payload.error ? payload.error : "Unable to load delegate workqueue");
        return;
      }

      setRequests(payload.rows);
      setSelectedUmRequestId((currentUmRequestId) => {
        if (currentUmRequestId && payload.rows.some((request) => request.id === currentUmRequestId)) {
          return currentUmRequestId;
        }

        return payload.rows[0]?.id ?? null;
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
      void refreshWorkqueue("initial");
    }, 0);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialRefreshId);
    };
  }, [refreshWorkqueue]);

  function handleCompleted(request: UMRequest) {
    setRequests((currentRequests) => currentRequests.filter((candidate) => candidate.id !== request.id));
    setSelectedUmRequestId(request.id);
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
            <p>{requests.length === 1 ? "1 pharmacy request loaded" : `${requests.length} pharmacy requests loaded`}</p>
          </div>
          <button
            className="primary-button secondary-button"
            disabled={refreshing}
            type="button"
            onClick={() => void refreshWorkqueue("manual")}
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
              {requests.map((request) => (
                <tr key={request.id} className={request.id === selectedUmRequestId ? "selected" : ""}>
                  <td className="mono-cell">{request.id}</td>
                  <td>{request.planDisplay}</td>
                  <td>{formatRequestType(request.requestType)}</td>
                  <td>{request.serviceLabel}</td>
                  <td>{formatUmState(request.state)}</td>
                  <td className="badge-cell">
                    <LabsBadge
                      variant={
                        request.state === "determined" &&
                        request.determinedAt &&
                        new Date(request.determinedAt).getTime() > new Date(request.slaDeadlineAt).getTime()
                          ? "warning"
                          : "info"
                      }
                    >
                      {formatUmRequestSlaStatus(request)}
                    </LabsBadge>
                  </td>
                  <td>{formatOutcomeStatus(request.outcomeStatus)}</td>
                  <td>
                    <button
                      className="row-action"
                      type="button"
                      onClick={(event) => {
                        setSelectedUmRequestId(request.id);
                        lastReviewButtonRef.current = event.currentTarget;
                        setReviewUmRequestId(request.id);
                      }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {!initialLoading && requests.length === 0 ? (
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

      {reviewRequest ? (
        <DelegateReviewModal
          requestApiBase={delegateRequestApiBase}
          request={reviewRequest}
          onClose={closeReviewModal}
          onCompleted={handleCompleted}
        />
      ) : null}
    </LabsPageShell>
  );
}
