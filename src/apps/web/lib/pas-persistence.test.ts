import { describe, expect, it } from "vitest";
import {
  createFirestorePasPersistenceStore,
  createPasPersistenceStoreFromEnv,
  type FirestoreDatabase,
  type FirestoreDocumentReference
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
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri",
      dtr: {
        symptomDurationConfirmed: true,
        conservativeTherapyConfirmed: true,
        examFindingsConfirmed: true,
        clinicalNoteAttached: true
      }
    });
    const evidence = platform.getEvidence(umRequest.id)!;

    await store.savePasSubmission({
      umRequest,
      evidence,
      fhirBundle: buildPasFhirBundle(umRequest, evidence)
    });
    await store.saveIncentiveRow({
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      submittedAt: umRequest.submittedAt,
      providerGroupDisplay: umRequest.providerGroupDisplay,
      requestType: umRequest.requestType,
      serviceLabel: umRequest.serviceLabel,
      serviceCode: umRequest.serviceCode,
      paResult: umRequest.paResult,
      denialReason: umRequest.denialReason,
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
        createdAt: umRequest.submittedAt
      },
      walletId: "0.0.9049549",
      paymentIntentId: "pi_test",
      transactionId: "testnet-1"
    });

    const snapshot = await firestore.collection("pasClaims").doc(umRequest.id).get();
    expect(snapshot.data()).toMatchObject({
      umRequest: {
        id: umRequest.id
      },
      evidence: {
        umRequestId: umRequest.id
      },
      fhirBundle: {
        id: umRequest.id
      }
    });
    await expect(store.getUmRequest(umRequest.id)).resolves.toMatchObject({
      id: umRequest.id
    });
    await expect(store.getEvidence(umRequest.id)).resolves.toMatchObject({
      umRequestId: umRequest.id,
      fhirFieldsPresent: true
    });
    await expect(store.listUmEvents()).resolves.toEqual([
      { eventType: "PAS_SUBMITTED", caseId: umRequest.id, umRequestId: umRequest.id },
      { eventType: "UM_REQUEST_CREATED", caseId: umRequest.id, umRequestId: umRequest.id }
    ]);
    await expect(firestore.collection("incentiveEvaluations").doc(umRequest.id).get()).resolves.toMatchObject({
      exists: true
    });
    await expect(store.getIncentiveRow(umRequest.id)).resolves.toMatchObject({
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      paymentStatus: "auto_executed"
    });
    await expect(store.listIncentiveRows()).resolves.toEqual([
      expect.objectContaining({
        umRequestId: umRequest.id,
        caseId: umRequest.id,
        paymentStatus: "auto_executed"
      })
    ]);
    expect(firestore.collectionNames()).toEqual(
      expect.arrayContaining(["pasClaims", "auditEvents", "incentiveEvaluations"])
    );
    expect(firestore.collectionNames()).not.toEqual(expect.arrayContaining(["pasRequests", "pasEvents"]));
  });

  it("saves the PAS Claim and submitted event in one Firestore batch", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform();
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const evidence = platform.getEvidence(umRequest.id)!;

    await store.savePasSubmission({
      umRequest,
      evidence,
      fhirBundle: buildPasFhirBundle(umRequest, evidence)
    });

    expect(firestore.batchCommits()).toBe(1);
    await expect(store.getUmRequest(umRequest.id)).resolves.toMatchObject({
      id: umRequest.id
    });
    await expect(store.listUmEvents()).resolves.toEqual([
      { eventType: "PAS_SUBMITTED", caseId: umRequest.id, umRequestId: umRequest.id },
      { eventType: "UM_REQUEST_CREATED", caseId: umRequest.id, umRequestId: umRequest.id }
    ]);
  });

  it("rejects incentive rows without a UM request id instead of falling back to another key", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform();
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });

    await expect(
      store.saveIncentiveRow({
        caseId: umRequest.id,
        submittedAt: umRequest.submittedAt,
        providerGroupDisplay: umRequest.providerGroupDisplay,
        requestType: umRequest.requestType,
        serviceLabel: umRequest.serviceLabel,
        serviceCode: umRequest.serviceCode,
        paResult: umRequest.paResult,
        denialReason: umRequest.denialReason,
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
          createdAt: umRequest.submittedAt
        },
        walletId: "0.0.9049549",
        paymentIntentId: "pi_test",
        transactionId: "testnet-1"
      } as unknown as Parameters<typeof store.saveIncentiveRow>[0])
    ).rejects.toThrow("UM_REQUEST_ID_REQUIRED");

    await expect(firestore.collection("incentiveEvaluations").doc(umRequest.id).get()).resolves.toMatchObject({
      exists: false
    });
  });
});

function createFakeFirestore(): FirestoreDatabase & { collectionNames(): string[]; batchCommits(): number } {
  const collections = new Map<string, Map<string, unknown>>();
  let batchCommitCount = 0;

  return {
    batch() {
      const writes: Array<{ ref: FirestoreDocumentReference; payload: unknown }> = [];

      return {
        set(ref, value) {
          writes.push({ ref, payload: value });
          return this;
        },
        async commit() {
          batchCommitCount += 1;
          await Promise.all(writes.map((write) => write.ref.set(write.payload)));
        }
      };
    },
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
    },
    batchCommits() {
      return batchCommitCount;
    }
  };
}
