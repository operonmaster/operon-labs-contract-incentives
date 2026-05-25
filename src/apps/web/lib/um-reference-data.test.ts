import { describe, expect, it } from "vitest";
import type { FirestoreDatabase } from "./pas-persistence";
import {
  createFirestoreUmReferenceDataStore,
  createInMemoryUmReferenceDataStore,
  createUmReferenceDataStoreFromEnv
} from "./um-reference-data";

describe("UM reference data store selection", () => {
  it("uses Firestore by default for patient, CRD, and DTR reference data", () => {
    const store = createUmReferenceDataStoreFromEnv({});

    expect(store.backend).toBe("firestore");
  });

  it("allows explicit in-memory reference data for isolated tests", () => {
    const store = createUmReferenceDataStoreFromEnv({ UM_REFERENCE_STORE_BACKEND: "memory" });

    expect(store.backend).toBe("memory");
  });
});

describe("UM reference data store", () => {
  it("serves seeded patient coverage, coverage requirements, and Questionnaires from memory", async () => {
    const store = createInMemoryUmReferenceDataStore();

    const patients = await store.listPatients();
    expect(patients).toHaveLength(6);
    expect(patients.map((patient) => patient.patientId)).toEqual([
      "patient-maya-chen",
      "patient-andre-williams",
      "patient-sofia-ramirez",
      "patient-noah-patel",
      "patient-elena-petrova",
      "patient-grace-kim"
    ]);
    expect(new Set(patients.flatMap((patient) => patient.plans.map((plan) => plan.planId)))).toEqual(
      new Set(["acme-health-ppo", "summit-health-hmo"])
    );
    expect(patients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          patientId: "patient-maya-chen",
          patientDisplay: "Maya Chen",
          plans: [expect.objectContaining({ planId: "acme-health-ppo", planDisplay: "Acme Health PPO" })]
        }),
        expect.objectContaining({
          patientId: "patient-andre-williams",
          patientDisplay: "Andre Williams",
          plans: [expect.objectContaining({ planId: "summit-health-hmo", planDisplay: "Summit Health HMO" })]
        })
      ])
    );
    await expect(store.listCrdServiceOptions("acme-health-ppo")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceCode: "knee_mri",
          serviceLabel: "Knee MRI after injury",
          documentationTemplateId: "knee-mri-pa-dtr-v1"
        })
      ])
    );
    await expect(store.listCrdServiceOptions("summit-health-hmo")).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ serviceCode: "knee_mri" })])
    );
    await expect(
      store.getCoverageRequirements({
        planId: "acme-health-ppo",
        requestType: "outpatient_service",
        serviceCode: "knee_mri"
      })
    ).resolves.toMatchObject({
      serviceCode: "knee_mri",
      coveredBenefit: true,
      priorAuthRequired: true
    });
    await expect(store.getDtrQuestionnaire("knee-mri-pa-dtr-v1")).resolves.toMatchObject({
      id: "knee-mri-pa-dtr-v1",
      questions: expect.arrayContaining([expect.objectContaining({ id: "knee_xray" })])
    });
  });

  it("auto-seeds FHIR and Da Vinci aligned Firestore reference collections before reading CRD and DTR data", async () => {
    const firestore = createFakeFirestore();
    const store = createFirestoreUmReferenceDataStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );

    await expect(store.listPatients()).resolves.toHaveLength(6);
    await expect(store.listCrdServiceOptions("acme-health-ppo")).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ serviceCode: "full_body_wellness_mri" })])
    );
    await expect(store.getDtrQuestionnaire("knee-mri-pa-dtr-v1")).resolves.toMatchObject({
      serviceCode: "knee_mri"
    });

    await expect(firestore.collection("patients").get()).resolves.toMatchObject({ docs: expect.any(Array) });
    expect((await firestore.collection("patients").get()).docs).toHaveLength(6);
    expect((await firestore.collection("coverageRequirementRules").get()).docs.length).toBeGreaterThanOrEqual(8);
    expect((await firestore.collection("questionnaires").get()).docs.length).toBeGreaterThanOrEqual(3);
    expect(firestore.collectionNames()).not.toEqual(
      expect.arrayContaining(["members", "crdRules", "dtrQuestionnaires"])
    );
  });

  it("repairs partially seeded Firestore patient and coverage defaults", async () => {
    const firestore = createFakeFirestore();
    await firestore.collection("patients").doc("patient-maya-chen").set({
      patientId: "patient-maya-chen",
      patientDisplay: "Maya Chen",
      dateOfBirth: "1987-04-12",
      plans: [{ planId: "acme-health-ppo", planDisplay: "Acme Health PPO" }],
      displayOrder: 1
    });
    const store = createFirestoreUmReferenceDataStore(
      {
        projectId: "operon-labs-nonprod",
        databaseId: "(default)"
      },
      firestore
    );

    await expect(store.listPatients()).resolves.toHaveLength(6);
    await expect(store.listCrdServiceOptions("summit-health-hmo")).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ serviceCode: "knee_mri" })])
    );
    expect((await firestore.collection("patients").get()).docs).toHaveLength(6);
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
        orderBy(field, direction) {
          return {
            async get() {
              const values = [...collection.values()].sort((left, right) => {
                const leftValue = getSortableValue(left, field);
                const rightValue = getSortableValue(right, field);
                return String(leftValue).localeCompare(String(rightValue));
              });
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

function getSortableValue(value: unknown, field: string): unknown {
  if (typeof value !== "object" || value === null) {
    return "";
  }

  return (value as Record<string, unknown>)[field] ?? "";
}
