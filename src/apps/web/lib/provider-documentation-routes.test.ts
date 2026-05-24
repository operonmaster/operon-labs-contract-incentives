import { describe, expect, it } from "vitest";
import { GET as listIncentives } from "../app/api/provider-documentation/incentives/route";
import { POST as submitPriorAuth } from "../app/api/um/prior-auths/route";
import { GET as getEvidence } from "../app/api/um/prior-auths/[caseId]/evidence/route";

describe("provider documentation API routes", () => {
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

  it("returns 404 for missing evidence", async () => {
    const response = await getEvidence(new Request("http://localhost/api/um/prior-auths/missing/evidence"), {
      params: Promise.resolve({ caseId: "missing" })
    });

    await expect(response.json()).resolves.toEqual({ error: "EVIDENCE_NOT_FOUND" });
    expect(response.status).toBe(404);
  });
});
