import { describe, expect, it } from "vitest";
import type { FirestoreDatabase } from "./pas-persistence";
import {
  createFirestorePaymentPolicyEvidenceStore,
  createPaymentPolicyEvidenceStoreFromEnv,
  type PaymentPolicyEvidence
} from "./payment-policy-evidence-store";

describe("payment policy evidence store", () => {
  it("uses Firestore by default for payment-policy audit evidence", () => {
    expect(createPaymentPolicyEvidenceStoreFromEnv({})?.backend).toBe("firestore");
  });

  it("allows explicit memory mode for isolated tests", () => {
    expect(createPaymentPolicyEvidenceStoreFromEnv({ PAYMENT_POLICY_EVIDENCE_STORE_BACKEND: "memory" })).toBeUndefined();
  });

  it("stores payment-policy evidence by incentive evaluation id", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePaymentPolicyEvidenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const evidence: PaymentPolicyEvidence = {
      incentiveEvaluationId: "PA-260525-1949-ML6LAWFP",
      caseId: "PA-260525-1949-ML6LAWFP",
      planId: "summit-health-hmo",
      paymentPolicyId: "summit-health-hmo",
      businessPolicyId: "plcy_9Q3S6V1X8Z2B5D7F0H4K",
      runtime: "hedera-agent-kit-policy",
      outcome: "blocked",
      failureCode: "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX",
      requestedPayment: {
        amount: 20,
        token: "HBAR",
        recipientWalletId: "0.0.9049549"
      },
      controls: [
        {
          id: "businessEvaluationAttestation",
          label: "Business evaluation attestation",
          status: "passed"
        },
        {
          id: "maxPaymentPerRequest",
          label: "Max payment per request",
          status: "failed",
          expected: "<= 5 HBAR",
          actual: "20 HBAR",
          failureCode: "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX"
        }
      ],
      paymentIntentId: null,
      transactionId: null,
      createdAt: "2026-05-26T00:00:00.000Z",
      updatedAt: "2026-05-26T00:00:00.000Z"
    };

    await store.saveEvidence(evidence);

    await expect(store.getEvidence("PA-260525-1949-ML6LAWFP")).resolves.toEqual(evidence);
    expect((await firestore.collection("paymentPolicyEvidences").get()).docs).toHaveLength(1);
  });

  it("removes undefined optional control fields before writing to Firestore", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePaymentPolicyEvidenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const evidence: PaymentPolicyEvidence = {
      incentiveEvaluationId: "PA-260525-2022-9HTU2UDY",
      caseId: "PA-260525-2022-9HTU2UDY",
      planId: "summit-health-hmo",
      paymentPolicyId: "summit-health-hmo",
      businessPolicyId: "plcy_9Q3S6V1X8Z2B5D7F0H4K",
      runtime: "hedera-agent-kit-policy",
      outcome: "blocked",
      failureCode: "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX",
      requestedPayment: {
        amount: 20,
        token: "HBAR",
        recipientWalletId: "0.0.9049549"
      },
      controls: [
        {
          id: "businessEvaluationAttestation",
          label: "Business evaluation attestation",
          status: "passed",
          failureCode: undefined
        }
      ],
      paymentIntentId: null,
      transactionId: null,
      createdAt: "2026-05-26T00:00:00.000Z",
      updatedAt: "2026-05-26T00:00:00.000Z"
    };

    await store.saveEvidence(evidence);

    const stored = await store.getEvidence("PA-260525-2022-9HTU2UDY");
    expect(stored?.controls[0]).toEqual({
      id: "businessEvaluationAttestation",
      label: "Business evaluation attestation",
      status: "passed"
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
              if (containsUndefinedValue(value)) {
                throw new Error("FIRESTORE_UNDEFINED_VALUE");
              }
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

function containsUndefinedValue(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(containsUndefinedValue);
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).some(containsUndefinedValue);
  }

  return false;
}

function getSortableValue(value: unknown, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, value);
}
