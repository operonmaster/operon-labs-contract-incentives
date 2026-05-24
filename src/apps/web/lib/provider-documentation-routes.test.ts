import { describe, expect, it } from "vitest";
import { POST as approvePayment } from "../app/api/provider-documentation/incentives/[caseId]/approve/route";
import { POST as submitPriorAuth } from "../app/api/um/prior-auths/route";
import { GET as getEvidence } from "../app/api/um/prior-auths/[caseId]/evidence/route";

describe("provider documentation API routes", () => {
  it("requires a plan role header before approval", async () => {
    const response = await approvePayment(new Request("http://localhost/api/provider-documentation/incentives/missing/approve"), {
      params: Promise.resolve({ caseId: "missing" })
    });

    await expect(response.json()).resolves.toEqual({ error: "PLAN_APPROVAL_REQUIRED" });
    expect(response.status).toBe(403);
  });

  it("approves an eligible row when the plan role header is present", async () => {
    const submittedResponse = await submitPriorAuth(
      new Request("http://localhost/api/um/prior-auths", {
        method: "POST",
        body: JSON.stringify({
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

    const response = await approvePayment(
      new Request(`http://localhost/api/provider-documentation/incentives/${submitted.caseId}/approve`, {
        headers: {
          "x-operon-plan-role": "contract-admin"
        }
      }),
      {
        params: Promise.resolve({ caseId: submitted.caseId })
      }
    );
    const row = (await response.json()) as { incentiveStatus: string; transactionId: string | null };

    expect(response.status).toBe(200);
    expect(row.incentiveStatus).toBe("paid");
    expect(row.transactionId).toContain("testnet-");
  });

  it("returns 404 for missing evidence", async () => {
    const response = await getEvidence(new Request("http://localhost/api/um/prior-auths/missing/evidence"), {
      params: Promise.resolve({ caseId: "missing" })
    });

    await expect(response.json()).resolves.toEqual({ error: "EVIDENCE_NOT_FOUND" });
    expect(response.status).toBe(404);
  });
});
