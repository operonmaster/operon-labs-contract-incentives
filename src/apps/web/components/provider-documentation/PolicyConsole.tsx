"use client";

import Link from "next/link";
import { Children, useState, type ReactNode } from "react";
import type { PolicySummary } from "../../lib/policy-view-model";
import { policyBoundaryStatement } from "../../lib/policy-view-model";
import { LabsBadge, LabsHero, LabsPageShell } from "../labs-ui";
import { UseCaseNavigation } from "./UseCaseNavigation";

interface PolicyConsoleProps {
  businessPolicies: PolicySummary[];
  paymentPolicies: PolicySummary[];
  initialUmRequestId?: string | null;
}

export function PolicyConsole({ businessPolicies, paymentPolicies, initialUmRequestId = null }: PolicyConsoleProps) {
  const [selectedPolicy, setSelectedPolicy] = useState<PolicySummary | null>(null);

  return (
    <LabsPageShell className="workspace policy-console">
      <div className="top-nav-row">
        <Link className="back" href="/">
          Back to demos
        </Link>
        <UseCaseNavigation activeView="policies" umRequestId={initialUmRequestId} />
      </div>

      <LabsHero compact eyebrow="Policy catalog" title="Provider Documentation Completeness Policies">
        <p>{policyBoundaryStatement}</p>
      </LabsHero>

      <div className="policy-section-grid">
        <PolicySection
          title="Business policies"
          description="Each business card is one complete plan/provider/request-type incentive policy. Coverage determinations stay in the UM workflow; this view shows incentive structure only."
          emptyMessage="No active business policies are available."
        >
          {businessPolicies.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} onSelect={(policy) => setSelectedPolicy(policy)} />
          ))}
        </PolicySection>

        <PolicySection
          title="Payment policies"
          description="Plan-level Hedera Agent Kit settlement controls selected from centrally maintained payment policy blocks."
          emptyMessage="No active payment policy controls are available."
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
  const isPaymentPolicy = policy.category === "hedera";
  const modalClassName = isPaymentPolicy
    ? "modal plan-audit-modal policy-details-modal payment-policy-details-modal"
    : "modal plan-audit-modal policy-details-modal";
  const sectionsClassName = isPaymentPolicy
    ? "policy-modal-sections payment-policy-modal-sections"
    : "policy-modal-sections";

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
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
