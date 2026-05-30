import type { ReactNode } from "react";
import type { PaymentPolicyControlEvidence } from "../lib/payment-policy-evidence-store";
import { LabsBadge } from "./labs-ui";

export interface EvidenceDisplayRow {
  id: string;
  label: string;
  expected?: string;
  actual?: string;
  actualVariant: "success" | "warning";
}

/** Shared "criterion/control vs actual" evidence table used by every plan audit detail modal. */
export function EvidenceRows({
  rows,
  emptyLabel
}: Readonly<{
  rows: EvidenceDisplayRow[];
  emptyLabel: string;
}>) {
  if (rows.length === 0) {
    return <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <div className="policy-criteria-table-wrap">
      <table className="policy-criteria-table policy-audit-evidence-table">
        <colgroup>
          <col />
          <col className="policy-audit-evidence-actual-column" />
        </colgroup>
        <thead>
          <tr>
            <th>Criterion/Control</th>
            <th className="badge-cell">Actual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.label}</strong>
                {hasEvidenceValue(row.expected) ? (
                  <span className="criterion-reason-code">Expected: {row.expected?.trim()}</span>
                ) : null}
              </td>
              <td className="badge-cell">
                <LabsBadge variant={row.actualVariant}>{formatActualValue(row)}</LabsBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function hasEvidenceValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function formatActualValue(row: EvidenceDisplayRow) {
  if (row.actual?.trim()) {
    return row.actual;
  }

  return row.actualVariant === "success" ? "Verified" : "Not verified";
}

export function controlStatusBadgeVariant(status: PaymentPolicyControlEvidence["status"]): "success" | "warning" {
  switch (status) {
    case "passed":
      return "success";
    case "failed":
    case "not_run":
      return "warning";
  }
}

/** Renders a Hedera testnet transaction id as a HashScan link (or a plain label for simulated/missing ids). */
export function formatTransaction(transactionId: string | null): ReactNode {
  if (!transactionId) {
    return "Not recorded";
  }

  if (transactionId.startsWith("testnet-")) {
    return transactionId;
  }

  return (
    <a
      className="transaction-link"
      href={`https://hashscan.io/testnet/transaction/${encodeURIComponent(transactionId)}`}
      target="_blank"
      rel="noreferrer"
    >
      {transactionId}
    </a>
  );
}
