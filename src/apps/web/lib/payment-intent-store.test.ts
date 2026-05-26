import { buildPaymentIntent } from "@operon-labs/hedera-executor";
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
    const intent = buildPaymentIntent(
      {
        auditId: "audit-1",
        caseId: "PA-260525-1015-ABCD1234",
        amount: 5,
        currency: "HBAR",
        walletId: "0.0.9049549",
        policyId: "provider-documentation-completeness-v1",
        policyVersion: "v1",
        triggerEvent: "PAS_SUBMITTED"
      },
      {
        sourceAccountId: "0.0.6870566",
        transactionMemo: "PA-260525-1015-ABCD1234"
      }
    );

    await expect(store.reserveIntent(intent)).resolves.toMatchObject({ allowed: true });
    await expect(store.reserveIntent(intent)).resolves.toMatchObject({
      allowed: false,
      reasonCode: "DUPLICATE_PAYMENT_BLOCKED"
    });
    await store.markIntentSubmitted(intent.id, "0.0.6870566@1779686274.765050870");
    await expect(store.getIntent(intent.id)).resolves.toMatchObject({
      id: intent.id,
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
