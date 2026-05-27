import { describe, expect, it } from "vitest";
import {
  createFirestorePasPersistenceStore,
  createPasPersistenceStoreFromEnv,
  toPasSubmittedEvent,
  type PersistedIncentiveWorklistRow,
  type FirestoreDatabase,
  type FirestoreDocumentReference
} from "./pas-persistence";
import {
  createInMemoryUmPlatform,
  buildPasFhirBundle,
  startClinicalReviewForRequest,
  type UMRequest
} from "@operon-labs/um-platform";

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

    const pasClaimSnapshot = await firestore.collection("pasClaims").doc(umRequest.id).get();
    expect(pasClaimSnapshot.data()).toMatchObject({
      resourceType: "Bundle",
      id: umRequest.id,
      entry: expect.any(Array)
    });
    expect(pasClaimSnapshot.data()).not.toHaveProperty("umRequest");
    expect(pasClaimSnapshot.data()).not.toHaveProperty("record");
    expect(pasClaimSnapshot.data()).not.toHaveProperty("evidence");
    const nativeUmRequestSnapshot = await firestore.collection("umRequests").doc(umRequest.id).get();
    expect(nativeUmRequestSnapshot.exists).toBe(true);
    expect(nativeUmRequestSnapshot.data()).toMatchObject({
      id: umRequest.id,
      caseId: umRequest.id,
      sourceCaseId: umRequest.id,
      state: "pend",
      outcomeStatus: null
    });
    await expect(store.getUmRequest(umRequest.id)).resolves.toMatchObject({
      id: umRequest.id
    });
    await expect(store.getEvidence(umRequest.id)).resolves.toMatchObject({
      id: umRequest.id,
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
      expect.arrayContaining(["pasClaims", "umRequests", "auditEvents", "incentiveEvaluations"])
    );
    expect(firestore.collectionNames()).not.toEqual(expect.arrayContaining(["pasRequests", "pasEvents"]));
  });

  it("updates workflow state in umRequests without mutating the submitted PAS FHIR claim", async () => {
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
      requestType: "pharmacy_benefit",
      serviceCode: "wegovy_semaglutide"
    });
    const evidence = platform.getEvidence(umRequest.id)!;

    await store.savePasSubmission({
      umRequest,
      evidence,
      fhirBundle: buildPasFhirBundle(umRequest, evidence)
    });

    const submittedPasClaim = (await firestore.collection("pasClaims").doc(umRequest.id).get()).data();
    const inReview = startClinicalReviewForRequest(umRequest, "reviewer-ana");

    await store.saveUmRequest(inReview);

    expect((await firestore.collection("pasClaims").doc(umRequest.id).get()).data()).toEqual(submittedPasClaim);
    expect((await firestore.collection("umRequests").doc(umRequest.id).get()).data()).toMatchObject({
      id: umRequest.id,
      state: "in_clinical_review",
      reviewStartedAt: inReview.reviewStartedAt,
      clinicalReview: expect.objectContaining({
        reviewerId: "reviewer-ana"
      })
    });
    await expect(store.getUmRequest(umRequest.id)).resolves.toMatchObject({
      id: umRequest.id,
      state: "in_clinical_review",
      reviewStartedAt: inReview.reviewStartedAt
    });
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
    expect((await firestore.collection("umRequests").doc(umRequest.id).get()).data()).toMatchObject({
      id: umRequest.id,
      caseId: umRequest.id,
      sourceCaseId: umRequest.id
    });
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

  it("quarantines stored UM request created events when caseId is stale", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );

    await firestore.collection("auditEvents").doc("stale-case-event").set({
      eventType: "UM_REQUEST_CREATED",
      caseId: "PA-260526-0900-WRONG99",
      umRequestId: "PA-260526-0900-EVENT01",
      submittedAt: "2026-05-26T09:00:00.000Z",
      storedAt: "2026-05-26T09:00:00.000Z"
    });

    await expect(store.listUmEvents()).resolves.toEqual([]);
    expect(
      toPasSubmittedEvent({
        eventType: "PAS_SUBMITTED",
        caseId: "PA-260526-0900-WRONG99",
        umRequestId: "PA-260526-0900-EVENT01"
      })
    ).toEqual({
      eventType: "PAS_SUBMITTED",
      caseId: "PA-260526-0900-EVENT01",
      umRequestId: "PA-260526-0900-EVENT01"
    });
  });

  it("quarantines stored UM request created events with matching legacy UMR ids", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );

    await firestore.collection("auditEvents").doc("PA-260526-0900-EVENT04-UM_REQUEST_CREATED").set({
      eventType: "UM_REQUEST_CREATED",
      caseId: "UMR-260526-0900-EVENT04",
      umRequestId: "UMR-260526-0900-EVENT04",
      submittedAt: "2026-05-26T09:00:00.000Z",
      storedAt: "2026-05-26T09:00:00.000Z"
    });
    await firestore.collection("auditEvents").doc("PA-260526-0900-EVENT05-UM_REQUEST_CREATED").set({
      eventType: "UM_REQUEST_CREATED",
      caseId: "pas-UMR-260526-0900-EVENT05",
      umRequestId: "pas-UMR-260526-0900-EVENT05",
      submittedAt: "2026-05-26T09:00:00.000Z",
      storedAt: "2026-05-26T09:00:00.000Z"
    });

    await expect(store.listUmEvents()).resolves.toEqual([]);
  });

  it("quarantines stored UM request created events when embedded ids disagree with the document id", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );

    await firestore.collection("auditEvents").doc("PA-260526-0900-EVENT02-UM_REQUEST_CREATED").set({
      eventType: "UM_REQUEST_CREATED",
      caseId: "PA-260526-0900-WRONG01",
      umRequestId: "PA-260526-0900-WRONG01",
      submittedAt: "2026-05-26T09:00:00.000Z",
      storedAt: "2026-05-26T09:00:00.000Z"
    });

    await expect(store.listUmEvents()).resolves.toEqual([]);
  });

  it("uses the audit event document id for legacy UM request created events only when umRequestId is absent", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );

    await firestore.collection("auditEvents").doc("PA-260526-0900-EVENT03-UM_REQUEST_CREATED").set({
      eventType: "UM_REQUEST_CREATED",
      submittedAt: "2026-05-26T09:00:00.000Z",
      storedAt: "2026-05-26T09:00:00.000Z"
    });

    await expect(store.listUmEvents()).resolves.toEqual([
      {
        eventType: "UM_REQUEST_CREATED",
        caseId: "PA-260526-0900-EVENT03",
        umRequestId: "PA-260526-0900-EVENT03"
      }
    ]);
  });

  it("does not use caseId as a lookup path for legacy UM request created events", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );

    await firestore.collection("auditEvents").doc("legacy-case-only-event").set({
      eventType: "UM_REQUEST_CREATED",
      caseId: "PA-260526-0900-CASEONLY",
      submittedAt: "2026-05-26T09:00:00.000Z",
      storedAt: "2026-05-26T09:00:00.000Z"
    });

    await expect(store.listUmEvents()).resolves.toEqual([]);
  });

  it("canonicalizes legacy UM requests from doc id instead of sourceCaseId", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-REQDOC1"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const evidence = platform.getEvidence(umRequest.id)!;
    const legacyUmRequest = {
      ...umRequest,
      id: "UMR-260526-0900-REQDOC1",
      caseId: undefined,
      sourceCaseId: "PA-260526-0900-WRONG99"
    };

    await firestore.collection("pasClaims").doc(umRequest.id).set({
      umRequest: legacyUmRequest,
      evidence,
      fhirBundle: buildPasFhirBundle(umRequest, evidence),
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
      id: umRequest.id,
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      sourceCaseId: umRequest.id
    });
  });

  it("uses the lookup id over stale embedded UM request and evidence ids on read", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-LOOKUP1"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const evidence = platform.getEvidence(umRequest.id)!;

    await firestore.collection("pasClaims").doc(umRequest.id).set({
      umRequest: {
        ...umRequest,
        id: "PA-260526-0900-STALE99",
        caseId: "PA-260526-0900-STALE99",
        sourceCaseId: "PA-260526-0900-STALE99",
        auditRefs: {
          pasClaimBundleId: "PA-260526-0900-STALE99",
          pasClaimResponseBundleId: "PA-260526-0900-STALE99",
          staleNestedCaseId: "PA-260526-0900-STALE99"
        }
      },
      evidence: {
        ...evidence,
        id: "PA-260526-0900-STALE99",
        umRequestId: "PA-260526-0900-STALE99",
        caseId: "PA-260526-0900-STALE99",
        sourceCaseId: "PA-260526-0900-STALE99"
      },
      fhirBundle: buildPasFhirBundle(umRequest, evidence),
      storedAt: umRequest.submittedAt
    });

    await expect(store.getUmRequest(umRequest.id)).resolves.toMatchObject({
      id: umRequest.id,
      caseId: umRequest.id,
      sourceCaseId: umRequest.id,
      auditRefs: {
        pasClaimBundleId: umRequest.id,
        pasClaimResponseBundleId: umRequest.id
      }
    });
    expect((await store.getUmRequest(umRequest.id))?.auditRefs).not.toHaveProperty("staleNestedCaseId");
    await expect(store.getEvidence(umRequest.id)).resolves.toMatchObject({
      id: umRequest.id,
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      sourceCaseId: umRequest.id
    });
  });

  it("canonicalizes legacy stored evidence to the full UM evidence shape without using sourceCaseId as identity", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-EVID001"
    });
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
    const currentEvidence = platform.getEvidence(umRequest.id)!;
    const legacyEvidence = {
      ...currentEvidence,
      id: undefined,
      umRequestId: undefined,
      caseId: undefined,
      sourceCaseId: "PA-260526-0900-WRONG99",
      dtrCompleted: undefined,
      dtrTemplateCompleted: true
    };

    await firestore.collection("pasClaims").doc(umRequest.id).set({
      umRequest,
      evidence: legacyEvidence,
      fhirBundle: buildPasFhirBundle(umRequest, currentEvidence),
      storedAt: umRequest.submittedAt
    });

    await expect(store.getEvidence(umRequest.id)).resolves.toMatchObject({
      id: umRequest.id,
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      sourceCaseId: umRequest.id,
      dtrCompleted: true,
      dtrTemplateCompleted: true
    });
  });

  it("rebuilds provider documentation evidence from the canonical UM request when stored evidence is stale", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-EVID002"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "full_body_wellness_mri",
      acknowledgedNotCovered: true
    });
    const staleApprovedEvidence = {
      ...platform.getEvidence(umRequest.id)!,
      serviceCode: "knee_mri",
      billingCode: "73721",
      coveredBenefit: true,
      crdCoveredBenefit: true,
      dtrRequested: true,
      dtrCompleted: true,
      dtrTemplateCompleted: true,
      attachmentChecklistComplete: true,
      fhirFieldsPresent: true
    };

    await firestore.collection("pasClaims").doc(umRequest.id).set({
      umRequest,
      evidence: staleApprovedEvidence,
      fhirBundle: buildPasFhirBundle(umRequest, platform.getEvidence(umRequest.id)!),
      storedAt: umRequest.submittedAt
    });

    await expect(store.getEvidence(umRequest.id)).resolves.toMatchObject({
      id: umRequest.id,
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      serviceCode: "full_body_wellness_mri",
      billingCode: "76498",
      coveredBenefit: false,
      dtrRequested: false,
      dtrCompleted: false,
      dtrTemplateCompleted: false
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
        evidence: {
          ...evidence,
          id: "PA-260526-0900-MISMAT4"
        },
        fhirBundle
      })
    ).rejects.toThrow("PAS_SUBMISSION_ID_MISMATCH:evidence.id");

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

  it("scrubs legacy PA outcome fields from persisted incentive rows on read", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-ROWLEG2"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });

    await firestore.collection("incentiveEvaluations").doc(umRequest.id).set({
      ...buildPersistedIncentiveRow(umRequest),
      paResult: "submitted_pending",
      denialReason: null,
      storedAt: umRequest.submittedAt
    });

    const row = await store.getIncentiveRow(umRequest.id);
    expect(row).not.toHaveProperty("paResult");
    expect(row).not.toHaveProperty("denialReason");

    const rows = await store.listIncentiveRows();
    expect(rows[0]).not.toHaveProperty("paResult");
    expect(rows[0]).not.toHaveProperty("denialReason");
  });

  it("backfills UM row fields for legacy persisted incentive rows", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-ROWLEG3"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });
    const legacyRow = {
      ...buildPersistedIncentiveRow(umRequest),
      id: undefined,
      state: undefined,
      outcomeStatus: undefined,
      paResult: "submitted_pending",
      denialReason: null
    };

    await firestore.collection("incentiveEvaluations").doc(umRequest.id).set({
      ...legacyRow,
      storedAt: umRequest.submittedAt
    });

    await expect(store.getIncentiveRow(umRequest.id)).resolves.toMatchObject({
      id: umRequest.id,
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      state: "pend",
      outcomeStatus: null
    });
    await expect(store.listIncentiveRows()).resolves.toEqual([
      expect.objectContaining({
        id: umRequest.id,
        umRequestId: umRequest.id,
        caseId: umRequest.id,
        state: "pend",
        outcomeStatus: null
      })
    ]);
    const row = await store.getIncentiveRow(umRequest.id);
    expect(row).not.toHaveProperty("paResult");
    expect(row).not.toHaveProperty("denialReason");
  });

  it("uses the lookup id over stale embedded incentive row ids on read", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestorePasPersistenceStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );
    const platform = createInMemoryUmPlatform({
      generateCaseId: () => "PA-260526-0900-ROWLOOK"
    });
    const umRequest = platform.submitPriorAuth({
      requestType: "outpatient_service",
      serviceCode: "knee_mri"
    });

    await firestore.collection("incentiveEvaluations").doc(umRequest.id).set({
      ...buildPersistedIncentiveRow(umRequest),
      id: "PA-260526-0900-ROWBAD1",
      umRequestId: "PA-260526-0900-ROWBAD1",
      caseId: "PA-260526-0900-ROWBAD1",
      paymentIntentId: "PA-260526-0900-ROWBAD1",
      storedAt: umRequest.submittedAt
    });

    await expect(store.getIncentiveRow(umRequest.id)).resolves.toMatchObject({
      id: umRequest.id,
      umRequestId: umRequest.id,
      caseId: umRequest.id,
      paymentIntentId: umRequest.id
    });
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
              const values = [...collection.entries()]
                .filter(([, value]) => getNestedValue(value, field) !== undefined)
                .sort(([, left], [, right]) => String(getNestedValue(left, field)).localeCompare(String(getNestedValue(right, field))));
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
