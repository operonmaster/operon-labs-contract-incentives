"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { LabsBadge, LabsButton, LabsHero, LabsPageShell } from "../labs-ui";
import type { SpecialtyFulfillmentCase } from "../../lib/specialty-rx-store";
import { SpecialtyRxUseCaseNavigation } from "./SpecialtyRxUseCaseNavigation";
import {
  formatFulfillmentCaseState,
  formatFulfillmentSlaClock,
  fulfillmentSlaBadgeVariant,
  fulfillmentStateBadgeVariant
} from "./specialty-rx-formatters";
import { SpecialtyRxWorkflowModal } from "./SpecialtyRxWorkflowModal";
import { useIntervalTick } from "../use-interval-tick";
import { useIncentiveWorklist } from "../use-incentive-worklist";

export function SpecialtyRxConsole() {
  const [workflowFulfillmentCaseId, setWorkflowFulfillmentCaseId] = useState<string | null>(null);
  const lastWorkflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const {
    rows,
    setRows,
    selectedId: selectedFulfillmentCaseId,
    setSelectedId: setSelectedFulfillmentCaseId,
    initialLoading,
    refreshing,
    error,
    refresh: refreshWorkqueue
  } = useIncentiveWorklist<SpecialtyFulfillmentCase>({
    endpoint: "/api/specialty-rx/workqueue",
    getRowId: (row) => row.id,
    errorMessage: "Unable to load specialty fulfillment workqueue"
  });

  // Keep the fulfillment SLA countdown badges live instead of frozen at first render.
  useIntervalTick(30000);

  const workflowCase = rows.find((row) => row.id === workflowFulfillmentCaseId) ?? null;

  function handleUpdated(updatedCase: SpecialtyFulfillmentCase) {
    const terminal = updatedCase.state === "fulfilled" || updatedCase.state === "exception";

    // Derive the next state once (pure), then call each setter independently. Calling
    // setSelectedFulfillmentCaseId from inside a setRows updater makes the updater
    // impure and can double-fire under React StrictMode.
    const nextRows = terminal
      ? rows.filter((row) => row.id !== updatedCase.id)
      : rows.map((row) => (row.id === updatedCase.id ? updatedCase : row));
    const normalizedRows =
      terminal || nextRows.some((row) => row.id === updatedCase.id) ? nextRows : [updatedCase, ...nextRows];

    setRows(normalizedRows);

    setSelectedFulfillmentCaseId((currentId) => {
      if (!terminal) {
        return updatedCase.id;
      }

      if (currentId && currentId !== updatedCase.id && normalizedRows.some((row) => row.id === currentId)) {
        return currentId;
      }

      return normalizedRows[0]?.id ?? null;
    });

    if (terminal) {
      setWorkflowFulfillmentCaseId(null);
    } else {
      setWorkflowFulfillmentCaseId(updatedCase.id);
    }
  }

  function closeWorkflowModal() {
    setWorkflowFulfillmentCaseId(null);
    window.setTimeout(() => lastWorkflowButtonRef.current?.focus(), 0);
  }

  return (
    <LabsPageShell className="workspace specialty-rx-console">
      <div className="top-nav-row">
        <Link className="back" href="/">
          Back to demos
        </Link>
        <SpecialtyRxUseCaseNavigation activeView="pharmacy" />
      </div>

      <LabsHero compact eyebrow="Specialty pharmacy" title="Specialty fulfillment workqueue">
        <p>Coordinate approved pharmacy benefit cases through intake, clear-to-fill, shipment, and fulfillment evidence.</p>
      </LabsHero>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>Specialty fulfillment workqueue</h2>
            <p>{rows.length === 1 ? "1 fulfillment case loaded" : `${rows.length} fulfillment cases loaded`}</p>
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
          <table className="worklist specialty-rx-workqueue">
            <thead>
              <tr>
                <th>Fulfillment case ID</th>
                <th>Pharmacy</th>
                <th>Drug/service</th>
                <th>State</th>
                <th>Fulfillment SLA</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {initialLoading ? (
                <tr className="loading-row">
                  <td colSpan={6}>
                    <div className="loading-indicator" role="status" aria-live="polite">
                      <span className="loading-dot" aria-hidden="true" />
                      <span>Loading specialty fulfillment cases</span>
                    </div>
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.id} className={row.id === selectedFulfillmentCaseId ? "selected" : ""}>
                  <td className="mono-cell">{row.id}</td>
                  <td>{row.pharmacyDisplay}</td>
                  <td>{row.serviceLabel}</td>
                  <td className="badge-cell">
                    <LabsBadge variant={fulfillmentStateBadgeVariant(row.state)}>
                      {formatFulfillmentCaseState(row)}
                    </LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={fulfillmentSlaBadgeVariant(row)}>{formatFulfillmentSlaClock(row)}</LabsBadge>
                  </td>
                  <td>
                    <LabsButton
                      variant="row"
                      onClick={(event) => {
                        setSelectedFulfillmentCaseId(row.id);
                        lastWorkflowButtonRef.current = event.currentTarget;
                        setWorkflowFulfillmentCaseId(row.id);
                      }}
                    >
                      Open workflow
                    </LabsButton>
                  </td>
                </tr>
              ))}
              {!initialLoading && rows.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={6}>
                    No specialty fulfillment cases waiting.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {workflowCase ? (
        <SpecialtyRxWorkflowModal caseRecord={workflowCase} onClose={closeWorkflowModal} onUpdated={handleUpdated} />
      ) : null}
    </LabsPageShell>
  );
}
