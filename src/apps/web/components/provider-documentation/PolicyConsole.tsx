"use client";

import Link from "next/link";
import { Children, useState, type ReactNode } from "react";
import type { PolicySummary } from "../../lib/policy-view-model";
import { policyBoundaryStatement } from "../../lib/policy-view-model";
import { LabsBadge, LabsHero, LabsPageShell } from "../labs-ui";
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
  const modalClassName = `modal plan-audit-modal policy-details-modal ${
    isBusinessPolicy ? "business-policy-details-modal" : "payment-policy-details-modal"
  }`;
  const sectionsClassName = `policy-modal-sections ${
    isBusinessPolicy ? "business-policy-modal-sections" : "payment-policy-modal-sections"
  }`;

  return (
    <div className="modal-backdrop audit-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-modal="true"
        aria-labelledby="policy-details-title"
        className={modalClassName}
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-toolbar">
          <div>
            <span className="eyebrow">{policy.category === "business" ? "Business policy" : "Payment policy"}</span>
            <h2 id="policy-details-title">{policy.title}</h2>
            <p>{policy.summary}</p>
          </div>
          <button className="row-action" type="button" onClick={onClose}>
            Close details
          </button>
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
      </section>
    </div>
  );
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
      values: splitPolicyDetailValues(item)
    };
  }

  return {
    label: item.slice(0, separatorIndex),
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
