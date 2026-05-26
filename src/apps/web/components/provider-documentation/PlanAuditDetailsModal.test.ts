import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("plan audit details modal", () => {
  it("renders plan audit details with the shared modal treatment", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanAuditDetailsModal.tsx");

    expect(source).toContain("LabsBadge");
    expect(source).toContain('className="modal-backdrop audit-modal-backdrop"');
    expect(source).toContain('className="modal plan-audit-modal"');
    expect(source).toContain('role="dialog"');
    expect(source).toContain("PA preview and policy audit");
    expect(source).toContain("Close details");
    expect(source).toContain("Request type");
    expect(source).toContain("formatRequestType(row.requestType)");
    expect(source).toContain("<dt>UM status</dt>");
    expect(source).toContain("formatUmStatus(row)");
    expect(source).toContain("Payment intent");
    expect(source).toContain('row.paymentIntentId ?? "Not recorded"');
    expect(source).toContain("Show policy criteria");
    expect(source).toContain("Expected");
    expect(source).toContain("Evidence value");
    expect(source).toContain("row.policyControls.join");
    expect(source).toContain("row.policyCriteria.map");
    expect(source).toContain("formatTransaction(row.transactionId)");
    expect(source).toContain("hashscan.io/testnet/transaction");
  });

  it("uses approved and rejected terminology for business policy outcomes", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanAuditDetailsModal.tsx");

    expect(source).toContain('return "Rejected";');
    expect(source).toContain('return "Approved";');
    expect(source).toContain("<dt>Business policy</dt>");
    expect(source).toContain('variant={businessPolicyBadgeVariant(row.incentiveStatus)}');
    expect(source).toMatch(/export function formatStatus[\s\S]*case "payment_failed":\n\s+return "Rejected";/);
    expect(source).toMatch(/export function businessPolicyBadgeVariant[\s\S]*case "payment_failed":\n\s+return "warning";/);
    expect(source).not.toContain("Blocked by policy");
    expect(source).not.toContain("Paid by policy");
    expect(source).not.toContain("<dt>Policy outcome</dt>");
  });

  it("opens details from the worklist instead of rendering a detail panel below the table", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx");

    expect(source).toContain("PlanAuditDetailsModal");
    expect(source).toContain("formatRequestType(row.requestType)");
    expect(source).toContain("setDetailsCaseId(row.caseId)");
    expect(source).not.toContain('className="panel detail-panel"');
  });

  it("keeps the incentives worklist concise without a reason column", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx");

    expect(source).toContain("<th>Health Plan</th>");
    expect(source).toMatch(/<th>Health Plan<\/th>\s*<th>Provider group<\/th>/);
    expect(source).toContain('<th className="badge-cell">Business Policy</th>');
    expect(source).toContain('<th className="badge-cell">Payment Policy</th>');
    expect(source).toContain('<td className="badge-cell">');
    expect(source).toContain("<th>Payment</th>");
    expect(source).toContain("formatBusinessPolicyOutcome(row)");
    expect(source).toContain("formatPaymentPolicyOutcome(row)");
    expect(source).toContain("LabsBadge");
    expect(source).toContain('variant={businessPolicyBadgeVariant(row.incentiveStatus)}');
    expect(source).toContain('variant={paymentPolicyBadgeVariant(row)}');
    expect(source).toContain('formatPaymentPolicyOutcome(row) || null');
    expect(source).toContain('return "Approved";');
    expect(source).toContain('return "Rejected";');
    expect(source).toMatch(/function businessPolicyBadgeVariant[\s\S]*case "payment_failed":\n\s+return "warning";/);
    expect(source).toContain('return "";');
    expect(source).toContain("formatPaymentAmount(row)");
    expect(source).toContain("row.planDisplay ?? row.planId ??");
    expect(source).not.toContain("<th>Reason</th>");
    expect(source).not.toContain("<th>Service</th>");
    expect(source).not.toContain("<td>{row.serviceLabel}</td>");
    expect(source).not.toContain("<td>{row.reason}</td>");
    expect(source).not.toContain("<th>PA result</th>");
    expect(source).not.toContain("<th>Policy outcome</th>");
    expect(source).not.toContain("<th>Value</th>");
    expect(source).not.toContain("formatPaResult(row.paResult)");
    expect(source).not.toContain("formatPaymentStatus(row)");
    expect(source).not.toContain('return "Not run";');
    expect(source).toContain('colSpan={8}');
  });

  it("renders a visible loading state inside the incentives worklist", () => {
    const componentSource = readRepoFile("src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx");
    const styleSource = readRepoFile("src/apps/web/app/styles.css");

    expect(componentSource).toContain('className="loading-row"');
    expect(componentSource).toContain('role="status"');
    expect(componentSource).toContain("Loading submitted PA events");
    expect(componentSource).toContain('className="loading-indicator"');
    expect(componentSource).toContain('className="loading-dot"');
    expect(styleSource).toContain(".loading-row");
    expect(styleSource).toContain(".loading-indicator");
    expect(styleSource).toContain("@keyframes loading-pulse");
  });

  it("does not auto-refresh the health plan incentives worklist", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx");

    expect(source).toContain('onClick={() => void refreshRows("manual")}');
    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("clearInterval");
    expect(source).not.toContain('"poll"');
  });
});
