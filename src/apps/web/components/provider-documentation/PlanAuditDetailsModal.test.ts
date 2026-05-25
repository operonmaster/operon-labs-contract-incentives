import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("plan audit details modal", () => {
  it("renders plan audit details with the shared modal treatment", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanAuditDetailsModal.tsx");

    expect(source).toContain('className="modal-backdrop audit-modal-backdrop"');
    expect(source).toContain('className="modal plan-audit-modal"');
    expect(source).toContain('role="dialog"');
    expect(source).toContain("PA preview and policy audit");
    expect(source).toContain("Close details");
    expect(source).toContain("Request type");
    expect(source).toContain("formatRequestType(row.requestType)");
    expect(source).toContain("Show policy criteria");
    expect(source).toContain("Expected");
    expect(source).toContain("Evidence value");
    expect(source).toContain("row.policyControls.join");
    expect(source).toContain("row.policyCriteria.map");
    expect(source).toContain("formatTransaction(row.transactionId)");
    expect(source).toContain("hashscan.io/testnet/transaction");
  });

  it("uses concise paid and blocked policy outcome labels", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanAuditDetailsModal.tsx");

    expect(source).toContain('return "Blocked";');
    expect(source).toContain('return "Paid";');
    expect(source).toMatch(/export function formatStatus[\s\S]*case "payment_failed":\n\s+return "Paid";/);
    expect(source).toMatch(/export function statusClass[\s\S]*case "payment_failed":\n\s+return "approved";/);
    expect(source).not.toContain("Blocked by policy");
    expect(source).not.toContain("Paid by policy");
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

    expect(source).not.toContain("<th>Reason</th>");
    expect(source).not.toContain("<td>{row.reason}</td>");
    expect(source).toContain('colSpan={9}');
  });

  it("does not auto-refresh the health plan incentives worklist", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PlanIncentivesConsole.tsx");

    expect(source).toContain('onClick={() => void refreshRows("manual")}');
    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("clearInterval");
    expect(source).not.toContain('"poll"');
  });
});
