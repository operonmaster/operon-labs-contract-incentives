import { describe, expect, it } from "vitest";
import type { FirestoreDatabase } from "./pas-persistence";
import {
  createFirestorePolicyStore,
  createInMemoryPolicyStore,
  defaultIncentivePolicies
} from "./policy-store";

describe("policy store", () => {
  it("auto-seeds request-type-specific active incentive policies for every demo contract pair into Firestore", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePolicyStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );

    const policies = await store.listPolicies("provider_documentation_completeness");
    const delegatePolicies = await store.listPolicies("delegate_um_sla_bonus");
    const specialtyRxPolicies = await store.listPolicies("specialty_rx_fulfillment_sla");
    const appealsPolicies = await store.listPolicies("appeals_packet_quality");

    expect(policies).toHaveLength(4);
    expect(delegatePolicies).toHaveLength(4);
    expect(specialtyRxPolicies).toHaveLength(2);
    expect(appealsPolicies).toHaveLength(4);
    expect(appealsPolicies.map((policy) => policy.policyId)).toEqual([
      "appeals-packet-quality-v1",
      "appeals-acme-riverside-packet-quality-v1",
      "appeals-summit-packet-quality-v1",
      "appeals-summit-riverside-packet-quality-v1"
    ]);
    expect(appealsPolicies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        policyId: "appeals-packet-quality-v1",
        evaluationType: "appeals_packet_quality",
        contractPair: {
          planId: "acme-health-ppo",
          planName: "Acme Health PPO",
          providerId: "lakeside-provider-admin",
          providerName: "Lakeside Provider Admin"
        },
        incentiveScope: {
          eligibleRequestTypes: ["pharmacy_benefit", "outpatient_service"]
        },
        payout: {
          token: "HBAR",
          amountPerEligibleRequest: 6,
          monthlyCap: 700
        },
        settlement: {
          mode: "auto",
          recipientWalletId: "0.0.9049549",
          requiresHumanApproval: false
        }
      }),
      expect.objectContaining({
        policyId: "appeals-acme-riverside-packet-quality-v1",
        evaluationType: "appeals_packet_quality",
        contractPair: {
          planId: "acme-health-ppo",
          planName: "Acme Health PPO",
          providerId: "riverside-provider-admin",
          providerName: "Riverside Provider Admin"
        }
      }),
      expect.objectContaining({
        policyId: "appeals-summit-packet-quality-v1",
        evaluationType: "appeals_packet_quality",
        contractPair: {
          planId: "summit-health-hmo",
          planName: "Summit Health HMO",
          providerId: "lakeside-provider-admin",
          providerName: "Lakeside Provider Admin"
        }
      }),
      expect.objectContaining({
        policyId: "appeals-summit-riverside-packet-quality-v1",
        evaluationType: "appeals_packet_quality",
        contractPair: {
          planId: "summit-health-hmo",
          planName: "Summit Health HMO",
          providerId: "riverside-provider-admin",
          providerName: "Riverside Provider Admin"
        }
      })
    ]));
    expect(specialtyRxPolicies.map((policy) => policy.policyId).sort()).toEqual([
      "specialty-rx-fulfillment-sla-v1",
      "specialty-rx-summit-fulfillment-sla-v1"
    ]);
    expect(specialtyRxPolicies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          policyId: "specialty-rx-fulfillment-sla-v1",
          evaluationType: "specialty_rx_fulfillment_sla",
          contractPair: {
            planId: "acme-health-ppo",
            planName: "Acme Health PPO",
            providerId: "atlas-specialty-rx",
            providerName: "Atlas Specialty Rx"
          },
          incentiveScope: {
            eligibleRequestTypes: ["pharmacy_benefit"]
          },
          payout: {
            token: "HBAR",
            amountPerEligibleRequest: 5,
            monthlyCap: 700
          },
          settlement: {
            mode: "auto",
            recipientWalletId: "0.0.9049549",
            requiresHumanApproval: false
          }
        }),
        expect.objectContaining({
          policyId: "specialty-rx-summit-fulfillment-sla-v1",
          evaluationType: "specialty_rx_fulfillment_sla",
          contractPair: {
            planId: "summit-health-hmo",
            planName: "Summit Health HMO",
            providerId: "atlas-specialty-rx",
            providerName: "Atlas Specialty Rx"
          },
          incentiveScope: {
            eligibleRequestTypes: ["pharmacy_benefit"]
          },
          payout: {
            token: "HBAR",
            amountPerEligibleRequest: 5,
            monthlyCap: 700
          }
        })
      ])
    );
    expect(delegatePolicies.map((policy) => policy.policyId).sort()).toEqual([
      "delegate-um-acme-outpatient-sla-bonus-v1",
      "delegate-um-sla-bonus-v1",
      "delegate-um-summit-outpatient-sla-bonus-v1",
      "delegate-um-summit-pharmacy-sla-bonus-v1"
    ]);
    expect(delegatePolicies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          policyId: "delegate-um-sla-bonus-v1",
          evaluationType: "delegate_um_sla_bonus",
          contractPair: {
            planId: "acme-health-ppo",
            planName: "Acme Health PPO",
            providerId: "northstar-um",
            providerName: "Northstar UM"
          },
          incentiveScope: {
            eligibleRequestTypes: ["pharmacy_benefit"]
          },
          payout: {
            token: "HBAR",
            amountPerEligibleRequest: 5,
            monthlyCap: 500
          },
          settlement: {
            mode: "auto",
            recipientWalletId: "0.0.9049549",
            requiresHumanApproval: false
          }
        }),
        expect.objectContaining({
          policyId: "delegate-um-summit-outpatient-sla-bonus-v1",
          contractPair: {
            planId: "summit-health-hmo",
            planName: "Summit Health HMO",
            providerId: "northstar-um",
            providerName: "Northstar UM"
          },
          incentiveScope: {
            eligibleRequestTypes: ["outpatient_service"]
          }
        })
      ])
    );
    expect(policies.map((policy) => policy.policyId).sort()).toEqual([
      "plcy_2N7P5R8T0V4X6Z1B3D9F",
      "plcy_5R1T8W3Y6B0D9F2H4K7M",
      "plcy_8K2M4Q6R9T1V3X5Z7B0C",
      "plcy_9Q3S6V1X8Z2B5D7F0H4K"
    ]);
    expect([...new Set(policies.map((policy) => policy.settlement.recipientWalletId))]).toEqual(["0.0.9049549"]);
    expect([...new Set(delegatePolicies.map((policy) => policy.settlement.recipientWalletId))]).toEqual(["0.0.9049549"]);
    expect(policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          policyId: "plcy_8K2M4Q6R9T1V3X5Z7B0C",
          contractPair: {
            planId: "acme-health-ppo",
            planName: "Acme Health PPO",
            providerId: "lakeside-provider-admin",
            providerName: "Lakeside Provider Admin"
          },
          incentiveScope: expect.objectContaining({
            eligibleRequestTypes: ["outpatient_service"],
            includedServiceCodes: {
              cpt: ["73721"],
              ndc: []
            }
          })
        }),
        expect.objectContaining({
          policyId: "plcy_5R1T8W3Y6B0D9F2H4K7M",
          contractPair: {
            planId: "summit-health-hmo",
            planName: "Summit Health HMO",
            providerId: "lakeside-provider-admin",
            providerName: "Lakeside Provider Admin"
          },
          incentiveScope: expect.objectContaining({
            eligibleRequestTypes: ["pharmacy_benefit"],
            includedServiceCodes: {
              cpt: [],
              ndc: ["0169-4525-14", "0074-0554-02"]
            }
          }),
          payout: {
            token: "HBAR",
            amountPerEligibleRequest: 5,
            monthlyCap: 500
          },
          settlement: {
            mode: "auto",
            recipientWalletId: "0.0.9049549",
            requiresHumanApproval: false
          }
        })
      ])
    );
    expect(policies.every((policy) => !("displayName" in policy))).toBe(true);
    expect((await firestore.collection("incentivePolicies").get()).docs).toHaveLength(14);
    expect(firestore.collectionNames()).toEqual(expect.arrayContaining(["incentivePolicies"]));
    expect(firestore.collectionNames()).not.toEqual(expect.arrayContaining(["policies", "policyYaml"]));
  });

  it("finds current policies by evaluation type, plan/provider pair, and optional request type", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePolicyStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );

    const pairPolicies = await store.findPolicies({
      evaluationType: "provider_documentation_completeness",
      planId: "acme-health-ppo",
      providerId: "lakeside-provider-admin",
      submittedAt: "2026-05-25T12:00:00.000Z"
    });
    const outpatientPolicies = await store.findPolicies({
      evaluationType: "provider_documentation_completeness",
      planId: "acme-health-ppo",
      providerId: "lakeside-provider-admin",
      requestType: "outpatient_service",
      submittedAt: "2026-05-25T12:00:00.000Z"
    });
    const pharmacyPolicies = await store.findPolicies({
      evaluationType: "provider_documentation_completeness",
      planId: "summit-health-hmo",
      providerId: "lakeside-provider-admin",
      requestType: "pharmacy_benefit",
      submittedAt: "2026-05-25T12:00:00.000Z"
    });
    const missing = await store.findPolicy({
      evaluationType: "provider_documentation_completeness",
      planId: "unknown-plan",
      providerId: "lakeside-provider-admin",
      submittedAt: "2026-05-25T12:00:00.000Z"
    });
    const delegate = await store.findPolicy({
      evaluationType: "delegate_um_sla_bonus",
      planId: "acme-health-ppo",
      providerId: "northstar-um",
      requestType: "pharmacy_benefit",
      submittedAt: "2026-05-25T12:00:00.000Z"
    });
    const acmeOutpatientDelegate = await store.findPolicy({
      evaluationType: "delegate_um_sla_bonus",
      planId: "acme-health-ppo",
      providerId: "northstar-um",
      requestType: "outpatient_service",
      submittedAt: "2026-05-25T12:00:00.000Z"
    });
    const summitPharmacyDelegate = await store.findPolicy({
      evaluationType: "delegate_um_sla_bonus",
      planId: "summit-health-hmo",
      providerId: "northstar-um",
      requestType: "pharmacy_benefit",
      submittedAt: "2026-05-25T12:00:00.000Z"
    });
    const summitOutpatientDelegate = await store.findPolicy({
      evaluationType: "delegate_um_sla_bonus",
      planId: "summit-health-hmo",
      providerId: "northstar-um",
      requestType: "outpatient_service",
      submittedAt: "2026-05-25T12:00:00.000Z"
    });
    const specialtyRx = await store.findPolicy({
      evaluationType: "specialty_rx_fulfillment_sla",
      planId: "acme-health-ppo",
      providerId: "atlas-specialty-rx",
      requestType: "pharmacy_benefit",
      submittedAt: "2026-05-25T12:00:00.000Z"
    });
    const summitSpecialtyRx = await store.findPolicy({
      evaluationType: "specialty_rx_fulfillment_sla",
      planId: "summit-health-hmo",
      providerId: "atlas-specialty-rx",
      requestType: "pharmacy_benefit",
      submittedAt: "2026-05-25T12:00:00.000Z"
    });
    const appealsPharmacy = await store.findPolicies({
      evaluationType: "appeals_packet_quality",
      planId: "acme-health-ppo",
      providerId: "lakeside-provider-admin",
      requestType: "pharmacy_benefit"
    });
    const appealsOutpatient = await store.findPolicies({
      evaluationType: "appeals_packet_quality",
      planId: "acme-health-ppo",
      providerId: "lakeside-provider-admin",
      requestType: "outpatient_service"
    });
    const appealsSummitPharmacy = await store.findPolicies({
      evaluationType: "appeals_packet_quality",
      planId: "summit-health-hmo",
      providerId: "lakeside-provider-admin",
      requestType: "pharmacy_benefit"
    });
    const appealsAcmeRiverside = await store.findPolicies({
      evaluationType: "appeals_packet_quality",
      planId: "acme-health-ppo",
      providerId: "riverside-provider-admin",
      requestType: "pharmacy_benefit"
    });
    const appealsSummitRiversideOutpatient = await store.findPolicies({
      evaluationType: "appeals_packet_quality",
      planId: "summit-health-hmo",
      providerId: "riverside-provider-admin",
      requestType: "outpatient_service"
    });
    const appealsUnsupportedProvider = await store.findPolicies({
      evaluationType: "appeals_packet_quality",
      planId: "acme-health-ppo",
      providerId: "northstar-um",
      requestType: "pharmacy_benefit"
    });
    const appealsUnsupportedRequestType = await store.findPolicies({
      evaluationType: "appeals_packet_quality",
      planId: "acme-health-ppo",
      providerId: "lakeside-provider-admin",
      requestType: "inpatient_admission"
    });

    expect(pairPolicies.map((policy) => policy.policyId).sort()).toEqual([
      "plcy_2N7P5R8T0V4X6Z1B3D9F",
      "plcy_8K2M4Q6R9T1V3X5Z7B0C"
    ]);
    expect(outpatientPolicies.map((policy) => policy.policyId)).toEqual(["plcy_8K2M4Q6R9T1V3X5Z7B0C"]);
    expect(pharmacyPolicies.map((policy) => policy.policyId)).toEqual(["plcy_5R1T8W3Y6B0D9F2H4K7M"]);
    expect(delegate?.policyId).toBe("delegate-um-sla-bonus-v1");
    expect(acmeOutpatientDelegate?.policyId).toBe("delegate-um-acme-outpatient-sla-bonus-v1");
    expect(summitPharmacyDelegate?.policyId).toBe("delegate-um-summit-pharmacy-sla-bonus-v1");
    expect(summitOutpatientDelegate?.policyId).toBe("delegate-um-summit-outpatient-sla-bonus-v1");
    expect(specialtyRx?.policyId).toBe("specialty-rx-fulfillment-sla-v1");
    expect(summitSpecialtyRx?.policyId).toBe("specialty-rx-summit-fulfillment-sla-v1");
    expect(appealsPharmacy.map((policy) => policy.policyId)).toEqual(["appeals-packet-quality-v1"]);
    expect(appealsOutpatient.map((policy) => policy.policyId)).toEqual(["appeals-packet-quality-v1"]);
    expect(appealsSummitPharmacy.map((policy) => policy.policyId)).toEqual(["appeals-summit-packet-quality-v1"]);
    expect(appealsAcmeRiverside.map((policy) => policy.policyId)).toEqual(["appeals-acme-riverside-packet-quality-v1"]);
    expect(appealsSummitRiversideOutpatient.map((policy) => policy.policyId)).toEqual([
      "appeals-summit-riverside-packet-quality-v1"
    ]);
    expect(appealsUnsupportedProvider).toEqual([]);
    expect(appealsUnsupportedRequestType).toEqual([]);
    expect(missing).toBeNull();
  });

  it("reads the current Firestore policy document on every lookup", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePolicyStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const first = await store.findPolicy({
      evaluationType: "provider_documentation_completeness",
      planId: "acme-health-ppo",
      providerId: "lakeside-provider-admin",
      requestType: "outpatient_service"
    });
    const changed = {
      ...first!,
      payout: {
        ...first!.payout,
        amountPerEligibleRequest: 2
      }
    };

    await firestore.collection("incentivePolicies").doc(changed.policyId).set(changed);

    const second = await store.findPolicy({
      evaluationType: "provider_documentation_completeness",
      planId: "acme-health-ppo",
      providerId: "lakeside-provider-admin",
      requestType: "outpatient_service"
    });

    expect(second?.payout.amountPerEligibleRequest).toBe(2);
  });

  it("preserves Firestore contract and scope edits for default policy ids", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePolicyStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    await store.listPolicies("provider_documentation_completeness");
    await firestore.collection("incentivePolicies").doc("plcy_8K2M4Q6R9T1V3X5Z7B0C").set({
      ...defaultIncentivePolicies.provider_documentation_acme_outpatient,
      contractPair: {
        planId: "custom-health-plan",
        planName: "Custom Health Plan",
        providerId: "lakeside-provider-admin",
        providerName: "Lakeside Provider Admin"
      },
      incentiveScope: {
        eligibleRequestTypes: ["pharmacy_benefit"],
        includedServiceCodes: {
          cpt: [],
          ndc: ["0169-4525-14"]
        }
      }
    });

    const policy = await store.findPolicy({
      evaluationType: "provider_documentation_completeness",
      planId: "custom-health-plan",
      providerId: "lakeside-provider-admin",
      requestType: "pharmacy_benefit"
    });

    expect(policy).toMatchObject({
      policyId: "plcy_8K2M4Q6R9T1V3X5Z7B0C",
      contractPair: {
        planId: "custom-health-plan",
        planName: "Custom Health Plan"
      },
      incentiveScope: {
        eligibleRequestTypes: ["pharmacy_benefit"],
        includedServiceCodes: {
          cpt: [],
          ndc: ["0169-4525-14"]
        }
      }
    });
  });

  it("preserves delegate request-type exclusions when normalizing edited Firestore policies", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePolicyStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    await store.listPolicies("delegate_um_sla_bonus");
    await firestore.collection("incentivePolicies").doc("delegate-um-sla-bonus-v1").set({
      ...defaultIncentivePolicies.delegate_um_acme_sla_bonus,
      incentiveScope: {
        eligibleRequestTypes: ["pharmacy_benefit"],
        excludedRequestTypes: ["pharmacy_benefit"]
      }
    });

    const excluded = await store.findPolicy({
      evaluationType: "delegate_um_sla_bonus",
      planId: "acme-health-ppo",
      providerId: "northstar-um",
      requestType: "pharmacy_benefit"
    });
    const normalized = await store.getPolicyById("delegate-um-sla-bonus-v1");

    expect(excluded).toBeNull();
    expect(normalized?.incentiveScope).toMatchObject({
      eligibleRequestTypes: ["pharmacy_benefit"],
      excludedRequestTypes: ["pharmacy_benefit"]
    });
  });

  it("migrates old delegate SLA policy scopes to delegated prior authorization request types only", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePolicyStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    await firestore.collection("incentivePolicies").doc("delegate-um-sla-bonus-v1").set({
      ...defaultIncentivePolicies.delegate_um_acme_sla_bonus,
      incentiveScope: {
        eligibleRequestTypes: ["outpatient_service", "pharmacy_benefit"],
        excludedRequestTypes: ["outpatient_service"]
      }
    });

    const policies = await store.listPolicies("delegate_um_sla_bonus");
    const normalized = await store.getPolicyById("delegate-um-sla-bonus-v1");

    expect(policies).toHaveLength(4);
    expect(policies.find((policy) => policy.policyId === "delegate-um-sla-bonus-v1")?.incentiveScope).toEqual({
      eligibleRequestTypes: ["outpatient_service", "pharmacy_benefit"],
      excludedRequestTypes: ["outpatient_service"]
    });
    expect(normalized?.incentiveScope).toEqual({
      eligibleRequestTypes: ["outpatient_service", "pharmacy_benefit"],
      excludedRequestTypes: ["outpatient_service"]
    });
  });

  it("migrates deprecated wrapped policy documents to the pair-specific model", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePolicyStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    await firestore.collection("incentivePolicies").doc("provider_documentation_completeness").set({
      policyId: "provider-documentation-completeness-v1",
      evaluationType: "provider_documentation_completeness",
      status: "active",
      policy: {
        id: "provider-documentation-completeness-v1",
        evaluationType: "provider_documentation_completeness",
        paymentFormula: {
          baseAmount: 7,
          maxPerRequest: 7,
          monthlyCap: 700,
          token: { symbol: "HBAR" }
        },
        submitterRules: {
          allowedSubmitters: ["lakeside-provider-admin"],
          allowedSubmitterTypes: ["provider_admin_team"],
          walletMap: {
            "lakeside-provider-admin": "0.0.9049549"
          }
        },
        requiredEvidence: ["caseId", "requestType", "crdCoverageChecked", "crdCoveredBenefit", "dtrTemplateCompleted"],
        approvalRules: [],
        requiresHumanApproval: false
      },
      updatedAt: "2026-05-25T00:00:00.000Z",
      updatedBy: "test"
    });

    const policy = await store.findPolicy({
      evaluationType: "provider_documentation_completeness",
      planId: "acme-health-ppo",
      providerId: "lakeside-provider-admin"
    });
    const docs = (await firestore.collection("incentivePolicies").get()).docs.map((doc) => doc.data());

    expect(policy).toMatchObject({
      policyId: "plcy_8K2M4Q6R9T1V3X5Z7B0C",
      payout: {
        amountPerEligibleRequest: 7,
        monthlyCap: 700
      }
    });
    expect(docs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        policyId: "plcy_8K2M4Q6R9T1V3X5Z7B0C",
        contractPair: {
          planId: "acme-health-ppo",
          planName: "Acme Health PPO",
          providerId: "lakeside-provider-admin",
          providerName: "Lakeside Provider Admin"
        }
      })
    ]));
    expect(docs).toHaveLength(14);
  });

  it("stores either included or excluded scope lists, not both, for request types and service codes", async () => {
    const store = createInMemoryPolicyStore(defaultIncentivePolicies);
    const policies = await store.listPolicies("provider_documentation_completeness");

    expect(policies).toHaveLength(4);
    for (const policy of policies) {
      expect(policy.contractPair.planName).toMatch(/Health/);
      expect(policy.contractPair.providerName).toBe("Lakeside Provider Admin");
      expect(Boolean(policy.incentiveScope.eligibleRequestTypes?.length)).not.toBe(
        Boolean(policy.incentiveScope.excludedRequestTypes?.length)
      );
      expect(hasConfiguredServiceCodes(policy.incentiveScope.includedServiceCodes)).not.toBe(
        hasConfiguredServiceCodes(policy.incentiveScope.excludedServiceCodes)
      );
    }
  });

  it("removes the deprecated combined provider documentation policy when seeding the four-policy demo dataset", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePolicyStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    await firestore.collection("incentivePolicies").doc("plcy_7M4K9Q2X8N1R5T6W3B0C").set({
      ...defaultIncentivePolicies.provider_documentation_acme_outpatient,
      displayName: "Acme Health PPO / Lakeside Provider Admin - DTR Completion Incentive",
      policyId: "plcy_7M4K9Q2X8N1R5T6W3B0C",
      incentiveScope: {
        eligibleRequestTypes: ["outpatient_service", "pharmacy_benefit"],
        excludedRequestTypes: ["inpatient_admission"],
        includedServiceCodes: {
          cpt: ["73721"],
          ndc: ["0169-4525-14", "0074-0554-02"]
        },
        excludedServiceCodes: {
          cpt: ["76498"],
          ndc: []
        }
      }
    });

    const policies = await store.listPolicies("provider_documentation_completeness");
    const docs = (await firestore.collection("incentivePolicies").get()).docs.map((doc) => doc.id);

    expect(policies).toHaveLength(4);
    expect(policies.every((policy) => !("displayName" in policy))).toBe(true);
    expect(policies.map((policy) => policy.policyId)).not.toContain("plcy_7M4K9Q2X8N1R5T6W3B0C");
    expect(docs).toContain("delegate-um-sla-bonus-v1");
    expect(docs).not.toContain("plcy_7M4K9Q2X8N1R5T6W3B0C");
  });

  it("keeps in-memory policy store behavior aligned with Firestore for isolated tests", async () => {
    const store = createInMemoryPolicyStore(defaultIncentivePolicies);
    const policy = await store.findPolicy({
      evaluationType: "provider_documentation_completeness",
      planId: "acme-health-ppo",
      providerId: "lakeside-provider-admin",
      requestType: "outpatient_service"
    });

    expect(policy).toMatchObject({
      evaluationType: "provider_documentation_completeness",
      payout: {
        amountPerEligibleRequest: 5,
        token: "HBAR"
      }
    });
  });
});

function createFakeFirestore(): FirestoreDatabase & { collectionNames(): string[] } {
  const collections = new Map<string, Map<string, unknown>>();

  return {
    collection(name) {
      let collection = collections.get(name);
      if (!collection) {
        collection = new Map<string, unknown>();
        collections.set(name, collection);
      }

      return {
        doc(id) {
          return {
            async set(value) {
              collection.set(id, structuredClone(value));
            },
            async delete() {
              collection.delete(id);
            },
            async get() {
              const value = collection.get(id);

              return {
                exists: value !== undefined,
                data() {
                  return value;
                }
              };
            }
          };
        },
        async get() {
          return {
            docs: [...collection.entries()].map(([id, value]) => ({
              id,
              data() {
                return value;
              }
            }))
          };
        },
        orderBy(field, direction) {
          return {
            async get() {
              const values = [...collection.values()].sort((left, right) => {
                const leftValue = getSortableValue(left, field);
                const rightValue = getSortableValue(right, field);
                return String(leftValue).localeCompare(String(rightValue));
              });
              if (direction === "desc") {
                values.reverse();
              }

              return {
                docs: values.map((value, index) => ({
                  id: [...collection.keys()][index],
                  data() {
                    return value;
                  }
                }))
              };
            }
          };
        }
      };
    },
    collectionNames() {
      return [...collections.keys()];
    }
  };
}

function getSortableValue(value: unknown, field: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  return (value as Record<string, unknown>)[field];
}

function hasConfiguredServiceCodes(value: { cpt?: string[]; ndc?: string[] } | undefined): boolean {
  return Boolean(value?.cpt?.length || value?.ndc?.length);
}
