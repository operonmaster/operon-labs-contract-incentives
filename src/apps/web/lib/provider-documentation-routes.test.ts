import { describe, expect, it } from "vitest";
import { GET as getCoverageRequirements } from "../app/api/um/crd/coverage-requirements/route";
import { GET as listCrdServiceOptions } from "../app/api/um/crd/service-options/route";
import { GET as getDtrQuestionnaire } from "../app/api/um/dtr/questionnaires/[questionnaireId]/route";
import { GET as listPatients } from "../app/api/um/patients/route";
import { GET as listIncentives } from "../app/api/provider-documentation/incentives/route";
import { GET as listPriorAuths, POST as submitPriorAuth } from "../app/api/um/prior-auths/route";
import { GET as getEvidence } from "../app/api/um/prior-auths/[caseId]/evidence/route";

describe("provider documentation API routes", () => {
  it("serves patient coverage context for the provider portal patient and plan picker", async () => {
    const response = await listPatients();
    const payload = (await response.json()) as { patients: Array<{ patientId: string; plans: Array<{ planId: string }> }> };

    expect(response.status).toBe(200);
    expect(payload.patients).toHaveLength(6);
    expect(new Set(payload.patients.flatMap((patient) => patient.plans.map((plan) => plan.planId)))).toEqual(
      new Set(["acme-health-ppo", "summit-health-hmo"])
    );
    expect(payload.patients).toEqual([
      expect.objectContaining({
        patientId: "patient-maya-chen",
        plans: [expect.objectContaining({ planId: "acme-health-ppo" })]
      }),
      expect.objectContaining({
        patientId: "patient-andre-williams",
        plans: [expect.objectContaining({ planId: "summit-health-hmo" })]
      }),
      expect.objectContaining({
        patientId: "patient-sofia-ramirez",
        plans: [expect.objectContaining({ planId: "acme-health-ppo" })]
      }),
      expect.objectContaining({
        patientId: "patient-noah-patel",
        plans: [expect.objectContaining({ planId: "summit-health-hmo" })]
      }),
      expect.objectContaining({
        patientId: "patient-elena-petrova",
        plans: [expect.objectContaining({ planId: "acme-health-ppo" })]
      }),
      expect.objectContaining({
        patientId: "patient-grace-kim",
        plans: [expect.objectContaining({ planId: "summit-health-hmo" })]
      })
    ]);
  });

  it("serves CRD service options matching the provider portal service picker", async () => {
    const response = await listCrdServiceOptions(new Request("http://localhost/api/um/crd/service-options?planId=acme-health-ppo"));
    const payload = (await response.json()) as { services: Array<{ serviceCode: string; procedureCode: string; serviceLabel: string }> };

    expect(response.status).toBe(200);
    expect(payload.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceCode: "knee_mri",
          procedureCode: "CPT 73721",
          serviceLabel: "Knee MRI after injury"
        }),
        expect.objectContaining({
          serviceCode: "wegovy_semaglutide",
          procedureCode: "NDC 0169-4525-14"
        })
      ])
    );
  });

  it("serves CRD coverage requirements for the selected request type and service", async () => {
    const response = await getCoverageRequirements(
      new Request("http://localhost/api/um/crd/coverage-requirements?planId=acme-health-ppo&requestType=outpatient_service&serviceCode=knee_mri")
    );
    const payload = (await response.json()) as { requirements: { serviceCode: string; documentationTemplateId: string } };

    expect(response.status).toBe(200);
    expect(payload.requirements).toMatchObject({
      serviceCode: "knee_mri",
      documentationTemplateId: "knee-mri-pa-dtr-v1"
    });
  });

  it("serves DTR questionnaires for payer-requested documentation templates", async () => {
    const response = await getDtrQuestionnaire(
      new Request("http://localhost/api/um/dtr/questionnaires/knee-mri-pa-dtr-v1"),
      { params: Promise.resolve({ questionnaireId: "knee-mri-pa-dtr-v1" }) }
    );
    const payload = (await response.json()) as { questionnaire: { id: string; questions: Array<{ id: string }> } };

    expect(response.status).toBe(200);
    expect(payload.questionnaire).toMatchObject({
      id: "knee-mri-pa-dtr-v1",
      questions: expect.arrayContaining([expect.objectContaining({ id: "knee_xray" })])
    });
  });

  it("auto-settles an eligible policy payment after prior auth submission", async () => {
    const submittedResponse = await submitPriorAuth(
      new Request("http://localhost/api/um/prior-auths", {
        method: "POST",
        body: JSON.stringify({
          patientId: "patient-maya-chen",
          planId: "acme-health-ppo",
          requestType: "outpatient_service",
          serviceCode: "knee_mri",
          dtr: {
            symptomDurationConfirmed: true,
            conservativeTherapyConfirmed: true,
            examFindingsConfirmed: true,
            clinicalNoteAttached: true
          }
        })
      })
    );
    const submitted = (await submittedResponse.json()) as { id: string; caseId: string };

    const response = await listIncentives();
    const payload = (await response.json()) as { rows: Array<{ id: string; umRequestId: string; incentiveStatus: string; paymentStatus: string; transactionId: string | null }> };
    const row = payload.rows.find((candidate) => candidate.umRequestId === submitted.id);

    expect(response.status).toBe(200);
    expect(row).toMatchObject({
      id: submitted.id,
      umRequestId: submitted.id,
      incentiveStatus: "paid",
      paymentStatus: "auto_executed"
    });
    expect(row).not.toHaveProperty("paResult");
    expect(row).not.toHaveProperty("denialReason");
    expect(row?.transactionId).toContain("testnet-");
  });

  it("accepts knee MRI prior auth submission when assessment is skipped", async () => {
    const submittedResponse = await submitPriorAuth(
      new Request("http://localhost/api/um/prior-auths", {
        method: "POST",
        body: JSON.stringify({
          patientId: "patient-andre-williams",
          planId: "summit-health-hmo",
          requestType: "outpatient_service",
          serviceCode: "knee_mri"
        })
      })
    );
    const submitted = (await submittedResponse.json()) as {
      dtr: unknown;
      patientId: string;
      planId: string;
      state: string;
      outcomeStatus: string | null;
    };

    expect(submittedResponse.status).toBe(200);
    expect(submitted).toMatchObject({
      patientId: "patient-andre-williams",
      planId: "summit-health-hmo",
      state: "pend",
      outcomeStatus: null,
      dtr: null
    });
    expect(submitted).not.toHaveProperty("paResult");
    expect(submitted).not.toHaveProperty("denialReason");
  });

  it("rejects a prior auth submission when the selected plan is not tied to the selected patient", async () => {
    const response = await submitPriorAuth(
      new Request("http://localhost/api/um/prior-auths", {
        method: "POST",
        body: JSON.stringify({
          patientId: "patient-maya-chen",
          planId: "summit-health-hmo",
          requestType: "outpatient_service",
          serviceCode: "knee_mri"
        })
      })
    );

    await expect(response.json()).resolves.toEqual({ error: "INVALID_PATIENT_PLAN_SELECTION" });
    expect(response.status).toBe(400);
  });

  it("lists submitted prior authorizations through the async API read path", async () => {
    const submittedResponse = await submitPriorAuth(
      new Request("http://localhost/api/um/prior-auths", {
        method: "POST",
        body: JSON.stringify({
          patientId: "patient-maya-chen",
          planId: "acme-health-ppo",
          requestType: "outpatient_service",
          serviceCode: "knee_mri"
        })
      })
    );
    const submitted = (await submittedResponse.json()) as { id: string };

    const response = await listPriorAuths();
    const records = (await response.json()) as Array<{ id: string; caseId: string; serviceCode: string }>;

    expect(response.status).toBe(200);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: submitted.id,
          caseId: submitted.id,
          serviceCode: "knee_mri"
        })
      ])
    );
    expect(records.find((record) => record.id === submitted.id)).not.toHaveProperty("paResult");
    expect(records.find((record) => record.id === submitted.id)).not.toHaveProperty("denialReason");
  });

  it("returns submitted evidence through the async API read path", async () => {
    const submittedResponse = await submitPriorAuth(
      new Request("http://localhost/api/um/prior-auths", {
        method: "POST",
        body: JSON.stringify({
          patientId: "patient-maya-chen",
          planId: "acme-health-ppo",
          requestType: "outpatient_service",
          serviceCode: "knee_mri",
          dtr: {
            symptomDurationConfirmed: true,
            conservativeTherapyConfirmed: true,
            examFindingsConfirmed: true,
            clinicalNoteAttached: true
          }
        })
      })
    );
    const submitted = (await submittedResponse.json()) as { id: string };

    const response = await getEvidence(new Request(`http://localhost/api/um/prior-auths/${submitted.id}/evidence`), {
      params: Promise.resolve({ caseId: submitted.id })
    });
    const evidence = (await response.json()) as { id: string; umRequestId: string; caseId: string; fhirFieldsPresent: boolean };

    expect(response.status).toBe(200);
    expect(evidence).toMatchObject({
      id: submitted.id,
      umRequestId: submitted.id,
      caseId: submitted.id,
      fhirFieldsPresent: true
    });
  });

  it("returns 404 for missing evidence", async () => {
    const response = await getEvidence(new Request("http://localhost/api/um/prior-auths/missing/evidence"), {
      params: Promise.resolve({ caseId: "missing" })
    });

    await expect(response.json()).resolves.toEqual({ error: "EVIDENCE_NOT_FOUND" });
    expect(response.status).toBe(404);
  });
});
