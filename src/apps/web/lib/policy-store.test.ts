import { describe, expect, it } from "vitest";
import type { FirestoreDatabase } from "./pas-persistence";
import {
  createFirestorePolicyStore,
  createInMemoryPolicyStore,
  defaultIncentivePolicies
} from "./policy-store";

describe("policy store", () => {
  it("auto-seeds active incentive policies into Firestore before reading", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePolicyStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );

    const policy = await store.getPolicy("provider_documentation_completeness");

    expect(policy).toMatchObject({
      id: "provider-documentation-completeness-v1",
      evaluationType: "provider_documentation_completeness",
      paymentFormula: {
        baseAmount: 5,
        maxPerRequest: 5,
        monthlyCap: 500,
        token: {
          symbol: "HBAR"
        }
      }
    });
    expect((await firestore.collection("incentivePolicies").get()).docs).toHaveLength(4);
    expect(firestore.collectionNames()).toEqual(expect.arrayContaining(["incentivePolicies"]));
    expect(firestore.collectionNames()).not.toEqual(expect.arrayContaining(["policies", "policyYaml"]));
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
    const first = await store.getPolicy("provider_documentation_completeness");
    const changed = {
      ...first!,
      paymentFormula: {
        ...first!.paymentFormula,
        baseAmount: 2,
        maxPerRequest: 2
      }
    };

    await firestore.collection("incentivePolicies").doc("provider_documentation_completeness").set({
      policy: changed,
      status: "active",
      policyId: changed.id,
      evaluationType: changed.evaluationType,
      updatedAt: "2026-05-25T00:00:00.000Z",
      updatedBy: "test"
    });

    const second = await store.getPolicy("provider_documentation_completeness");

    expect(second?.paymentFormula.baseAmount).toBe(2);
    expect(second?.paymentFormula.maxPerRequest).toBe(2);
  });

  it("keeps in-memory policy store behavior aligned with Firestore for isolated tests", async () => {
    const store = createInMemoryPolicyStore(defaultIncentivePolicies);
    const policy = await store.getPolicy("appeals_packet_quality");

    expect(policy).toMatchObject({
      evaluationType: "appeals_packet_quality",
      paymentFormula: {
        baseAmount: 5,
        token: {
          symbol: "HBAR"
        }
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
            docs: [...collection.values()].map((value) => ({
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
                docs: values.map((value) => ({
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
    return "";
  }

  return (value as Record<string, unknown>)[field] ?? "";
}
