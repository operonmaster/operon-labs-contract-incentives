"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LabsBadge, LabsHero, LabsPageShell } from "../labs-ui";
import type { SpecialtyFulfillmentCase } from "../../lib/specialty-rx-store";
import { SpecialtyRxUseCaseNavigation } from "./SpecialtyRxUseCaseNavigation";
import {
  formatFulfillmentState,
  formatNullableDateTime,
  fulfillmentStateBadgeVariant
} from "./specialty-rx-formatters";
import { SpecialtyRxWorkflowModal } from "./SpecialtyRxWorkflowModal";

interface SpecialtyRxWorkqueueResponse {
  rows: SpecialtyFulfillmentCase[];
}

type RefreshSource = "initial" | "manual";

export function SpecialtyRxConsole() {
  const [rows, setRows] = useState<SpecialtyFulfillmentCase[]>([]);
  const [selectedFulfillmentCaseId, setSelectedFulfillmentCaseId] = useState<string | null>(null);
  const [workflowFulfillmentCaseId, setWorkflowFulfillmentCaseId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const refreshSequenceRef = useRef(0);
  const lastWorkflowButtonRef = useRef<HTMLButtonElement | null>(null);

  const workflowCase = rows.find((row) => row.id === workflowFulfillmentCaseId) ?? null;

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
      const response = await fetch("/api/specialty-rx/workqueue", {
        cache: "no-store"
      });
      const payload = (await response.json()) as SpecialtyRxWorkqueueResponse | { error?: string };

      if (!mountedRef.current || requestId !== refreshSequenceRef.current) {
        return;
      }

      if (!response.ok || !("rows" in payload)) {
        setError("error" in payload && payload.error ? payload.error : "Unable to load specialty fulfillment workqueue");
        return;
      }

      setRows(payload.rows);
      setSelectedFulfillmentCaseId((currentFulfillmentCaseId) => {
        if (currentFulfillmentCaseId && payload.rows.some((row) => row.id === currentFulfillmentCaseId)) {
          return currentFulfillmentCaseId;
        }

        return payload.rows[0]?.id ?? null;
      });
    } catch {
      if (mountedRef.current && requestId === refreshSequenceRef.current) {
        setError("Unable to load specialty fulfillment workqueue");
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

  function handleUpdated(updatedCase: SpecialtyFulfillmentCase) {
    const terminal = updatedCase.state === "fulfilled" || updatedCase.state === "exception";

    setRows((currentRows) => {
      const nextRows = terminal
        ? currentRows.filter((row) => row.id !== updatedCase.id)
        : currentRows.map((row) => (row.id === updatedCase.id ? updatedCase : row));
      const normalizedRows = terminal || nextRows.some((row) => row.id === updatedCase.id) ? nextRows : [updatedCase, ...nextRows];

      setSelectedFulfillmentCaseId((currentId) => {
        if (!terminal) {
          return updatedCase.id;
        }

        if (currentId && currentId !== updatedCase.id && normalizedRows.some((row) => row.id === currentId)) {
          return currentId;
        }

        return normalizedRows[0]?.id ?? null;
      });

      return normalizedRows;
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
        <SpecialtyRxUseCaseNavigation activeView="pharmacy" fulfillmentCaseId={selectedFulfillmentCaseId} />
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
          <table className="worklist specialty-rx-workqueue">
            <thead>
              <tr>
                <th>Fulfillment case ID</th>
                <th>Linked PA</th>
                <th>Pharmacy</th>
                <th>Drug/service</th>
                <th>State</th>
                <th>Clear to fill</th>
                <th>Shipment</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {initialLoading ? (
                <tr className="loading-row">
                  <td colSpan={8}>
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
                  <td className="mono-cell">{row.umRequestId}</td>
                  <td>{row.pharmacyDisplay}</td>
                  <td>{row.serviceLabel}</td>
                  <td className="badge-cell">
                    <LabsBadge variant={fulfillmentStateBadgeVariant(row.state)}>{formatFulfillmentState(row.state)}</LabsBadge>
                  </td>
                  <td>{formatNullableDateTime(row.clearToFillAt)}</td>
                  <td>{formatNullableDateTime(row.shipmentScheduledAt)}</td>
                  <td>
                    <button
                      className="row-action"
                      type="button"
                      onClick={(event) => {
                        setSelectedFulfillmentCaseId(row.id);
                        lastWorkflowButtonRef.current = event.currentTarget;
                        setWorkflowFulfillmentCaseId(row.id);
                      }}
                    >
                      Open workflow
                    </button>
                  </td>
                </tr>
              ))}
              {!initialLoading && rows.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={8}>
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
