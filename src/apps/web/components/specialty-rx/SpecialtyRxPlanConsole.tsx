"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SpecialtyRxPlanAuditRow } from "../../lib/specialty-rx-workflow";
import { LabsBadge, LabsHero, LabsPageShell } from "../labs-ui";
import { SpecialtyRxUseCaseNavigation } from "./SpecialtyRxUseCaseNavigation";
import { SpecialtyRxPlanDetailsModal } from "./SpecialtyRxPlanDetailsModal";
import {
  businessPolicyStatusBadgeVariant,
  formatBusinessPolicyStatus,
  formatFulfillmentState,
  formatPaymentPolicyStatus,
  formatSlaStatus,
  fulfillmentStateBadgeVariant,
  paymentPolicyStatusBadgeVariant,
  specialtySlaBadgeVariant
} from "./specialty-rx-formatters";

interface SpecialtyRxPlanRowsResponse {
  rows: SpecialtyRxPlanAuditRow[];
}

type RefreshSource = "initial" | "manual";

export function SpecialtyRxPlanConsole({
  initialFulfillmentCaseId = null
}: {
  initialFulfillmentCaseId?: string | null;
}) {
  const requestedFulfillmentCaseId = initialFulfillmentCaseId;
  const [rows, setRows] = useState<SpecialtyRxPlanAuditRow[]>([]);
  const [selectedFulfillmentCaseId, setSelectedFulfillmentCaseId] = useState<string | null>(null);
  const [detailsFulfillmentCaseId, setDetailsFulfillmentCaseId] = useState<string | null>(null);
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
      const response = await fetch("/api/specialty-rx/plan", {
        cache: "no-store"
      });
      const payload = (await response.json()) as SpecialtyRxPlanRowsResponse | { error?: string };

      if (!mountedRef.current || requestId !== refreshSequenceRef.current) {
        return;
      }

      if (!response.ok || !("rows" in payload)) {
        setError("error" in payload && payload.error ? payload.error : "Unable to load specialty fulfillment plan rows");
        return;
      }

      setRows(payload.rows);
      setSelectedFulfillmentCaseId((currentFulfillmentCaseId) => {
        if (
          requestedFulfillmentCaseId &&
          payload.rows.some((row) => row.fulfillmentCaseId === requestedFulfillmentCaseId)
        ) {
          return requestedFulfillmentCaseId;
        }

        if (currentFulfillmentCaseId && payload.rows.some((row) => row.fulfillmentCaseId === currentFulfillmentCaseId)) {
          return currentFulfillmentCaseId;
        }

        return payload.rows[0]?.fulfillmentCaseId ?? null;
      });
    } catch {
      if (mountedRef.current && requestId === refreshSequenceRef.current) {
        setError("Unable to load specialty fulfillment plan rows");
      }
    } finally {
      if (mountedRef.current && source === "initial") {
        setInitialLoading(false);
      }

      if (mountedRef.current && source === "manual") {
        setRefreshing(false);
      }
    }
  }, [requestedFulfillmentCaseId]);

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

  const detailsRow = rows.find((row) => row.fulfillmentCaseId === detailsFulfillmentCaseId) ?? null;

  return (
    <LabsPageShell className="workspace specialty-rx-console specialty-rx-plan-console">
      <div className="top-nav-row">
        <Link className="back" href="/">
          Back to demos
        </Link>
        <SpecialtyRxUseCaseNavigation
          activeView="plan"
          fulfillmentCaseId={selectedFulfillmentCaseId ?? requestedFulfillmentCaseId}
        />
      </div>

      <LabsHero compact eyebrow="Health plan specialty fulfillment audit" title="Specialty fulfillment SLA events">
        <p>Track post-approval specialty fulfillment milestones, SLA outcomes, and policy-bound settlement results.</p>
      </LabsHero>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>Specialty fulfillment policy log</h2>
            <p>{rows.length === 1 ? "1 specialty fulfillment event loaded" : `${rows.length} specialty fulfillment events loaded`}</p>
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
          <table className="worklist specialty-rx-plan-worklist">
            <thead>
              <tr>
                <th>Fulfillment case ID</th>
                <th>Linked PA</th>
                <th>Pharmacy</th>
                <th>State</th>
                <th className="badge-cell">Schedule SLA</th>
                <th className="badge-cell">Delivery SLA</th>
                <th className="badge-cell">Business Policy</th>
                <th className="badge-cell">Payment Policy</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {initialLoading ? (
                <tr className="loading-row">
                  <td colSpan={9}>
                    <div className="loading-indicator" role="status" aria-live="polite">
                      <span className="loading-dot" aria-hidden="true" />
                      <span>Loading specialty fulfillment plan audit rows</span>
                    </div>
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr
                  key={row.fulfillmentCaseId}
                  className={row.fulfillmentCaseId === selectedFulfillmentCaseId ? "selected" : ""}
                >
                  <td className="mono-cell">{row.fulfillmentCaseId}</td>
                  <td className="mono-cell">{row.umRequestId}</td>
                  <td>{row.pharmacyDisplay}</td>
                  <td className="badge-cell">
                    <LabsBadge variant={fulfillmentStateBadgeVariant(row.state)}>{formatFulfillmentState(row.state)}</LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={specialtySlaBadgeVariant(row.scheduleSlaStatus)}>
                      {formatSlaStatus(row.scheduleSlaStatus)}
                    </LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={specialtySlaBadgeVariant(row.deliverySlaStatus)}>
                      {formatSlaStatus(row.deliverySlaStatus)}
                    </LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={businessPolicyStatusBadgeVariant(row.businessPolicyStatus)}>
                      {formatBusinessPolicyStatus(row.businessPolicyStatus)}
                    </LabsBadge>
                  </td>
                  <td className="badge-cell">
                    <LabsBadge variant={paymentPolicyStatusBadgeVariant(row.paymentPolicyStatus)}>
                      {formatPaymentPolicyStatus(row.paymentPolicyStatus)}
                    </LabsBadge>
                  </td>
                  <td>
                    <button
                      className="row-action"
                      type="button"
                      onClick={() => {
                        setSelectedFulfillmentCaseId(row.fulfillmentCaseId);
                        setDetailsFulfillmentCaseId(row.fulfillmentCaseId);
                      }}
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
              {!initialLoading && rows.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={9}>
                    No specialty fulfillment events have been submitted to the plan audit log.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {detailsRow ? <SpecialtyRxPlanDetailsModal row={detailsRow} onClose={() => setDetailsFulfillmentCaseId(null)} /> : null}
    </LabsPageShell>
  );
}
