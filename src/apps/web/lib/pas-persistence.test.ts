import { describe, expect, it } from "vitest";
import {
  createFirestorePasPersistenceStore,
  createPasPersistenceStoreFromEnv,
  type FirestoreDatabase
} from "./pas-persistence";
import { createInMemoryUmPlatform, buildPasFhirBundle } from "@operon-labs/um-platform";

describe("PAS persistence store selection", () => {
  it("uses Firestore in operon-labs-nonprod when no PAS store backend is configured", () => {
    const store = createPasPersistenceStoreFromEnv({});

    expect(store?.backend).toBe("firestore");
  });

  it("allows explicit in-process memory for isolated tests and offline demos", () => {
    expect(createPasPersistenceStoreFromEnv({ PAS_STORE_BACKEND: "memory" })).toBeUndefined();
  });

  it("uses the default GCP project id when Firestore backend is configured without project env", () => {
    const store = createPasPersistenceStoreFromEnv({ PAS_STORE_BACKEND: "firestore" });

    expect(store?.backend).toBe("firestore");
  });

  it("creates a Firestore-backed store when backend and project are configured", () => {
    const store = createPasPersistenceStoreFromEnv({
      PAS_STORE_BACKEND: "firestore",
      GCP_PROJECT_ID: "operon-labs-nonprod",
      FIRESTORE_DATABASE_ID: "(default)"
    });

    expect(store?.backend).toBe("firestore");
  });

  it("persists PAS Claims, PAS audit events, and incentive rows with Firestore collection boundaries", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform();
    const record = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const evidence = platform.getEvidence(record.caseId)!;

    await store.savePriorAuth({
      record,
      evidence,
      fhirBundle: buildPasFhirBundle(record, evidence)
    });
    await store.saveIncentiveRow({
      caseId: record.caseId,
      submittedAt: record.submittedAt,
      providerGroupDisplay: record.providerGroupDisplay,
      requestType: record.requestType,
      serviceLabel: record.serviceLabel,
      serviceCode: record.serviceCode,
      paResult: record.paResult,
      denialReason: record.denialReason,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed",
      incentiveValue: 5,
      currency: "HBAR",
      settlementToken: {
        symbol: "HBAR"
      },
      reason: "Complete DTR + PAS before cutoff",
      reasonCodes: [],
      policyId: "provider-documentation-completeness-v1",
      policyControls: [],
      policyCriteria: [],
      audit: {
        id: "audit-1",
        requestHash: "hash-1",
        policyId: "provider-documentation-completeness-v1",
        policyVersion: "2026-05-24",
        decision: "approved",
        reasonCodes: [],
        transactionId: "testnet-1",
        createdAt: record.submittedAt
      },
      walletId: "0.0.9049549",
      paymentIntentId: "pi_test",
      transactionId: "testnet-1"
    });

    await expect(store.getPriorAuthRecord(record.caseId)).resolves.toMatchObject({ caseId: record.caseId });
    await expect(store.getEvidence(record.caseId)).resolves.toMatchObject({ caseId: record.caseId, fhirFieldsPresent: true });
    await expect(store.listPasEvents()).resolves.toEqual([{ eventType: "PAS_SUBMITTED", caseId: record.caseId }]);
    await expect(store.listIncentiveRows()).resolves.toEqual([
      expect.objectContaining({ caseId: record.caseId, paymentStatus: "auto_executed" })
    ]);
    expect(firestore.collectionNames()).toEqual(
      expect.arrayContaining(["pasClaims", "auditEvents", "incentiveEvaluations"])
    );
    expect(firestore.collectionNames()).not.toEqual(expect.arrayContaining(["pasRequests", "pasEvents"]));
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
