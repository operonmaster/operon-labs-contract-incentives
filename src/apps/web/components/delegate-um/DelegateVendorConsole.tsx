"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { UMRequest } from "@operon-labs/um-platform";
import { LabsBadge, LabsButton, LabsHero, LabsPageShell } from "../labs-ui";
import { DelegateReviewModal } from "./DelegateReviewModal";
import { DelegateUseCaseNavigation } from "./DelegateUseCaseNavigation";
import { formatOutcomeStatus, formatRequestType, formatUmRequestSlaStatus, formatUmState } from "./delegate-formatters";
import { useIntervalTick } from "../use-interval-tick";
import { useIncentiveWorklist } from "../use-incentive-worklist";

const delegateRequestApiBase = "/api/delegate-um/requests/";

export function DelegateVendorConsole() {
  const [reviewUmRequestId, setReviewUmRequestId] = useState<string | null>(null);
  const lastReviewButtonRef = useRef<HTMLButtonElement | null>(null);
  const {
    rows: requests,
    setRows: setRequests,
    selectedId: selectedUmRequestId,
    setSelectedId: setSelectedUmRequestId,
    initialLoading,
    refreshing,
    error,
    refresh: refreshWorkqueue
  } = useIncentiveWorklist<UMRequest>({
    endpoint: "/api/delegate-um/workqueue",
    getRowId: (request) => request.id,
    errorMessage: "Unable to load delegate workqueue"
  });

  // Keep the SLA countdown badges live instead of frozen at first render.
  useIntervalTick(30000);

  const reviewRequest = requests.find((request) => request.id === reviewUmRequestId) ?? null;

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
          <LabsButton variant="secondary" disabled={refreshing} onClick={() => void refreshWorkqueue("manual")}>
            {refreshing ? "Refreshing..." : "Refresh workqueue"}
          </LabsButton>
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
                    <LabsButton
                      variant="row"
                      onClick={(event) => {
                        setSelectedUmRequestId(request.id);
                        lastReviewButtonRef.current = event.currentTarget;
                        setReviewUmRequestId(request.id);
                      }}
                    >
                      Review
                    </LabsButton>
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
