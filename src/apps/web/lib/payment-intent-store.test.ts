import { buildBusinessEvaluationId, buildPaymentIntent } from "@operon-labs/hedera-executor";
import { describe, expect, it } from "vitest";
import { createFirestorePaymentIntentStore, createPaymentIntentStoreFromEnv } from "./payment-intent-store";
import type { FirestoreDatabase } from "./pas-persistence";

describe("payment intent store", () => {
  it("uses Firestore by default for durable settlement controls", () => {
    const store = createPaymentIntentStoreFromEnv({});

    expect(store?.backend).toBe("firestore");
  });

  it("allows memory mode for isolated tests", () => {
    expect(createPaymentIntentStoreFromEnv({ PAYMENT_INTENT_STORE_BACKEND: "memory" })).toBeUndefined();
  });

  it("reserves a payment intent once and blocks duplicate settlement attempts", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePaymentIntentStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const intent = buildTestPaymentIntent();

    await expect(store.reserveIntent(intent)).resolves.toMatchObject({ allowed: true });
    await expect(store.reserveIntent(intent)).resolves.toMatchObject({
      allowed: false,
      reasonCode: "DUPLICATE_PAYMENT_BLOCKED"
    });
    await store.markIntentSubmitted(intent.id, "0.0.6870566@1779686274.765050870");
    await expect(store.getIntent(intent.id)).resolves.toMatchObject({
      id: intent.id,
      umRequestId: "PA-260525-1015-ABCD1234",
      caseId: "PA-260525-1015-ABCD1234",
      incentiveEvaluationId: buildBusinessEvaluationId({
        umRequestId: "PA-260525-1015-ABCD1234",
        businessPolicyId: "provider-documentation-completeness-v1"
      }),
      businessPolicyId: "provider-documentation-completeness-v1",
      paymentPolicyId: "summit-health-hmo",
      status: "submitted",
      transactionId: "0.0.6870566@1779686274.765050870"
    });
    await store.markIntentFailed(intent.id, "DUPLICATE_PAYMENT_BLOCKED");
    await expect(store.getIntent(intent.id)).resolves.toMatchObject({
      id: intent.id,
      status: "submitted",
      transactionId: "0.0.6870566@1779686274.765050870"
    });
    expect(firestore.collectionNames()).toEqual(expect.arrayContaining(["paymentIntents"]));
    expect(intent.id).toMatch(/^pi_[a-f0-9]{32}$/);
  });

  it("rejects noncanonical UM ids and tuple-derived payment intent mismatches", async () => {
    const store = createFirestorePaymentIntentStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      createFakeFirestore()
    );
    const intent = buildTestPaymentIntent();

    await expect(
      store.reserveIntent({
        ...intent,
        id: "PA-260525-1015-ABCD1234"
      })
    ).rejects.toThrow("PAYMENT_INTENT_ID_MISMATCH:id");

    await expect(
      store.reserveIntent({
        ...intent,
        umRequestId: "UMR-260525-1015-ABCD1234"
      })
    ).rejects.toThrow("PAYMENT_INTENT_ID_NOT_CANONICAL:umRequestId");

    await expect(
      store.reserveIntent({
        ...intent,
        paymentPolicyId: "other-plan"
      })
    ).rejects.toThrow("PAYMENT_INTENT_ID_MISMATCH:id");

    await expect(
      store.reserveIntent({
        ...intent,
        incentiveEvaluationId: buildBusinessEvaluationId({
          umRequestId: intent.umRequestId,
          businessPolicyId: "other-business-policy"
        })
      })
    ).rejects.toThrow("PAYMENT_INTENT_ID_MISMATCH:incentiveEvaluationId");
  });

  it("requires atomic create support so reservations cannot race", async () => {
    // A backend whose document refs lack atomic create() must be rejected rather
    // than falling back to a racy check-then-set.
    const noCreateFirestore: FirestoreDatabase = {
      collection() {
        return {
          doc() {
            return {
              async set() {},
              async get() {
                return { exists: false, data: () => undefined };
              }
            };
          },
          async get() {
            return { docs: [] };
          },
          orderBy() {
            return {
              async get() {
                return { docs: [] };
              }
            };
          }
        };
      }
    };
    const store = createFirestorePaymentIntentStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      noCreateFirestore
    );

    await expect(store.reserveIntent(buildTestPaymentIntent())).rejects.toThrow(
      "PAYMENT_INTENT_RESERVE_REQUIRES_ATOMIC_CREATE"
    );
  });

  it("does not classify transient Firestore create failures as duplicate reservations", async () => {
    const unavailableFirestore: FirestoreDatabase = {
      collection() {
        return {
          doc() {
            return {
              async create() {
                throw new Error("UNAVAILABLE");
              },
              async set() {},
              async get() {
                return { exists: false, data: () => undefined };
              }
            };
          },
          async get() {
            return { docs: [] };
          },
          orderBy() {
            return {
              async get() {
                return { docs: [] };
              }
            };
          }
        };
      }
    };
    const store = createFirestorePaymentIntentStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      unavailableFirestore
    );

    await expect(store.reserveIntent(buildTestPaymentIntent())).rejects.toThrow("UNAVAILABLE");
  });

  it("persists the failure reason code when a reserved intent fails settlement", async () => {
    const store = createFirestorePaymentIntentStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      createFakeFirestore()
    );
    const intent = buildTestPaymentIntent();

    await store.reserveIntent(intent);
    await store.markIntentFailed(intent.id, "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX");

    await expect(store.getIntent(intent.id)).resolves.toMatchObject({
      id: intent.id,
      status: "failed",
      transactionId: null,
      failureReasonCode: "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX"
    });
  });
});

function buildTestPaymentIntent() {
  const umRequestId = "PA-260525-1015-ABCD1234";
  const businessPolicyId = "provider-documentation-completeness-v1";
  const paymentPolicyId = "summit-health-hmo";
  const incentiveEvaluationId = buildBusinessEvaluationId({ umRequestId, businessPolicyId });

  return buildPaymentIntent(
    {
      auditId: "audit-1",
      umRequestId,
      caseId: umRequestId,
      incentiveEvaluationId,
      businessPolicyId,
      paymentPolicyId,
      planId: paymentPolicyId,
      amount: 5,
      currency: "HBAR",
      walletId: "0.0.9049549",
      policyId: businessPolicyId,
      policyVersion: "v1",
      triggerEvent: "PAS_SUBMITTED"
    },
    {
      sourceAccountId: "0.0.6870566",
      transactionMemo: umRequestId
    }
  );
}

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
            async create(value) {
              if (collection.has(id)) {
                throw new Error("ALREADY_EXISTS");
              }

              collection.set(id, structuredClone(value));
            },
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
        orderBy(_field, direction) {
          return {
            async get() {
              const values = [...collection.values()];
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
