import { describe, expect, it } from "vitest";
import type { IncentivePolicy } from "@operon-labs/policy-engine";
import { defaultPaymentPlanPolicies } from "./payment-policy-store";
import { defaultIncentivePolicies } from "./policy-store";
import {
  buildAppealsPacketQualityBusinessPolicyCards,
  buildBusinessPolicyCards,
  delegateUmSlaBonusBusinessPolicyType,
  buildHederaAgentKitPlanPolicyCards,
  buildProviderDocumentationBusinessPolicyCards,
  policyBoundaryStatement,
  policyRoutePath,
  providerDocumentationBusinessPolicyType,
  specialtyRxFulfillmentBusinessPolicyType
} from "./policy-view-model";

describe("policy view model", () => {
  it("scopes business policy cards to the Provider Documentation plan/provider contract", () => {
    const summaries = Object.values(defaultIncentivePolicies).flatMap(buildProviderDocumentationBusinessPolicyCards);

    expect(summaries).toHaveLength(4);
    expect(summaries.map((policy) => policy.id).sort()).toEqual([
      "plcy_2N7P5R8T0V4X6Z1B3D9F",
      "plcy_5R1T8W3Y6B0D9F2H4K7M",
      "plcy_8K2M4Q6R9T1V3X5Z7B0C",
      "plcy_9Q3S6V1X8Z2B5D7F0H4K"
    ]);
    expect(summaries.map((policy) => policy.title)).toEqual([
      "Provider Documentation Completeness",
      "Provider Documentation Completeness",
      "Provider Documentation Completeness",
      "Provider Documentation Completeness"
    ]);
    expect(summaries.every((policy) => !policy.title.includes("/") && !policy.title.includes(" - "))).toBe(true);
    expect(Object.values(defaultIncentivePolicies).every((policy) => !("displayName" in policy))).toBe(true);
    expect(summaries[0].summary).toContain("DTR completion incentive");
    expect(summaries[0].summary).not.toContain("CRD");

    expect(providerDocumentationBusinessPolicyType).toBe("provider_documentation_completeness");
    expect(summaries.every((policy) => policy.category === "business")).toBe(true);
    expect(summaries.every((policy) => policy.appliesTo === "Provider Documentation Completeness")).toBe(true);
    expect(summaries.every((policy) => policy.source === "Plan/provider contract policy")).toBe(true);
    const acmeOutpatient = summaries.find((policy) => policy.id === "plcy_8K2M4Q6R9T1V3X5Z7B0C")!;
    expect(acmeOutpatient.detailSections.map((section) => section.title)).toEqual([
      "Policy identity",
      "Contract pair",
      "Incentive scope",
      "Eligibility criteria",
      "Payout",
      "Settlement"
    ]);
    const detailItems = acmeOutpatient.detailSections.flatMap((section) => section.items);
    expect(detailItems).toContain("Policy ID: plcy_8K2M4Q6R9T1V3X5Z7B0C");
    expect(detailItems).toContain("Version: v1");
    expect(detailItems).not.toContain("Status: Active");
    expect(detailItems).toContain("Evaluation type: provider_documentation_completeness");
    expect(detailItems).toContain("Storage collection: incentivePolicies");
    expect(detailItems).toContain("Plan: Acme Health PPO (acme-health-ppo)");
    expect(detailItems).toContain("Provider: Lakeside Provider Admin (lakeside-provider-admin)");
    expect(detailItems).toContain("Effective from: 2026-05-01");
    expect(detailItems).toContain("Effective through: none");
    expect(detailItems).toContain("Eligible request types: Outpatient Service (outpatient_service)");
    expect(detailItems).toContain("Included service codes: CPT 73721");
    expect(detailItems).not.toContain("Excluded request types: Pharmacy Benefit (pharmacy_benefit), Inpatient Admission (inpatient_admission)");
    expect(detailItems).not.toContain("Excluded service codes: CPT 76498");
    expect(detailItems).toContain("Applies only to covered benefits: Yes");
    expect(detailItems).toContain("Requires DTR completion when requested: Yes");
    expect(detailItems).toContain("Amount per eligible request: 3 HBAR");
    expect(detailItems).toContain("Monthly cap: 500 HBAR");
    expect(detailItems).toContain("Token: HBAR");
    expect(detailItems).toContain("Settlement mode: Auto");
    expect(detailItems).toContain("Recipient wallet ID: 0.0.9049549");
    expect(detailItems).toContain("Human approval required: No");
    expect(detailItems.join(" ")).not.toContain("CRD");
    expect(acmeOutpatient.payoutOrControl).toBe("3 HBAR per eligible PA request");
    expect(acmeOutpatient.status).toBe("Active");
    expect(acmeOutpatient.previewItems).toEqual([
      { label: "Policy ID", value: "plcy_8K2M4Q6R9T1V3X5Z7B0C" },
      { label: "Plan", value: "Acme Health PPO" },
      { label: "Provider", value: "Lakeside Provider Admin" },
      { label: "Eligible request types", value: "Outpatient Service" },
      { label: "Included service codes", value: "CPT 73721" },
      { label: "Payout", value: "3 HBAR" }
    ]);
  });

  it("shows excluded scopes, disabled status, and manual settlement in the business policy modal details", () => {
    const policy: IncentivePolicy = {
      ...defaultIncentivePolicies.provider_documentation_acme_outpatient,
      status: "inactive",
      incentiveScope: {
        excludedRequestTypes: ["inpatient_admission"],
        excludedServiceCodes: {
          cpt: ["76498"],
          ndc: []
        }
      },
      eligibilityCriteria: {
        appliesOnlyToCoveredBenefits: true,
        requiresDtrCompletionWhenRequested: false
      },
      settlement: {
        ...defaultIncentivePolicies.provider_documentation_acme_outpatient.settlement,
        mode: "manual",
        requiresHumanApproval: true
      }
    };

    const summary = buildProviderDocumentationBusinessPolicyCards(policy)[0];

    expect(summary.status).toBe("Disabled");
    expect(summary.previewItems).toEqual([
      { label: "Policy ID", value: "plcy_8K2M4Q6R9T1V3X5Z7B0C" },
      { label: "Plan", value: "Acme Health PPO" },
      { label: "Provider", value: "Lakeside Provider Admin" },
      { label: "Excluded request types", value: "Inpatient Admission" },
      { label: "Excluded service codes", value: "CPT 76498" },
      { label: "Payout", value: "3 HBAR" }
    ]);
    expect(summary.detailSections.flatMap((section) => section.items)).toEqual(
      expect.arrayContaining([
        "Excluded request types: Inpatient Admission (inpatient_admission)",
        "Excluded service codes: CPT 76498",
        "Applies only to covered benefits: Yes",
        "Requires DTR completion when requested: No",
        "Settlement mode: Manual",
        "Human approval required: Yes"
      ])
    );
    expect(summary.detailSections.flatMap((section) => section.items)).not.toContain("Status: Disabled");
  });

  it("builds delegate UM SLA business policy cards", () => {
    const cards = Object.values(defaultIncentivePolicies)
      .filter((policy) => policy.evaluationType === delegateUmSlaBonusBusinessPolicyType)
      .flatMap(buildBusinessPolicyCards);

    expect(cards).toHaveLength(4);
    expect(cards.map((card) => card.id).sort()).toEqual([
      "delegate-um-acme-outpatient-sla-bonus-v1",
      "delegate-um-sla-bonus-v1",
      "delegate-um-summit-outpatient-sla-bonus-v1",
      "delegate-um-summit-pharmacy-sla-bonus-v1"
    ]);
    expect(cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "delegate-um-sla-bonus-v1",
          title: "Delegate UM SLA Bonus",
          appliesTo: "Delegate UM SLA Bonus",
          payoutOrControl: "3 HBAR per eligible UM request",
          previewItems: expect.arrayContaining([
            { label: "Plan", value: "Acme Health PPO" },
            { label: "Delegate", value: "Northstar UM" },
            { label: "Eligible request types", value: "Pharmacy Benefit" },
            { label: "SLA", value: "24 hours" }
          ])
        }),
        expect.objectContaining({
          id: "delegate-um-summit-outpatient-sla-bonus-v1",
          previewItems: expect.arrayContaining([
            { label: "Plan", value: "Summit Health HMO" },
            { label: "Delegate", value: "Northstar UM" },
            { label: "Eligible request types", value: "Outpatient Service" }
          ])
        })
      ])
    );
    const pharmacyCard = cards.find((card) => card.id === "delegate-um-sla-bonus-v1")!;
    const pharmacyCardItems = pharmacyCard.detailSections.flatMap((section) => section.items);
    const eligibilityItems = pharmacyCard.detailSections.find((section) => section.title === "Eligibility criteria")?.items;
    expect(eligibilityItems).toEqual([
      "Clinical documentation reviewed: Yes",
      "Medical necessity criteria met: Yes",
      "Plan policy requirements checked: Yes",
      "Decision rationale documented: Yes"
    ]);
    expect(pharmacyCardItems).toContain("Eligible request types: Pharmacy Benefit (pharmacy_benefit)");
    expect(pharmacyCardItems).not.toContain("UM request is determined: Yes");
    expect(pharmacyCardItems).not.toContain("Outcome status is present: Yes");
    expect(pharmacyCardItems).not.toContain("Completed within SLA: 24 hours");
    expect(pharmacyCardItems).not.toContain("Outcome value affects payment: No");
    expect(pharmacyCardItems).not.toContain("PHI in payment metadata: No");
    const outpatientCard = cards.find((card) => card.id === "delegate-um-acme-outpatient-sla-bonus-v1")!;
    expect(outpatientCard.detailSections.flatMap((section) => section.items)).toContain("Eligible request types: Outpatient Service (outpatient_service)");
  });

  it("builds specialty Rx fulfillment SLA business policy cards", () => {
    const cards = Object.values(defaultIncentivePolicies)
      .filter((policy) => policy.evaluationType === specialtyRxFulfillmentBusinessPolicyType)
      .flatMap(buildBusinessPolicyCards);

    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.id).sort()).toEqual([
      "specialty-rx-fulfillment-sla-v1",
      "specialty-rx-summit-fulfillment-sla-v1"
    ]);
    expect(cards.map((card) => card.title)).toEqual([
      "Specialty Rx Fulfillment SLA",
      "Specialty Rx Fulfillment SLA"
    ]);
    expect(cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "specialty-rx-summit-fulfillment-sla-v1",
          previewItems: expect.arrayContaining([
            { label: "Plan", value: "Summit Health HMO" },
            { label: "Pharmacy", value: "Atlas Specialty Rx" },
            { label: "Eligible request types", value: "Pharmacy Benefit" },
            { label: "Payout", value: "6 HBAR" }
          ])
        })
      ])
    );
    expect(cards[0]?.detailSections.flatMap((section) => section.items).join(" ")).toContain("Cold-chain evidence");
    expect(cards[0]?.detailSections.flatMap((section) => section.items)).toContain(
      "Delivery closure evidence recorded: Yes"
    );
    expect(cards[0]?.detailSections.flatMap((section) => section.items)).toContain(
      "No avoidable fulfillment exception: Yes"
    );
    expect(defaultIncentivePolicies.specialty_rx_acme_fulfillment_sla.eligibilityCriteria).toMatchObject({
      requiresDeliveryClosureEvidence: true
    });
    expect(defaultIncentivePolicies.specialty_rx_acme_fulfillment_sla.eligibilityCriteria).not.toHaveProperty(
      "requiresDeliveryConfirmedWithinSla"
    );
  });

  it("builds Appeals Packet Quality policy cards with outcome guardrails", () => {
    const policy = defaultIncentivePolicies.appeals_acme_packet_quality;
    const cards = buildBusinessPolicyCards(policy);

    expect(cards[0]).toMatchObject({
      title: "Appeals Packet Quality",
      source: "Plan/provider appeals contract policy",
      appliesTo: "Appeals Packet Quality"
    });
    expect(JSON.stringify(cards)).toContain("packet-readiness SLA");
    expect(JSON.stringify(cards)).toContain("No appeal outcome incentive");
    expect(cards[0]?.payoutOrControl).toBe("3 HBAR per eligible appeal packet");
    expect(cards[0]?.previewItems).toContainEqual({ label: "Payout", value: "3 HBAR" });
  });

  it("does not build Appeals Packet Quality cards for unrelated policy types", () => {
    const cards = buildAppealsPacketQualityBusinessPolicyCards(defaultIncentivePolicies.provider_documentation_acme_outpatient);

    expect(cards).toEqual([]);
  });

  it("lists plan-level payment policies separately from business eligibility", () => {
    expect(policyBoundaryStatement).toBe(
      "Business contract policies describe plan/provider incentive agreements. Payment policies are plan-level Hedera Agent Kit settlement guardrails before any approved payment leaves the treasury."
    );
    expect(policyRoutePath).toBe("/provider-documentation/policies");
    const summaries = Object.values(defaultPaymentPlanPolicies).map(buildHederaAgentKitPlanPolicyCards);

    expect(summaries).toHaveLength(2);
    expect(summaries.map((policy) => policy.title)).toEqual([
      "Acme Health PPO Agent Kit Settlement Policy",
      "Summit Health HMO Agent Kit Settlement Policy"
    ]);
    expect(summaries.every((policy) => policy.category === "hedera")).toBe(true);
    expect(summaries[0].previewItems).toEqual([
      { label: "Plan", value: "Acme Health PPO" },
      { label: "Token", value: "HBAR" },
      { label: "Max payment", value: "7 HBAR" },
      { label: "Business attestation", value: "Enabled" },
      { label: "Duplicate prevention", value: "Enabled" },
      { label: "Envelope integrity", value: "Enabled" }
    ]);
    expect(summaries[0].detailSections.map((section) => section.title)).toEqual([
      "Policy identity",
      "Settlement limits",
      "Enabled Agent Kit blocks",
      "Runtime validation"
    ]);
    expect(summaries[0].detailSections.flatMap((section) => section.items)).toEqual(
      expect.arrayContaining([
        "Plan: Acme Health PPO (acme-health-ppo)",
        "Version: v1",
        "Storage collection: paymentPolicies",
        "Business evaluation attestation: Enabled",
        "Duplicate payment prevention: Enabled",
        "Payment envelope integrity: Enabled",
        "Payment token: HBAR",
        "Max payment per request: 7 HBAR"
      ])
    );
    expect(summaries[0].detailSections.flatMap((section) => section.items)).not.toContain("Status: Active");
    expect(summaries[0].detailSections.flatMap((section) => section.items)).not.toEqual(
      expect.arrayContaining(["Safe transaction memo: Enabled", "Testnet only: Enabled"])
    );
  });
});
