import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("provider documentation policy console", () => {
  it("adds a policies view to the use-case navigation and preserves case context", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/UseCaseNavigation.tsx");

    expect(source).toContain('type UseCaseView = "provider" | "plan" | "policies"');
    expect(source).toContain("policiesHref");
    expect(source).toContain("/provider-documentation/policies");
    expect(source).toContain("Policies View");
    expect(source).toContain('activeView === "policies"');
  });

  it("renders policy details through the established modal pattern", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PolicyConsole.tsx");

    expect(source).toContain("PolicyDetailsModal");
    expect(source).toContain("Provider Documentation Completeness Policies");
    expect(source).toContain("plan/provider/request-type incentive policy");
    expect(source).toContain("incentive structure only");
    expect(source).toContain("centrally maintained payment policy blocks");
    expect(source).toContain('className="modal-backdrop audit-modal-backdrop"');
    expect(source).toContain("payment-policy-details-modal");
    expect(source).toContain('role="dialog"');
    expect(source).toContain("setSelectedPolicy(policy)");
    expect(source).toContain("Business policies");
    expect(source).toContain("Payment policies");
    expect(source).toContain("policyBoundaryStatement");
    expect(source).toContain("Plan-level Hedera Agent Kit settlement controls");
    expect(source).not.toContain('className="panel detail-panel"');
  });

  it("renders business and Hedera policies as same-size clickable card grids instead of tables", () => {
    const componentSource = readRepoFile("src/apps/web/components/provider-documentation/PolicyConsole.tsx");
    const styleSource = readRepoFile("src/apps/web/app/styles.css");

    expect(componentSource).toContain("PolicyCard");
    expect(componentSource).toContain("BusinessPolicyCard");
    expect(componentSource).toContain("policy.previewItems?.map");
    expect(componentSource).toContain("LabsBadge");
    expect(componentSource).toContain("policyStatusBadgeVariant(policy.status)");
    expect(componentSource).toContain("policy-card-preview-grid");
    expect(componentSource).toContain('className="policy-section-grid"');
    expect(componentSource).toContain("policy-card-grid");
    expect(componentSource).toContain("policy-card");
    expect(componentSource).toContain('className="policy-card-action"');
    expect(componentSource).not.toContain('<button className="policy-card"');
    expect(componentSource).not.toContain('<button className="policy-card business-policy-card"');
    expect(componentSource.slice(componentSource.indexOf("function BusinessPolicyCard"), componentSource.indexOf("function PolicyDetailsModal"))).not.toContain(
      "<strong>{policy.title}</strong>"
    );
    expect(componentSource.slice(componentSource.indexOf("function BusinessPolicyCard"), componentSource.indexOf("function PolicyDetailsModal"))).toContain(
      '<LabsBadge variant={policyStatusBadgeVariant(policy.status)}>{policy.status}</LabsBadge>'
    );
    expect(componentSource).not.toContain("policyStatusClassName");
    expect(componentSource).not.toContain("className={`status");
    expect(componentSource).not.toContain("policy-status-corner");
    expect(componentSource).toContain("businessPolicies.map");
    expect(componentSource).toContain("paymentPolicies.map");
    expect(componentSource).toContain('variant="payment"');
    expect(componentSource).toContain("policy-card-grid payment-policy-card-grid");
    expect(componentSource).toContain('className="policy-card payment-policy-card"');
    expect(componentSource).toContain("setSelectedPolicy(policy)");
    expect(componentSource).not.toContain("<table");
    expect(componentSource).not.toContain("worklist policy-table");
    expect(componentSource).not.toContain('dt>{policy.category === "business" ? "Applies to"');
    expect(componentSource).not.toContain("Active, auto-settlement");

    expect(styleSource).toContain(".policy-card-grid");
    expect(styleSource).toContain(".payment-policy-card-grid");
    expect(styleSource).toContain(".payment-policy-card .policy-card-preview-grid");
    expect(styleSource).toContain(".payment-policy-details-modal");
    expect(styleSource).toContain(".payment-policy-details-modal .policy-detail-grid");
    expect(styleSource).toContain(".payment-policy-details-modal .policy-modal-sections");
    expect(styleSource).not.toContain(".policy-status-corner");
    expect(styleSource).toContain(".policy-card-preview-grid");
    expect(styleSource).toContain("grid-template-columns: repeat(4, minmax(0, 1fr));");
    expect(styleSource).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(styleSource).toContain("grid-auto-rows: 1fr;");
    expect(styleSource).toContain("min-height: 260px;");
    expect(styleSource).toContain("min-height: 220px;");
  });

  it("adds a dynamic policies route backed by Firestore policy data", () => {
    const source = readRepoFile("src/apps/web/app/provider-documentation/policies/page.tsx");

    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain("PolicyConsole");
    expect(source).toContain("policyStore.listPolicies");
    expect(source).toContain("paymentPolicyStore.listPolicies");
    expect(source).toContain("providerDocumentationBusinessPolicyType");
    expect(source).toContain("buildProviderDocumentationBusinessPolicyCards");
    expect(source).toContain("buildHederaAgentKitPlanPolicyCards");
    expect(source).not.toContain("delegate_um_sla_bonus");
    expect(source).not.toContain("appeals_packet_quality");
    expect(source).not.toContain("provider_directory_quality");
  });
});
