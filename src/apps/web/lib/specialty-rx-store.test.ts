import { describe, expect, it } from "vitest";
import type { FirestoreDatabase } from "./pas-persistence";
import {
  createFirestoreSpecialtyRxCaseStore,
  createInMemorySpecialtyRxCaseStore,
  type SpecialtyFulfillmentCase
} from "./specialty-rx-store";
import type { SpecialtyRxPlanAuditRow } from "./specialty-rx-workflow";

const caseRecord: SpecialtyFulfillmentCase = {
  id: "RXF-260526-0900-DELEGATE",
  umRequestId: "PA-260526-0900-DELEGATE",
  source: "delegate_um_approved",
  planId: "acme-health-ppo",
  pharmacyId: "atlas-specialty-rx",
  pharmacyDisplay: "Atlas Specialty Rx",
  requestType: "pharmacy_benefit",
  serviceCode: "wegovy_semaglutide",
  serviceLabel: "Wegovy semaglutide",
  codingSystem: "NDC",
  billingCode: "0169-4525-14",
  state: "intake_triage",
  paApprovalReceivedAt: "2026-06-18T10:00:00.000Z",
  intakeStartedAt: "2026-06-18T10:05:00.000Z",
  fulfillmentSlaStartedAt: null,
  clearToFillAt: null,
  shipmentScheduledAt: null,
  deliveryConfirmedAt: null,
  exceptionRecordedAt: null,
  scheduleSlaHours: 24,
  intake: {
    approvedPaLinked: true,
    prescriptionPresent: true,
    assignedPharmacyConfirmed: true,
    therapyMetadataPresent: true,
    handoffDataComplete: true
  },
  clearToFill: {
    benefitsOrClaimCheckCompleted: false,
    prescriptionValid: false,
    prescriberClarificationRequired: false,
    prescriberClarificationResolved: true,
    remsRequired: false,
    remsAuthorizationConfirmed: true,
    inventoryAvailable: false,
    copayOrPaymentReady: false
  },
  shipment: {
    patientContactAttemptDocumented: false,
    addressConfirmed: false,
    deliveryWindowConfirmed: false,
    coldChainRequired: true,
    coldChainPackoutValidated: false,
    courierScheduled: false
  },
  fulfillment: {
    shipped: false,
    deliveryConfirmed: false,
    deliveryAttemptDocumented: false,
    temperatureLogValid: false,
    avoidableFulfillmentException: false,
    externalBlockerDocumented: false,
    exceptionReasonCode: null
  },
  updatedAt: "2026-06-18T10:05:00.000Z"
};

describe("specialty rx case store", () => {
  it("saves, lists, and returns defensive copies", async () => {
    const store = createInMemorySpecialtyRxCaseStore();

    await store.saveCase(caseRecord);
    const listed = await store.listCases();

    expect(listed).toEqual([caseRecord]);
    listed[0]!.state = "fulfilled";
    listed[0]!.intake.prescriptionPresent = false;

    await expect(store.getCase(caseRecord.id)).resolves.toEqual(caseRecord);
  });

  it("strips undefined nested payment policy control fields before saving plan rows to Firestore", async () => {
    const firestore = createFakeFirestore({ rejectUndefinedFields: true });
    const store = createFirestoreSpecialtyRxCaseStore(
      { projectId: "operon-labs-nonprod", databaseId: "(default)" },
      firestore
    );
    const row = buildPlanRow({
      paymentPolicyControls: [
        {
          id: "businessEvaluationAttestation",
          label: "Business evaluation attestation",
          status: "passed",
          failureCode: undefined
        },
        {
          id: "paymentEnvelope",
          label: "Payment envelope",
          status: "passed"
        }
      ]
    });

    await expect(store.savePlanRow(row)).resolves.toBeUndefined();

    const rawRow = (await firestore.collection("specialtyRxPlanAuditRows").doc(row.fulfillmentCaseId).get()).data() as SpecialtyRxPlanAuditRow;
    expect(rawRow.paymentPolicyControls).toEqual([
      {
        id: "businessEvaluationAttestation",
        label: "Business evaluation attestation",
        status: "passed"
      },
      {
        id: "paymentEnvelope",
        label: "Payment envelope",
        status: "passed"
      }
    ]);
    expect(rawRow.walletId).toBeNull();
    expect((await store.getPlanRow(row.fulfillmentCaseId))?.paymentPolicyControls[0]).not.toHaveProperty("failureCode");
    await expect(store.listPlanRows()).resolves.toHaveLength(1);
  });

  it("normalizes legacy plan-row SLA fields to fulfillmentSlaStatus without returning deliverySlaStatus", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestoreSpecialtyRxCaseStore(
      { projectId: "operon-labs-nonprod", databaseId: "(default)" },
      firestore
    );
    const legacyRow = {
      ...buildPlanRow({
        fulfillmentSlaStatus: undefined as unknown as SpecialtyRxPlanAuditRow["fulfillmentSlaStatus"]
      }),
      scheduleSlaStatus: "within_sla",
      deliverySlaStatus: "breached"
    };

    await firestore.collection("specialtyRxPlanAuditRows").doc(legacyRow.fulfillmentCaseId).set(legacyRow);

    const row = await store.getPlanRow(legacyRow.fulfillmentCaseId);
    const [listedRow] = await store.listPlanRows();

    expect(row).toMatchObject({
      fulfillmentCaseId: legacyRow.fulfillmentCaseId,
      fulfillmentSlaStatus: "within_sla"
    });
    expect(row).not.toHaveProperty("deliverySlaStatus");
    expect(listedRow).toMatchObject({
      fulfillmentCaseId: legacyRow.fulfillmentCaseId,
      fulfillmentSlaStatus: "within_sla"
    });
    expect(listedRow).not.toHaveProperty("deliverySlaStatus");
  });

  it("normalizes legacy fulfillment cases without a paid SLA start timestamp", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestoreSpecialtyRxCaseStore(
      { projectId: "operon-labs-nonprod", databaseId: "(default)" },
      firestore
    );
    const legacyCase = {
      ...caseRecord,
      state: "shipment_scheduled",
      clearToFillAt: "2026-06-18T16:00:00.000Z",
      shipmentScheduledAt: "2026-06-19T09:30:00.000Z",
      updatedAt: "2026-06-19T09:30:00.000Z"
    } satisfies Record<string, unknown>;
    delete (legacyCase as Record<string, unknown>).fulfillmentSlaStartedAt;

    await firestore.collection("specialtyFulfillmentCases").doc(legacyCase.id).set(legacyCase);

    const storedCase = await store.getCase(legacyCase.id);
    const [listedCase] = await store.listCases();

    expect(storedCase!.fulfillmentSlaStartedAt).toBe("2026-06-18T16:00:00.000Z");
    expect(listedCase!.fulfillmentSlaStartedAt).toBe("2026-06-18T16:00:00.000Z");
    expect(storedCase!).not.toHaveProperty("deliverySlaHours");
  });

  it("normalizes legacy clear-to-fill cases with no clear-to-fill timestamp from updatedAt", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestoreSpecialtyRxCaseStore(
      { projectId: "operon-labs-nonprod", databaseId: "(default)" },
      firestore
    );
    const legacyCase = {
      ...caseRecord,
      id: "RXF-260526-0900-CLEARTF",
      umRequestId: "PA-260526-0900-CLEARTF",
      state: "clear_to_fill",
      clearToFillAt: null,
      updatedAt: "2026-06-18T12:00:00.000Z"
    } satisfies Record<string, unknown>;
    delete (legacyCase as Record<string, unknown>).fulfillmentSlaStartedAt;

    await firestore.collection("specialtyFulfillmentCases").doc(legacyCase.id).set(legacyCase);

    await expect(store.getCase(legacyCase.id)).resolves.toMatchObject({
      id: legacyCase.id,
      state: "clear_to_fill",
      fulfillmentSlaStartedAt: "2026-06-18T12:00:00.000Z",
      clearToFillAt: null
    });
  });
});

function buildPlanRow(overrides: Partial<SpecialtyRxPlanAuditRow> = {}): SpecialtyRxPlanAuditRow {
  return {
    evaluationType: "specialty_rx_fulfillment_sla",
    fulfillmentCase: caseRecord,
    fulfillmentCaseId: caseRecord.id,
    umRequestId: caseRecord.umRequestId,
    id: caseRecord.id,
    planId: caseRecord.planId,
    pharmacyId: caseRecord.pharmacyId,
    pharmacyDisplay: caseRecord.pharmacyDisplay,
    requestType: "pharmacy_benefit",
    serviceLabel: caseRecord.serviceLabel,
    state: caseRecord.state,
    fulfillmentSlaStartedAt: caseRecord.fulfillmentSlaStartedAt,
    clearToFillAt: caseRecord.clearToFillAt,
    shipmentScheduledAt: caseRecord.shipmentScheduledAt,
    deliveryConfirmedAt: caseRecord.deliveryConfirmedAt,
    fulfillmentSlaStatus: "pending",
    businessPolicyStatus: null,
    paymentPolicyStatus: null,
    incentiveStatus: "pending",
    paymentStatus: "pending",
    incentiveValue: 0,
    currency: "HBAR",
    settlementToken: { symbol: "HBAR" },
    reason: "Pending fulfillment",
    reasonCodes: [],
    policyId: null,
    policyControls: [],
    policyCriteria: [],
    paymentPolicyId: null,
    paymentPolicyControls: [],
    audit: null,
    walletId: null,
    paymentIntentId: null,
    transactionId: null,
    ...overrides
  };
}

function createFakeFirestore(options: { rejectUndefinedFields?: boolean } = {}): FirestoreDatabase {
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
              if (options.rejectUndefinedFields) {
                assertNoUndefinedFields(value);
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
        orderBy() {
          return {
            async get() {
              return {
                docs: [...collection.entries()].map(([id, value]) => ({
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

function assertNoUndefinedFields(value: unknown, path = "data"): void {
  if (value === undefined) {
    throw new Error(`Cannot use undefined as a Firestore value (found in field "${path}")`);
  }

  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoUndefinedFields(child, `${path}.${index}`));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assertNoUndefinedFields(child, `${path}.${key}`);
  }
}
