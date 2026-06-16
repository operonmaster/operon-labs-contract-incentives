"use client";

import Link from "next/link";
import { Children, useState, type ReactNode } from "react";
import type { PolicySummary } from "../../lib/policy-view-model";
import { policyBoundaryStatement } from "../../lib/policy-view-model";
import { LabsBadge, LabsButton, LabsHero, LabsModal, LabsPageShell } from "../labs-ui";
import { UseCaseNavigation } from "./UseCaseNavigation";

interface PolicyConsoleProps {
  businessPolicies: PolicySummary[];
  businessPolicyDescription?: string;
  businessPolicyEmptyMessage?: string;
  boundaryStatement?: string;
  eyebrow?: string;
  paymentPolicies: PolicySummary[];
  paymentPolicyDescription?: string;
  paymentPolicyEmptyMessage?: string;
  initialUmRequestId?: string | null;
  title?: string;
  useCaseNavigation?: ReactNode;
}

type PolicyBadgeVariant = "success" | "warning" | "info" | "neutral";

interface BusinessPolicyExplainerBadgeItem {
  label: string;
  value: string;
  variant: PolicyBadgeVariant;
}

interface BusinessPolicyExplainerGateItem {
  label: string;
  values: string[];
  variant: PolicyBadgeVariant;
}

interface BusinessPolicyExplainerGateGroup {
  title: string;
  items: BusinessPolicyExplainerGateItem[];
}

interface BusinessPolicyExplainerReferenceItem {
  label: string;
  values: string[];
  variant: PolicyBadgeVariant;
}

interface BusinessPolicyExplainerBottomCard {
  title: string;
  items: BusinessPolicyExplainerReferenceItem[];
}

export interface BusinessPolicyExplainerModel {
  configuredOutcome: string;
  contextItems: BusinessPolicyExplainerBadgeItem[];
  gateGroups: BusinessPolicyExplainerGateGroup[];
  bottomCards: BusinessPolicyExplainerBottomCard[];
}

export function PolicyConsole({
  businessPolicies,
  businessPolicyDescription = "Each business card is one complete plan/provider/request-type incentive policy. Coverage determinations stay in the UM workflow; this view shows incentive structure only.",
  businessPolicyEmptyMessage = "No active business policies are available.",
  boundaryStatement = policyBoundaryStatement,
  eyebrow = "Policy catalog",
  paymentPolicies,
  paymentPolicyDescription = "Plan-level Hedera Agent Kit settlement controls selected from centrally maintained payment policy blocks.",
  paymentPolicyEmptyMessage = "No active payment policy controls are available.",
  initialUmRequestId = null,
  title = "Provider Documentation Completeness Policies",
  useCaseNavigation
}: PolicyConsoleProps) {
  const [selectedPolicy, setSelectedPolicy] = useState<PolicySummary | null>(null);

  return (
    <LabsPageShell className="workspace policy-console">
      <div className="top-nav-row">
        <Link className="back" href="/">
          Back to demos
        </Link>
        {useCaseNavigation ?? <UseCaseNavigation activeView="policies" umRequestId={initialUmRequestId} />}
      </div>

      <LabsHero compact eyebrow={eyebrow} title={title}>
        <p>{boundaryStatement}</p>
      </LabsHero>

      <div className="policy-section-grid">
        <PolicySection
          title="Business policies"
          description={businessPolicyDescription}
          emptyMessage={businessPolicyEmptyMessage}
        >
          {businessPolicies.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} onSelect={(policy) => setSelectedPolicy(policy)} />
          ))}
        </PolicySection>

        <PolicySection
          title="Payment policies"
          description={paymentPolicyDescription}
          emptyMessage={paymentPolicyEmptyMessage}
          variant="payment"
        >
          {paymentPolicies.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} onSelect={(policy) => setSelectedPolicy(policy)} />
          ))}
        </PolicySection>
      </div>

      {selectedPolicy ? <PolicyDetailsModal policy={selectedPolicy} onClose={() => setSelectedPolicy(null)} /> : null}
    </LabsPageShell>
  );
}

function PolicySection({
  children,
  description,
  emptyMessage,
  title,
  variant = "default"
}: {
  children: ReactNode;
  description: string;
  emptyMessage: string;
  title: string;
  variant?: "default" | "payment";
}) {
  const gridClassName = variant === "payment" ? "policy-card-grid payment-policy-card-grid" : "policy-card-grid";

  return (
    <section className="policy-card-section">
      <div className="toolbar">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className={gridClassName}>{children}</div>
      {Children.count(children) === 0 ? <p className="empty-state policy-empty-state">{emptyMessage}</p> : null}
    </section>
  );
}

function PolicyCard({
  onSelect,
  policy
}: {
  // eslint-disable-next-line no-unused-vars -- Callback parameter name documents the selected policy object.
  onSelect: (policy: PolicySummary) => void;
  policy: PolicySummary;
}) {
  if (policy.category === "business") {
    return <BusinessPolicyCard onSelect={onSelect} policy={policy} />;
  }

  return (
    <article className="policy-card payment-policy-card">
      <span className="eyebrow">Payment policy</span>
      <strong>{policy.title}</strong>
      <span className="policy-summary">{policy.summary}</span>
      <dl className="policy-card-preview-grid">
        {policy.previewItems?.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <span className="policy-card-footer">
        <LabsBadge variant={policyStatusBadgeVariant(policy.status)}>{policy.status}</LabsBadge>
        <button className="policy-card-action" type="button" onClick={() => onSelect(policy)}>
          View details
        </button>
      </span>
    </article>
  );
}

function BusinessPolicyCard({
  onSelect,
  policy
}: {
  // eslint-disable-next-line no-unused-vars -- Callback parameter name documents the selected policy object.
  onSelect: (policy: PolicySummary) => void;
  policy: PolicySummary;
}) {
  return (
    <article className="policy-card business-policy-card">
      <span className="eyebrow">Business policy</span>
      <dl className="policy-card-preview-grid">
        {policy.previewItems?.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <span className="policy-card-footer">
        <LabsBadge variant={policyStatusBadgeVariant(policy.status)}>{policy.status}</LabsBadge>
        <button className="policy-card-action" type="button" onClick={() => onSelect(policy)}>
          View details
        </button>
      </span>
    </article>
  );
}

function policyStatusBadgeVariant(status: string): "success" | "warning" | "neutral" {
  if (status === "Active") {
    return "success";
  }

  if (status === "Disabled") {
    return "warning";
  }

  return "neutral";
}

function PolicyDetailsModal({ onClose, policy }: { onClose: () => void; policy: PolicySummary }) {
  const isBusinessPolicy = policy.category === "business";
  const modalClassName = `plan-audit-modal policy-details-modal ${
    isBusinessPolicy ? "business-policy-details-modal" : "payment-policy-details-modal"
  }`;
  const sectionsClassName = `policy-modal-sections ${
    isBusinessPolicy ? "business-policy-modal-sections" : "payment-policy-modal-sections"
  }`;

  return (
    <LabsModal
      onClose={onClose}
      labelledBy="policy-details-title"
      className={modalClassName}
      backdropClassName="audit-modal-backdrop"
    >
      {isBusinessPolicy ? (
        <BusinessPolicyExplainerModalContent onClose={onClose} policy={policy} />
      ) : (
        <>
      <div className="modal-toolbar">
          <div>
            <span className="eyebrow">{policy.category === "business" ? "Business policy" : "Payment policy"}</span>
            <h2 id="policy-details-title">{policy.title}</h2>
            <p>{policy.summary}</p>
          </div>
          <LabsButton variant="row" onClick={onClose}>
            Close details
          </LabsButton>
        </div>

        <dl className="detail-grid policy-detail-grid">
          <div>
            <dt>Source</dt>
            <dd>{policy.source}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>{policy.appliesTo}</dd>
          </div>
          <div>
            <dt>{policy.category === "business" ? "Payment" : "Control"}</dt>
            <dd>{policy.payoutOrControl}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <LabsBadge variant={policyStatusBadgeVariant(policy.status)}>{policy.status}</LabsBadge>
            </dd>
          </div>
        </dl>

        <div className={sectionsClassName}>
          {policy.detailSections.map((section) => (
            <section className="policy-modal-section" key={section.title}>
              <h3>{section.title}</h3>
              <ul>
                {section.items.map((item) => (
                  shouldRenderPolicyDetailBadges(policy, section.title, item) ? (
                    <PolicyDetailBadgeItem item={item} key={item} />
                  ) : (
                    <li key={item}>{item}</li>
                  )
                ))}
              </ul>
            </section>
          ))}
        </div>
        </>
      )}
    </LabsModal>
  );
}

function BusinessPolicyExplainerModalContent({ onClose, policy }: { onClose: () => void; policy: PolicySummary }) {
  const model = buildBusinessPolicyExplainerModel(policy);

  return (
    <>
      <div className="modal-toolbar business-policy-explainer-toolbar">
        <div>
          <span className="eyebrow">Business policy</span>
          <h2 id="policy-details-title">{policy.title}</h2>
          <p>{policy.summary}</p>
        </div>
        <LabsButton variant="row" onClick={onClose}>
          Close details
        </LabsButton>
      </div>

      <section className="policy-configured-outcome" aria-label="Configured outcome">
        <span>Configured outcome</span>
        <strong>{model.configuredOutcome}</strong>
      </section>

      <dl className="policy-explainer-context-grid">
        {model.contextItems.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>
              <LabsBadge className="policy-detail-value-badge" variant={item.variant}>
                {item.value}
              </LabsBadge>
            </dd>
          </div>
        ))}
      </dl>

      <section className="policy-explainer-section">
        <div className="policy-explainer-section-heading">
          <span className="eyebrow">Evaluation gates</span>
          <p>The policy approves only when all configured scope filters and documentation requirements match the submitted UM request.</p>
        </div>

        <div className="policy-explainer-gate-grid">
          {model.gateGroups.map((group) => (
            <section className="policy-explainer-gate-group" key={group.title}>
              <span>{group.title}</span>
              <ul>
                {group.items.map((item) => (
                  <li key={item.label}>
                    <strong>{item.label}</strong>
                    <PolicyExplainerValueBadges values={item.values} variant={item.variant} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section className="policy-explainer-bottom-grid" aria-label="Payment and policy reference">
        {model.bottomCards.map((card) => (
          <section className="policy-explainer-bottom-card" key={card.title}>
            <span>{card.title}</span>
            <dl>
              {card.items.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>
                    <PolicyExplainerValueBadges values={item.values} variant={item.variant} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </section>
    </>
  );
}

function PolicyExplainerValueBadges({
  values,
  variant
}: {
  values: string[];
  variant: PolicyBadgeVariant;
}) {
  return (
    <span className="policy-detail-value-badges">
      {values.map((value) => (
        <LabsBadge className="policy-detail-value-badge" key={value} variant={variant}>
          {value}
        </LabsBadge>
      ))}
    </span>
  );
}

export function buildBusinessPolicyExplainerModel(policy: PolicySummary): BusinessPolicyExplainerModel {
  return {
    configuredOutcome: businessPolicyConfiguredOutcome(policy),
    contextItems: businessPolicyContextItems(policy),
    gateGroups: businessPolicyGateGroups(policy),
    bottomCards: businessPolicyBottomCards(policy)
  };
}

function businessPolicyConfiguredOutcome(policy: PolicySummary) {
  const payoutAmount = extractPrimaryPayoutAmount(policy.payoutOrControl);

  if (policy.appliesTo === "Provider Documentation Completeness") {
    return `Pays ${payoutAmount} when an eligible PA request has the required DTR documentation and passes covered-benefit checks.`;
  }

  if (policy.appliesTo === "Delegate UM SLA Bonus") {
    return `Pays ${payoutAmount} when a delegated UM determination is completed within the configured SLA with audit-ready clinical review evidence.`;
  }

  if (policy.appliesTo === "Specialty Rx Fulfillment SLA") {
    return `Pays ${payoutAmount} when an approved pharmacy PA is fulfilled without avoidable exceptions and the shipment is scheduled within the fulfillment SLA.`;
  }

  if (policy.appliesTo === "Appeals Packet Quality") {
    return `Pays ${payoutAmount} when an appeal packet is ready within the packet-readiness SLA and passes quality controls, without rewarding appeal outcome.`;
  }

  return `Pays ${payoutAmount} when all configured business-policy gates pass.`;
}

function businessPolicyContextItems(policy: PolicySummary): BusinessPolicyExplainerBadgeItem[] {
  const contractItems = parsedSectionItems(policy, "Contract pair");
  const plan = cleanDisplayValue(findParsedValue(contractItems, "Plan") ?? policy.appliesTo);
  const partner = contractItems.find((item) => ["Provider", "Delegate", "Pharmacy", "Submitter"].includes(item.label));

  return [
    { label: "Plan", value: plan, variant: "success" },
    { label: partner?.label ?? "Partner", value: cleanDisplayValue(partner?.value ?? policy.source), variant: "success" },
    { label: "Status", value: policy.status, variant: policyStatusBadgeVariant(policy.status) }
  ];
}

function businessPolicyGateGroups(policy: PolicySummary): BusinessPolicyExplainerGateGroup[] {
  if (policy.appliesTo === "Delegate UM SLA Bonus") {
    return delegateUmPolicyGateGroups(policy);
  }

  if (policy.appliesTo === "Specialty Rx Fulfillment SLA") {
    return specialtyRxPolicyGateGroups(policy);
  }

  if (policy.appliesTo === "Appeals Packet Quality") {
    return appealsPolicyGateGroups(policy);
  }

  const criteriaItems = parsedSectionItems(policy, "Eligibility criteria");
  const coverageItems: BusinessPolicyExplainerGateItem[] = [];
  const documentationItems: BusinessPolicyExplainerGateItem[] = [];
  const requestScopeItems = businessPolicyRequestScopeItems(policy);

  for (const item of criteriaItems) {
    if (item.label === "Applies only to covered benefits") {
      coverageItems.push({
        label: "Applies only to covered benefits",
        values: [cleanBooleanValue(item.value)],
        variant: policyDetailValueBadgeVariant(cleanBooleanValue(item.value))
      });
    } else if (item.label === "Requires DTR completion when requested") {
      documentationItems.push({
        label: "DTR completion required when requested",
        values: [cleanBooleanValue(item.value)],
        variant: policyDetailValueBadgeVariant(cleanBooleanValue(item.value))
      });
    } else {
      coverageItems.push({
        label: item.label,
        values: splitPolicyDetailValues(item.value).map(cleanDisplayValue),
        variant: policyDetailValueBadgeVariant(cleanBooleanValue(item.value))
      });
    }
  }

  return compactGateGroups([
    {
      title: "Request scope",
      items: requestScopeItems
    },
    {
      title: "Coverage requirements",
      items: coverageItems
    },
    {
      title: "Documentation requirements",
      items: documentationItems
    }
  ]);
}

function delegateUmPolicyGateGroups(policy: PolicySummary): BusinessPolicyExplainerGateGroup[] {
  const reviewEvidenceItems = parsedSectionItems(policy, "Eligibility criteria").map(criteriaGateItem);
  const sla = findPreviewValue(policy, "SLA");

  return compactGateGroups([
    {
      title: "Request scope",
      items: businessPolicyRequestScopeItems(policy)
    },
    {
      title: "SLA performance",
      items: sla
        ? [
            {
              label: "Determination completed within SLA",
              values: [sla],
              variant: "success"
            }
          ]
        : []
    },
    {
      title: "Review evidence",
      items: reviewEvidenceItems
    }
  ]);
}

function specialtyRxPolicyGateGroups(policy: PolicySummary): BusinessPolicyExplainerGateGroup[] {
  const criteriaItems = parsedSectionItems(policy, "Eligibility criteria");

  return compactGateGroups([
    {
      title: "Request scope",
      items: businessPolicyRequestScopeItems(policy)
    },
    {
      title: "Fulfillment SLA",
      items: criteriaItems
        .filter((item) =>
          ["Fulfillment SLA met by shipment scheduling", "Delivery closure evidence recorded"].includes(item.label)
        )
        .map(criteriaGateItem)
    },
    {
      title: "Specialty controls",
      items: criteriaItems
        .filter((item) =>
          [
            "Cold-chain evidence required when applicable",
            "REMS authorization required when applicable",
            "No avoidable fulfillment exception"
          ].includes(item.label)
        )
        .map(criteriaGateItem)
    }
  ]);
}

function appealsPolicyGateGroups(policy: PolicySummary): BusinessPolicyExplainerGateGroup[] {
  const criteriaItems = parsedSectionItems(policy, "Eligibility criteria");

  return compactGateGroups([
    {
      title: "Request scope",
      items: businessPolicyRequestScopeItems(policy)
    },
    {
      title: "Packet SLA",
      items: criteriaItems
        .filter((item) =>
          ["Appeal receipt starts packet-readiness SLA", "Acknowledgement is a sub-SLA"].includes(item.label)
        )
        .map(criteriaGateItem)
    },
    {
      title: "Quality guardrails",
      items: criteriaItems
        .filter((item) =>
          [
            "Packet quality audit required",
            "No appeal outcome incentive",
            "No cost savings or denial reversal metric"
          ].includes(item.label)
        )
        .map(criteriaGateItem)
    }
  ]);
}

function businessPolicyRequestScopeItems(policy: PolicySummary): BusinessPolicyExplainerGateItem[] {
  const scopeItems = parsedSectionItems(policy, "Incentive scope");
  const requestScopeItems: BusinessPolicyExplainerGateItem[] = [];

  for (const item of scopeItems) {
    if (item.label === "Eligible request types") {
      requestScopeItems.push({
        label: "Request type is eligible",
        values: splitPolicyDetailValues(item.value).map(cleanRequestTypeValue),
        variant: "success"
      });
    } else if (item.label === "Included service codes") {
      requestScopeItems.push({
        label: "Service code is included",
        values: splitPolicyDetailValues(item.value).map(cleanServiceCodeValue),
        variant: "success"
      });
    } else {
      requestScopeItems.push({
        label: item.label,
        values: splitPolicyDetailValues(item.value).map(cleanDisplayValue),
        variant: "success"
      });
    }
  }

  return requestScopeItems;
}

function criteriaGateItem(item: ReturnType<typeof parsePolicyDetailItem>): BusinessPolicyExplainerGateItem {
  const value = cleanBooleanValue(item.value);

  return {
    label: item.label,
    values: [value],
    variant: policyDetailValueBadgeVariant(value)
  };
}

function compactGateGroups(groups: BusinessPolicyExplainerGateGroup[]) {
  return groups.filter((group) => group.items.length > 0);
}

function businessPolicyBottomCards(policy: PolicySummary): BusinessPolicyExplainerBottomCard[] {
  const paymentItems = businessPolicyPaymentItems(policy);
  const referenceItems = businessPolicyReferenceItems(policy);
  const settlementItems = businessPolicySettlementItems(policy);

  return [
    { title: "Payment", items: paymentItems },
    { title: "Policy reference", items: referenceItems },
    { title: "Settlement", items: settlementItems }
  ].filter((card) => card.items.length > 0);
}

function businessPolicyPaymentItems(policy: PolicySummary): BusinessPolicyExplainerReferenceItem[] {
  const payoutItems = parsedSectionItems(policy, "Payout");
  const amount = findParsedValue(payoutItems, "Amount per eligible request") ?? policy.payoutOrControl;
  const monthlyCap = findParsedValue(payoutItems, "Monthly cap");
  const items: BusinessPolicyExplainerReferenceItem[] = [
    { label: "Payout rule", values: [cleanDisplayValue(amount)], variant: "success" }
  ];

  if (monthlyCap) {
    items.push({ label: "Monthly control", values: [cleanDisplayValue(monthlyCap)], variant: "success" });
  }

  return items;
}

function businessPolicyReferenceItems(policy: PolicySummary): BusinessPolicyExplainerReferenceItem[] {
  const identityItems = parsedSectionItems(policy, "Policy identity");
  const contractItems = parsedSectionItems(policy, "Contract pair");
  const policyId = findParsedValue(identityItems, "Policy ID") ?? policy.id;
  const startsOn = findParsedValue(contractItems, "Effective from");
  const endsOn = findParsedValue(contractItems, "Effective through");

  return [
    { label: "Policy ID", values: [policyId], variant: "neutral" },
    {
      label: "Effective",
      values: [startsOn, endsOn === "none" ? "No end date" : endsOn].filter(isPresent),
      variant: "neutral"
    }
  ];
}

function businessPolicySettlementItems(policy: PolicySummary): BusinessPolicyExplainerReferenceItem[] {
  const settlementItems = parsedSectionItems(policy, "Settlement");
  const settlementMode = findParsedValue(settlementItems, "Settlement mode");
  const recipientWallet = findParsedValue(settlementItems, "Recipient wallet ID");
  const humanApproval = findParsedValue(settlementItems, "Human approval required");
  const values = [
    settlementMode,
    recipientWallet,
    humanApproval === "No" ? "No human approval" : humanApproval === "Yes" ? "Human approval required" : humanApproval
  ].filter(isPresent);

  return values.length > 0 ? [{ label: "Settlement", values, variant: "neutral" }] : [];
}

function parsedSectionItems(policy: PolicySummary, sectionTitle: string) {
  return (policy.detailSections.find((section) => section.title === sectionTitle)?.items ?? []).map(parsePolicyDetailItem);
}

function findParsedValue(items: ReturnType<typeof parsedSectionItems>, label: string) {
  return items.find((item) => item.label === label)?.value;
}

function findPreviewValue(policy: PolicySummary, label: string) {
  return policy.previewItems?.find((item) => item.label === label)?.value;
}

function extractPrimaryPayoutAmount(value: string) {
  return value.split(" per ")[0]?.trim() || value;
}

function cleanDisplayValue(value: string) {
  return value.trim().replace(/\s+\([^)]*\)$/u, "");
}

function cleanRequestTypeValue(value: string) {
  return cleanDisplayValue(value);
}

function cleanServiceCodeValue(value: string) {
  return cleanDisplayValue(value).replace(/^(CPT|NDC)\s+/u, "");
}

function cleanBooleanValue(value: string) {
  if (value.toLowerCase() === "true") {
    return "Yes";
  }

  if (value.toLowerCase() === "false") {
    return "No";
  }

  return cleanDisplayValue(value);
}

function isPresent(value: string | undefined): value is string {
  return Boolean(value);
}

function shouldRenderPolicyDetailBadges(policy: PolicySummary, sectionTitle: string, item: string) {
  return (
    (policy.category === "business" &&
      (sectionTitle === "Incentive scope" ||
        sectionTitle === "Eligibility criteria" ||
        (sectionTitle === "Contract pair" && isContractPairBadgeItem(item)))) ||
    (policy.category === "hedera" &&
      (sectionTitle === "Enabled Agent Kit blocks" ||
        (sectionTitle === "Policy identity" && isPaymentPolicyIdentityBadgeItem(item))))
  );
}

function isContractPairBadgeItem(item: string) {
  return item.startsWith("Plan: ") || item.startsWith("Provider: ") || item.startsWith("Delegate: ");
}

function isPaymentPolicyIdentityBadgeItem(item: string) {
  return item.startsWith("Plan: ");
}

function PolicyDetailBadgeItem({ item }: { item: string }) {
  const detailItem = parsePolicyDetailItem(item);

  return (
    <li className="policy-detail-badged-item">
      <span className="policy-detail-inline-content">
        <span className="policy-detail-item-label">{detailItem.label}:</span>
        <span className="policy-detail-value-badges">
          {detailItem.values.map((value) => (
            <LabsBadge className="policy-detail-value-badge" key={value} variant={policyDetailValueBadgeVariant(value)}>
              {value}
            </LabsBadge>
          ))}
        </span>
      </span>
    </li>
  );
}

function parsePolicyDetailItem(item: string) {
  const separatorIndex = item.indexOf(": ");
  if (separatorIndex === -1) {
    return {
      label: "Value",
      value: item,
      values: splitPolicyDetailValues(item)
    };
  }

  return {
    label: item.slice(0, separatorIndex),
    value: item.slice(separatorIndex + 2),
    values: splitPolicyDetailValues(item.slice(separatorIndex + 2))
  };
}

function splitPolicyDetailValues(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function policyDetailValueBadgeVariant(value: string): "success" | "warning" | "neutral" {
  if (value === "Yes" || value === "Enabled") {
    return "success";
  }

  if (value === "No" || value === "Disabled") {
    return "warning";
  }

  return "neutral";
}
