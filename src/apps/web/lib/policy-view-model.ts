import type { IncentivePolicy } from "@operon-labs/policy-engine";
import type { HederaAgentPlanPolicy } from "@operon-labs/hedera-executor";

export type PolicyCategory = "business" | "hedera";

export interface PolicyDetailSection {
  title: string;
  items: string[];
}

export interface PolicySummary {
  id: string;
  title: string;
  category: PolicyCategory;
  source: string;
  appliesTo: string;
  payoutOrControl: string;
  status: string;
  summary: string;
  previewItems?: PolicyPreviewItem[];
  detailSections: PolicyDetailSection[];
}

export interface PolicyPreviewItem {
  label: string;
  value: string;
}

export const policyRoutePath = "/provider-documentation/policies";

export const policyBoundaryStatement =
  "Business contract policies describe plan/provider incentive agreements. Payment policies are plan-level Hedera Agent Kit settlement guardrails before any approved payment leaves the treasury.";

export const providerDocumentationBusinessPolicyType = "provider_documentation_completeness";
export const delegateUmSlaBonusBusinessPolicyType = "delegate_um_sla_bonus";
const providerDocumentationBusinessPolicyTitle = "Provider Documentation Completeness";
const delegateUmSlaBonusBusinessPolicyTitle = "Delegate UM SLA Bonus";
const delegateUmSlaHours = 24;

export function buildBusinessPolicyCards(policy: IncentivePolicy | null | undefined): PolicySummary[] {
  if (!policy) {
    return [];
  }

  if (policy.evaluationType === providerDocumentationBusinessPolicyType) {
    return buildProviderDocumentationBusinessPolicyCards(policy);
  }

  if (policy.evaluationType === delegateUmSlaBonusBusinessPolicyType) {
    return buildDelegateUmSlaBonusBusinessPolicyCards(policy);
  }

  return [];
}

export function buildProviderDocumentationBusinessPolicyCards(policy: IncentivePolicy | null | undefined): PolicySummary[] {
  if (!policy) {
    return [];
  }

  if (policy.evaluationType !== providerDocumentationBusinessPolicyType) {
    return [];
  }

  const token = policy.payout.token;
  const status = policy.status === "active" ? "Active" : "Disabled";

  return [
    {
      id: policy.policyId,
      title: providerDocumentationBusinessPolicyTitle,
      category: "business",
      source: "Plan/provider contract policy",
      appliesTo: "Provider Documentation Completeness",
      payoutOrControl: `${policy.payout.amountPerEligibleRequest} ${token} per eligible PA request`,
      status,
      summary: "Provider Documentation Completeness DTR completion incentive for the contracted plan/provider pair.",
      previewItems: [
        { label: "Policy ID", value: policy.policyId },
        { label: "Plan", value: policy.contractPair.planName },
        { label: "Provider", value: policy.contractPair.providerName },
        requestTypePreview(policy),
        serviceCodePreview(policy),
        { label: "Payout", value: `${policy.payout.amountPerEligibleRequest} ${token}` }
      ],
      detailSections: buildBusinessPolicyDetailSections(policy, token)
    }
  ];
}

function buildDelegateUmSlaBonusBusinessPolicyCards(policy: IncentivePolicy): PolicySummary[] {
  const token = policy.payout.token;
  const status = policy.status === "active" ? "Active" : "Disabled";

  return [
    {
      id: policy.policyId,
      title: delegateUmSlaBonusBusinessPolicyTitle,
      category: "business",
      source: "Plan/delegate contract policy",
      appliesTo: delegateUmSlaBonusBusinessPolicyTitle,
      payoutOrControl: `${policy.payout.amountPerEligibleRequest} ${token} per eligible UM request`,
      status,
      summary: "Delegate UM SLA bonus incentive for eligible determinations completed within the configured review window.",
      previewItems: [
        { label: "Policy ID", value: policy.policyId },
        { label: "Plan", value: policy.contractPair.planName },
        { label: "Delegate", value: policy.contractPair.providerName },
        requestTypePreview(policy),
        { label: "SLA", value: `${delegateUmSlaHours} hours` },
        { label: "Payout", value: `${policy.payout.amountPerEligibleRequest} ${token}` }
      ],
      detailSections: buildDelegateUmSlaBonusDetailSections(policy, token)
    }
  ];
}

export function buildHederaAgentKitPlanPolicyCards(policy: HederaAgentPlanPolicy): PolicySummary {
  const status = policy.status === "active" ? "Active" : "Disabled";
  const enabledControls = [
    controlState("Business evaluation attestation", policy.businessEvaluationAttestation),
    controlState("Duplicate payment prevention", policy.duplicatePaymentPrevention),
    controlState("Max payment per request", policy.maxPaymentPerRequest),
    controlState("Payment envelope integrity", policy.paymentEnvelopeIntegrity)
  ];

  return {
    id: `hedera-agent-policy-${policy.planId}`,
    title: `${policy.planName} Agent Kit Settlement Policy`,
    category: "hedera",
    source: "Firestore paymentPolicies + @hashgraph/hedera-agent-kit hook",
    appliesTo: `${policy.planName} autonomous settlements`,
    payoutOrControl: `${policy.paymentToken} settlement, max ${policy.maxPaymentAmount} per request`,
    status,
    summary: "Plan-level settlement controls selected from centrally maintained Hedera Agent Kit policy blocks.",
    previewItems: [
      { label: "Plan", value: policy.planName },
      { label: "Token", value: policy.paymentToken },
      { label: "Max payment", value: `${policy.maxPaymentAmount} ${policy.paymentToken}` },
      { label: "Business attestation", value: formatEnabled(policy.businessEvaluationAttestation) },
      { label: "Duplicate prevention", value: formatEnabled(policy.duplicatePaymentPrevention) },
      { label: "Envelope integrity", value: formatEnabled(policy.paymentEnvelopeIntegrity) }
    ],
    detailSections: [
      {
        title: "Policy identity",
        items: [
          `Plan: ${policy.planName} (${policy.planId})`,
          `Version: ${policy.version}`,
          "Storage collection: paymentPolicies"
        ]
      },
      {
        title: "Settlement limits",
        items: [
          `Payment token: ${policy.paymentToken}`,
          `Max payment per request: ${policy.maxPaymentAmount} ${policy.paymentToken}`
        ]
      },
      {
        title: "Enabled Agent Kit blocks",
        items: enabledControls
      },
      {
        title: "Runtime validation",
        items: [
          "Business evaluation attestation fetches the recorded incentive evaluation and confirms the referenced business policy is still active.",
          "Payment envelope integrity verifies source account, recipient wallet, amount, token/tool, and memo immediately before the Hedera transfer tool runs.",
          "Duplicate payment prevention reserves a deterministic payment intent before transfer execution."
        ]
      }
    ]
  };
}

function requestTypePreview(policy: IncentivePolicy): PolicyPreviewItem {
  if (policy.incentiveScope.eligibleRequestTypes?.length) {
    return {
      label: "Eligible request types",
      value: policy.incentiveScope.eligibleRequestTypes.map(formatRequestType).join(", ")
    };
  }

  return {
    label: "Excluded request types",
    value: (policy.incentiveScope.excludedRequestTypes ?? []).map(formatRequestType).join(", ") || "none"
  };
}

function serviceCodePreview(policy: IncentivePolicy): PolicyPreviewItem {
  if (hasConfiguredServiceCodes(policy.incentiveScope.includedServiceCodes)) {
    return {
      label: "Included service codes",
      value: formatServiceCodeSet(policy.incentiveScope.includedServiceCodes)
    };
  }

  return {
    label: "Excluded service codes",
    value: formatServiceCodeSet(policy.incentiveScope.excludedServiceCodes)
  };
}

function controlState(label: string, enabled: boolean): string {
  return `${label}: ${formatEnabled(enabled)}`;
}

function formatEnabled(enabled: boolean): string {
  return enabled ? "Enabled" : "Disabled";
}

function buildBusinessPolicyDetailSections(policy: IncentivePolicy, token: string): PolicyDetailSection[] {
  return [
    {
      title: "Policy identity",
      items: [
        `Policy ID: ${policy.policyId}`,
        `Version: ${policy.version}`,
        `Evaluation type: ${policy.evaluationType}`,
        "Storage collection: incentivePolicies"
      ]
    },
    {
      title: "Contract pair",
      items: [
        `Plan: ${policy.contractPair.planName} (${policy.contractPair.planId})`,
        `Provider: ${policy.contractPair.providerName} (${policy.contractPair.providerId})`,
        `Effective from: ${policy.effectivePeriod.startsOn}`,
        `Effective through: ${policy.effectivePeriod.endsOn ?? "none"}`
      ]
    },
    {
      title: "Incentive scope",
      items: [...requestTypeDetailItems(policy), ...serviceCodeDetailItems(policy)]
    },
    {
      title: "Eligibility criteria",
      items: [
        `Applies only to covered benefits: ${formatBoolean(policy.eligibilityCriteria.appliesOnlyToCoveredBenefits)}`,
        `Requires DTR completion when requested: ${formatBoolean(policy.eligibilityCriteria.requiresDtrCompletionWhenRequested)}`
      ]
    },
    {
      title: "Payout",
      items: [
        `Amount per eligible request: ${policy.payout.amountPerEligibleRequest} ${token}`,
        `Monthly cap: ${policy.payout.monthlyCap} ${token}`,
        `Token: ${token}`
      ]
    },
    {
      title: "Settlement",
      items: [
        `Settlement mode: ${formatSettlementMode(policy.settlement.mode)}`,
        `Recipient wallet ID: ${policy.settlement.recipientWalletId}`,
        `Human approval required: ${formatBoolean(policy.settlement.requiresHumanApproval)}`
      ]
    }
  ];
}

function buildDelegateUmSlaBonusDetailSections(policy: IncentivePolicy, token: string): PolicyDetailSection[] {
  return [
    {
      title: "Policy identity",
      items: [
        `Policy ID: ${policy.policyId}`,
        `Version: ${policy.version}`,
        `Evaluation type: ${policy.evaluationType}`,
        "Storage collection: incentivePolicies"
      ]
    },
    {
      title: "Contract pair",
      items: [
        `Plan: ${policy.contractPair.planName} (${policy.contractPair.planId})`,
        `Delegate: ${policy.contractPair.providerName} (${policy.contractPair.providerId})`,
        `Effective from: ${policy.effectivePeriod.startsOn}`,
        `Effective through: ${policy.effectivePeriod.endsOn ?? "none"}`
      ]
    },
    {
      title: "Incentive scope",
      items: requestTypeDetailItems(policy)
    },
    {
      title: "Eligibility criteria",
      items: [
        "UM request is determined: Yes",
        "Outcome status is present: Yes",
        `Outcome value affects payment: ${formatBoolean(!policy.eligibilityCriteria.prohibitsOutcomeBasedPayment)}`,
        `Clinical review checklist complete: ${formatBoolean(Boolean(policy.eligibilityCriteria.requiresClinicalReviewCompletion))}`,
        `Completed within SLA: ${delegateUmSlaHours} hours`,
        "PHI in payment metadata: No"
      ]
    },
    {
      title: "Payout",
      items: [
        `Amount per eligible request: ${policy.payout.amountPerEligibleRequest} ${token}`,
        `Monthly cap: ${policy.payout.monthlyCap} ${token}`,
        `Token: ${token}`
      ]
    },
    {
      title: "Settlement",
      items: [
        `Settlement mode: ${formatSettlementMode(policy.settlement.mode)}`,
        `Recipient wallet ID: ${policy.settlement.recipientWalletId}`,
        `Human approval required: ${formatBoolean(policy.settlement.requiresHumanApproval)}`
      ]
    }
  ];
}

function requestTypeDetailItems(policy: IncentivePolicy): string[] {
  if (policy.incentiveScope.eligibleRequestTypes?.length) {
    return [`Eligible request types: ${policy.incentiveScope.eligibleRequestTypes.map(formatRequestTypeWithCode).join(", ")}`];
  }

  if (policy.incentiveScope.excludedRequestTypes?.length) {
    return [`Excluded request types: ${policy.incentiveScope.excludedRequestTypes.map(formatRequestTypeWithCode).join(", ")}`];
  }

  return ["Request types: none"];
}

function serviceCodeDetailItems(policy: IncentivePolicy): string[] {
  if (hasConfiguredServiceCodes(policy.incentiveScope.includedServiceCodes)) {
    return [`Included service codes: ${formatServiceCodeSet(policy.incentiveScope.includedServiceCodes)}`];
  }

  if (hasConfiguredServiceCodes(policy.incentiveScope.excludedServiceCodes)) {
    return [`Excluded service codes: ${formatServiceCodeSet(policy.incentiveScope.excludedServiceCodes)}`];
  }

  return ["Service codes: none"];
}

function formatBoolean(value: boolean): "Yes" | "No" {
  return value ? "Yes" : "No";
}

function formatSettlementMode(value: string): string {
  return value === "auto" ? "Auto" : "Manual";
}

function formatRequestTypeWithCode(requestType: string): string {
  return `${formatRequestType(requestType)} (${requestType})`;
}

function hasConfiguredServiceCodes(value: IncentivePolicy["incentiveScope"]["includedServiceCodes"] | undefined): value is NonNullable<IncentivePolicy["incentiveScope"]["includedServiceCodes"]> {
  return Boolean(value?.cpt.length || value?.ndc.length);
}

function formatServiceCodeSet(value: IncentivePolicy["incentiveScope"]["includedServiceCodes"] | undefined): string {
  if (!value) {
    return "none";
  }

  const parts = [
    ...value.cpt.map((code) => `CPT ${code}`),
    ...value.ndc.map((code) => `NDC ${code}`)
  ];

  return parts.length > 0 ? parts.join(", ") : "none";
}

function formatRequestType(requestType: string): string {
  switch (requestType) {
    case "outpatient_service":
      return "Outpatient Service";
    case "pharmacy_benefit":
      return "Pharmacy Benefit";
    case "inpatient_admission":
      return "Inpatient Admission";
    default:
      return requestType;
  }
}
