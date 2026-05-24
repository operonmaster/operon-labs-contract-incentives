import { describe, expect, it } from "vitest";
import { GET as getCoverageRequirements } from "../app/api/um/crd/coverage-requirements/route";
import { GET as listCrdServiceOptions } from "../app/api/um/crd/service-options/route";
import { GET as getDtrQuestionnaire } from "../app/api/um/dtr/questionnaires/[questionnaireId]/route";
import { GET as listIncentives } from "../app/api/provider-documentation/incentives/route";
import { GET as listPriorAuths, POST as submitPriorAuth } from "../app/api/um/prior-auths/route";
import { GET as getEvidence } from "../app/api/um/prior-auths/[caseId]/evidence/route";

describe("provider documentation API routes", () => {
  it("serves CRD service options matching the provider portal service picker", async () => {
    const response = await listCrdServiceOptions();
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
      new Request("http://localhost/api/um/crd/coverage-requirements?requestType=outpatient_service&serviceCode=knee_mri")
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
    const submitted = (await submittedResponse.json()) as { caseId: string };

    const response = await listIncentives();
    const payload = (await response.json()) as { rows: Array<{ caseId: string; incentiveStatus: string; paymentStatus: string; transactionId: string | null }> };
    const row = payload.rows.find((candidate) => candidate.caseId === submitted.caseId);

    expect(response.status).toBe(200);
    expect(row).toMatchObject({
      incentiveStatus: "paid",
      paymentStatus: "auto_executed"
    });
    expect(row?.transactionId).toContain("testnet-");
  });

  it("accepts knee MRI prior auth submission when assessment is skipped", async () => {
    const submittedResponse = await submitPriorAuth(
      new Request("http://localhost/api/um/prior-auths", {
        method: "POST",
        body: JSON.stringify({ requestType: "outpatient_service", serviceCode: "knee_mri" })
      })
    );
    const submitted = (await submittedResponse.json()) as { dtr: unknown; paResult: string };

    expect(submittedResponse.status).toBe(200);
    expect(submitted).toMatchObject({
      paResult: "submitted_pending",
      dtr: null
    });
  });

  it("lists submitted prior authorizations through the async API read path", async () => {
    const submittedResponse = await submitPriorAuth(
      new Request("http://localhost/api/um/prior-auths", {
        method: "POST",
        body: JSON.stringify({ requestType: "outpatient_service", serviceCode: "knee_mri" })
      })
    );
    const submitted = (await submittedResponse.json()) as { caseId: string };

    const response = await listPriorAuths();
    const records = (await response.json()) as Array<{ caseId: string; serviceCode: string }>;

    expect(response.status).toBe(200);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          caseId: submitted.caseId,
          serviceCode: "knee_mri"
        })
      ])
    );
  });

  it("returns submitted evidence through the async API read path", async () => {
    const submittedResponse = await submitPriorAuth(
      new Request("http://localhost/api/um/prior-auths", {
        method: "POST",
        body: JSON.stringify({
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
    const submitted = (await submittedResponse.json()) as { caseId: string };

    const response = await getEvidence(new Request(`http://localhost/api/um/prior-auths/${submitted.caseId}/evidence`), {
      params: Promise.resolve({ caseId: submitted.caseId })
    });
    const evidence = (await response.json()) as { caseId: string; fhirFieldsPresent: boolean };

    expect(response.status).toBe(200);
    expect(evidence).toMatchObject({
      caseId: submitted.caseId,
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
