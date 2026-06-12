"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { LabsBadge, LabsButton, LabsHero, LabsPageShell } from "../labs-ui";
import { useIncentiveWorklist } from "../use-incentive-worklist";
import type { AppealCase } from "../../lib/appeals-store";
import type { AppealsPriorAuthRow } from "../../lib/appeals-workflow";
import { AppealsUseCaseNavigation } from "./AppealsUseCaseNavigation";
import { AppealsWorkflowModal } from "./AppealsWorkflowModal";
import {
  appealStateBadgeVariant,
  formatAppealEligibility,
  formatAppealState,
  formatRequestType
} from "./appeals-formatters";

export function AppealsConsole() {
  const [workflowAppealId, setWorkflowAppealId] = useState<string | null>(null);
  const [startingUmRequestId, setStartingUmRequestId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const lastWorkflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const {
    rows,
    setRows,
    selectedId: selectedUmRequestId,
    setSelectedId: setSelectedUmRequestId,
    initialLoading,
    refreshing,
    error,
    refresh: refreshRows
  } = useIncentiveWorklist<AppealsPriorAuthRow>({
    endpoint: "/api/appeals/prior-auths",
    getRowId: (row) => row.umRequestId,
    errorMessage: "Unable to load appeal prior authorization rows"
  });

  const workflowCase = workflowAppealId
    ? rows.find((row) => row.appealCase?.id === workflowAppealId)?.appealCase ?? null
    : null;

  async function startAppeal(row: AppealsPriorAuthRow, button: HTMLButtonElement) {
    setStartingUmRequestId(row.umRequestId);
    setStartError(null);
    lastWorkflowButtonRef.current = button;

    try {
      const response = await fetch("/api/appeals/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ umRequestId: row.umRequestId, expedited: false })
      });
      const payload = (await response.json()) as AppealCase | { error?: string };

      if (!response.ok || !("id" in payload)) {
        setStartError("error" in payload && payload.error ? payload.error : "Unable to start appeal");
        return;
      }

      handleUpdated(payload);
      setSelectedUmRequestId(row.umRequestId);
      setWorkflowAppealId(payload.id);
    } catch {
      setStartError("Unable to start appeal");
    } finally {
      setStartingUmRequestId(null);
    }
  }

  function handleUpdated(updatedCase: AppealCase) {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.umRequestId === updatedCase.umRequestId
          ? {
              ...row,
              appealCase: updatedCase,
              eligibilityStatus: "open",
              canStartAppeal: false
            }
          : row
      )
    );

    setWorkflowAppealId(updatedCase.id);
  }

  function closeWorkflowModal() {
    setWorkflowAppealId(null);
    window.setTimeout(() => lastWorkflowButtonRef.current?.focus(), 0);
  }

  return (
    <LabsPageShell className="workspace appeals-console">
      <div className="top-nav-row">
        <Link className="back" href="/">
          Back to demos
        </Link>
        <AppealsUseCaseNavigation activeView="provider" appealId={workflowCase?.id ?? null} />
      </div>

      <LabsHero compact eyebrow="Provider appeals" title="Appeals prior authorization worklist">
        <p>Start and complete appeal packet readiness workflows for denied prior authorization decisions.</p>
      </LabsHero>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>Appeals prior authorization worklist</h2>
            <p>{rows.length === 1 ? "1 prior authorization loaded" : `${rows.length} prior authorizations loaded`}</p>
          </div>
          <LabsButton variant="secondary" disabled={refreshing} onClick={() => void refreshRows("manual")}>
            {refreshing ? "Refreshing..." : "Refresh worklist"}
          </LabsButton>
        </div>

        {error || startError ? (
          <p className="error-text" role="alert">
            {error ?? startError}
          </p>
        ) : null}

        <div className="table-wrap">
          <table className="worklist appeals-prior-auth-worklist">
            <thead>
              <tr>
                <th>PA ID</th>
                <th>Plan</th>
                <th>Request type</th>
                <th>Drug/service</th>
                <th>Appeal status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {initialLoading ? (
                <tr className="loading-row">
                  <td colSpan={6}>
                    <div className="loading-indicator" role="status" aria-live="polite">
                      <span className="loading-dot" aria-hidden="true" />
                      <span>Loading appeal prior authorization rows</span>
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
                  <td className="badge-cell">
                    {row.appealCase ? (
                      <LabsBadge variant={appealStateBadgeVariant(row.appealCase.state)}>
                        {formatAppealState(row.appealCase.state)}
                      </LabsBadge>
                    ) : (
                      <LabsBadge variant={row.canStartAppeal ? "info" : "neutral"}>{formatAppealEligibility(row)}</LabsBadge>
                    )}
                  </td>
                  <td>
                    {row.appealCase ? (
                      <LabsButton
                        variant="row"
                        onClick={(event) => {
                          setSelectedUmRequestId(row.umRequestId);
                          lastWorkflowButtonRef.current = event.currentTarget;
                          setWorkflowAppealId(row.appealCase?.id ?? null);
                        }}
                      >
                        Open appeal
                      </LabsButton>
                    ) : row.canStartAppeal ? (
                      <LabsButton
                        variant="row"
                        disabled={startingUmRequestId === row.umRequestId}
                        onClick={(event) => void startAppeal(row, event.currentTarget)}
                      >
                        {startingUmRequestId === row.umRequestId ? "Starting..." : "Start appeal"}
                      </LabsButton>
                    ) : (
                      <span className="empty-state" aria-label="No appeal action available">
                        &mdash;
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!initialLoading && rows.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={6}>
                    No prior authorizations are available for appeals.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {workflowCase ? (
        <AppealsWorkflowModal appealCase={workflowCase} onClose={closeWorkflowModal} onUpdated={handleUpdated} />
      ) : null}
    </LabsPageShell>
  );
}
