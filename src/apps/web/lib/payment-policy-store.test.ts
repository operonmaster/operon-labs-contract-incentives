import { describe, expect, it } from "vitest";
import type { FirestoreDatabase } from "./pas-persistence";
import {
  createFirestorePaymentPolicyStore,
  createInMemoryPaymentPolicyStore,
  createPaymentPolicyStoreFromEnv,
  defaultPaymentPlanPolicies
} from "./payment-policy-store";

describe("payment policy store", () => {
  it("auto-seeds one flat payment policy for each participating demo plan into paymentPolicies", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePaymentPolicyStore(
      {
        projectId: "example-gcp-project",
        databaseId: "(default)"
      },
      firestore
    );

    const policies = await store.listPolicies();

    expect(policies).toHaveLength(2);
    expect(policies.map((policy) => policy.planId).sort()).toEqual(["acme-health-ppo", "summit-health-hmo"]);
    expect(policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          planId: "acme-health-ppo",
          paymentToken: "HBAR",
          maxPaymentAmount: 7,
          businessEvaluationAttestation: true,
          duplicatePaymentPrevention: true,
          paymentEnvelopeIntegrity: true
        }),
        expect.objectContaining({
          planId: "summit-health-hmo",
          paymentToken: "HBAR",
          maxPaymentAmount: 7,
          businessEvaluationAttestation: true,
          duplicatePaymentPrevention: true,
          paymentEnvelopeIntegrity: true
        })
      ])
    );
    expect(policies.every((policy) => !("safeTransactionMemo" in policy) && !("testnetOnly" in policy))).toBe(true);
    expect((await firestore.collection("paymentPolicies").get()).docs).toHaveLength(2);
    expect(
      (await firestore.collection("paymentPolicies").get()).docs.every((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return !("safeTransactionMemo" in data) && !("testnetOnly" in data);
      })
    ).toBe(true);
    expect((await firestore.collection("hederaAgentPolicies").get()).docs).toHaveLength(0);
  });

  it("reads the current paymentPolicies document on every lookup", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePaymentPolicyStore(
      {
        projectId: "example-gcp-project",
        databaseId: "(default)"
      },
      firestore
    );
    await store.listPolicies();
    await firestore.collection("paymentPolicies").doc("acme-health-ppo").set({
      ...defaultPaymentPlanPolicies["acme-health-ppo"],
      maxPaymentAmount: 2
    });

    const policy = await store.getPolicyForPlan("acme-health-ppo");

    expect(policy?.maxPaymentAmount).toBe(2);
  });

  it("migrates existing seed-owned old default payment max to the current default", async () => {
    const firestore = createFakeFirestore();
    await firestore.collection("paymentPolicies").doc("acme-health-ppo").set({
      ...defaultPaymentPlanPolicies["acme-health-ppo"],
      maxPaymentAmount: 5,
      updatedAt: "2026-05-28T00:00:00.000Z",
      updatedBy: "operon-labs-contract-incentives"
    });
    const store = createFirestorePaymentPolicyStore(
      {
        projectId: "example-gcp-project",
        databaseId: "(default)"
      },
      firestore
    );

    const policy = await store.getPolicyForPlan("acme-health-ppo");
    const storedDoc = (await firestore.collection("paymentPolicies").doc("acme-health-ppo").get()).data() as {
      maxPaymentAmount?: number;
    };

    expect(policy?.maxPaymentAmount).toBe(7);
    expect(storedDoc.maxPaymentAmount).toBe(7);
  });

  it("preserves existing customized lower payment max during seed migration", async () => {
    const firestore = createFakeFirestore();
    await firestore.collection("paymentPolicies").doc("acme-health-ppo").set({
      ...defaultPaymentPlanPolicies["acme-health-ppo"],
      maxPaymentAmount: 2,
      updatedAt: "2026-05-28T00:00:00.000Z",
      updatedBy: "operator"
    });
    const store = createFirestorePaymentPolicyStore(
      {
        projectId: "example-gcp-project",
        databaseId: "(default)"
      },
      firestore
    );

    const policy = await store.getPolicyForPlan("acme-health-ppo");

    expect(policy?.maxPaymentAmount).toBe(2);
  });

  it("preserves seed-actor stamped customized old max policies during seed migration", async () => {
    const firestore = createFakeFirestore();
    await firestore.collection("paymentPolicies").doc("acme-health-ppo").set({
      ...defaultPaymentPlanPolicies["acme-health-ppo"],
      businessEvaluationAttestation: false,
      maxPaymentAmount: 5,
      updatedAt: "2026-05-28T00:00:00.000Z",
      updatedBy: "operon-labs-contract-incentives"
    });
    const store = createFirestorePaymentPolicyStore(
      {
        projectId: "example-gcp-project",
        databaseId: "(default)"
      },
      firestore
    );

    const policy = await store.getPolicyForPlan("acme-health-ppo");

    expect(policy).toMatchObject({
      businessEvaluationAttestation: false,
      maxPaymentAmount: 5
    });
  });

  it("prefers PAYMENT_POLICY_STORE_BACKEND while keeping HEDERA_POLICY_STORE_BACKEND as a temporary fallback", () => {
    expect(createPaymentPolicyStoreFromEnv({ PAYMENT_POLICY_STORE_BACKEND: "memory" }).backend).toBe("memory");
    expect(createPaymentPolicyStoreFromEnv({ HEDERA_POLICY_STORE_BACKEND: "memory" }).backend).toBe("memory");
    expect(
      createPaymentPolicyStoreFromEnv({
        PAYMENT_POLICY_STORE_BACKEND: "memory",
        HEDERA_POLICY_STORE_BACKEND: "firestore"
      }).backend
    ).toBe("memory");
  });

  it("keeps memory and Firestore payment policy defaults aligned for tests", async () => {
    const store = createInMemoryPaymentPolicyStore(defaultPaymentPlanPolicies);

    await expect(store.getPolicyForPlan("summit-health-hmo")).resolves.toMatchObject({
      planId: "summit-health-hmo",
      businessEvaluationAttestation: true,
      duplicatePaymentPrevention: true,
      paymentToken: "HBAR",
      maxPaymentAmount: 7
    });
  });
});

function createFakeFirestore(): FirestoreDatabase {
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
              const values = [...collection.entries()].sort(([, left], [, right]) =>
                String(getSortableValue(left, field)).localeCompare(String(getSortableValue(right, field)))
              );
              if (direction === "desc") {
                values.reverse();
              }

              return {
                docs: values.map(([id, value]) => ({
                  id,
                  data() {
                    return value;
                  }
                }))
              };
            }
          };
        }
      };
    }
  };
}

function getSortableValue(value: unknown, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, value);
}
