import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DelegateUseCaseNavigation } from "../delegate-um/DelegateUseCaseNavigation";
import type { PolicySummary } from "../../lib/policy-view-model";
import { PolicyConsole } from "./PolicyConsole";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("provider documentation policy console", () => {
  it("adds a policies view to the use-case navigation and preserves UM request context", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/UseCaseNavigation.tsx");
    const consoleSource = readRepoFile("src/apps/web/components/provider-documentation/PolicyConsole.tsx");

    expect(source).toContain('type UseCaseView = "provider" | "plan" | "policies"');
    expect(source).toContain("policiesHref");
    expect(source).toContain("/provider-documentation/policies");
    expect(source).toContain("umRequestId?: string | null");
    expect(source).toContain("?umRequestId=");
    expect(source).not.toContain("?caseId=");
    expect(source).not.toContain("caseId?: string | null");
    expect(source).not.toContain("?? caseId");
    expect(consoleSource).toContain("<UseCaseNavigation activeView=\"policies\" umRequestId={initialUmRequestId} />");
    expect(consoleSource).not.toContain("caseId={initialCaseId}");
    expect(source).toContain("Policies View");
    expect(source).toContain('activeView === "policies"');
  });

  it("renders policy details through the established modal pattern", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PolicyConsole.tsx");

    expect(source).toContain("PolicyDetailsModal");
    expect(source).toContain("title = \"Provider Documentation Completeness Policies\"");
    expect(source).toContain("eyebrow = \"Policy catalog\"");
    expect(source).toContain("boundaryStatement = policyBoundaryStatement");
    expect(source).toContain("Provider Documentation Completeness Policies");
    expect(source).toContain("plan/provider/request-type incentive policy");
    expect(source).toContain("incentive structure only");
    expect(source).toContain("centrally maintained payment policy blocks");
    expect(source).toContain('className="modal-backdrop audit-modal-backdrop"');
    expect(source).toContain("business-policy-details-modal");
    expect(source).toContain("payment-policy-details-modal");
    expect(source).toContain("business-policy-modal-sections");
    expect(source).toContain("PolicyDetailBadgeItem");
    expect(source).toContain("shouldRenderPolicyDetailBadges");
    expect(source).toContain("isContractPairBadgeItem");
    expect(source).toContain("shouldRenderPolicyDetailBadges(policy, section.title, item)");
    expect(source).toContain('sectionTitle === "Contract pair"');
    expect(source).toContain('item.startsWith("Plan: ") || item.startsWith("Provider: ")');
    expect(source).toContain('policy.category === "hedera"');
    expect(source).toContain('sectionTitle === "Enabled Agent Kit blocks"');
    expect(source).toContain("isPaymentPolicyIdentityBadgeItem");
    expect(source).toContain('item.startsWith("Plan: ")');
    expect(source).toContain("policy-detail-value-badges");
    expect(source).toContain("policy-detail-value-badge");
    expect(source).toContain("policy-detail-inline-content");
    expect(source).toContain("{detailItem.label}:");
    expect(source).toContain('variant={policyDetailValueBadgeVariant(value)}');
    expect(source).toContain('value === "Enabled"');
    expect(source).toContain('value === "Disabled"');
    expect(source).toContain('role="dialog"');
    expect(source).toContain("setSelectedPolicy(policy)");
    expect(source).toContain("Business policies");
    expect(source).toContain("Payment policies");
    expect(source).toContain("policyBoundaryStatement");
    expect(source).toContain("Plan-level Hedera Agent Kit settlement controls");
    expect(source).not.toContain('className="panel detail-panel"');
  });

  it("allows delegate policy pages to supply use-case-specific copy", () => {
    const source = readRepoFile("src/apps/web/components/provider-documentation/PolicyConsole.tsx");
    const delegatePageSource = readRepoFile("src/apps/web/app/delegate-um/policies/page.tsx");

    expect(source).toContain("title?: string");
    expect(source).toContain("eyebrow?: string");
    expect(source).toContain("boundaryStatement?: string");
    expect(source).toContain("businessPolicyDescription?: string");
    expect(source).toContain("paymentPolicyDescription?: string");
    expect(source).toContain("useCaseNavigation?: ReactNode");
    expect(source).toContain("{useCaseNavigation ?? <UseCaseNavigation activeView=\"policies\" umRequestId={initialUmRequestId} />}");
    expect(delegatePageSource).toContain("Delegate UM SLA Bonus Policies");
    expect(delegatePageSource).toContain("DelegateUseCaseNavigation");
    expect(delegatePageSource).toContain('activeView="policies"');
    expect(delegatePageSource).toContain("delegateUmSlaBonusBusinessPolicyType");
    expect(delegatePageSource).toContain("buildBusinessPolicyCards");
    expect(delegatePageSource).toContain("Business contract policies define delegate SLA bonus criteria by plan and request type");
    expect(delegatePageSource).toContain("Payment policies remain plan-level Hedera Agent Kit settlement controls");
  });

  it("renders delegate policy navigation, business policy cards, and payment policy cards", () => {
    const markup = renderToStaticMarkup(
      createElement(PolicyConsole, {
        businessPolicies: [delegateBusinessPolicy, delegateOutpatientBusinessPolicy],
        businessPolicyDescription: "Business contract policies define delegate SLA bonus criteria by plan and request type.",
        boundaryStatement: "Delegate UM policies describe plan/delegate SLA bonus agreements for delegated UM determinations.",
        eyebrow: "Delegate policy catalog",
        paymentPolicies: [paymentPolicy],
        paymentPolicyDescription: "Payment policies remain plan-level Hedera Agent Kit settlement controls.",
        initialUmRequestId: "PA-260526-0900-DELEGATE",
        title: "Delegate UM SLA Bonus Policies",
        useCaseNavigation: createElement(DelegateUseCaseNavigation, {
          activeView: "policies",
          umRequestId: "PA-260526-0900-DELEGATE"
        })
      })
    );

    expect(markup).toContain("Delegate UM SLA Bonus Policies");
    expect(markup).toContain("Delegate Vendor View");
    expect(markup).toContain("Health Plan View");
    expect(markup).toContain("Policies View");
    expect(markup).toContain("/delegate-um/plan?umRequestId=PA-260526-0900-DELEGATE");
    expect(markup).toContain("/delegate-um/policies");
    expect(markup).toContain("Pharmacy Benefit");
    expect(markup).toContain("Outpatient Service");
    expect(markup).toContain("24 hours");
    expect(markup).toContain("Acme Health PPO Agent Kit Settlement Policy");
    expect(markup).not.toContain("Provider Documentation Completeness Policies");
    expect(markup).not.toContain("outpatient_service");
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
    expect(styleSource).toContain(".business-policy-details-modal");
    expect(styleSource).toContain(".business-policy-details-modal .policy-detail-grid");
    expect(styleSource).toContain(".business-policy-details-modal .policy-modal-sections");
    expect(styleSource).toContain(".policy-detail-badged-item");
    expect(styleSource).toContain(".policy-detail-item-label");
    expect(styleSource).toContain(".policy-detail-inline-content");
    expect(styleSource).toContain(".policy-detail-value-badges");
    expect(styleSource).toContain(".policy-detail-value-badge");
    expect(styleSource).toMatch(/\.policy-detail-inline-content \{[^}]*align-items: center;/);
    expect(styleSource).toMatch(/\.policy-detail-inline-content \{[^}]*display: inline-flex;/);
    expect(styleSource).toMatch(/\.policy-detail-inline-content \{[^}]*flex-wrap: wrap;/);
    expect(styleSource).toMatch(/\.policy-detail-value-badge \{[^}]*font-family: inherit;/);
    expect(styleSource).toMatch(/\.policy-detail-value-badge \{[^}]*font-size: 12px;/);
    expect(styleSource).toMatch(/\.policy-detail-value-badge \{[^}]*font-style: inherit;/);
    expect(styleSource).toMatch(/\.policy-detail-value-badge \{[^}]*font-weight: inherit;/);
    expect(styleSource).toMatch(/\.policy-detail-value-badge \{[^}]*letter-spacing: inherit;/);
    expect(styleSource).toMatch(/\.policy-detail-value-badge \{[^}]*text-transform: inherit;/);
    const badgedItemStyle = styleSource.slice(styleSource.indexOf(".policy-detail-badged-item"), styleSource.indexOf(".policy-detail-inline-content"));
    expect(badgedItemStyle).not.toContain("display: flex;");
    expect(badgedItemStyle).not.toContain("list-style: none;");
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

const delegateBusinessPolicy: PolicySummary = {
  id: "delegate-um-sla-bonus-v1",
  title: "Delegate UM SLA Bonus",
  category: "business",
  source: "Plan/delegate contract policy",
  appliesTo: "Delegate UM SLA Bonus",
  payoutOrControl: "5 HBAR per eligible UM request",
  status: "Active",
  summary: "Delegate UM SLA bonus incentive for eligible determinations completed within the configured review window.",
  previewItems: [
    { label: "Policy ID", value: "delegate-um-sla-bonus-v1" },
    { label: "Plan", value: "Acme Health PPO" },
    { label: "Delegate", value: "Northstar UM" },
    { label: "Eligible request types", value: "Pharmacy Benefit" },
    { label: "SLA", value: "24 hours" },
    { label: "Payout", value: "5 HBAR" }
  ],
  detailSections: []
};

const delegateOutpatientBusinessPolicy: PolicySummary = {
  id: "delegate-um-acme-outpatient-sla-bonus-v1",
  title: "Delegate UM SLA Bonus",
  category: "business",
  source: "Plan/delegate contract policy",
  appliesTo: "Delegate UM SLA Bonus",
  payoutOrControl: "5 HBAR per eligible UM request",
  status: "Active",
  summary: "Delegate UM SLA bonus incentive for eligible determinations completed within the configured review window.",
  previewItems: [
    { label: "Policy ID", value: "delegate-um-acme-outpatient-sla-bonus-v1" },
    { label: "Plan", value: "Acme Health PPO" },
    { label: "Delegate", value: "Northstar UM" },
    { label: "Eligible request types", value: "Outpatient Service" },
    { label: "SLA", value: "24 hours" },
    { label: "Payout", value: "5 HBAR" }
  ],
  detailSections: []
};

const paymentPolicy: PolicySummary = {
  id: "hedera-agent-policy-acme-health-ppo",
  title: "Acme Health PPO Agent Kit Settlement Policy",
  category: "hedera",
  source: "Firestore paymentPolicies + @hashgraph/hedera-agent-kit hook",
  appliesTo: "Acme Health PPO autonomous settlements",
  payoutOrControl: "HBAR settlement, max 5 per request",
  status: "Active",
  summary: "Plan-level settlement controls selected from centrally maintained Hedera Agent Kit policy blocks.",
  previewItems: [
    { label: "Plan", value: "Acme Health PPO" },
    { label: "Token", value: "HBAR" }
  ],
  detailSections: []
};
