import { buildBusinessEvaluationId, buildPaymentIntentId } from "@operon-labs/hedera-executor";
import { describe, expect, it } from "vitest";
import type { FirestoreDatabase } from "./pas-persistence";
import {
  createFirestorePaymentPolicyEvidenceStore,
  createPaymentPolicyEvidenceStoreFromEnv,
  type PaymentPolicyEvidence
} from "./payment-policy-evidence-store";

type HashedPaymentPolicyEvidence = PaymentPolicyEvidence & {
  umRequestId: string;
  paymentIntentId: string;
};

describe("payment policy evidence store", () => {
  it("requires an explicit GCP project before selecting Firestore", () => {
    expect(() => createPaymentPolicyEvidenceStoreFromEnv({})).toThrow("GCP_PROJECT_ID_REQUIRED");
  });

  it("allows explicit memory mode for isolated tests", () => {
    expect(createPaymentPolicyEvidenceStoreFromEnv({ PAYMENT_POLICY_EVIDENCE_STORE_BACKEND: "memory" })).toBeUndefined();
  });

  it("stores payment-policy evidence by payment intent id", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePaymentPolicyEvidenceStore(
      {
        projectId: "example-gcp-project",
        databaseId: "(default)"
      },
      firestore
    );
    const evidence = buildPaymentPolicyEvidence({
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
          expected: "<= 7 HBAR",
          actual: "20 HBAR",
          failureCode: "HEDERA_PAYMENT_AMOUNT_EXCEEDS_PLAN_MAX"
        }
      ],
      transactionId: null
    });

    await store.saveEvidence(evidence);

    await expect(store.getEvidence(evidence.paymentIntentId)).resolves.toEqual(evidence);
    const docs = (await firestore.collection("paymentPolicyEvidences").get()).docs;
    expect(docs).toHaveLength(1);
    expect(docs[0]?.id).toBe(evidence.paymentIntentId);
  });

  it("removes undefined optional control fields before writing to Firestore", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePaymentPolicyEvidenceStore(
      {
        projectId: "example-gcp-project",
        databaseId: "(default)"
      },
      firestore
    );
    const evidence = buildPaymentPolicyEvidence({
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
      transactionId: null,
      createdAt: "2026-05-26T00:00:00.000Z"
    });

    await store.saveEvidence(evidence);

    const stored = await store.getEvidence(evidence.paymentIntentId);
    expect(stored?.controls[0]).toEqual({
      id: "businessEvaluationAttestation",
      label: "Business evaluation attestation",
      status: "passed"
    });
  });

  it("rejects noncanonical payment-policy evidence ids and tuple mismatches", async () => {
    const store = createFirestorePaymentPolicyEvidenceStore(
      {
        projectId: "example-gcp-project",
        databaseId: "(default)"
      },
      createFakeFirestore()
    );
    const evidence = buildPaymentPolicyEvidence();

    await expect(
      store.saveEvidence({
        ...evidence,
        umRequestId: "UMR-260525-1949-ML6LAWFP"
      })
    ).rejects.toThrow("PAYMENT_POLICY_EVIDENCE_ID_NOT_CANONICAL:evidence.umRequestId");

    await expect(
      store.saveEvidence({
        ...evidence,
        caseId: "PA-260525-1949-OTHER01"
      })
    ).rejects.toThrow("PAYMENT_POLICY_EVIDENCE_ID_MISMATCH:evidence.caseId");

    await expect(
      store.saveEvidence({
        ...evidence,
        incentiveEvaluationId: "ie_bad"
      })
    ).rejects.toThrow("PAYMENT_POLICY_EVIDENCE_ID_MISMATCH:evidence.incentiveEvaluationId");

    await expect(
      store.saveEvidence({
        ...evidence,
        paymentIntentId: "pi_bad"
      })
    ).rejects.toThrow("PAYMENT_POLICY_EVIDENCE_ID_MISMATCH:evidence.paymentIntentId");

    await expect(
      store.saveEvidence({
        ...evidence,
        paymentIntentId: null
      } as unknown as PaymentPolicyEvidence)
    ).rejects.toThrow("PAYMENT_POLICY_EVIDENCE_ID_REQUIRED:evidence.paymentIntentId");
  });
});

function buildPaymentPolicyEvidence(
  overrides: Partial<HashedPaymentPolicyEvidence> = {}
): HashedPaymentPolicyEvidence {
  const umRequestId = "PA-260525-1949-ML6LAWFP";
  const businessPolicyId = "plcy_9Q3S6V1X8Z2B5D7F0H4K";
  const paymentPolicyId = "summit-health-hmo";
  const incentiveEvaluationId = buildBusinessEvaluationId({ umRequestId, businessPolicyId });
  const paymentIntentId = buildPaymentIntentId({
    umRequestId,
    caseId: umRequestId,
    incentiveEvaluationId,
    businessPolicyId,
    paymentPolicyId
  });

  return {
    incentiveEvaluationId,
    umRequestId,
    caseId: umRequestId,
    planId: paymentPolicyId,
    paymentPolicyId,
    businessPolicyId,
    runtime: "hedera-agent-kit-policy",
    outcome: "paid",
    failureCode: null,
    requestedPayment: {
      amount: 5,
      token: "HBAR",
      recipientWalletId: "0.0.9049549"
    },
    controls: [
      {
        id: "businessEvaluationAttestation",
        label: "Business evaluation attestation",
        status: "passed"
      }
    ],
    paymentIntentId,
    transactionId: "0.0.6870566@1779686274.765050870",
    createdAt: "2026-05-26T00:00:00.000Z",
    updatedAt: "2026-05-26T00:00:00.000Z",
    ...overrides
  };
}

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
