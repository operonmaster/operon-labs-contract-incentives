import { describe, expect, it } from "vitest";
import {
  createFirestorePasPersistenceStore,
  createPasPersistenceStoreFromEnv,
  toPasSubmittedEvent,
  type PersistedIncentiveWorklistRow,
  type FirestoreDatabase,
  type FirestoreDocumentReference
} from "./pas-persistence";
import { createInMemoryUmPlatform, buildPasFhirBundle, type UMRequest } from "@operon-labs/um-platform";

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
      id: umRequest.id,
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      submittedAt: umRequest.submittedAt,
      providerGroupDisplay: umRequest.providerGroupDisplay,
      requestType: umRequest.requestType,
      serviceLabel: umRequest.serviceLabel,
      serviceCode: umRequest.serviceCode,
      state: umRequest.state,
      outcomeStatus: umRequest.outcomeStatus,
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
      paymentIntentId: umRequest.id,
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

  it("canonicalizes legacy stored UMR request and event ids to the PA id", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-LEGACY1"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const evidence = platform.getEvidence(umRequest.id)!;
    const legacyUmRequest = {
      ...umRequest,
      id: "UMR-260526-0900-LEGACY1",
      sourceCaseId: umRequest.id
    };

    await firestore.collection("pasClaims").doc(umRequest.id).set({
      umRequest: legacyUmRequest,
      evidence: {
        ...evidence,
        umRequestId: "UMR-260526-0900-LEGACY1",
        sourceCaseId: umRequest.id
      },
      fhirBundle: buildPasFhirBundle(umRequest, evidence),
      storedAt: umRequest.submittedAt
    });
    await firestore.collection("auditEvents").doc(`${umRequest.id}-PAS_SUBMITTED`).set({
      eventType: "PAS_SUBMITTED",
      caseId: umRequest.id,
      umRequestId: "UMR-260526-0900-LEGACY1",
      submittedAt: umRequest.submittedAt,
      storedAt: umRequest.submittedAt
    });

    await expect(store.getUmRequest(umRequest.id)).resolves.toMatchObject({
      id: umRequest.id,
      caseId: umRequest.id,
      sourceCaseId: umRequest.id
    });
    await expect(store.listUmRequests()).resolves.toEqual([
      expect.objectContaining({
        id: umRequest.id,
        caseId: umRequest.id,
        sourceCaseId: umRequest.id
      })
    ]);
    await expect(store.getEvidence(umRequest.id)).resolves.toMatchObject({
      caseId: umRequest.id,
      umRequestId: umRequest.id,
      sourceCaseId: umRequest.id
    });
    await expect(store.listUmEvents()).resolves.toEqual([
      { eventType: "PAS_SUBMITTED", caseId: umRequest.id, umRequestId: umRequest.id }
    ]);
    expect(
      toPasSubmittedEvent({
        eventType: "PAS_SUBMITTED",
        caseId: umRequest.id,
        umRequestId: "UMR-260526-0900-LEGACY1"
      })
    ).toEqual({
      eventType: "PAS_SUBMITTED",
      caseId: umRequest.id,
      umRequestId: umRequest.id
    });
  });

  it("lists legacy record-only PAS docs through the canonical PA id", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-RECORD1"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const evidence = platform.getEvidence(umRequest.id)!;
    const legacyRecord = {
      ...umRequest,
      id: "UMR-260526-0900-RECORD1",
      sourceCaseId: umRequest.id,
      auditRefs: {
        ...umRequest.auditRefs,
        pasClaimBundleId: "pas-UMR-260526-0900-RECORD1",
        pasClaimResponseBundleId: "pas-UMR-260526-0900-RECORD1"
      }
    };

    await firestore.collection("pasClaims").doc(umRequest.id).set({
      record: legacyRecord,
      evidence,
      fhirBundle: buildPasFhirBundle(umRequest, evidence),
      storedAt: umRequest.submittedAt
    });

    await expect(store.listUmRequests()).resolves.toEqual([
      expect.objectContaining({
        id: umRequest.id,
        caseId: umRequest.id,
        sourceCaseId: umRequest.id,
        auditRefs: expect.objectContaining({
          pasClaimBundleId: umRequest.id,
          pasClaimResponseBundleId: umRequest.id
        })
      })
    ]);
  });

  it("rejects PAS submissions when canonical ids differ across evidence or FHIR artifacts", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-MATCH01"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const evidence = platform.getEvidence(umRequest.id)!;
    const fhirBundle = buildPasFhirBundle(umRequest, evidence);

    await expect(
      store.savePasSubmission({
        umRequest: {
          ...umRequest,
          id: "UMR-260526-0900-MATCH01"
        },
        evidence,
        fhirBundle
      })
    ).rejects.toThrow("PAS_SUBMISSION_ID_NOT_CANONICAL:umRequest.id");

    await expect(
      store.savePasSubmission({
        umRequest: {
          ...umRequest,
          sourceCaseId: "PA-260526-0900-MISMAT0"
        },
        evidence,
        fhirBundle
      })
    ).rejects.toThrow("PAS_SUBMISSION_ID_MISMATCH:umRequest.sourceCaseId");

    await expect(
      store.savePasSubmission({
        umRequest: {
          ...umRequest,
          auditRefs: {
            ...umRequest.auditRefs,
            pasClaimBundleId: "UMR-260526-0900-MATCH01"
          }
        },
        evidence,
        fhirBundle
      })
    ).rejects.toThrow("PAS_SUBMISSION_ID_MISMATCH:umRequest.auditRefs.pasClaimBundleId");

    await expect(
      store.savePasSubmission({
        umRequest,
        evidence: {
          ...evidence,
          caseId: "PA-260526-0900-MISMAT1"
        },
        fhirBundle
      })
    ).rejects.toThrow("PAS_SUBMISSION_ID_MISMATCH:evidence.caseId");

    await expect(
      store.savePasSubmission({
        umRequest,
        evidence,
        fhirBundle: {
          ...fhirBundle,
          id: "PA-260526-0900-MISMAT2"
        }
      })
    ).rejects.toThrow("PAS_SUBMISSION_ID_MISMATCH:fhirBundle.id");

    await expect(
      store.savePasSubmission({
        umRequest,
        evidence,
        fhirBundle: {
          ...fhirBundle,
          entry: fhirBundle.entry.map((entry) =>
            entry.resource.resourceType === "Claim"
              ? {
                  ...entry,
                  resource: {
                    ...entry.resource,
                    id: "PA-260526-0900-MISMAT3"
                  }
                }
              : entry
          )
        }
      })
    ).rejects.toThrow("PAS_SUBMISSION_ID_MISMATCH:fhirBundle.claim.id");

    await expect(
      store.savePasSubmission({
        umRequest,
        evidence,
        fhirBundle: {
          ...fhirBundle,
          entry: fhirBundle.entry.map((entry) =>
            entry.resource.resourceType === "Claim"
              ? {
                  ...entry,
                  resource: {
                    ...entry.resource,
                    identifier: entry.resource.identifier.map((identifier) =>
                      identifier.system.endsWith("/um-request-id")
                        ? {
                            ...identifier,
                            value: "UMR-260526-0900-MATCH01"
                          }
                        : identifier
                    )
                  }
                }
              : entry
          )
        }
      })
    ).rejects.toThrow("PAS_SUBMISSION_ID_MISMATCH:fhirBundle.claim.identifier[1].value");

    await expect(
      store.savePasSubmission({
        umRequest,
        evidence,
        fhirBundle: {
          ...fhirBundle,
          entry: fhirBundle.entry.map((entry) =>
            entry.resource.resourceType === "Claim"
              ? {
                  ...entry,
                  resource: {
                    ...entry.resource,
                    identifier: entry.resource.identifier.filter(
                      (identifier) => !identifier.system.endsWith("/prior-auth-case-id")
                    )
                  }
                }
              : entry
          )
        }
      })
    ).rejects.toThrow("PAS_SUBMISSION_ID_MISSING:fhirBundle.claim.identifier.prior-auth-case-id");

    await expect(
      store.savePasSubmission({
        umRequest,
        evidence,
        fhirBundle: {
          ...fhirBundle,
          entry: fhirBundle.entry.map((entry) =>
            entry.resource.resourceType === "Claim"
              ? {
                  ...entry,
                  resource: {
                    ...entry.resource,
                    identifier: entry.resource.identifier.filter(
                      (identifier) => !identifier.system.endsWith("/um-request-id")
                    )
                  }
                }
              : entry
          )
        }
      })
    ).rejects.toThrow("PAS_SUBMISSION_ID_MISSING:fhirBundle.claim.identifier.um-request-id");

    await expect(firestore.collection("pasClaims").doc(umRequest.id).get()).resolves.toMatchObject({
      exists: false
    });
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
        paymentIntentId: umRequest.id,
        transactionId: "testnet-1"
      } as unknown as Parameters<typeof store.saveIncentiveRow>[0])
    ).rejects.toThrow("UM_REQUEST_ID_REQUIRED");

    await expect(firestore.collection("incentiveEvaluations").doc(umRequest.id).get()).resolves.toMatchObject({
      exists: false
    });
  });

  it("rejects incentive rows whose canonical IDs do not match", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-ROWMATCH"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });

    await expect(
      store.saveIncentiveRow(buildPersistedIncentiveRow(umRequest, {
        umRequestId: "UMR-260526-0900-ROWMATCH"
      }))
    ).rejects.toThrow("PAS_SUBMISSION_ID_NOT_CANONICAL:row.umRequestId");

    await expect(
      store.saveIncentiveRow(buildPersistedIncentiveRow(umRequest, {
        caseId: "PA-260526-0900-OTHER01"
      }))
    ).rejects.toThrow("PAS_SUBMISSION_ID_MISMATCH:row.caseId");

    await expect(
      store.saveIncentiveRow(buildPersistedIncentiveRow(umRequest, {
        paymentIntentId: "pi_test"
      }))
    ).rejects.toThrow("PAS_SUBMISSION_ID_MISMATCH:row.paymentIntentId");

    await expect(firestore.collection("incentiveEvaluations").doc(umRequest.id).get()).resolves.toMatchObject({
      exists: false
    });
  });

  it("canonicalizes legacy stored UMR incentive row ids to the PA id on read", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-ROWLEG1"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const legacyRow = buildPersistedIncentiveRow(umRequest, {
      umRequestId: "UMR-260526-0900-ROWLEG1",
      caseId: "UMR-260526-0900-ROWLEG1",
      paymentIntentId: "UMR-260526-0900-ROWLEG1"
    });

    await firestore.collection("incentiveEvaluations").doc(umRequest.id).set({
      ...legacyRow,
      storedAt: umRequest.submittedAt
    });

    await expect(store.getIncentiveRow(umRequest.id)).resolves.toMatchObject({
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      paymentIntentId: umRequest.id
    });
    await expect(store.listIncentiveRows()).resolves.toEqual([
      expect.objectContaining({
        umRequestId: umRequest.id,
        caseId: umRequest.id
      })
    ]);
  });
});

function buildPersistedIncentiveRow(
  umRequest: UMRequest,
  overrides: Partial<PersistedIncentiveWorklistRow> = {}
): PersistedIncentiveWorklistRow {
  return {
    id: umRequest.id,
    umRequestId: umRequest.id,
    caseId: umRequest.id,
    submittedAt: umRequest.submittedAt,
    providerGroupDisplay: umRequest.providerGroupDisplay,
    requestType: umRequest.requestType,
    serviceLabel: umRequest.serviceLabel,
    serviceCode: umRequest.serviceCode,
    state: umRequest.state,
    outcomeStatus: umRequest.outcomeStatus,
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
    paymentIntentId: umRequest.id,
    transactionId: "testnet-1",
    ...overrides
  };
}

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
        orderBy(field, direction) {
          return {
            async get() {
              const values = [...collection.values()]
                .filter((value) => getNestedValue(value, field) !== undefined)
                .sort((left, right) => String(getNestedValue(left, field)).localeCompare(String(getNestedValue(right, field))));
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

function getNestedValue(value: unknown, path: string): unknown {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, value);
}
